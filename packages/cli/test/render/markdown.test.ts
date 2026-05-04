import { describe, expect, test } from "bun:test";
import type { ClassifiedLockfileDiff } from "@lockfile-lens/core";
import { renderMarkdownReport } from "../../src/render/markdown";

describe("renderMarkdownReport", () => {
  test("renders summary and review-focused sections", () => {
    const report = renderMarkdownReport(
      {
        entries: [
          {
            kind: "brand-new",
            dependencyScope: "direct",
            packageName: "new-direct",
            newVersion: "1.0.0",
          },
          {
            kind: "version-changed",
            dependencyScope: "transitive",
            packageName: "cookie",
            oldVersion: "0.6.0",
            newVersion: "0.7.0",
          },
        ],
      },
      {
        oldLockfilePath: "old.bun.lock",
        newLockfilePath: "new.bun.lock",
      },
    );

    expect(report).toContain("| Brand-new | 1 | 0 | 1 |");
    expect(report).toContain("| Version changed | 0 | 1 | 1 |");
    expect(report).toContain("### Brand-new packages");
    expect(report).toContain("| direct | `new-direct` | `1.0.0` |");
    expect(report).toContain("| version-changed | `cookie` | `0.6.0` | `0.7.0` |");
  });

  test("renders a clear empty state", () => {
    const diff: ClassifiedLockfileDiff = { entries: [] };
    const report = renderMarkdownReport(diff, {
      oldLockfilePath: "old.bun.lock",
      newLockfilePath: "new.bun.lock",
    });

    expect(report).toContain("No dependency changes detected.");
  });
});
