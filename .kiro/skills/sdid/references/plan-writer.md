# Plan Writer - Canonical v4 Plan

Use after contract design-review and `contract-gate.cjs @PASS`.

## Hard Rules

- Use the minimal canonical template below. Copy the headings and table header exactly.
- Do not use free-form plan formats.
- Do not use `禮3`, `### 第三段`, `### Task N`, or natural-language substitutes for Sections 3/4.
- Do not loosen Phase 1 gate to accept non-canonical headings.
- Implementation skeletons for every P0 or TDD implementation item must be inside that item's own `### Item N: <name>` block.
- Do not put implementation skeletons only in a later Task/Step section.

## Minimal Canonical Template

```markdown
# Story-X.Y <Module> Implementation Plan

**Story ID**: Story-X.Y
**Goal:** <one sentence>
**Contract:** `.gems/iterations/iter-N/contract_iter-N.ts`

@PLAN_TRACE | Story-X.Y
  SOURCE_CONTRACT: .gems/iterations/iter-N/contract_iter-N.ts
  TARGET_PLAN: .gems/iterations/iter-N/plan/implementation_plan_Story-X.Y.md
  SLICE_COUNT: <N>

<!-- Optional BUILD Phase 1 VSC markers:
@VSC-EXEMPT: REFACTOR_ONLY
Use only for refactor-only stories that intentionally do not add a user-facing vertical slice.

@VSC-EXISTING-API: useExistingApi.methodName
Use when a frontend story reuses an existing API boundary and must not create a new SVC/API.
-->

## 1. Story 目標

<goal and constraints>

## 2. 架構策略

<architecture notes>

## 3. 工作項目

| Item | 名稱 | Type | Priority | 明確度 | 預估 |
|------|------|------|----------|--------|------|
| 1 | <ContractName> | LIB | P1 | Clear | S |

## 4. Item 詳細規格

### Item 1: <ContractName>

SLICE_PRESERVE:
// @CONTRACT: <ContractName> | P1 | LIB | Story-X.Y
// @TEST: path/to/test.test.ts
// @RISK: <preserve risk>
// @GEMS-FLOW: STEP(Clear)->RETURN(Clear)

Behavior:
- <preserve each Behavior line>

```typescript
// @CONTRACT: <ContractName> | P1 | LIB | Story-X.Y
// @TEST: path/to/test.test.ts
// @GEMS-FLOW: STEP(Clear)->RETURN(Clear)
// @GEMS-FUNCTION: <ContractName>
/**
 * GEMS: <ContractName> | P1 | Story-X.Y | STEP(Clear)->RETURN(Clear) | deps:[]
 */
export function <ContractName>(/* TODO */): unknown {
  throw new Error('not implemented');
}
```

## 5. 檔案清單

| Path | Action | Notes |
|------|--------|-------|
| `src/file.ts` | Modify | <why> |

Target File:
- `<primary implementation file for this story item>`

## 8. 架構審查

<boundary and risk review>
```

## Mapping

| Contract field | Plan location |
|---|---|
| `@GEMS-STORY` | H1, Story ID, Goal |
| `@CONTRACT` | Section 3 row and `### Item N` |
| `@TEST` | Same `### Item N` block and skeleton code block |
| `@RISK` | Same `### Item N` block |
| `@GEMS-FLOW` | Same `### Item N` block and skeleton code block |
| `Behavior:` | Same `### Item N` block |

## Validation

Run:

```bash
node task-pipe/lib/plan/plan-validator.cjs "<project>/.gems/iterations/iter-N/plan/implementation_plan_Story-X.Y.md"
```

Phase 4 readiness checks:

- Every plan must include at least one explicit `Target File:` anchor before Build Phase 1 starts.
- `Target File:` anchors must point to the concrete source file that Phase 4 trace closure will bind to.
- Do not rely on Phase 4 to infer the implementation file from prose alone.
