# Retired: Task-Pipe Design Route

Task-Pipe is no longer an active SDID design route.

Use the canonical architecture reference instead:

```text
references/SDID_ARCHITECTURE.md
```

Current canonical flow:

```text
Blueprint -> Draft -> Contract -> Plan -> PLAN-GATE -> IMPLEMENTATION_READY -> Build 1-4 -> SCAN -> VERIFY -> BLUEPRINT_FILLBACK_PENDING / Complete
```

`task-pipe/` remains the BUILD / SCAN execution engine. It is not a separate design route.

Do not use this file to guide active work.
