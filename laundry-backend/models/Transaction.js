const mongoose = require("mongoose");

const transactionItemSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true },
    pcs: { type: Number, required: true, min: 1 },
    weightPerPc: { type: Number, required: true },
    totalWeight: { type: Number, required: true }, // pcs * weightPerPc, computed server-side
  },
  { _id: false }
);

const transactionSchema = new mongoose.Schema(
  {
    // Snapshot fields — copied at submit time, NOT a live reference.
    // This protects history if the employee's department/position changes later.
    staffId: { type: String, required: true },
    staffName: { type: String, required: true },
    department: { type: String, required: true },
    position: { type: String, required: true },

    action: { type: String, enum: ["PICKUP", "DROP_OFF"], required: true },

    items: { type: [transactionItemSchema], required: true, validate: v => v.length > 0 },

    totalPcs: { type: Number, required: true },
    totalWeight: { type: Number, required: true },
  },
  { timestamps: true } // createdAt = your automatic server-side timestamp
);

// Speeds up the summary aggregations and transaction table filters
transactionSchema.index({ department: 1, action: 1, createdAt: 1 });

module.exports = mongoose.model("Transaction", transactionSchema);