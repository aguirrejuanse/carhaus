---
name: pr
description: Use when the user runs /pr or asks to push the current branch and open a pull request for Carhaus — pushes the branch and creates a GitHub PR with the project's standard template (Task / Overview / Visual Doc / Tests / Non-code changes).
---

# PR (Carhaus)

## Overview

Push the current branch and open a PR using `gh`, following the branch-to-branch chaining strategy this project uses (each PR targets the previous PR's branch so stacked diffs stay reviewable; only the first PR in a chain targets `main`).

## Flow

1. **Check state before pushing.** Run `git status --short` and `git branch --show-current`. Confirm there are no unrelated uncommitted changes on the branch. Never force-push.
2. **Push the branch**: `git push -u origin <branch>` (or plain `git push` if already tracking).
3. **Create the PR** with `gh pr create --base <previous-pr-branch> --head <branch>` (or `--base main` for the first PR in a chain), title short and descriptive (`PRn: <what it does>`), and body using the template below.
4. **Report the PR URL** to the user — do not merge unless explicitly asked.

## PR body template

```markdown
## Task
<what was asked — reference the relevant TASKS.md phase/items (e.g. "Carhaus MVP — Phase 3 (3.1-3.3), see TASKS.md")>

## Overview
<what changed and why, technical — 2-5 bullets. Include notable deviations from spec/design and flagged risks here too>

## Visual Doc
<screenshots or a short gif for any UI change. Write "N/A — backend/infra only" when there is no visual surface>

## Tests
- [x] <checks actually run, e.g. `pnpm test`, `pnpm lint`, `pnpm build`, `tsc --noEmit`>
- [ ] <manual/pending checks not yet done>

## Non-code changes
<config, env vars, migrations, docs, infra — anything outside app code. Write "None" if there are none>
```

Always end the PR body with the session attribution line from the system reminder (`https://claude.ai/code/session_...`), when present in the conversation — never invent or omit it silently.

## Notes specific to this project

- Delivery strategy: chained PRs, branch-to-branch — each PR's base is the previous PR's branch (first PR in the chain targets `main`). When the previous PR merges, GitHub retargets the next one to `main` automatically.
- GitHub blocks `gh pr edit --base` on PRs it considers "part of a stack" — set the correct base at creation time, or fix it in the GitHub UI.
- If `sdd-verify` ran for the change behind this PR, summarize its verdict (PASS/WARNINGS/CRITICAL count) in the PR body's Overview section.
- Don't include unrelated untracked files (e.g. `.atl/`) unless the PR is specifically about them.
- After the PR is created (or its body updated), tick off the corresponding items in `TASKS.md` on the branch and include that change in the same push — this is the project's task tracker, there is no GitHub Issues/Projects board.
