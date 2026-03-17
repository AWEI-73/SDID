#!/usr/bin/env node
// [LEGACY] Task-Pipe route — 保留供有明確需求但無 POC 場景使用，非主推路線
/**
 * POC Step 4: UI 原型設計 (v3.0 - 嚴格審查版)
 * 輸入: draft + Contract | 產物: xxxPOC.html
 * 
 * v3.0 新增：
 * - 嚴格品質檢查：POC 必須涵蓋 Draft 承諾的功能
 * - @GEMS-VERIFIED 真實性驗證：勾選項目必須有對應函式
 * - Mock 資料完整性：必須符合 Contract 欄位
 */
const fs = require('fs');
const path = require('path');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');
const { createErrorHandler, MAX_ATTEMPTS } = require('../../lib/shared/error-handler.cjs');
const { anchorOutput, anchorPass, anchorError, anchorErrorSpec } = require('../../lib/shared/log-output.cjs');
const { checkPocQuality } = require('../../tools/quality-check/poc-quality-checker.cjs');
let checkDesignQuality = () => ({ quality: 'GOOD', score: 100, issues: [] });
try {
  checkDesignQuality = require('../../skills/frontend-design/design-quality-checker.cjs').checkDesignQuality;
} catch (e) {
  // Ignored if not found
}
const { writeStepResult } = require('../../lib/step-result.cjs');

/**
 * v3.1: 從 qualityResult 建構 inline 報告，直接印在 console
 * 讓 AI 不需要額外讀 log 就能看到完整的 blocker/warning
 */
function buildInlineQualityReport(qualityResult) {
  const lines = [];

  if (qualityResult.blockers && qualityResult.blockers.length > 0) {
    lines.push(`[QUALITY_BLOCKERS] ${qualityResult.blockers.length} 個 BLOCKER:`);
    qualityResult.blockers.forEach((b, i) => {
      lines.push(`  ❌ [${i + 1}] ${b.message}`);
      if (b.fixGuide) {
        b.fixGuide.forEach(g => {
          if (g) lines.push(`     ${g}`);
        });
      }
    });
  }

  const warnings = (qualityResult.issues || []).filter(i => i.severity !== 'BLOCKER');
  if (warnings.length > 0) {
    lines.push(`[QUALITY_WARNINGS] ${warnings.length} 個警告:`);
    warnings.slice(0, 5).forEach((w, i) => {
      lines.push(`  ⚠️ [${i + 1}] ${w.message}`);
    });
  }

  if (qualityResult.stats) {
    lines.push(`[QUALITY_STATS] 偵測結果:`);
    lines.push(`  函式(@GEMS-FUNCTION): ${qualityResult.stats.gemsFunctions} 個`);
    lines.push(`  實際函式(function/const): ${qualityResult.stats.actualFunctions} 個`);
    lines.push(`  Mock 資料: ${qualityResult.stats.mockDataCount} 筆`);
    lines.push(`  @GEMS-VERIFIED 勾選: ${qualityResult.stats.verifiedChecked} 個`);
  }

  return lines.join('\n');
}

function run(options) {

  console.log(getSimpleHeader('POC', 'Step 4'));

  const { target, iteration = 'iter-1' } = options;
  const pocPath = `.gems/iterations/${iteration}/poc`;

  // 初始化錯誤處理器
  const errorHandler = createErrorHandler('POC', 'step-4', null);

  // 找 POC
  const poc = findPOC(target, iteration);

  if (poc.found) {
    const content = fs.readFileSync(poc.path, 'utf8');
    const errors = validatePOC(content);
    const gateSpec = getGateSpec(content);

    if (errors.length) {
      // TACTICAL_FIX 機制
      const attempt = errorHandler.recordError('E2', errors.join('; '));

      if (errorHandler.shouldBlock()) {
        // 使用精準錯誤輸出
        anchorErrorSpec({
          targetFile: poc.path,
          missing: errors,
          example: `<!--
  @GEMS-DESIGN-BRIEF:
  - Purpose: 驗證核心功能流程
  - Aesthetic: Modern Clean
  - Typography: Outfit (Google Fonts)
  - ColorPalette: #6366f1 (Primary)

  @GEMS-VERIFIED:
  - [x] 列表顯示
  - [x] 新增功能
  - [ ] 編輯功能 (未實作)

  @GEMS-FIELD-COVERAGE:
  - id: frontend
  - name: frontend
  - status: frontend
-->
<div class="container">
  <button class="btn">新增</button>
</div>`,
          nextCmd: `node task-pipe/runner.cjs --phase=POC --step=4`,
          attempt: MAX_ATTEMPTS,
          maxAttempts: MAX_ATTEMPTS,
          gateSpec: gateSpec
        }, {
          projectRoot: target,
          iteration: parseInt(iteration.replace('iter-', '')),
          phase: 'poc',
          step: 'step-4'
        });
        writeStepResult(target, { phase: 'POC', step: '4', verdict: 'BLOCKER', message: 'POC 設計需要完善', needsFix: true });
        return { verdict: 'BLOCKER', reason: 'tactical_fix_limit', attempts: MAX_ATTEMPTS };
      }

      // 使用精準錯誤輸出
      anchorErrorSpec({
        targetFile: poc.path,
        missing: errors,
        example: errors.includes('@GEMS-DESIGN-BRIEF')
          ? `<!--
  @GEMS-DESIGN-BRIEF:
  - Purpose: 驗證核心功能流程
  - Aesthetic: Modern Clean
  - Typography: Outfit (Google Fonts)
-->`
          : errors.includes('@GEMS-VERIFIED')
            ? `<!--
  @GEMS-VERIFIED:
  - [x] 列表顯示
  - [x] 新增功能
  - [ ] 編輯功能 (未實作)
-->`
            : `<!--
  @GEMS-FIELD-COVERAGE:
  - id: frontend
  - name: frontend
  - status: frontend
  - createdAt: api-only
-->`,
        nextCmd: `node task-pipe/runner.cjs --phase=POC --step=4`,
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        gateSpec: gateSpec
      }, {
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'poc',
        step: 'step-4'
      });

      writeStepResult(target, { phase: 'POC', step: '2', verdict: 'PENDING', message: `POC 缺漏: ${errors.join(', ')}`, needsFix: true });
      return { verdict: 'PENDING', attempt };
    }

    // 成功時重置計數
    errorHandler.resetAttempts();

    // [NEW] v3.0 品質檢查
    const draftPath = path.join(target, `.gems/iterations/${iteration}/poc/requirement_draft_${iteration}.md`);
    const contractDir = path.join(target, `.gems/iterations/${iteration}/poc`);
    let contractPath = null;
    if (fs.existsSync(contractDir)) {
      const files = fs.readdirSync(contractDir);
      const contractFile = files.find(f => f.endsWith('Contract.ts'));
      if (contractFile) contractPath = path.join(contractDir, contractFile);
    }

    const qualityResult = checkPocQuality(poc.path, draftPath, contractPath);

    if (qualityResult.quality === 'SKELETON') {
      // v3.1: 把完整的 blocker/warning 資訊直接印到 console，不需要額外讀 log
      const inlineDetails = buildInlineQualityReport(qualityResult);
      anchorError('ARCHITECTURE_REVIEW',
        `POC 功能品質待加強 (評分: ${qualityResult.score}/100)`,
        '建議：補充 POC 功能實作',
        {
          details: qualityResult.fixInstructions || qualityResult.blockers?.map(b => b.message).join('\n'),
          projectRoot: target,
          iteration: parseInt(iteration.replace('iter-', '')),
          phase: 'poc',
          step: 'step-4'
        });
      // 直接在 console 輸出關鍵錯誤資訊
      console.log('');
      console.log(inlineDetails);
      return { verdict: 'BLOCKER', qualityScore: qualityResult.score };
    }

    // [NEW] 設計品質檢查
    const designResult = checkDesignQuality(poc.path);

    if (designResult.quality === 'SKELETON') {
      // v3.1: 設計品質也直接印到 console
      const designDetails = (designResult.issues || []).map(i => `  ❌ ${i.message}`).join('\n');
      anchorError('ARCHITECTURE_REVIEW',
        `視覺設計待加強 (評分: ${designResult.score}/100)`,
        '建議：提升視覺品質',
        {
          details: `### 設計優化點\n${designResult.issues?.map(i => `- ${i.message}`).join('\n')}\n\n請參考: task-pipe/skills/frontend-design/SUMMARY.md`,
          projectRoot: target,
          iteration: parseInt(iteration.replace('iter-', '')),
          phase: 'poc',
          step: 'step-4'
        });
      if (designDetails) {
        console.log('');
        console.log('[DESIGN_ISSUES]');
        console.log(designDetails);
      }
      return { verdict: 'BLOCKER', designScore: designResult.score };
    }

    // 合併評分
    const combinedScore = Math.round((qualityResult.score + designResult.score) / 2);
    const combinedQuality = combinedScore >= 80 ? 'GOOD' : (combinedScore >= 50 ? 'POOR' : 'SKELETON');

    if (combinedQuality === 'POOR') {
      const allWarnings = [];
      if (qualityResult.quality === 'POOR') {
        allWarnings.push(`功能品質: ${qualityResult.score}/100`);
      }
      if (designResult.quality === 'POOR') {
        allWarnings.push(`設計品質: ${designResult.score}/100`);
      }
      allWarnings.push(...(qualityResult.issues?.slice(0, 2).map(i => i.message) || []));
      allWarnings.push(...(designResult.issues?.slice(0, 2).map(i => i.message) || []));

      anchorOutput({
        context: `POC Step 4 | 品質警告`,
        warning: allWarnings.slice(0, 5),
        guide: {
          title: '改進建議',
          content: '請參考:\n- 功能品質: task-pipe/tools/quality-check/poc-quality-checker.cjs\n- 設計品質: task-pipe/skills/frontend-design/SUMMARY.md'
        },
        output: `NEXT: 可繼續進入 Step 3，但建議先改善 POC`
      }, {
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'poc',
        step: 'step-4'
      });
    }

    anchorPass('POC', 'Step 4',
      `POC 驗證通過 (功能: ${qualityResult.score}, 設計: ${designResult.score})`,
      `node task-pipe/runner.cjs --phase=POC --step=5`,
      {
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'poc',
        step: 'step-4',
        info: {
          'File': poc.path,
          'FunctionQuality': qualityResult.quality || 'GOOD',
          'DesignQuality': designResult.quality || 'GOOD'
        }
      });

    return { verdict: 'PASS', qualityScore: qualityResult.score, designScore: designResult.score };
  }

  // 尚未建立 POC — 給 AI 指引 + 黃金範例路徑，讓 AI 自由創作
  const draftPath = path.join(target, `.gems/iterations/${iteration}/poc/requirement_draft_${iteration}.md`);
  const altDraftPath = path.join(target, `.gems/requirement_draft.md`);
  let draftContent = '';

  if (fs.existsSync(draftPath)) {
    draftContent = fs.readFileSync(draftPath, 'utf8');
  } else if (fs.existsSync(altDraftPath)) {
    draftContent = fs.readFileSync(altDraftPath, 'utf8');
  }

  // 從 draft 提取基本資訊（只用於指引，不用於產生 HTML）
  const titleMatch = draftContent.match(/^#\s*(.+)/m);
  const projectTitle = titleMatch ? titleMatch[1].replace(/[📋🔖]/g, '').trim() : '專案 POC';
  const goalMatch = draftContent.match(/## ?一句話目標\s*\n([^\n]+)/);
  const projectGoal = goalMatch ? goalMatch[1].trim() : '';
  const featureMatches = draftContent.match(/- \[x\]\s*(.+)/g) || [];
  const features = featureMatches.map(f => f.replace(/- \[x\]\s*/, '').trim()).slice(0, 6);

  // 找 contract 檔案（供 AI 參考欄位）
  const pocDir = path.join(target, `.gems/iterations/${iteration}/poc`);
  let contractFile = null;
  if (fs.existsSync(pocDir)) {
    const files = fs.readdirSync(pocDir);
    contractFile = files.find(f => f.endsWith('Contract.ts')) || null;
  }

  // 黃金範例路徑（相對於 TASK_PIPE_ROOT）
  const goldenExamplePath = path.join(__dirname, '../../../templates/examples/poc-golden.html');
  const goldenRelPath = 'task-pipe/templates/examples/poc-golden.html';
  const pocFileName = projectTitle.replace(/\s+/g, '') + 'POC.html';
  const pocFilePath = path.join(pocDir || path.join(target, `.gems/iterations/${iteration}/poc`), pocFileName);

  // 確保目錄存在
  if (!fs.existsSync(pocDir)) {
    fs.mkdirSync(pocDir || path.join(target, `.gems/iterations/${iteration}/poc`), { recursive: true });
  }

  anchorOutput({
    context: `POC Step 4 | ${iteration} | 請根據黃金範例建立 POC`,
    info: {
      'Project': projectTitle,
      'Goal': projectGoal || '（請讀 requirement_draft 確認）',
      'Features': features.length > 0 ? features.join(', ') : '（請讀 requirement_draft）',
      'Contract': contractFile ? `${iteration}/poc/${contractFile}` : '（尚未建立）',
      'Target File': pocFilePath,
      'Golden Example': goldenRelPath
    },
    task: [
      `建立 ${pocFileName}，參考黃金範例的結構與標籤規格，根據本專案需求自由設計`,
      '',
      '黃金範例示範了什麼:',
      '  - @GEMS-DESIGN-BRIEF: 設計摘要（Purpose / Aesthetic / Typography / ColorPalette）',
      '  - @GEMS-VERIFIED: 列出實際實作的函式名稱（不是敘述，是 function name）',
      '  - @GEMS-FIELD-COVERAGE: 每個 contract 欄位標註 frontend / api-only',
      '  - Mock 資料結構符合 contract 欄位',
      '  - 函式命名清晰（render / handle / compute 開頭）',
      '',
      '本專案需要實作的功能:',
      ...features.map(f => `  - ${f}`),
      '',
      contractFile
        ? `請讀 ${iteration}/poc/${contractFile} 確認欄位，填入 @GEMS-FIELD-COVERAGE`
        : '尚無 contract，請先完成 POC Step 3 或自行定義欄位',
      '',
      '⚠️ 不要照抄黃金範例，它只是計算機範例，你的專案需求不同',
      '完成後重新執行此步驟驗證品質'
    ],
    output: `NEXT: node task-pipe/runner.cjs --phase=POC --step=4`
  }, {
    projectRoot: target,
    iteration: parseInt(iteration.replace('iter-', '')),
    phase: 'poc',
    step: 'step-4'
  });

  return { verdict: 'PENDING', needsCreation: true };
}

function findPOC(target, iteration) {
  const dirs = [
    path.join(target, `.gems/iterations/${iteration}/poc`),
    path.join(target, `.gems/iterations/${iteration}`),
    target
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (f.includes('POC') && (f.endsWith('.html') || f.endsWith('.tsx'))) {
        return { found: true, path: path.join(dir, f) };
      }
    }
  }
  return { found: false };
}

function validatePOC(content) {
  const errors = [];
  if (!/@GEMS-DESIGN-BRIEF/.test(content)) errors.push('@GEMS-DESIGN-BRIEF');
  if (!/<div|<button/i.test(content)) errors.push('UI元素');
  // v2.0: 檢查 @GEMS-VERIFIED 標籤
  if (!/@GEMS-VERIFIED/.test(content)) errors.push('@GEMS-VERIFIED');
  // v3.0: 檢查 @GEMS-FIELD-COVERAGE 標籤 (Contract vs POC 欄位對應)
  if (!/@GEMS-FIELD-COVERAGE/.test(content)) {
    errors.push('@GEMS-FIELD-COVERAGE');
  }
  return errors;
}

/**
 * 取得 POC Step 4 的門控規格
 */
function getGateSpec(content) {
  return {
    checks: [
      { name: '@GEMS-DESIGN-BRIEF', pattern: '/@GEMS-DESIGN-BRIEF/', pass: /@GEMS-DESIGN-BRIEF/.test(content), desc: '設計摘要標籤' },
      { name: 'UI元素', pattern: '/<div|<button/i', pass: /<div|<button/i.test(content), desc: 'HTML UI 元素' },
      { name: '@GEMS-VERIFIED', pattern: '/@GEMS-VERIFIED/', pass: /@GEMS-VERIFIED/.test(content), desc: '已驗證功能清單' },
      { name: '@GEMS-FIELD-COVERAGE', pattern: '/@GEMS-FIELD-COVERAGE/', pass: /@GEMS-FIELD-COVERAGE/.test(content), desc: '欄位覆蓋對應' }
    ]
  };
}

// 自我執行判斷
if (require.main === module) {
  const args = process.argv.slice(2);
  let target = process.cwd();
  let iteration = 'iter-1';

  // 簡單參數解析
  args.forEach(arg => {
    if (arg.startsWith('--target=')) target = arg.split('=')[1];
    if (arg.startsWith('--project-path=')) target = arg.split('=')[1];
    if (arg.startsWith('--iteration=')) iteration = arg.split('=')[1];
  });

  // 確保 target 是絕對路徑
  if (!path.isAbsolute(target)) {
    target = path.resolve(process.cwd(), target);
  }

  run({ target, iteration });
}

module.exports = { run };
