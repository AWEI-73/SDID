# SDID 蝟餌絞?嗆??辣
> ?: v9.0 | ?湔: 2026-04-07
> 摰?: SDID ?函頂蝯梁? canonical flow?rtifact contract?ate ?瑁痊??agent 摰??辣

---

## 銝?亥店摰儔
SDID嚗tructured Iterative Development嚗銝憟?AI 撽???降嚗?祈?鞎?gate ??artifact contract嚗I 鞎痊隤??斗?耨敺拙銵?
```text
Canonical flow:
Blueprint -> Draft -> Contract -> Plan -> Build 1-4 -> SCAN -> VERIFY -> BLUEPRINT_FILLBACK_PENDING / Complete
```

?詨???嚗?- Blueprint ?臬?閬身閮?畾蛛?`blueprint.md` ?辣?舫嚗?銝頝喲?閮剛??斗??- Draft ?舀???iter ?撥?嗉身閮?押?- Contract ??spec-only嚗?撖怠祕雿撘? class body??- Implementation details ?賢 `implementation_plan_Story-X.Y.md`嚗 Build Phase 1 瘨祥??- Build Phase 4 摰?敺???SCAN嚗???VERIFY??- Cynefin ??Blueprint / design review ?批????賢?嚗??舐蝡?gate?hase ??瑁? next step??- Task-Pipe 銝閮剛? route嚗task-pipe/` ??BUILD / SCAN ?瑁?撘???
---

## Artifact Flow

```text
.gems/design/draft_iter-N.md
  -> .gems/iterations/iter-N/contract_iter-N.ts
  -> .gems/iterations/iter-N/plan/implementation_plan_Story-X.Y.md
  -> Build Phase 1-4 per story
  -> .gems/iterations/iter-N/build/phase4-done_Story-X.Y
  -> SCAN
  -> .gems/docs/functions.json
  -> VERIFY
  -> blueprint_verify_report + BLUEPRINT_FILLBACK_PENDING / Complete
```

`Fillback_Story-X.Y.md` ??legacy / VERIFY-after 憿?artifact嚗?? Build story completion marker??
---

## Gate ?瑁痊

| Stage | Artifact | Gate / Tool | ?瑁痊 |
|---|---|---|---|
| Blueprint | `blueprint.md` optional | `blueprint/v5/blueprint-gate.cjs` | 瑼Ｘ?典?閮剛?蝯?嚗ynefin / design review ?芯??批??? |
| Draft | `draft_iter-N.md` | `blueprint/v5/draft-gate.cjs` | 撽? iter ??瘙DD ?瘙? contract ?脣璇辣 |
| Contract | `contract_iter-N.ts` | `blueprint/v5/contract-gate.cjs` | spec-only contract嚗撥??`@TEST`??獢??具?蝛箸挺皜祈岫嚗?甇?implementation syntax |
| Plan | `implementation_plan_*.md` | `tools/spec-to-plan.cjs` + `plan-validator.cjs` | Contract-only planner嚗撥??`@PLAN_TRACE`?ource contract trace?mplementation skeleton / code-level task |
| Build 1 | source skeleton | `phases/build/phase-1.cjs` | 瘨祥 plan嚗炎??skeleton?oundation?oundary?ulti-root?lan quality |
| Build 2 | tests / source | `phases/build/phase-2.cjs` | TDD runner嚗tory-scoped `@TEST`?mpty-test blocker?0/TDD missing `@TEST` blocker?itest / tsc |
| Build 3 | integration surface | `phases/build/phase-3.cjs` | integration/API surface gate嚗@INTEGRATION-TEST` hard gate?oute/export/API agreement?AS / TS surface |
| Build 4 | closure | `phases/build/phase-4.cjs` | runtime readiness + trace coverage closure嚗ingle-line GEMS tag?keleton residue?ntrypoint metadata light check?phase4-done` |
| SCAN | function cache | `phases/scan/scan.cjs` | ?Ｗ canonical function cache ??docs |
| VERIFY | verify report | `blueprint/verify.cjs` | 雿輻 SCAN canonical product 撽? source ??design嚗撓??fillback pending hook |

---

## Build Phase 1-4

### Phase 1: Plan / Skeleton / Boundary
鞎砌遙嚗?- 霈??`implementation_plan_Story-X.Y.md`??- 蝣箄? plan 銝 metadata-only??- 蝣箄? P0/TDD item ??implementation skeleton ??code-level task??- 瑼Ｘ foundation `.0`?ulti-root?ource boundary??- 銝? unit test嚗???integration agreement??
### Phase 2: TDD Runner
鞎砌遙嚗?- 敺?current story ??`@CONTRACT` block ??story-scoped `@TEST`??- 瑼Ｘ皜祈岫瑼??其?銝蝛箸挺嚗撠???`it()` ??`test()`??- P0 ??`SVC/ACTION/HTTP/HOOK/LIB` 蝻?`@TEST` ??BLOCKER??- ??`@TEST` ?? `vitest --run`??- ??TDD ??story ??fallback `tsc --noEmit`??
Phase 2 銝? implementation_plan嚗??? Phase 1??
### Phase 3: Integration / API Surface
鞎砌遙嚗?- 雿輻 multi-root (`backend-gas`, `frontend`, generic `src`)??- P0 surface / P1 HOOK ?閬?`@INTEGRATION-TEST`嚗撩憭梁 BLOCKER??- generic `__tests__` discovery ?芾雿?hint嚗?雿?PASS evidence??- 瑼Ｘ route registration?arrel export?EMS deps/import?PI surface agreement??- 蝚砌???hard coverage 隞?TS/JS export + GAS `google.script.run` ?箔蜓嚗? GAS REST/fetch path matching 隞 TODO / WARN??
### Phase 4: Runtime Readiness + Trace Coverage Closure
鞎砌遙嚗?- 瑼Ｘ Contract -> Plan -> Source -> GEMS tag trace chain??- 瑼Ｘ source GEMS tag ??JSDoc-compatible single-line ?澆???- 瑼Ｘ skeleton residue嚗?憒?`throw new Error('not implemented')`?TODO: fill`?laceholder implementation??- ??entrypoint metadata light check嚗?  - Node/Vite/React: `package.json` 摮銝? `build/typecheck/dev/start/serve` ?嗡葉銋???  - GAS: `appsscript.json` + `.clasp.json`??  - Static: `index.html`??- ?舫?瑁? `refreshTagIndex`嚗????舀迤撘?SCAN??- ?券 PASS ?神??`.gems/iterations/iter-N/build/phase4-done_Story-X.Y`??
GEMS tag ?澆?嚗?
```ts
/** GEMS: createTask | P0 | VALIDATE?RITE?ETURN | Story-11.1 | @TEST: backend-gas/src/modules/tasks/__tests__/task.service.test.ts | @INTEGRATION-TEST: backend-gas/src/modules/tasks/__tests__/task.integration.test.ts | deps:[TaskRepo] */
```

閬?嚗?- GEMS tag 敹?銝銵?- 敹?? name?riority?LOW?tory??- `[STEP]` ??plan / local implementation note嚗??暸?GEMS tag??- `// GEMS:` ?臭? scanner ?詨捆嚗? Phase 4 expected output 銝敺遣霅?JSDoc ?株???
---

## SCAN / VERIFY Contract

SCAN canonical product嚗?- `.gems/docs/functions.json`

SCAN auxiliary docs嚗?- `.gems/docs/project-overview.json`
- `.gems/docs/DB_SCHEMA.md`
- `.gems/docs/CONTRACT.md`
- `.gems/iterations/iter-N/functions-snapshot.json`

??canonical / deprecated嚗?- `function-index.json`
- `system-blueprint.json`
- `schema.json`
- `tech-stack.json`
- `contract.json`

VERIFY 閬?嚗?- VERIFY ?芷撘? `.gems/docs/functions.json`??- VERIFY 銝?auto-scan??- VERIFY 銝撘?fallback ??`function-index.json` ??`functions-snapshot.json`??- 蝻?`functions.json` ??`functions` ?箇征??VERIFY 敹? BLOCKER 銝西?瘙?頝?SCAN??
---

## State / Completion Marker

Canonical story completion marker嚗?
```text
.gems/iterations/iter-N/build/phase4-done_Story-X.Y
```

Flow transition嚗?
```text
Build Phase 4 PASS
  -> ?仿???story ?芸???Build Phase 1 (next story)
  -> ?交???story 摰?嚗CAN
SCAN PASS
  -> VERIFY
VERIFY PASS
  -> BLUEPRINT_FILLBACK_PENDING / Complete
```

Legacy fallback嚗?- `Fillback_Story-X.Y.md` ?航◤ state-machine ?嗉?撠??詨捆閮???- ?唳?蝔?敺? Fillback ??Build story completion marker??
---

## ?桅?蝯?

```text
{project}/
??? src/ ??backend-gas/src + frontend/src
??? .gems/
    ??? design/
    ??  ??? blueprint.md                 # optional
    ??  ??? draft_iter-N.md              # required per iter
    ??? iterations/
    ??  ??? iter-N/
    ??      ??? .state.json
    ??      ??? contract_iter-N.ts
    ??      ??? plan/
    ??      ??  ??? implementation_plan_Story-X.Y.md
    ??      ??? build/
    ??      ??  ??? phase4-done_Story-X.Y
    ??      ??? functions-snapshot.json
    ??      ??? logs/
    ??          ??? blueprint-gate-{pass|error}-{ts}.log
    ??          ??? draft-gate-{pass|error}-{ts}.log
    ??          ??? contract-gate-{pass|error}-{ts}.log
    ??          ??? gate-plan-{pass|error}-{ts}.log
    ??          ??? build-phase-N-Story-X.Y-{pass|error}-{ts}.log
    ??          ??? scan-scan-{pass|error}-{ts}.log
    ??          ??? gate-verify-{pass|error}-{ts}.log
    ??? docs/
    ??  ??? functions.json
    ??  ??? project-overview.json
    ??  ??? DB_SCHEMA.md
    ??  ??? CONTRACT.md
    ??  ??? blueprint-verify.json
    ??? project-memory.json
```

---

## 撣貊?誘

```bash
node sdid-tools/blueprint/v5/blueprint-gate.cjs --blueprint=.gems/design/blueprint.md --target=<project>
node sdid-tools/blueprint/v5/draft-gate.cjs --draft=.gems/design/draft_iter-N.md --target=<project>
node sdid-tools/blueprint/v5/contract-gate.cjs --contract=.gems/iterations/iter-N/contract_iter-N.ts --target=<project> --iter=N
node task-pipe/tools/spec-to-plan.cjs --target=<project> --iteration=iter-N
node task-pipe/runner.cjs --phase=BUILD --step=1 --story=Story-X.Y --target=<project>
node task-pipe/runner.cjs --phase=BUILD --step=2 --story=Story-X.Y --target=<project>
node task-pipe/runner.cjs --phase=BUILD --step=3 --story=Story-X.Y --target=<project>
node task-pipe/runner.cjs --phase=BUILD --step=4 --story=Story-X.Y --target=<project>
node task-pipe/runner.cjs --phase=SCAN --target=<project> --iteration=iter-N
node sdid-tools/blueprint/verify.cjs --draft=.gems/design/draft_iter-N.md --target=<project> --iter=N
```

Retired commands:
- `node sdid-tools/cynefin-log-writer.cjs ...`
- `node sdid-tools/ac-runner.cjs ...`

---

## Key Tools

| Tool | Role |
|---|---|
| `sdid-tools/blueprint/v5/*-gate.cjs` | Blueprint / Draft / Contract gate |
| `task-pipe/tools/spec-to-plan.cjs` | Contract-only planner |
| `task-pipe/phases/build/phase-1~4.cjs` | Build gate implementation |
| `task-pipe/phases/scan/scan.cjs` | Canonical function cache + docs producer |
| `sdid-tools/blueprint/verify.cjs` | SCAN output consumer and final design/source verifier |
| `sdid-core/state-machine.cjs` | State inference and next-step routing |
| `sdid-tools/mcp-server/adapters/loop.mjs` | Operator-facing MCP loop adapter |

---

## Legacy / Compatibility

- Legacy `requirement_spec_*` is `LegacySpec`, not an active route.
- `Task-Pipe` is retired as route semantics.
- `CYNEFIN_CHECK`, `cynefin-log-writer.cjs`, and `cynefin-report.json` are not active workflow steps.
- `ac-runner.cjs` is retired; Phase 2 uses `@TEST` / vitest / tsc.
- `Fillback_Story-X.Y.md` is legacy / VERIFY-after only, not Build completion; new Build completion marker is `phase4-done_Story-X.Y`.
