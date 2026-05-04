import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseBunLockfile } from "../../src";

const fixturePath = join(import.meta.dir, "..", "fixtures", "real-shaped", "old.bun.lock");

describe("parseBunLockfile", () => {
  test("normalizes Bun JSONC lockfile packages and direct dependencies", () => {
    const source = readFileSync(fixturePath, "utf8");
    const result = parseBunLockfile(source, { sourceName: fixturePath });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.lockfileVersion).toBe(1);
    expect(result.value.packages.map((packageEntry) => packageEntry.id)).toContain("elysia@1.2.10");
    expect(
      result.value.packages.find((packageEntry) => packageEntry.name === "elysia")?.dependencies,
    ).toEqual([
      {
        name: "cookie",
        specifier: "^0.6.0",
      },
    ]);
    expect(result.value.directDependencies).toEqual([
      {
        dependencyKind: "dependencies",
        name: "elysia",
        specifier: "^1.2.10",
        workspacePath: "",
      },
      {
        dependencyKind: "dependencies",
        name: "kept-direct",
        specifier: "^1.0.0",
        workspacePath: "",
      },
      {
        dependencyKind: "devDependencies",
        name: "vitest",
        specifier: "^2.0.0",
        workspacePath: "",
      },
      {
        dependencyKind: "peerDependencies",
        name: "typescript",
        specifier: "^5.6.2",
        workspacePath: "",
      },
    ]);
  });

  test("returns typed JSONC diagnostics", () => {
    const result = parseBunLockfile("{", { sourceName: "broken.bun.lock" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    if (result.error.code !== "INVALID_JSONC") {
      throw new Error(`Expected INVALID_JSONC, received ${result.error.code}`);
    }

    expect(result.error.diagnostics[0]?.line).toBe(1);
  });
});
