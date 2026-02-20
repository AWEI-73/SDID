---
name: sdid-loop
description: Automated Task-Pipe development loop executor. Use when (1) user requests end-to-end automated development from requirements to delivery, (2) starting a NEW project or continuing an existing Task-Pipe workflow, (3) need to automatically process POC, PLAN, BUILD, SCAN phases with auto-recovery on errors. Triggers: "SDID Loop", "Ralph Loop", "自動開發", "Task-Pipe 自動化", "一鍵開發", "run loop", "start development", "繼續開發", "新增專案", "建立專案", "create project", "new project".
---

# SDID Loop

Automated execution loop for Task-Pipe development workflow.

## Quick Start

Execute immediately without analysis:

```bash
# Continue existing project
node task-pipe/skills/sdid-loop/scripts/loop.cjs --project=[path]

# New project
node task-pipe/skills/sdid-loop/scripts/loop.cjs --new --project=[name] --type=todo
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
| `--level=S/M/L` | Execution level |

## Error Recovery

See [references/agent-prompt.md](references/agent-prompt.md) for detailed error handling patterns.
