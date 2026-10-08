const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const auth = require("../middleware/authMiddle");

// POST /api/auth/login
// body: { username, password }
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  const admin = await Admin.findOne({ username: username.trim() });
  if (!admin) return res.status(401).json({ message: "Invalid username or password" });

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) return res.status(401).json({ message: "Invalid username or password" });

  const token = jwt.sign(
    { id: admin._id, username: admin.username },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token, username: admin.username });
});

// ---------- Admin user management (all require login) ----------

// GET /api/auth/admins -> list all admin accounts (never returns password hashes)
router.get("/admins", auth, async (req, res) => {
  const admins = await Admin.find({}, "username createdAt").sort({ createdAt: 1 });
  res.json(admins);
});

// POST /api/auth/admins -> create a new admin account
// body: { username, password }
router.post("/admins", auth, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !username.trim() || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ username: username.trim(), passwordHash });
    res.status(201).json({ _id: admin._id, username: admin.username, createdAt: admin.createdAt });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Username already exists" });
    }
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/auth/admins/:id/password -> set a new password for an admin
// body: { password }
router.patch("/admins/:id/password", auth, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await Admin.findByIdAndUpdate(req.params.id, { passwordHash });
  if (!admin) return res.status(404).json({ message: "Admin not found" });
  res.json({ message: "Password updated" });
});

// DELETE /api/auth/admins/:id -> remove an admin account
// You can't delete your own account, and the last remaining admin can never be removed.
router.delete("/admins/:id", auth, async (req, res) => {
  if (String(req.admin.id) === req.params.id) {
    return res.status(400).json({ message: "You can't delete your own account" });
  }
  const count = await Admin.countDocuments();
  if (count <= 1) {
    return res.status(400).json({ message: "Can't delete the last remaining admin" });
  }
  const admin = await Admin.findByIdAndDelete(req.params.id);
  if (!admin) return res.status(404).json({ message: "Admin not found" });
  res.json({ message: "Admin deleted" });
});

module.exports = router;