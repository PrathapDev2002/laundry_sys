import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, X } from "lucide-react";
import socket from "../api/socket";
import { listNotifications, dismissNotification, clearNotifications } from "../api/api";

const timeAgo = (iso) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  // Notifications live in the database, so they survive page changes, refreshes,
  // and anything that arrived while no admin page was open.
  const load = useCallback(async () => {
    try {
      const { data } = await listNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      /* keep whatever we already have */
    }
  }, []);

  useEffect(() => {
    load();

    const onNew = (n) =>
      setNotifications((prev) => (prev.some((p) => p._id === n._id) ? prev : [n, ...prev]));

    socket.on("newTransaction", onNew);
    socket.on("notificationsChanged", load); // another admin cleared/dismissed something
    socket.on("connect", load); // catch up on anything missed while disconnected

    return () => {
      socket.off("newTransaction", onNew);
      socket.off("notificationsChanged", load);
      socket.off("connect", load);
    };
  }, [load]);

  const dismiss = async (id) => {
    setNotifications((prev) => prev.filter((n) => n._id !== id));
    try {
      await dismissNotification(id);
    } catch {
      load();
    }
  };

  const clearAll = async () => {
    setNotifications([]);
    try {
      await clearNotifications();
    } catch {
      load();
    }
  };

  const count = notifications.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-gray-100"
        aria-label="Notifications"
      >
        <Bell size={21} className="text-gray-600" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full min-w-5 h-5 px-1 flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-xl shadow-lg border border-gray-100 z-20 max-h-96 overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <span className="font-medium text-sm text-gray-700">Notifications</span>
              {count > 0 && (
                <button onClick={clearAll} className="text-xs text-blue-600">
                  Clear all
                </button>
              )}
            </div>

            {count === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No notifications.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  className="flex items-start gap-2 px-4 py-3 border-b border-gray-50 last:border-0 text-sm"
                >
                  <Link
                    to={n.action === "DROP_OFF" ? "/admin/acknowledge" : "/admin/transactions"}
                    onClick={() => setOpen(false)}
                    className="flex-1 min-w-0"
                  >
                    <div className="flex justify-between items-center mb-0.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          n.action === "DROP_OFF"
                            ? "bg-orange-50 text-orange-600"
                            : "bg-green-50 text-green-600"
                        }`}
                      >
                        {n.action === "DROP_OFF" ? "Drop-off" : "Pickup"}
                      </span>
                      <span className="text-xs text-gray-400">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="text-gray-700 truncate">
                      <span className="font-medium">{n.staffId}</span> · {n.department}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {n.totalPcs} pcs · {n.totalWeight?.toFixed(2)} kg
                      {n.action === "DROP_OFF" && " · awaiting verification"}
                    </p>
                  </Link>
                  <button
                    onClick={() => dismiss(n._id)}
                    className="text-gray-300 hover:text-gray-500 p-1 shrink-0"
                    aria-label="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}