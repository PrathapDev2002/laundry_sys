// Rules for verifying a drop-off at the counter. Pure functions (no database), so they can be
// tested on their own and reused by the verify route, the delete guard and the staff notices.
//
// The counter may fix BOTH the quantity and the item of each line (staff sometimes pick the
// wrong item), so lines are never matched up by position or assumed to keep their item.xcxccc

// { itemName -> total pcs }, adding up lines that repeat an item dfdfd
function sumByName(items) {
  const totals = new Map();
  for (const { itemName, pcs } of items) {
    totals.set(itemName, (totals.get(itemName) || 0) + pcs);
  }
  return totals;
}

// inputItems:    what the counter entered, [{ itemName, pcs }] (pcs 0 = "not actually received")
// originalItems: what the staff member submitted
// weightOf:      itemName -> kg per piece, or undefined if that item isn't known
//
// Returns { error } or { items, totalPcs, totalWeight, discrepancy }.
function buildVerification({ originalItems, inputItems, weightOf }) {
  if (!Array.isArray(inputItems) || inputItems.length === 0) {
    return { error: "Verified item quantities are required" };
  }

  const entered = [];
  for (const line of inputItems) {
    const itemName = line && line.itemName;
    const pcs = line && line.pcs;
    if (!itemName) return { error: "Every line needs an item" };
    if (!Number.isInteger(pcs) || pcs < 0) {
      return { error: `Quantity for "${itemName}" must be a whole number (0 or more)` };
    }
    entered.push({ itemName, pcs });
  }

  // Two lines pointed at the same item are combined; lines with 0 pcs are simply not recorded.
  const items = [];
  let totalPcs = 0;
  let totalWeight = 0;
  for (const [itemName, pcs] of sumByName(entered)) {
    if (pcs === 0) continue;
    const weightPerPc = weightOf(itemName);
    if (weightPerPc === undefined) {
      return { error: `"${itemName}" isn't an item of this department` };
    }
    const lineWeight = pcs * weightPerPc;
    items.push({ itemName, pcs, weightPerPc, totalWeight: lineWeight });
    totalPcs += pcs;
    totalWeight += lineWeight;
  }

  if (items.length === 0) {
    return {
      error:
        "Enter a quantity for at least one item. If nothing was actually received, delete this drop-off from the Transactions page instead.",
    };
  }

  // A correction = the verified result differs from what was submitted in ANY way
  // (a changed quantity, a different item, an item added or left out).
  const before = sumByName(originalItems);
  const after = sumByName(items);
  const discrepancy = before.size !== after.size || [...before].some(([name, pcs]) => after.get(name) !== pcs);

  return { items, totalPcs, totalWeight, discrepancy };
}

// Only the items whose count differs between what was submitted and what was verified.
// An item that was swapped for another shows up twice: once going to 0, once coming from 0.
function changedLines(originalItems, verifiedItems) {
  const before = sumByName(originalItems);
  const after = sumByName(verifiedItems);
  const names = [...new Set([...before.keys(), ...after.keys()])];
  return names
    .map((itemName) => ({
      itemName,
      originalPcs: before.get(itemName) || 0,
      verifiedPcs: after.get(itemName) || 0,
    }))
    .filter((line) => line.originalPcs !== line.verifiedPcs);
    // sdsndsnd
}

module.exports = { sumByName, buildVerification, changedLines };