import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/api";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await login(username.trim(), password);
      localStorage.setItem("adminToken", data.token);
      localStorage.setItem("adminUsername", data.username);
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-blue-900 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-lg p-7 sm:p-8 w-full max-w-sm"
      >
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🧺</div>
          <h1 className="text-xl font-semibold text-gray-800">Admin Login</h1>
          <p className="text-sm text-gray-500 mt-1">Laundry Drop-off / Pickup System</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-xl p-3 mb-4">{error}</div>
        )}

        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-4 text-base"
          autoFocus
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-5 text-base"
        />

        <button
          type="submit"
          disabled={loading || !username.trim() || !password}
          className="w-full bg-blue-600 disabled:bg-gray-300 text-white rounded-xl py-3 font-medium active:bg-blue-700"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}