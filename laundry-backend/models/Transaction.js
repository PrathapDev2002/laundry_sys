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

    // Current (authoritative) item quantities — these feed pending/summary calculations.
    // For an acknowledged drop-off with a corrected count, this holds the VERIFIED
    // numbers, not what the staff originally typed.
    items: { type: [transactionItemSchema], required: true, validate: v => v.length > 0 },
    totalPcs: { type: Number, required: true },
    totalWeight: { type: Number, required: true },

    // --- Acknowledgement (DROP_OFF only) ---
    // Counter staff verify the physical count against what was submitted.
    status: {
      type: String,
      enum: ["PENDING", "ACKNOWLEDGED"],
      default: undefined, // only set for DROP_OFF at creation time; PICKUP leaves this unset
    },
    acknowledgedBy: { type: String, default: null }, // admin username, taken from their session
    acknowledgedAt: { type: Date, default: null },
    hasDiscrepancy: { type: Boolean, default: false },

    // Snapshot of what was originally submitted, only populated if the counter
    // count differed from it — keeps a clear audit trail of the correction.
    originalItems: { type: [transactionItemSchema], default: undefined },
    originalTotalPcs: { type: Number, default: undefined },
    originalTotalWeight: { type: Number, default: undefined },

    // One-time flag: has this discrepancy been shown to staff on their next lookup yet?
    discrepancyNotified: { type: Boolean, default: false },
  },
  { timestamps: true } // createdAt = your automatic server-side timestamp
);

// Speeds up the summary aggregations and transaction table filters
transactionSchema.index({ department: 1, action: 1, createdAt: 1 });
transactionSchema.index({ action: 1, status: 1 });
transactionSchema.index({ staffId: 1, hasDiscrepancy: 1, discrepancyNotified: 1 });

module.exports = mongoose.model("Transaction", transactionSchema);