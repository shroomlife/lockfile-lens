import { describe, expect, test } from "bun:test";
import { classifyDiff, diffLockfiles, parseBunLockfile } from "../../src";
import { readFixture } from "../read-fixture";

describe("classifyDiff", () => {
  test("classifies added, removed, version-changed, and brand-new entries exactly once", () => {
    const oldLockfile = parseBunLockfile(readFixture("old.bun.lock"));
    const newLockfile = parseBunLockfile(readFixture("new.bun.lock"));
    expect(oldLockfile.ok).toBe(true);
    expect(newLockfile.ok).toBe(true);
    if (!oldLockfile.ok || !newLockfile.ok) {
      return;
    }

    const diff = diffLockfiles(oldLockfile.value, newLockfile.value);
    expect(diff.ok).toBe(true);
    if (!diff.ok) {
      return;
    }

    const classified = classifyDiff(diff.value, {
      oldLockfile: oldLockfile.value,
      newLockfile: newLockfile.value,
    });

    expect(classified.ok).toBe(true);
    if (!classified.ok) {
      return;
    }

    expect(classified.value.entries).toEqual([
      expect.objectContaining({
        kind: "brand-new",
        dependencyScope: "direct",
        packageName: "new-direct",
        newVersion: "1.0.0",
      }),
      expect.objectContaining({
        kind: "brand-new",
        dependencyScope: "transitive",
        packageName: "new-transitive",
        newVersion: "0.4.2",
      }),
      expect.objectContaining({
        kind: "version-changed",
        dependencyScope: "direct",
        packageName: "elysia",
        oldVersion: "1.2.10",
        newVersion: "1.2.12",
      }),
      expect.objectContaining({
        kind: "version-changed",
        dependencyScope: "transitive",
        packageName: "cookie",
        oldVersion: "0.6.0",
        newVersion: "0.7.0",
      }),
      expect.objectContaining({
        kind: "added",
        dependencyScope: "transitive",
        packageName: "existing-helper",
        newVersion: "2.0.0",
      }),
      expect.objectContaining({
        kind: "removed",
        dependencyScope: "transitive",
        packageName: "removed-helper",
        oldVersion: "1.0.0",
      }),
    ]);
  });
});
