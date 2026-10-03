import { useEffect, useState } from "react";
import socket from "../api/socket";

const MAX_NOTIFICATIONS = 20;

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleNewTransaction = (payload) => {
      setNotifications((prev) => [{ ...payload, id: `${payload.createdAt}-${payload.staffId}` }, ...prev].slice(0, MAX_NOTIFICATIONS));
      setUnread((n) => n + 1);
    };

    socket.on("newTransaction", handleNewTransaction);
    return () => socket.off("newTransaction", handleNewTransaction);
  }, []);

  const toggleOpen = () => {
    setOpen((o) => !o);
    if (!open) setUnread(0); // mark as read when opening
  };

  const timeAgo = (iso) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(iso).toLocaleDateString();
  };

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        className="relative p-2 rounded-lg hover:bg-gray-100"
        aria-label="Notifications"
      >
        <span className="text-xl">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-xl shadow-lg border border-gray-100 z-20 max-h-96 overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-100 font-medium text-sm text-gray-700">
              Recent Activity
            </div>
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No activity yet.</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="px-4 py-3 border-b border-gray-50 last:border-0 text-sm">
                  <div className="flex justify-between items-start mb-0.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        n.action === "DROP_OFF" ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"
                      }`}
                    >
                      {n.action === "DROP_OFF" ? "Drop-off" : "Pickup"}
                    </span>
                    <span className="text-xs text-gray-400">{timeAgo(n.createdAt)}</span>
                  </div>
                  <p className="text-gray-700">
                    <span className="font-medium">{n.staffId}</span> · {n.department}
                  </p>
                  <p className="text-gray-500 text-xs">{n.totalPcs} pcs · {n.totalWeight?.toFixed(2)} kg</p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}