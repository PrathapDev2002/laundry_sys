import { useEffect, useState } from "react";
import AdminLayout from "../components/Adminlayout";
import { getTransactions, listDepartments } from "../api/api";

const PAGE_SIZE = 20;

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);

  const [department, setDepartment] = useState("");
  const [action, setAction] = useState("");
  const [staffId, setStaffId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    listDepartments()
      .then(({ data }) => setDepartments(Array.isArray(data) ? data : []))
      .catch(() => setDepartments([]));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await getTransactions({
        department: department || undefined,
        action: action || undefined,
        staffId: staffId || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setTransactions(Array.isArray(data?.transactions) ? data.transactions : []);
      setTotal(data?.total || 0);
    } catch {
      setTransactions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const applyFilters = () => {
    setPage(1);
    load();
  };

  const clearFilters = () => {
    setDepartment("");
    setAction("");
    setStaffId("");
    setFrom("");
    setTo("");
    setPage(1);
    setTimeout(load, 0); // let state clear before reloading
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const formatDateTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AdminLayout title="Transactions">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All departments</option>
            {(departments || []).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All actions</option>
            <option value="DROP_OFF">Drop-off</option>
            <option value="PICKUP">Pickup</option>
          </select>
          <input
            type="text"
            placeholder="Staff ID"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
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

      {/* Table */}
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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="px-4 py-6 text-center text-gray-400">Loading...</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan="7" className="px-4 py-6 text-center text-gray-400">No transactions found.</td></tr>
            ) : (
              transactions.map((t) => (
                <tr key={t._id} className="border-b border-gray-100 last:border-0 align-top">
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
                  <td className="px-4 py-3">{t.totalPcs}</td>
                  <td className="px-4 py-3">{t.totalWeight?.toFixed(2)}</td>
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
    </AdminLayout>
  );
}