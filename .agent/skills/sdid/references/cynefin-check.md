# Retired: Standalone Cynefin Check

This reference is retained only to prevent older agents from resurrecting the retired flow.

Do not use:

```text
CYNEFIN_CHECK
cynefin-log-writer.cjs
cynefin-report.json
```

Current rule:

```text
Cynefin analysis is embedded in Blueprint / design-review.
It is not a standalone gate, phase, report, or next command.
```

Use these references instead:

```text
references/SDID_ARCHITECTURE.md
references/blueprint-design.md
references/design-reviewer-prompt.md
```

TDD responsibility is now enforced by:

```text
contract-gate.cjs: @TEST / empty test / spec-only contract checks
phase-2.cjs: story-scoped @TEST runner
```
