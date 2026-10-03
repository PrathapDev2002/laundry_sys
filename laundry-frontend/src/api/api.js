import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// --- Employee ---
export const getEmployee = (staffId) => api.get(`/employees/${staffId}`);

// --- Departments / dependent dropdown ---
export const getDepartmentItems = (departmentName) =>
  api.get(`/departments/${encodeURIComponent(departmentName)}/items`);

// --- Transactions ---
export const submitTransaction = (payload) => api.post("/transactions", payload);
export const getTransactions = (params) => api.get("/transactions", { params });
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