const express = require("express");
const router = express.Router();
const Department = require("../models/Department");
const Employee = require("../models/Employee");

// GET /api/departments  -> list all department names.
// Source of truth is the Employee table (real departments already in use), merged
// with any Department docs that already have items configured — so a department
// with items but (hypothetically) no active employees still shows up too.
router.get("/", async (req, res) => {
  const [deptDocs, employeeDepts] = await Promise.all([
    Department.find({}, "name"),
    Employee.distinct("department", { active: true }),
  ]);
  const names = new Set([...deptDocs.map(d => d.name), ...employeeDepts]);
  res.json([...names].sort());
});

// GET /api/departments/:name/items  -> THE dependent dropdown endpoint.
// Frontend calls this after employee lookup resolves the department.
router.get("/:name/items", async (req, res) => {
  const dept = await Department.findOne({ name: req.params.name });
  if (!dept) return res.status(404).json({ message: "Department not found" });
  res.json(dept.items.filter(i => i.active));
});

// POST /api/departments  -> admin creates a new department (e.g. "Housekeeping")
router.post("/", async (req, res) => {
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

// POST /api/departments/:name/items  -> admin adds an item to a department
// body: { itemName: "Bedsheet", weightPerPc: 0.4 }
// Creates the Department doc automatically if this is its first item (department
// names can now come purely from the Employee table, with no Department doc yet).
router.post("/:name/items", async (req, res) => {
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

// PUT /api/departments/:name/items/:itemId  -> admin edits an item (e.g. fix weight)
router.put("/:name/items/:itemId", async (req, res) => {
  const dept = await Department.findOne({ name: req.params.name });
  if (!dept) return res.status(404).json({ message: "Department not found" });

  const item = dept.items.id(req.params.itemId);
  if (!item) return res.status(404).json({ message: "Item not found" });

  Object.assign(item, req.body); // e.g. { itemName, weightPerPc }
  await dept.save();
  res.json(dept);
});

// DELETE /api/departments/:name/items/:itemId -> soft-remove item from dropdown
router.delete("/:name/items/:itemId", async (req, res) => {
  const dept = await Department.findOne({ name: req.params.name });
  if (!dept) return res.status(404).json({ message: "Department not found" });

  const item = dept.items.id(req.params.itemId);
  if (!item) return res.status(404).json({ message: "Item not found" });

  item.active = false; // keeps old transactions referencing this item name intact
  await dept.save();
  res.json(dept);
});

// PUT /api/departments/:name  -> admin renames a department
// body: { name: "New Name" }
router.put("/:name", async (req, res) => {
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

// DELETE /api/departments/:name  -> admin deletes an entire department (and its items)
// Note: this does NOT touch existing Employees or Transactions referencing this
// department name (they're independent records/snapshots), but the item dropdown
// for that department disappears, and any employee still assigned to it won't be
// able to submit until reassigned to a valid department.
router.delete("/:name", async (req, res) => {
  const dept = await Department.findOneAndDelete({ name: req.params.name });
  if (!dept) return res.status(404).json({ message: "Department not found" });
  res.json({ message: "Department deleted", name: dept.name });
});

module.exports = router;