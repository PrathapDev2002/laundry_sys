import { useEffect, useState } from "react";
import AdminLayout from "../components/Adminlayout";
import { getSummary, listDepartments } from "../api/api";

export default function AdminSummary() {
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);

  const [groupBy, setGroupBy] = useState("day"); // "day" | "month"
  const [action, setAction] = useState("DROP_OFF"); // "DROP_OFF" | "PICKUP"
  const [department, setDepartment] = useState("");
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
      const { data } = await getSummary({
        groupBy,
        action,
        department: department || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy, action]);

  const applyFilters = () => load();

  const clearFilters = () => {
    setDepartment("");
    setFrom("");
    setTo("");
    setTimeout(load, 0);
  };

  // Grand totals across all visible rows, shown as the last row (like an Excel total row)
  const grandTotals = rows.reduce(
    (acc, r) => ({
      pcs: acc.pcs + (r.totalPcs || 0),
      weight: acc.weight + (r.totalWeight || 0),
      count: acc.count + (r.transactionCount || 0),
    }),
    { pcs: 0, weight: 0, count: 0 }
  );

  const exportCsv = () => {
    const header = ["Period", "Department", "Transactions", "Total Pcs", "Total Weight (kg)"];
    const lines = rows.map((r) =>
      [r.period, r.department, r.transactionCount, r.totalPcs, r.totalWeight.toFixed(2)].join(",")
    );
    lines.push(["", "Grand Total", grandTotals.count, grandTotals.pcs, grandTotals.weight.toFixed(2)].join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `summary_${groupBy}_${action.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout title="Summary">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="day">Daily</option>
            <option value="month">Monthly</option>
          </select>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="DROP_OFF">Drop-off</option>
            <option value="PICKUP">Pickup</option>
          </select>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm col-span-2 md:col-span-1"
          >
            <option value="">All departments</option>
            {(departments || []).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
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

      {/* Export */}
      <div className="flex justify-end mb-2">
        <button
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="text-sm text-blue-600 font-medium disabled:text-gray-300"
        >
          Export Excel
        </button>
      </div>

      {/* Excel-style table */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200 text-gray-600">
              <th className="px-4 py-3 text-left border-r border-gray-100">{groupBy === "day" ? "Date" : "Month"}</th>
              <th className="px-4 py-3 text-left border-r border-gray-100">Department</th>
              <th className="px-4 py-3 text-right border-r border-gray-100">Transactions</th>
              <th className="px-4 py-3 text-right border-r border-gray-100">Total Pcs</th>
              <th className="px-4 py-3 text-right">Total Weight (kg)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="px-4 py-6 text-center text-gray-400">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="5" className="px-4 py-6 text-center text-gray-400">No data for this range.</td></tr>
            ) : (
              <>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 border-r border-gray-100 whitespace-nowrap">{r.period}</td>
                    <td className="px-4 py-2.5 border-r border-gray-100">{r.department}</td>
                    <td className="px-4 py-2.5 border-r border-gray-100 text-right">{r.transactionCount}</td>
                    <td className="px-4 py-2.5 border-r border-gray-100 text-right">{r.totalPcs}</td>
                    <td className="px-4 py-2.5 text-right">{r.totalWeight.toFixed(2)}</td>
                  </tr>
                ))}
                {/* Grand total row */}
                <tr className="bg-blue-50 font-semibold border-t-2 border-blue-200">
                  <td className="px-4 py-3 border-r border-blue-100" colSpan="2">Grand Total</td>
                  <td className="px-4 py-3 border-r border-blue-100 text-right">{grandTotals.count}</td>
                  <td className="px-4 py-3 border-r border-blue-100 text-right">{grandTotals.pcs}</td>
                  <td className="px-4 py-3 text-right">{grandTotals.weight.toFixed(2)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}