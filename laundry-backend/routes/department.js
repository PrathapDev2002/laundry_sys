const express = require("express");
const router = express.Router();
const Department = require("../models/Department");
const Employee = require("../models/Employee");
const auth = require("../middleware/authMiddle");

// GET /api/departments  -> ADMIN ONLY — list all department names.
router.get("/", auth, async (req, res) => {
  const [deptDocs, employeeDepts] = await Promise.all([
    Department.find({}, "name"),
    Employee.distinct("department", { active: true }),
  ]);
  const names = new Set([...deptDocs.map(d => d.name), ...employeeDepts]);
  res.json([...names].sort());
});

// GET /api/departments/:name/items  -> PUBLIC — the dependent dropdown endpoint,
// used directly by the staff QR form. Must stay open, no login.
router.get("/:name/items", async (req, res) => {
  const dept = await Department.findOne({ name: req.params.name });
  if (!dept) return res.status(404).json({ message: "Department not found" });
  res.json(dept.items.filter(i => i.active));
});

// POST /api/departments  -> ADMIN ONLY — create a new department
router.post("/", auth, async (req, res) => {
  try {
    const dept = await Department.create({ name: req.body.name, items: [] });
    res.status(201).json(dept);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Department already exists" });
    }
    res.status(400).json({ message: err.message });
  }
});

// POST /api/departments/:name/items  -> ADMIN ONLY — add an item to a department
router.post("/:name/items", auth, async (req, res) => {
  const { itemName, weightPerPc } = req.body;
  const dept = await Department.findOneAndUpdate(
    { name: req.params.name },
    {
      $setOnInsert: { name: req.params.name },
      $push: { items: { itemName, weightPerPc } },
    },
    { upsert: true, new: true }
  );
  res.status(201).json(dept);
});

// PUT /api/departments/:name/items/:itemId  -> ADMIN ONLY — edit an item
router.put("/:name/items/:itemId", auth, async (req, res) => {
  const dept = await Department.findOne({ name: req.params.name });
  if (!dept) return res.status(404).json({ message: "Department not found" });

  const item = dept.items.id(req.params.itemId);
  if (!item) return res.status(404).json({ message: "Item not found" });

  Object.assign(item, req.body);
  await dept.save();
  res.json(dept);
});

// DELETE /api/departments/:name/items/:itemId  -> ADMIN ONLY — soft-remove item
router.delete("/:name/items/:itemId", auth, async (req, res) => {
  const dept = await Department.findOne({ name: req.params.name });
  if (!dept) return res.status(404).json({ message: "Department not found" });

  const item = dept.items.id(req.params.itemId);
  if (!item) return res.status(404).json({ message: "Item not found" });

  item.active = false;
  await dept.save();
  res.json(dept);
});

// PUT /api/departments/:name  -> ADMIN ONLY — rename a department
router.put("/:name", auth, async (req, res) => {
  const { name: newName } = req.body;
  if (!newName || !newName.trim()) {
    return res.status(400).json({ message: "New name is required" });
  }
  try {
    const dept = await Department.findOneAndUpdate(
      { name: req.params.name },
      { name: newName.trim() },
      { new: true, runValidators: true }
    );
    if (!dept) return res.status(404).json({ message: "Department not found" });
    res.json(dept);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "A department with that name already exists" });
    }
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/departments/:name  -> ADMIN ONLY — delete an entire department
router.delete("/:name", auth, async (req, res) => {
  const dept = await Department.findOneAndDelete({ name: req.params.name });
  if (!dept) return res.status(404).json({ message: "Department not found" });
  res.json({ message: "Department deleted", name: dept.name });
});

module.exports = router;