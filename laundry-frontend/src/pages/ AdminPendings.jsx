import { useEffect, useState } from "react";
import AdminLayout from "../components/Adminlayout";
import { getPendingItems, listDepartments } from "../api/api";

export default function AdminPending() {
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [department, setDepartment] = useState(""); // "" = all departments
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listDepartments()
      .then(({ data }) => setDepartments(Array.isArray(data) ? data : []))
      .catch(() => setDepartments([]));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await getPendingItems(department || undefined);
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
  }, [department]);

  const totals = rows.reduce(
    (acc, r) => ({ pcs: acc.pcs + r.pendingPcs, weight: acc.weight + r.pendingWeight }),
    { pcs: 0, weight: 0 }
  );

  return (
    <AdminLayout title="Pending Pickups">
      <p className="text-sm text-gray-500 mb-4">
        Items dropped off for washing but not yet picked up — dropped minus already collected, per department.
      </p>

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-64"
        >
          <option value="">All departments</option>
          {(departments || []).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200 text-gray-600">
              <th className="px-4 py-3 text-left border-r border-gray-100">Department</th>
              <th className="px-4 py-3 text-left border-r border-gray-100">Item</th>
              <th className="px-4 py-3 text-right border-r border-gray-100">Dropped</th>
              <th className="px-4 py-3 text-right border-r border-gray-100">Picked Up</th>
              <th className="px-4 py-3 text-right border-r border-gray-100">Pending Pcs</th>
              <th className="px-4 py-3 text-right">Pending Weight (kg)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="px-4 py-6 text-center text-gray-400">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="6" className="px-4 py-6 text-center text-gray-400">Nothing pending — all caught up.</td></tr>
            ) : (
              <>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-amber-50">
                    <td className="px-4 py-2.5 border-r border-gray-100 font-medium">{r.department}</td>
                    <td className="px-4 py-2.5 border-r border-gray-100">{r.itemName}</td>
                    <td className="px-4 py-2.5 border-r border-gray-100 text-right text-gray-500">{r.droppedPcs}</td>
                    <td className="px-4 py-2.5 border-r border-gray-100 text-right text-gray-500">{r.pickedPcs}</td>
                    <td className="px-4 py-2.5 border-r border-gray-100 text-right font-semibold text-amber-700">{r.pendingPcs}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-amber-700">{r.pendingWeight}</td>
                  </tr>
                ))}
                <tr className="bg-amber-50 font-semibold border-t-2 border-amber-200">
                  <td className="px-4 py-3 border-r border-amber-100" colSpan="4">Total Pending</td>
                  <td className="px-4 py-3 border-r border-amber-100 text-right">{totals.pcs}</td>
                  <td className="px-4 py-3 text-right">{totals.weight.toFixed(2)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}