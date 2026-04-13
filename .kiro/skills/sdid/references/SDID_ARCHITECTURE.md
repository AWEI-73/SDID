# SDID Architecture Reference

Canonical flow:

```text
Blueprint -> Draft -> Contract -> Plan -> PLAN-GATE -> IMPLEMENTATION_READY -> Build 1-4 -> SCAN -> VERIFY -> BLUEPRINT_FILLBACK_PENDING / Complete
```

Rules:
- Blueprint is required as design process; `blueprint.md` file is optional.
- Draft is required per iter: `.gems/design/draft_iter-N.md`.
- Contract is spec-only: `.gems/iterations/iter-N/contract_iter-N.ts`.
- Implementation detail belongs in `implementation_plan_Story-X.Y.md`, not in contract.
- Build Phase 4 must finish all stories before SCAN.
- SCAN produces the canonical function cache.
- VERIFY consumes SCAN output and does not auto-scan.
- VERIFY must start only after SCAN has finished writing `.gems/docs/functions.json`; do not run SCAN and VERIFY in parallel.
- Cynefin is embedded Blueprint/design-review analysis, not a phase/gate.
- Task-Pipe is not a route; `task-pipe/` is the Build/Scan execution engine.

## Gate Responsibilities

| Stage | Responsibility |
|---|---|
| Blueprint | Global design and embedded Cynefin/design review |
| Draft | Iter design and TDD requirement definition |
| Contract | Spec-only contract; `@TEST` required for P0/TDD items; no implementation syntax |
| Plan | Contract-only planner; `@PLAN_TRACE`; implementation skeleton/code-level tasks; explicit `Target File` anchors for each story item |
| Build 1 | Plan/source skeleton, foundation, boundary, multi-root readiness |
| Build 2 | TDD runner: story-scoped `@TEST`, empty-test blocker, vitest/tsc |
| Build 3 | Integration/API surface gate: `@INTEGRATION-TEST`, route/export/API agreement |
| Build 4 | Runtime readiness + trace coverage closure; one-line GEMS tag; canonical FLOW separators; skeleton residue gate |
| SCAN | Produce `.gems/docs/functions.json` and auxiliary docs |
| VERIFY | Compare design/source using SCAN output; emit fillback pending hook |

## Build Markers

Canonical story completion marker:

```text
.gems/iterations/iter-N/build/phase4-done_Story-X.Y
```

Legacy:
- `Fillback_Story-X.Y.md` is legacy compatibility only, not Build story completion.

## GEMS Tag Format

Use JSDoc-compatible single-line source tags:

```ts
/** GEMS: createTask | P0 | VALIDATE→WRITE→RETURN | Story-11.1 | @TEST: backend-gas/src/modules/tasks/__tests__/task.service.test.ts | @INTEGRATION-TEST: backend-gas/src/modules/tasks/__tests__/task.integration.test.ts | deps:[TaskRepo] */
```

Required fields:
- name
- priority `P0/P1/P2/P3`
- compact arrow FLOW
- `Story-X.Y`

Do not put `[STEP]` into the GEMS tag. `[STEP]` belongs in implementation plan or local implementation notes.

## Decision Log

Canonical path:

```text
.gems/decision-log.jsonl
```

Hard rules:
- Keep it machine-readable JSONL, not free-form notes.
- Use canonical `iter` values like `iter-12`; do not mix raw numbers and `iter-N`.
- Use one primary record per gate result. Add `PASS-DETAIL` or `BLOCKER-RESOLVED` only when preserving a reusable lesson.
- `PASS-DETAIL` and `BLOCKER-RESOLVED` must include both `why` and `resolution`.
- If a detail record explains or replaces an earlier result, include a stable `supersedes` link key.
- Reuse canonical error names for the same failure mode; do not invent synonyms.

## SCAN / VERIFY

SCAN canonical output:

```text
.gems/docs/functions.json
```

SCAN auxiliary outputs:

```text
.gems/docs/project-overview.json
.gems/docs/DB_SCHEMA.md
.gems/docs/CONTRACT.md
.gems/iterations/iter-N/functions-snapshot.json
```

VERIFY:
- reads `.gems/docs/functions.json`;
- does not auto-scan;
- does not implicitly fallback to `function-index.json` or `functions-snapshot.json`;
- does not run concurrently with SCAN;
- blocks and instructs running SCAN if canonical cache is missing or empty.

## Retired Concepts

Do not surface these as active workflow steps:
- `CYNEFIN_CHECK`
- `cynefin-log-writer.cjs`
- `cynefin-report.json`
- `ac-runner.cjs`
- `Task-Pipe` route
- `Fillback_Story-X.Y.md` as Build completion marker

## Common Commands

```bash
node sdid-tools/blueprint/v5/blueprint-gate.cjs --blueprint=.gems/design/blueprint.md --target=<project>
node sdid-tools/blueprint/v5/draft-gate.cjs --draft=.gems/design/draft_iter-N.md --target=<project>
node sdid-tools/blueprint/v5/contract-gate.cjs --contract=.gems/iterations/iter-N/contract_iter-N.ts --target=<project> --iter=N
node task-pipe/tools/spec-to-plan.cjs --target=<project> --iteration=iter-N
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-X.Y --target=<project>
node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-X.Y --target=<project>
node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-X.Y --target=<project>
node task-pipe/runner.cjs --phase=BUILD --step=4 --story=Story-X.Y --target=<project>
node task-pipe/runner.cjs --phase=SCAN --target=<project> --iteration=iter-N
node sdid-tools/blueprint/verify.cjs --draft=.gems/design/draft_iter-N.md --target=<project> --iter=N
```
