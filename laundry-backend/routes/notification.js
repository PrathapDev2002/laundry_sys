const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const auth = require("../middleware/authMiddle");

// Tell every connected admin dashboard to refresh its bell (keeps multiple admins in sync)
const broadcastChange = (req) => {
  const io = req.app.get("io");
  if (io) io.emit("notificationsChanged");
};

// GET /api/notifications -> newest first, everything not yet cleared
router.get("/", auth, async (req, res) => {
  const notifications = await Notification.find().sort({ createdAt: -1 }).limit(100);
  res.json(notifications);
});

// DELETE /api/notifications -> clear all
router.delete("/", auth, async (req, res) => {
  await Notification.deleteMany({});
  broadcastChange(req);
  res.json({ message: "All notifications cleared" });
});

// DELETE /api/notifications/:id -> dismiss one
router.delete("/:id", auth, async (req, res) => {
  await Notification.findByIdAndDelete(req.params.id);
  broadcastChange(req);
  res.json({ message: "Notification dismissed" });
});

module.exports = router;