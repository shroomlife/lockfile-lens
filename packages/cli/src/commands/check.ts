import { readFile } from "node:fs/promises";
import { type AnalyzeLockfileChangeError, analyzeBunLockfileChange } from "@lockfile-lens/core";
import { defineCommand } from "citty";
import { renderMarkdownReport } from "../render/markdown";

export const checkCommand = defineCommand({
  meta: {
    name: "check",
    description: "Compare two Bun lockfiles and print a markdown changelog",
  },
  args: {
    oldLockfile: {
      type: "positional",
      required: true,
      description: "Previous bun.lock file",
    },
    newLockfile: {
      type: "positional",
      required: true,
      description: "Current bun.lock file",
    },
  },
  async run({ args }) {
    const oldLockfilePath = args.oldLockfile;
    const newLockfilePath = args.newLockfile;

    const oldSource = await readLockfile(oldLockfilePath);
    if (!oldSource.ok) {
      reportCliError(oldSource.error);
      return;
    }

    const newSource = await readLockfile(newLockfilePath);
    if (!newSource.ok) {
      reportCliError(newSource.error);
      return;
    }

    const result = analyzeBunLockfileChange(oldSource.value, newSource.value, {
      oldSourceName: oldLockfilePath,
      newSourceName: newLockfilePath,
    });
    if (!result.ok) {
      reportCliError(formatAnalyzeError(result.error));
      return;
    }

    console.log(
      renderMarkdownReport(result.value, {
        oldLockfilePath,
        newLockfilePath,
      }),
    );
  },
});

type CliResult<TValue> =
  | {
      readonly ok: true;
      readonly value: TValue;
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

async function readLockfile(path: string): Promise<CliResult<string>> {
  try {
    return {
      ok: true,
      value: await readFile(path, "utf8"),
    };
  } catch (error) {
    return {
      ok: false,
      error: `Could not read ${path}: ${formatUnknownError(error)}`,
    };
  }
}

function reportCliError(message: string): void {
  console.error(`lockfile-lens: ${message}`);
  process.exitCode = 1;
}

function formatAnalyzeError(error: AnalyzeLockfileChangeError): string {
  if (error.error.code === "INVALID_JSONC") {
    const diagnostics = error.error.diagnostics
      .map((diagnostic) => `${diagnostic.line}:${diagnostic.column} ${diagnostic.message}`)
      .join("; ");
    return `${error.stage}: ${error.error.message} ${diagnostics}`;
  }

  return `${error.stage}: ${error.error.message}`;
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
