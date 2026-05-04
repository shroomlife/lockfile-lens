# lockfile-lens

Make `bun.lock` diffs human-reviewable.

`lockfile-lens` compares two Bun 1.2+ lockfiles and renders a concise markdown changelog for
pull requests, CI logs, and local review.

## Why this exists

Lockfile diffs are where supply-chain changes become real, but they are also where review usually
stops. GitHub often collapses lockfile diffs because they are huge, so teams end up approving
package graph changes they cannot realistically inspect.

That noise can hide meaningful risk: brand-new transitive packages, unexpected removals, broad
version churn, or the kind of dependency graph surprise that made xz-style attacks so sobering.
`lockfile-lens` does not claim to detect malicious code. It makes the dependency graph change small
enough for humans to review again.

## What it does today

- Parses Bun 1.2+ JSONC `bun.lock` files.
- Computes semantic package changes between two lockfiles.
- Classifies each reported entry as exactly one of:
  - `brand-new`: package name did not exist anywhere in the old lockfile.
  - `added`: a new resolved version appeared for a package name already present before.
  - `removed`: a resolved package version disappeared.
  - `version-changed`: a package moved from one resolved version to another.
- Labels changes as `direct` or `transitive`.
- Renders markdown to stdout.

## Quickstart

From this repository:

```sh
bun install
bun run smoke
```

Use the local CLI directly while developing:

```sh
bun run --cwd packages/cli src/index.ts check ../../examples/old.bun.lock ../../examples/new.bun.lock
```

After the CLI package is published to npm, run it directly with Bun:

```sh
bunx lockfile-lens check old.bun.lock new.bun.lock
```

For a pull request workflow, compare the base lockfile with the changed lockfile and post the
markdown output as a PR comment or CI summary.

```sh
bunx lockfile-lens check ./bun.lock.base ./bun.lock
```

The command exits with `0` when analysis succeeds, even if dependency changes are found. It exits
non-zero only for operational problems such as unreadable files, invalid JSONC, or unsupported
lockfile shapes.

## CI integration

The CLI prints markdown to stdout, so it is easy to pipe into CI summaries or PR comments.
This summary-only workflow is the safest default because it works for public repositories and forked
pull requests without write permissions.
See [docs/github-actions.md](docs/github-actions.md) for the longer integration guide.

```yaml
name: Lockfile lens

on:
  pull_request:
    paths:
      - bun.lock

permissions:
  contents: read

jobs:
  lockfile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: oven-sh/setup-bun@v2
      - name: Compare bun.lock
        run: |
          git show "origin/${{ github.base_ref }}:bun.lock" > "$RUNNER_TEMP/base.bun.lock"
          bunx lockfile-lens check "$RUNNER_TEMP/base.bun.lock" bun.lock >> "$GITHUB_STEP_SUMMARY"
```

For same-repository pull requests, you can also post the report as a PR comment. Keep the summary
step too, so the report is visible even if comment permissions are unavailable.

```yaml
name: Lockfile lens comment

on:
  pull_request:
    paths:
      - bun.lock

permissions:
  contents: read
  pull-requests: write

jobs:
  lockfile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: oven-sh/setup-bun@v2
      - name: Generate report
        run: |
          git show "origin/${{ github.base_ref }}:bun.lock" > "$RUNNER_TEMP/base.bun.lock"
          bunx lockfile-lens check "$RUNNER_TEMP/base.bun.lock" bun.lock > "$RUNNER_TEMP/lockfile-lens.md"
          cat "$RUNNER_TEMP/lockfile-lens.md" >> "$GITHUB_STEP_SUMMARY"
      - name: Comment on PR
        if: github.event.pull_request.head.repo.full_name == github.repository
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh pr comment "${{ github.event.pull_request.number }}" --body-file "$RUNNER_TEMP/lockfile-lens.md"
```

## Programmatic API

Use `@lockfile-lens/core` when you want to integrate the analysis into another tool without any
filesystem or CLI behavior.

```ts
import { analyzeBunLockfileChange } from "@lockfile-lens/core";

const result = analyzeBunLockfileChange(oldLockfileText, newLockfileText);

if (!result.ok) {
  console.error(result.error);
} else {
  console.log(result.value.entries);
}
```

## Example output

```md
## lockfile-lens report

Compared `examples/old.bun.lock` -> `examples/new.bun.lock`.

### Summary

| Change | Direct | Transitive | Total |
|---|---:|---:|---:|
| Brand-new | 1 | 1 | 2 |
| Added | 0 | 1 | 1 |
| Removed | 0 | 1 | 1 |
| Version changed | 1 | 1 | 2 |
```

## Architecture

This repository is a Bun workspace monorepo:

- `@lockfile-lens/core`: pure TypeScript library. No filesystem, no console, no process exits.
- `lockfile-lens`: Bun CLI. All I/O lives here.

The core pipeline is intentionally composable:

```ts
parseBunLockfile(source)
diffLockfiles(oldLockfile, newLockfile)
classifyDiff(diff, { oldLockfile, newLockfile })
analyzeBunLockfileChange(oldSource, newSource)
```

## Development

```sh
bun install
bun test
bun run typecheck
bun run biome
bun run smoke
```

## Roadmap

- Parse `pnpm-lock.yaml`.
- Parse `package-lock.json`.
- Parse `yarn.lock`.
- Add a GitHub Action wrapper.
- Enrich reports with npm registry data: maintainer changes, package age, and deprecated status.
- Add Slack and Discord notifications.
- Add risk scoring and a policy engine.
- Add allowlists and denylists.
- Explore a web dashboard or SaaS tier.

## License

MIT
