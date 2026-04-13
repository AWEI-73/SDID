#!/usr/bin/env node
/**
 * BUILD Phase 4: Runtime Readiness + Trace Coverage Closure Gate (v9.0)
 *
 * 定位：trace coverage closure + runtime readiness gate
 *   Contract→Plan→Source→GEMS tag 鏈條驗證
 *   GEMS tag 格式驗證（JSDoc single-line）
 *   Skeleton residue 偵測
 *   Runtime entrypoint 確認
 *   Tag index refresh（非正式 SCAN）
 *   phase4-done 只有全部 PASS 才寫
 *
 * 不做：
 *   重跑 Phase 2 TDD runner / Phase 3 integration gate
 *   宣稱正式 SCAN completed
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const { emitPass, emitFix, emitBlock } = require('../../lib/shared/log-output.cjs');
const { getNextCmd, getRetryCmd }       = require('../../lib/shared/next-command-helper.cjs');
const { getSimpleHeader }               = require('../../lib/shared/output-header.cjs');
const { clearCheckpoints }              = require('../../lib/checkpoint.cjs');
const { detectProjectType, getSrcDirs } = require('../../lib/shared/project-type.cjs');
const { handlePhaseSuccess }            = require('../../lib/shared/error-handler.cjs');

// ── TDD 型：GEMS tag 需要 @TEST trace
const TDD_TRACE_TYPES  = new Set(['SVC', 'ACTION', 'HTTP', 'HOOK', 'LIB']);
// ── Integration 型：GEMS tag 需要 @INTEGRATION-TEST trace (P0 only)
const INTEG_TRACE_TYPES = new Set(['SVC', 'API', 'HTTP', 'HOOK']);
// ── Skeleton residue patterns
const SKELETON_PATTERNS = [
  /throw\s+new\s+Error\s*\(\s*['"]not\s+implemented['"]\s*\)/i,
  /\/\/\s*TODO:\s*fill\s+implementation/i,
  /\/\/\s*placeholder\s+implementation/i,
];
// ── Skip dirs / test extensions for source scanning
const SKIP_DIRS     = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'fixtures', '.gems']);
const SKIP_TEST_EXT = /\.(d\.ts|test\.ts|spec\.ts|test\.tsx|spec\.tsx|test\.js|spec\.js)$/;

// ── GEMS scanner（optional）
let scanUnified = null;
try { scanUnified = require('../../lib/scan/gems-scanner-unified.cjs').scan; } catch { /* optional */ }

// ─────────────────────────────────────────────────────────────
// run()
// ─────────────────────────────────────────────────────────────
/** GEMS: buildPhase4 | P1 | checkTraceClosure(IO)→checkGemsTagFormat(IO)→checkSkeletonResidue(IO)→checkRuntimeReadiness(IO)→RETURN:PhaseResult | Story-4.0 */
function run(options) {
  const { target, iteration = 'iter-1', story, level = 'M' } = options;
  const relativeTarget = path.relative(process.cwd(), target) || '.';
  const iterNum = parseInt(iteration.replace('iter-', '')) || 1;

  console.log(getSimpleHeader('BUILD', 'Phase 4'));

  if (!story) {
    emitBlock({
      scope: 'BUILD Phase 4',
      summary: '缺少 --story 參數',
      nextCmd: `node task-pipe/runner.cjs --phase=BUILD --step=4 --story=Story-X.Y --target=${relativeTarget}`
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-4', story });
    return { verdict: 'BLOCKER' };
  }

  const { type: projectType } = detectProjectType(target);
  const srcPaths  = getSrcDirs(target);
  const buildPath = path.join(target, `.gems/iterations/${iteration}/build`);
  const planPath  = path.join(target, `.gems/iterations/${iteration}/plan`);

  if (!fs.existsSync(buildPath)) fs.mkdirSync(buildPath, { recursive: true });

  console.log(`\n🔗 Trace Closure + Entrypoint Metadata Check | ${story}`);

  const allIssues = [];

  // 1. Trace coverage closure
  const traceResult = checkTraceClosure(target, iteration, story, srcPaths);
  allIssues.push(...traceResult.issues);
  if (traceResult.issues.length > 0)
    console.log(`   ❌ Trace closure: ${traceResult.issues.length} 個問題`);
  else if (traceResult.items.length > 0)
    console.log(`   ✅ Trace closure: ${traceResult.items.length} 個 item 全部可追蹤`);
  else
    console.log(`   ⏭️  Trace closure: 無 plan item（跳過）`);

  // 2. GEMS tag format
  const tagFormatResult = checkGemsTagFormat(srcPaths, story);
  allIssues.push(...tagFormatResult.issues);
  if (tagFormatResult.issues.length > 0)
    console.log(`   ❌ GEMS tag format: ${tagFormatResult.issues.length} 個問題`);

  // 3. Skeleton residue
  const skeletonResult = checkSkeletonResidue(traceResult.storyFiles, target, srcPaths);
  allIssues.push(...skeletonResult.issues);
  if (skeletonResult.issues.length > 0)
    console.log(`   ❌ Skeleton residue: ${skeletonResult.issues.length} 個問題`);

  // 4. Entrypoint metadata check (light — package.json/appsscript.json/index.html existence only)
  //    Does NOT execute build or typecheck; does NOT claim runtime correctness.
  const runtimeResult = checkRuntimeReadiness(target, projectType);
  allIssues.push(...runtimeResult.issues);
  if (runtimeResult.issues.length > 0)
    console.log(`   ❌ Entrypoint metadata: ${runtimeResult.issues.length} 個問題`);
  else
    console.log(`   ✅ Entrypoint metadata: ${projectType || 'node'} 入口存在（light check）`);

  // ── BLOCKER: do NOT write phase4-done
  if (allIssues.length > 0) {
    const tasks = allIssues.map(issue => ({
      action:       issue.type,
      file:         issue.file,
      line:         issue.line         || null,
      functionName: issue.functionName || null,
      current:      issue.current      || null,
      expected:     issue.expected     || null,
      sourceOfTruth: issue.sourceOfTruth || null,
      acSpec:       issue.acSpec       || null,
    }));
    emitFix({
      scope:      `BUILD Phase 4 | ${story}`,
      summary:    `Trace/Tag/Skeleton/Runtime 問題 (${allIssues.length} 個)`,
      targetFile: allIssues[0]?.file || 'src/',
      missing:    allIssues.map(i => `[${i.type}] ${i.functionName || ''} — ${i.file || ''}`),
      nextCmd:    getRetryCmd('BUILD', '4', { story, target: relativeTarget, iteration }),
      tasks,
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-4', story });
    return { verdict: 'BLOCKER', reason: 'trace_coverage_closure', issues: allIssues };
  }

  // 5. refreshTagIndex（tag index 更新，非正式 SCAN）
  const indexResult = refreshTagIndex(srcPaths, target, iteration);
  if (!indexResult.skipped) {
    if (indexResult.success)
      console.log(`\n   📋 Tag index refreshed`);
    else
      console.log(`\n   ⚠️  Tag index refresh 失敗（非 BLOCKER）: ${indexResult.error || ''}`);
  }

  // 6. traceCoverageSummary（informational only — NOT a gate）
  const coverage = traceCoverageSummary(target, iteration, story);

  // ── Write phase4-done（only here, after all checks pass）
  try {
    fs.writeFileSync(
      path.join(buildPath, `phase4-done_${story}`),
      JSON.stringify({ storyId: story, iteration, completedAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } catch { /* non-critical */ }

  handlePhaseSuccess('BUILD', '4', story, target);
  clearCheckpoints(target, iteration, story);

  const plannedStories   = findPlannedStories(planPath);
  const completedStories = findCompletedStories(buildPath);
  const nextStory        = plannedStories.find(s => !completedStories.includes(s) && s !== story);
  const isIterationComplete = plannedStories.every(s => completedStories.includes(s) || s === story);

  const traceCount = traceResult.items.length;
  const summaryLine = `✅ closure checks PASS | items: ${traceCount}` +
    (coverage.total > 0 ? ` | @TEST trace: ${coverage.covered}/${coverage.total}` : '');

  if (isIterationComplete) {
    try {
      const logsDir = path.join(target, '.gems', 'iterations', iteration, 'logs');
      if (fs.existsSync(logsDir)) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        fs.writeFileSync(path.join(logsDir, `build-phase-4-${story}-pass-${ts}.log`), '@PASS\n', 'utf8');
      }
    } catch { }
    emitPass({
      scope:   `BUILD Phase 4 | ${story}`,
      summary: `${summaryLine} | Iteration 完成`,
      nextCmd: `node task-pipe/runner.cjs --phase=SCAN --target=${relativeTarget}`
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-4', story });
    return { verdict: 'PASS', iterationComplete: true };
  }

  emitPass({
    scope:   `BUILD Phase 4 | ${story}`,
    summary: summaryLine,
    nextCmd: nextStory
      ? `node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${nextStory} --target=${relativeTarget} --iteration=${iteration}`
      : getNextCmd('BUILD', '4', { story, level, target: relativeTarget, iteration })
  }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-4', story });

  return { verdict: 'PASS', nextStory };
}

// ─────────────────────────────────────────────────────────────
// parseTraceItems
// ─────────────────────────────────────────────────────────────
/**
 * 從 implementation_plan 提取 story-scoped trace items
 * @returns {Array<{contractName,priority,type,storyId,filePath,testPath,integTestPath,flow,deps}>}
 */
function parseTraceItems(planContent, story) {
  const items = [];
  const blocks = planContent.split(/(?=###\s+Item\s+\d+)/);
  for (const block of blocks) {
    if (!/###\s+Item\s+\d+/.test(block)) continue;
    const cm = block.match(/\/\/\s*@CONTRACT:\s*([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|([^\n]+)/);
    if (!cm) continue;
    const contractName = cm[1].trim();
    const priority     = cm[2].trim();
    const type         = cm[3].trim().toUpperCase();
    const storyId      = cm[4].trim();
    if (storyId !== story) continue;

    // File path — try backtick, then bare path
    const fm =
      block.match(/(?:\*\*(?:Target\s+)?File\*\*|@FILE)[:\s]*`([^`]+)`/i) ||
      block.match(/(?:\*\*(?:Target\s+)?File\*\*|@FILE)[:\s]+([^\s\n`'"]+)/i);
    const filePath = fm ? fm[1].trim() : null;

    const testM     = block.match(/\/\/\s*@TEST:\s*(\S+)/);
    const integM    = block.match(/\/\/\s*@INTEGRATION-TEST:\s*(\S+)/);
    const flowM     = block.match(/\/\/\s*@GEMS-FLOW:\s*(.+)/);
    const depsM     = block.match(/deps:\s*\[([^\]]*)\]/);

    items.push({
      contractName,
      priority,
      type,
      storyId,
      filePath:     filePath || null,
      testPath:     testM    ? testM[1].trim()  : null,
      integTestPath: integM  ? integM[1].trim() : null,
      flow:          flowM   ? flowM[1].trim()  : null,
      deps:          depsM   ? `[${depsM[1]}]`  : null,
    });
  }
  return items;
}

// ─────────────────────────────────────────────────────────────
// findFunctionInFile
// ─────────────────────────────────────────────────────────────
/**
 * 在 source 中尋找 function/class，並回傳鄰近 GEMS tag
 * @returns {{ found, line, currentTag, tagLine, tagType: 'jsdoc'|'line'|null }}
 */
function findFunctionInFile(filePath, fnName) {
  const notFound = { found: false, line: null, currentTag: null, tagLine: null, tagType: null };
  if (!fs.existsSync(filePath)) return notFound;
  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); } catch { return notFound; }
  const lines = content.split('\n');
  const esc = fnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fnPatterns = [
    new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${esc}\\s*[(<]`),
    new RegExp(`(?:export\\s+)?class\\s+${esc}[\\s{<(]`),
    new RegExp(`(?:export\\s+)?const\\s+${esc}\\s*=`),
  ];
  for (let i = 0; i < lines.length; i++) {
    if (!fnPatterns.some(p => p.test(lines[i]))) continue;
    // Look back ≤5 lines for GEMS tag
    let currentTag = null, tagLine = null, tagType = null;
    for (let j = Math.max(0, i - 5); j < i; j++) {
      const l = lines[j].trim();
      if (/\/\*\*\s*GEMS:/.test(l)) { currentTag = l; tagLine = j + 1; tagType = 'jsdoc'; break; }
      if (/\/\/\s*GEMS:/.test(l))   { currentTag = l; tagLine = j + 1; tagType = 'line';  break; }
    }
    return { found: true, line: i + 1, currentTag, tagLine, tagType };
  }
  return notFound;
}

// ─────────────────────────────────────────────────────────────
// buildExpectedGemsTag
// ─────────────────────────────────────────────────────────────
/**
 * 根據 trace item 生成期望的 JSDoc single-line GEMS tag
 * 未知欄位使用 placeholder，不亂猜
 */
function buildExpectedGemsTag(item) {
  const { contractName, priority, flow, storyId, testPath, integTestPath, type, deps } = item;
  const parts = [
    contractName,
    priority || 'P0',
    flow || '<FLOW_FROM_CONTRACT_OR_PLAN_REQUIRED>',
    storyId,
  ];
  if (testPath) {
    parts.push(`@TEST: ${testPath}`);
  } else if (TDD_TRACE_TYPES.has((type || '').toUpperCase())) {
    parts.push('@TEST: <TEST_PATH_FROM_CONTRACT_REQUIRED>');
  }
  if (integTestPath) {
    parts.push(`@INTEGRATION-TEST: ${integTestPath}`);
  } else if (INTEG_TRACE_TYPES.has((type || '').toUpperCase())) {
    parts.push('@INTEGRATION-TEST: <INTEGRATION_TEST_FROM_CONTRACT_REQUIRED>');
  }
  if (deps && deps !== '[]') parts.push(`deps:${deps}`);
  return `/** GEMS: ${parts.join(' | ')} */`;
}

// ─────────────────────────────────────────────────────────────
// checkTraceClosure
// ─────────────────────────────────────────────────────────────
/**
 * Contract→Plan→Source→GEMS tag 鏈條驗證
 * @returns {{ issues: Issue[], items: TraceItem[], storyFiles: Set<string> }}
 */
function checkTraceClosure(target, iteration, story, srcPaths) {
  const issues     = [];
  const storyFiles = new Set();
  const iterNum    = iteration.replace('iter-', '');
  const planRelative = `.gems/iterations/${iteration}/plan/implementation_plan_${story}.md`;
  const planFile   = path.join(target, planRelative);
  if (!fs.existsSync(planFile)) {
    return {
      issues: [{
        type:         'MISSING_IMPLEMENTATION_PLAN',
        file:         planRelative,
        line:         null,
        functionName: null,
        current:      null,
        expected:     `建立 implementation_plan_${story}.md，包含 ### Item N 區塊與 @CONTRACT / @FILE / @TEST trace`,
        sourceOfTruth: `.gems/iterations/${iteration}/contract_iter-${iterNum}.ts`,
        acSpec:       'Plan 是 Phase 4 trace closure 的唯一真相來源，缺少時所有 trace 驗證無法進行',
      }],
      items:      [],
      storyFiles: new Set(),
    };
  }

  let planContent;
  try { planContent = fs.readFileSync(planFile, 'utf8'); } catch {
    return {
      issues: [{
        type: 'MISSING_IMPLEMENTATION_PLAN',
        file: planRelative, line: null, functionName: null, current: null,
        expected: `implementation_plan_${story}.md 讀取失敗，請確認檔案格式`,
        sourceOfTruth: `.gems/iterations/${iteration}/contract_iter-${iterNum}.ts`,
        acSpec: 'Plan 讀取失敗視同缺失，所有 trace 驗證無法進行',
      }],
      items: [], storyFiles: new Set(),
    };
  }

  const items = parseTraceItems(planContent, story);
  const sourceOfTruth = `.gems/iterations/${iteration}/contract_iter-${iterNum}.ts + .gems/iterations/${iteration}/plan/implementation_plan_${story}.md`;

  for (const item of items) {
    const { contractName, priority, type, filePath, testPath, integTestPath } = item;
    const absFilePath = filePath
      ? (path.isAbsolute(filePath) ? filePath : path.join(target, filePath))
      : null;

    if (absFilePath) storyFiles.add(absFilePath);

    // Source file must exist
    if (!absFilePath || !fs.existsSync(absFilePath)) {
      issues.push({
        type: 'MISSING_SOURCE_FUNCTION',
        file: filePath || `src/ (path unknown for ${contractName})`,
        line: null, functionName: contractName, current: null,
        expected: `建立 ${contractName} 的實作檔（${filePath || '路徑需在 plan 中補充'}）`,
        sourceOfTruth,
      });
      continue;
    }

    const relFile  = path.relative(target, absFilePath);
    const fnResult = findFunctionInFile(absFilePath, contractName);

    // Function must exist in source
    if (!fnResult.found) {
      issues.push({
        type: 'MISSING_SOURCE_FUNCTION',
        file: relFile, line: null, functionName: contractName, current: null,
        expected: buildExpectedGemsTag(item),
        sourceOfTruth,
      });
      continue;
    }

    // GEMS tag must exist
    if (!fnResult.currentTag) {
      issues.push({
        type: 'MISSING_GEMS_TAG',
        file: relFile, line: fnResult.line, functionName: contractName, current: null,
        expected: buildExpectedGemsTag(item),
        sourceOfTruth,
      });
      continue;
    }

    const tag = fnResult.currentTag;

    // Story ID must appear in tag
    if (!tag.includes(story)) {
      issues.push({
        type: 'FIX_GEMS_TAG_FORMAT',
        file: relFile, line: fnResult.tagLine, functionName: contractName, current: tag,
        expected: buildExpectedGemsTag(item),
        sourceOfTruth, acSpec: `GEMS tag 的 story ID 必須是 ${story}`,
      });
    }

    // FLOW must appear (→ separator)
    if (!/→/.test(tag)) {
      issues.push({
        type: 'MISSING_GEMS_FLOW',
        file: relFile, line: fnResult.tagLine, functionName: contractName, current: tag,
        expected: buildExpectedGemsTag(item),
        sourceOfTruth, acSpec: 'GEMS tag 必須有 FLOW（含 → 的步驟鏈）',
      });
    }

    // TDD type → @TEST trace
    if (TDD_TRACE_TYPES.has(type) && !/@TEST:/.test(tag)) {
      issues.push({
        type: 'MISSING_GEMS_TEST_TRACE',
        file: relFile, line: fnResult.tagLine, functionName: contractName, current: tag,
        expected: buildExpectedGemsTag(item),
        sourceOfTruth, acSpec: `${type} 型 function 的 GEMS tag 必須有 @TEST: 路徑`,
      });
    }

    // Integration type P0 → @INTEGRATION-TEST trace
    if (INTEG_TRACE_TYPES.has(type) && priority === 'P0' && !/@INTEGRATION-TEST:/.test(tag)) {
      issues.push({
        type: 'MISSING_GEMS_INTEGRATION_TRACE',
        file: relFile, line: fnResult.tagLine, functionName: contractName, current: tag,
        expected: buildExpectedGemsTag(item),
        sourceOfTruth, acSpec: `P0 ${type} 型 function 的 GEMS tag 必須有 @INTEGRATION-TEST: 路徑`,
      });
    }
  }

  return { issues, items, storyFiles };
}

// ─────────────────────────────────────────────────────────────
// checkGemsTagFormat
// ─────────────────────────────────────────────────────────────
/**
 * 掃描 source files 中 story-scoped GEMS tag，驗證格式
 *   多行 JSDoc GEMS tag  → MULTILINE_GEMS_TAG BLOCKER
 *   JSDoc 單行缺必要欄位 → FIX_GEMS_TAG_FORMAT / MISSING_GEMS_FLOW / MISSING_GEMS_STORY BLOCKER
 *   // GEMS: 舊格式       → scanner 相容，Phase 4 不另外 BLOCKER
 */
function checkGemsTagFormat(srcPaths, story) {
  const issues = [];
  const roots  = (Array.isArray(srcPaths) ? srcPaths : [srcPaths]).filter(p => fs.existsSync(p));

  for (const root of roots) {
    walkFiles(root, SKIP_DIRS, SKIP_TEST_EXT, filePath => {
      let content;
      try { content = fs.readFileSync(filePath, 'utf8'); } catch { return; }

      // ── Multiline GEMS tag detection
      for (const match of content.matchAll(/\/\*\*([\s\S]*?)\*\//g)) {
        if (!/GEMS:/.test(match[1])) continue;
        if (!match[1].includes(story)) continue;
        if ((match[0].match(/\n/g) || []).length === 0) continue;   // single-line is fine
        const lineNum = content.slice(0, match.index).split('\n').length;
        const fnName  = _extractTagName(match[1]);
        issues.push({
          type: 'MULTILINE_GEMS_TAG',
          file: path.relative(process.cwd(), filePath), line: lineNum,
          functionName: fnName, current: match[0].slice(0, 200),
          expected: _rebuildSingleLine(match[1]),
          sourceOfTruth: `${story} contract + implementation_plan`,
          acSpec: 'GEMS tag 必須為 JSDoc 單行格式：/** GEMS: name | priority | FLOW | Story | ... */',
        });
      }

      // ── JSDoc single-line field validation
      for (const match of content.matchAll(/\/\*\*\s*GEMS:\s*([^*]+)\*\//g)) {
        const tagContent = match[1].trim();
        if (!tagContent.includes(story)) continue;
        const parts   = tagContent.split('|').map(s => s.trim());
        const lineNum = content.slice(0, match.index).split('\n').length;
        const fnName  = parts[0] || '';
        issues.push(..._validateTagParts(parts, path.relative(process.cwd(), filePath), lineNum, story, fnName, match[0]));
      }
    });
  }

  return { issues };
}

function _extractTagName(blockContent) {
  const m = blockContent.match(/GEMS:\s*([^|\n*]+)/);
  return m ? m[1].trim() : null;
}

function _rebuildSingleLine(blockContent) {
  const nm  = blockContent.match(/GEMS:\s*([^|\n*]+)/);
  const pm  = blockContent.match(/\|\s*(P[0-3])\s*[|\n]/);
  const sm  = blockContent.match(/\|\s*(Story-[\d.]+)/);
  const fl  = blockContent.match(/\|\s*([A-Z\w()]+(?:→[A-Z\w()]+)+)\s*[|\n]/);
  const name  = nm ? nm[1].trim()  : '<NAME_REQUIRED>';
  const prio  = pm ? pm[1]        : '<PRIORITY_REQUIRED>';
  const flow  = fl ? fl[1].trim() : '<FLOW_FROM_CONTRACT_OR_PLAN_REQUIRED>';
  const sid   = sm ? sm[1].trim() : '<STORY_REQUIRED>';
  return `/** GEMS: ${name} | ${prio} | ${flow} | ${sid} */`;
}

function _validateTagParts(parts, relFile, lineNum, story, fnName, fullTag) {
  const issues = [];
  const src    = `${story} contract + implementation_plan`;

  if (parts.length < 4) {
    issues.push({
      type: 'FIX_GEMS_TAG_FORMAT', file: relFile, line: lineNum,
      functionName: fnName, current: fullTag,
      expected: `/** GEMS: ${fnName} | P0 | <FLOW_FROM_CONTRACT_OR_PLAN_REQUIRED> | ${story} */`,
      sourceOfTruth: src, acSpec: 'GEMS tag 必須有 name | priority | FLOW | Story 四個欄位',
    });
    return issues;
  }
  if (!parts.some(p => /^P[0-3]$/.test(p))) {
    issues.push({
      type: 'FIX_GEMS_TAG_FORMAT', file: relFile, line: lineNum,
      functionName: fnName, current: fullTag,
      expected: `/** GEMS: ${fnName} | P0 | ${parts[2] || '<FLOW>'} | ${story} */`,
      sourceOfTruth: src, acSpec: 'GEMS tag 必須包含 priority（P0/P1/P2/P3）',
    });
  }
  // parts[2] = FLOW (JSDoc order: name|priority|FLOW|story)
  const flowPart = (parts[2] || '').trim();
  if (!flowPart || !/→/.test(flowPart)) {
    issues.push({
      type: 'MISSING_GEMS_FLOW', file: relFile, line: lineNum,
      functionName: fnName, current: fullTag,
      expected: `/** GEMS: ${fnName} | ${parts[1] || 'P0'} | <FLOW_FROM_CONTRACT_OR_PLAN_REQUIRED> | ${story} */`,
      sourceOfTruth: src, acSpec: 'GEMS tag 的 FLOW 欄位（第3個）必須含 → 步驟鏈',
    });
  }
  if (!parts.some(p => /^Story-[\d.]+$/.test(p))) {
    issues.push({
      type: 'MISSING_GEMS_STORY', file: relFile, line: lineNum,
      functionName: fnName, current: fullTag,
      expected: `/** GEMS: ${fnName} | ${parts[1] || 'P0'} | ${parts[2] || '<FLOW>'} | ${story} */`,
      sourceOfTruth: src, acSpec: 'GEMS tag 必須包含 Story-X.Y',
    });
  }
  return issues;
}

// ─────────────────────────────────────────────────────────────
// checkSkeletonResidue
// ─────────────────────────────────────────────────────────────
/**
 * 偵測 skeleton residue（throw/TODO placeholder）
 * 優先掃 storyFiles；fallback 到 srcPaths
 * 不掃 .test.ts / fixtures / dist
 */
function checkSkeletonResidue(storyFiles, target, srcPaths) {
  const issues = [];
  const filesToScan = storyFiles instanceof Set && storyFiles.size > 0
    ? [...storyFiles]
    : [];

  if (filesToScan.length === 0 && srcPaths) {
    const roots = (Array.isArray(srcPaths) ? srcPaths : [srcPaths]).filter(p => fs.existsSync(p));
    for (const root of roots) walkFiles(root, SKIP_DIRS, SKIP_TEST_EXT, f => filesToScan.push(f));
  }

  for (const absPath of filesToScan) {
    if (SKIP_TEST_EXT.test(absPath)) continue;
    if (!fs.existsSync(absPath)) continue;
    let content;
    try { content = fs.readFileSync(absPath, 'utf8'); } catch { continue; }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const pat of SKELETON_PATTERNS) {
        if (pat.test(lines[i])) {
          issues.push({
            type: 'SKELETON_RESIDUE',
            file: path.relative(target, absPath), line: i + 1,
            functionName: null, current: lines[i].trim(),
            expected: '補齊實作後移除 placeholder',
            sourceOfTruth: null,
            acSpec: 'skeleton residue 表示功能未完成，不可進入下個 story',
          });
          break;
        }
      }
    }
  }
  return { issues };
}

// ─────────────────────────────────────────────────────────────
// checkRuntimeReadiness
// ─────────────────────────────────────────────────────────────
/**
 * 確認專案可被運行或打開
 * Node/Vite: package.json + scripts  GAS: appsscript.json / .clasp.json  Static: index.html
 */
function checkRuntimeReadiness(target, projectType) {
  const issues = [];
  const type   = (projectType || '').toLowerCase();

  if (type === 'gas') {
    if (!fs.existsSync(path.join(target, 'appsscript.json')))
      issues.push({ type: 'MISSING_GAS_MANIFEST', file: 'appsscript.json', line: null,
        functionName: null, current: null,
        expected: 'appsscript.json 必須存在（GAS 專案入口）', sourceOfTruth: null,
        acSpec: 'GAS 專案必須有 appsscript.json' });
    if (!fs.existsSync(path.join(target, '.clasp.json')))
      issues.push({ type: 'MISSING_GAS_CLASP', file: '.clasp.json', line: null,
        functionName: null, current: null,
        expected: '.clasp.json 必須存在（clasp deploy 設定）', sourceOfTruth: null,
        acSpec: 'GAS 專案必須有 .clasp.json' });
  } else if (type === 'static') {
    if (!fs.existsSync(path.join(target, 'index.html')))
      issues.push({ type: 'MISSING_ENTRYPOINT', file: 'index.html', line: null,
        functionName: null, current: null,
        expected: 'index.html 必須存在（靜態網站入口）', sourceOfTruth: null,
        acSpec: 'Static 專案必須有 index.html' });
  } else {
    const pkgPath = path.join(target, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      issues.push({ type: 'MISSING_ENTRYPOINT', file: 'package.json', line: null,
        functionName: null, current: null,
        expected: 'package.json 必須存在', sourceOfTruth: null,
        acSpec: '專案必須有 package.json' });
    } else {
      try {
        const pkg     = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const scripts = pkg.scripts || {};
        if (!scripts.build && !scripts.typecheck && !scripts.dev && !scripts.start && !scripts.serve) {
          issues.push({ type: 'MISSING_RUN_SCRIPT', file: 'package.json', line: null,
            functionName: null,
            current: `scripts: [${Object.keys(scripts).join(', ')}]`,
            expected: 'package.json 需有 build / typecheck / dev / start / serve 其中之一',
            sourceOfTruth: null, acSpec: 'runtime readiness 需要至少一個可執行的 npm script' });
        }
      } catch {
        issues.push({ type: 'MISSING_ENTRYPOINT', file: 'package.json', line: null,
          functionName: null, current: 'package.json parse failed',
          expected: 'package.json 必須是有效的 JSON', sourceOfTruth: null });
      }
    }
  }
  return { issues };
}

// ─────────────────────────────────────────────────────────────
// refreshTagIndex（非正式 SCAN）
// ─────────────────────────────────────────────────────────────
/**
 * Tag index 更新，不宣稱 SCAN completed，不宣稱 functions.json 已完成
 */
function refreshTagIndex(srcPaths, target, iteration) {
  if (!scanUnified) return { skipped: true };
  const roots = (Array.isArray(srcPaths) ? srcPaths : [srcPaths]).filter(p => fs.existsSync(p));
  if (roots.length === 0) return { skipped: true };
  try {
    for (const sp of roots) scanUnified(sp, target);
    return { skipped: false, success: true };
  } catch (err) {
    return { skipped: false, success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────
// traceCoverageSummary（informational only — NOT a gate）
// ─────────────────────────────────────────────────────────────
/**
 * Story-scoped @TEST coverage summary
 * 純資訊，不影響 phase4-done 判定
 */
function traceCoverageSummary(target, iteration, story) {
  const iterNum      = iteration.replace('iter-', '');
  const contractPath = path.join(target, `.gems/iterations/${iteration}/contract_iter-${iterNum}.ts`);
  if (!fs.existsSync(contractPath)) return { total: 0, covered: 0, uncovered: [] };
  try {
    const content   = fs.readFileSync(contractPath, 'utf8');
    const tddPaths  = [];
    for (const m of content.matchAll(/\/\/\s*@CONTRACT:\s*(.+?)(?=\n\/\/\s*@CONTRACT:|\n(?:export|$))/gs)) {
      const headerLine = m[0].split('\n')[0].replace(/\/\/\s*@CONTRACT:\s*/, '');
      const parts      = headerLine.trim().split('|').map(s => s.trim());
      if (parts[3] !== story) continue;
      for (const tm of m[0].matchAll(/\/\/\s*@TEST:\s*(\S+)/g)) {
        const p = tm[1].trim();
        if (/\.(test|spec)\.(ts|tsx)$/.test(p) && !tddPaths.includes(p)) tddPaths.push(p);
      }
    }
    const covered   = tddPaths.filter(p => fs.existsSync(path.join(target, p))).length;
    const uncovered = tddPaths.filter(p => !fs.existsSync(path.join(target, p)));
    return { total: tddPaths.length, covered, uncovered };
  } catch { return { total: 0, covered: 0, uncovered: [] }; }
}

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────
function walkFiles(dir, skipDirs, skipExt, cb) {
  if (!fs.existsSync(dir)) return;
  let stat;
  try { stat = fs.statSync(dir); } catch { return; }
  if (!stat.isDirectory()) {
    if (/\.(ts|tsx|js|gs)$/.test(dir) && !skipExt.test(dir) && !dir.endsWith('.d.ts')) cb(dir);
    return;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) walkFiles(full, skipDirs, skipExt, cb);
    } else if (/\.(ts|tsx|js|gs)$/.test(entry.name) && !skipExt.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      cb(full);
    }
  }
}

function findPlannedStories(planPath) {
  if (!fs.existsSync(planPath)) return [];
  return fs.readdirSync(planPath)
    .filter(f => f.startsWith('implementation_plan_'))
    .map(f => { const m = f.match(/Story-([\d.]+)/); return m ? `Story-${m[1]}` : null; })
    .filter(Boolean).sort();
}

function findCompletedStories(buildPath) {
  if (!fs.existsSync(buildPath)) return [];
  return fs.readdirSync(buildPath)
    .filter(f => f.startsWith('phase4-done_'))
    .map(f => { const m = f.match(/Story-([\d.]+)/); return m ? `Story-${m[1]}` : null; })
    .filter(Boolean).sort();
}

// ─────────────────────────────────────────────────────────────
// Self-run
// ─────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  let target = process.cwd(), iteration = 'iter-1', story = null, level = 'M';
  args.forEach(a => {
    if (a.startsWith('--target='))    target    = a.split('=')[1];
    if (a.startsWith('--iteration=')) iteration = a.split('=')[1];
    if (a.startsWith('--story='))     story     = a.split('=')[1];
    if (a.startsWith('--level='))     level     = a.split('=')[1];
  });
  if (!path.isAbsolute(target)) target = path.resolve(process.cwd(), target);
  run({ target, iteration, story, level });
}

module.exports = {
  run,
  parseTraceItems,
  findFunctionInFile,
  buildExpectedGemsTag,
  checkTraceClosure,
  checkGemsTagFormat,
  checkSkeletonResidue,
  checkRuntimeReadiness,
  refreshTagIndex,
  traceCoverageSummary,
};
