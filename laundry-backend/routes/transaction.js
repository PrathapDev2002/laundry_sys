const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const Employee = require("../models/Employee");
const Notification = require("../models/Notification");
const auth = require("../middleware/authMiddle");
const { parseFrom, parseTo } = require("../utils/dates");
const { getItemBalances, checkPickup } = require("../utils/balances");
const { sumByName, buildVerification, changedLines } = require("../utils/verification");

// POST /api/transactions  -> the QR form submits here
// body: { staffId, action: "PICKUP"|"DROP_OFF", items: [{ itemName, pcs }] }
// Weight is NOT trusted from the client — always recomputed server-side against
// the department's item list, so the frontend can't send a tampered weight.cvxcx
router.post("/", async (req, res) => {
  try {
    const { staffId, action, items } = req.body;

    if (!["DROP_OFF", "PICKUP"].includes(action)) {
      return res.status(400).json({ message: "Action must be drop-off or pickup" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Add at least one item" });
    }

    const employee = await Employee.findOne({ staffId, active: true });
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    const Department = require("../models/Department");
    const dept = await Department.findOne({ name: employee.department });
    if (!dept) return res.status(400).json({ message: "Department has no item list configured" });

    let totalPcs = 0;
    let totalWeight = 0;
    const resolvedItems = items.map(({ itemName, pcs }) => {
      if (!Number.isInteger(pcs) || pcs < 1) {
        throw new Error(`Quantity for "${itemName}" must be a whole number of at least 1`);
      }
      // Pickups may include items an admin has since removed from the dropdown, so stock
      // that is still at the laundry can always be collected.
      const deptItem = dept.items.find(i => i.itemName === itemName && (i.active || action === "PICKUP"));
      if (!deptItem) throw new Error(`Item "${itemName}" not valid for department ${employee.department}`);
      const lineWeight = pcs * deptItem.weightPerPc;
      totalPcs += pcs;
      totalWeight += lineWeight;
      return { itemName, pcs, weightPerPc: deptItem.weightPerPc, totalWeight: lineWeight };
    });

    // Pickups are only allowed for drop-offs the counter has verified, and never for more
    // than is still there (verified minus already picked up) for this department.
    if (action === "PICKUP") {
      const balances = await getItemBalances(employee.department);
      const problem = checkPickup(balances, resolvedItems);
      if (problem) return res.status(400).json({ message: problem });
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

// GET /api/transactions/pending           -> items still at the laundry, ALL departments (admin overview)
// GET /api/transactions/pending?department=X -> same for one department (staff form: what's ready to pick up)
// PUBLIC — the staff form needs it. Each row has pendingPcs (still at the laundry), awaitingPcs
// (not yet verified by the counter) and availablePcs/availableWeight (verified, ready to pick up).
router.get("/pending", async (req, res) => {
  res.json(await getItemBalances(req.query.department));
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

    const Department = require("../models/Department");
    const dept = await Department.findOne({ name: transaction.department });

    // Weight per piece: the department's current item list first; if the item has since been
    // removed from it (or the department is gone), fall back to the weight saved on this
    // transaction. An item known to neither is rejected rather than silently weighed as 0 kg.
    const weightOf = (name) =>
      dept?.items.find((i) => i.itemName === name)?.weightPerPc ??
      transaction.items.find((i) => i.itemName === name)?.weightPerPc;

    // The counter may correct the item as well as the quantity of every line.
    const result = buildVerification({
      originalItems: transaction.items,
      inputItems: req.body.items,
      weightOf,
    });
    if (result.error) return res.status(400).json({ message: result.error });

    if (result.discrepancy) {
      // Keep a plain copy of exactly what was submitted, before it is overwritten below.
      transaction.originalItems = transaction.items.map((i) => i.toObject());
      transaction.originalTotalPcs = transaction.totalPcs;
      transaction.originalTotalWeight = transaction.totalWeight;
      transaction.hasDiscrepancy = true;
    }

    transaction.items = result.items;
    transaction.totalPcs = result.totalPcs;
    transaction.totalWeight = result.totalWeight;
    transaction.status = "ACKNOWLEDGED";
    transaction.acknowledgedBy = req.admin.username; // from the logged-in session, not user input
    transaction.acknowledgedAt = new Date();

    await transaction.save();

    // The "awaiting verification" notification has done its job — remove it so the bell
    // doesn't keep pointing at something that's already handled. A failure here must not
    // undo the verification, which is already saved.
    try {
      await Notification.deleteMany({ transactionId: transaction._id });
    } catch (cleanupErr) {
      console.error("Notification cleanup failed:", cleanupErr.message);
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("notificationsChanged"); // every open bell reloads its list
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
      items: changedLines(n.originalItems || [], n.items),
    }))
  );
});

// DELETE /api/transactions/:id -> ADMIN ONLY — permanently remove a transaction
// (e.g. a wrong or test entry). Pending-pickup balances and summaries follow automatically,
// since they're always calculated from the transactions that exist.
router.delete("/:id", auth, async (req, res) => {
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) return res.status(404).json({ message: "Transaction not found" });

  // Don't leave more picked up than was ever dropped off: a verified drop-off can only be
  // deleted while all of its stock is still there. (An unverified one can't have been picked up.)
  if (transaction.action === "DROP_OFF" && transaction.status !== "PENDING") {
    const balances = await getItemBalances(transaction.department);
    const byItem = Object.fromEntries(balances.map((b) => [b.itemName, b]));
    for (const [itemName, pcs] of sumByName(transaction.items)) {
      const available = byItem[itemName]?.availablePcs ?? 0;
      if (available < pcs) {
        return res.status(409).json({
          message:
            `Can't delete this drop-off: some of its "${itemName}" has already been picked up. ` +
            `Delete the related pickup first.`,
        });
      }
    }
  }

  await Transaction.deleteOne({ _id: transaction._id });
  await Notification.deleteMany({ transactionId: transaction._id });
  console.log(
    `Transaction deleted by ${req.admin.username}: ${transaction.action} by ${transaction.staffName} ` +
      `(${transaction.staffId}), ${transaction.department}, ${transaction.totalPcs} pcs, ${transaction.createdAt.toISOString()}`
  );

  const io = req.app.get("io");
  if (io) io.emit("notificationsChanged");
  res.json({ message: "Transaction deleted" });
});

module.exports = router;