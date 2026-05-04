import type {
  DiffLockfileError,
  LockfileDiff,
  LockfileDiffEntry,
  NormalizedLockfile,
  NormalizedPackage,
  Result,
} from "../types";

/**
 * Computes the semantic package-level diff between two normalized lockfiles.
 *
 * @example
 * ```ts
 * const diff = diffLockfiles(oldLockfile, newLockfile);
 * if (diff.ok) {
 *   console.log(diff.value.entries);
 * }
 * ```
 */
export function diffLockfiles(
  oldLockfile: NormalizedLockfile,
  newLockfile: NormalizedLockfile,
): Result<LockfileDiff, DiffLockfileError> {
  const oldPackages = groupByNameAndVersion(oldLockfile.packages);
  const newPackages = groupByNameAndVersion(newLockfile.packages);
  const packageNames = sortedUnion(oldPackages.keys(), newPackages.keys());
  const entries: LockfileDiffEntry[] = [];

  for (const packageName of packageNames) {
    const oldVersions = oldPackages.get(packageName) ?? new Map<string, NormalizedPackage>();
    const newVersions = newPackages.get(packageName) ?? new Map<string, NormalizedPackage>();
    const removedVersions = sortedDifference(oldVersions.keys(), newVersions.keys());
    const addedVersions = sortedDifference(newVersions.keys(), oldVersions.keys());

    while (removedVersions.length > 0 && addedVersions.length > 0) {
      const oldVersion = removedVersions.shift();
      const newVersion = addedVersions.shift();
      if (oldVersion === undefined || newVersion === undefined) {
        continue;
      }

      const oldPackage = oldVersions.get(oldVersion);
      const newPackage = newVersions.get(newVersion);
      if (oldPackage && newPackage) {
        entries.push({
          kind: "version-changed",
          name: packageName,
          oldPackage,
          newPackage,
        });
      }
    }

    for (const version of addedVersions) {
      const packageEntry = newVersions.get(version);
      if (packageEntry) {
        entries.push({ kind: "added", package: packageEntry });
      }
    }

    for (const version of removedVersions) {
      const packageEntry = oldVersions.get(version);
      if (packageEntry) {
        entries.push({ kind: "removed", package: packageEntry });
      }
    }
  }

  return {
    ok: true,
    value: {
      entries: entries.sort(compareDiffEntries),
    },
  };
}

function groupByNameAndVersion(
  packages: readonly NormalizedPackage[],
): Map<string, Map<string, NormalizedPackage>> {
  const grouped = new Map<string, Map<string, NormalizedPackage>>();

  for (const packageEntry of packages) {
    const versions = grouped.get(packageEntry.name) ?? new Map<string, NormalizedPackage>();
    if (!versions.has(packageEntry.version)) {
      versions.set(packageEntry.version, packageEntry);
    }
    grouped.set(packageEntry.name, versions);
  }

  return grouped;
}

function sortedUnion(left: Iterable<string>, right: Iterable<string>): string[] {
  return Array.from(new Set([...left, ...right])).sort((a, b) => a.localeCompare(b));
}

function sortedDifference(left: Iterable<string>, right: Iterable<string>): string[] {
  const rightSet = new Set(right);
  return Array.from(left)
    .filter((value) => !rightSet.has(value))
    .sort((a, b) => a.localeCompare(b));
}

function compareDiffEntries(left: LockfileDiffEntry, right: LockfileDiffEntry): number {
  return (
    getEntryPackageName(left).localeCompare(getEntryPackageName(right)) ||
    getEntryVersion(left).localeCompare(getEntryVersion(right)) ||
    left.kind.localeCompare(right.kind)
  );
}

function getEntryPackageName(entry: LockfileDiffEntry): string {
  return entry.kind === "version-changed" ? entry.name : entry.package.name;
}

function getEntryVersion(entry: LockfileDiffEntry): string {
  if (entry.kind === "version-changed") {
    return `${entry.oldPackage.version}->${entry.newPackage.version}`;
  }

  return entry.package.version;
}
