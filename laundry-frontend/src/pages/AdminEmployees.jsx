import { useEffect, useState } from "react";
import AdminLayout from "../components/Adminlayout";
import {
  listEmployees,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  listDepartments,
} from "../api/api";

const emptyForm = { staffId: "", name: "", department: "", position: "" };

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Add/edit modal state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = adding new
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const { data } = await listEmployees({
        search: search || undefined,
        department: deptFilter || undefined,
      });
      setEmployees(data);
    } catch {
      setError("Failed to load employees.");
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data } = await listDepartments();
      setDepartments(data);
    } catch {
      // department list is non-critical for this page; fail silently
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    const t = setTimeout(loadEmployees, 300); // debounce search typing
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, deptFilter]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (emp) => {
    setEditingId(emp._id);
    setForm({
      staffId: emp.staffId,
      name: emp.name,
      department: emp.department,
      position: emp.position,
    });
    setFormError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.staffId || !form.name || !form.department || !form.position) {
      setFormError("All fields are required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      if (editingId) {
        await updateEmployee(editingId, form);
      } else {
        await createEmployee(form);
      }
      setShowForm(false);
      loadEmployees();
    } catch (err) {
      setFormError(err.response?.data?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (emp) => {
    if (!confirm(`Deactivate ${emp.name} (${emp.staffId})? They won't be able to submit new entries.`)) return;
    await deactivateEmployee(emp._id);
    loadEmployees();
  };

  return (
    <AdminLayout title="Employees">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1"
        />
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All departments</option>
          {(departments || []).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <button
          onClick={openAdd}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap"
        >
          + Add Employee
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4">{error}</div>}

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-200 text-gray-500">
              <th className="px-4 py-3">Staff ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Position</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="px-4 py-6 text-center text-gray-400">Loading...</td></tr>
            ) : employees.length === 0 ? (
              <tr><td colSpan="5" className="px-4 py-6 text-center text-gray-400">No employees found.</td></tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp._id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">{emp.staffId}</td>
                  <td className="px-4 py-3">{emp.name}</td>
                  <td className="px-4 py-3">{emp.department}</td>
                  <td className="px-4 py-3">{emp.position}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(emp)} className="text-blue-600 mr-3">Edit</button>
                    <button onClick={() => handleDeactivate(emp)} className="text-red-500">Deactivate</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-10">
          <div className="bg-white rounded-2xl shadow p-5 w-full max-w-sm">
            <h2 className="font-semibold mb-3">{editingId ? "Edit Employee" : "Add Employee"}</h2>
            {formError && (
              <div className="bg-red-50 text-red-700 text-sm rounded-lg p-2 mb-3">{formError}</div>
            )}
            <div className="space-y-2 mb-4">
              <input
                type="text"
                placeholder="Staff ID"
                value={form.staffId}
                disabled={!!editingId} // staffId shouldn't change once created
                onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100"
              />
              <input
                type="text"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select department</option>
                {(departments || []).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Position"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium disabled:bg-gray-300"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}