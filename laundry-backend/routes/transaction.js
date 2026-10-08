const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const Employee = require("../models/Employee");
const Notification = require("../models/Notification");
const auth = require("../middleware/authMiddle");
const { parseFrom, parseTo } = require("../utils/dates");

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
      // Only drop-offs go through counter acknowledgement; pickups don't need it.
      status: action === "DROP_OFF" ? "PENDING" : undefined,
    });

    // Save a notification (it stays until an admin clears it), then push it live
    // to any open dashboards. A failure here must never fail the transaction itself.
    try {
      const notification = await Notification.create({
        transactionId: transaction._id,
        staffId: transaction.staffId,
        staffName: transaction.staffName,
        department: transaction.department,
        action: transaction.action,
        totalPcs: transaction.totalPcs,
        totalWeight: transaction.totalWeight,
      });
      const io = req.app.get("io");
      if (io) io.emit("newTransaction", notification);
    } catch (notifyErr) {
      console.error("Notification failed:", notifyErr.message);
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

// GET /api/transactions  -> ADMIN ONLY — full transaction table
// (also used, with ?action=DROP_OFF&status=PENDING, to power the Acknowledge Drop-offs page)
router.get("/", auth, async (req, res) => {
  const { department, action, staffId, status, discrepancy, from, to, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (department) filter.department = department;
  if (action) filter.action = action;
  if (status) filter.status = status;
  if (discrepancy === "true") filter.hasDiscrepancy = true; // only drop-offs corrected at the counter
  if (staffId) filter.staffId = { $regex: staffId.trim(), $options: "i" }; // partial match, case-insensitive
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = parseFrom(from);
    if (to) filter.createdAt.$lte = parseTo(to);
  }

  const transactions = await Transaction.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Transaction.countDocuments(filter);
  res.json({ transactions, total, page: Number(page), limit: Number(limit) });
});

// PATCH /api/transactions/:id/acknowledge  -> ADMIN ONLY — counter staff verifies a drop-off
// body: { items: [{ itemName, pcs }] }  — the ACTUAL counted quantities.
// acknowledgedBy is taken from the logged-in admin's own session (req.admin), never from the body.
router.patch("/:id/acknowledge", auth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });
    if (transaction.action !== "DROP_OFF") {
      return res.status(400).json({ message: "Only drop-off transactions can be acknowledged" });
    }
    if (transaction.status !== "PENDING") {
      return res.status(400).json({ message: "This transaction has already been acknowledged" });
    }

    const { items: verifiedInput } = req.body;
    if (!Array.isArray(verifiedInput) || verifiedInput.length === 0) {
      return res.status(400).json({ message: "Verified item quantities are required" });
    }

    const Department = require("../models/Department");
    const dept = await Department.findOne({ name: transaction.department });
    if (!dept) return res.status(400).json({ message: "Department has no item list configured" });

    let newTotalPcs = 0;
    let newTotalWeight = 0;
    const verifiedItems = verifiedInput.map(({ itemName, pcs }) => {
      const deptItem = dept.items.find((i) => i.itemName === itemName);
      const weightPerPc = deptItem ? deptItem.weightPerPc : 0;
      const lineWeight = pcs * weightPerPc;
      newTotalPcs += pcs;
      newTotalWeight += lineWeight;
      return { itemName, pcs, weightPerPc, totalWeight: lineWeight };
    });

    // Did the verified count differ from what was originally submitted?
    const discrepancy =
      newTotalPcs !== transaction.totalPcs ||
      verifiedItems.some((v) => {
        const orig = transaction.items.find((i) => i.itemName === v.itemName);
        return !orig || orig.pcs !== v.pcs;
      });

    if (discrepancy) {
      transaction.originalItems = transaction.items;
      transaction.originalTotalPcs = transaction.totalPcs;
      transaction.originalTotalWeight = transaction.totalWeight;
      transaction.hasDiscrepancy = true;
    }

    transaction.items = verifiedItems;
    transaction.totalPcs = newTotalPcs;
    transaction.totalWeight = newTotalWeight;
    transaction.status = "ACKNOWLEDGED";
    transaction.acknowledgedBy = req.admin.username; // from the logged-in session, not user input
    transaction.acknowledgedAt = new Date();

    await transaction.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("transactionAcknowledged", {
        id: transaction._id,
        staffId: transaction.staffId,
        department: transaction.department,
        hasDiscrepancy: transaction.hasDiscrepancy,
        acknowledgedBy: transaction.acknowledgedBy,
      });
    }

    res.json(transaction);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/transactions/my-notices?staffId=X  -> PUBLIC — unseen discrepancy notices for a staff ID.
// Called by the staff form right after employee lookup. Auto-marks them as seen once fetched,
// since there's no staff login/session to support a dismiss button across visits.
router.get("/my-notices", async (req, res) => {
  const { staffId } = req.query;
  if (!staffId) return res.status(400).json({ message: "staffId is required" });

  const notices = await Transaction.find({
    staffId,
    action: "DROP_OFF",
    hasDiscrepancy: true,
    discrepancyNotified: false,
  }).sort({ acknowledgedAt: -1 });

  if (notices.length > 0) {
    await Transaction.updateMany(
      { _id: { $in: notices.map((n) => n._id) } },
      { discrepancyNotified: true }
    );
  }

  res.json(
    notices.map((n) => ({
      department: n.department,
      originalTotalPcs: n.originalTotalPcs,
      verifiedTotalPcs: n.totalPcs,
      acknowledgedBy: n.acknowledgedBy,
      acknowledgedAt: n.acknowledgedAt,
      items: n.items.map((item) => ({
        itemName: item.itemName,
        verifiedPcs: item.pcs,
        originalPcs: n.originalItems?.find((o) => o.itemName === item.itemName)?.pcs ?? item.pcs,
      })),
    }))
  );
});

module.exports = router;