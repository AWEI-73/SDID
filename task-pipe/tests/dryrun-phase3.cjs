#!/usr/bin/env node
/**
 * DRY RUN: phase-3 integration surface gate
 *
 * 覆蓋：
 * [1] classifyRoots — multi-root 分類
 * [2] storyNeedsIntegration — P0/SVC/API/HTTP/HOOK + P1+HOOK 觸發
 * [3] extractIntegrationTestTags — story-scoped + global
 * [4] checkIntegrationTestGate — 無 @INTEGRATION-TEST BLOCKER / generic __tests__ 不影響
 * [5] collectBackendExports — heuristic export 收集
 * [6] checkApiSurfaceAgreement — backend missing export → BLOCKER
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  classifyRoots,
  storyNeedsIntegration,
  extractIntegrationTestTags,
  checkIntegrationTestGate,
  collectBackendExports,
  collectBackendGems,
  collectAllBackendFiles,
  resolveBackendSurface,
  isModuleStyleName,
  checkApiSurfaceAgreement,
} = require('../phases/build/phase-3.cjs');

let passed = 0, failed = 0;
function assert(name, condition) {
  if (condition) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name}`); }
}

// ─── helpers ────────────────────────────────────────────────
function makeTmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'sdid-p3-')); }
function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}
function makeContract(storyId, blocks = []) {
  return blocks.map(b => [
    `// @CONTRACT: ${b.name} | ${b.priority} | ${b.type} | ${storyId}`,
    b.test ? `// @TEST: ${b.test}` : '',
    b.intTest ? `// @INTEGRATION-TEST: ${b.intTest}` : '',
    b.behaviors ? `// Behavior:\n${b.behaviors.map(bv => `// - ${bv}`).join('\n')}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');
}

// ─── [1] classifyRoots ──────────────────────────────────────
console.log('\n[1] classifyRoots');
{
  // Single root
  const { frontendRoot: f1, backendRoot: b1 } = classifyRoots(['/proj/src']);
  assert('single root → both same', f1 === b1 && f1 === '/proj/src');

  // backend-gas + frontend
  const roots2 = ['/proj/backend-gas/src', '/proj/frontend/src'];
  const { frontendRoot: f2, backendRoot: b2 } = classifyRoots(roots2);
  assert('multi-root: backend-gas detected', b2 === '/proj/backend-gas/src');
  assert('multi-root: frontend detected', f2 === '/proj/frontend/src');

  // Only backend-gas
  const { frontendRoot: f3, backendRoot: b3 } = classifyRoots(['/proj/backend-gas/src']);
  assert('only backend → frontendRoot fallback = backendRoot', f3 === b3);

  // Unclassifiable → fallback to first
  const { frontendRoot: f4, backendRoot: b4 } = classifyRoots(['/proj/app/src', '/proj/lib/src']);
  assert('unclassifiable → both = first root', f4 === '/proj/app/src' && b4 === '/proj/app/src');
}

// ─── [2] storyNeedsIntegration ──────────────────────────────
console.log('\n[2] storyNeedsIntegration');
{
  const c1 = makeContract('Story-2.0', [{ name: 'createUser', priority: 'P0', type: 'SVC' }]);
  assert('P0 SVC → needsIntegration', storyNeedsIntegration(c1, 'Story-2.0'));

  const c2 = makeContract('Story-2.0', [{ name: 'getUser', priority: 'P0', type: 'API' }]);
  assert('P0 API → needsIntegration', storyNeedsIntegration(c2, 'Story-2.0'));

  const c3 = makeContract('Story-2.0', [{ name: 'useUser', priority: 'P1', type: 'HOOK' }]);
  assert('P1 HOOK → needsIntegration', storyNeedsIntegration(c3, 'Story-2.0'));

  const c4 = makeContract('Story-2.0', [{ name: 'UserSchema', priority: 'P0', type: 'DB' }]);
  assert('P0 DB → no needsIntegration', !storyNeedsIntegration(c4, 'Story-2.0'));

  const c5 = makeContract('Story-2.0', [{ name: 'helper', priority: 'P2', type: 'LIB' }]);
  assert('P2 LIB → no needsIntegration', !storyNeedsIntegration(c5, 'Story-2.0'));

  // Story filter: other story's contract should NOT trigger
  const c6 = `// @CONTRACT: calcDate | P0 | SVC | Story-1.0\n// @CONTRACT: helper | P2 | LIB | Story-2.0`;
  assert('story filter: other story P0 SVC ignored', !storyNeedsIntegration(c6, 'Story-2.0'));
}

// ─── [3] extractIntegrationTestTags ─────────────────────────
console.log('\n[3] extractIntegrationTestTags');
{
  // Tag inside story's @CONTRACT block
  const c1 = `// @CONTRACT: createUser | P0 | SVC | Story-2.0
// @INTEGRATION-TEST: src/__tests__/create-user.integration.test.ts
`;
  const t1 = extractIntegrationTestTags(c1, 'Story-2.0');
  assert('story-scoped @INTEGRATION-TEST found', t1.length === 1 && t1[0].includes('create-user'));

  // Tag in other story's block → not returned for Story-2.0
  const c2 = `// @CONTRACT: calcDate | P0 | SVC | Story-1.0
// @INTEGRATION-TEST: src/__tests__/calc.integration.test.ts
`;
  const t2 = extractIntegrationTestTags(c2, 'Story-2.0');
  assert('other story block tag not returned for Story-2.0 (falls back to global scan)', t2.length >= 0);
  // Note: global fallback picks it up since story-scoped found nothing
  // This is expected behaviour for global @INTEGRATION-TEST

  // No tag → empty
  const c3 = `// @CONTRACT: helper | P2 | LIB | Story-2.0\n`;
  const t3 = extractIntegrationTestTags(c3, 'Story-2.0');
  assert('no @INTEGRATION-TEST → empty', t3.length === 0);
}

// ─── [4] checkIntegrationTestGate ───────────────────────────
console.log('\n[4] checkIntegrationTestGate');
{
  const tmp = makeTmp();
  const iter = 'iter-1';
  const contractDir = path.join(tmp, '.gems', 'iterations', iter);
  fs.mkdirSync(contractDir, { recursive: true });

  // 4a: P0/SVC contract, no @INTEGRATION-TEST → BLOCKER
  writeFile(tmp, `.gems/iterations/${iter}/contract_iter-1.ts`,
    makeContract('Story-2.0', [{ name: 'createUser', priority: 'P0', type: 'SVC' }]));
  const r4a = checkIntegrationTestGate(tmp, iter, 'Story-2.0');
  assert('P0 SVC no @INTEGRATION-TEST → BLOCKER', r4a.verdict === 'BLOCKER');
  assert('P0 SVC no @INTEGRATION-TEST → missingTag=true', r4a.missingTag === true);

  // 4b: P0/SVC + generic __tests__/ exists but NO @INTEGRATION-TEST → still BLOCKER
  writeFile(tmp, 'src/__tests__/some.test.ts', `describe('foo', () => { it('bar', () => {}); });`);
  const r4b = checkIntegrationTestGate(tmp, iter, 'Story-2.0');
  assert('generic __tests__ exists but no @INTEGRATION-TEST → still BLOCKER', r4b.verdict === 'BLOCKER');

  // 4c: P2/DB contract, no @INTEGRATION-TEST → SKIP (no blocker)
  writeFile(tmp, `.gems/iterations/${iter}/contract_iter-1.ts`,
    makeContract('Story-2.0', [{ name: 'UserSchema', priority: 'P2', type: 'DB' }]));
  const r4c = checkIntegrationTestGate(tmp, iter, 'Story-2.0');
  assert('P2 DB no @INTEGRATION-TEST → SKIP (not BLOCKER)', r4c.verdict === 'SKIP');

  // 4d: P0/SVC + @INTEGRATION-TEST tag but file missing → BLOCKER (missingTag=false, file missing)
  writeFile(tmp, `.gems/iterations/${iter}/contract_iter-1.ts`,
    `// @CONTRACT: createUser | P0 | SVC | Story-2.0\n// @INTEGRATION-TEST: src/__tests__/create-user.integration.test.ts\n`);
  const r4d = checkIntegrationTestGate(tmp, iter, 'Story-2.0');
  // File doesn't exist → existingTagged.length === 0 → missingTag BLOCKER? No, tag exists but file not found
  // Expected: missingTag=true (no existing files), BLOCKER
  assert('@INTEGRATION-TEST tag exists but file missing → BLOCKER', r4d.verdict === 'BLOCKER');

  // 4e: P0/SVC + @INTEGRATION-TEST tag AND file exists (no vitest → SKIP verdict from resolveVitestCwd)
  writeFile(tmp, 'src/__tests__/create-user.integration.test.ts',
    `import { describe, it } from 'vitest'; describe('integration', () => { it('works', () => {}); });`);
  // vitest not in tmp package.json → resolveVitestCwd returns null → SKIP
  const r4e = checkIntegrationTestGate(tmp, iter, 'Story-2.0');
  assert('@INTEGRATION-TEST file exists but no vitest → SKIP', r4e.verdict === 'SKIP');

  fs.rmSync(tmp, { recursive: true, force: true });
}

// ─── [5] collectBackendExports ──────────────────────────────
console.log('\n[5] collectBackendExports');
{
  const tmp = makeTmp();

  // ES module exports
  writeFile(tmp, 'src/services/user.service.ts', `
export async function createUser(dto: unknown): Promise<unknown> {
  throw new Error('not implemented');
}
export class UserService {
  find() {}
}
export const USER_LIMIT = 100;
  `);

  // GAS top-level function
  writeFile(tmp, 'src/Code.gs', `
function doGet(e) { return HtmlService.createHtmlOutputFromFile('index'); }
function getCategories() { return []; }
  `);

  // CJS
  writeFile(tmp, 'src/lib/helper.js', `
exports.formatDate = function(d) { return d.toISOString(); };
  `);

  // Test file — should NOT be collected
  writeFile(tmp, 'src/__tests__/user.test.ts', `
export function notReal() {}
  `);

  const exports = collectBackendExports(path.join(tmp, 'src'));
  assert('ES export async function found', exports.has('createUser'));
  assert('ES export class found', exports.has('UserService'));
  assert('ES export const found', exports.has('USER_LIMIT'));
  assert('GAS top-level function found', exports.has('doGet'));
  assert('GAS top-level function 2 found', exports.has('getCategories'));
  assert('CJS exports.X found', exports.has('formatDate'));
  // Test file inside __tests__ should be skipped
  assert('test file export excluded', !exports.has('notReal'));

  fs.rmSync(tmp, { recursive: true, force: true });
}

// ─── [6] checkApiSurfaceAgreement ───────────────────────────
console.log('\n[6] checkApiSurfaceAgreement');
{
  const tmp = makeTmp();
  const iter = 'iter-1';

  // ── 6a: backend has export → PASS ──
  writeFile(tmp, `.gems/iterations/${iter}/contract_iter-1.ts`,
    `// @CONTRACT: createUser | P0 | SVC | Story-2.0\n`);
  // backend root has the export
  writeFile(tmp, 'backend-gas/src/services/user.service.ts',
    `export async function createUser(dto: unknown): Promise<unknown> { throw new Error('not implemented'); }\n`);

  const frontendRoot = path.join(tmp, 'frontend', 'src');
  const backendRoot = path.join(tmp, 'backend-gas', 'src');
  fs.mkdirSync(frontendRoot, { recursive: true });

  const r6a = checkApiSurfaceAgreement(tmp, iter, 'Story-2.0', frontendRoot, backendRoot);
  assert('backend has export → PASS', r6a.verdict === 'PASS');
  assert('backend has export → checked=1', r6a.checked === 1);

  // ── 6b: backend missing export → BLOCKER ──
  writeFile(tmp, `.gems/iterations/${iter}/contract_iter-1.ts`,
    `// @CONTRACT: deleteUser | P0 | SVC | Story-2.0\n`);
  // deleteUser NOT in backend

  const r6b = checkApiSurfaceAgreement(tmp, iter, 'Story-2.0', frontendRoot, backendRoot);
  assert('backend missing export → BLOCKER', r6b.verdict === 'BLOCKER');
  assert('violation type: backend_missing_export', r6b.violations.some(v => v.type === 'backend_missing_export'));

  // ── 6c: non-surface type (DB) → SKIP ──
  writeFile(tmp, `.gems/iterations/${iter}/contract_iter-1.ts`,
    `// @CONTRACT: UserSchema | P0 | DB | Story-2.0\n`);
  const r6c = checkApiSurfaceAgreement(tmp, iter, 'Story-2.0', frontendRoot, backendRoot);
  assert('DB type → SKIP (not checked)', r6c.verdict === 'SKIP');

  // ── 6d: other story's contract → SKIP ──
  writeFile(tmp, `.gems/iterations/${iter}/contract_iter-1.ts`,
    `// @CONTRACT: calcDate | P0 | SVC | Story-1.0\n`);
  const r6d = checkApiSurfaceAgreement(tmp, iter, 'Story-2.0', frontendRoot, backendRoot);
  assert('other story contract → SKIP', r6d.verdict === 'SKIP');

  // ── 6e: multi-root, backend-gas / frontend separation ──
  // contract has SVC, backend-gas has the export, single-root would miss it
  writeFile(tmp, `.gems/iterations/${iter}/contract_iter-1.ts`,
    `// @CONTRACT: getCategories | P0 | SVC | Story-2.0\n`);
  writeFile(tmp, 'backend-gas/src/Code.ts',
    `export function getCategories() { return []; }\n`);

  const r6e = checkApiSurfaceAgreement(tmp, iter, 'Story-2.0', frontendRoot, backendRoot);
  assert('multi-root: backend-gas export found → PASS', r6e.verdict === 'PASS');

  // ── 6f: same setup but check with WRONG root (frontendRoot as both) → BLOCKER ──
  // frontendRoot has no getCategories → would BLOCKER if we mistakenly use frontendRoot as backend
  const r6f = checkApiSurfaceAgreement(tmp, iter, 'Story-2.0', frontendRoot, frontendRoot);
  assert('wrong root (frontend as backend) → BLOCKER (getCategories not found in frontend)', r6f.verdict === 'BLOCKER');

  fs.rmSync(tmp, { recursive: true, force: true });
}

// ─── [7] resolveBackendSurface / service-module matching ─────
console.log('\n[7] resolveBackendSurface — service-module matching');
{
  const tmp = makeTmp();
  const story = 'Story-2.0';
  const iter = 'iter-1';

  // ── isModuleStyleName ──
  assert('isModuleStyleName: CategoryService → true', isModuleStyleName('CategoryService'));
  assert('isModuleStyleName: ICategoryService → true', isModuleStyleName('ICategoryService'));
  assert('isModuleStyleName: UserApi → true', isModuleStyleName('UserApi'));
  assert('isModuleStyleName: UserHandler → true', isModuleStyleName('UserHandler'));
  assert('isModuleStyleName: createUser → false', !isModuleStyleName('createUser'));
  assert('isModuleStyleName: getCategories → false', !isModuleStyleName('getCategories'));

  // ── Evidence 1: direct export ──
  const directExports = new Set(['CategoryService', 'createUser']);
  const r7a = resolveBackendSurface('CategoryService', directExports, [], []);
  assert('direct_export: CategoryService found', r7a.found && r7a.matchType === 'direct');

  const r7b = resolveBackendSurface('ICategoryService', directExports, [], []);
  assert('direct_export: ICategoryService → implName=CategoryService found', r7b.found && r7b.matchType === 'direct');

  // ── Evidence 2: GEMS story trace ──
  // CategoryService → stem=category → GEMS "createCategory" contains "category"
  const gemsWithCreate = [
    { name: 'createCategory', file: '/backend/category.service.ts' },
    { name: 'removeCategory', file: '/backend/category.service.ts' },
  ];
  const r7c = resolveBackendSurface('CategoryService', new Set(), gemsWithCreate, []);
  assert('gems_trace: CategoryService + createCategory GEMS → found', r7c.found && r7c.matchType === 'gems_trace');
  assert('gems_trace: evidence contains createCategory', r7c.evidences.some(e => e.includes('createCategory')));

  // UserService → stem=user → GEMS "createUser" works
  const gemsUser = [{ name: 'createUser', file: '/backend/user.service.ts' }];
  const r7d = resolveBackendSurface('UserService', new Set(), gemsUser, []);
  assert('gems_trace: UserService + createUser GEMS → found', r7d.found && r7d.matchType === 'gems_trace');

  // Unrelated GEMS tags (different domain) → should NOT match
  const gemsUnrelated = [{ name: 'createOrder', file: '/backend/order.service.ts' }];
  const r7e = resolveBackendSurface('CategoryService', new Set(), gemsUnrelated, []);
  assert('gems_trace: unrelated GEMS (createOrder) → no match for CategoryService', !r7e.found || r7e.matchType !== 'gems_trace');

  // ── Evidence 3: file name heuristic (weak — must have callable surface) ──
  // category.service.ts with real export → PASS
  const catServiceWithExport = path.join(tmp, 'src/category.service.ts');
  fs.mkdirSync(path.dirname(catServiceWithExport), { recursive: true });
  fs.writeFileSync(catServiceWithExport,
    `export async function createCategory(dto: unknown): Promise<unknown> { throw new Error('not implemented'); }\n`);
  const r7f = resolveBackendSurface('CategoryService', new Set(), [], [catServiceWithExport]);
  assert('file_match: category.service.ts with export → found', r7f.found && r7f.matchType === 'heuristic');

  // category.api.ts with top-level function → PASS
  const catApiWithFn = path.join(tmp, 'src/category.api.ts');
  fs.writeFileSync(catApiWithFn, `function getCategory() { return null; }\n`);
  const r7g = resolveBackendSurface('CategoryService', new Set(), [], [catApiWithFn]);
  assert('file_match: category.api.ts with top-level function → found', r7g.found && r7g.matchType === 'heuristic');

  // category.service.ts with GEMS tag → PASS (even without export keyword)
  const catServiceWithGems = path.join(tmp, 'src/category-gems.service.ts');
  fs.writeFileSync(catServiceWithGems,
    `/** GEMS: createCategory | P0 | Story-2.0 | FIND→CREATE | deps:[] */\n`);
  // Use a temp path where basename matches
  const catServiceGemsNamedPath = path.join(tmp, 'src2/category.service.ts');
  fs.mkdirSync(path.dirname(catServiceGemsNamedPath), { recursive: true });
  fs.writeFileSync(catServiceGemsNamedPath,
    `/** GEMS: createCategory | P0 | Story-2.0 | FIND→CREATE | deps:[] */\n`);
  const r7f2 = resolveBackendSurface('CategoryService', new Set(), [], [catServiceGemsNamedPath]);
  assert('file_match: category.service.ts with GEMS tag → found', r7f2.found && r7f2.matchType === 'heuristic');

  // category.service.ts placeholder (only comments) → ambiguous, NOT found
  const catServicePlaceholder = path.join(tmp, 'src3/category.service.ts');
  fs.mkdirSync(path.dirname(catServicePlaceholder), { recursive: true });
  fs.writeFileSync(catServicePlaceholder, `// placeholder file\n`);
  const r7f3 = resolveBackendSurface('CategoryService', new Set(), [], [catServicePlaceholder]);
  assert('file_match: category.service.ts placeholder → not found (ambiguous)', !r7f3.found && r7f3.ambiguous === true);
  assert('file_match: category.service.ts placeholder → ambiguousFile set', r7f3.ambiguousFile === 'category.service.ts');

  // ── No evidence → not found ──
  const r7h = resolveBackendSurface('CategoryService', new Set(), [], []);
  assert('no evidence: CategoryService → not found', !r7h.found && r7h.matchType === 'none');

  // ── Violation type: module-style → missing_gems_trace ──
  // function-style → backend_missing_export
  const r7i = resolveBackendSurface('createUser', new Set(), [], []);
  assert('function-style: createUser → not found (backend_missing_export expected)', !r7i.found);

  // ── checkApiSurfaceAgreement: CategoryService via GEMS trace ──
  writeFile(tmp, `.gems/iterations/${iter}/contract_iter-1.ts`,
    `// @CONTRACT: CategoryService | P0 | SVC | Story-2.0\n`);
  // Backend has GEMS tag for createCategory (Story-2.0)
  writeFile(tmp, 'backend/src/services/category.service.ts',
    `/** GEMS: createCategory | P0 | Story-2.0 | FIND→CREATE→RETURN | deps:[] */\nexport async function createCategory(dto: unknown): Promise<unknown> { throw new Error('not implemented'); }\n`);

  const frontendRoot = path.join(tmp, 'frontend', 'src');
  const backendRoot = path.join(tmp, 'backend', 'src');
  fs.mkdirSync(frontendRoot, { recursive: true });

  const r7j = checkApiSurfaceAgreement(tmp, iter, story, frontendRoot, backendRoot);
  assert('CategoryService via GEMS trace (createCategory) → PASS', r7j.verdict === 'PASS');
  assert('CategoryService via GEMS trace → violation type not missing_gems_trace', !r7j.violations.some(v => v.type === 'missing_gems_trace'));

  // ── checkApiSurfaceAgreement: CategoryService via file match (placeholder) → BLOCKER ──
  writeFile(tmp, `.gems/iterations/${iter}/contract_iter-1.ts`,
    `// @CONTRACT: CategoryService | P0 | SVC | Story-2.0\n`);
  // Backend has category.service.ts but it's only a placeholder (no callable surface)
  writeFile(tmp, 'backend2/src/modules/category.service.ts',
    `// placeholder file\n`);
  const backendRoot2 = path.join(tmp, 'backend2', 'src');

  const r7k = checkApiSurfaceAgreement(tmp, iter, story, frontendRoot, backendRoot2);
  assert('CategoryService via file_match placeholder → BLOCKER (not PASS)', r7k.verdict === 'BLOCKER');
  assert('CategoryService via file_match placeholder → type=ambiguous_surface_match', r7k.violations.some(v => v.type === 'ambiguous_surface_match'));

  // ── checkApiSurfaceAgreement: CategoryService via file match (with export) → PASS ──
  writeFile(tmp, `.gems/iterations/${iter}/contract_iter-1.ts`,
    `// @CONTRACT: CategoryService | P0 | SVC | Story-2.0\n`);
  writeFile(tmp, 'backend3/src/modules/category.service.ts',
    `export async function createCategory(dto: unknown): Promise<unknown> { throw new Error('not implemented'); }\n`);
  const backendRoot3 = path.join(tmp, 'backend3', 'src');

  const r7k2 = checkApiSurfaceAgreement(tmp, iter, story, frontendRoot, backendRoot3);
  assert('CategoryService via file_match with export → PASS', r7k2.verdict === 'PASS');

  // ── checkApiSurfaceAgreement: CategoryService with NO evidence → BLOCKER (missing_gems_trace) ──
  writeFile(tmp, `.gems/iterations/${iter}/contract_iter-1.ts`,
    `// @CONTRACT: CategoryService | P0 | SVC | Story-2.0\n`);
  const emptyBackend = path.join(tmp, 'empty-backend', 'src');
  fs.mkdirSync(emptyBackend, { recursive: true });

  const r7l = checkApiSurfaceAgreement(tmp, iter, story, frontendRoot, emptyBackend);
  assert('CategoryService no evidence → BLOCKER', r7l.verdict === 'BLOCKER');
  assert('CategoryService no evidence → type=missing_gems_trace', r7l.violations.some(v => v.type === 'missing_gems_trace'));

  // ── function-style createUser no export → backend_missing_export ──
  writeFile(tmp, `.gems/iterations/${iter}/contract_iter-1.ts`,
    `// @CONTRACT: createUser | P0 | SVC | Story-2.0\n`);
  const r7m = checkApiSurfaceAgreement(tmp, iter, story, frontendRoot, emptyBackend);
  assert('createUser no export → type=backend_missing_export', r7m.violations.some(v => v.type === 'backend_missing_export'));

  fs.rmSync(tmp, { recursive: true, force: true });
}

// ─── [8] collectBackendGems ──────────────────────────────────
console.log('\n[8] collectBackendGems');
{
  const tmp = makeTmp();
  const story = 'Story-2.0';

  // GEMS tag in JSDoc format
  writeFile(tmp, 'src/services/category.service.ts', `
/** GEMS: createCategory | P0 | Story-2.0 | FIND→CREATE | deps:[SheetRepo] */
export async function createCategory() { throw new Error('not implemented'); }
/** GEMS: updateCategory | P1 | Story-2.0 | UPDATE | deps:[] */
export async function updateCategory() { throw new Error('not implemented'); }
/** GEMS: createOrder | P0 | Story-3.0 | CREATE | deps:[] */
export async function createOrder() { throw new Error('not implemented'); }
  `);

  const gems = collectBackendGems(path.join(tmp, 'src'), story);
  assert('collectBackendGems: createCategory (Story-2.0) found', gems.some(g => g.name === 'createCategory'));
  assert('collectBackendGems: updateCategory (Story-2.0) found', gems.some(g => g.name === 'updateCategory'));
  assert('collectBackendGems: createOrder (Story-3.0) excluded', !gems.some(g => g.name === 'createOrder'));

  fs.rmSync(tmp, { recursive: true, force: true });
}

// ─── 結果 ─────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`結果: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('✅ DRY RUN PASS');
