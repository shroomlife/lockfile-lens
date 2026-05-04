# GitHub Actions integration

`lockfile-lens` is designed to be CI-friendly:

- It reads two files and writes markdown to stdout.
- It exits with `0` when analysis succeeds, even if dependency changes are found.
- It exits non-zero only for operational errors such as invalid JSONC or unreadable files.
- It does not need registry credentials for analysis.

## Recommended summary workflow

Use the job summary first. It is simple, fork-friendly, and does not require write permissions.

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
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: oven-sh/setup-bun@v2
      - name: Compare bun.lock
        run: |
          git show "origin/${{ github.base_ref }}:bun.lock" > "$RUNNER_TEMP/base.bun.lock"
          bunx lockfile-lens check "$RUNNER_TEMP/base.bun.lock" bun.lock >> "$GITHUB_STEP_SUMMARY"
```

## Optional PR comments

PR comments require `pull-requests: write`. This is convenient for same-repository pull requests,
but public forks may not receive a writable token. Keep the job summary as the reliable default.

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
      - uses: actions/checkout@v4
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

## Notes

- `actions/checkout` needs enough history to read the base branch version of `bun.lock`; use
  `fetch-depth: 0` for the copy/paste workflow.
- `oven-sh/setup-bun@v2` installs Bun and enables `bunx`.
- `$GITHUB_STEP_SUMMARY` is GitHub's native markdown summary file for a workflow step.
