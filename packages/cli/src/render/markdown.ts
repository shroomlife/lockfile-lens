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
      "No dependency changes detected.",
      "",
    ].join("\n");
  }

  return [
    "## lockfile-lens report",
    "",
    `Compared \`${options.oldLockfilePath}\` -> \`${options.newLockfilePath}\`.`,
    "",
    renderSummary(diff.entries),
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
    "### Summary",
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

function renderBrandNewSection(entries: readonly ClassifiedDiffEntry[]): string {
  const brandNewEntries = sortEntries(entries.filter((entry) => entry.kind === "brand-new"));
  if (brandNewEntries.length === 0) {
    return ["### Brand-new packages", "", "None.", ""].join("\n");
  }

  const lines = ["### Brand-new packages", "", "| Scope | Package | Version |", "|---|---|---|"];

  for (const entry of brandNewEntries) {
    lines.push(
      `| ${entry.dependencyScope} | \`${escapeCell(entry.packageName)}\` | ${formatVersion(entry.newVersion)} |`,
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

  const lines = [`### ${title}`, "", "| Change | Package | From | To |", "|---|---|---|---|"];

  for (const entry of scopedEntries) {
    lines.push(
      `| ${entry.kind} | \`${escapeCell(entry.packageName)}\` | ${formatVersion(entry.oldVersion)} | ${formatVersion(entry.newVersion)} |`,
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
