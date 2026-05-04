import type {
  ClassificationContext,
  ClassifiedDiffEntry,
  ClassifiedLockfileDiff,
  ClassifyLockfileError,
  DependencyScope,
  LockfileDiff,
  NormalizedLockfile,
  PackageName,
  Result,
} from "../types";

/**
 * Classifies raw diff entries into report-ready lockfile change entries.
 *
 * @example
 * ```ts
 * const classified = classifyDiff(diff, { oldLockfile, newLockfile });
 * if (classified.ok) {
 *   console.log(classified.value.entries[0]?.kind);
 * }
 * ```
 */
export function classifyDiff(
  diff: LockfileDiff,
  context: ClassificationContext,
): Result<ClassifiedLockfileDiff, ClassifyLockfileError> {
  const oldPackageNames = new Set(
    context.oldLockfile.packages.map((packageEntry) => packageEntry.name),
  );
  const entries: ClassifiedDiffEntry[] = [];

  for (const entry of diff.entries) {
    if (entry.kind === "added") {
      const isBrandNew = !oldPackageNames.has(entry.package.name);
      entries.push({
        kind: isBrandNew ? "brand-new" : "added",
        dependencyScope: getDependencyScope(context.newLockfile, entry.package.name),
        packageName: entry.package.name,
        newVersion: entry.package.version,
        newPackage: entry.package,
      });
      continue;
    }

    if (entry.kind === "removed") {
      entries.push({
        kind: "removed",
        dependencyScope: getDependencyScope(context.oldLockfile, entry.package.name),
        packageName: entry.package.name,
        oldVersion: entry.package.version,
        oldPackage: entry.package,
      });
      continue;
    }

    entries.push({
      kind: "version-changed",
      dependencyScope: getVersionChangedScope(context, entry.name),
      packageName: entry.name,
      oldVersion: entry.oldPackage.version,
      newVersion: entry.newPackage.version,
      oldPackage: entry.oldPackage,
      newPackage: entry.newPackage,
    });
  }

  return {
    ok: true,
    value: {
      entries: entries.sort(compareClassifiedEntries),
    },
  };
}

function getVersionChangedScope(
  context: ClassificationContext,
  packageName: PackageName,
): DependencyScope {
  if (
    getDependencyScope(context.oldLockfile, packageName) === "direct" ||
    getDependencyScope(context.newLockfile, packageName) === "direct"
  ) {
    return "direct";
  }

  return "transitive";
}

function getDependencyScope(
  lockfile: NormalizedLockfile,
  packageName: PackageName,
): DependencyScope {
  return lockfile.directDependencies.some((dependency) => dependency.name === packageName)
    ? "direct"
    : "transitive";
}

function compareClassifiedEntries(left: ClassifiedDiffEntry, right: ClassifiedDiffEntry): number {
  return (
    kindRank(left.kind) - kindRank(right.kind) ||
    scopeRank(left.dependencyScope) - scopeRank(right.dependencyScope) ||
    left.packageName.localeCompare(right.packageName) ||
    (left.oldVersion ?? "").localeCompare(right.oldVersion ?? "") ||
    (left.newVersion ?? "").localeCompare(right.newVersion ?? "")
  );
}

function kindRank(kind: ClassifiedDiffEntry["kind"]): number {
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
