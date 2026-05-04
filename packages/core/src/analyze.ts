import { classifyDiff } from "./classifier";
import { diffLockfiles } from "./diff";
import { parseBunLockfile } from "./parsers/bun";
import type {
  AnalyzeBunLockfileChangeOptions,
  AnalyzeLockfileChangeError,
  ClassifiedLockfileDiff,
  Result,
} from "./types";

/**
 * Parses, diffs, and classifies two Bun lockfile sources in one pure operation.
 *
 * @example
 * ```ts
 * const result = analyzeBunLockfileChange(oldLock, newLock);
 * if (result.ok) {
 *   console.log(result.value.entries.length);
 * }
 * ```
 */
export function analyzeBunLockfileChange(
  oldSource: string,
  newSource: string,
  options: AnalyzeBunLockfileChangeOptions = {},
): Result<ClassifiedLockfileDiff, AnalyzeLockfileChangeError> {
  const oldLockfile = parseBunLockfile(oldSource, parseOptions(options.oldSourceName));
  if (!oldLockfile.ok) {
    return {
      ok: false,
      error: {
        stage: "parse-old",
        error: oldLockfile.error,
      },
    };
  }

  const newLockfile = parseBunLockfile(newSource, parseOptions(options.newSourceName));
  if (!newLockfile.ok) {
    return {
      ok: false,
      error: {
        stage: "parse-new",
        error: newLockfile.error,
      },
    };
  }

  const diff = diffLockfiles(oldLockfile.value, newLockfile.value);
  if (!diff.ok) {
    return {
      ok: false,
      error: {
        stage: "diff",
        error: diff.error,
      },
    };
  }

  const classified = classifyDiff(diff.value, {
    oldLockfile: oldLockfile.value,
    newLockfile: newLockfile.value,
  });
  if (!classified.ok) {
    return {
      ok: false,
      error: {
        stage: "classify",
        error: classified.error,
      },
    };
  }

  return classified;
}

function parseOptions(sourceName: string | undefined): { readonly sourceName?: string } {
  return sourceName ? { sourceName } : {};
}
