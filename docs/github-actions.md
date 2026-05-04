# GitHub Actions integration

`lockfile-lens` is designed to be CI-friendly:

- It reads two files and writes markdown to stdout.
- It can write a self-contained HTML report for artifact upload in the same command.
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

## Optional PR comments

PR comments require `pull-requests: write`. This is convenient for same-repository pull requests,
but public forks may not receive a writable token. Keep the job summary and HTML artifact as the
reliable default.

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

## Notes

- `actions/checkout` needs enough history to read the base branch version of `bun.lock`; use
  `fetch-depth: 0` for the copy/paste workflow.
- `oven-sh/setup-bun@v2` installs Bun and enables `bunx`.
- `$GITHUB_STEP_SUMMARY` is GitHub's native markdown summary file for a workflow step.
- `actions/upload-artifact@v7` uploads the HTML report. For GitHub Enterprise Server, use the
  artifact action version supported by your GHES release.
