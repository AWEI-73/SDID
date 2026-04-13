# HOME Output Reference

> Scope: `sdid-core/home.cjs`
> Purpose: stable agent-facing wrapper payload for project-level routing

---

## Intent

`home.cjs` is the thin wrapper entry for agents.

It does not expose full engine details.
It reads project state through `sdid-wrapper.cjs`, then returns a compact payload that tells an agent:

- whether to continue, repair, or stop
- what command to run next
- where the current workflow cursor is
- what to resume after a repair
- what artifact to read when blocked

This is the agent layer contract.
Detailed phase logs remain in the engine layer.

---

## Command

```bash
node sdid-core/home.cjs --target=<project> --json
```

Optional arguments:

- `--iteration=iter-N`
- `--story=Story-X.Y`
- `--json`

Without `--json`, the CLI prints a compact human-readable form.

Windows fixed-entry wrappers:

```powershell
C:\Users\user\Desktop\SDID\sdid-home.ps1 -Json
```

```cmd
C:\Users\user\Desktop\SDID\sdid-home.cmd --json
```

Wrapper entry behavior:

- current working directory is treated as the project root
- caller does not need to pass `--target`
- extra arguments are forwarded to `home.cjs`

---

## Canonical JSON Shape

```json
{
  "mode": "run | repair | done | unknown",
  "cursor": "string",
  "next": "string | null",
  "resume": "string | null",
  "reason": "string | null",
  "read": ["string"],
  "iteration": "iter-N | null",
  "story": "Story-X.Y | null",

  "status": "RUN | REPAIR | DONE | UNKNOWN",
  "command": "string | null"
}
```

The canonical agent-facing fields are:

- `mode`
- `cursor`
- `next`
- `resume`
- `reason`
- `read`
- `iteration`
- `story`

Compatibility aliases:

- `status` is the legacy uppercase alias of `mode`
- `command` is the legacy alias of `next`

New consumers should prefer `mode` and `next`.

---

## Field Semantics

### `mode`

Allowed values:

- `run`
- `repair`
- `done`
- `unknown`

Meaning:

- `run`: agent should execute `next`
- `repair`: agent should inspect `read` and/or `reason`, run `next`, then return to `resume`
- `done`: workflow is complete; no next action required
- `unknown`: wrapper could not produce a reliable next step

### `cursor`

Machine-facing workflow location.

Examples:

- `GATE`
- `PLAN_GATE`
- `IMPLEMENTATION_READY`
- `BUILD-1`
- `SCAN-scan`
- `VERIFY`
- `COMPLETE`
- `POC-5`

Rule:

- format is `PHASE` or `PHASE-STEP`
- it is a locator, not a user-facing explanation

### `next`

The next command the agent should run now.

Rules:

- `run`: must be the normal next workflow command
- `repair`: must be the repair/proof command
- `done`: must be `null`
- `unknown`: may be `null`

### `resume`

The command to resume the main workflow after a repair completes.

Rules:

- present only when the current `mode` is `repair`
- must be `null` when there is nothing valid to resume
- empty string is normalized to `null`

### `reason`

Short blocker summary for the current repair state.

Examples:

- `Blocked until plan-review is completed: skill checkpoint, review report`
- `Blocked until draft-design-review is completed: skill checkpoint, review report`

Rules:

- `repair`: usually non-null
- `run` / `done`: usually `null`

### `read`

List of engine artifacts the agent should inspect before or during repair.

Examples:

- review report path
- future blocker log path

Rules:

- always an array
- empty array means no additional read target is required
- current implementation usually returns the blocker `reportPath` when available

### `iteration`

Resolved iteration context, usually `iter-N`.

### `story`

Resolved active story when one exists.

Rules:

- may be derived from actionable stage, state, or blocker context
- may be `null` for project-level gates with no active story

---

## Mapping Rules

Current mapping in `home.cjs`:

- `DONE` -> `done`
- `REPAIR` -> `repair`
- `RUN` -> `run`
- `UNKNOWN` -> `unknown`

Current status inference:

- `DONE`: `inspected.stage.id === "complete"`
- `REPAIR`: `inspected.blocked && inspected.canRun`
- `RUN`: `inspected.canRun`
- `UNKNOWN`: fallback

Current cursor inference:

- `state.phase` + optional `state.step`

Current read inference:

- if `blockedBy.reportPath` exists, include it in `read`

---

## Examples

### Run

```json
{
  "mode": "run",
  "cursor": "BUILD-1",
  "next": "node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-1.0 --target=C:\\\\project --iteration=iter-1",
  "resume": null,
  "reason": null,
  "read": [],
  "iteration": "iter-1",
  "story": "Story-1.0",
  "status": "RUN",
  "command": "node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-1.0 --target=C:\\\\project --iteration=iter-1"
}
```

### Repair

```json
{
  "mode": "repair",
  "cursor": "SCAN-scan",
  "next": "node sdid-tools/review-proof.cjs --project=\"C:\\\\project\" --iter=15 --story=Story-15.0 --kind=plan-review",
  "resume": "node task-pipe/runner.cjs --phase=SCAN --target=C:\\\\project --iteration=iter-15",
  "reason": "Blocked until plan-review is completed: skill checkpoint, review report",
  "read": [
    "C:\\\\project\\\\.gems\\\\iterations\\\\iter-15\\\\reviews\\\\plan-review_Story-15.0.md"
  ],
  "iteration": "iter-15",
  "story": "Story-15.0",
  "status": "REPAIR",
  "command": "node sdid-tools/review-proof.cjs --project=\"C:\\\\project\" --iter=15 --story=Story-15.0 --kind=plan-review"
}
```

### Done

```json
{
  "mode": "done",
  "cursor": "COMPLETE",
  "next": null,
  "resume": null,
  "reason": null,
  "read": [],
  "iteration": "iter-1",
  "story": null,
  "status": "DONE",
  "command": null
}
```

---

## Layer Boundary

`home.cjs` is not responsible for:

- full gate diagnostics
- phase-specific log formatting
- direct state mutation
- execution details inside BUILD / SCAN / VERIFY

Those belong to the engine layer:

- `sdid-core/state-machine.cjs`
- `sdid-core/orchestrator.cjs`
- `sdid-core/sdid-wrapper.cjs`
- `task-pipe/*`
- `sdid-tools/*`

`home.cjs` only summarizes engine state into a stable agent-facing payload.

---

## Consumer Guidance

Recommended agent behavior:

1. Call `home.cjs --json`
2. Switch on `mode`
3. If `mode === "run"`, execute `next`
4. If `mode === "repair"`, inspect `reason` and `read`, execute `next`, then continue with `resume`
5. If `mode === "done"`, stop
6. If `mode === "unknown"`, escalate
