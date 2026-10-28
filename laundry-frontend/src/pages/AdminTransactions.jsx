import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Info, BadgeCheck, Eye, Trash2, X } from "lucide-react";
import AdminLayout from "../components/Adminlayout";
import { getTransactions, listDepartments, deleteTransaction } from "../api/api";

const PAGE_SIZE = 20;

const emptyFilters = {
  department: "",
  action: "",
  staffId: "",
  verification: "", // "" | "PENDING" | "VERIFIED" | "CORRECTED"
  from: "",
  to: "",
};

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// Per-item comparison of what staff submitted vs what the counter verified. bhgjhg
// originalItems only exists when the count was corrected; otherwise both sides match.
const comparisonRows = (t) => {
  const original = t.originalItems?.length ? t.originalItems : t.items;
  const names = [...new Set([...original.map((i) => i.itemName), ...t.items.map((i) => i.itemName)])];
  return names.map((name) => {
    const submitted = original.find((i) => i.itemName === name)?.pcs ?? 0;
    const verified = t.items.find((i) => i.itemName === name)?.pcs ?? 0;
    return { name, submitted, verified, diff: verified - submitted };
  });
};

const diffClass = (diff) =>
  diff < 0 ? "text-red-600" : diff > 0 ? "text-green-600" : "text-gray-400";
const diffText = (diff) => (diff > 0 ? `+${diff}` : `${diff}`);

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);

  // "draft" is what's typed in the inputs; "applied" is what the table is actually using.
  const [draft, setDraft] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);

  const [detail, setDetail] = useState(null); // transaction shown in the details popup
  const [reload, setReload] = useState(0); // bump to re-fetch the current page (after a delete)

  const [toDelete, setToDelete] = useState(null); // transaction waiting for delete confirmation
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    listDepartments()
      .then(({ data }) => setDepartments(Array.isArray(data) ? data : []))
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = {
          department: applied.department || undefined,
          action: applied.action || undefined,
          staffId: applied.staffId || undefined,
          from: applied.from || undefined,
          to: applied.to || undefined,
          page,
          limit: PAGE_SIZE,
        };
        if (applied.verification === "PENDING") params.status = "PENDING";
        if (applied.verification === "VERIFIED") params.status = "ACKNOWLEDGED";
        if (applied.verification === "CORRECTED") params.discrepancy = "true";

        const { data } = await getTransactions(params);
        const rows = Array.isArray(data?.transactions) ? data.transactions : [];
        setTransactions(rows);
        setTotal(data?.total || 0);
        // Deleted the only row on the last page? Go back one page instead of showing an empty one.
        if (rows.length === 0 && page > 1) setPage((p) => p - 1);
      } catch {
        setTransactions([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [applied, page, reload]);

  const setField = (field) => (e) => setDraft((d) => ({ ...d, [field]: e.target.value }));

  const applyFilters = () => {
    setPage(1);
    setApplied(draft);
  };

  const clearFilters = () => {
    setDraft(emptyFilters);
    setApplied(emptyFilters);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const askDelete = (t) => {
    setDeleteError("");
    setToDelete(t);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteTransaction(toDelete._id);
      setToDelete(null);
      setDetail(null);
      setReload((r) => r + 1);
    } catch (err) {
      setDeleteError(err.response?.data?.message || "Failed to delete. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  // The status shown on each row
  
  const verificationCell = (t) => {
    if (t.action !== "DROP_OFF" || !t.status) return <span className="text-gray-300">—</span>;
    if (t.status === "PENDING") {
      return <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Pending</span>;
    }
    return (
      <button
        onClick={() => setDetail(t)}
        title={t.hasDiscrepancy ? "Quantity corrected — view details" : "Verified — view details"}
        className={`p-1 rounded-full hover:bg-gray-100 ${t.hasDiscrepancy ? "text-amber-500" : "text-green-500"}`}
      >
        {t.hasDiscrepancy ? <Info size={19} /> : <BadgeCheck size={19} />}
      </button>
    );
  };

  return (
    <AdminLayout title="Transactions">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <select
            value={draft.department}
            onChange={setField("department")}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All departments</option>
            {(departments || []).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={draft.action}
            onChange={setField("action")}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All actions</option>
            <option value="DROP_OFF">Drop-off</option>
            <option value="PICKUP">Pickup</option>
          </select>
          <select
            value={draft.verification}
            onChange={setField("verification")}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All verification</option>
            <option value="PENDING">Pending</option>
            <option value="VERIFIED">Verified</option>
            <option value="CORRECTED">Corrected</option>
          </select>
          <input
            type="text"
            placeholder="Staff ID"
            value={draft.staffId}
            onChange={setField("staffId")}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={draft.from}
            onChange={setField("from")}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={draft.to}
            onChange={setField("to")}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={applyFilters}
              className="flex-1 bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium"
            >
              Filter
            </button>
            <button
              onClick={clearFilters}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Table — double-click a row (or use the eye icon) to see everything about it */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-200 text-gray-500">
              <th className="px-4 py-3">Date & Time</th>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Pcs</th>
              <th className="px-4 py-3">Weight (kg)</th>
              <th className="px-4 py-3">Verified</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" className="px-4 py-6 text-center text-gray-400">Loading...</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan="9" className="px-4 py-6 text-center text-gray-400">No transactions found.</td></tr>
            ) : (
              transactions.map((t) => (
                <tr
                  key={t._id}
                  tabIndex={0}
                  title="Double-click to view details"
                  onDoubleClick={() => setDetail(t)}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && e.key === "Enter") setDetail(t);
                  }}
                  className="border-b border-gray-100 last:border-0 align-top cursor-pointer select-none hover:bg-gray-50 focus:outline-none focus:bg-blue-50/50"
                >
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(t.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div>{t.staffName}</div>
                    <div className="text-xs text-gray-400">{t.staffId} · {t.position}</div>
                  </td>
                  <td className="px-4 py-3">{t.department}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        t.action === "DROP_OFF" ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"
                      }`}
                    >
                      {t.action === "DROP_OFF" ? "Drop-off" : "Pickup"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {t.items?.map((it, i) => (
                      <div key={i} className="text-xs text-gray-600">
                        {it.itemName} × {it.pcs}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {t.hasDiscrepancy && (
                      <span className="line-through text-xs text-gray-400 mr-1">{t.originalTotalPcs}</span>
                    )}
                    {t.totalPcs}
                  </td>
                  <td className="px-4 py-3">{t.totalWeight?.toFixed(2)}</td>
                  <td className="px-4 py-3">{verificationCell(t)}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-right">
                    <button
                      onClick={() => setDetail(t)}
                      aria-label="View details"
                      title="View details"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                    >
                      <Eye size={17} />
                    </button>
                    <button
                      onClick={() => askDelete(t)}
                      aria-label="Delete transaction"
                      title="Delete transaction"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={17} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>
            Page {page} of {totalPages} ({total} total)
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Details popup */}
      {detail && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-30"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-white rounded-2xl shadow p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      detail.action === "DROP_OFF" ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"
                    }`}
                  >
                    {detail.action === "DROP_OFF" ? "Drop-off" : "Pickup"}
                  </span>
                  <h2 className="font-semibold text-gray-800">Transaction details</h2>
                </div>
                <p className="text-xs text-gray-400 mt-1">{formatDateTime(detail.createdAt)}</p>
              </div>
              <button onClick={() => setDetail(null)} aria-label="Close" className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 text-sm mb-4 grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <p className="text-xs text-gray-400">Staff</p>
                <p>{detail.staffName}</p>
                <p className="text-xs text-gray-500">{detail.staffId} · {detail.position}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Department</p>
                <p>{detail.department}</p>
              </div>
            </div>

            {/* Items as currently recorded (for a corrected drop-off: the verified items) */}
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-2">Item</th>
                  <th className="py-2 px-2 text-right">Qty</th>
                  <th className="py-2 pl-2 text-right">Weight (kg)</th>
                </tr>
              </thead>
              <tbody>
                {detail.items?.map((it, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 pr-2">{it.itemName}</td>
                    <td className="py-2 px-2 text-right">{it.pcs}</td>
                    <td className="py-2 pl-2 text-right">{it.totalWeight?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 font-semibold">
                  <td className="py-2 pr-2">Total</td>
                  <td className="py-2 px-2 text-right">{detail.totalPcs}</td>
                  <td className="py-2 pl-2 text-right">{detail.totalWeight?.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>

            {/* Verification (drop-offs only) */}
            {detail.action === "DROP_OFF" && detail.status === "PENDING" && (
              <div className="bg-sky-50 text-sky-700 text-sm rounded-xl p-3 mb-4">
                Awaiting verification at the counter.{" "}
                <Link to="/admin/acknowledge" className="font-medium underline">Verify it →</Link>
              </div>
            )}

            {detail.action === "DROP_OFF" && detail.status === "ACKNOWLEDGED" && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  {detail.hasDiscrepancy ? (
                    <Info size={20} className="text-amber-500" />
                  ) : (
                    <BadgeCheck size={20} className="text-green-500" />
                  )}
                  <p className="font-medium text-gray-800 text-sm">
                    {detail.hasDiscrepancy ? "Corrected at the counter" : "Verified — count matched"}
                  </p>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Verified by <span className="font-medium">{detail.acknowledgedBy}</span> on{" "}
                  {formatDateTime(detail.acknowledgedAt)}
                </p>

                {detail.hasDiscrepancy && (
                  <>
                    <table className="w-full text-sm mb-2">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-200">
                          <th className="py-2 pr-2">Item</th>
                          <th className="py-2 px-2 text-right">Submitted</th>
                          <th className="py-2 px-2 text-right">Verified</th>
                          <th className="py-2 pl-2 text-right">Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonRows(detail).map((r) => (
                          <tr key={r.name} className="border-b border-gray-50 last:border-0">
                            <td className="py-2 pr-2">{r.name}</td>
                            <td className="py-2 px-2 text-right text-gray-500">{r.submitted}</td>
                            <td className="py-2 px-2 text-right font-medium">{r.verified}</td>
                            <td className={`py-2 pl-2 text-right font-medium ${diffClass(r.diff)}`}>
                              {r.diff === 0 ? "—" : diffText(r.diff)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-xs text-gray-400">
                      The verified quantities count toward pending pickups and summaries. What staff submitted is
                      kept here as a record.
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <button
                onClick={() => askDelete(detail)}
                className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg px-3 py-1.5"
              >
                <Trash2 size={15} /> Delete
              </button>
              <button
                onClick={() => setDetail(null)}
                className="border border-gray-300 rounded-lg px-4 py-1.5 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {toDelete && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-40"
          onClick={() => !deleting && setToDelete(null)}
        >
          <div className="bg-white rounded-2xl shadow p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3 text-red-600">
              <Trash2 size={20} />
              <h2 className="font-semibold">Delete this transaction?</h2>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 text-sm mb-3">
              <p>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium mr-2 ${
                    toDelete.action === "DROP_OFF" ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"
                  }`}
                >
                  {toDelete.action === "DROP_OFF" ? "Drop-off" : "Pickup"}
                </span>
                {toDelete.staffName} ({toDelete.staffId})
              </p>
              <p className="text-gray-600 mt-1">{toDelete.department} · {toDelete.totalPcs} pcs</p>
              <p className="text-xs text-gray-400">{formatDateTime(toDelete.createdAt)}</p>
            </div>

            <p className="text-xs text-gray-500 mb-3">
              This permanently removes the record, and pending-pickup and summary numbers will change to match.
              It can't be undone.
            </p>

            {deleteError && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-2 mb-3">{deleteError}</div>}

            <div className="flex gap-2">
              <button
                onClick={() => setToDelete(null)}
                disabled={deleting}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 disabled:bg-gray-300 text-white rounded-lg py-2 text-sm font-medium"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}