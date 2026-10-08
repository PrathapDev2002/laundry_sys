import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Attach the saved admin token to every request, if present.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("adminToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the server says the session is invalid/expired, clear it and bounce to login.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname.startsWith("/admin")) {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminUsername");
      if (window.location.pathname !== "/admin/login") {
        window.location.href = "/admin/login";
      }
    }
    return Promise.reject(err);
  }
);

// --- Auth ---
export const login = (username, password) => api.post("/auth/login", { username, password });
export const listAdmins = () => api.get("/auth/admins");
export const createAdmin = (username, password) => api.post("/auth/admins", { username, password });
export const changeAdminPassword = (id, password) => api.patch(`/auth/admins/${id}/password`, { password });
export const deleteAdmin = (id) => api.delete(`/auth/admins/${id}`);

// --- Employee ---
export const getEmployee = (staffId) => api.get(`/employees/${staffId}`);

// --- Departments / dependent dropdown ---
export const getDepartmentItems = (departmentName) =>
  api.get(`/departments/${encodeURIComponent(departmentName)}/items`);

// --- Transactions ---
export const submitTransaction = (payload) => api.post("/transactions", payload);
export const getTransactions = (params) => api.get("/transactions", { params });
export const getAcknowledgements = (params) =>
  api.get("/transactions", { params: { action: "DROP_OFF", status: "PENDING", ...params } });
export const acknowledgeDropoff = (id, items) =>
  api.patch(`/transactions/${id}/acknowledge`, { items });
export const listNotifications = () => api.get("/notifications");
export const dismissNotification = (id) => api.delete(`/notifications/${id}`);
export const clearNotifications = () => api.delete("/notifications");
export const getMyNotices = (staffId) => api.get("/transactions/my-notices", { params: { staffId } });
export const getPendingItems = (department) =>
  api.get("/transactions/pending", { params: department ? { department } : {} });

// --- Summary ---
export const getSummary = (params) => api.get("/summary", { params });

// --- Employees admin ---
export const listEmployees = (params) => api.get("/employees", { params });
export const createEmployee = (payload) => api.post("/employees", payload);
export const updateEmployee = (id, payload) => api.put(`/employees/${id}`, payload);
export const deactivateEmployee = (id) => api.patch(`/employees/${id}/deactivate`);

// --- Departments admin ---
export const listDepartments = () => api.get("/departments");
export const createDepartment = (name) => api.post("/departments", { name });
export const renameDepartment = (oldName, newName) =>
  api.put(`/departments/${encodeURIComponent(oldName)}`, { name: newName });
export const deleteDepartment = (name) => api.delete(`/departments/${encodeURIComponent(name)}`);
export const addDepartmentItem = (departmentName, payload) =>
  api.post(`/departments/${encodeURIComponent(departmentName)}/items`, payload);
export const updateDepartmentItem = (departmentName, itemId, payload) =>
  api.put(`/departments/${encodeURIComponent(departmentName)}/items/${itemId}`, payload);
export const removeDepartmentItem = (departmentName, itemId) =>
  api.delete(`/departments/${encodeURIComponent(departmentName)}/items/${itemId}`);

export default api;