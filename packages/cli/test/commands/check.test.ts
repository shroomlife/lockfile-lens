import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { runCheck } from "../../src/commands/check-runner";

const outputDirectory = join(import.meta.dir, "tmp-output");
const workspaceRoot = join(import.meta.dir, "..", "..", "..", "..");

afterEach(() => {
  if (existsSync(outputDirectory)) {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});

describe("check command", () => {
  test("writes an HTML report while keeping markdown on stdout", async () => {
    const outputPath = join(outputDirectory, "lockfile-lens.html");
    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runCheck({
      oldLockfilePath: join(workspaceRoot, "examples", "old.bun.lock"),
      newLockfilePath: join(workspaceRoot, "examples", "new.bun.lock"),
      format: "markdown",
      htmlOutput: outputPath,
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    });

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout.join("\n")).toContain("## lockfile-lens report");
    expect(stdout.join("\n")).toContain("### Review focus");
    expect(existsSync(outputPath)).toBe(true);
    expect(readFileSync(outputPath, "utf8")).toContain("<!doctype html>");
  });

  test("writes selected HTML output without stdout content", async () => {
    const outputPath = join(outputDirectory, "selected.html");
    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runCheck({
      oldLockfilePath: join(workspaceRoot, "examples", "old.bun.lock"),
      newLockfilePath: join(workspaceRoot, "examples", "new.bun.lock"),
      format: "html",
      output: outputPath,
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    });

    expect(exitCode).toBe(0);
    expect(stdout).toEqual([]);
    expect(stderr).toEqual([]);
    expect(readFileSync(outputPath, "utf8")).toContain("Lockfile review report");
  });
});
