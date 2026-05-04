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

    expect(report).toContain("### Review focus");
    expect(report).toContain("This lockfile update changes **2 package entries**.");
    expect(report).toContain("### Change totals");
    expect(report).toContain("| Brand-new | 1 | 0 | 1 |");
    expect(report).toContain("| Version changed | 0 | 1 | 1 |");
    expect(report).toContain("### Reviewer checklist");
    expect(report).toContain("- Brand-new packages expected: review required.");
    expect(report).toContain("### Highest-signal changes");
    expect(report).toContain(
      "| Brand-new direct packages | New direct dependency trust relationship | 1 | `new-direct` |",
    );
    expect(report).toContain("### Brand-new packages");
    expect(report).toContain(
      "| direct | `new-direct` | `1.0.0` | New package name in the dependency graph |",
    );
    expect(report).toContain(
      "| version-changed | `cookie` | `0.6.0` | `0.7.0` | Resolved version changed |",
    );
  });

  test("renders a clear empty state", () => {
    const diff: ClassifiedLockfileDiff = { entries: [] };
    const report = renderMarkdownReport(diff, {
      oldLockfilePath: "old.bun.lock",
      newLockfilePath: "new.bun.lock",
    });

    expect(report).toContain("**No dependency changes detected.**");
    expect(report).toContain(
      "No package additions, removals, version changes, or brand-new package names were found.",
    );
  });
});
