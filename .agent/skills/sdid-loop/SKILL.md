---
name: sdid-loop
description: "[DEPRECATED — 請改用 sdid skill] Automated Task-Pipe development loop executor. 此 skill 已整合進統一的 sdid skill。直接使用 sdid skill 即可，它會自動判斷路線。"
---

# SDID Loop

Automated execution loop for Task-Pipe development workflow.

## Quick Start

Execute immediately without analysis:

```bash
# Continue existing project
node .agent/skills/sdid-loop/scripts/loop.cjs --project=[path]

# New project
node .agent/skills/sdid-loop/scripts/loop.cjs --new --project=[name] --type=todo
```

## Prohibited Actions

| Action | Reason |
|--------|--------|
| `--help` | SKILL.md contains all needed info |
| `--dry-run` then stop | dry-run is preview only, execute for real |
| Read `*.cjs` source | Tool internals are irrelevant |
| "Let me first..." | Execute directly |

## Workflow

1. **Execute** `loop.cjs --project=[path]`
2. **Read output** - tool handles state detection
3. **On failure** - read `.gems/iterations/iter-X/logs/` latest error log → find `@TACTICAL_FIX` → fix files → re-run

## Parameters

| Parameter | Purpose |
|-----------|---------|
| `--project=[path]` | Project path (required) |
| `--force-start=POC-1` | Force start from POC Step 1 |
| `--force-start=PLAN-1` | Force start from PLAN Step 1 |
| `--force-start=BUILD-1` | Force start from BUILD Phase 1 |
| `--new --project=[name]` | New project |
| `--type=[type]` | Project type (todo/note/counter) |
| `--mode=full\|quick` | Execution mode (full=全流程, quick=小步快跑 Phase [1,2,5,7]) |
| `--level=S/M/L` | Execution level |

## Error Recovery

See [references/agent-prompt.md](references/agent-prompt.md) for detailed error handling patterns.
