# SDID Loop Agent - Execution Guide

## Core Loop

```
1. Execute loop.cjs --project=[path]
2. Read output
   - @PASS → auto-advance to next step
   - @TACTICAL_FIX → read log, fix project files, re-run
3. Repeat until <promise>GEMS-COMPLETE</promise>
```

## Error Recovery

When loop.cjs fails:

1. **Find latest error log**
   ```bash
   dir .gems\iterations\iter-X\logs\*-error-*.log
   ```

2. **Find `@TACTICAL_FIX` marker** - tells you what to fix

3. **Fix project files** (NOT tool files!)
   - Edit files in `src/`, `.gems/iterations/`, etc.
   - Never modify `task-pipe/` directory

4. **Re-run loop.cjs**

## Red Lines (Never Cross)

| Forbidden | Reason |
|-----------|--------|
| Modify `task-pipe/` | Tool code is read-only |
| Fake POC artifacts | POC must reflect real requirements |
| Skip steps | Each step validates previous work |
| Run `--help` | SKILL.md has all info |

## Codebase Patterns (Learning Mechanism)

Patterns are stored in `iteration_suggestions_Story-X.Y.json` files:

1. **Read previous suggestions** - `.gems/iterations/iter-X/build/iteration_suggestions_*.json`
2. **Check `technicalHighlights`** - reusable patterns discovered
3. **Check `technicalDebt`** - known issues to avoid
4. **Check `suggestions`** - recommended improvements

**Before starting a new Story:**
```bash
# Find latest suggestions
dir .gems\iterations\iter-*\build\iteration_suggestions_*.json
```

Read the most recent one to understand project patterns.

## Common Fix Patterns

### POC Failures
- Missing `requirement_draft_iter-X.md` → Create it
- Ambiguous requirements → Add clarification with `[NEEDS CLARIFICATION]`

### PLAN Failures  
- Missing contract types → Check POC output
- Invalid story structure → Fix `implementation_plan_Story-X.Y.md`

### BUILD Failures
- Test failures → Fix source code in `src/`
- Missing GEMS tags → Add tags to functions
- Typecheck fails → Fix type errors

### SCAN Failures
- Spec drift → Update implementation to match spec

## Quality Requirements

- ALL steps must pass validation before advancing
- Do NOT fake artifacts to pass gates
- Keep changes focused and minimal
- Follow existing code patterns in the project

## Completion Signal

When SCAN passes and all Stories complete:
```
<promise>GEMS-COMPLETE</promise>
```

Then ask user if they want to start next iteration.

## One Story Per Iteration

Like sdid-main, each loop iteration should focus on ONE story:
- Pick highest priority story where `passes: false`
- Complete that story fully
- Update `story_status.json` to mark `passes: true`
- Record learnings in logs

## Quick Mode Judgment (P5)

When user triggers sdid-loop, determine mode from their language:
- **Quick mode** (`--mode=quick`): 用戶提到「小修」「quick」「快速」「修一下」「小步快跑」「quick fix」
- **Full mode** (`--mode=full`): 其他所有情況（預設）

Quick mode gates: PLAN-5 → BUILD Phase [1,2,5,7] only.
Uses `iter-quick-NNN` naming (doesn't occupy formal iter-N sequence).

Even if you misjudge:
- Small fix as full → runs extra phases, no harm
- Big change as quick → Phase 2/5 will BLOCKER, naturally caught

## Interrupt Handling

When running sdid-loop flow and user inserts an unrelated request:
1. Finish current phase fix cycle first, then handle the request
2. If user insists → pause flow, remind: "BUILD Phase N in progress, will resume after handling your request"
3. After handling → user says "sdid 繼續" → loop.cjs reads state → @RESUME → continue from breakpoint
