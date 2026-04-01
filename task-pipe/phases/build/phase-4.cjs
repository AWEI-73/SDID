#!/usr/bin/env node
/**
 * BUILD Phase 4: 標籤品質複查 + SCAN 注入 (v7.1)
 *
 * 職責:
 * - GEMS 標籤品質複查（假實作偵測 + P0 FLOW 驗證）
 * - TDD 覆蓋率確認（v4: @TEST / v3: @GEMS-TDD）
 * - SCAN 注入 flow+testPath 到 functions.json
 * - 判斷是否進入下一個 Story 或完成 iteration
 *
 * 移除（M28-5）：Fillback_Story-X.Y.md + iteration_suggestions_Story-X.Y.json
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { emitPass, emitFix, emitBlock } = require('../../lib/shared/log-output.cjs');
const { getNextCmd, getRetryCmd } = require('../../lib/shared/next-command-helper.cjs');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');
const { clearCheckpoints } = require('../../lib/checkpoint.cjs');
const { detectProjectType, getSrcDir, getSrcDirs } = require('../../lib/shared/project-type.cjs');
const { handlePhaseSuccess } = require('../../lib/shared/error-handler.cjs');
const { getStoryContext } = require('../../lib/plan/plan-spec-extractor.cjs');

// GEMS 掃描器
let scanUnified = null;
let scanGemsTags = null;
try {
  const mod = require('../../lib/scan/gems-scanner-unified.cjs');
  scanUnified = mod.scan;
  scanGemsTags = mod.scanGemsTags;
} catch { /* 可選 */ }

/** GEMS: buildPhase4 | P1 | checkTagQuality(IO)→checkAcCoverage(IO)→runScan(IO)→RETURN:PhaseResult | Story-4.0 */
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
  const srcPaths = getSrcDirs(target);                                      // multi-root 支援
  const srcPath = srcPaths.find(p => fs.existsSync(p)) || srcPaths[0];     // 向後相容單一路徑
  const buildPath = path.join(target, `.gems/iterations/${iteration}/build`);
  const planPath = path.join(target, `.gems/iterations/${iteration}/plan`);
  const implPlanPath = path.join(planPath, `implementation_plan_${story}.md`);

  if (!fs.existsSync(buildPath)) fs.mkdirSync(buildPath, { recursive: true });

  const storyContext = getStoryContext(implPlanPath);

  console.log(`\n🏷️  標籤品質複查 + SCAN | ${story}`);

  // ============================================
  // 1. GEMS 標籤品質複查
  // ============================================
  const tagIssues = checkTagQuality(srcPaths, story, target, iteration);

  if (tagIssues.critical.length > 0) {
    const tasks = tagIssues.critical.map(issue => ({
      action: 'FIX_GEMS_TAG',
      file: issue.file,
      expected: issue.message,
      acSpec: issue.acSpec || null
    }));
    emitFix({
      scope: `BUILD Phase 4 | ${story}`,
      summary: `GEMS 標籤品質問題 (${tagIssues.critical.length} 個 CRITICAL)`,
      targetFile: 'src/',
      missing: tagIssues.critical.map(i => i.message),
      nextCmd: getRetryCmd('BUILD', '4', { story, target: relativeTarget, iteration }),
      tasks
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-4', story });
    return { verdict: 'BLOCKER', reason: 'tag_quality_critical' };
  }

  // ============================================
  // 2. AC 覆蓋率確認（v4: @TEST / v3: @GEMS-TDD）
  // ============================================
  const acCoverage = checkAcCoverage(target, iteration, srcPath, story);

  // ============================================
  // 3. SCAN 注入 flow+testPath 到 functions.json
  // ============================================
  runScan(srcPaths, target, iteration, story);

  // ============================================
  // 4. 全部通過 — 寫完成標記，清除 checkpoints，判斷下一步
  // ============================================
  // 寫完成標記（取代舊 Fillback 做為 findCompletedStories 依據）
  try {
    fs.writeFileSync(
      path.join(buildPath, `phase4-done_${story}`),
      JSON.stringify({ storyId: story, iteration, completedAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } catch { /* 非關鍵 */ }

  handlePhaseSuccess('BUILD', '4', story, target);
  clearCheckpoints(target, iteration, story);

  const plannedStories = findPlannedStories(planPath);
  const completedStories = findCompletedStories(buildPath);
  const nextStory = plannedStories.find(s => !completedStories.includes(s) && s !== story);
  const isIterationComplete = plannedStories.every(s => completedStories.includes(s) || s === story);

  const tagSummary = `標籤: ${tagIssues.total} 個 | P0: ${tagIssues.p0} P1: ${tagIssues.p1} P2: ${tagIssues.p2} P3: ${tagIssues.p3}`;
  const acSummary = acCoverage.total > 0 ? `TDD: ${acCoverage.covered}/${acCoverage.total} 測試檔` : '';

  if (isIterationComplete) {
    // 寫 pass log 讓 state-machine 推進
    try {
      const logsDir = path.join(target, '.gems', 'iterations', iteration, 'logs');
      if (fs.existsSync(logsDir)) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        fs.writeFileSync(path.join(logsDir, `build-phase-4-${story}-pass-${ts}.log`), '@PASS\n', 'utf8');
      }
    } catch { }

    emitPass({
      scope: `BUILD Phase 4 | ${story}`,
      summary: `${tagSummary}${acSummary ? ' | ' + acSummary : ''} | Iteration 完成`,
      acSummary: acSummary || undefined,
      nextCmd: `node task-pipe/runner.cjs --phase=SCAN --target=${relativeTarget}`
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-4', story });

    return { verdict: 'PASS', iterationComplete: true };
  }

  emitPass({
    scope: `BUILD Phase 4 | ${story}`,
    summary: `${tagSummary}${acSummary ? ' | ' + acSummary : ''}`,
    acSummary: acSummary || undefined,
    nextCmd: nextStory
      ? `node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${nextStory} --target=${relativeTarget} --iteration=${iteration}`
      : getNextCmd('BUILD', '4', { story, level, target: relativeTarget, iteration })
  }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-4', story });

  return { verdict: 'PASS', nextStory };
}

/**
 * GEMS 標籤品質複查
 * 品質複查（不是第一次強制），只報 CRITICAL 問題
 */
function checkTagQuality(srcPathOrPaths, story, target, iteration) {
  const result = { critical: [], warnings: [], total: 0, p0: 0, p1: 0, p2: 0, p3: 0 };
  if (!scanGemsTags) return result;

  // 支援單一路徑（string）或多路徑（string[]）
  const srcPaths = Array.isArray(srcPathOrPaths) ? srcPathOrPaths : [srcPathOrPaths];
  const existingPaths = srcPaths.filter(p => fs.existsSync(p));
  if (existingPaths.length === 0) return result;

  // 掃描所有 srcDirs，合併結果
  const allStoryFunctions = [];
  for (const sp of existingPaths) {
    try {
      const scanResult = scanGemsTags(sp);
      const fns = scanResult.functions.filter(f => f.storyId === story);
      allStoryFunctions.push(...fns);
    } catch { /* 單目錄掃描失敗不影響其他目錄 */ }
  }

  result.total = allStoryFunctions.length;
  result.p0 = allStoryFunctions.filter(f => f.priority === 'P0').length;
  result.p1 = allStoryFunctions.filter(f => f.priority === 'P1').length;
  result.p2 = allStoryFunctions.filter(f => f.priority === 'P2').length;
  result.p3 = allStoryFunctions.filter(f => f.priority === 'P3').length;

  // 假實作偵測（CRITICAL）
  for (const fn of allStoryFunctions) {
    if (fn.fraudIssues && fn.fraudIssues.length > 0) {
      for (const issue of fn.fraudIssues) {
        result.critical.push({
          file: fn.file || 'src/',
          message: `[FRAUD] ${fn.name}: ${issue}`,
          acSpec: fn.acIds ? fn.acIds.join(', ') : null
        });
      }
    }
  }

  // P0 缺少 GEMS-FLOW → BLOCKER；P1+ 略過（不擋）
  for (const fn of allStoryFunctions) {
    if (fn.priority === 'P0' && !fn.flow) {
      result.critical.push({
        file: fn.file || 'src/',
        message: `${fn.name} (P0) 缺少 GEMS-FLOW，P0 函式必須有 flow 標籤才能進 Phase-4 驗證`,
        acSpec: fn.acIds ? fn.acIds.join(', ') : null
      });
    }
  }

  return result;
}

/**
 * v7.1: TDD 覆蓋率確認（雙模式）
 * - v4 contract（有 @CONTRACT:）→ 讀 @TEST: 路徑
 * - v3 contract → 讀 @GEMS-TDD: 路徑
 */
function checkAcCoverage(target, iteration, srcPath, story) {
  const result = { total: 0, covered: 0, uncovered: [], isV4: false };

  const iterNum = iteration.replace('iter-', '');
  const contractPath = path.join(target, `.gems/iterations/${iteration}/contract_iter-${iterNum}.ts`);
  if (!fs.existsSync(contractPath)) return result;

  try {
    const content = fs.readFileSync(contractPath, 'utf8');
    const isV4 = /\/\/\s*@CONTRACT:\s*\w+/.test(content);
    result.isV4 = isV4;

    const tddPaths = [];
    if (isV4) {
      // v4: 讀 @TEST: 路徑（過濾非 .test.ts 格式的）
      const pattern = /\/\/\s*@TEST:\s*(.+)/g;
      let m;
      while ((m = pattern.exec(content)) !== null) {
        const p = m[1].trim();
        if (p && /\.(test|spec)\.(ts|tsx)$/.test(p) && !tddPaths.includes(p)) {
          tddPaths.push(p);
        }
      }
    } else {
      // v3: 讀 @GEMS-TDD: 路徑
      const pattern = /\/\/\s*@GEMS-TDD:\s*(.+)/g;
      let m;
      while ((m = pattern.exec(content)) !== null) {
        const p = m[1].trim();
        if (p && !tddPaths.includes(p)) tddPaths.push(p);
      }
    }

    result.total = tddPaths.length;
    for (const p of tddPaths) {
      const fullPath = path.join(target, p);
      if (fs.existsSync(fullPath)) result.covered++;
      else result.uncovered.push(p);
    }
  } catch { }

  return result;
}

/**
 * SCAN 注入：將 flow+testPath 從 contract 注入到 functions.json（M28-5/M28-8）
 * scanUnified 存在時自動執行；不存在時靜默跳過
 */
function runScan(srcPaths, target, iteration, story) {
  if (!scanUnified) return;
  const existingPaths = srcPaths.filter(p => fs.existsSync(p));
  if (existingPaths.length === 0) return;
  try {
    // 觸發掃描（gems-scanner-unified 會自行寫 functions.json）
    for (const sp of existingPaths) {
      scanUnified(sp, target);
    }
    console.log(`\n📡 SCAN 完成 → functions.json 已更新`);
  } catch (err) {
    console.log(`\n⚠️  SCAN 失敗（非 BLOCKER）: ${err.message}`);
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

// 自我執行
if (require.main === module) {
  const args = process.argv.slice(2);
  let target = process.cwd();
  let iteration = 'iter-1';
  let story = null;
  let level = 'M';
  args.forEach(arg => {
    if (arg.startsWith('--target=')) target = arg.split('=')[1];
    if (arg.startsWith('--iteration=')) iteration = arg.split('=')[1];
    if (arg.startsWith('--story=')) story = arg.split('=')[1];
    if (arg.startsWith('--level=')) level = arg.split('=')[1];
  });
  if (!path.isAbsolute(target)) target = path.resolve(process.cwd(), target);
  run({ target, iteration, story, level });
}

module.exports = { run };
