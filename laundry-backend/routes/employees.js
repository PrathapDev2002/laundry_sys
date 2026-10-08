const express = require("express");
const router = express.Router();
const Employee = require("../models/Employee");
const auth = require("../middleware/authMiddle");

// GET /api/employees/:staffId  -> PUBLIC — used by the QR form on staff-ID entry
router.get("/:staffId", async (req, res) => {
  const employee = await Employee.findOne({
    staffId: req.params.staffId,
    active: true,
  });
  if (!employee) {
    // Frontend shows: "Employee not found — please approach the counter to register."
    return res.status(404).json({ message: "Employee not found" });
  }
  res.json(employee);
});

// GET /api/employees  -> ADMIN ONLY — list/search, e.g. ?department=Nursing&search=john
router.get("/", auth, async (req, res) => {
  const { department, search } = req.query;
  const filter = { active: true };
  if (department) filter.department = department;
  if (search) filter.name = { $regex: search, $options: "i" };
  const employees = await Employee.find(filter).sort({ name: 1 });
  res.json(employees);
});

// POST /api/employees  -> ADMIN ONLY — create new employee
router.post("/", auth, async (req, res) => {
  try {
    const { staffId, name, department, position } = req.body;
    const employee = await Employee.create({ staffId, name, department, position });
    res.status(201).json(employee);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Staff ID already exists" });
    }
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/employees/:id  -> ADMIN ONLY — edit department/position/name
router.put("/:id", auth, async (req, res) => {
  const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!employee) return res.status(404).json({ message: "Employee not found" });
  res.json(employee);
});

// PATCH /api/employees/:id/deactivate  -> ADMIN ONLY — soft delete, keeps history intact
router.patch("/:id/deactivate", auth, async (req, res) => {
  const employee = await Employee.findByIdAndUpdate(
    req.params.id,
    { active: false },
    { new: true }
  );
  if (!employee) return res.status(404).json({ message: "Employee not found" });
  res.json(employee);
});

module.exports = router;