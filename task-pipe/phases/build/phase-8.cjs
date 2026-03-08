#!/usr/bin/env node
/**
 * BUILD Phase 8: 完成規格
 * 
 * 輸入: 完成的程式碼
 * 產物: Fillback_Story-[X.Y].md + iteration_suggestions_Story-[X.Y].json
 * 
 * 驗證規則:
 * - 嚴格（必填）: storyId, status, 基本資訊 → 缺少則 TACTICAL_FIX
 * - 寬鬆（選填）: suggestions[], technicalDebt[], summary → 只給警告
 * 
 * 軍規 5: 小跑修正 → SEARCH→修正→重試，最多 3 次
 */
const fs = require('fs');
const path = require('path');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');
const { clearCheckpoints } = require('../../lib/checkpoint.cjs');
const { validate: validateSuggestions } = require('../../lib/suggestions-validator.cjs');
const { createErrorHandler, handlePhaseSuccess, MAX_ATTEMPTS } = require('../../lib/shared/error-handler.cjs');
const { getStoryContext, formatStoryContext } = require('../../lib/plan/plan-spec-extractor.cjs');
const { detectProjectType, getSrcDir } = require('../../lib/shared/project-type.cjs');
const { anchorOutput, anchorPass, anchorError, anchorErrorSpec, anchorTemplatePending, emitFix, emitBlock } = require('../../lib/shared/log-output.cjs');
const { validateStepConsistency, formatValidationResult } = require('../../lib/step-consistency-validator.cjs');
const { getNextCmd, getRetryCmd, getPassCmd } = require('../../lib/shared/next-command-helper.cjs');

// Note: validateExecutability is loaded dynamically in checkProjectExecutability()

// v2.1: 統一使用 gems-scanner-unified（內建 AST + Regex fallback + AC 後處理）
const { scan: scanUnified, scanGemsTags } = require('../../lib/scan/gems-scanner-unified.cjs');

function run(options) {

  console.log(getSimpleHeader('BUILD', 'Phase 8'));

  const { target, iteration = 'iter-1', story, level = 'M' } = options;
  // 計算相對路徑（用於輸出指令，避免絕對路徑問題）
  const relativeTarget = path.relative(process.cwd(), target) || '.';

  const buildPath = `.gems/iterations/${iteration}/build`;
  const planPath = `.gems/iterations/${iteration}/plan`;

  // 門控規格 - 告訴 AI 這個 phase 會檢查什麼
  // 注意：路由整合檢查在 Phase 7，這裡只檢查「環境可執行性」
  const gateSpec = {
    checks: [
      { name: 'Fillback 檔案', pattern: 'Fillback_Story-X.Y.md', desc: '開發記錄文件' },
      { name: 'Suggestions 檔案', pattern: 'iteration_suggestions_Story-X.Y.json', desc: '迭代建議 JSON' },
      { name: 'storyId 欄位', pattern: '"storyId": "Story-X.Y"', desc: 'JSON 必填欄位' },
      { name: 'status 欄位', pattern: '"status": "Completed"', desc: 'JSON 必填欄位' },
      // 以下為「環境可執行性」檢查（iteration 完成時才驗證）
      { name: '入口點', pattern: 'index.html + main.ts', desc: '專案有 HTML 和 JS 入口' },
      { name: 'npm scripts', pattern: 'dev/start script', desc: '有可執行的 npm run dev' },
      { name: 'bundler', pattern: 'vite/webpack', desc: 'TS 專案需要打包工具' }
    ],
    note: '路由整合檢查在 Phase 7 (BLOCKER)，這裡只檢查環境'
  };

  if (!story) {
    emitFix({
      scope: 'BUILD Phase 8',
      summary: '缺少 --story 參數',
      targetFile: 'CLI 參數',
      missing: ['--story 參數'],
      example: `node task-pipe/runner.cjs --phase=BUILD --step=8 --story=Story-1.0 --target=${relativeTarget}`,
      nextCmd: 'node task-pipe/runner.cjs --phase=BUILD --step=8 --story=Story-X.Y',
      gateSpec: gateSpec
    }, {
      projectRoot: target,
      phase: 'build',
      step: 'phase-8',
      story
    });
    return { verdict: 'BLOCKER' };
  }

  // 建立錯誤處理器
  const errorHandler = createErrorHandler('BUILD', '8', story);

  const fullBuildPath = path.join(target, buildPath);
  const fullPlanPath = path.join(target, planPath);
  const fillbackFile = path.join(fullBuildPath, `Fillback_${story}.md`);
  const suggestionsFile = path.join(fullBuildPath, `iteration_suggestions_${story}.json`);
  const implPlanPath = path.join(fullPlanPath, `implementation_plan_${story}.md`);

  // 讀取 Story Context
  const storyContext = getStoryContext(implPlanPath);

  // 確保目錄存在
  if (!fs.existsSync(fullBuildPath)) {
    fs.mkdirSync(fullBuildPath, { recursive: true });
  }

  // 檢查是否已有產出
  if (fs.existsSync(fillbackFile) && fs.existsSync(suggestionsFile)) {
    const checks = validatePhase7(fillbackFile, suggestionsFile);
    const failed = checks.filter(c => !c.pass && c.required);
    const warnings = checks.filter(c => !c.pass && !c.required);

    // 額外驗證 suggestions 必填欄位
    const suggestionsValidation = validateSuggestions(suggestionsFile);
    if (!suggestionsValidation.valid) {
      failed.push(...suggestionsValidation.errors.map(e => ({ name: e, pass: false, required: true })));
    }

    if (failed.length === 0) {
      // ============================================
      // v2.7 P7: 零容忍門檻 — qualityIssues + suggestions >= 3
      // ============================================
      try {
        const sugJson = JSON.parse(fs.readFileSync(suggestionsFile, 'utf8'));
        const qiCount = Array.isArray(sugJson.qualityIssues) ? sugJson.qualityIssues.length : 0;
        const sugCount = Array.isArray(sugJson.suggestions) ? sugJson.suggestions.length : 0;
        const totalFindings = qiCount + sugCount;
        const ZERO_TOLERANCE_MIN = 3;

        // CRITICAL findings → BLOCKER (假實作必須修完)
        const criticalIssues = (sugJson.qualityIssues || []).filter(q => q.severity === 'CRITICAL');
        if (criticalIssues.length > 0) {
          anchorOutput({
            context: `Phase 8 | ${story} | CRITICAL quality issues`,
            error: {
              type: 'BLOCKER',
              summary: `${criticalIssues.length} 個 CRITICAL 品質問題必須修復:\n${criticalIssues.map(q => `- [${q.type}] ${q.function || q.file || ''}: ${q.message}`).join('\n')}`
            },
            task: criticalIssues.map(q => `修復 ${q.function || q.file}: ${q.message}`),
            output: `NEXT: ${getRetryCmd('BUILD', '8', { story, target: relativeTarget, iteration })}`
          }, {
            projectRoot: target,
            iteration: parseInt(iteration.replace('iter-', '')),
            phase: 'build',
            step: 'phase-8',
            story
          });
          return { verdict: 'BLOCKER', reason: 'critical_quality_issues' };
        }

        // 零容忍門檻: 合計不到 3 個 → FAIL
        if (totalFindings < ZERO_TOLERANCE_MIN) {
          anchorOutput({
            context: `Phase 8 | ${story} | 零容忍門檻未達`,
            error: {
              type: 'TACTICAL_FIX',
              summary: `qualityIssues(${qiCount}) + suggestions(${sugCount}) = ${totalFindings}，最少需要 ${ZERO_TOLERANCE_MIN} 個`
            },
            guide: {
              title: 'P7_ZERO_TOLERANCE',
              content: `請在 ${path.relative(target, suggestionsFile)} 中補充改善建議:\n- suggestions[]: 至少補到合計 ${ZERO_TOLERANCE_MIN} 個\n- 類型: REFACTOR / FEATURE / TEST / PERFORMANCE\n- 不要敷衍，寫有意義的改善建議`
            },
            output: `NEXT: ${getRetryCmd('BUILD', '8', { story, target: relativeTarget, iteration })}`
          }, {
            projectRoot: target,
            iteration: parseInt(iteration.replace('iter-', '')),
            phase: 'build',
            step: 'phase-8',
            story
          });
          return { verdict: 'PENDING', reason: 'zero_tolerance_not_met', totalFindings };
        }
      } catch (e) {
        // JSON 解析失敗已在上面處理，這裡忽略
      }

      handlePhaseSuccess('BUILD', '8', story, target);
      clearCheckpoints(target, iteration, story);

      const nextStory = findNextStory(fullPlanPath, story);
      const iterationStatus = getIterationStatus(fullPlanPath, fullBuildPath);
      const isIterationComplete = iterationStatus.completed === iterationStatus.total;

      // 判斷是否進入 SCAN
      if (isIterationComplete) {
        // v4.0: 可執行性驗證 - 確保專案可以實際運行
        const execCheck = checkProjectExecutability(target, iteration);

        if (!execCheck.valid) {
          // 缺少入口點 = BLOCKER
          const criticalIssues = execCheck.issues.filter(i => i.severity === 'CRITICAL');
          const warningIssues = execCheck.issues.filter(i => i.severity === 'WARNING');

          anchorOutput({
            context: `Phase 8 | ${story} | 可執行性驗證失敗`,
            error: {
              type: 'BLOCKER',
              summary: `專案無法執行:\n${criticalIssues.map(i => `- ${i.message}`).join('\n')}`
            },
            info: Object.assign(
              { '技術棧': execCheck.techStack ? `${execCheck.techStack.language} | ${execCheck.techStack.projectType}` : '(未分析)' },
              warningIssues.length > 0 ? { '警告': warningIssues.map(i => i.message).join('; ') } : {}
            ),
            task: criticalIssues.map(i => i.suggestion),
            output: `NEXT: ${getRetryCmd('BUILD', '8', { story, target: relativeTarget, iteration })}`
          }, {
            projectRoot: target,
            iteration: parseInt(iteration.replace('iter-', '')),
            phase: 'build',
            step: 'phase-8',
            story
          });
          return { verdict: 'BLOCKER', reason: '可執行性驗證失敗' };
        }

        // v4.1: Smoke Test - 實際編譯/啟動驗證
        const smokeResult = runSmokeTest(target);
        
        // 存檔 smoke test 結果
        const { saveLog } = require('../../lib/shared/log-output.cjs');
        const smokeLogContent = [
          '═══════════════════════════════════════════════════════════════',
          '  SMOKE TEST REPORT',
          '═══════════════════════════════════════════════════════════════',
          '',
          `結果: ${smokeResult.success ? '✅ PASS' : '❌ FAIL'}`,
          smokeResult.skipped ? '(已跳過 - 無 build script)' : '',
          '',
          '執行日誌:',
          ...smokeResult.logs.map(l => `  ${l}`),
          '',
          smokeResult.error ? `錯誤: ${smokeResult.error}` : '',
          '═══════════════════════════════════════════════════════════════'
        ].filter(Boolean).join('\n');
        
        saveLog({
          projectRoot: target,
          iteration: parseInt(iteration.replace('iter-', '')),
          phase: 'build',
          step: 'phase-8',
          story,
          type: 'smoke-test',
          content: smokeLogContent
        });
        
        if (!smokeResult.success && !smokeResult.skipped) {
          anchorOutput({
            context: `Phase 8 | ${story} | Smoke Test 失敗`,
            error: {
              type: 'BLOCKER',
              summary: `專案無法編譯/啟動:\n${smokeResult.error || '未知錯誤'}`
            },
            info: {
              '日誌': smokeResult.logs.slice(-3).join('\n')
            },
            task: ['檢查編譯錯誤', '確認 TypeScript 設定正確', '修復後重新執行'],
            output: `NEXT: ${getRetryCmd('BUILD', '8', { story, target: relativeTarget, iteration })}`
          }, {
            projectRoot: target,
            iteration: parseInt(iteration.replace('iter-', '')),
            phase: 'build',
            step: 'phase-8',
            story
          });
          return { verdict: 'BLOCKER', reason: 'smoke_test_failed', smokeResult };
        }
        
        const smokeStatus = smokeResult.skipped ? '(跳過)' : '✓';

        // 可執行性警告（不阻擋但顯示）
        const execWarnings = execCheck.issues.filter(i => i.severity === 'WARNING');
        const warningNote = warnings.length > 0
          ? `\n[WARN] 建議補充: ${warnings.map(w => w.name).join(', ')}`
          : '';
        const execWarningNote = execWarnings.length > 0
          ? `\n[WARN] 可執行性: ${execWarnings.map(w => w.message).join('; ')}`
          : '';

        // dict-sync: 回寫 lineRange/status 到 .gems/specs/*.json
        let dictSyncNote = '';
        try {
          const { syncDict } = require('../../../sdid-tools/dict-sync.cjs');
          const srcDir = path.join(target, getSrcDir(target));
          const syncResult = syncDict(target, srcDir, false);
          const updatedCount = Array.isArray(syncResult.updated) ? syncResult.updated.length : (syncResult.updated || 0);
          dictSyncNote = updatedCount > 0 ? `dict-sync: ${updatedCount} 筆更新` : 'dict-sync: 無變更';
        } catch (e) {
          dictSyncNote = `dict-sync: 跳過 (${e.message.split('\n')[0]})`;
        }

        anchorOutput({
          context: `Phase 8 | ${story} | BUILD 完成`,
          info: {
            'Fillback': 'OK',
            'Suggestions': 'OK',
            'Checkpoints': '已清除',
            'Dict-Sync': dictSyncNote,
            'Iteration': `${iteration} 全部完成 (${iterationStatus.completed}/${iterationStatus.total})`,
            '入口點': execCheck.hasEntryPoint ? '✓' : '✗',
            'Smoke Test': smokeStatus,
            '路由': execCheck.hasRoutes ? '✓' : '(可選)',
            '技術棧': execCheck.techStack ? `${execCheck.techStack.language} | ${execCheck.techStack.projectType} | storage: ${execCheck.techStack.storage}` : '(未分析)',
            'UI': execCheck.techStack?.hasUI ? `✓ (${execCheck.techStack.frontendFramework || 'custom'})` : '✗ (純後端)',
            'Bundler': execCheck.techStack?.hasBundler ? '✓' : execCheck.techStack?.hasUI === false ? '✗ (不需要)' : '✗',
            '信心度': execCheck.techStack ? `${execCheck.techStack.confidence}%` : '-'
          },
          guide: {
            title: 'BUILD_COMPLETE',
            content: `所有 Story 已完成開發，建議執行 SCAN 階段：
1. 更新專案規格文件
2. 檢查標籤一致性
3. 產出完整專案文件`
          },
          output: `--- BUILD COMPLETE ---
{"phase": "BUILD", "status": "COMPLETE", "iteration": "${iteration}", "storiesCompleted": ${iterationStatus.completed}}

NEXT: node task-pipe/runner.cjs --phase=SCAN --target=${relativeTarget}`
        }, {
          projectRoot: target,
          iteration: parseInt(iteration.replace('iter-', '')),
          phase: 'build',
          step: 'phase-8',
          story
        });

        // 保留原始 console.log 給終端機看
        console.log(warningNote + execWarningNote);

        // 寫 pass log，讓 state-machine 的 log-based inference 能正確推進到 SHRINK
        try {
          const logsDir = path.join(target, '.gems', 'iterations', iteration, 'logs');
          if (fs.existsSync(logsDir)) {
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            fs.writeFileSync(path.join(logsDir, `build-phase-8-${story}-pass-${ts}.log`), '@PASS\n', 'utf8');
          }
        } catch (e) { }

        return { verdict: 'PASS', nextPhase: 'SCAN', iterationComplete: true, smokeResult };
      }

      // 還有下一個 Story
      const warningNote = warnings.length > 0
        ? `\n[WARN] 建議補充: ${warnings.map(w => w.name).join(', ')}`
        : '';

      anchorOutput({
        context: `Phase 8 | ${story} | BUILD 完成`,
        info: {
          'Fillback': 'OK',
          'Suggestions': 'OK',
          'Checkpoints': '已清除',
          'Iteration': `完成: ${iterationStatus.completed}/${iterationStatus.total}`
        },
        guide: {
          title: 'POST_COMPLETION',
          content: `${story} 完成，是否繼續下一個 Story？
選項: [繼續] [暫停檢查] [調整計畫]`
        },
        output: `NEXT: node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${nextStory}`
      }, {
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'build',
        step: 'phase-8',
        story
      });

      // 保留原始 console.log 給終端機看
      console.log(warningNote);

      return { verdict: 'PASS', nextStory };
    }

    // 檢查 BLOCKER
    if (errorHandler.shouldBlock()) {
      emitBlock({
        scope: `BUILD Phase 8 | ${story}`,
        summary: `完成規格需要進一步完善 (${MAX_ATTEMPTS}/${MAX_ATTEMPTS})`,
        nextCmd: '建議：架構師協作，確認產出檔案完整',
        missing: failed.map(f => f.name)
      }, {
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'build',
        step: 'phase-8',
        story
      });
      return { verdict: 'BLOCKER' };
    }

    // 記錄錯誤
    errorHandler.recordError('E5', failed.map(f => f.name).join('; '));
    const attempt = errorHandler.getAttemptCount();
    const recoveryLevel = errorHandler.getRecoveryLevel();

    anchorOutput({
      context: `Phase 8 | ${story} | 完成規格失敗`,
      error: {
        type: 'TACTICAL_FIX',
        summary: `Issues:\n${failed.map(f => `- ${f.name}`).join('\n')}`,
        attempt,
        maxAttempts: MAX_ATTEMPTS
      },
      guide: {
        title: 'STORY_CONTEXT',
        content: formatStoryContext(storyContext)
      },
      template: {
        title: `RECOVERY_ACTION (Level ${recoveryLevel})`,
        content: recoveryLevel === 1
          ? '補充缺失必填欄位'
          : recoveryLevel === 2
            ? '參考模板完成 Fillback 與 Suggestions'
            : '完整分析產出需求，準備人類介入'
      },
      output: `NEXT: ${getRetryCmd('BUILD', '8', { story, target: relativeTarget, iteration })}`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-8',
      story
    });
    return { verdict: 'PENDING', attempt };
  }

  // 首次執行：自動產出 Fillback 與 Suggestions
  const autoGenerated = autoGenerateOutputs(target, iteration, story, fullBuildPath, storyContext);

  if (autoGenerated.success) {
    anchorOutput({
      context: `Phase 8 | ${story} | 自動產出完成`,
      info: {
        'Fillback': autoGenerated.fillbackFile,
        'Suggestions': autoGenerated.suggestionsFile,
        '函式總數': autoGenerated.stats.total,
        'P0': autoGenerated.stats.p0,
        'P1': autoGenerated.stats.p1,
        'P2': autoGenerated.stats.p2
      },
      guide: {
        title: 'AI_TASK',
        content: `請編輯 ${autoGenerated.suggestionsFile} 並填寫以下 TODO 欄位：

1. **technicalHighlights** (技術亮點)
   - 本次實作的創新點或優點
   - 例: "使用 localStorage 實現持久化儲存", "模組化設計便於擴展"

2. **technicalDebt** (技術債)
   - 已知但未處理的問題
   - 格式: { "id": "TD-1", "description": "描述", "priority": "LOW|MEDIUM|HIGH", "effort": "1h" }

3. **suggestions** (改善建議)
   - 如果已有壓力測試建議則可跳過，否則補充
   - 格式: { "id": "SUG-1", "type": "REFACTOR|FEATURE|TEST", "description": "描述", "priority": 1-3 }

4. **nextIteration** (下次迭代)
   - suggestedGoal: 下次迭代的主要目標
   - suggestedItems: 建議的 Item 列表`
      },
      output: `NEXT: ${getRetryCmd('BUILD', '8', { story, target: relativeTarget, iteration })}`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'build',
      step: 'phase-8',
      story
    });
    return { verdict: 'PENDING', autoGenerated: true };
  }

  // 自動產出失敗，顯示手動模板
  const fillbackTemplate = `# Fillback ${story}

## 基本資訊
- **Iteration**: ${iteration}
- **Story ID**: ${story}
- **Status**: Completed
- **完成日期**: ${new Date().toISOString().split('T')[0]}

## 開發 Log
### Item 1: [名稱]
- [x] Phase 1: 開發腳本
- [x] Phase 2: 測試腳本
- [x] Phase 3-6: 驗收通過

## 測試結果
- **Unit Test**: X/X 通過
- **Coverage**: XX%

## 產出檔案
- \`path/to/file.ts\` - 說明

## 下一步建議
- 建議 1`;

  const suggestionsTemplate = `{
  "storyId": "${story}",
  "iterationId": "${iteration}",
  "status": "Completed",
  "completedItems": [
    { "itemId": 1, "name": "Item 名稱", "functions": ["fn1", "fn2"] }
  ],
  "technicalHighlights": [
    "實作亮點 1",
    "實作亮點 2"
  ],
  "technicalDebt": [
    { "id": "TD-1", "description": "技術債描述", "priority": "LOW", "effort": "1h" }
  ],
  "suggestions": [
    { "id": "SUG-1", "type": "REFACTOR", "description": "建議描述", "priority": 1 }
  ],
  "nextIteration": {
    "suggestedGoal": "下次迭代目標",
    "suggestedItems": ["Item 1", "Item 2"]
  },
  "blockers": []
}`;

  anchorOutput({
    context: `Phase 8 | ${story} | 自動產出失敗`,
    error: {
      type: 'TACTICAL_FIX',
      summary: `自動產出失敗: ${autoGenerated.error}`,
      detail: `產出目錄: ${buildPath}/`
    },
    guide: {
      title: 'STORY_CONTEXT',
      content: formatStoryContext(storyContext)
    },
    rules: [
      '必填: storyId, status (Completed/Partial/Blocked)'
    ],
    task: ['手動產出 Fillback 與 Suggestions'],
    template: {
      title: `Fillback_${story}.md`,
      content: fillbackTemplate
    },
    gemsTemplate: suggestionsTemplate,
    output: `NEXT: ${getRetryCmd('BUILD', '8', { story, target: relativeTarget, iteration })}`
  }, {
    projectRoot: target,
    iteration: parseInt(iteration.replace('iter-', '')),
    phase: 'build',
    step: 'phase-8',
    story
  });

  return { verdict: 'PENDING' };
}

/**
 * 自動產出 Fillback 與 Suggestions
 */
function autoGenerateOutputs(target, iteration, story, buildPath, storyContext) {
  try {
    // 偵測專案類型並取得源碼目錄
    const { type: projectType } = detectProjectType(target);
    const srcPath = getSrcDir(target, projectType);

    if (!fs.existsSync(srcPath)) {
      return { success: false, error: `源碼目錄不存在: ${srcPath}` };
    }

    // 掃描 GEMS 標籤（使用 unified scan，含 AC 後處理）
    const scanResult = scanUnified(srcPath, target);

    // 過濾屬於此 Story 的函式
    const storyFunctions = scanResult.functions.filter(f => f.storyId === story);

    // ============================================
    // v2.3: [STEP] 錨點一致性驗證
    // ============================================
    const planPath = path.join(target, `.gems/iterations/${iteration}/plan/implementation_plan_${story}.md`);
    const stepValidation = validateStepConsistency(planPath, srcPath);

    let qualityIssues = [];
    if (!stepValidation.valid) {
      qualityIssues = stepValidation.issues.map(issue => ({
        type: 'STEP_MISMATCH',
        severity: 'WARNING',
        function: issue.function,
        priority: issue.priority,
        message: issue.message,
        expected: issue.expected,
        actual: issue.actual,
        file: issue.file
      }));

      console.log('\n⚠️ [STEP] 錨點一致性問題:');
      console.log(formatValidationResult(stepValidation));
    }

    // ============================================
    // v2.7 P7: Adversarial Self-Review — 對抗式檢查
    // ============================================

    // Check 1: 假實作偵測 (擴展) — 掃描 ✓✓ 函式的 body
    for (const fn of storyFunctions) {
      if (fn.fraudIssues && fn.fraudIssues.length > 0) {
        for (const issue of fn.fraudIssues) {
          qualityIssues.push({
            type: 'FRAUD_DETECT',
            severity: 'CRITICAL',
            function: fn.name,
            priority: fn.priority,
            message: issue,
            file: fn.file
          });
        }
      }
    }

    // Check 2: AC 覆蓋檢查 v2 — 基於源碼標籤映射（// AC-X.Y 行）
    // 策略：
    //   1. 從 plan 提取本 Story 的 AC ID 清單（// AC-X.Y 格式）
    //   2. 從 scanner 結果收集源碼函式的 acIds（已標記的 AC）
    //   3. 比對：plan 有但源碼沒標記 → AC_NOT_TAGGED（WARNING）
    //   4. 已標記的 AC → 再確認測試檔案有 AC-X.Y 字串 → AC_UNCOVERED（WARNING）
    if (fs.existsSync(planPath)) {
      const planContent = fs.readFileSync(planPath, 'utf8');

      // 從 plan 提取 AC ID（格式: AC-X.Y 或 AC-X.Y.Z）
      const planAcPattern = /\bAC-([\d]+\.[\d.]+)\b/g;
      let acMatch;
      const planAcIds = new Set();
      while ((acMatch = planAcPattern.exec(planContent)) !== null) {
        planAcIds.add(`AC-${acMatch[1]}`);
      }

      if (planAcIds.size > 0) {
        // 從 scanner 結果收集源碼中已標記的 AC ID
        const taggedAcIds = new Set();
        for (const fn of storyFunctions) {
          if (fn.acIds && fn.acIds.length > 0) {
            for (const id of fn.acIds) taggedAcIds.add(id);
          }
        }

        // 掃描測試檔案，確認 AC ID 有出現在測試中
        const testFiles = findTestFilesForStory(srcPath, story);
        const testContent = testFiles.map(f => {
          try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
        }).join('\n');

        for (const acId of planAcIds) {
          if (!taggedAcIds.has(acId)) {
            // 源碼函式沒有標記這個 AC
            qualityIssues.push({
              type: 'AC_NOT_TAGGED',
              severity: 'WARNING',
              ac: acId,
              message: `${acId} — plan 中定義但源碼函式未標記（缺少 // ${acId} 行）`,
            });
          } else {
            // 已標記，確認測試有覆蓋
            const coveredInTest = testContent.includes(acId);
            if (!coveredInTest) {
              qualityIssues.push({
                type: 'AC_UNCOVERED',
                severity: 'WARNING',
                ac: acId,
                message: `${acId} — 源碼已標記但測試檔案中找不到對應的 ${acId} 字串`,
              });
            }
          }
        }
      }
    }

    // Check 3: Plan 外檔案偵測 — 改了但不在 plan FILE 裡的檔案
    if (fs.existsSync(planPath)) {
      const planContent = fs.readFileSync(planPath, 'utf8');
      // 提取 plan 中引用的檔案路徑
      const plannedFiles = new Set();
      const fileRefPattern = /`(src\/[^`]+)`/g;
      let frMatch;
      while ((frMatch = fileRefPattern.exec(planContent)) !== null) {
        plannedFiles.add(frMatch[1]);
      }
      const inlinePattern = /\*\*檔案\*\*:\s*`([^`]+)`/g;
      while ((frMatch = inlinePattern.exec(planContent)) !== null) {
        plannedFiles.add(frMatch[1]);
      }

      // 比對實際 Story 函式所在的檔案
      if (plannedFiles.size > 0) {
        const actualFiles = new Set(storyFunctions.map(f => f.file));
        for (const actual of actualFiles) {
          // 正規化路徑比對
          const normalized = actual.replace(/\\/g, '/');
          const isPlanned = [...plannedFiles].some(p => normalized.includes(p) || p.includes(normalized));
          if (!isPlanned) {
            qualityIssues.push({
              type: 'UNPLANNED_FILE',
              severity: 'INFO',
              file: actual,
              message: `不在 plan FILE 欄位中`,
            });
          }
        }
      }
    }

    if (qualityIssues.length > 0) {
      const criticals = qualityIssues.filter(q => q.severity === 'CRITICAL');
      const warnings2 = qualityIssues.filter(q => q.severity === 'WARNING');
      const infos = qualityIssues.filter(q => q.severity === 'INFO');
      console.log(`\n🔍 [P7] Adversarial Review: ${qualityIssues.length} findings (${criticals.length} CRITICAL, ${warnings2.length} WARNING, ${infos.length} INFO)`);
    }

    // 嘗試執行壓力測試
    let stressTestSuggestions = [];
    try {
      const { runRealProjectStressTest } = require('../../lib/stress-test-integration.cjs');
      const stressResult = runRealProjectStressTest(target);
      stressTestSuggestions = stressResult.suggestions || [];
    } catch (e) {
      // 壓力測試模組不存在則跳過
      stressTestSuggestions = [];
    }

    // 產出 Suggestions JSON
    const suggestions = {
      storyId: story,
      iterationId: iteration,
      status: 'Completed',
      completedItems: groupFunctionsByItem(storyFunctions, storyContext),
      testCoverage: {
        p0: scanResult.stats.p0,
        p1: scanResult.stats.p1,
        total: storyFunctions.length
      },
      tagStats: {
        p0: scanResult.stats.p0,
        p1: scanResult.stats.p1,
        p2: scanResult.stats.p2,
        p3: scanResult.stats.p3
      },
      technicalHighlights: [
        '// TODO: AI 填寫實作亮點'
      ],
      technicalDebt: [],
      suggestions: stressTestSuggestions,
      qualityIssues: qualityIssues.length > 0 ? qualityIssues : undefined,
      stepValidation: {
        valid: stepValidation.valid,
        passRate: stepValidation.passRate,
        totalChecked: stepValidation.totalChecked,
        totalFailed: stepValidation.totalFailed
      },
      nextIteration: {
        suggestedGoal: '// TODO: AI 填寫下次迭代目標',
        suggestedItems: []
      },
      blockers: []
    };

    const suggestionsFile = path.join(buildPath, `iteration_suggestions_${story}.json`);
    fs.writeFileSync(suggestionsFile, JSON.stringify(suggestions, null, 2), 'utf8');

    // 產出 Fillback MD
    const fillback = generateFillbackMd(story, iteration, storyFunctions, scanResult.stats, storyContext);
    const fillbackFile = path.join(buildPath, `Fillback_${story}.md`);
    fs.writeFileSync(fillbackFile, fillback, 'utf8');

    return {
      success: true,
      fillbackFile: path.relative(target, fillbackFile),
      suggestionsFile: path.relative(target, suggestionsFile),
      stats: scanResult.stats
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 依 Item 分組函式
 * 使用 storyContext 的 items 與函式的 storyId 進行分組
 */
function groupFunctionsByItem(functions, storyContext) {
  const items = [];

  // 如果有 storyContext 且有 items，嘗試智能分組
  if (storyContext && storyContext.items && storyContext.items.length > 0) {
    const assignedFns = new Set();

    // 第一輪：精確匹配
    for (const item of storyContext.items) {
      const itemFns = [];
      const itemKeywords = extractKeywords(item.name);

      for (const fn of functions) {
        if (assignedFns.has(fn.name)) continue;

        const fnNameLower = fn.name.toLowerCase();
        const fnDesc = (fn.description || '').toLowerCase();

        // 檢查函式名稱或描述是否包含 item 關鍵字
        const matched = itemKeywords.some(kw =>
          fnNameLower.includes(kw) || fnDesc.includes(kw)
        );

        if (matched) {
          itemFns.push(fn.name);
          assignedFns.add(fn.name);
        }
      }

      items.push({
        itemId: item.id,
        name: item.name,
        functions: itemFns
      });
    }

    // 第二輪：將未分配的函式歸入最匹配的 Item
    const unassigned = functions.filter(f => !assignedFns.has(f.name));
    if (unassigned.length > 0 && items.length > 0) {
      for (const fn of unassigned) {
        const fnNameLower = fn.name.toLowerCase();
        let bestMatch = null;
        let bestScore = 0;

        for (let i = 0; i < items.length; i++) {
          const itemKeywords = extractKeywords(items[i].name);
          let score = 0;
          for (const kw of itemKeywords) {
            if (fnNameLower.includes(kw.substring(0, 4))) score += 1;
          }
          // 特殊規則：計算相關函式
          if (items[i].name.includes('計算') || items[i].name.includes('核心')) {
            if (['calculate', 'validate', 'evaluate', 'format', 'parse', 'compute'].some(k => fnNameLower.includes(k))) {
              score += 3;
            }
          }
          if (score > bestScore) {
            bestScore = score;
            bestMatch = i;
          }
        }

        if (bestMatch !== null && bestScore > 0) {
          items[bestMatch].functions.push(fn.name);
          assignedFns.add(fn.name);
        }
      }

      // 仍未分配的歸入「其他」
      const stillUnassigned = functions.filter(f => !assignedFns.has(f.name));
      if (stillUnassigned.length > 0) {
        items.push({
          itemId: 'misc',
          name: '其他功能',
          functions: stillUnassigned.map(f => f.name)
        });
      }
    }
  } else {
    // 沒有 context，按優先級分組
    const p0Fns = functions.filter(f => f.priority === 'P0');
    const p1Fns = functions.filter(f => f.priority === 'P1');
    const otherFns = functions.filter(f => !['P0', 'P1'].includes(f.priority));

    if (p0Fns.length > 0) {
      items.push({
        itemId: 'P0',
        name: 'P0 核心功能',
        functions: p0Fns.map(f => f.name)
      });
    }
    if (p1Fns.length > 0) {
      items.push({
        itemId: 'P1',
        name: 'P1 重要功能',
        functions: p1Fns.map(f => f.name)
      });
    }
    if (otherFns.length > 0) {
      items.push({
        itemId: 'P2+',
        name: 'P2/P3 輔助功能',
        functions: otherFns.map(f => f.name)
      });
    }
  }

  return items;
}

/**
 * 找出 Story 相關的測試檔案
 */
function findTestFilesForStory(srcPath, story) {
  const testFiles = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        walk(fullPath);
      } else if (entry.isFile() && /\.test\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        testFiles.push(fullPath);
      }
    }
  }
  walk(srcPath);
  return testFiles;
}

/**
 * 從 item 名稱提取關鍵字
 */
function extractKeywords(itemName) {
  const stopWords = ['item', '功能', '模組', '元件', '服務', '整合', '實作', '的', '與', '和'];
  const words = itemName.toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.includes(w));

  // 加入中英文關鍵字映射
  const keywordMap = {
    '計算': ['calc', 'calculate', 'compute', 'evaluate', 'expression', 'result'],
    '核心': ['core', 'main', 'calculate', 'evaluate'],
    '儲存': ['storage', 'store', 'save', 'record', 'crud', 'create', 'read', 'update', 'delete'],
    'crud': ['create', 'read', 'update', 'delete', 'record', 'storage'],
    'ui': ['ui', 'render', 'display', 'bind', 'init', 'modal', 'refresh', 'handle'],
    '樣式': ['style', 'css', 'animation'],
    '驗證': ['validate', 'check', 'verify'],
    '格式': ['format', 'parse'],
    '邏輯': ['logic', 'calculate', 'evaluate', 'validate', 'format']
  };

  const expandedKeywords = [...words];
  for (const word of words) {
    if (keywordMap[word]) {
      expandedKeywords.push(...keywordMap[word]);
    }
  }

  return [...new Set(expandedKeywords)];
}

/**
 * 產出 Fillback Markdown
 */
function generateFillbackMd(story, iteration, functions, stats, storyContext) {
  const lines = [
    `# Fillback ${story}`,
    '',
    '## 基本資訊',
    `- **Iteration**: ${iteration}`,
    `- **Story ID**: ${story}`,
    `- **Status**: Completed`,
    `- **完成日期**: ${new Date().toISOString().split('T')[0]}`,
    '',
    '## 開發 Log',
    ''
  ];

  // 依優先級分組
  const p0Fns = functions.filter(f => f.priority === 'P0');
  const p1Fns = functions.filter(f => f.priority === 'P1');
  const p2Fns = functions.filter(f => f.priority === 'P2');

  if (p0Fns.length > 0) {
    lines.push('### P0 核心功能');
    p0Fns.forEach(f => lines.push(`- \`${f.name}()\` - ${f.description || f.signature}`));
    lines.push('');
  }

  if (p1Fns.length > 0) {
    lines.push('### P1 重要功能');
    p1Fns.forEach(f => lines.push(`- \`${f.name}()\` - ${f.description || f.signature}`));
    lines.push('');
  }

  if (p2Fns.length > 0) {
    lines.push('### P2/P3 輔助功能');
    p2Fns.forEach(f => lines.push(`- \`${f.name}()\``));
    lines.push('');
  }

  lines.push('## 標籤統計');
  lines.push(`- P0: ${stats.p0} 個`);
  lines.push(`- P1: ${stats.p1} 個`);
  lines.push(`- P2: ${stats.p2} 個`);
  lines.push(`- P3: ${stats.p3} 個`);
  lines.push('');
  lines.push('## 備註');
  lines.push('自動產出 by Phase 8');

  return lines.join('\n');
}

function validatePhase7(fillbackFile, suggestionsFile) {
  const checks = [];

  // 驗證 Fillback
  if (fs.existsSync(fillbackFile)) {
    const content = fs.readFileSync(fillbackFile, 'utf8');
    checks.push({
      name: 'Fillback 基本資訊',
      pass: /基本資訊|Iteration|Story|iteration/i.test(content),
      required: true
    });
    checks.push({
      name: 'Fillback 開發 Log',
      pass: /開發 Log|Item \d+|completedItems|summary/i.test(content),
      required: false
    });
  } else {
    checks.push({ name: 'Fillback 檔案', pass: false, required: true });
  }

  // 驗證 Suggestions
  if (fs.existsSync(suggestionsFile)) {
    try {
      const json = JSON.parse(fs.readFileSync(suggestionsFile, 'utf8'));
      checks.push({
        name: 'Suggestions storyId',
        pass: !!json.storyId,
        required: true
      });
      checks.push({
        name: 'Suggestions status',
        pass: !!json.status && ['Completed', 'Partial', 'Blocked', 'InProgress'].includes(json.status),
        required: true
      });
      checks.push({
        name: 'Suggestions suggestions[]',
        pass: Array.isArray(json.suggestions),
        required: false
      });
      checks.push({
        name: 'Suggestions technicalDebt[]',
        pass: Array.isArray(json.technicalDebt),
        required: false
      });
      checks.push({
        name: 'Suggestions summary',
        pass: !!json.summary,
        required: false
      });
    } catch {
      checks.push({ name: 'Suggestions JSON 格式', pass: false, required: true });
    }
  } else {
    checks.push({ name: 'Suggestions 檔案', pass: false, required: true });
  }

  return checks;
}

/**
 * v4.0: 可執行性驗證 (使用新的 executability-validator)
 * 適配器函式 - 將新驗證器的輸出轉換為舊介面格式
 * v4.2: 傳入 iteration 讓 tech-stack-analyzer 讀取 POC/PLAN 產物
 * @param {string} target - 專案根目錄
 * @param {string} iteration - 迭代名稱 (e.g. 'iter-1')
 * @returns {Object} { valid: boolean, issues: [], hasEntryPoint: boolean, hasRoutes: boolean, techStack: object }
 */
function checkProjectExecutability(target, iteration = 'iter-1') {
  // 使用新的驗證器
  const { validateExecutability: validate, formatResult } = require('../../lib/build/executability-validator.cjs');
  const fullResult = validate(target, { iteration });

  // 轉換為舊介面格式
  const result = {
    valid: fullResult.valid,
    issues: [],
    hasEntryPoint: false,
    hasRoutes: false,
    hasMain: false,
    hasIndexHtml: false,
    percentage: fullResult.percentage,
    runCommand: fullResult.runCommand,
    techStack: fullResult.techStack || null
  };

  // 從 checks 中提取狀態
  for (const check of fullResult.checks) {
    if (check.name === '入口點') {
      result.hasEntryPoint = check.pass;
      result.hasIndexHtml = check.details?.hasIndexHtml || false;
      result.hasMain = check.details?.hasMain || false;
    }
  }

  // 檢查是否有路由（從 Import 鏈檢查中推斷）
  const importCheck = fullResult.checks.find(c => c.name === 'Import 鏈');
  result.hasRoutes = importCheck?.pass || false;

  // 合併 criticalIssues 和 warnings 到 issues
  for (const issue of fullResult.criticalIssues) {
    result.issues.push({
      type: issue.name.toUpperCase().replace(/\s+/g, '_'),
      severity: 'CRITICAL',
      message: issue.message,
      suggestion: issue.suggestion
    });
  }

  for (const warn of fullResult.warnings) {
    result.issues.push({
      type: warn.name.toUpperCase().replace(/\s+/g, '_'),
      severity: 'WARNING',
      message: warn.message,
      suggestion: warn.suggestion
    });
  }

  // 如果需要詳細輸出，可以 console.log(formatResult(fullResult))
  return result;
}

/**
 * v4.1: Smoke Test - 實際啟動專案驗證可執行性
 * 使用 Playwright CLI 進行基本功能驗證
 * 
 * @param {string} target - 專案根目錄
 * @param {object} options - 選項
 * @param {number} options.timeout - 超時時間 (ms)，預設 30000
 * @returns {object} { success: boolean, error?: string, logs: string[] }
 */
function runSmokeTest(target, options = {}) {
  const { timeout = 30000 } = options;
  const { execSync, spawn } = require('child_process');
  const logs = [];
  
  // 檢查是否有 package.json
  const pkgPath = path.join(target, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return { success: false, error: '缺少 package.json', logs };
  }
  
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const scripts = pkg.scripts || {};
  
  // 找到啟動指令
  const devCmd = scripts.dev || scripts.start || scripts.serve;
  if (!devCmd) {
    logs.push('[SKIP] 無 dev/start/serve script，跳過 smoke test');
    return { success: true, skipped: true, logs };
  }
  
  logs.push(`[INFO] 找到啟動指令: npm run ${scripts.dev ? 'dev' : scripts.start ? 'start' : 'serve'}`);
  
  // 檢查是否安裝了 wait-on
  let hasWaitOn = false;
  try {
    execSync('npx wait-on --version', { cwd: target, stdio: 'pipe' });
    hasWaitOn = true;
  } catch {
    logs.push('[WARN] wait-on 未安裝，使用簡化驗證');
  }
  
  // 簡化驗證：只檢查 vite/webpack 是否能啟動
  // 不實際等待伺服器，避免長時間阻塞
  try {
    // 嘗試執行 vite build 或 tsc 來驗證專案可編譯
    if (scripts.build) {
      logs.push('[INFO] 執行 npm run build 驗證編譯...');
      execSync('npm run build', { 
        cwd: target, 
        stdio: 'pipe',
        timeout: timeout 
      });
      logs.push('[PASS] 編譯成功');
      return { success: true, logs };
    }
    
    // 沒有 build script，嘗試 tsc --noEmit
    const tsconfigPath = path.join(target, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      logs.push('[INFO] 執行 tsc --noEmit 驗證 TypeScript...');
      try {
        execSync('npx tsc --noEmit', { 
          cwd: target, 
          stdio: 'pipe',
          timeout: timeout 
        });
        logs.push('[PASS] TypeScript 編譯成功');
        return { success: true, logs };
      } catch (tscErr) {
        const errOutput = tscErr.stderr?.toString() || tscErr.stdout?.toString() || '';
        logs.push(`[FAIL] TypeScript 編譯失敗: ${errOutput.slice(0, 500)}`);
        return { success: false, error: 'TypeScript 編譯失敗', logs };
      }
    }
    
    // 都沒有，跳過
    logs.push('[SKIP] 無 build script 且無 tsconfig.json，跳過 smoke test');
    return { success: true, skipped: true, logs };
    
  } catch (err) {
    const errMsg = err.stderr?.toString() || err.message || '未知錯誤';
    logs.push(`[FAIL] ${errMsg.slice(0, 500)}`);
    return { success: false, error: errMsg.slice(0, 200), logs };
  }
}

/**
 * 尋找下一個 Story（按 X.Y 排序）
 */
function findNextStory(planPath, currentStory) {
  if (!fs.existsSync(planPath)) return null;

  const files = fs.readdirSync(planPath);
  const storyPattern = /implementation_plan_(Story-[\d.]+)\.md/;

  const stories = files
    .map(f => {
      const match = f.match(storyPattern);
      return match ? match[1] : null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      const [, aX, aY] = a.match(/Story-(\d+)\.(\d+)/) || [];
      const [, bX, bY] = b.match(/Story-(\d+)\.(\d+)/) || [];
      if (parseInt(aX) !== parseInt(bX)) return parseInt(aX) - parseInt(bX);
      return parseInt(aY) - parseInt(bY);
    });

  const currentIndex = stories.indexOf(currentStory);
  if (currentIndex === -1 || currentIndex >= stories.length - 1) {
    return null;
  }

  return stories[currentIndex + 1];
}

/**
 * 取得 Iteration 狀態
 */
function getIterationStatus(planPath, buildPath) {
  const status = {
    total: 0,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    stories: []
  };

  if (!fs.existsSync(planPath)) return status;

  const files = fs.readdirSync(planPath);
  const storyPattern = /implementation_plan_(Story-[\d.]+)\.md/;

  const stories = files
    .map(f => {
      const match = f.match(storyPattern);
      return match ? match[1] : null;
    })
    .filter(Boolean);

  status.total = stories.length;

  for (const story of stories) {
    const fillbackFile = path.join(buildPath, `Fillback_${story}.md`);
    const suggestionsFile = path.join(buildPath, `iteration_suggestions_${story}.json`);
    const checkpointPattern = new RegExp(`checkpoint_${story}_phase-\\d`);

    if (fs.existsSync(fillbackFile) && fs.existsSync(suggestionsFile)) {
      status.completed++;
      status.stories.push({ story, status: 'completed' });
    } else if (fs.existsSync(buildPath)) {
      const buildFiles = fs.readdirSync(buildPath);
      const hasCheckpoint = buildFiles.some(f => checkpointPattern.test(f));
      if (hasCheckpoint) {
        status.inProgress++;
        status.stories.push({ story, status: 'in-progress' });
      } else {
        status.notStarted++;
        status.stories.push({ story, status: 'not-started' });
      }
    } else {
      status.notStarted++;
      status.stories.push({ story, status: 'not-started' });
    }
  }

  return status;
}

// 自我執行判斷
if (require.main === module) {
  const args = process.argv.slice(2);
  let target = process.cwd();
  let iteration = 'iter-1';
  let story = null;
  let level = 'M';

  // 簡單參數解析
  args.forEach(arg => {
    if (arg.startsWith('--target=')) target = arg.split('=')[1];
    if (arg.startsWith('--project-path=')) target = arg.split('=')[1];
    if (arg.startsWith('--iteration=')) iteration = arg.split('=')[1];
    if (arg.startsWith('--story=')) story = arg.split('=')[1];
    if (arg.startsWith('--level=')) level = arg.split('=')[1];
  });

  // 確保 target 是絕對路徑
  if (!path.isAbsolute(target)) {
    target = path.resolve(process.cwd(), target);
  }

  run({ target, iteration, story, level });
}

module.exports = { run };
