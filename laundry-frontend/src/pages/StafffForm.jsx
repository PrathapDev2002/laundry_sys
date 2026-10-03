import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getEmployee, getDepartmentItems, submitTransaction, getPendingItems } from "../api/api";

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

    setLookingUp(false);
  };

  const weightFor = (itemName) => deptItems.find((i) => i.itemName === itemName)?.weightPerPc || 0;

  const updateRow = (index, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, { ...emptyRow }]);
  const removeRow = (index) => setRows((prev) => prev.filter((_, i) => i !== index));

  const totals = rows.reduce(
    (acc, r) => {
      const pcs = Number(r.pcs) || 0;
      const weight = pcs * weightFor(r.itemName);
      return { pcs: acc.pcs + pcs, weight: acc.weight + weight };
    },
    { pcs: 0, weight: 0 }
  );

  const canSubmit =
    employee &&
    rows.length > 0 &&
    rows.every((r) => r.itemName && Number(r.pcs) > 0);

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
          <div className="bg-gray-50 rounded-xl p-4 text-left mb-5 grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-gray-500">Total pieces</p>
              <p className="text-lg font-medium">{submitted.totalPcs}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total weight</p>
              <p className="text-lg font-medium">{submitted.totalWeight.toFixed(2)} kg</p>
            </div>
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
          <Link to="/admin/employee" className="inline-block text-sm text-blue-600 mb-3">
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

        {/* Pending pickup reference — how much this department still has at the laundry */}
        {employee && !deptNotRegistered && pendingItems.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm">
            <p className="font-medium text-amber-800 mb-1.5">Available for pickup ({employee.department})</p>
            {pendingItems.map((p) => (
              <div key={p.itemName} className="flex justify-between text-amber-700 py-0.5">
                <span>{p.itemName}</span>
                <span>{p.pendingPcs} pcs · {p.pendingWeight} kg</span>
              </div>
            ))}
            <p className="text-xs text-amber-600 mt-1.5">
              Based on drop-offs not yet marked as picked up. For reference only.
            </p>
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
                  onClick={() => setAction(a)}
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

            {/* Item rows */}
            <label className="block text-sm font-medium text-gray-700 mb-1">Items</label>
            {rows.map((row, i) => {
              const lineWeight = (Number(row.pcs) || 0) * weightFor(row.itemName);
              return (
                <div key={i} className="border border-gray-200 rounded-xl p-3 mb-2">
                  <div className="flex gap-2 mb-2">
                    <select
                      value={row.itemName}
                      onChange={(e) => updateRow(i, "itemName", e.target.value)}
                      className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-2 text-sm md:text-base md:py-2.5"
                    >
                      <option value="">Select item</option>
                      {deptItems.map((it) => (
                        <option key={it._id} value={it.itemName}>
                          {it.itemName}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      placeholder="Pcs"
                      value={row.pcs}
                      onChange={(e) => updateRow(i, "pcs", e.target.value)}
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
                  {row.itemName && row.pcs && (
                    <p className="text-xs text-gray-500">≈ {lineWeight.toFixed(2)} kg</p>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={addRow}
              className="text-blue-600 text-sm font-medium mb-4"
            >
              + Add another item
            </button>

            {/* Live totals */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4 flex justify-between text-sm">
              <span>Total: <strong>{totals.pcs} pcs</strong></span>
              <span><strong>{totals.weight.toFixed(2)} kg</strong></span>
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
      </div>
    </div>
  );
}