import { type ParseError, parse, printParseErrorCode } from "jsonc-parser";
import type {
  DependencyKind,
  DependencyReference,
  DirectDependency,
  JsoncDiagnostic,
  NormalizedLockfile,
  NormalizedPackage,
  PackageName,
  PackageVersion,
  ParseBunLockfileError,
  ParseBunLockfileOptions,
  Result,
} from "../types";

const dependencyKinds: readonly DependencyKind[] = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
];

/**
 * Parses a Bun 1.2+ JSONC `bun.lock` file into lockfile-lens' normalized model.
 *
 * @example
 * ```ts
 * const result = parseBunLockfile(lockfileText);
 * if (result.ok) {
 *   console.log(result.value.packages.length);
 * }
 * ```
 */
export function parseBunLockfile(
  source: string,
  options: ParseBunLockfileOptions = {},
): Result<NormalizedLockfile, ParseBunLockfileError> {
  const errors: ParseError[] = [];
  const parsed: unknown = parse(source, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  if (errors.length > 0) {
    return {
      ok: false,
      error: {
        code: "INVALID_JSONC",
        message: `Invalid JSONC in ${options.sourceName ?? "bun.lock"}.`,
        diagnostics: errors.map((error) => toDiagnostic(source, error)),
      },
    };
  }

  if (!isRecord(parsed)) {
    return unsupported("Root lockfile value must be an object.", "$");
  }

  const lockfileVersion = parsed.lockfileVersion;
  if (typeof lockfileVersion !== "number") {
    return unsupported("Expected numeric lockfileVersion.", "$.lockfileVersion");
  }

  const packagesValue = parsed.packages;
  if (!isRecord(packagesValue)) {
    return unsupported("Expected packages to be an object.", "$.packages");
  }

  const workspacesValue = parsed.workspaces;
  const directDependencies = isRecord(workspacesValue)
    ? parseDirectDependencies(workspacesValue)
    : [];

  const packages: NormalizedPackage[] = [];
  for (const [rawKey, packageValue] of Object.entries(packagesValue)) {
    const packageResult = parsePackageEntry(rawKey, packageValue);
    if (!packageResult.ok) {
      return packageResult;
    }
    packages.push(packageResult.value);
  }

  return {
    ok: true,
    value: {
      lockfileVersion,
      packages: packages.sort(comparePackages),
      directDependencies: directDependencies.sort(compareDirectDependencies),
    },
  };
}

function parsePackageEntry(
  rawKey: string,
  packageValue: unknown,
): Result<NormalizedPackage, ParseBunLockfileError> {
  if (!Array.isArray(packageValue)) {
    return unsupported("Expected package entry to be a tuple array.", `$.packages.${rawKey}`);
  }

  const resolution = findFirstString(packageValue);
  const metadata = findFirstRecord(packageValue);
  const parsedIdentity = parsePackageIdentity(rawKey, resolution);
  if (!parsedIdentity.ok) {
    return parsedIdentity;
  }

  const dependencies = metadata ? parseDependencyReferences(metadata.dependencies) : [];
  const peerDependencies = metadata ? parseDependencyReferences(metadata.peerDependencies) : [];
  const optionalDependencies = metadata
    ? parseDependencyReferences(metadata.optionalDependencies)
    : [];

  const name = parsedIdentity.value.name;
  const version = parsedIdentity.value.version;

  return {
    ok: true,
    value: {
      id: `${name}@${version}`,
      name,
      version,
      rawKey,
      dependencies,
      peerDependencies,
      optionalDependencies,
      ...(resolution ? { resolution } : {}),
    },
  };
}

function parseDirectDependencies(workspaces: Record<string, unknown>): DirectDependency[] {
  const directDependencies: DirectDependency[] = [];

  for (const [workspacePath, workspaceValue] of Object.entries(workspaces)) {
    if (!isRecord(workspaceValue)) {
      continue;
    }

    for (const dependencyKind of dependencyKinds) {
      const dependencies = workspaceValue[dependencyKind];
      if (!isRecord(dependencies)) {
        continue;
      }

      for (const [name, specifier] of Object.entries(dependencies)) {
        if (typeof specifier === "string") {
          directDependencies.push({
            name,
            specifier,
            dependencyKind,
            workspacePath,
          });
        }
      }
    }
  }

  return directDependencies;
}

function parseDependencyReferences(value: unknown): DependencyReference[] {
  if (!isRecord(value)) {
    return [];
  }

  const dependencies: DependencyReference[] = [];
  for (const [name, specifier] of Object.entries(value)) {
    if (typeof specifier === "string") {
      dependencies.push({ name, specifier });
    }
  }

  return dependencies.sort(compareDependencyReferences);
}

function parsePackageIdentity(
  rawKey: string,
  resolution: string | undefined,
): Result<{ readonly name: PackageName; readonly version: PackageVersion }, ParseBunLockfileError> {
  const keyName = parseNameFromSpecifier(rawKey).name;
  const resolutionParts = resolution ? parseNameFromSpecifier(resolution) : undefined;
  const versionFromResolution = resolutionParts?.version;
  const versionFromKey = parseNameFromSpecifier(rawKey).version;
  const version = versionFromResolution ?? versionFromKey;

  if (!keyName) {
    return unsupported("Could not infer package name.", `$.packages.${rawKey}`);
  }

  if (!version) {
    return unsupported("Could not infer resolved package version.", `$.packages.${rawKey}`);
  }

  return {
    ok: true,
    value: {
      name: keyName,
      version,
    },
  };
}

function parseNameFromSpecifier(specifier: string): {
  readonly name: string;
  readonly version?: string;
} {
  const normalized = specifier.startsWith("npm:") ? specifier.slice(4) : specifier;
  const separatorIndex = findPackageVersionSeparator(normalized);

  if (separatorIndex === -1) {
    return { name: normalized };
  }

  const name = normalized.slice(0, separatorIndex);
  const version = normalized.slice(separatorIndex + 1);
  return version ? { name, version } : { name };
}

function findPackageVersionSeparator(specifier: string): number {
  if (specifier.startsWith("@")) {
    const slashIndex = specifier.indexOf("/");
    if (slashIndex === -1) {
      return -1;
    }
    return specifier.indexOf("@", slashIndex);
  }

  return specifier.indexOf("@");
}

function findFirstString(values: readonly unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function findFirstRecord(values: readonly unknown[]): Record<string, unknown> | undefined {
  for (const value of values) {
    if (isRecord(value)) {
      return value;
    }
  }

  return undefined;
}

function toDiagnostic(source: string, error: ParseError): JsoncDiagnostic {
  const position = getLineAndColumn(source, error.offset);
  return {
    message: printParseErrorCode(error.error),
    line: position.line,
    column: position.column,
    offset: error.offset,
  };
}

function getLineAndColumn(
  source: string,
  offset: number,
): { readonly line: number; readonly column: number } {
  let line = 1;
  let column = 1;

  for (let index = 0; index < offset; index += 1) {
    if (source[index] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
}

function unsupported(message: string, path: string): Result<never, ParseBunLockfileError> {
  return {
    ok: false,
    error: {
      code: "UNSUPPORTED_LOCKFILE_SHAPE",
      message,
      path,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function comparePackages(left: NormalizedPackage, right: NormalizedPackage): number {
  return left.name.localeCompare(right.name) || left.version.localeCompare(right.version);
}

function compareDependencyReferences(
  left: DependencyReference,
  right: DependencyReference,
): number {
  return left.name.localeCompare(right.name) || left.specifier.localeCompare(right.specifier);
}

function compareDirectDependencies(left: DirectDependency, right: DirectDependency): number {
  return (
    left.workspacePath.localeCompare(right.workspacePath) ||
    left.dependencyKind.localeCompare(right.dependencyKind) ||
    left.name.localeCompare(right.name)
  );
}
