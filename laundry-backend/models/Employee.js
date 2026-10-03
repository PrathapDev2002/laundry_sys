const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    staffId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    department: { type: String, required: true },
    position: { type: String, required: true },
    active: { type: Boolean, default: true }, // soft delete, keeps transaction history valid
  },
  { timestamps: true }
);

module.exports = mongoose.model("Employee", employeeSchema);