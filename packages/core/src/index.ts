export { analyzeBunLockfileChange } from "./analyze";
export { classifyDiff } from "./classifier";
export { diffLockfiles } from "./diff";
export { parseBunLockfile } from "./parsers/bun";

export type {
  AnalyzeBunLockfileChangeOptions,
  AnalyzeLockfileChangeError,
  ClassificationContext,
  ClassifiedChangeKind,
  ClassifiedDiffEntry,
  ClassifiedLockfileDiff,
  ClassifyLockfileError,
  DependencyKind,
  DependencyReference,
  DependencyScope,
  DiffLockfileError,
  DirectDependency,
  JsoncDiagnostic,
  LockfileDiff,
  LockfileDiffEntry,
  NormalizedLockfile,
  NormalizedPackage,
  PackageId,
  PackageName,
  PackageResolution,
  PackageVersion,
  ParseBunLockfileError,
  ParseBunLockfileOptions,
  Result,
} from "./types";
