import type {
  ClassifiedChangeKind,
  ClassifiedDiffEntry,
  ClassifiedLockfileDiff,
  DependencyScope,
} from "@lockfile-lens/core";

export interface RenderHtmlReportOptions {
  readonly oldLockfilePath: string;
  readonly newLockfilePath: string;
}

const changeKinds: readonly ClassifiedChangeKind[] = [
  "brand-new",
  "added",
  "removed",
  "version-changed",
];

/**
 * Renders a deterministic, self-contained HTML lockfile report.
 *
 * Dynamic values are escaped because package names, versions, paths, and specifiers come from
 * lockfiles and must be treated as untrusted text.
 */
export function renderHtmlReport(
  diff: ClassifiedLockfileDiff,
  options: RenderHtmlReportOptions,
): string {
  const entries = sortEntries(diff.entries);

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; img-src &#39;self&#39; data:; base-uri &#39;none&#39;; form-action &#39;none&#39;">',
    "<title>lockfile-lens report</title>",
    `<style>${css()}</style>`,
    "</head>",
    "<body>",
    '<main class="shell">',
    '<section class="hero" aria-labelledby="report-title">',
    '<p class="eyebrow">lockfile-lens</p>',
    '<h1 id="report-title">Lockfile review report</h1>',
    `<p class="compare">Compared <code>${escapeHtml(options.oldLockfilePath)}</code> to <code>${escapeHtml(options.newLockfilePath)}</code>.</p>`,
    "</section>",
    entries.length === 0 ? renderEmptyState() : renderReport(entries),
    "</main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderEmptyState(): string {
  return [
    '<section class="panel success" aria-labelledby="empty-title">',
    '<h2 id="empty-title">No dependency changes detected</h2>',
    "<p>No package additions, removals, version changes, or brand-new package names were found.</p>",
    "</section>",
  ].join("\n");
}

function renderReport(entries: readonly ClassifiedDiffEntry[]): string {
  return [
    renderReviewFocus(entries),
    renderSummary(entries),
    renderChecklist(entries),
    renderHighlights(entries),
    renderBrandNew(entries),
    renderScopedChanges("Direct dependency changes", "direct", entries),
    renderScopedChanges("Transitive dependency changes", "transitive", entries),
    renderNotes(),
  ].join("\n");
}

function renderReviewFocus(entries: readonly ClassifiedDiffEntry[]): string {
  const totals = getTotals(entries);
  const lines = [
    '<section class="panel" aria-labelledby="focus-title">',
    '<h2 id="focus-title">Review focus</h2>',
    '<div class="focus-grid">',
    metricCard("Package entries", String(entries.length), "Total reported lockfile changes"),
    metricCard("Brand-new", String(totals.brandNew), "New package names in the graph"),
    metricCard("Direct", String(totals.directChanges), "Workspace-declared dependency changes"),
    metricCard("Removed", String(totals.removed), "Package versions that disappeared"),
    "</div>",
    "<p>",
    `Start with brand-new packages, then direct dependency changes, then removals. No registry calls were made; this report is based only on the two lockfiles.`,
    "</p>",
    "</section>",
  ];

  return lines.join("\n");
}

function metricCard(label: string, value: string, help: string): string {
  return [
    '<div class="metric">',
    `<span class="metric-label">${escapeHtml(label)}</span>`,
    `<strong>${escapeHtml(value)}</strong>`,
    `<span class="metric-help">${escapeHtml(help)}</span>`,
    "</div>",
  ].join("");
}

function renderSummary(entries: readonly ClassifiedDiffEntry[]): string {
  const rows = changeKinds.map((kind) => {
    const direct = countEntries(entries, kind, "direct");
    const transitive = countEntries(entries, kind, "transitive");
    return [formatKind(kind), String(direct), String(transitive), String(direct + transitive)];
  });

  return renderTable("Change totals", ["Change", "Direct", "Transitive", "Total"], rows);
}

function renderChecklist(entries: readonly ClassifiedDiffEntry[]): string {
  const totals = getTotals(entries);
  const items = [
    `Brand-new packages expected: ${totals.brandNew > 0 ? "review required" : "none found"}.`,
    `Direct dependency changes expected: ${totals.directChanges > 0 ? "review required" : "none found"}.`,
    `Transitive dependency churn understood: ${totals.transitiveChanges > 0 ? "review recommended" : "none found"}.`,
    `Removals expected: ${totals.removed > 0 ? "review required" : "none found"}.`,
  ];

  return [
    '<section class="panel" aria-labelledby="checklist-title">',
    '<h2 id="checklist-title">Reviewer checklist</h2>',
    "<ul>",
    ...items.map((item) => `<li>${escapeHtml(item)}</li>`),
    "</ul>",
    "</section>",
  ].join("\n");
}

function renderHighlights(entries: readonly ClassifiedDiffEntry[]): string {
  const rows = [
    getHighlightRow(
      "Brand-new direct packages",
      "New direct dependency trust relationship",
      entries.filter((entry) => entry.kind === "brand-new" && entry.dependencyScope === "direct"),
    ),
    getHighlightRow(
      "Brand-new transitive packages",
      "New transitive dependency trust relationship",
      entries.filter(
        (entry) => entry.kind === "brand-new" && entry.dependencyScope === "transitive",
      ),
    ),
    getHighlightRow(
      "Direct version changes",
      "Workspace-declared package version changed",
      entries.filter(
        (entry) => entry.kind === "version-changed" && entry.dependencyScope === "direct",
      ),
    ),
    getHighlightRow(
      "Removed packages",
      "Package version disappeared from the graph",
      entries.filter((entry) => entry.kind === "removed"),
    ),
  ].filter((row) => row.count > 0);

  if (rows.length === 0) {
    return [
      '<section class="panel" aria-labelledby="highlights-title">',
      '<h2 id="highlights-title">Highest-signal changes</h2>',
      "<p>No high-signal review categories found.</p>",
      "</section>",
    ].join("\n");
  }

  return renderTable(
    "Highest-signal changes",
    ["Focus area", "Why it matters", "Count", "Packages"],
    rows.map((row) => [row.label, row.reason, String(row.count), formatPackageList(row.entries)]),
  );
}

function renderBrandNew(entries: readonly ClassifiedDiffEntry[]): string {
  const brandNew = sortEntries(entries.filter((entry) => entry.kind === "brand-new"));
  if (brandNew.length === 0) {
    return emptyPanel("Brand-new packages", "None.");
  }

  return renderTable(
    "Brand-new packages",
    ["Scope", "Package", "Version", "Review note"],
    brandNew.map((entry) => [
      entry.dependencyScope,
      entry.packageName,
      entry.newVersion ?? "-",
      "New package name in the dependency graph",
    ]),
  );
}

function renderScopedChanges(
  title: string,
  scope: DependencyScope,
  entries: readonly ClassifiedDiffEntry[],
): string {
  const scopedEntries = sortEntries(entries.filter((entry) => entry.dependencyScope === scope));
  if (scopedEntries.length === 0) {
    return emptyPanel(title, "None.");
  }

  return renderTable(
    title,
    ["Change", "Package", "From", "To", "Review note"],
    scopedEntries.map((entry) => [
      entry.kind,
      entry.packageName,
      entry.oldVersion ?? "-",
      entry.newVersion ?? "-",
      getReviewNote(entry),
    ]),
  );
}

function renderNotes(): string {
  return [
    '<section class="panel muted" aria-labelledby="notes-title">',
    '<h2 id="notes-title">Notes</h2>',
    "<p>Brand-new means the package name did not appear anywhere in the previous lockfile.</p>",
    "<p>Direct means declared by a workspace in <code>bun.lock</code>; otherwise the package is treated as transitive.</p>",
    "</section>",
  ].join("\n");
}

function renderTable(
  title: string,
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const id = slugify(title);
  return [
    `<section class="panel" aria-labelledby="${id}">`,
    `<h2 id="${id}">${escapeHtml(title)}</h2>`,
    '<div class="table-wrap">',
    "<table>",
    `<caption>${escapeHtml(title)}</caption>`,
    "<thead>",
    `<tr>${headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join("")}</tr>`,
    "</thead>",
    "<tbody>",
    ...rows.map((row) => `<tr>${row.map((cell) => `<td>${formatCell(cell)}</td>`).join("")}</tr>`),
    "</tbody>",
    "</table>",
    "</div>",
    "</section>",
  ].join("\n");
}

function emptyPanel(title: string, body: string): string {
  const id = slugify(title);
  return [
    `<section class="panel" aria-labelledby="${id}">`,
    `<h2 id="${id}">${escapeHtml(title)}</h2>`,
    `<p>${escapeHtml(body)}</p>`,
    "</section>",
  ].join("\n");
}

function formatCell(value: string): string {
  if (value === "-") {
    return '<span class="empty">-</span>';
  }

  return `<code>${escapeHtml(value)}</code>`;
}

function countEntries(
  entries: readonly ClassifiedDiffEntry[],
  kind: ClassifiedChangeKind,
  scope: DependencyScope,
): number {
  return entries.filter((entry) => entry.kind === kind && entry.dependencyScope === scope).length;
}

function getTotals(entries: readonly ClassifiedDiffEntry[]): {
  readonly brandNew: number;
  readonly directChanges: number;
  readonly removed: number;
  readonly transitiveChanges: number;
} {
  return {
    brandNew: entries.filter((entry) => entry.kind === "brand-new").length,
    directChanges: entries.filter((entry) => entry.dependencyScope === "direct").length,
    removed: entries.filter((entry) => entry.kind === "removed").length,
    transitiveChanges: entries.filter((entry) => entry.dependencyScope === "transitive").length,
  };
}

function getHighlightRow(
  label: string,
  reason: string,
  entries: readonly ClassifiedDiffEntry[],
): {
  readonly label: string;
  readonly reason: string;
  readonly count: number;
  readonly entries: readonly ClassifiedDiffEntry[];
} {
  return {
    label,
    reason,
    count: entries.length,
    entries: sortEntries(entries),
  };
}

function formatPackageList(entries: readonly ClassifiedDiffEntry[]): string {
  const packages = entries.slice(0, 5).map((entry) => entry.packageName);
  const remaining = entries.length - packages.length;

  if (remaining > 0) {
    packages.push(`and ${remaining} more`);
  }

  return packages.join(", ");
}

function getReviewNote(entry: ClassifiedDiffEntry): string {
  if (entry.kind === "brand-new") {
    return "New package name in the dependency graph";
  }
  if (entry.kind === "version-changed") {
    return "Resolved version changed";
  }
  if (entry.kind === "added") {
    return "Additional resolved version for an existing package name";
  }
  return "Package version removed from the dependency graph";
}

function sortEntries(entries: readonly ClassifiedDiffEntry[]): ClassifiedDiffEntry[] {
  return [...entries].sort(
    (left, right) =>
      scopeRank(left.dependencyScope) - scopeRank(right.dependencyScope) ||
      kindRank(left.kind) - kindRank(right.kind) ||
      left.packageName.localeCompare(right.packageName) ||
      (left.oldVersion ?? "").localeCompare(right.oldVersion ?? "") ||
      (left.newVersion ?? "").localeCompare(right.newVersion ?? ""),
  );
}

function formatKind(kind: ClassifiedChangeKind): string {
  if (kind === "brand-new") {
    return "Brand-new";
  }
  if (kind === "version-changed") {
    return "Version changed";
  }
  return `${kind[0]?.toUpperCase() ?? ""}${kind.slice(1)}`;
}

function kindRank(kind: ClassifiedChangeKind): number {
  if (kind === "brand-new") {
    return 0;
  }
  if (kind === "version-changed") {
    return 1;
  }
  if (kind === "added") {
    return 2;
  }
  return 3;
}

function scopeRank(scope: DependencyScope): number {
  return scope === "direct" ? 0 : 1;
}

function slugify(value: string): string {
  return value.toLowerCase().replaceAll(" ", "-");
}

function css(): string {
  return `
:root {
  color-scheme: light;
  --bg: #f6f8fb;
  --panel: #ffffff;
  --ink: #172033;
  --muted: #5c667a;
  --line: #d9e0ea;
  --accent: #0f766e;
  --accent-soft: #e7f6f4;
  --warn: #9a3412;
  --warn-soft: #fff3e8;
  --code: #eef2f7;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.5;
}

code {
  background: var(--code);
  border-radius: 4px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 0.92em;
  padding: 0.12rem 0.28rem;
}

.shell {
  margin: 0 auto;
  max-width: 1180px;
  padding: 32px 20px 48px;
}

.hero {
  border-bottom: 1px solid var(--line);
  margin-bottom: 20px;
  padding-bottom: 20px;
}

.eyebrow {
  color: var(--accent);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin: 0 0 6px;
  text-transform: uppercase;
}

h1,
h2 {
  line-height: 1.15;
  margin: 0;
}

h1 {
  font-size: 2rem;
}

h2 {
  font-size: 1.2rem;
  margin-bottom: 14px;
}

.compare {
  color: var(--muted);
  margin: 10px 0 0;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  margin-top: 16px;
  padding: 18px;
}

.panel.success {
  border-color: #9bd4c4;
}

.panel.muted {
  color: var(--muted);
}

.focus-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin-bottom: 14px;
}

.metric {
  background: var(--accent-soft);
  border: 1px solid #b7dfd9;
  border-radius: 8px;
  padding: 12px;
}

.metric-label,
.metric-help {
  color: var(--muted);
  display: block;
  font-size: 0.82rem;
}

.metric strong {
  display: block;
  font-size: 1.8rem;
  margin: 2px 0;
}

.table-wrap {
  overflow-x: auto;
}

table {
  border-collapse: collapse;
  min-width: 760px;
  width: 100%;
}

caption {
  height: 1px;
  overflow: hidden;
  position: absolute;
  width: 1px;
}

th,
td {
  border-bottom: 1px solid var(--line);
  padding: 10px;
  text-align: left;
  vertical-align: top;
}

th {
  color: var(--muted);
  font-size: 0.78rem;
  text-transform: uppercase;
}

tr:last-child td {
  border-bottom: 0;
}

ul {
  margin: 0;
  padding-left: 1.2rem;
}

.empty {
  color: var(--muted);
}

@media print {
  body {
    background: #ffffff;
  }

  .shell {
    max-width: none;
    padding: 0;
  }

  .panel {
    break-inside: avoid;
  }
}
`;
}
