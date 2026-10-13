// Per-department, per-item stock figures, shared by the "pending" endpoints and the
// pickup check so they can never disagree with each other.
//
// For every department + item:
//   droppedPcs     everything ever dropped off (verified or not)
//   pickedPcs      everything already picked up
//   pendingPcs     dropped - picked        -> still at the laundry (what admin sees)
//   awaitingPcs    dropped off but NOT yet verified by the counter
//   availablePcs   verified - picked       -> what staff may actually pick up
//
// Drop-offs saved before the verification feature existed have no status at all.
// They count as verified, so old data doesn't suddenly become un-pickable.

const round2 = (n) => Math.round(n * 100) / 100;
const matchDepartment = (department) => (department ? { department } : {});
const keyOf = (id) => `${id.department}::${id.itemName}`;

const groupId = { department: "$department", itemName: "$items.itemName" };

const dropoffPipeline = (department) => [
  { $match: { action: "DROP_OFF", ...matchDepartment(department) } },
  { $unwind: "$items" },
  {
    $group: {
      _id: groupId,
      pcs: { $sum: "$items.pcs" },
      weight: { $sum: "$items.totalWeight" },
      awaitingPcs: { $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, "$items.pcs", 0] } },
      awaitingWeight: { $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, "$items.totalWeight", 0] } },
    },
  },
];

const pickupPipeline = (department) => [
  { $match: { action: "PICKUP", ...matchDepartment(department) } },
  { $unwind: "$items" },
  {
    $group: {
      _id: groupId,
      pcs: { $sum: "$items.pcs" },
      weight: { $sum: "$items.totalWeight" },
    },
  },
];

// Pure function: turns the two aggregation results into the per-item figures.
function computeBalances(dropoffRows, pickupRows) {
  const picked = {};
  pickupRows.forEach((p) => {
    picked[keyOf(p._id)] = p;
  });

  return dropoffRows
    .map((d) => {
      const p = picked[keyOf(d._id)] || { pcs: 0, weight: 0 };
      const verifiedPcs = d.pcs - d.awaitingPcs;
      const verifiedWeight = d.weight - d.awaitingWeight;
      return {
        department: d._id.department,
        itemName: d._id.itemName,
        droppedPcs: d.pcs,
        pickedPcs: p.pcs,
        pendingPcs: d.pcs - p.pcs,
        pendingWeight: round2(d.weight - p.weight),
        awaitingPcs: d.awaitingPcs,
        availablePcs: Math.max(0, verifiedPcs - p.pcs),
        availableWeight: round2(Math.max(0, verifiedWeight - p.weight)),
      };
    })
    .filter((r) => r.pendingPcs > 0) // only items still owed back
    .sort((a, b) => a.department.localeCompare(b.department) || a.itemName.localeCompare(b.itemName));
}

// Pure function: returns an error message if the requested pickup isn't allowed, else null.
// Quantities for the same item on several lines are added together before checking.
function checkPickup(balances, items) {
  const byItem = {};
  balances.forEach((b) => {
    byItem[b.itemName] = b;
  });

  const requested = {};
  items.forEach(({ itemName, pcs }) => {
    requested[itemName] = (requested[itemName] || 0) + pcs;
  });

  for (const [itemName, pcs] of Object.entries(requested)) {
    const b = byItem[itemName];
    const available = b ? b.availablePcs : 0;
    const awaiting = b ? b.awaitingPcs : 0;
    if (pcs <= available) continue;

    if (available === 0 && awaiting > 0) {
      return `"${itemName}" can't be picked up yet — ${awaiting} pcs are still waiting to be verified at the counter.`;
    }
    if (available === 0) {
      return `There is no "${itemName}" ready for pickup for your department.`;
    }
    return (
      `Only ${available} pcs of "${itemName}" are ready for pickup, cannot pick up ${pcs}.` +
      (awaiting > 0 ? ` (${awaiting} more pcs are still waiting to be verified.)` : "")
    );
  }
  return null;
}

// Database wrapper. The model is required lazily so the pure functions above
// can be tested without a database connection.
async function getItemBalances(department) {
  const Transaction = require("../models/Transaction");
  const [dropoffRows, pickupRows] = await Promise.all([
    Transaction.aggregate(dropoffPipeline(department)),
    Transaction.aggregate(pickupPipeline(department)),
  ]);
  return computeBalances(dropoffRows, pickupRows);
}

module.exports = { dropoffPipeline, pickupPipeline, computeBalances, checkPickup, getItemBalances };