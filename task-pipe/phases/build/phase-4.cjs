#!/usr/bin/env node
/**
 * BUILD Phase 4: 標籤品質複查 + Fillback (v6.0)
 * 合併原 Phase 2（標籤掃描）+ Phase 8（Fillback）
 *
 * 職責:
 * - GEMS 標籤品質複查（P0-P3 全覆蓋，不是第一次強制）
 * - AC 覆蓋率確認（源碼 // AC-X.Y 錨點 vs ac.ts 定義）
 * - 自動產出 Fillback_Story-X.Y.md + iteration_suggestions_Story-X.Y.json
 * - 判斷是否進入下一個 Story 或完成 iteration
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { emitPass, emitFix, emitBlock } = require('../../lib/shared/log-output.cjs');
const { getNextCmd, getRetryCmd } = require('../../lib/shared/next-command-helper.cjs');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');
const { clearCheckpoints } = require('../../lib/checkpoint.cjs');
const { detectProjectType, getSrcDir } = require('../../lib/shared/project-type.cjs');
const { handlePhaseSuccess } = require('../../lib/shared/error-handler.cjs');
const { getStoryContext, formatStoryContext } = require('../../lib/plan/plan-spec-extractor.cjs');
const { validate: validateSuggestions } = require('../../lib/suggestions-validator.cjs');

// GEMS 掃描器
let scanUnified = null;
let scanGemsTags = null;
try {
  const mod = require('../../lib/scan/gems-scanner-unified.cjs');
  scanUnified = mod.scan;
  scanGemsTags = mod.scanGemsTags;
} catch { /* 可選 */ }

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
  const srcPath = getSrcDir(target, projectType);
  const buildPath = path.join(target, `.gems/iterations/${iteration}/build`);
  const planPath = path.join(target, `.gems/iterations/${iteration}/plan`);
  const fillbackFile = path.join(buildPath, `Fillback_${story}.md`);
  const suggestionsFile = path.join(buildPath, `iteration_suggestions_${story}.json`);
  const implPlanPath = path.join(planPath, `implementation_plan_${story}.md`);

  if (!fs.existsSync(buildPath)) fs.mkdirSync(buildPath, { recursive: true });

  const storyContext = getStoryContext(implPlanPath);

  console.log(`\n🏷️  標籤品質複查 + Fillback | ${story}`);

  // ============================================
  // 1. GEMS 標籤品質複查
  // ============================================
  const tagIssues = checkTagQuality(srcPath, story, target, iteration);

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
  // 2. AC 覆蓋率確認
  // ============================================
  const acCoverage = checkAcCoverage(target, iteration, srcPath, story);

  // ============================================
  // 3. 產出 Fillback + Suggestions（如果還沒有）
  // ============================================
  if (!fs.existsSync(fillbackFile) || !fs.existsSync(suggestionsFile)) {
    const genResult = autoGenerateOutputs(target, iteration, story, buildPath, storyContext, srcPath, tagIssues, acCoverage);
    if (!genResult.success) {
      emitFix({
        scope: `BUILD Phase 4 | ${story}`,
        summary: `自動產出失敗: ${genResult.error}`,
        targetFile: buildPath,
        missing: ['Fillback_Story-X.Y.md', 'iteration_suggestions_Story-X.Y.json'],
        nextCmd: getRetryCmd('BUILD', '4', { story, target: relativeTarget, iteration })
      }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-4', story });
      return { verdict: 'PENDING', reason: 'auto_gen_failed' };
    }

    console.log(`\n✅ 自動產出完成`);
    console.log(`   Fillback: ${path.relative(target, fillbackFile)}`);
    console.log(`   Suggestions: ${path.relative(target, suggestionsFile)}`);

    // 立即驗證自動產出的結果，若通過則不需要第二次執行
    const quickValidation = validateOutputs(fillbackFile, suggestionsFile);
    if (!quickValidation.valid) {
      console.log(`\n📝 請填寫 Suggestions 中的 TODO 欄位後重跑`);
      console.log(`NEXT: ${getRetryCmd('BUILD', '4', { story, target: relativeTarget, iteration })}`);
      return { verdict: 'PENDING', reason: 'fillback_generated' };
    }
    // 自動產出且驗證通過 → 繼續執行後續流程（不返回 PENDING）
  }

  // ============================================
  // 4. 驗證已有的 Fillback + Suggestions
  // ============================================
  const validation = validateOutputs(fillbackFile, suggestionsFile);

  if (!validation.valid) {
    emitFix({
      scope: `BUILD Phase 4 | ${story}`,
      summary: `Fillback/Suggestions 驗證失敗`,
      targetFile: suggestionsFile,
      missing: validation.errors,
      nextCmd: getRetryCmd('BUILD', '4', { story, target: relativeTarget, iteration })
    }, { projectRoot: target, iteration: iterNum, phase: 'build', step: 'phase-4', story });
    return { verdict: 'PENDING', reason: 'validation_failed' };
  }

  // ============================================
  // 5. 全部通過 — 清除 checkpoints，判斷下一步
  // ============================================
  handlePhaseSuccess('BUILD', '4', story, target);
  clearCheckpoints(target, iteration, story);

  const plannedStories = findPlannedStories(planPath);
  const completedStories = findCompletedStories(buildPath);
  const nextStory = plannedStories.find(s => !completedStories.includes(s) && s !== story);
  const isIterationComplete = plannedStories.every(s => completedStories.includes(s) || s === story);

  const tagSummary = `標籤: ${tagIssues.total} 個 | P0: ${tagIssues.p0} P1: ${tagIssues.p1} P2: ${tagIssues.p2} P3: ${tagIssues.p3}`;
  const acSummary = acCoverage.total > 0 ? `AC: ${acCoverage.covered}/${acCoverage.total}` : '';

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
function checkTagQuality(srcPath, story, target, iteration) {
  const result = { critical: [], warnings: [], total: 0, p0: 0, p1: 0, p2: 0, p3: 0 };

  if (!scanGemsTags || !fs.existsSync(srcPath)) return result;

  try {
    const scanResult = scanGemsTags(srcPath);
    const storyFunctions = scanResult.functions.filter(f => f.storyId === story);

    result.total = storyFunctions.length;
    result.p0 = storyFunctions.filter(f => f.priority === 'P0').length;
    result.p1 = storyFunctions.filter(f => f.priority === 'P1').length;
    result.p2 = storyFunctions.filter(f => f.priority === 'P2').length;
    result.p3 = storyFunctions.filter(f => f.priority === 'P3').length;

    // 假實作偵測（CRITICAL）
    for (const fn of storyFunctions) {
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
    for (const fn of storyFunctions) {
      if (fn.priority === 'P0' && !fn.flow) {
        result.critical.push({
          file: fn.file || 'src/',
          message: `${fn.name} (P0) 缺少 GEMS-FLOW，P0 函式必須有 flow 標籤才能進 Phase-4 驗證`,
          acSpec: fn.acIds ? fn.acIds.join(', ') : null
        });
      }
    }
  } catch { /* 掃描失敗不阻擋 */ }

  return result;
}

/**
 * AC 覆蓋率確認
 */
function checkAcCoverage(target, iteration, srcPath, story) {
  const result = { total: 0, covered: 0, uncovered: [] };

  const pocDir = path.join(target, `.gems/iterations/${iteration}/poc`);
  if (!fs.existsSync(pocDir)) return result;

  const files = fs.readdirSync(pocDir);
  const acFile = files.find(f => f === 'ac.ts' || f.endsWith('_ac.ts'))
    || files.find(f => f.startsWith('contract_') && f.endsWith('.ts'));
  if (!acFile) return result;

  try {
    const content = fs.readFileSync(path.join(pocDir, acFile), 'utf8');
    const acIds = new Set();
    const pattern = /\/\/\s*(AC-[\d.]+)/g;
    let m;
    while ((m = pattern.exec(content)) !== null) acIds.add(m[1]);

    result.total = acIds.size;

    // 掃描 src 確認 AC 錨點
    if (scanGemsTags && fs.existsSync(srcPath)) {
      const scanResult = scanGemsTags(srcPath);
      const taggedAcIds = new Set();
      for (const fn of scanResult.functions) {
        if (fn.acIds) fn.acIds.forEach(id => taggedAcIds.add(id));
      }
      for (const id of acIds) {
        if (taggedAcIds.has(id)) result.covered++;
        else result.uncovered.push(id);
      }
    }
  } catch { }

  return result;
}

/**
 * 自動產出 Fillback + Suggestions
 */
function autoGenerateOutputs(target, iteration, story, buildPath, storyContext, srcPath, tagIssues, acCoverage) {
  try {
    const scanResult = scanUnified ? scanUnified(srcPath, target) : { functions: [], stats: { p0: 0, p1: 0, p2: 0, p3: 0 } };
    const storyFunctions = scanResult.functions.filter(f => f.storyId === story);

    const qualityIssues = tagIssues.critical.map(i => ({
      type: 'TAG_QUALITY',
      severity: 'CRITICAL',
      message: i.message,
      file: i.file
    }));

    if (acCoverage.uncovered.length > 0) {
      acCoverage.uncovered.forEach(id => {
        qualityIssues.push({
          type: 'AC_NOT_TAGGED',
          severity: 'WARNING',
          ac: id,
          message: `${id} — 源碼未標記 // ${id} 錨點`
        });
      });
    }

    const suggestions = {
      storyId: story,
      iterationId: iteration,
      status: 'Completed',
      completedItems: storyFunctions.length > 0
        ? [{ itemId: 1, name: '實作完成', functions: storyFunctions.map(f => f.name) }]
        : [],
      tagStats: {
        p0: tagIssues.p0, p1: tagIssues.p1,
        p2: tagIssues.p2, p3: tagIssues.p3,
        total: tagIssues.total
      },
      acCoverage: {
        total: acCoverage.total,
        covered: acCoverage.covered,
        uncovered: acCoverage.uncovered
      },
      technicalHighlights: storyFunctions.length > 0
        ? storyFunctions.map(f => `實作 ${f.name}（${f.priority || 'P1'}）`)
        : (storyContext && storyContext.items && storyContext.items.length > 0
            ? storyContext.items.map(i => `完成 ${i.id}: ${i.name || i.id}`)
            : ['Story 實作完成']),
      technicalDebt: [],
      suggestions: qualityIssues.length === 0
        ? [{ type: 'QUALITY', message: `${story} 標籤與 AC 品質良好，建議繼續下一個 Story` }]
        : [],
      qualityIssues: qualityIssues.length > 0 ? qualityIssues : undefined,
      nextIteration: {
        suggestedGoal: storyContext && storyContext.storyName
          ? `繼續 ${storyContext.storyId} 後續 Story 開發`
          : '繼續下一個 Story 開發',
        suggestedItems: []
      },
      blockers: []
    };

    fs.writeFileSync(
      path.join(buildPath, `iteration_suggestions_${story}.json`),
      JSON.stringify(suggestions, null, 2), 'utf8'
    );

    const fillback = [
      `# Fillback ${story}`,
      '',
      `## 基本資訊`,
      `- **Iteration**: ${iteration}`,
      `- **Story ID**: ${story}`,
      `- **Status**: Completed`,
      `- **完成日期**: ${new Date().toISOString().split('T')[0]}`,
      '',
    ];

    // Foundation Story（CONST/型別/骨架）沒有 CALC AC，統計無意義
    const isFoundation = story.endsWith('.0') || (storyContext && storyContext.storyType === 'Foundation');
    const hasCalcAc = acCoverage.total > 0;

    if (isFoundation && !hasCalcAc) {
      fillback.push(`## Foundation Story — 不適用`);
      fillback.push(`此 Story 為骨架/型別定義層，無 CALC AC，標籤統計與 AC 覆蓋不適用。`);
      fillback.push(`驗收方式：TypeScript 編譯通過（tsc --noEmit）+ Phase 1 骨架映射完整。`);
      fillback.push('');
    } else {
      fillback.push(`## 標籤統計`);
      fillback.push(`- P0: ${tagIssues.p0} | P1: ${tagIssues.p1} | P2: ${tagIssues.p2} | P3: ${tagIssues.p3}`);
      fillback.push('');
      fillback.push(`## AC 覆蓋`);
      fillback.push(`- 總計: ${acCoverage.total} | 已標記: ${acCoverage.covered}`);
      if (acCoverage.uncovered.length > 0) fillback.push(`- 未標記: ${acCoverage.uncovered.join(', ')}`);
      fillback.push('');
    }

    fillback.push(`## 產出函式`);
    fillback.push(...storyFunctions.map(f => `- \`${f.name}\` (${f.priority}) — ${f.description || ''}`));

    fs.writeFileSync(path.join(buildPath, `Fillback_${story}.md`), fillback.filter(l => l !== undefined).join('\n'), 'utf8');

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 驗證 Fillback + Suggestions 必填欄位
 */
function validateOutputs(fillbackFile, suggestionsFile) {
  const errors = [];

  if (!fs.existsSync(fillbackFile)) errors.push('Fillback_Story-X.Y.md 不存在');
  if (!fs.existsSync(suggestionsFile)) errors.push('iteration_suggestions_Story-X.Y.json 不存在');

  if (errors.length > 0) return { valid: false, errors };

  try {
    const json = JSON.parse(fs.readFileSync(suggestionsFile, 'utf8'));
    if (!json.storyId) errors.push('suggestions.json 缺少 storyId');
    if (!json.status) errors.push('suggestions.json 缺少 status');

    // 零容忍：qualityIssues + suggestions 合計至少 1 個（v6 放寬，不強制 3 個）
    const qiCount = Array.isArray(json.qualityIssues) ? json.qualityIssues.length : 0;
    const sugCount = Array.isArray(json.suggestions) ? json.suggestions.length : 0;
    if (qiCount + sugCount === 0) {
      errors.push('suggestions.json 需要至少 1 個 qualityIssues 或 suggestions 條目');
    }

    // CRITICAL issues 必須修完
    const criticals = (json.qualityIssues || []).filter(q => q.severity === 'CRITICAL');
    if (criticals.length > 0) {
      errors.push(`${criticals.length} 個 CRITICAL 品質問題未修復`);
    }
  } catch (e) {
    errors.push(`suggestions.json 格式錯誤: ${e.message}`);
  }

  return { valid: errors.length === 0, errors };
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
    .filter(f => f.startsWith('Fillback_'))
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
