# MEMORY Map

> Purpose: turn HUB / BLUEPRINT / STATE / MEMORY / LOG / DECISION LOG / SCAN into a navigation map, so the workspace can be understood at a glance.

---

## 1. What this is

`Memory Map` is not memory itself.
It is the navigation layer.

It answers three questions:
- where are we
- where do we go next
- where do we fall back if blocked

---

## 2. Three Map Levels

### 2.1 Workspace Map

Top-level overview:
- `HUB`
- `PROJECT`
- `BLUEPRINT`
- `CURRENT ITER`
- `ARCHIVE`

Use it to quickly identify:
- which workspace this is
- which project is active
- which iter is active

### 2.2 Layer Map

Major system layers:
- `Monitor Layer`
- `Blueprint Layer`
- `State Layer`
- `Memory Layer`
- `Execution Layer`
- `Scan / Backfill Layer`

Each layer should define:
- role
- reads
- writes
- owned files

### 2.3 Block Map

Concrete blocks:
- `Hub Block`
- `Blueprint Block`
- `Draft Block`
- `Contract Block`
- `Plan Block`
- `Build Block`
- `Scan Block`
- `Verify Block` — canonical final verification stage (blueprint-verify.cjs, compares draft vs implementation)
- `Backfill Block`
- `Decision Log Block`

Every block should expose:
- `Purpose`
- `Owner`
- `Inputs`
- `Outputs`
- `Current State`
- `Next Action`
- `Blocker`
- `Source of Truth`

---

## 3. Block Template

| Field | Meaning |
|---|---|
| `Name` | block name |
| `Role` | entry, state, memory, evidence, executor, aggregator |
| `Reads` | data needed by this block |
| `Writes` | artifacts updated by this block |
| `Current State` | `active` / `done` / `blocked` / `stale` / `pending` |
| `Next Action` | the next thing to do |
| `Fallback` | where to return if blocked |

---

## 4. Navigation Flow

Recommended navigation order:

1. `ROADMAP.md`
2. `ARCHITECTURE.md`
3. `sdid-monitor/hub.json`
4. `.gems/project-memory.json`
5. `.gems/iterations/iter-N/.state.json`
6. recent logs
7. `.gems/decision-log.jsonl`
8. `.gems/iterations/iter-N/functions-snapshot.json` if you need the frozen per-iter snapshot
9. `functions.json`
10. `blueprint / draft / contract`

This is the practical flow for resuming work.

---

## 5. Block Roles

### HUB
- latest consolidated status
- project / iter summary

### BLUEPRINT
- main project entry point
- project orientation and convergence

### STATE
- current workflow position
- next step routing

### MEMORY
- cross-iteration history
- preferences and pitfalls

### DECISION LOG
- route / blocker / retry reasons
- SDID body feedback

### LOG
- execution evidence
- what actually happened

### SCAN
- structure summary
- produces `functions.json`

---

## 6. Project-Level Usage

Framework docs stay generic. Project-specific navigation examples belong in the project workspace.

Use the same navigation order from section 4.

This makes it easier to answer:
- where are we now
- what blocked us
- what is stale
- what is next

---

## 7. Example Workspace

The example below shows how a project workspace is usually read.

```text
workspace/
  ROADMAP.md
  ARCHITECTURE.md
  sdid-monitor/
    hub.json
  .gems/
    project-memory.json
    decision-log.jsonl
    iterations/
      iter-N/
        .state.json
        logs/
        functions-snapshot.json
  .gems/docs/
    functions.json
  blueprint / draft / contract
```

How to use it:
1. read `hub.json` to see the latest consolidated status
2. read `project-memory.json` to recover cross-iteration history
3. read `.state.json` to resume the current iter
4. read logs to confirm what actually happened
5. read `decision-log.jsonl` to see why the framework chose a route
6. read `functions-snapshot.json` if you need the frozen per-iter snapshot
7. read `functions.json` to understand the current structure summary
8. enter via `blueprint / draft / contract`

What this gives you:
- one place to start
- one fixed recovery order
- one quick answer to "where am I now?"

---

## 8. Suggested Outputs

To keep the map readable, the framework should keep these outputs:

- `memory-map.md`
- `memory-map.json`
- `memory-map.mmd`

Rule of thumb:
- HUB = latest status
- MAP = navigation
- MEMORY = history
- DECISION LOG = why we moved this way
