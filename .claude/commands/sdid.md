---
name: sdid
description: >
  Use when working inside SDID flow or seeing SDID artifacts/terms such as
  .gems/, iter-N, blueprint, draft, contract, implementation_plan, BUILD
  phase, SCAN, VERIFY, GEMS tags, or phase reruns. Do not use for unrelated
  one-off code questions without SDID context.
---

# SDID

Canonical flow:

```text
Blueprint -> Draft -> Contract -> Plan -> PLAN-GATE -> IMPLEMENTATION_READY -> Build 1-4 -> SCAN -> VERIFY -> BLUEPRINT_FILLBACK_PENDING / Complete
```

Always load first:

```text
references/SDID_ARCHITECTURE.md
```

## Step 0: Locate State

Check in this order:

1. `sdid-monitor/hub.json`
2. `.gems/iterations/` for latest `iter-N`
3. `.gems/iterations/iter-N/.state.json`
4. `.gems/iterations/iter-N/logs/`
5. Artifact presence:
   - `.gems/design/blueprint.md` optional
   - `.gems/design/draft_iter-N.md`
   - `.gems/iterations/iter-N/contract_iter-N.ts`
   - `.gems/iterations/iter-N/plan/implementation_plan_Story-X.Y.md`
   - `.gems/iterations/iter-N/build/phase4-done_Story-X.Y`
   - `.gems/docs/functions.json`

## Routing

| State | Mode | Load |
|---|---|---|
| No draft / unclear request | `DESIGN-BLUEPRINT` | `references/blueprint-design.md` |
| Blueprint exists, no draft | `BLUEPRINT-CONTINUE` | `references/blueprint-design.md` |
| Draft exists, no contract | `TDD-CONTRACT` | `references/tdd-contract-prompt.md` |
| Contract exists, no plan | `PLAN-WRITE` | `references/plan-writer.md` |
| Plan files exist, no `gate-plan-pass-*` | `PLAN-GATE` | `task-pipe/tools/plan-gate.cjs` + `references/plan-writer.md` |
| Plan gate passed, no `gate-implementation-ready-pass-*` | `IMPLEMENTATION_READY` | `task-pipe/tools/implementation-ready-gate.cjs` |
| Contract + plan-gate + implementation-ready pass exist | `BUILD-AUTO` | `references/build-execution.md` |
| Build Phase 4 all stories done | `SCAN` | `task-pipe/runner.cjs --phase=SCAN` |
| SCAN pass / functions.json exists | `VERIFY` | `sdid-tools/blueprint/verify.cjs` |
| Rerun a specific phase | `RERUN-PHASE` | `task-pipe/runner.cjs` |
| Small local fix outside iter | `MICRO-FIX` | `references/micro-fix.md` |
| POC exploration inside iter | `POC-FIX` | `references/poc-fix.md` |

## Hard Rules

- Do not use `Task-Pipe` as a design route. `task-pipe/` is the Build/Scan execution engine only.
- Do not surface `CYNEFIN_CHECK`, `cynefin-log-writer.cjs`, or `cynefin-report.json` as active workflow steps.
- Do not use `ac-runner.cjs`; Phase 2 owns `@TEST` / vitest / tsc.
- Contract is spec-only; implementation details belong in `implementation_plan`.
- Phase 4 completion marker is `phase4-done_Story-X.Y`.
- `Fillback_Story-X.Y.md` is legacy / VERIFY-after only, not Build completion.
- VERIFY must consume SCAN canonical `.gems/docs/functions.json`; it must not auto-scan.
- VERIFY must not run in parallel with SCAN.
- Plans must carry explicit `Target File:` anchors before Build Phase 4.
- Decision log entries must use canonical `iter-N` values and only use detail records when preserving a reusable lesson.

## Retired References

Do not load these for active flow guidance:

- `references/cynefin-check.md`
- `references/taskpipe-design.md`

They are legacy-only if still present in an older installation.
