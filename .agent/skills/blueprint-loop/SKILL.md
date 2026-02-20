---
name: blueprint-loop
description: "[DEPRECATED — 請改用 sdid skill] Automated Blueprint Flow development loop executor. 此 skill 已整合進統一的 sdid skill。直接使用 sdid skill 即可，它會自動判斷路線。"
---

# Blueprint Loop v2.0

Automated execution loop for Blueprint Flow development workflow.
Aligned with Ralph Loop v4 output format.

## Quick Start

Execute immediately without analysis:

```bash
# Detect state and run next step
node .agent/skills/blueprint-loop/scripts/loop.cjs --project=<path>

# Force start from Gate
node .agent/skills/blueprint-loop/scripts/loop.cjs --project=<path> --force-start=GATE

# Force start from BUILD
node .agent/skills/blueprint-loop/scripts/loop.cjs --project=<path> --force-start=BUILD-1 --story=Story-1.0
```

## Prohibited Actions

| Action | Reason |
|--------|--------|
| `--help` | SKILL.md contains all needed info |
| Read `*.cjs` source | Tool internals are irrelevant |
| "Let me first..." | Execute directly |

## Workflow

1. **Execute** `loop.cjs --project=<path>`
2. **Read output** - tool handles state detection + Story progress display
3. **On failure** - read `.gems/iterations/iter-X/logs/gate-*-error-*.log` → find `@BLOCKER` or `@TACTICAL_FIX` → fix files → re-run
4. **On success** - read `@PASS` output → **re-run loop.cjs** (NOT the BUILD output's next command)
5. **On complete** - loop auto-generates next iter draft from suggestions (self-iteration)

## ⚠️ BUILD Output Rule

BUILD phases output "下一步: SCAN" after Phase 8. **Ignore this in Blueprint Flow.**
Always re-run `loop.cjs` — it auto-detects next Story or SHRINK.

## Parameters

| Parameter | Purpose |
|-----------|---------|
| `--project=<path>` | Project path (required) |
| `--draft=<path>` | Draft path (optional, auto-detected) |
| `--iter=N` | Iteration number (optional, auto-detected) |
| `--story=Story-X.Y` | Story ID for BUILD phase |
| `--level=<S\|M\|L>` | Execution level (default: M) |
| `--force-start=GATE` | Force start from Gate |
| `--force-start=PLAN` | Force start from draft-to-plan |
| `--force-start=BUILD-N` | Force start from BUILD Phase N |
| `--force-start=SHRINK` | Force start from Shrink |
| `--force-start=VERIFY` | Force start from Verify |
| `--dry-run` | Preview mode |

## Error Recovery

1. Read latest error log from `logs/gate-*-error-*.log` or `logs/build-*-error-*.log`
2. Follow `@ERROR_SPEC` for precise fix instructions
3. Follow `@GATE_SPEC` to understand what the gate checks
4. Fix the target file (NOT the tool scripts)
5. Re-run the loop

## Flow Phases

```
GATE → PLAN → BUILD (Phase 1-8 per Story) → SHRINK → [EXPAND → GATE → ...] → VERIFY
```

## Completion Signal

When all Stories complete + Shrink passes:
- If suggestions exist → auto-generates next iter draft, outputs `@NEXT_ACTION`
- If no suggestions → outputs `<promise>BLUEPRINT-COMPLETE</promise>`

## Self-Iteration

On COMPLETE, the loop reads `iteration_suggestions_Story-X.Y.json` from the build directory and auto-generates the next iteration's `requirement_draft_iter-N.md`. This mirrors Ralph Loop's self-iteration behavior.

## Log Files

All logs are in `.gems/iterations/iter-X/logs/`:
- `gate-check-{pass|error}-*.log` — Gate results
- `gate-plan-pass-*.log` — Plan generation results
- `build-phase-N-Story-X.Y-{pass|error}-*.log` — BUILD results
- `gate-shrink-pass-*.log` — Shrink results
- `gate-expand-pass-*.log` — Expand results
- `gate-verify-pass-*.log` — Verify results
