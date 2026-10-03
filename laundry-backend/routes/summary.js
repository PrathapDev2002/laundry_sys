const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");

// GET /api/summary?groupBy=day|month&department=&from=&to=&action=DROP_OFF
// Default action=DROP_OFF since that's what feeds the "sent for washing" totals.
// Pass action=PICKUP if you want the return-side numbers too.
router.get("/", async (req, res) => {
  const { groupBy = "day", department, from, to, action = "DROP_OFF" } = req.query;

  const match = { action };
  if (department) match.department = department;
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  const dateFormat = groupBy === "month" ? "%Y-%m" : "%Y-%m-%d";

  const summary = await Transaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          department: "$department",
          period: { $dateToString: { format: dateFormat, date: "$createdAt" } },
        },
        totalPcs: { $sum: "$totalPcs" },
        totalWeight: { $sum: "$totalWeight" },
        transactionCount: { $sum: 1 },
      },
    },
    { $sort: { "_id.period": -1, "_id.department": 1 } },
  ]);

  res.json(
    summary.map(s => ({
      department: s._id.department,
      period: s._id.period,
      totalPcs: s.totalPcs,
      totalWeight: s.totalWeight,
      transactionCount: s.transactionCount,
    }))
  );
});

module.exports = router;