import { BrowserRouter, Routes, Route } from "react-router-dom";
import StaffForm from "./pages/StafffForm";
import AdminEmployees from "./pages/AdminEmployee";
import AdminDepartments from "./pages/AdminDepartment";
import AdminTransactions from "./pages/AdminTransactions";
import AdminSummary from "./pages/Adminsummary";
import AdminPending from "./pages/ AdminPendings";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StaffForm />} />
         <Route path="/admin/entry" element={<StaffForm />} />
        <Route path="/admin/employee" element={<AdminEmployees />} />
        <Route path="/admin/department" element={<AdminDepartments />}/>
         <Route path="/admin/transactions" element={<AdminTransactions />} />
         <Route path="/admin/summary" element={<AdminSummary />} />
         <Route path="/admin/pending" element={<AdminPending />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;