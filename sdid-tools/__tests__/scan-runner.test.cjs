#!/usr/bin/env node
/**
 * scan-runner.test.cjs
 *
 * Minimum tests covering the 4 fix areas:
 *   1. multi-root functions merge
 *   2. draft path fallback
 *   3. current-style @CONTRACT API extraction
 *   4. scan hub writer output shape
 *
 * Also includes an integration-level smoke test for deps-edges.json.
 *
 * Run: node sdid-tools/__tests__/scan-runner.test.cjs
 */
'use strict';

const fs      = require('fs');
const path    = require('path');
const os      = require('os');

// ─── Minimal test harness ────────────────────────────────────────────────────
let passed = 0, failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

function section(name) {
  console.log(`\n── ${name} ─────────────────────────────────────`);
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scan-test-'));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

// ─── Test 1: multi-root functions merge ──────────────────────────────────────
section('Test 1: multi-root functions merge');
{
  const { collectFunctions } = require('../lib/scan/collect-functions.cjs');

  // collectFunctions accepts string[] — passing non-existent dirs should not throw
  // and should return empty payload (not crash)
  const tmp = tmpDir();
  try {
    const nonExistent1 = path.join(tmp, 'frontend/src');
    const nonExistent2 = path.join(tmp, 'backend-gas/src');

    const payload = collectFunctions([nonExistent1, nonExistent2], tmp, 1);

    assert(typeof payload === 'object',                      'returns an object');
    assert(Array.isArray(payload.functions),                 'functions is array');
    assert(Array.isArray(payload.untagged),                  'untagged is array');
    assert(typeof payload.totalCount    === 'number',        'totalCount is number');
    assert(typeof payload.untaggedCount === 'number',        'untaggedCount is number');
    assert(typeof payload.avgFunctionLines === 'number',     'avgFunctionLines is number');
    assert('P0' in payload.byRisk && 'P1' in payload.byRisk, 'byRisk has P0/P1');
    // With no valid dirs, counts should be 0
    assert(payload.totalCount === 0,    'totalCount=0 when no valid dirs');
    assert(payload.untaggedCount === 0, 'untaggedCount=0 when no valid dirs');
  } finally {
    cleanup(tmp);
  }
}

// ─── Test 2: draft path fallback ─────────────────────────────────────────────
section('Test 2: draft path fallback');
{
  // We test the findDraftFile logic extracted from scan-runner behaviour.
  // scan-runner tries .gems/design/ first, then .gems/iterations/.

  const tmp = tmpDir();
  try {
    const iterNum = 1;

    // Case A: only legacy path exists
    const legacyDir  = path.join(tmp, '.gems/iterations/iter-1');
    const legacyFile = path.join(legacyDir, 'draft_iter-1.md');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(legacyFile, '# legacy draft');

    // Replicate findDraftFile logic inline
    function findDraft(root, n) {
      const candidates = [
        path.join(root, `.gems/design/draft_iter-${n}.md`),
        path.join(root, `.gems/iterations/iter-${n}/draft_iter-${n}.md`),
      ];
      return candidates.find(p => fs.existsSync(p)) || null;
    }

    const foundLegacy = findDraft(tmp, iterNum);
    assert(foundLegacy === legacyFile, 'fallback to .gems/iterations/ path when design/ absent');

    // Case B: design path also exists → should take priority
    const designDir  = path.join(tmp, '.gems/design');
    const designFile = path.join(designDir, 'draft_iter-1.md');
    fs.mkdirSync(designDir, { recursive: true });
    fs.writeFileSync(designFile, '# design draft');

    const foundDesign = findDraft(tmp, iterNum);
    assert(foundDesign === designFile, '.gems/design/ takes priority over .gems/iterations/');

    // Case C: neither exists
    const foundNone = findDraft(tmp, 99);
    assert(foundNone === null, 'returns null when no draft found');

  } finally {
    cleanup(tmp);
  }
}

// ─── Test 3: current-style @CONTRACT extraction ───────────────────────────────
section('Test 3: current-style @CONTRACT API extraction');
{
  const { parseCurrentStyleContracts } = require('../lib/scan/collect-contract.cjs');

  const sampleContract = `
// @CONTRACT: GanttV5Topbar | P1 | UI | Story-13.0
// @RISK: P1 - visual refactor
// @GEMS-FLOW: RENDER_TOPBAR(Clear)
//
// Behavior:
// - renders minimal nav bar
export declare function GanttV5Topbar(props: GanttV5TopbarProps): ReactElement;

// @CONTRACT: WorkflowAPI | P0 | SVC | Story-5.0
export declare function WorkflowAPI(req: WorkflowRequest): Promise<WorkflowResponse>;

// @CONTRACT: HttpEndpoint | P0 | HTTP | Story-2.1
export declare function HttpEndpoint(ctx: Context): void;
`;

  const results = parseCurrentStyleContracts(sampleContract);

  assert(results.length === 3, 'extracts 3 @CONTRACT entries');

  const topbar = results.find(r => r.name === 'GanttV5Topbar');
  assert(!!topbar,                       'GanttV5Topbar found');
  assert(topbar.kind === 'UI',           'kind=UI for UI type');
  assert(topbar.story === 'Story-13.0', 'story parsed correctly (field is .story, write-apis maps to storyId)');
  assert(topbar.priority === 'P1',       'priority parsed correctly');
  assert(topbar.methods.length === 1,    'method extracted from declare function');
  assert(topbar.methods[0].name === 'GanttV5Topbar', 'method name matches');
  assert(topbar.methods[0].params === 'props: GanttV5TopbarProps', 'params extracted');
  assert(topbar.methods[0].returnType === 'ReactElement', 'returnType extracted');

  const svc = results.find(r => r.name === 'WorkflowAPI');
  assert(!!svc,              'WorkflowAPI found');
  assert(svc.kind === 'SVC', 'kind=SVC for SVC type');

  const http = results.find(r => r.name === 'HttpEndpoint');
  assert(!!http,               'HttpEndpoint found');
  assert(http.kind === 'HTTP', 'kind=HTTP for HTTP type');

  // Deduplication test: @GEMS-API entry should win over current-style with same name
  // (tested via collectContract merge logic — check no duplicates)
  const { collectContract } = require('../lib/scan/collect-contract.cjs');
  const tmp = tmpDir();
  try {
    const iterDir      = path.join(tmp, '.gems/iterations/iter-1');
    const contractPath = path.join(iterDir, 'contract_iter-1.ts');
    fs.mkdirSync(iterDir, { recursive: true });
    // Write a contract that has BOTH @GEMS-API and @CONTRACT with same name
    fs.writeFileSync(contractPath, `
// @GEMS-API: SameAPI
// @GEMS-STORY: Story-1.0
export interface SameAPIInterface {
  doThing(x: string): void;
}

// @CONTRACT: SameAPI | P0 | SVC | Story-1.0
export declare function SameAPI(x: string): void;
`);
    const result = collectContract(tmp, 1);
    const sameApiEntries = result.apis.filter(a => a.name === 'SameAPI');
    assert(sameApiEntries.length === 1, 'deduplicates same-name @GEMS-API and @CONTRACT entries');
    assert(sameApiEntries[0]._source !== 'current-style', '@GEMS-API takes priority over current-style');
  } finally {
    cleanup(tmp);
  }
}

// ─── Test 4: scan hub writer output shape ─────────────────────────────────────
section('Test 4: write-scan-hub output shape');
{
  const { writeScanHub } = require('../scan/writers/write-scan-hub.cjs');
  const tmp = tmpDir();
  try {
    writeScanHub({
      projectName: 'TestProject',
      generatedAt: '2026-04-09T00:00:00.000Z',
      inputs: {
        contract: '.gems/iterations/iter-1/contract_iter-1.ts',
        draft:    '.gems/design/draft_iter-1.md',
        srcDirs:  ['frontend/src', 'backend-gas/src'],
      },
      summary: { fnCount: 42, apiCount: 5, schemaCount: 3, moduleCount: 7, edgeCount: 12 },
      outDir: tmp,
    });

    const scanMdPath = path.join(tmp, 'SCAN.md');
    assert(fs.existsSync(scanMdPath), 'SCAN.md is written');

    const content = fs.readFileSync(scanMdPath, 'utf8');
    assert(content.includes('# SCAN Hub'),         'contains # SCAN Hub heading');
    assert(content.includes('TestProject'),         'contains project name');
    assert(content.includes('functions.json'),      'lists functions.json');
    assert(content.includes('deps-edges.json'),     'lists deps-edges.json (not deps.json as projection)');
    assert(content.includes('42'),                  'includes fnCount in output table');
    assert(content.includes('frontend/src'),        'lists srcDirs');
    assert(content.includes('Source-of-Truth'),     'has Source-of-Truth section');
    assert(!content.includes('undefined'),          'no undefined values rendered');
  } finally {
    cleanup(tmp);
  }
}

// ─── Test 5: deps-edges integration smoke ─────────────────────────────────────
section('Test 5: deps-edges.json integration smoke');
{
  const { collectDepsEdges } = require('../lib/scan/collect-deps.cjs');
  const { writeDepsEdges   } = require('../scan/writers/write-deps-edges.cjs');
  const tmp = tmpDir();
  try {
    // Write a minimal deps.json
    const docsDir = path.join(tmp, '.gems/docs');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'deps.json'), JSON.stringify({
      version: '1.0',
      graph: {
        'src/modules/auth/authService.ts': {
          imports: ['src/shared/utils/hash.ts', 'src/modules/user/userRepo.ts'],
          exports: ['AuthService'],
        },
        'src/shared/utils/hash.ts': { imports: [], exports: ['hash'] },
        'src/modules/user/userRepo.ts': { imports: [], exports: ['UserRepo'] },
      },
      circular: [],
      unusedExports: [],
    }, null, 2));

    const edges = collectDepsEdges(tmp);
    assert(!!edges,                     'collectDepsEdges returns non-null');
    assert(Array.isArray(edges.edges),  'edges.edges is array');

    // Cross-module edges: modules → shared (different top-level segments under src/)
    // src/modules/auth → src/shared (modules vs shared = cross)
    // src/modules/auth → src/modules/user (modules = modules = same, skip)
    const crossEdges = edges.edges.filter(e =>
      e.from === 'src/modules/auth/authService.ts' &&
      e.to   === 'src/shared/utils/hash.ts'
    );
    assert(crossEdges.length === 1, 'cross-module edge (modules→shared) is kept');

    const sameModuleEdge = edges.edges.filter(e =>
      e.from === 'src/modules/auth/authService.ts' &&
      e.to   === 'src/modules/user/userRepo.ts'
    );
    assert(sameModuleEdge.length === 0, 'same-module edge (modules→modules) is dropped');

    // Write and verify deps-edges.json
    const out = writeDepsEdges(edges, docsDir, 'TestProject');
    assert(!!out,                                    'writeDepsEdges returns non-null');
    assert(fs.existsSync(path.join(docsDir, 'deps-edges.json')), 'deps-edges.json written');

    const written = JSON.parse(fs.readFileSync(path.join(docsDir, 'deps-edges.json'), 'utf8'));
    assert(written.version === '1',              'version field present');
    assert(written.generatedBy === 'scan-runner', 'generatedBy correct');
    assert(Array.isArray(written.edges),          'edges array present');
    assert(written.note?.includes('deps.json'),   'note references deps.json');

    // deps.json (raw) must NOT be touched by writeDepsEdges
    const rawDeps = JSON.parse(fs.readFileSync(path.join(docsDir, 'deps.json'), 'utf8'));
    assert(rawDeps.graph !== undefined, 'deps.json raw graph still intact');
  } finally {
    cleanup(tmp);
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n════════════════════════════════════════`);
console.log(`  Passed: ${passed}   Failed: ${failed}`);
console.log(`════════════════════════════════════════\n`);
if (failed > 0) process.exit(1);
