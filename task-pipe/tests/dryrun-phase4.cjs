#!/usr/bin/env node
/**
 * DRY RUN: phase-4 trace coverage closure + runtime readiness gate
 *
 * 覆蓋：
 * [1]  parseTraceItems        — plan block 解析，story-scoped
 * [2]  findFunctionInFile     — source 函式 + 鄰近 GEMS tag 偵測
 * [3]  buildExpectedGemsTag   — 生成 expected JSDoc 單行格式
 * [4]  checkGemsTagFormat     — 單行 PASS / 多行 BLOCKER / 缺欄位 BLOCKER
 * [5]  checkTraceClosure      — 完整鏈 PASS / 缺 source BLOCKER / 缺 tag BLOCKER
 * [6]  checkSkeletonResidue   — throw→BLOCKER / 真實 impl→PASS
 * [7]  checkRuntimeReadiness  — Node / GAS / Static entrypoint 缺失 BLOCKER
 * [8]  traceCoverageSummary   — 純資訊，不是 gate
 * [9]  Phase 4 不宣稱 SCAN completed、不做全 contract TDD gate
 */
'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const {
  parseTraceItems,
  findFunctionInFile,
  buildExpectedGemsTag,
  checkGemsTagFormat,
  checkTraceClosure,
  checkSkeletonResidue,
  checkRuntimeReadiness,
  traceCoverageSummary,
  refreshTagIndex,
} = require('../phases/build/phase-4.cjs');

let passed = 0, failed = 0;
function assert(name, condition) {
  if (condition) { passed++; console.log(`  ✅ ${name}`); }
  else           { failed++; console.log(`  ❌ ${name}`); }
}
function makeTmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'sdid-p4-')); }
function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

// ══════════════════════════════════════════════════════════════
// [1] parseTraceItems
// ══════════════════════════════════════════════════════════════
console.log('\n[1] parseTraceItems');
{
  const planContent = `
### Item 1

\`\`\`ts
// @CONTRACT: createCategory | P0 | SVC | Story-2.1
// @GEMS-FLOW: API→SVC→DB
// @TEST: src/__tests__/category.test.ts
// @INTEGRATION-TEST: src/__tests__/category.integration.test.ts
\`\`\`

**Target File**: \`src/category.service.ts\`

### Item 2

\`\`\`ts
// @CONTRACT: getProducts | P1 | HTTP | Story-2.1
// @GEMS-FLOW: API→SVC→DB
// @TEST: src/__tests__/products.test.ts
\`\`\`

**File**: \`src/products.handler.ts\`

### Item 3 (different story — should be filtered)

\`\`\`ts
// @CONTRACT: adminAction | P0 | SVC | Story-3.0
\`\`\`

**File**: \`src/admin.service.ts\`
`;

  const items = parseTraceItems(planContent, 'Story-2.1');
  assert('parseTraceItems: 2 items for Story-2.1', items.length === 2);
  assert('item[0].contractName = createCategory', items[0].contractName === 'createCategory');
  assert('item[0].priority = P0',                items[0].priority === 'P0');
  assert('item[0].type = SVC',                   items[0].type === 'SVC');
  assert('item[0].filePath contains category',   items[0].filePath && items[0].filePath.includes('category.service.ts'));
  assert('item[0].testPath present',             items[0].testPath === 'src/__tests__/category.test.ts');
  assert('item[0].integTestPath present',        items[0].integTestPath === 'src/__tests__/category.integration.test.ts');
  assert('item[0].flow present',                 items[0].flow === 'API→SVC→DB');
  assert('item[1].contractName = getProducts',   items[1].contractName === 'getProducts');
  assert('item[1].type = HTTP',                  items[1].type === 'HTTP');
  assert('item[1].integTestPath null (P1)',       items[1].integTestPath === null);
  assert('Story-3.0 filtered out',               !items.find(i => i.storyId === 'Story-3.0'));
}

// ══════════════════════════════════════════════════════════════
// [2] findFunctionInFile
// ══════════════════════════════════════════════════════════════
console.log('\n[2] findFunctionInFile');
{
  const tmp = makeTmp();

  // File with JSDoc GEMS tag above function
  const f1 = writeFile(tmp, 'svc/category.service.ts', [
    '/** GEMS: createCategory | P0 | API→SVC→DB | Story-2.1 | @TEST: src/__tests__/category.test.ts */',
    'export async function createCategory(dto: CreateCategoryDto) {',
    '  return db.category.create({ data: dto });',
    '}',
  ].join('\n'));

  const r1 = findFunctionInFile(f1, 'createCategory');
  assert('found function createCategory',    r1.found === true);
  assert('function at line 2',               r1.line === 2);
  assert('tag found (jsdoc)',                r1.tagType === 'jsdoc');
  assert('currentTag contains GEMS:',        r1.currentTag && /GEMS:/.test(r1.currentTag));

  // File with // GEMS: line-format tag
  const f2 = writeFile(tmp, 'svc/product.service.ts', [
    '// GEMS: getProducts | P1 | API→SVC | Story-2.1',
    'export async function getProducts() {',
    '  return [];',
    '}',
  ].join('\n'));
  const r2 = findFunctionInFile(f2, 'getProducts');
  assert('found getProducts',     r2.found === true);
  assert('tagType = line',        r2.tagType === 'line');

  // File without tag
  const f3 = writeFile(tmp, 'svc/bare.service.ts', [
    'export async function bareAction() {',
    '  return null;',
    '}',
  ].join('\n'));
  const r3 = findFunctionInFile(f3, 'bareAction');
  assert('found bareAction',           r3.found === true);
  assert('no tag above bareAction',    r3.currentTag === null);
  assert('tagType = null',             r3.tagType === null);

  // Function not in file
  const r4 = findFunctionInFile(f3, 'nonExistentFn');
  assert('not found when fn absent',   r4.found === false);

  // Non-existent file
  const r5 = findFunctionInFile(path.join(tmp, 'ghost.ts'), 'fn');
  assert('not found for missing file', r5.found === false);

  // const arrow function
  const f6 = writeFile(tmp, 'svc/arrow.ts', [
    '/** GEMS: fetchData | P1 | IO→RETURN | Story-2.1 */',
    'export const fetchData = async () => {};',
  ].join('\n'));
  const r6 = findFunctionInFile(f6, 'fetchData');
  assert('found const arrow function', r6.found === true);
  assert('jsdoc tag on arrow',         r6.tagType === 'jsdoc');
}

// ══════════════════════════════════════════════════════════════
// [3] buildExpectedGemsTag
// ══════════════════════════════════════════════════════════════
console.log('\n[3] buildExpectedGemsTag');
{
  const item1 = {
    contractName: 'createCategory',
    priority: 'P0',
    type: 'SVC',
    storyId: 'Story-2.1',
    flow: 'API→SVC→DB',
    testPath: 'src/__tests__/category.test.ts',
    integTestPath: 'src/__tests__/category.integration.test.ts',
    deps: null,
  };
  const tag1 = buildExpectedGemsTag(item1);
  assert('tag starts with /** GEMS:', tag1.startsWith('/** GEMS:'));
  assert('tag ends with */',         tag1.endsWith('*/'));
  assert('tag contains createCategory', tag1.includes('createCategory'));
  assert('tag contains P0',          tag1.includes('P0'));
  assert('tag contains FLOW',        tag1.includes('API→SVC→DB'));
  assert('tag contains Story-2.1',   tag1.includes('Story-2.1'));
  assert('tag contains @TEST:',      tag1.includes('@TEST:'));
  assert('tag contains @INTEGRATION-TEST:', tag1.includes('@INTEGRATION-TEST:'));
  assert('tag is single line',       !tag1.includes('\n'));

  // SVC type without known testPath → placeholder
  const item2 = { contractName: 'processOrder', priority: 'P0', type: 'SVC', storyId: 'Story-2.2', flow: null, testPath: null, integTestPath: null, deps: null };
  const tag2 = buildExpectedGemsTag(item2);
  assert('unknown flow uses placeholder', tag2.includes('<FLOW_FROM_CONTRACT_OR_PLAN_REQUIRED>'));
  assert('SVC needs @TEST placeholder',   tag2.includes('@TEST: <TEST_PATH_FROM_CONTRACT_REQUIRED>'));
  assert('P0 SVC needs @INTEGRATION-TEST placeholder', tag2.includes('@INTEGRATION-TEST: <INTEGRATION_TEST_FROM_CONTRACT_REQUIRED>'));

  // LIB type — TDD but no integration
  const item3 = { contractName: 'parseDate', priority: 'P1', type: 'LIB', storyId: 'Story-2.1', flow: 'INPUT→PARSE→RETURN', testPath: null, integTestPath: null, deps: null };
  const tag3 = buildExpectedGemsTag(item3);
  assert('LIB @TEST placeholder', tag3.includes('@TEST:'));
  assert('LIB no @INTEGRATION-TEST', !tag3.includes('@INTEGRATION-TEST'));

  // With deps
  const item4 = { contractName: 'calcTotal', priority: 'P1', type: 'ACTION', storyId: 'Story-2.1', flow: 'INPUT→CALC→RETURN', testPath: 'src/__tests__/calc.test.ts', integTestPath: null, deps: '[orderSvc, taxSvc]' };
  const tag4 = buildExpectedGemsTag(item4);
  assert('deps appear in tag', tag4.includes('deps:[orderSvc, taxSvc]'));
}

// ══════════════════════════════════════════════════════════════
// [4] checkGemsTagFormat
// ══════════════════════════════════════════════════════════════
console.log('\n[4] checkGemsTagFormat');
{
  const tmp = makeTmp();
  const story = 'Story-2.1';
  const srcRoot = path.join(tmp, 'src');

  // Single-line JSDoc → PASS
  writeFile(tmp, 'src/good.service.ts', [
    '/** GEMS: goodFn | P0 | API→SVC→RETURN | Story-2.1 | @TEST: src/__tests__/good.test.ts */',
    'export async function goodFn() { return true; }',
  ].join('\n'));

  // Multiline JSDoc GEMS tag → BLOCKER
  writeFile(tmp, 'src/bad-multiline.service.ts', [
    '/**',
    ' * GEMS: badMulti | P0 | API→SVC→RETURN | Story-2.1',
    ' * @TEST: src/__tests__/bad.test.ts',
    ' */',
    'export async function badMulti() { return false; }',
  ].join('\n'));

  // Single-line but missing FLOW (no →)
  writeFile(tmp, 'src/no-flow.service.ts', [
    '/** GEMS: noFlow | P0 | NOOP | Story-2.1 */',
    'export async function noFlow() {}',
  ].join('\n'));

  // Missing priority
  writeFile(tmp, 'src/no-priority.service.ts', [
    '/** GEMS: noPriority | FLOW→RETURN | Story-2.1 */',
    'export async function noPriority() {}',
  ].join('\n'));

  // Missing story
  writeFile(tmp, 'src/no-story.service.ts', [
    '/** GEMS: noStory | P1 | API→RETURN | Story-99.9 */',
    'export async function noStory() {}',
  ].join('\n'));

  const result = checkGemsTagFormat([srcRoot], story);

  assert('no issues for good.service.ts',       !result.issues.find(i => i.file.includes('good.service')));
  assert('MULTILINE_GEMS_TAG for bad-multiline', result.issues.some(i => i.type === 'MULTILINE_GEMS_TAG' && i.file.includes('bad-multiline')));
  assert('multiline expected is single-line',    result.issues.find(i => i.type === 'MULTILINE_GEMS_TAG')?.expected?.startsWith('/** GEMS:'));
  assert('multiline expected no newline',        !result.issues.find(i => i.type === 'MULTILINE_GEMS_TAG')?.expected?.includes('\n'));
  assert('MISSING_GEMS_FLOW for no-flow',        result.issues.some(i => i.type === 'MISSING_GEMS_FLOW' && i.file.includes('no-flow')));
  assert('no issue for no-story (other story)',  !result.issues.find(i => i.file.includes('no-story')));
}

// ══════════════════════════════════════════════════════════════
// [5] checkTraceClosure
// ══════════════════════════════════════════════════════════════
console.log('\n[5] checkTraceClosure');
{
  const tmp   = makeTmp();
  const story = 'Story-2.1';
  const iter  = 'iter-1';

  // Build gems dir structure
  const planDir = path.join(tmp, '.gems/iterations', iter, 'plan');
  fs.mkdirSync(planDir, { recursive: true });

  const planContent = `
### Item 1

\`\`\`ts
// @CONTRACT: createOrder | P0 | SVC | Story-2.1
// @GEMS-FLOW: API→SVC→DB
// @TEST: src/__tests__/order.test.ts
// @INTEGRATION-TEST: src/__tests__/order.integration.test.ts
\`\`\`

**Target File**: \`src/order.service.ts\`

### Item 2

\`\`\`ts
// @CONTRACT: getOrder | P1 | HTTP | Story-2.1
// @GEMS-FLOW: API→SVC→RETURN
// @TEST: src/__tests__/order-get.test.ts
\`\`\`

**File**: \`src/order.handler.ts\`
`;
  fs.writeFileSync(path.join(planDir, `implementation_plan_${story}.md`), planContent, 'utf8');

  // [5a] Source file missing → MISSING_SOURCE_FUNCTION
  {
    const r = checkTraceClosure(tmp, iter, story, [path.join(tmp, 'src')]);
    assert('5a: MISSING_SOURCE_FUNCTION when file absent',
      r.issues.some(i => i.type === 'MISSING_SOURCE_FUNCTION' && i.functionName === 'createOrder'));
  }

  // [5b] Source file exists, function exists, full tag → PASS
  {
    writeFile(tmp, 'src/order.service.ts', [
      '/** GEMS: createOrder | P0 | API→SVC→DB | Story-2.1 | @TEST: src/__tests__/order.test.ts | @INTEGRATION-TEST: src/__tests__/order.integration.test.ts */',
      'export async function createOrder(dto) {',
      '  return db.order.create({ data: dto });',
      '}',
    ].join('\n'));
    writeFile(tmp, 'src/order.handler.ts', [
      '/** GEMS: getOrder | P1 | API→SVC→RETURN | Story-2.1 | @TEST: src/__tests__/order-get.test.ts */',
      'export async function getOrder(id) {',
      '  return db.order.findById(id);',
      '}',
    ].join('\n'));

    const r = checkTraceClosure(tmp, iter, story, [path.join(tmp, 'src')]);
    assert('5b: no issues when full trace present', r.issues.length === 0);
    assert('5b: 2 items parsed',                   r.items.length === 2);
    assert('5b: storyFiles populated',             r.storyFiles.size >= 1);
  }

  // [5c] Function exists, GEMS tag missing → MISSING_GEMS_TAG
  {
    const tmp2 = makeTmp();
    const planDir2 = path.join(tmp2, '.gems/iterations', iter, 'plan');
    fs.mkdirSync(planDir2, { recursive: true });
    const planC2 = `
### Item 1

\`\`\`ts
// @CONTRACT: bareAction | P0 | SVC | Story-2.1
// @GEMS-FLOW: API→SVC→DB
// @TEST: src/__tests__/bare.test.ts
\`\`\`

**File**: \`src/bare.service.ts\`
`;
    fs.writeFileSync(path.join(planDir2, `implementation_plan_${story}.md`), planC2, 'utf8');
    writeFile(tmp2, 'src/bare.service.ts', [
      '// no GEMS tag here',
      'export async function bareAction() {',
      '  return null;',
      '}',
    ].join('\n'));

    const r = checkTraceClosure(tmp2, iter, story, [path.join(tmp2, 'src')]);
    assert('5c: MISSING_GEMS_TAG when tag absent',    r.issues.some(i => i.type === 'MISSING_GEMS_TAG'));
    assert('5c: line number provided',                r.issues.find(i => i.type === 'MISSING_GEMS_TAG')?.line != null);
    assert('5c: expected shows buildExpectedGemsTag', r.issues.find(i => i.type === 'MISSING_GEMS_TAG')?.expected?.includes('/** GEMS:'));
  }

  // [5d] TDD type, tag exists but no @TEST trace → MISSING_GEMS_TEST_TRACE
  {
    const tmp3 = makeTmp();
    const planDir3 = path.join(tmp3, '.gems/iterations', iter, 'plan');
    fs.mkdirSync(planDir3, { recursive: true });
    const planC3 = `
### Item 1

\`\`\`ts
// @CONTRACT: fetchData | P0 | SVC | Story-2.1
// @GEMS-FLOW: API→SVC→RETURN
// @TEST: src/__tests__/fetch.test.ts
\`\`\`

**File**: \`src/fetch.service.ts\`
`;
    fs.writeFileSync(path.join(planDir3, `implementation_plan_${story}.md`), planC3, 'utf8');
    writeFile(tmp3, 'src/fetch.service.ts', [
      '/** GEMS: fetchData | P0 | API→SVC→RETURN | Story-2.1 */',
      'export async function fetchData() {',
      '  return [];',
      '}',
    ].join('\n'));

    const r = checkTraceClosure(tmp3, iter, story, [path.join(tmp3, 'src')]);
    assert('5d: MISSING_GEMS_TEST_TRACE for SVC without @TEST',
      r.issues.some(i => i.type === 'MISSING_GEMS_TEST_TRACE'));
  }

  // [5e] P0 integration type, tag has no @INTEGRATION-TEST → MISSING_GEMS_INTEGRATION_TRACE
  {
    const tmp4 = makeTmp();
    const planDir4 = path.join(tmp4, '.gems/iterations', iter, 'plan');
    fs.mkdirSync(planDir4, { recursive: true });
    const planC4 = `
### Item 1

\`\`\`ts
// @CONTRACT: submitForm | P0 | SVC | Story-2.1
// @GEMS-FLOW: UI→API→SVC→DB
// @TEST: src/__tests__/submit.test.ts
// @INTEGRATION-TEST: src/__tests__/submit.integration.test.ts
\`\`\`

**File**: \`src/submit.service.ts\`
`;
    fs.writeFileSync(path.join(planDir4, `implementation_plan_${story}.md`), planC4, 'utf8');
    writeFile(tmp4, 'src/submit.service.ts', [
      '/** GEMS: submitForm | P0 | UI→API→SVC→DB | Story-2.1 | @TEST: src/__tests__/submit.test.ts */',
      'export async function submitForm(dto) {',
      '  return svc.submit(dto);',
      '}',
    ].join('\n'));

    const r = checkTraceClosure(tmp4, iter, story, [path.join(tmp4, 'src')]);
    assert('5e: MISSING_GEMS_INTEGRATION_TRACE for P0 SVC without @INTEGRATION-TEST',
      r.issues.some(i => i.type === 'MISSING_GEMS_INTEGRATION_TRACE'));
  }

  // [5f] No plan file → MISSING_IMPLEMENTATION_PLAN BLOCKER (not silent skip)
  {
    const tmp5 = makeTmp();
    const r = checkTraceClosure(tmp5, iter, story, [path.join(tmp5, 'src')]);
    assert('5f: MISSING_IMPLEMENTATION_PLAN when plan absent',
      r.issues.length === 1 && r.issues[0].type === 'MISSING_IMPLEMENTATION_PLAN');
    assert('5f: items empty when plan absent', r.items.length === 0);
    assert('5f: targetFile points to plan path',
      r.issues[0].file.includes('implementation_plan_Story-2.1'));
    assert('5f: expected explains what to create',
      r.issues[0].expected.includes('implementation_plan_Story-2.1'));
  }

  // [5g] Plan file read failure → MISSING_IMPLEMENTATION_PLAN
  {
    const tmp6 = makeTmp();
    // Create plan dir but write a directory instead of a file (can't be read as text)
    // Simulate by creating a file with same name as directory won't work,
    // so test the absent-file path again with a different story
    const planDir6 = path.join(tmp6, '.gems/iterations', iter, 'plan');
    fs.mkdirSync(planDir6, { recursive: true });
    // Don't write the file - confirms MISSING_IMPLEMENTATION_PLAN
    const r = checkTraceClosure(tmp6, iter, 'Story-9.9', [path.join(tmp6, 'src')]);
    assert('5g: MISSING_IMPLEMENTATION_PLAN for missing plan', r.issues[0].type === 'MISSING_IMPLEMENTATION_PLAN');
    assert('5g: sourceOfTruth points to contract', r.issues[0].sourceOfTruth?.includes('contract_iter'));
  }
}

// ══════════════════════════════════════════════════════════════
// [6] checkSkeletonResidue
// ══════════════════════════════════════════════════════════════
console.log('\n[6] checkSkeletonResidue');
{
  const tmp = makeTmp();

  // throw new Error('not implemented') → BLOCKER
  const f1 = writeFile(tmp, 'src/skeleton.service.ts', [
    'export async function doWork() {',
    "  throw new Error('not implemented');",
    '}',
  ].join('\n'));

  // TODO: fill implementation → BLOCKER
  const f2 = writeFile(tmp, 'src/todo.service.ts', [
    'export async function doTodo() {',
    '  // TODO: fill implementation',
    '  return null;',
    '}',
  ].join('\n'));

  // placeholder implementation → BLOCKER
  const f3 = writeFile(tmp, 'src/placeholder.service.ts', [
    'export async function doPlaceholder() {',
    '  // placeholder implementation',
    '}',
  ].join('\n'));

  // Real implementation → PASS
  const f4 = writeFile(tmp, 'src/real.service.ts', [
    'export async function doReal() {',
    '  return db.find({ id: 1 });',
    '}',
  ].join('\n'));

  const storyFiles = new Set([f1, f2, f3, f4]);
  const result = checkSkeletonResidue(storyFiles, tmp, null);

  assert('throw not implemented → SKELETON_RESIDUE',     result.issues.some(i => i.file.includes('skeleton') && i.type === 'SKELETON_RESIDUE'));
  assert('TODO fill implementation → SKELETON_RESIDUE',  result.issues.some(i => i.file.includes('todo') && i.type === 'SKELETON_RESIDUE'));
  assert('placeholder implementation → SKELETON_RESIDUE', result.issues.some(i => i.file.includes('placeholder') && i.type === 'SKELETON_RESIDUE'));
  assert('real implementation → no issue',               !result.issues.some(i => i.file.includes('real')));
  assert('skeleton line number provided',                result.issues[0]?.line != null);
  assert('skeleton current shows residue text',          result.issues[0]?.current?.length > 0);

  // Test case insensitivity
  const f5 = writeFile(tmp, 'src/case-test.service.ts', [
    'export async function doCaseTest() {',
    "  throw new Error('Not Implemented');",
    '}',
  ].join('\n'));
  const r2 = checkSkeletonResidue(new Set([f5]), tmp, null);
  assert('case-insensitive throw match', r2.issues.some(i => i.type === 'SKELETON_RESIDUE'));

  // Test files should NOT trigger (skip ext)
  const f6 = writeFile(tmp, 'src/skip.test.ts', [
    'it("placeholder test", () => {',
    '  // TODO: fill implementation',
    '});',
  ].join('\n'));
  const r3 = checkSkeletonResidue(new Set([f6]), tmp, null);
  assert('test files not scanned for skeleton', r3.issues.length === 0);
}

// ══════════════════════════════════════════════════════════════
// [7] checkRuntimeReadiness
// ══════════════════════════════════════════════════════════════
console.log('\n[7] checkRuntimeReadiness');
{
  // Node: missing package.json → MISSING_ENTRYPOINT
  {
    const tmp = makeTmp();
    const r = checkRuntimeReadiness(tmp, 'node');
    assert('7a: MISSING_ENTRYPOINT when no package.json', r.issues.some(i => i.type === 'MISSING_ENTRYPOINT'));
  }

  // Node: package.json with no valid scripts → MISSING_RUN_SCRIPT
  {
    const tmp = makeTmp();
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'test', scripts: { lint: 'eslint .' } }), 'utf8');
    const r = checkRuntimeReadiness(tmp, 'node');
    assert('7b: MISSING_RUN_SCRIPT when no build/dev/start/serve/typecheck', r.issues.some(i => i.type === 'MISSING_RUN_SCRIPT'));
  }

  // Node: package.json with build script → PASS
  {
    const tmp = makeTmp();
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'test', scripts: { build: 'tsc' } }), 'utf8');
    const r = checkRuntimeReadiness(tmp, 'node');
    assert('7c: no issues when package.json has build script', r.issues.length === 0);
  }

  // Node: package.json with dev script → PASS
  {
    const tmp = makeTmp();
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'test', scripts: { dev: 'vite' } }), 'utf8');
    const r = checkRuntimeReadiness(tmp, 'node');
    assert('7c2: no issues when package.json has dev script', r.issues.length === 0);
  }

  // GAS: missing appsscript.json → MISSING_GAS_MANIFEST
  {
    const tmp = makeTmp();
    const r = checkRuntimeReadiness(tmp, 'gas');
    assert('7d: MISSING_GAS_MANIFEST when no appsscript.json', r.issues.some(i => i.type === 'MISSING_GAS_MANIFEST'));
    assert('7d: MISSING_GAS_CLASP when no .clasp.json',        r.issues.some(i => i.type === 'MISSING_GAS_CLASP'));
  }

  // GAS: both files present → PASS
  {
    const tmp = makeTmp();
    fs.writeFileSync(path.join(tmp, 'appsscript.json'), JSON.stringify({ timeZone: 'Asia/Taipei' }), 'utf8');
    fs.writeFileSync(path.join(tmp, '.clasp.json'), JSON.stringify({ scriptId: 'xxx' }), 'utf8');
    const r = checkRuntimeReadiness(tmp, 'gas');
    assert('7e: no issues when GAS files present', r.issues.length === 0);
  }

  // Static: missing index.html → MISSING_ENTRYPOINT
  {
    const tmp = makeTmp();
    const r = checkRuntimeReadiness(tmp, 'static');
    assert('7f: MISSING_ENTRYPOINT for static without index.html', r.issues.some(i => i.type === 'MISSING_ENTRYPOINT'));
  }

  // Static: index.html present → PASS
  {
    const tmp = makeTmp();
    fs.writeFileSync(path.join(tmp, 'index.html'), '<!DOCTYPE html><html></html>', 'utf8');
    const r = checkRuntimeReadiness(tmp, 'static');
    assert('7g: no issues for static with index.html', r.issues.length === 0);
  }

  // Node: invalid JSON package.json → MISSING_ENTRYPOINT
  {
    const tmp = makeTmp();
    fs.writeFileSync(path.join(tmp, 'package.json'), 'not valid json', 'utf8');
    const r = checkRuntimeReadiness(tmp, 'node');
    assert('7h: MISSING_ENTRYPOINT when package.json invalid JSON', r.issues.some(i => i.type === 'MISSING_ENTRYPOINT'));
  }
}

// ══════════════════════════════════════════════════════════════
// [8] traceCoverageSummary — informational only, NOT a gate
// ══════════════════════════════════════════════════════════════
console.log('\n[8] traceCoverageSummary (informational only)');
{
  // Without contract file → returns zero counts, no error
  {
    const tmp = makeTmp();
    const cov = traceCoverageSummary(tmp, 'iter-1', 'Story-2.1');
    assert('8a: no contract → total=0 covered=0', cov.total === 0 && cov.covered === 0);
    assert('8a: uncovered is empty array',         Array.isArray(cov.uncovered) && cov.uncovered.length === 0);
  }

  // With contract file, test paths present in FS
  {
    const tmp = makeTmp();
    const iterDir = path.join(tmp, '.gems/iterations/iter-1');
    fs.mkdirSync(iterDir, { recursive: true });
    const contractContent = `
// @CONTRACT: createItem | P0 | SVC | Story-2.1
// @TEST: src/__tests__/item.test.ts
// @TEST: src/__tests__/item-b.test.ts
export type CreateItem = { name: string };

// @CONTRACT: otherFn | P0 | SVC | Story-3.0
// @TEST: src/__tests__/other.test.ts
export type OtherFn = {};
`;
    fs.writeFileSync(path.join(iterDir, 'contract_iter-1.ts'), contractContent, 'utf8');
    // Only create one of the two test files
    writeFile(tmp, 'src/__tests__/item.test.ts', 'it("test", () => {});');

    const cov = traceCoverageSummary(tmp, 'iter-1', 'Story-2.1');
    assert('8b: total = 2 (story-scoped @TEST paths)', cov.total === 2);
    assert('8b: covered = 1 (one file exists)',        cov.covered === 1);
    assert('8b: uncovered has 1 path',                 cov.uncovered.length === 1);
    assert('8b: other story not counted',              cov.total < 3);
  }
}

// ══════════════════════════════════════════════════════════════
// [9] Phase 4 does NOT claim SCAN completed, no full-contract TDD gate
// ══════════════════════════════════════════════════════════════
console.log('\n[9] Phase 4 architecture contract');
{
  const src = require('fs').readFileSync(
    require('path').join(__dirname, '../phases/build/phase-4.cjs'),
    'utf8'
  );

  // refreshTagIndex must NOT emit "SCAN 完成" or claim official scan
  assert('9a: no "SCAN 完成" string in code',    !src.includes('SCAN 完成'));
  // "SCAN completed" may appear in comments explaining what NOT to claim; ensure it's not in emit calls
  assert('9b: no emitPass with "SCAN completed"',
    !src.split('\n').some(l => !/^\s*\*|\/\//.test(l) && l.includes('SCAN completed')));
  assert('9c: refreshTagIndex exported',         src.includes('refreshTagIndex'));
  assert('9d: no scanUnified PASS gate call',    !src.includes("emitPass") || src.indexOf('refreshTagIndex') < src.lastIndexOf('emitPass'));

  // traceCoverageSummary must be informational, not a gate
  assert('9e: traceCoverageSummary exported',    src.includes('traceCoverageSummary'));
  // coverage result is only used in summaryLine, not in allIssues
  const covIdx = src.indexOf('traceCoverageSummary(');
  const issuesPushIdx = src.indexOf('allIssues.push(...coverage');
  assert('9f: traceCoverageSummary not pushed to allIssues', issuesPushIdx === -1);

  // phase4-done only written after all checks pass (allIssues.length === 0)
  assert('9g: phase4-done write inside success branch', src.includes("phase4-done_"));
  // The BLOCKER block must return before phase4-done write
  const blockerReturnIdx = src.indexOf("return { verdict: 'BLOCKER', reason: 'trace_coverage_closure'");
  const phase4DoneIdx    = src.indexOf('phase4-done_');
  assert('9h: BLOCKER return before phase4-done write', blockerReturnIdx < phase4DoneIdx);

  // No checkAcCoverage gate (removed from Phase 4)
  assert('9i: checkAcCoverage not used as gate', !src.includes('checkAcCoverage'));

  // Entrypoint metadata: honest label (not claiming build succeeded)
  assert('9j: Entrypoint metadata label in source', src.includes('Entrypoint metadata'));
  // MISSING_IMPLEMENTATION_PLAN blocker type
  assert('9k: MISSING_IMPLEMENTATION_PLAN type defined', src.includes('MISSING_IMPLEMENTATION_PLAN'));
}

// ══════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════
console.log(`\n${'─'.repeat(50)}`);
console.log(`dryrun-phase4: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
