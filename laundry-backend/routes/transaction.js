const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const Employee = require("../models/Employee");

// Shared helper: { itemName: pendingPcs } for a department — dropped off minus picked up.
// Used both by the /pending reference endpoint and to validate pickups on submit.
async function getPendingMap(department) {
  const dropoffAgg = await Transaction.aggregate([
    { $match: { department, action: "DROP_OFF" } },
    { $unwind: "$items" },
    { $group: { _id: "$items.itemName", pcs: { $sum: "$items.pcs" } } },
  ]);
  const pickupAgg = await Transaction.aggregate([
    { $match: { department, action: "PICKUP" } },
    { $unwind: "$items" },
    { $group: { _id: "$items.itemName", pcs: { $sum: "$items.pcs" } } },
  ]);

  const pickedMap = {};
  pickupAgg.forEach((p) => { pickedMap[p._id] = p.pcs; });

  const pendingMap = {};
  dropoffAgg.forEach((d) => {
    pendingMap[d._id] = d.pcs - (pickedMap[d._id] || 0);
  });
  return pendingMap;
}

// POST /api/transactions  -> the QR form submits here
// body: { staffId, action: "PICKUP"|"DROP_OFF", items: [{ itemName, pcs }] }
// Weight is NOT trusted from the client — always recomputed server-side against
// the department's item list, so the frontend can't send a tampered weight.
router.post("/", async (req, res) => {
  try {
    const { staffId, action, items } = req.body;

    const employee = await Employee.findOne({ staffId, active: true });
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    const Department = require("../models/Department");
    const dept = await Department.findOne({ name: employee.department });
    if (!dept) return res.status(400).json({ message: "Department has no item list configured" });

    let totalPcs = 0;
    let totalWeight = 0;
    const resolvedItems = items.map(({ itemName, pcs }) => {
      const deptItem = dept.items.find(i => i.itemName === itemName && i.active);
      if (!deptItem) throw new Error(`Item "${itemName}" not valid for department ${employee.department}`);
      const lineWeight = pcs * deptItem.weightPerPc;
      totalPcs += pcs;
      totalWeight += lineWeight;
      return { itemName, pcs, weightPerPc: deptItem.weightPerPc, totalWeight: lineWeight };
    });

    // For pickups, don't allow taking more of an item than is actually still
    // pending (dropped off minus already picked up) for this department.
    if (action === "PICKUP") {
      const pendingMap = await getPendingMap(employee.department);
      for (const { itemName, pcs } of resolvedItems) {
        const available = pendingMap[itemName] || 0;
        if (pcs > available) {
          return res.status(400).json({
            message: `Only ${available} pcs of "${itemName}" is available for pickup, cannot pick up ${pcs}.`,
          });
        }
      }
    }

    const transaction = await Transaction.create({
      staffId: employee.staffId,
      staffName: employee.name,
      department: employee.department,
      position: employee.position,
      action,
      items: resolvedItems,
      totalPcs,
      totalWeight,
    });

    // Notify any connected admin dashboards in real time
    const io = req.app.get("io");
    if (io) {
      io.emit("newTransaction", {
        staffId: transaction.staffId,
        staffName: transaction.staffName,
        department: transaction.department,
        action: transaction.action,
        totalPcs: transaction.totalPcs,
        totalWeight: transaction.totalWeight,
        createdAt: transaction.createdAt,
      });
    }

    res.status(201).json(transaction);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/transactions  -> admin transaction table
// query: ?department=&action=&from=&to=&page=&limit=
// GET /api/transactions/pending           -> pending items across ALL departments (admin overview)
// GET /api/transactions/pending?department=X -> pending items for one department (staff reference)
router.get("/pending", async (req, res) => {
  const { department } = req.query;
  const matchDropoff = { action: "DROP_OFF" };
  const matchPickup = { action: "PICKUP" };
  if (department) {
    matchDropoff.department = department;
    matchPickup.department = department;
  }

  const dropoffAgg = await Transaction.aggregate([
    { $match: matchDropoff },
    { $unwind: "$items" },
    {
      $group: {
        _id: { department: "$department", itemName: "$items.itemName" },
        pcs: { $sum: "$items.pcs" },
        weight: { $sum: "$items.totalWeight" },
      },
    },
  ]);
  const pickupAgg = await Transaction.aggregate([
    { $match: matchPickup },
    { $unwind: "$items" },
    {
      $group: {
        _id: { department: "$department", itemName: "$items.itemName" },
        pcs: { $sum: "$items.pcs" },
        weight: { $sum: "$items.totalWeight" },
      },
    },
  ]);

  const pickedMap = {};
  pickupAgg.forEach((p) => {
    pickedMap[`${p._id.department}::${p._id.itemName}`] = p;
  });

  const pending = dropoffAgg
    .map((d) => {
      const key = `${d._id.department}::${d._id.itemName}`;
      const picked = pickedMap[key] || { pcs: 0, weight: 0 };
      return {
        department: d._id.department,
        itemName: d._id.itemName,
        droppedPcs: d.pcs,
        pickedPcs: picked.pcs,
        pendingPcs: d.pcs - picked.pcs,
        pendingWeight: Number((d.weight - picked.weight).toFixed(2)),
      };
    })
    .filter((p) => p.pendingPcs > 0) // only show items still owed back
    .sort((a, b) => a.department.localeCompare(b.department) || a.itemName.localeCompare(b.itemName));

  res.json(pending);
});

router.get("/", async (req, res) => {
  const { department, action, staffId, from, to, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (department) filter.department = department;
  if (action) filter.action = action;
  if (staffId) filter.staffId = { $regex: staffId.trim(), $options: "i" }; // partial match, case-insensitive
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const transactions = await Transaction.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Transaction.countDocuments(filter);
  res.json({ transactions, total, page: Number(page), limit: Number(limit) });
});

module.exports = router;