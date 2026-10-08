const mongoose = require("mongoose");

// One notification per submitted transaction. Stays until an admin clears it.
const notificationSchema = new mongoose.Schema(
  {
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
    staffId: String,
    staffName: String,
    department: String,
    action: { type: String, enum: ["PICKUP", "DROP_OFF"] },
    totalPcs: Number,
    totalWeight: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);