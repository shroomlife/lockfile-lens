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

## Real-world problems this solves

### "This PR only bumps one direct dependency. Why did 40 packages change?"

Dependency bots and package managers often touch far more than the dependency named in the PR title.
For product teams, that creates noisy reviews and weak approval evidence: reviewers can see that
`bun.lock` changed, but not what changed in business terms. `lockfile-lens` turns that lockfile churn
into a short review artifact: brand-new packages, added versions, removed packages, upgrades, and
direct vs transitive scope.

### "We need a lightweight supply-chain review gate before buying a platform."

Security teams may already use Dependabot, GitHub Advanced Security, Snyk, Socket, or another SCA
platform. Those tools are valuable, but early-stage teams and open-source maintainers still need a
simple, transparent markdown report that works in any CI job and can be pasted into a PR. `lockfile-lens`
does that without registry credentials, SaaS setup, policy configuration, or a GitHub token with write
permissions.

### "A new transitive package appeared. Did anyone notice?"

Several well-known supply-chain incidents were not just about vulnerable versions. They were about
trust boundaries shifting inside dependency graphs. The
[event-stream incident](https://blog.npmjs.org/post/180565383195/details-about-the-event-stream-incident)
involved a new malicious transitive dependency. The
[ua-parser-js compromise](https://github.com/advisories/GHSA-pjwm-rvh2-c87w) shipped malicious npm
versions of a widely used package. The
[xz Utils backdoor](https://www.cisa.gov/news-events/alerts/2024/03/29/reported-supply-chain-compromise-affecting-xz-utils-data-compression-library-cve-2024-3094)
showed how much damage a trusted upstream package can cause. `lockfile-lens` does not detect malware,
but it gives reviewers a focused place to ask: "Is this new package expected?"

### "Our GitHub Action should work for forks and public repos."

The default integration writes to
[`$GITHUB_STEP_SUMMARY`](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands),
so it works with read-only permissions. PR comments are optional and documented separately for
same-repository pull requests.

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

## How it compares

`lockfile-lens` is intentionally narrow: it makes Bun lockfile diffs readable. It is not a replacement
for vulnerability databases, malware analysis, dependency bots, or policy engines.

| Tool | Great for | Where `lockfile-lens` fits |
|---|---|---|
| [GitHub Dependency Review](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-dependency-review) | Reviewing dependency changes with GitHub's dependency graph and security data. | Adds a Bun-first, markdown-only report that can run as a plain CLI in any CI flow. |
| [Dependabot](https://docs.github.com/en/code-security/dependabot) and [Renovate](https://docs.renovatebot.com/) | Creating dependency update PRs automatically. | Explains what the resulting `bun.lock` diff actually changed. |
| `bun audit` / `npm audit` | Finding known vulnerabilities from advisory data. | Shows non-vulnerability graph changes, such as brand-new transitive packages. |
| [Socket](https://socket.dev/) / [Snyk](https://snyk.io/) | Deeper supply-chain intelligence, risk signals, policy, and platform workflows. | Provides a transparent open-source report with no SaaS dependency for the initial review step. |
| [`lockfile-lint`](https://github.com/lirantal/lockfile-lint) | Enforcing lockfile host/protocol/integrity rules. | Produces a human changelog instead of validating lockfile source policy. |

The best setup is complementary: let bots create update PRs, let SCA tools flag known risk, and use
`lockfile-lens` to make the lockfile delta reviewable for humans.

## Quickstart

From this repository:

```sh
bun install
bun run smoke
bun run smoke:html
```

Use the local CLI directly while developing:

```sh
bun run --cwd packages/cli src/index.ts check ../../examples/old.bun.lock ../../examples/new.bun.lock
bun run --cwd packages/cli src/index.ts check ../../examples/old.bun.lock ../../examples/new.bun.lock --html-output ../../reports/lockfile-lens.html
```

After the CLI package is published to npm, run it directly with Bun:

```sh
bunx lockfile-lens check old.bun.lock new.bun.lock
bunx lockfile-lens check old.bun.lock new.bun.lock --html-output reports/lockfile-lens.html
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
      - name: Generate lockfile report
        run: |
          mkdir -p reports
          git show "origin/${{ github.base_ref }}:bun.lock" > "$RUNNER_TEMP/base.bun.lock"
          bunx lockfile-lens check "$RUNNER_TEMP/base.bun.lock" bun.lock \
            --html-output reports/lockfile-lens.html >> "$GITHUB_STEP_SUMMARY"
      - uses: actions/upload-artifact@v7
        with:
          name: lockfile-lens-${{ github.run_id }}-${{ github.run_attempt }}
          path: reports/lockfile-lens.html
          if-no-files-found: error
          retention-days: 14
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
          mkdir -p reports
          git show "origin/${{ github.base_ref }}:bun.lock" > "$RUNNER_TEMP/base.bun.lock"
          bunx lockfile-lens check "$RUNNER_TEMP/base.bun.lock" bun.lock \
            --html-output reports/lockfile-lens.html > "$RUNNER_TEMP/lockfile-lens.md"
          cat "$RUNNER_TEMP/lockfile-lens.md" >> "$GITHUB_STEP_SUMMARY"
      - uses: actions/upload-artifact@v7
        with:
          name: lockfile-lens-${{ github.run_id }}-${{ github.run_attempt }}
          path: reports/lockfile-lens.html
          if-no-files-found: error
          retention-days: 14
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

### Review focus

This lockfile update changes **6 package entries**.
Start with **2 brand-new package names**, because each one creates a new dependency trust relationship.
Then review **2 direct dependency changes**, because these came from workspace declarations.
Finally confirm **1 removed package entry** is expected.
No registry calls were made; this report is based only on the two lockfiles.

### Change totals

| Change | Direct | Transitive | Total |
|---|---:|---:|---:|
| Brand-new | 1 | 1 | 2 |
| Added | 0 | 1 | 1 |
| Removed | 0 | 1 | 1 |
| Version changed | 1 | 1 | 2 |

### Reviewer checklist

- Brand-new packages expected: review required.
- Direct dependency changes expected: review required.
- Transitive dependency churn understood: review recommended.
- Removals expected: review required.

### Highest-signal changes

| Focus area | Why it matters | Count | Packages |
|---|---|---:|---|
| Brand-new direct packages | New direct dependency trust relationship | 1 | `new-direct` |
| Brand-new transitive packages | New transitive dependency trust relationship | 1 | `new-transitive` |
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
