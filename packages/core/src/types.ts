export type Result<TValue, TError> =
  | {
      ok: true;
      value: TValue;
    }
  | {
      ok: false;
      error: TError;
    };

export type PackageId = string;
export type PackageName = string;
export type PackageVersion = string;
export type PackageResolution = string;

export type DependencyKind = "dependencies" | "devDependencies" | "peerDependencies";
export type DependencyScope = "direct" | "transitive";

export interface DependencyReference {
  readonly name: PackageName;
  readonly specifier: string;
}

export interface DirectDependency extends DependencyReference {
  readonly dependencyKind: DependencyKind;
  readonly workspacePath: string;
}

export interface NormalizedPackage {
  readonly id: PackageId;
  readonly name: PackageName;
  readonly version: PackageVersion;
  readonly rawKey: string;
  readonly dependencies: readonly DependencyReference[];
  readonly peerDependencies: readonly DependencyReference[];
  readonly optionalDependencies: readonly DependencyReference[];
  readonly resolution?: PackageResolution;
}

export interface NormalizedLockfile {
  readonly lockfileVersion: number;
  readonly packages: readonly NormalizedPackage[];
  readonly directDependencies: readonly DirectDependency[];
}

export interface JsoncDiagnostic {
  readonly message: string;
  readonly line: number;
  readonly column: number;
  readonly offset: number;
}

export type ParseBunLockfileError =
  | {
      readonly code: "INVALID_JSONC";
      readonly message: string;
      readonly diagnostics: readonly JsoncDiagnostic[];
    }
  | {
      readonly code: "UNSUPPORTED_LOCKFILE_SHAPE";
      readonly message: string;
      readonly path: string;
    };

export interface ParseBunLockfileOptions {
  readonly sourceName?: string;
}

export interface LockfileDiff {
  readonly entries: readonly LockfileDiffEntry[];
}

export type LockfileDiffEntry =
  | {
      readonly kind: "added";
      readonly package: NormalizedPackage;
    }
  | {
      readonly kind: "removed";
      readonly package: NormalizedPackage;
    }
  | {
      readonly kind: "version-changed";
      readonly name: PackageName;
      readonly oldPackage: NormalizedPackage;
      readonly newPackage: NormalizedPackage;
    };

export type DiffLockfileError = {
  readonly code: "DIFF_FAILED";
  readonly message: string;
};

export type ClassifiedChangeKind = "added" | "removed" | "version-changed" | "brand-new";

export interface ClassifiedDiffEntry {
  readonly kind: ClassifiedChangeKind;
  readonly dependencyScope: DependencyScope;
  readonly packageName: PackageName;
  readonly oldVersion?: PackageVersion;
  readonly newVersion?: PackageVersion;
  readonly oldPackage?: NormalizedPackage;
  readonly newPackage?: NormalizedPackage;
}

export interface ClassifiedLockfileDiff {
  readonly entries: readonly ClassifiedDiffEntry[];
}

export interface ClassificationContext {
  readonly oldLockfile: NormalizedLockfile;
  readonly newLockfile: NormalizedLockfile;
}

export type ClassifyLockfileError = {
  readonly code: "CLASSIFICATION_FAILED";
  readonly message: string;
};

export interface AnalyzeBunLockfileChangeOptions {
  readonly oldSourceName?: string;
  readonly newSourceName?: string;
}

export type AnalyzeLockfileChangeError =
  | {
      readonly stage: "parse-old";
      readonly error: ParseBunLockfileError;
    }
  | {
      readonly stage: "parse-new";
      readonly error: ParseBunLockfileError;
    }
  | {
      readonly stage: "diff";
      readonly error: DiffLockfileError;
    }
  | {
      readonly stage: "classify";
      readonly error: ClassifyLockfileError;
    };
