import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getEmployee, getDepartmentItems, submitTransaction, getPendingItems, getMyNotices } from "../api/api";

const emptyRow = { itemName: "", pcs: "" };

export default function StaffForm() {
  const location = useLocation();
  const isAdminEntry = location.pathname.startsWith("/admin"); // opened as admin's backup entry page
  const [staffId, setStaffId] = useState("");
  const [employee, setEmployee] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [deptNotRegistered, setDeptNotRegistered] = useState(false); // employee found, but their department has no items configured yet
  const [deptItems, setDeptItems] = useState([]); // items available for this employee's department
  const [pendingItems, setPendingItems] = useState([]); // items dropped off but not yet picked up, for reference
  const [notices, setNotices] = useState([]); // one-time discrepancy notices from past drop-offs
  const [rows, setRows] = useState([{ ...emptyRow }]);
  const [action, setAction] = useState("DROP_OFF");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [leftPage, setLeftPage] = useState(false);
  const [error, setError] = useState("");

  const [lookingUp, setLookingUp] = useState(false);

  // Look up employee — triggered by the Fetch Details button (and Enter key)
  const lookupEmployee = async () => {
    if (!staffId.trim()) return;
    setLookingUp(true);
    setError("");
    setNotFound(false);
    setDeptNotRegistered(false);
    setEmployee(null);
    setDeptItems([]);
    setPendingItems([]);
    setNotices([]);
    setRows([{ ...emptyRow }]);
    setAction("DROP_OFF");

    // Step 1: find the employee. If this fails, nothing else runs.
    let data;
    try {
      const res = await getEmployee(staffId.trim());
      data = res.data;
      setEmployee(data);
    } catch (err) {
      if (err.response?.status === 404) {
        setNotFound(true);
      } else {
        setError("Something went wrong looking up your ID. Please try again.");
      }
      setLookingUp(false);
      return;
    }

    // Step 2: employee was found — now load their department's item list.
    // A failure here is a DIFFERENT situation (department just isn't registered
    // yet), so it gets its own message instead of being confused with "not found".
    try {
      const itemsRes = await getDepartmentItems(data.department);
      setDeptItems(itemsRes.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setDeptNotRegistered(true);
      } else {
        setError("Something went wrong loading items for your department. Please try again.");
      }
      setLookingUp(false);
      return;
    }

    // Step 3: pending-pickup reference — non-critical, form still works without it.
    try {
      const pendingRes = await getPendingItems(data.department);
      setPendingItems(Array.isArray(pendingRes.data) ? pendingRes.data : []);
    } catch {
      setPendingItems([]);
    }

    // Step 4: one-time discrepancy notices from a past drop-off that got corrected
    // at the counter. Non-critical — form still works fine without it.
    try {
      const noticesRes = await getMyNotices(staffId.trim());
      setNotices(Array.isArray(noticesRes.data) ? noticesRes.data : []);
    } catch {
      setNotices([]);
    }

    setLookingUp(false);
  };

  const isPickup = action === "PICKUP";

  // Pickup rules: only items this department dropped off AND the counter has verified,
  // and never more than what is still there.
  const readyItems = pendingItems.filter((p) => p.availablePcs > 0);
  const awaitingItems = pendingItems.filter((p) => p.awaitingPcs > 0);
  const availableFor = (itemName) => readyItems.find((p) => p.itemName === itemName)?.availablePcs ?? 0;
  const noPickupAvailable = isPickup && readyItems.length === 0;

  // Dropdown options for one row. Drop-off: the department's whole item list.
  // Pickup: only verified items still at the laundry, minus ones already picked in another row.
  const optionsFor = (rowIndex) => {
    if (!isPickup) {
      return deptItems.map((it) => ({ key: it._id, value: it.itemName, label: it.itemName }));
    }
    const usedElsewhere = new Set(rows.filter((_, i) => i !== rowIndex).map((r) => r.itemName));
    return readyItems
      .filter((p) => !usedElsewhere.has(p.itemName))
      .map((p) => ({ key: p.itemName, value: p.itemName, label: `${p.itemName} — ${p.availablePcs} ready` }));
  };

  // Picking an item in pickup mode fills in the full quantity that is ready.
  const selectItem = (index, itemName) =>
    setRows((prev) =>
      prev.map((r, i) =>
        i !== index
          ? r
          : { ...r, itemName, pcs: isPickup ? (itemName ? String(availableFor(itemName)) : "") : r.pcs }
      )
    );

  // Quantity can be lowered freely, but in pickup mode never raised above what is ready.
  const changePcs = (index, value) =>
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        if (isPickup && r.itemName && value !== "") {
          const n = Math.floor(Number(value));
          if (!Number.isFinite(n)) return r;
          return { ...r, pcs: String(Math.min(Math.max(n, 0), availableFor(r.itemName))) };
        }
        return { ...r, pcs: value };
      })
    );

  const changeAction = (a) => {
    setAction(a);
    setRows([{ ...emptyRow }]); // the item list differs between drop-off and pickup
    setError("");
  };

  const canAddRow = !isPickup || rows.length < readyItems.length;
  const addRow = () => setRows((prev) => [...prev, { ...emptyRow }]);
  const removeRow = (index) => setRows((prev) => prev.filter((_, i) => i !== index));

  const totalPcs = rows.reduce((sum, r) => sum + (Number(r.pcs) || 0), 0);

  const validQty = (r) => {
    const n = Number(r.pcs);
    return Number.isInteger(n) && n > 0 && (!isPickup || n <= availableFor(r.itemName));
  };

  const canSubmit =
    employee &&
    !noPickupAvailable &&
    rows.length > 0 &&
    rows.every((r) => r.itemName && validQty(r));

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = {
        staffId: employee.staffId,
        action,
        items: rows.map((r) => ({ itemName: r.itemName, pcs: Number(r.pcs) })),
      };
      const { data } = await submitTransaction(payload);
      setSubmitted(data);
    } catch (err) {
      setError(err.response?.data?.message || "Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = () => {
    setLeftPage(true);
    // Attempt to close the tab (only works if it was opened by script, e.g. via QR deep link
    // in some mobile browsers). If it doesn't close, the "you can close this tab" screen stays.
    window.close();
  };

  const resetForm = () => {
    setStaffId("");
    setEmployee(null);
    setNotFound(false);
    setDeptNotRegistered(false);
    setDeptItems([]);
    setPendingItems([]);
    setNotices([]);
    setRows([{ ...emptyRow }]);
    setAction("DROP_OFF");
    setSubmitted(null);
    setError("");
  };

  // --- "You left" screen (shown after tapping Leave) ---
  if (leftPage) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 w-full max-w-sm sm:max-w-md text-center">
          <div className="text-5xl mb-3">👋</div>
          <h1 className="text-xl font-semibold mb-2">You can close this tab</h1>
          <p className="text-gray-500 text-sm">Thank you — your entry has been recorded.</p>
        </div>
      </div>
    );
  }

  // --- Confirmation screen ---
  if (submitted) {
    return (
      <div className="min-h-screen bg-linear-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 w-full max-w-sm sm:max-w-md md:max-w-lg text-center">
          <div className="text-5xl mb-3">✅</div>
          <h1 className="text-xl sm:text-2xl font-semibold mb-2">Your details has been updated</h1>
          <p className="text-gray-600 mb-4">
            {submitted.action === "DROP_OFF" ? "Drop-off" : "Pickup"} recorded for {submitted.staffName}
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-left mb-5">
            <p className="text-sm text-gray-500">Total pieces</p>
            <p className="text-lg font-medium">{submitted.totalPcs}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {isAdminEntry ? (
              <Link
                to="/admin/transactions"
                className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-3 font-medium text-center active:bg-gray-50"
              >
                Back to Admin
              </Link>
            ) : (
              <button
                onClick={handleLeave}
                className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-3 font-medium active:bg-gray-50"
              >
                Leave
              </button>
            )}
            <button
              onClick={resetForm}
              className="flex-1 bg-blue-600 text-white rounded-xl py-3 font-medium active:bg-blue-700"
            >
              New Entry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-indigo-50 p-4 sm:p-6 md:p-8">
      <div className="max-w-md sm:max-w-lg md:max-w-xl mx-auto bg-white rounded-2xl shadow-lg p-5 sm:p-7 md:p-8">
        {isAdminEntry && (
          <Link to="/admin/employees" className="inline-block text-sm text-blue-600 mb-3">
            ← Back to Admin Panel
          </Link>
        )}
        <h1 className="text-xl sm:text-2xl font-semibold mb-4">Laundry Drop-off / Pickup</h1>

        {/* Staff ID */}
        <label className="block text-sm font-medium text-gray-700 mb-1">Staff ID</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            inputMode="numeric"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookupEmployee()}
            placeholder="Enter your staff ID"
            className="flex-1 min-w-0 border border-gray-300 rounded-xl px-4 py-3 text-base"
          />
          <button
            type="button"
            onClick={lookupEmployee}
            disabled={lookingUp || !staffId.trim()}
            className="shrink-0 bg-blue-600 disabled:bg-gray-300 text-white rounded-xl px-4 sm:px-5 font-medium whitespace-nowrap"
          >
            {lookingUp ? "..." : "Fetch"}
          </button>
        </div>

        {notFound && (
          <div className="bg-red-50 text-red-700 text-sm rounded-xl p-3 mb-4">
            Employee not found. Please approach the counter staff to register your details.
          </div>
        )}
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl p-3 mb-4">{error}</div>}

        {/* Employee details (read-only, auto-filled) */}
        {employee && (
          <div className="bg-blue-50 rounded-xl p-3 mb-4 text-sm">
            <p><span className="text-gray-500">Name:</span> {employee.name}</p>
            <p><span className="text-gray-500">Department:</span> {employee.department}</p>
            <p><span className="text-gray-500">Position:</span> {employee.position}</p>
          </div>
        )}

        {/* Employee found, but their department has no items registered yet — stop here */}
        {deptNotRegistered && (
          <div className="bg-red-50 text-red-700 text-sm rounded-xl p-3 mb-4">
            Your department's items are not registered yet. Please approach the counter staff.
          </div>
        )}

        {/* Ready for pickup — verified drop-offs of this department still at the laundry */}
        {employee && !deptNotRegistered && readyItems.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm">
            <p className="font-medium text-amber-800 mb-1.5">Ready for pickup ({employee.department})</p>
            {readyItems.map((p) => (
              <div key={p.itemName} className="flex justify-between text-amber-700 py-0.5">
                <span>{p.itemName}</span>
                <span>{p.availablePcs} pcs</span>
              </div>
            ))}
            <p className="text-xs text-amber-600 mt-1.5">Only verified drop-offs can be picked up.</p>
          </div>
        )}

        {/* Dropped off but the counter hasn't verified it yet — can't be picked up until then */}
        {employee && !deptNotRegistered && awaitingItems.length > 0 && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 mb-4 text-sm">
            <p className="font-medium text-sky-800 mb-1.5">Waiting for counter verification</p>
            {awaitingItems.map((p) => (
              <div key={p.itemName} className="flex justify-between text-sky-700 py-0.5">
                <span>{p.itemName}</span>
                <span>{p.awaitingPcs} pcs</span>
              </div>
            ))}
            <p className="text-xs text-sky-600 mt-1.5">These can be picked up once the counter verifies them.</p>
          </div>
        )}

        {/* One-time notice: a past drop-off's quantity was corrected at the counter */}
        {employee && notices.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4 text-sm">
            <p className="font-medium text-orange-800 mb-1.5">⚠ Quantity correction on a past drop-off</p>
            {notices.map((n, idx) => (
              <div key={idx} className="mb-2 last:mb-0">
                {n.items.map((it) => (
                  <p key={it.itemName} className="text-orange-700">
                    {it.itemName}: you submitted {it.originalPcs}, counter verified {it.verifiedPcs}
                  </p>
                ))}
                <p className="text-xs text-orange-600 mt-0.5">
                  Verified by {n.acknowledgedBy} on {new Date(n.acknowledgedAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}

        {employee && !deptNotRegistered && (
          <>
            {/* Action toggle */}
            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <div className="flex gap-2 mb-4">
              {["DROP_OFF", "PICKUP"].map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => changeAction(a)}
                  className={`flex-1 rounded-xl py-3 font-medium border ${
                    action === a
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300"
                  }`}
                >
                  {a === "DROP_OFF" ? "Drop-off" : "Pickup"}
                </button>
              ))}
            </div>

            {noPickupAvailable ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
                {awaitingItems.length > 0
                  ? "Nothing is ready for pickup yet. Your department's drop-off is still waiting to be verified at the counter."
                  : "Nothing to pick up. Your department has no verified drop-offs waiting."}
              </div>
            ) : (
              <>
                {/* Item rows */}
                <label className="block text-sm font-medium text-gray-700 mb-1">Items</label>
                {rows.map((row, i) => {
                  const max = isPickup && row.itemName ? availableFor(row.itemName) : null;
                  return (
                    <div key={i} className="border border-gray-200 rounded-xl p-3 mb-2">
                      <div className="flex gap-2 mb-2">
                        <select
                          value={row.itemName}
                          onChange={(e) => selectItem(i, e.target.value)}
                          className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-2 text-sm md:text-base md:py-2.5"
                        >
                          <option value="">Select item</option>
                          {optionsFor(i).map((o) => (
                            <option key={o.key} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          max={max ?? undefined}
                          step="1"
                          inputMode="numeric"
                          placeholder="Pcs"
                          value={row.pcs}
                          onChange={(e) => changePcs(i, e.target.value)}
                          className="w-16 shrink-0 border border-gray-300 rounded-lg px-2 py-2 text-sm"
                        />
                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRow(i)}
                            className="shrink-0 text-red-500 px-1"
                            aria-label="Remove item"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      {max !== null && (
                        <p className="text-xs text-gray-500">Max {max} pcs ready — you can lower it</p>
                      )}
                    </div>
                  );
                })}

                <div className="mb-4">
                  {canAddRow && (
                    <button type="button" onClick={addRow} className="text-blue-600 text-sm font-medium">
                      + Add another item
                    </button>
                  )}
                </div>

                {/* Live totals */}
                <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm">
                  Total: <strong>{totalPcs} pcs</strong>
                </div>

                <button
                  type="button"
                  disabled={!canSubmit || loading}
                  onClick={handleSubmit}
                  className="w-full bg-blue-600 disabled:bg-gray-300 text-white rounded-xl py-3 font-medium active:bg-blue-700"
                >
                  {loading ? "Submitting..." : "Submit"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}