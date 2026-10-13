const { parseFrom, parseTo } = require("./dates");

// Builds the aggregation behind the pivot summary: pieces and weight per
// period x department x item x action. The page regroups these rows itself.
//
// period: "day"   -> one row per calendar day
//         "month" -> one row per month
//         "none"  -> no date breakdown at all (smallest result, used when the pivot
//                    isn't grouped by date)
const PERIOD_FORMAT = { day: "%Y-%m-%d", month: "%Y-%m" };

function pivotPipeline({ department, from, to, period = "none" }) {
  const match = {};
  if (department) match.department = department;
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = parseFrom(from);
    if (to) match.createdAt.$lte = parseTo(to);
  }

  const periodExpr = PERIOD_FORMAT[period]
    ? { $dateToString: { format: PERIOD_FORMAT[period], date: "$createdAt" } }
    : "All";

  return [
    { $match: match },
    { $unwind: "$items" },
    {
      $group: {
        _id: { period: periodExpr, department: "$department", itemName: "$items.itemName", action: "$action" },
        pcs: { $sum: "$items.pcs" },
        weight: { $sum: "$items.totalWeight" },
      },
    },
  ];
}

const shapeRows = (rows) =>
  rows.map((r) => ({
    period: r._id.period,
    department: r._id.department,
    itemName: r._id.itemName,
    action: r._id.action,
    pcs: r.pcs,
    weight: Math.round(r.weight * 100) / 100,
  }));

module.exports = { pivotPipeline, shapeRows };