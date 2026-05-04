import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { type AnalyzeLockfileChangeError, analyzeBunLockfileChange } from "@lockfile-lens/core";
import { renderHtmlReport } from "../render/html";
import { renderMarkdownReport } from "../render/markdown";

type ReportFormat = "markdown" | "html";

export interface CheckCommandOptions {
  readonly oldLockfilePath: string;
  readonly newLockfilePath: string;
  readonly format: string;
  readonly output?: string;
  readonly htmlOutput?: string;
  readonly stdout?: (message: string) => void;
  readonly stderr?: (message: string) => void;
}

type CliResult<TValue> =
  | {
      readonly ok: true;
      readonly value: TValue;
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

export async function runCheck(options: CheckCommandOptions): Promise<number> {
  const stdout = options.stdout ?? console.log;
  const stderr = options.stderr ?? console.error;
  const oldLockfilePath = options.oldLockfilePath;
  const newLockfilePath = options.newLockfilePath;

  const fail = (message: string): number => {
    stderr(`lockfile-lens: ${message}`);
    return 1;
  };

  const oldSource = await readLockfile(oldLockfilePath);
  if (!oldSource.ok) {
    return fail(oldSource.error);
  }

  const newSource = await readLockfile(newLockfilePath);
  if (!newSource.ok) {
    return fail(newSource.error);
  }

  const result = analyzeBunLockfileChange(oldSource.value, newSource.value, {
    oldSourceName: oldLockfilePath,
    newSourceName: newLockfilePath,
  });
  if (!result.ok) {
    return fail(formatAnalyzeError(result.error));
  }

  const renderOptions = {
    oldLockfilePath,
    newLockfilePath,
  };
  const format = parseReportFormat(options.format);
  if (!format.ok) {
    return fail(format.error);
  }

  if (options.htmlOutput) {
    const writeResult = await writeReportFile(
      options.htmlOutput,
      renderHtmlReport(result.value, renderOptions),
    );
    if (!writeResult.ok) {
      return fail(writeResult.error);
    }
  }

  const primaryReport =
    format.value === "html"
      ? renderHtmlReport(result.value, renderOptions)
      : renderMarkdownReport(result.value, renderOptions);

  if (options.output && options.output !== "-") {
    const writeResult = await writeReportFile(options.output, primaryReport);
    if (!writeResult.ok) {
      return fail(writeResult.error);
    }
    return 0;
  }

  stdout(primaryReport);
  return 0;
}

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

async function writeReportFile(path: string, report: string): Promise<CliResult<void>> {
  try {
    const resolvedPath = resolve(path);
    await mkdir(dirname(resolvedPath), { recursive: true });
    await writeFile(resolvedPath, report, "utf8");
    return {
      ok: true,
      value: undefined,
    };
  } catch (error) {
    return {
      ok: false,
      error: `Could not write ${path}: ${formatUnknownError(error)}`,
    };
  }
}

function parseReportFormat(format: string): CliResult<ReportFormat> {
  if (format === "markdown" || format === "html") {
    return {
      ok: true,
      value: format,
    };
  }

  return {
    ok: false,
    error: `Unsupported report format "${format}". Expected "markdown" or "html".`,
  };
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
