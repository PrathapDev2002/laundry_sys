import { BrowserRouter, Routes, Route } from "react-router-dom";
import StaffForm from "./pages/StaffForm";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminEmployees from "./pages/AdminEmployees";
import AdminDepartments from "./pages/AdminDepartments";
import AdminTransactions from "./pages/AdminTransactions";
import AdminAcknowledge from "./pages/AdminAcknowledges";
import AdminPending from "./pages/ AdminPendings";
import AdminSummary from "./pages/AdminSummary";
import ProtectedRoute from "./components/ProtectedRoutes";
import AdminUsers from "./pages/AdminUser";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StaffForm />} />
        <Route path="/admin/login" element={<AdminLogin />} />

        <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/entry" element={<ProtectedRoute><StaffForm /></ProtectedRoute>} />
        <Route path="/admin/employees" element={<ProtectedRoute><AdminEmployees /></ProtectedRoute>} />
        <Route path="/admin/departments" element={<ProtectedRoute><AdminDepartments /></ProtectedRoute>} />
        <Route path="/admin/transactions" element={<ProtectedRoute><AdminTransactions /></ProtectedRoute>} />
        <Route path="/admin/acknowledge" element={<ProtectedRoute><AdminAcknowledge /></ProtectedRoute>} />
        <Route path="/admin/pending" element={<ProtectedRoute><AdminPending /></ProtectedRoute>} />
        <Route path="/admin/summary" element={<ProtectedRoute><AdminSummary /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;