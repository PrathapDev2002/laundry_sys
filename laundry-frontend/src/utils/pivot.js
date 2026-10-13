// Pivot-table logic for the Summary page. Pure functions, no React, so it can be tested alone.
//
// Input rows (from GET /api/summary/pivot):
//   { period, department, itemName, action: "DROP_OFF" | "PICKUP", pcs, weight }
// The user picks which fields form the row hierarchy (e.g. department -> item) and which
// actions to show; this turns the rows into a tree with a subtotal on every node.

const FIELD_GETTERS = {
  period: (r) => r.period,
  department: (r) => r.department,
  item: (r) => r.itemName,
};

export const fieldLabel = (field, granularity) => {
  if (field === "period") return granularity === "month" ? "Month" : "Day";
  return field === "department" ? "Department" : "Item";
};

const blank = () => ({ DROP_OFF: { pcs: 0, weight: 0 }, PICKUP: { pcs: 0, weight: 0 } });
const makeNode = (label, field, path, depth) => ({
  label,
  field,
  path,
  depth,
  values: blank(),
  children: new Map(),
});
const addRow = (values, r) => {
  values[r.action].pcs += r.pcs;
  values[r.action].weight += r.weight;
};
const byLabel = (a, b) => a.label.localeCompare(b.label, undefined, { numeric: true });

export const keyOf = (node) => node.path.join("\u0001");

// levels: ordered field names, e.g. ["department", "item"]; actions: e.g. ["DROP_OFF"]
export function buildPivot(rows, levels, actions) {
  const root = makeNode("Grand Total", null, [], -1);

  for (const r of rows) {
    if (!actions.includes(r.action)) continue;
    addRow(root.values, r);

    let node = root;
    levels.forEach((field, depth) => {
      const label = String(FIELD_GETTERS[field](r));
      let child = node.children.get(label);
      if (!child) {
        child = makeNode(label, field, [...node.path, label], depth);
        node.children.set(label, child);
      }
      addRow(child.values, r);
      node = child;
    });
  }

  const finalize = (node) => {
    node.children = [...node.children.values()].sort(byLabel);
    node.children.forEach(finalize);
  };
  finalize(root);
  return root;
}

// Value columns shown for the chosen actions. Both actions -> four columns, headers say which.
export function valueColumns(actions) {
  const both = actions.length > 1;
  const name = { DROP_OFF: "Drop-off", PICKUP: "Pickup" };
  return actions.flatMap((action) => [
    { action, metric: "pcs", header: both ? `${name[action]} Qty` : "Qty (pcs)" },
    { action, metric: "weight", header: both ? `${name[action]} Weight (kg)` : "Weight (kg)" },
  ]);
}

export const cellValue = (values, col) => values[col.action][col.metric];

export const formatValue = (n, metric) =>
  metric === "pcs"
    ? n.toLocaleString()
    : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// GROUPED view: the rows currently visible, honouring which groups are collapsed.
export function visibleRows(root, collapsed) {
  const out = [];
  const walk = (node) => {
    node.children.forEach((child) => {
      const key = keyOf(child);
      const isGroup = child.children.length > 0;
      const isCollapsed = isGroup && collapsed.has(key);
      out.push({ node: child, key, depth: child.depth, isGroup, isCollapsed });
      if (isGroup && !isCollapsed) walk(child);
    });
  };
  walk(root);
  return out;
}

// Keys of every node that has children (what "Collapse all" collapses).
export function allGroupKeys(root) {
  const keys = [];
  const walk = (node) =>
    node.children.forEach((child) => {
      if (child.children.length > 0) {
        keys.push(keyOf(child));
        walk(child);
      }
    });
  walk(root);
  return keys;
}

// UNGROUPED / flat view: one plain row per deepest combination, no subtotals.
export function leafRows(root) {
  const out = [];
  const walk = (node) => {
    if (node.children.length === 0) {
      if (node !== root) out.push({ labels: node.path, values: node.values });
      return;
    }
    node.children.forEach(walk);
  };
  walk(root);
  return out;
}

const csvCell = (v) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Flat table as CSV. The leading BOM makes Excel read non-English item names correctly.
export function toCsv(root, levels, granularity, actions) {
  const cols = valueColumns(actions);
  const fmt = (values, col) => cellValue(values, col).toFixed(col.metric === "pcs" ? 0 : 2);

  const header = [...levels.map((f) => fieldLabel(f, granularity)), ...cols.map((c) => c.header)];
  const body = leafRows(root).map((leaf) => [...leaf.labels, ...cols.map((c) => fmt(leaf.values, c))]);
  const total = ["Grand Total", ...Array(Math.max(levels.length - 1, 0)).fill(""), ...cols.map((c) => fmt(root.values, c))];

  return "\uFEFF" + [header, ...body, total].map((row) => row.map(csvCell).join(",")).join("\n");
}