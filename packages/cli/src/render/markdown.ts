import type {
  ClassifiedChangeKind,
  ClassifiedDiffEntry,
  ClassifiedLockfileDiff,
  DependencyScope,
} from "@lockfile-lens/core";

export interface RenderMarkdownReportOptions {
  readonly oldLockfilePath: string;
  readonly newLockfilePath: string;
}

const changeKinds: readonly ClassifiedChangeKind[] = [
  "brand-new",
  "added",
  "removed",
  "version-changed",
];

export function renderMarkdownReport(
  diff: ClassifiedLockfileDiff,
  options: RenderMarkdownReportOptions,
): string {
  if (diff.entries.length === 0) {
    return [
      "## lockfile-lens report",
      "",
      `Compared \`${options.oldLockfilePath}\` -> \`${options.newLockfilePath}\`.`,
      "",
      "**No dependency changes detected.**",
      "",
      "No package additions, removals, version changes, or brand-new package names were found.",
      "",
    ].join("\n");
  }

  return [
    "## lockfile-lens report",
    "",
    `Compared \`${options.oldLockfilePath}\` -> \`${options.newLockfilePath}\`.`,
    "",
    renderReviewFocus(diff.entries),
    "",
    renderSummary(diff.entries),
    "",
    renderReviewerChecklist(diff.entries),
    "",
    renderHighlights(diff.entries),
    "",
    renderBrandNewSection(diff.entries),
    "",
    renderScopedSection("Direct dependency changes", "direct", diff.entries),
    "",
    renderScopedSection("Transitive dependency changes", "transitive", diff.entries),
    "",
    "### Notes",
    "",
    "Brand-new means the package name did not appear anywhere in the previous lockfile.",
    "Direct means declared by a workspace in `bun.lock`; otherwise the package is treated as transitive.",
    "",
  ].join("\n");
}

function renderSummary(entries: readonly ClassifiedDiffEntry[]): string {
  const lines = [
    "### Change totals",
    "",
    "| Change | Direct | Transitive | Total |",
    "|---|---:|---:|---:|",
  ];

  for (const kind of changeKinds) {
    const direct = countEntries(entries, kind, "direct");
    const transitive = countEntries(entries, kind, "transitive");
    lines.push(`| ${formatKind(kind)} | ${direct} | ${transitive} | ${direct + transitive} |`);
  }

  return lines.join("\n");
}

function renderReviewFocus(entries: readonly ClassifiedDiffEntry[]): string {
  const totals = getTotals(entries);
  const lines = [
    "### Review focus",
    "",
    `This lockfile update changes **${entries.length} package ${entries.length === 1 ? "entry" : "entries"}**.`,
  ];

  if (totals.brandNew > 0) {
    lines.push(
      `Start with **${totals.brandNew} brand-new ${pluralize("package name", "package names", totals.brandNew)}**, because each one creates a new dependency trust relationship.`,
    );
  }

  if (totals.directChanges > 0) {
    lines.push(
      `Then review **${totals.directChanges} direct dependency ${pluralize("change", "changes", totals.directChanges)}**, because ${totals.directChanges === 1 ? "it came" : "these came"} from workspace declarations.`,
    );
  }

  if (totals.removed > 0) {
    lines.push(
      `Finally confirm **${totals.removed} removed package ${pluralize("entry", "entries", totals.removed)}** ${totals.removed === 1 ? "is" : "are"} expected.`,
    );
  }

  lines.push("No registry calls were made; this report is based only on the two lockfiles.");

  return lines.join("\n");
}

function renderReviewerChecklist(entries: readonly ClassifiedDiffEntry[]): string {
  const totals = getTotals(entries);
  const checklist = ["### Reviewer checklist", ""];

  checklist.push(
    `- Brand-new packages expected: ${totals.brandNew > 0 ? "review required" : "none found"}.`,
  );
  checklist.push(
    `- Direct dependency changes expected: ${totals.directChanges > 0 ? "review required" : "none found"}.`,
  );
  checklist.push(
    `- Transitive dependency churn understood: ${totals.transitiveChanges > 0 ? "review recommended" : "none found"}.`,
  );
  checklist.push(`- Removals expected: ${totals.removed > 0 ? "review required" : "none found"}.`);

  return checklist.join("\n");
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
    return ["### Highest-signal changes", "", "No high-signal review categories found."].join("\n");
  }

  const lines = [
    "### Highest-signal changes",
    "",
    "| Focus area | Why it matters | Count | Packages |",
    "|---|---|---:|---|",
  ];

  for (const row of rows) {
    lines.push(
      `| ${row.label} | ${row.reason} | ${row.count} | ${formatPackageList(row.entries)} |`,
    );
  }

  return lines.join("\n");
}

function renderBrandNewSection(entries: readonly ClassifiedDiffEntry[]): string {
  const brandNewEntries = sortEntries(entries.filter((entry) => entry.kind === "brand-new"));
  if (brandNewEntries.length === 0) {
    return ["### Brand-new packages", "", "None.", ""].join("\n");
  }

  const lines = [
    "### Brand-new packages",
    "",
    "| Scope | Package | Version | Review note |",
    "|---|---|---|---|",
  ];

  for (const entry of brandNewEntries) {
    lines.push(
      `| ${entry.dependencyScope} | \`${escapeCell(entry.packageName)}\` | ${formatVersion(entry.newVersion)} | New package name in the dependency graph |`,
    );
  }

  return lines.join("\n");
}

function renderScopedSection(
  title: string,
  scope: DependencyScope,
  entries: readonly ClassifiedDiffEntry[],
): string {
  const scopedEntries = sortEntries(entries.filter((entry) => entry.dependencyScope === scope));
  if (scopedEntries.length === 0) {
    return [`### ${title}`, "", "None.", ""].join("\n");
  }

  const lines = [
    `### ${title}`,
    "",
    "| Change | Package | From | To | Review note |",
    "|---|---|---|---|---|",
  ];

  for (const entry of scopedEntries) {
    lines.push(
      `| ${entry.kind} | \`${escapeCell(entry.packageName)}\` | ${formatVersion(entry.oldVersion)} | ${formatVersion(entry.newVersion)} | ${getReviewNote(entry)} |`,
    );
  }

  return lines.join("\n");
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
  const packages = entries.slice(0, 5).map((entry) => `\`${escapeCell(entry.packageName)}\``);
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

function formatVersion(version: string | undefined): string {
  return version ? `\`${escapeCell(version)}\`` : "-";
}

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|");
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

function pluralize(singular: string, plural: string, count: number): string {
  return count === 1 ? singular : plural;
}
