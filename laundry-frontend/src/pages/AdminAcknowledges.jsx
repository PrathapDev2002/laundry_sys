import { useEffect, useState } from "react";
import AdminLayout from "../components/Adminlayout";
import { getAcknowledgements, acknowledgeDropoff, getDepartmentItems } from "../api/api";

const sortNames = (names) => [...new Set(names)].sort((a, b) => a.localeCompare(b));

export default function AdminAcknowledge() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);

  // The drop-off being verified. Each line keeps what fjfjfj staff submitted (original*) next to what
  // the counter says it really is (itemName / pcs) — the counter can fix either one, because
  // staff sometimes pick the wrong item.
  const [active, setActive] = useState(null);
  const [lines, setLines] = useState([]); // [{ originalName, originalPcs, itemName, pcs }]
  const [itemOptions, setItemOptions] = useState([]); // items this department can have
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await getAcknowledgements();
      setPending(Array.isArray(data?.transactions) ? data.transactions : []);
    } catch {
      setPending([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openVerify = (t) => {
    setActive(t);
    setError("");
    setLines(
      t.items.map((i) => ({ originalName: i.itemName, originalPcs: i.pcs, itemName: i.itemName, pcs: String(i.pcs) }))
    );
    // Start with the submitted items so the dropdowns work immediately, then add the rest of
    // the department's items. Submitted items always stay selectable, even if one has since
    // been removed from the department's list.
    const submittedNames = t.items.map((i) => i.itemName);
    setItemOptions(sortNames(submittedNames));
    getDepartmentItems(t.department)
      .then(({ data }) => {
        if (Array.isArray(data)) setItemOptions(sortNames([...submittedNames, ...data.map((i) => i.itemName)]));
      })
      .catch(() => {});
  };

  const closeVerify = () => {
    setActive(null);
    setLines([]);
    setError("");
  };

  const updateLine = (index, field, value) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));

  const qty = (l) => Number(l.pcs);
  const qtyOk = (l) => l.pcs !== "" && Number.isInteger(qty(l)) && qty(l) >= 0;
  const isChanged = (l) => l.itemName !== l.originalName || qty(l) !== l.originalPcs;

  const hasChanges = lines.some(isChanged);
  const allValid = lines.length > 0 && lines.every(qtyOk);
  const hasAnyQty = lines.some((l) => qtyOk(l) && qty(l) > 0);

  // Lines that point at the same item will be added together by the server — say so up front.
  const itemCounts = {};
  lines.forEach((l) => {
    if (qtyOk(l) && qty(l) > 0) itemCounts[l.itemName] = (itemCounts[l.itemName] || 0) + 1;
  });
  const combined = Object.keys(itemCounts).filter((n) => itemCounts[n] > 1);

  const handleConfirm = async () => {
    setSaving(true);
    setError("");
    try {
      await acknowledgeDropoff(
        active._id,
        lines.map((l) => ({ itemName: l.itemName, pcs: qty(l) }))
      );
      closeVerify();
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to verify. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (iso) =>
    new Date(iso).toLocaleString(undefined, {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });

  return (
    <AdminLayout title="Acknowledge Drop-offs">
      <p className="text-sm text-gray-500 mb-4">
        Verify the physical count against what was submitted. If staff picked the wrong item or quantity, fix it here.
      </p>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-200 text-gray-500">
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Pcs</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="px-4 py-6 text-center text-gray-400">Loading...</td></tr>
            ) : pending.length === 0 ? (
              <tr><td colSpan="6" className="px-4 py-6 text-center text-gray-400">Nothing pending acknowledgement.</td></tr>
            ) : (
              pending.map((t) => (
                <tr key={t._id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(t.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div>{t.staffName}</div>
                    <div className="text-xs text-gray-400">{t.staffId}</div>
                  </td>
                  <td className="px-4 py-3">{t.department}</td>
                  <td className="px-4 py-3">
                    {t.items.map((i, idx) => (
                      <div key={idx} className="text-xs text-gray-600">{i.itemName} × {i.pcs}</div>
                    ))}
                  </td>
                  <td className="px-4 py-3 font-medium">{t.totalPcs}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openVerify(t)}
                      className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
                    >
                      Verify
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Verify popup */}
      {active && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-10">
          <div className="bg-white rounded-2xl shadow p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold mb-1">Verify Drop-off</h2>
            <p className="text-xs text-gray-500 mb-3">
              {active.staffName} ({active.staffId}) · {active.department}
            </p>
            <p className="text-xs text-gray-500 mb-3">
              Change the item or quantity of any line to match what you actually received. Use 0 for an item that wasn't received.
            </p>

            {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-2 mb-3">{error}</div>}

            <div className="space-y-2 mb-3">
              {lines.map((l, i) => {
                const changed = isChanged(l);
                return (
                  <div
                    key={i}
                    className={`rounded-xl border p-2.5 ${changed ? "border-amber-300 bg-amber-50/60" : "border-gray-200"}`}
                  >
                    <div className="flex gap-2">
                      <select
                        value={l.itemName}
                        onChange={(e) => updateLine(i, "itemName", e.target.value)}
                        aria-label={`Item for line ${i + 1}`}
                        className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                      >
                        {itemOptions.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={l.pcs}
                        onChange={(e) => updateLine(i, "pcs", e.target.value)}
                        aria-label={`Quantity for line ${i + 1}`}
                        className={`w-20 shrink-0 border rounded-lg px-2 py-1.5 text-sm ${
                          qtyOk(l) ? "border-gray-300" : "border-red-400 bg-red-50"
                        }`}
                      />
                    </div>
                    <p className="text-xs mt-1.5 text-gray-400">
                      Submitted: {l.originalName} × {l.originalPcs}
                      {changed && <span className="text-amber-700"> · changed</span>}
                      {qtyOk(l) && qty(l) === 0 && <span className="text-amber-700"> · not received, won't be recorded</span>}
                    </p>
                  </div>
                );
              })}
            </div>

            {combined.length > 0 && (
              <div className="bg-sky-50 text-sky-700 text-xs rounded-lg p-2 mb-3">
                {combined.join(", ")} appears on more than one line. They will be added together.
              </div>
            )}
            {hasChanges && (
              <div className="bg-amber-50 text-amber-700 text-xs rounded-lg p-2 mb-3">
                This differs from what was submitted. It will be recorded as a correction, and the submitted details are kept.
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={closeVerify} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving || !allValid || !hasAnyQty}
                className="flex-1 bg-blue-600 disabled:bg-gray-300 text-white rounded-lg py-2 text-sm font-medium"
              >
                {saving ? "Saving..." : hasChanges ? "Confirm Correction" : "Confirm Match"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}