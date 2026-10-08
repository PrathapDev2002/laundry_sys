import { useEffect, useState } from "react";
import AdminLayout from "../components/Adminlayout";
import { listAdmins, createAdmin, changeAdminPassword, deleteAdmin } from "../api/api";

export default function AdminUsers() {
  const currentUsername = localStorage.getItem("adminUsername");

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  // Change password modal
  const [pwTarget, setPwTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await listAdmins();
      setAdmins(Array.isArray(data) ? data : []);
    } catch {
      setAdmins([]);
      setError("Failed to load admin users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const flash = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleCreate = async () => {
    setError("");
    if (!username.trim() || password.length < 6) {
      setError("Enter a username and a password of at least 6 characters.");
      return;
    }
    setCreating(true);
    try {
      await createAdmin(username.trim(), password);
      setUsername("");
      setPassword("");
      flash(`Admin "${username.trim()}" created.`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create admin.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (admin) => {
    if (!confirm(`Delete admin "${admin.username}"? They will no longer be able to log in.`)) return;
    setError("");
    try {
      await deleteAdmin(admin._id);
      flash(`Admin "${admin.username}" deleted.`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete admin.");
    }
  };

  const openPassword = (admin) => {
    setPwTarget(admin);
    setNewPassword("");
    setPwError("");
  };

  const handleSavePassword = async () => {
    if (newPassword.length < 6) {
      setPwError("Password must be at least 6 characters.");
      return;
    }
    setPwSaving(true);
    setPwError("");
    try {
      await changeAdminPassword(pwTarget._id, newPassword);
      flash(`Password updated for "${pwTarget.username}".`);
      setPwTarget(null);
    } catch (err) {
      setPwError(err.response?.data?.message || "Failed to update password.");
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <AdminLayout title="Admin Users">
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 text-sm rounded-lg p-3 mb-4">{success}</div>}

      {/* Create new admin */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <p className="text-sm font-medium text-gray-700 mb-3">Create new admin login</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="bg-blue-600 disabled:bg-gray-300 text-white rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap"
          >
            {creating ? "Creating..." : "+ Create Admin"}
          </button>
        </div>
      </div>

      {/* Admin list */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-200 text-gray-500">
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="3" className="px-4 py-6 text-center text-gray-400">Loading...</td></tr>
            ) : admins.length === 0 ? (
              <tr><td colSpan="3" className="px-4 py-6 text-center text-gray-400">No admins found.</td></tr>
            ) : (
              admins.map((a) => (
                <tr key={a._id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    {a.username}
                    {a.username === currentUsername && (
                      <span className="ml-2 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">You</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openPassword(a)} className="text-blue-600 mr-3">Change Password</button>
                    {a.username !== currentUsername && (
                      <button onClick={() => handleDelete(a)} className="text-red-500">Delete</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Change password modal */}
      {pwTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-10">
          <div className="bg-white rounded-2xl shadow p-5 w-full max-w-sm">
            <h2 className="font-semibold mb-1">Change Password</h2>
            <p className="text-xs text-gray-500 mb-3">For: {pwTarget.username}</p>
            {pwError && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-2 mb-3">{pwError}</div>}
            <input
              type="password"
              autoFocus
              placeholder="New password (min 6 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setPwTarget(null)}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePassword}
                disabled={pwSaving}
                className="flex-1 bg-blue-600 disabled:bg-gray-300 text-white rounded-lg py-2 text-sm font-medium"
              >
                {pwSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}