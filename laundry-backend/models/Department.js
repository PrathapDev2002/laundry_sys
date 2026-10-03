const mongoose = require("mongoose");
 
// Embedded sub-document: each item belongs to exactly one department here.
// If the same item (e.g. "Bedsheet") is used by multiple departments with the
// SAME weight, you can instead split this into a separate ItemMaster + a
// department->itemIds mapping. Embedding is simpler and fine unless you have
// lots of departments sharing identical items.
const itemSchema = new mongoose.Schema({
  itemName: { type: String, required: true, trim: true },
  weightPerPc: { type: Number, required: true, min: 0 }, // in kg
  active: { type: Boolean, default: true },
});
 
const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true }, // e.g. "Housekeeping"
    items: [itemSchema],
  },
  { timestamps: true }
);
 
module.exports = mongoose.model("Department", departmentSchema);