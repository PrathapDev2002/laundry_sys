import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Shirt, Receipt, Clock, BarChart3, ClipboardCheck } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import AdminLayout from "../components/Adminlayout";
import {
  getSummary,
  getPendingItems,
  getTransactions,
  listEmployees,
  listDepartments,
  getAcknowledgements,
} from "../api/api";

const PIE_COLORS = ["#3b82f6", "#6366f1", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

const lastNDays = (n) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (n - 1 - i));
    return d.toISOString().slice(0, 10);
  });

const monthStartStr = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
};

const dayLabel = (dateStr) =>
  new Date(`${dateStr}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const round2 = (n) => Math.round(n * 100) / 100;

// Sum a numeric field of summary rows, grouped by a key
const groupSum = (rows, keyField, valueField) => {
  const out = {};
  rows.forEach((r) => {
    out[r[keyField]] = (out[r[keyField]] || 0) + (r[valueField] || 0);
  });
  return out;
};

function StatCard({ label, pcs, weight, color }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>
        {pcs} <span className="text-sm font-normal text-gray-400">pcs</span>
      </p>
      <p className="text-sm text-gray-500">{weight.toFixed(2)} kg</p>
    </div>
  );
}

function ChartCard({ title, className = "", children }) {
  return (
    <div className={`bg-white rounded-xl shadow p-4 ${className}`}>
      <p className="text-sm font-medium text-gray-700 mb-3">{title}</p>
      {children}
    </div>
  );
}

const EmptyChart = () => (
  <div className="h-64 flex items-center justify-center text-sm text-gray-400">No data yet.</div>
);

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState("pcs"); // "pcs" | "kg" — applies to all charts

  const [trend, setTrend] = useState([]); // last 7 days, drop-off vs pickup
  const [monthByDept, setMonthByDept] = useState([]); // this month's drop-offs per department
  const [pendingByDept, setPendingByDept] = useState([]); // pending pickup per department
  const [monthTotals, setMonthTotals] = useState({ pcs: 0, weight: 0 });
  const [pendingTotal, setPendingTotal] = useState({ pcs: 0, weight: 0 });
  const [recent, setRecent] = useState([]);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [departmentCount, setDepartmentCount] = useState(0);
  const [pendingAckCount, setPendingAckCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const days = lastNDays(7);
      const today = days[days.length - 1];

      const [dropRes, pickRes, monthRes, pendingRes, recentRes, empRes, deptRes, ackRes] =
        await Promise.allSettled([
          getSummary({ groupBy: "day", action: "DROP_OFF", from: days[0], to: today }),
          getSummary({ groupBy: "day", action: "PICKUP", from: days[0], to: today }),
          getSummary({ groupBy: "month", action: "DROP_OFF", from: monthStartStr(), to: today }),
          getPendingItems(),
          getTransactions({ page: 1, limit: 8 }),
          listEmployees(),
          listDepartments(),
          getAcknowledgements({ limit: 1 }),
        ]);

      const rows = (r) => (r.status === "fulfilled" && Array.isArray(r.value.data) ? r.value.data : []);

      // 7-day trend
      const dropRows = rows(dropRes);
      const pickRows = rows(pickRes);
      const dropPcs = groupSum(dropRows, "period", "totalPcs");
      const dropKg = groupSum(dropRows, "period", "totalWeight");
      const pickPcs = groupSum(pickRows, "period", "totalPcs");
      const pickKg = groupSum(pickRows, "period", "totalWeight");
      setTrend(
        days.map((d) => ({
          date: dayLabel(d),
          dropoffPcs: dropPcs[d] || 0,
          pickupPcs: pickPcs[d] || 0,
          dropoffKg: round2(dropKg[d] || 0),
          pickupKg: round2(pickKg[d] || 0),
        }))
      );

      // This month, per department
      const monthRows = rows(monthRes);
      const mPcs = groupSum(monthRows, "department", "totalPcs");
      const mKg = groupSum(monthRows, "department", "totalWeight");
      setMonthByDept(
        Object.keys(mPcs)
          .map((name) => ({ name, pcs: mPcs[name], kg: round2(mKg[name]) }))
          .sort((a, b) => b.pcs - a.pcs)
      );
      setMonthTotals({
        pcs: monthRows.reduce((s, r) => s + r.totalPcs, 0),
        weight: monthRows.reduce((s, r) => s + r.totalWeight, 0),
      });

      // Pending, per department
      const pendingRows = rows(pendingRes);
      const pPcs = groupSum(pendingRows, "department", "pendingPcs");
      const pKg = groupSum(pendingRows, "department", "pendingWeight");
      setPendingByDept(
        Object.keys(pPcs)
          .map((name) => ({ name, pcs: pPcs[name], kg: round2(pKg[name]) }))
          .sort((a, b) => b.pcs - a.pcs)
          .slice(0, 8)
      );
      setPendingTotal({
        pcs: pendingRows.reduce((s, r) => s + r.pendingPcs, 0),
        weight: pendingRows.reduce((s, r) => s + r.pendingWeight, 0),
      });

      if (recentRes.status === "fulfilled") setRecent(recentRes.value.data?.transactions || []);
      if (empRes.status === "fulfilled") setEmployeeCount((empRes.value.data || []).length);
      if (deptRes.status === "fulfilled") setDepartmentCount((deptRes.value.data || []).length);
      if (ackRes.status === "fulfilled") setPendingAckCount(ackRes.value.data?.total || 0);

      setLoading(false);
    };
    load();
  }, []);

  const unit = metric === "pcs" ? "pcs" : "kg";
  const today = trend[trend.length - 1] || {};
  const hasTrendData = trend.some((d) => d.dropoffPcs || d.pickupPcs);

  const quickLinks = [
    { to: "/admin/employees", label: "Employees", icon: Users, stat: employeeCount },
    { to: "/admin/departments", label: "Departments", icon: Shirt, stat: departmentCount },
    { to: "/admin/transactions", label: "Transactions", icon: Receipt },
    { to: "/admin/pending", label: "Pending Pickups", icon: Clock },
    {
      to: "/admin/acknowledge",
      label: "Acknowledge Drop-offs",
      icon: ClipboardCheck,
      stat: pendingAckCount,
      alert: pendingAckCount > 0,
    },
    { to: "/admin/summary", label: "Summary", icon: BarChart3 },
  ];

  if (loading) {
    return (
      <AdminLayout title="Dashboard">
        <p className="text-gray-400 text-sm">Loading dashboard...</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Drop-off Today" pcs={today.dropoffPcs || 0} weight={today.dropoffKg || 0} color="text-orange-600" />
        <StatCard label="Pickup Today" pcs={today.pickupPcs || 0} weight={today.pickupKg || 0} color="text-green-600" />
        <StatCard label="This Month (Drop-off)" pcs={monthTotals.pcs} weight={monthTotals.weight} color="text-blue-600" />
        <StatCard label="Total Pending" pcs={pendingTotal.pcs} weight={pendingTotal.weight} color="text-amber-600" />
      </div>

      {/* Metric toggle for all charts */}
      <div className="flex justify-end mb-3">
        <div className="inline-flex bg-white rounded-lg shadow text-sm overflow-hidden">
          {["pcs", "kg"].map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-4 py-1.5 ${metric === m ? "bg-blue-600 text-white" : "text-gray-600"}`}
            >
              {m === "pcs" ? "Pieces" : "Weight (kg)"}
            </button>
          ))}
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <ChartCard title="Last 7 Days — Drop-off vs Pickup" className="lg:col-span-2">
          {!hasTrendData ? (
            <EmptyChart />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip formatter={(v, name) => [`${v} ${unit}`, name]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar name="Drop-off" dataKey={metric === "pcs" ? "dropoffPcs" : "dropoffKg"} fill="#f97316" radius={[4, 4, 0, 0]} />
                  <Bar name="Pickup" dataKey={metric === "pcs" ? "pickupPcs" : "pickupKg"} fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="This Month's Drop-offs by Department">
          {monthByDept.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={monthByDept}
                    dataKey={metric}
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {monthByDept.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, name) => [`${v} ${unit}`, name]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <ChartCard title="Pending Pickup by Department">
          {pendingByDept.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">Nothing pending.</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pendingByDept} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef0f4" />
                  <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v} ${unit}`, "Pending"]} />
                  <Bar dataKey={metric} fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Recent Activity" className="lg:col-span-2">
          {recent.length === 0 ? (
            <p className="text-sm text-gray-400">No transactions yet.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {recent.map((t) => (
                <div
                  key={t._id}
                  className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0"
                >
                  <div className="min-w-0">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mr-2 ${
                        t.action === "DROP_OFF" ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"
                      }`}
                    >
                      {t.action === "DROP_OFF" ? "Drop-off" : "Pickup"}
                    </span>
                    <span className="text-gray-600">
                      {t.staffId} · {t.department}
                    </span>
                  </div>
                  <span className="text-gray-500 shrink-0 ml-2">{t.totalPcs} pcs</span>
                </div>
              ))}
            </div>
          )}
          <Link to="/admin/transactions" className="text-xs text-blue-600 mt-3 inline-block">
            View all →
          </Link>
        </ChartCard>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {quickLinks.map(({ to, label, icon: Icon, stat, alert }) => (
          <Link
            key={to}
            to={to}
            className="bg-white rounded-xl shadow p-4 flex items-center gap-3 hover:shadow-md transition-shadow"
          >
            <div className={`p-2 rounded-lg ${alert ? "bg-red-50" : "bg-blue-50"}`}>
              <Icon size={20} className={alert ? "text-red-600" : "text-blue-600"} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{label}</p>
              {stat !== undefined && (
                <p className={`text-xs ${alert ? "text-red-500" : "text-gray-400"}`}>
                  {stat} {alert ? "awaiting" : ""}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </AdminLayout>
  );
}