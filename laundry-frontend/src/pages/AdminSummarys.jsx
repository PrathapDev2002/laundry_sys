import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import AdminLayout from "../components/Adminlayout";
import { getPivot, listDepartments } from "../api/api";
import {
  buildPivot,
  valueColumns,
  cellValue,
  formatValue,
  visibleRows,
  allGroupKeys,
  leafRows,
  toCsv,
  fieldLabel,
} from "../utils/pivot";

// Dates are handled in UTC, the same way the server buckets them.
const iso = (d) => d.toISOString().slice(0, 10);
const PRESETS = [
  {
    id: "thisMonth",
    label: "This month",
    range: () => {
      const n = new Date();
      return [iso(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1))), iso(n)];
    },
  },
  {
    id: "lastMonth",
    label: "Last month",
    range: () => {
      const n = new Date();
      return [
        iso(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - 1, 1))),
        iso(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 0))),
      ];
    },
  },
  {
    id: "last7",
    label: "Last 7 days",
    range: () => {
      const n = new Date();
      const s = new Date(n);
      s.setUTCDate(s.getUTCDate() - 6);
      return [iso(s), iso(n)];
    },
  },
  { id: "all", label: "All time", range: () => ["", ""] },
];

const LEVEL_OPTIONS = [
  { value: "department", label: "Department" },
  { value: "item", label: "Item" },
  { value: "period", label: "Date" },
];

const controlClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-800 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 " +
  "disabled:bg-gray-50 disabled:text-gray-400";

// A control with its label above it
function Field({ label, children }) {
  return (
    <label className="block min-w-0">
      <span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

const SectionTitle = ({ children }) => (
  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">{children}</p>
);

export default function AdminSummary() {
  const [initialFrom, initialTo] = PRESETS[0].range();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [department, setDepartment] = useState("");
  const [show, setShow] = useState("DROP_OFF"); // DROP_OFF | PICKUP | BOTH

  // The row hierarchy, outermost first. Level 1 is required; 2 and 3 are optional.
  const [levelSel, setLevelSel] = useState(["department", "item", ""]);
  const [granularity, setGranularity] = useState("month"); // used only when Date is one of the levels
  const [view, setView] = useState("grouped"); // grouped | flat
  const [collapsed, setCollapsed] = useState(new Set());

  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const levels = levelSel.filter(Boolean);
  const levelsKey = levels.join(",");
  const periodParam = levels.includes("period") ? granularity : "none";
  const actions = show === "BOTH" ? ["DROP_OFF", "PICKUP"] : [show];
  const actionsKey = actions.join(",");
  const cols = valueColumns(actions);
  const hasGroups = levels.length > 1;

  useEffect(() => {
    listDepartments()
      .then(({ data }) => setDepartments(Array.isArray(data) ? data : []))
      .catch(() => setDepartments([]));
  }, []);

  // Only filters that change what the server returns trigger a fetch. Regrouping,
  // switching Drop-off/Pickup, expanding and collapsing all happen instantly in the browser.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getPivot({
      from: from || undefined,
      to: to || undefined,
      department: department || undefined,
      period: periodParam,
    })
      .then(({ data }) => {
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setError("Failed to load the summary.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, department, periodParam]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pivot = useMemo(() => buildPivot(rows, levels, actions), [rows, levelsKey, actionsKey]);

  // A new layout starts fully expanded.
  useEffect(() => {
    setCollapsed(new Set());
  }, [levelsKey]);

  // Picking a field that's already used in another level swaps the two (like dragging
  // fields in a pivot table). Empty levels are closed up so there are never gaps.
  const setLevel = (index, value) =>
    setLevelSel((prev) => {
      const next = [...prev];
      const existing = value ? next.indexOf(value) : -1;
      if (existing !== -1 && existing !== index) next[existing] = next[index];
      next[index] = value;
      const compact = next.filter(Boolean);
      return [compact[0] || "", compact[1] || "", compact[2] || ""];
    });

  const applyPreset = (preset) => {
    const [f, t] = preset.range();
    setFrom(f);
    setTo(t);
  };
  const activePreset = PRESETS.find((p) => {
    const [f, t] = p.range();
    return f === from && t === to;
  })?.id;

  const toggle = (key) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(allGroupKeys(pivot)));

  const exportCsv = () => {
    const blob = new Blob([toCsv(pivot, levels, granularity, actions)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `summary_${from || "all"}_${to || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const grouped = view === "grouped" ? visibleRows(pivot, collapsed) : [];
  const flat = view === "flat" ? leafRows(pivot) : [];
  const isEmpty = pivot.children.length === 0;
  const colSpanAll = (view === "flat" ? levels.length : 1) + cols.length;

  const valueCells = (values) =>
    cols.map((c) => (
      <td key={c.header} className="px-3 sm:px-4 py-2 text-right whitespace-nowrap border-r border-gray-100 last:border-r-0">
        {formatValue(cellValue(values, c), c.metric)}
      </td>
    ));

  return (
    <AdminLayout title="Summary">
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4">{error}</div>}

      {/* One panel: what data to include, and how to group the rows */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-5 mb-4">
        <SectionTitle>Filters</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="From">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={controlClass} />
          </Field>
          <Field label="To">
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={controlClass} />
          </Field>
          <Field label="Department">
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className={controlClass}>
              <option value="">All departments</option>
              {(departments || []).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="Show">
            <select value={show} onChange={(e) => setShow(e.target.value)} className={controlClass}>
              <option value="DROP_OFF">Drop-off</option>
              <option value="PICKUP">Pickup</option>
              <option value="BOTH">Drop-off &amp; Pickup</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mt-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                activePreset === p.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="border-t border-gray-100 my-5" />

        <SectionTitle>Group rows by</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Group by">
            <select value={levelSel[0]} onChange={(e) => setLevel(0, e.target.value)} className={controlClass} aria-label="Group by (level 1)">
              {LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Then by">
            <select value={levelSel[1]} onChange={(e) => setLevel(1, e.target.value)} className={controlClass} aria-label="Then by (level 2)">
              <option value="">None</option>
              {LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Then by">
            <select
              value={levelSel[2]}
              onChange={(e) => setLevel(2, e.target.value)}
              disabled={!levelSel[1]}
              className={controlClass}
              aria-label="Then by (level 3)"
            >
              <option value="">None</option>
              {LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          {levels.includes("period") && (
            <Field label="Date grouping">
              <select value={granularity} onChange={(e) => setGranularity(e.target.value)} className={controlClass} aria-label="Date grouping">
                <option value="day">By day</option>
                <option value="month">By month</option>
              </select>
            </Field>
          )}
        </div>
      </div>

      {/* The table, with the controls that only change how it is displayed */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 border-b border-gray-100">
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            {[
              ["grouped", "Grouped"],
              ["flat", "Flat"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`px-3 py-1.5 ${view === id ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {view === "grouped" && (
            <div className="flex items-center gap-1">
              <button
                onClick={expandAll}
                disabled={!hasGroups}
                className="px-2.5 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Expand all
              </button>
              <button
                onClick={collapseAll}
                disabled={!hasGroups}
                className="px-2.5 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Collapse all
              </button>
            </div>
          )}

          <button
            onClick={exportCsv}
            disabled={isEmpty}
            className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-blue-600 font-medium hover:bg-blue-50 disabled:text-gray-300 disabled:hover:bg-transparent"
          >
            <Download size={15} /> Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {view === "grouped" ? (
                  <th className="px-3 sm:px-4 py-3 text-left border-r border-gray-200 bg-gray-50 sticky left-0 shadow-[1px_0_0_0_#e5e7eb]">Row Labels</th>
                ) : (
                  levels.map((f, idx) => (
                    <th
                      key={f}
                      className={`px-3 sm:px-4 py-3 text-left border-r border-gray-200 ${idx === 0 ? "bg-gray-50 sticky left-0 shadow-[1px_0_0_0_#e5e7eb]" : ""}`}
                    >
                      {fieldLabel(f, granularity)}
                    </th>
                  ))
                )}
                {cols.map((c) => (
                  <th key={c.header} className="px-3 sm:px-4 py-3 text-right border-r border-gray-200 last:border-r-0">
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colSpanAll} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : isEmpty ? (
                <tr><td colSpan={colSpanAll} className="px-4 py-8 text-center text-gray-400">No data for this selection.</td></tr>
              ) : (
                <>
                  {view === "grouped" &&
                    grouped.map((row) => (
                      <tr
                        key={row.key}
                        className={`group border-b border-gray-100 ${
                          row.isGroup
                            ? row.depth === 0
                              ? "bg-blue-50 font-semibold"
                              : "bg-slate-50 font-medium"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <td
                          className={`py-2 pr-3 sm:pr-4 border-r border-gray-100 sticky left-0 shadow-[1px_0_0_0_#e5e7eb] ${
                            row.isGroup
                              ? row.depth === 0
                                ? "bg-blue-50"
                                : "bg-slate-50"
                              : "bg-white group-hover:bg-gray-50"
                          }`}
                          style={{ paddingLeft: 12 + row.depth * 24 }}
                        >
                          {row.isGroup ? (
                            <button onClick={() => toggle(row.key)} className="inline-flex items-start gap-1.5 text-left">
                              {row.isCollapsed ? (
                                <ChevronRight size={15} className="shrink-0 mt-0.5" />
                              ) : (
                                <ChevronDown size={15} className="shrink-0 mt-0.5" />
                              )}
                              {row.node.label}
                            </button>
                          ) : (
                            row.node.label
                          )}
                        </td>
                        {valueCells(row.node.values)}
                      </tr>
                    ))}

                  {view === "flat" &&
                    flat.map((leaf, i) => (
                      <tr key={i} className="group border-b border-gray-100 hover:bg-gray-50">
                        {leaf.labels.map((label, j) => (
                          <td
                            key={j}
                            className={`px-3 sm:px-4 py-2 border-r border-gray-100 ${
                              j === 0 ? "bg-white group-hover:bg-gray-50 sticky left-0 shadow-[1px_0_0_0_#e5e7eb]" : ""
                            }`}
                          >
                            {label}
                          </td>
                        ))}
                        {valueCells(leaf.values)}
                      </tr>
                    ))}

                  <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                    <td className="px-3 sm:px-4 py-3 border-r border-gray-200 bg-gray-50 sticky left-0 shadow-[1px_0_0_0_#e5e7eb]" colSpan={view === "flat" ? levels.length : 1}>
                      Grand Total
                    </td>
                    {valueCells(pivot.values)}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}