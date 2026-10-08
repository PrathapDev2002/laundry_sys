import { useEffect, useState } from "react";
import AdminLayout from "../components/Adminlayout";
import { getAcknowledgements, acknowledgeDropoff } from "../api/api";

export default function AdminAcknowledge() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);

  // The transaction currently open for verification, and the editable quantities for it
  const [active, setActive] = useState(null);
  const [verifiedPcs, setVerifiedPcs] = useState({}); // { itemName: pcs }
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
    const initial = {};
    t.items.forEach((i) => { initial[i.itemName] = i.pcs; });
    setVerifiedPcs(initial);
  };

  const closeVerify = () => {
    setActive(null);
    setVerifiedPcs({});
    setError("");
  };

  const hasChanges = active
    ? active.items.some((i) => Number(verifiedPcs[i.itemName]) !== i.pcs)
    : false;

  const handleConfirm = async () => {
    setSaving(true);
    setError("");
    try {
      const items = active.items.map((i) => ({
        itemName: i.itemName,
        pcs: Number(verifiedPcs[i.itemName]),
      }));
      await acknowledgeDropoff(active._id, items);
      closeVerify();
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to acknowledge. Please try again.");
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
        Verify the physical count against what was submitted. Correct the quantity here if it doesn't match.
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

      {/* Verify modal */}
      {active && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-10">
          <div className="bg-white rounded-2xl shadow p-5 w-full max-w-sm">
            <h2 className="font-semibold mb-1">Verify Drop-off</h2>
            <p className="text-xs text-gray-500 mb-3">
              {active.staffName} ({active.staffId}) · {active.department}
            </p>

            {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-2 mb-3">{error}</div>}

            <div className="space-y-2 mb-4">
              {active.items.map((i) => (
                <div key={i.itemName} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-700">{i.itemName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">submitted: {i.pcs}</span>
                    <input
                      type="number"
                      min="0"
                      value={verifiedPcs[i.itemName] ?? ""}
                      onChange={(e) =>
                        setVerifiedPcs((prev) => ({ ...prev, [i.itemName]: e.target.value }))
                      }
                      className={`w-20 border rounded-lg px-2 py-1.5 text-sm ${
                        Number(verifiedPcs[i.itemName]) !== i.pcs
                          ? "border-amber-400 bg-amber-50"
                          : "border-gray-300"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>

            {hasChanges && (
              <div className="bg-amber-50 text-amber-700 text-xs rounded-lg p-2 mb-4">
                Quantity differs from what was submitted. This will be recorded as a discrepancy.
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={closeVerify}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving}
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