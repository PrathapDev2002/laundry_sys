import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Users,
  Shirt,
  Receipt,
  Clock,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  ClipboardPlus,
} from "lucide-react";
import NotificationBell from "./NotificationBell";

const navItems = [
  { path: "/admin/entry", label: "New Entry (Backup)", icon: ClipboardPlus },
  { path: "/admin/employee", label: "Employees", icon: Users },
  { path: "/admin/department", label: "Departments & Items", icon: Shirt },
  { path: "/admin/transactions", label: "Transactions", icon: Receipt },
  { path: "/admin/pending", label: "Pending Pickups", icon: Clock },
  { path: "/admin/summary", label: "Summary", icon: BarChart3 },
];

export default function AdminLayout({ title, children }) {
  const location = useLocation();

  // Remember collapse preference across visits
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("adminSidebarCollapsed") === "true"
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("adminSidebarCollapsed", collapsed);
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-blue-50 flex">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-30 flex items-center justify-between px-4 py-3">
        <button onClick={() => setMobileOpen(true)} className="p-1">
          <Menu size={22} />
        </button>
        <span className="font-semibold text-gray-800">Laundry Admin</span>
        <NotificationBell />
      </div>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar (drawer on mobile, fixed collapsible column on desktop) */}
      <nav
        className={`
          bg-linear-to-b from-slate-900 to-slate-800 text-slate-200 flex flex-col
          fixed md:sticky top-0 h-screen z-50 transition-all duration-200
          ${mobileOpen ? "left-0" : "-left-64 md:left-0"}
          ${collapsed ? "md:w-20" : "md:w-64"}
          w-64
        `}
      >
        {/* Brand + collapse toggle */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700/50">
          {!collapsed && <span className="font-semibold text-white">🧺 Laundry Admin</span>}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden md:flex p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-300"
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav items */}
        <div className="flex-1 py-3 space-y-1 px-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-blue-600 text-white font-medium"
                    : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <Icon size={19} className="shrink-0" />
                {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 min-w-0 p-4 pt-20 md:pt-6 md:p-6">
        <div className="hidden md:flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
          <NotificationBell />
        </div>
        <h1 className="md:hidden text-lg font-semibold text-gray-800 mb-4">{title}</h1>
        {children}
      </main>
    </div>
  );
}