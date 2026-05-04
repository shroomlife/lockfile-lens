import { describe, expect, test } from "bun:test";
import type { NormalizedLockfile } from "../../src";
import { diffLockfiles } from "../../src";

const oldLockfile: NormalizedLockfile = {
  lockfileVersion: 1,
  directDependencies: [],
  packages: [
    packageEntry("foo", "1.0.0"),
    packageEntry("bar", "1.0.0"),
    packageEntry("baz", "1.0.0"),
  ],
};

const newLockfile: NormalizedLockfile = {
  lockfileVersion: 1,
  directDependencies: [],
  packages: [
    packageEntry("foo", "2.0.0"),
    packageEntry("bar", "1.0.0"),
    packageEntry("bar", "2.0.0"),
    packageEntry("qux", "1.0.0"),
  ],
};

describe("diffLockfiles", () => {
  test("computes semantic version-set diff entries", () => {
    const result = diffLockfiles(oldLockfile, newLockfile);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.entries).toEqual([
      {
        kind: "added",
        package: packageEntry("bar", "2.0.0"),
      },
      {
        kind: "removed",
        package: packageEntry("baz", "1.0.0"),
      },
      {
        kind: "version-changed",
        name: "foo",
        oldPackage: packageEntry("foo", "1.0.0"),
        newPackage: packageEntry("foo", "2.0.0"),
      },
      {
        kind: "added",
        package: packageEntry("qux", "1.0.0"),
      },
    ]);
  });
});

function packageEntry(name: string, version: string) {
  return {
    id: `${name}@${version}`,
    name,
    version,
    rawKey: name,
    dependencies: [],
    peerDependencies: [],
    optionalDependencies: [],
    resolution: `${name}@${version}`,
  };
}
