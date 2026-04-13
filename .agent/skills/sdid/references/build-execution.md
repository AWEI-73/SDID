# BUILD Execution Reference

Use this when the current SDID state is Build or a Build phase rerun.

Canonical flow segment:

```text
Plan -> Build 1 -> Build 2 -> Build 3 -> Build 4 -> SCAN -> VERIFY
```

`task-pipe/runner.cjs` is the Build / Scan execution engine. It is not a separate Task-Pipe design route.

## Commands

```bash
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-X.Y --target=<project>
node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-X.Y --target=<project>
node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-X.Y --target=<project>
node task-pipe/runner.cjs --phase=BUILD --step=4 --story=Story-X.Y --target=<project>
node task-pipe/runner.cjs --phase=SCAN --target=<project> --iteration=iter-N
```

## Phase Responsibilities

| Phase | Responsibility |
|---|---|
| Build 1 | Consume `implementation_plan`; validate implementation skeleton/code-level tasks; check foundation, boundary, and multi-root readiness |
| Build 2 | TDD runner: story-scoped `@TEST`, empty-test blocker, P0/TDD missing `@TEST` blocker, vitest / tsc |
| Build 3 | Integration/API surface gate: `@INTEGRATION-TEST`, route/export/API agreement, TS/JS export + GAS surface |
| Build 4 | Runtime readiness + trace coverage closure: one-line GEMS tag, canonical FLOW separators, explicit plan `Target File` anchors, skeleton residue, entrypoint metadata light check, `phase4-done` marker |

## Pass Flow

After each `@PASS`, call `sdid-loop` or run the next explicit runner command.

Build Phase 4 behavior:

```text
Build Phase 4 PASS
  -> if another story is incomplete: Build 1 for next story
  -> if all stories are complete: SCAN
SCAN PASS
  -> VERIFY
```

Before Build Phase 4:

- Ensure every `implementation_plan_Story-X.Y.md` has at least one explicit `Target File:` anchor for the real implementation file.
- Normalize source GEMS FLOW tags to the canonical separator format expected by SCAN and Phase 4.
- Fix these metadata issues before rerunning Phase 4; do not rely on Phase 4 to infer them from prose.

## Hard Boundaries

- Do not send Build Phase 4 directly to VERIFY.
- Do not start VERIFY while SCAN is still running or while `.gems/docs/functions.json` is still being written.
- Do not treat `Fillback_Story-X.Y.md` as Build completion.
- Do not use `CYNEFIN_CHECK`, `cynefin-log-writer.cjs`, or `cynefin-report.json`.
- Do not use `ac-runner.cjs`.
- Do not reintroduce Task-Pipe as a design route.

## Completion Marker

Canonical Build story completion marker:

```text
.gems/iterations/iter-N/build/phase4-done_Story-X.Y
```

SCAN canonical cache:

```text
.gems/docs/functions.json
```
