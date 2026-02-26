#!/usr/bin/env node
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
const { anchorOutput, anchorPass, anchorError, anchorErrorSpec, anchorTemplatePending, emitPass, emitFix, emitBlock } = require('../../lib/shared/log-output.cjs');
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

  // 尚未建立 - 自動產生智慧 POC scaffold
  const draftPath = path.join(target, `.gems/iterations/${iteration}/poc/requirement_draft_${iteration}.md`);
  const altDraftPath = path.join(target, `.gems/requirement_draft.md`);
  let draftContent = '';

  if (fs.existsSync(draftPath)) {
    draftContent = fs.readFileSync(draftPath, 'utf8');
  } else if (fs.existsSync(altDraftPath)) {
    draftContent = fs.readFileSync(altDraftPath, 'utf8');
  }

  // 從 draft 提取資訊
  const titleMatch = draftContent.match(/^#\s*(.+)/m);
  const projectTitle = titleMatch ? titleMatch[1].replace(/[📋🔖]/g, '').trim() : '專案 POC';

  const featureMatches = draftContent.match(/- \[x\]\s*(.+)/g) || [];
  const features = featureMatches.map(f => f.replace(/- \[x\]\s*/, '').trim()).slice(0, 5);

  // 門控規格 - 告訴 AI 這個 step 會檢查什麼
  const gateSpecForNew = {
    checks: [
      { name: '@GEMS-DESIGN-BRIEF', pattern: '/@GEMS-DESIGN-BRIEF/', desc: '設計摘要標籤' },
      { name: 'UI元素', pattern: '/<div|<button/i', desc: 'HTML UI 元素' },
      { name: '@GEMS-VERIFIED', pattern: '/@GEMS-VERIFIED/', desc: '已驗證功能清單' },
      { name: '@GEMS-FIELD-COVERAGE', pattern: '/@GEMS-FIELD-COVERAGE/', desc: '欄位覆蓋對應' }
    ]
  };

  // 產生智慧 POC
  const smartPocHtml = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectTitle} POC</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-main: #f8fafc;
      --surface: #ffffff;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --text-main: #1e293b;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --success: #10b981;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Outfit', sans-serif;
      background: var(--bg-main);
      min-height: 100vh;
      padding: 2rem;
    }
    .container { max-width: 700px; margin: 0 auto; }
    .card {
      background: var(--surface);
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.06);
      padding: 2rem;
      margin-bottom: 1.5rem;
    }
    h1 {
      color: var(--text-main);
      font-size: 2rem;
      font-weight: 800;
      margin-bottom: 1rem;
    }
    .input-group { display: flex; gap: 0.75rem; margin-bottom: 1.5rem; }
    input {
      flex: 1;
      padding: 0.75rem 1rem;
      border: 2px solid var(--border);
      border-radius: 8px;
      font-size: 1rem;
      transition: border-color 0.2s;
    }
    input:focus { outline: none; border-color: var(--primary); }
    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-primary { background: var(--primary); color: white; }
    .btn-primary:hover { background: var(--primary-hover); }
    .list { list-style: none; }
    .list-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: var(--bg-main);
      border-radius: 8px;
      margin-bottom: 0.5rem;
      transition: transform 0.15s;
    }
    .list-item:hover { transform: translateX(4px); }
  </style>
  <!--
  @GEMS-DESIGN-BRIEF:
  - Purpose: 驗證 ${projectTitle} 的核心功能流程
  - Aesthetic: Modern Clean - 極簡優雅設計
  - Typography: Outfit (Google Fonts)
  - ColorPalette: #6366f1 (Primary), #f8fafc (Background), #1e293b (Text)
  - Motion: Hover 滑動效果, transition 過渡動畫
  - Avoid: 純白 #FFFFFF 背景、Arial 字體
  - Memorable: 滑動卡片效果

  @GEMS-CONTRACT-REF: ./ModuleContract.ts

  @GEMS-VERIFIED:
${features.length > 0 ? features.map(f => `  - [x] ${f}`).join('\n') : '  - [x] 列表顯示\n  - [x] 新增功能\n  - [x] 刪除功能'}

  @GEMS-FIELD-COVERAGE:
  - id: frontend
  - name: frontend
  - status: frontend
  - createdAt: api-only

  @GEMS-STORY: Story-1.0
  -->
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>📋 ${projectTitle}</h1>
      <div class="input-group">
        <input type="text" id="inputField" placeholder="輸入內容...">
        <button class="btn btn-primary" onclick="handleAdd()">新增</button>
      </div>
      <ul id="itemList" class="list"></ul>
      <div id="stats" style="margin-top: 1rem; color: var(--text-muted); font-size: 0.875rem;"></div>
    </div>
  </div>

  <script>
    // @GEMS-ZONE: [DataZone, ActionZone, RenderZone]

    // @GEMS-MOCK: 示範資料
    let items = [
      { id: '1', name: '範例項目 A', status: 'active', createdAt: new Date() },
      { id: '2', name: '範例項目 B', status: 'active', createdAt: new Date() },
      { id: '3', name: '已完成項目', status: 'done', createdAt: new Date() }
    ];

    // @GEMS-FUNCTION: render | P0 | 渲染列表
    // @GEMS-FLOW: LoadData → BuildHTML → UpdateDOM → UpdateStats
    function render() {
      const list = document.getElementById('itemList');
      const stats = document.getElementById('stats');

      list.innerHTML = items.map(item => \`
        <li class="list-item">
          <span style="flex:1">\${item.name}</span>
          <span style="color: \${item.status === 'done' ? 'var(--success)' : 'var(--primary)'}">
            \${item.status === 'done' ? '✓' : '○'}
          </span>
          <button onclick="handleDelete('\${item.id}')" style="color:var(--danger);background:none;border:none;cursor:pointer">刪除</button>
        </li>
      \`).join('');

      stats.textContent = \`共 \${items.length} 個項目\`;
    }

    // @GEMS-FUNCTION: handleAdd | P0 | 新增項目
    // @GEMS-FLOW: GetInput → Validate → CreateItem → AddToList → ClearInput → Rerender
    function handleAdd() {
      const input = document.getElementById('inputField');
      const name = input.value.trim();
      if (!name) return;

      items.push({
        id: Date.now().toString(),
        name: name,
        status: 'active',
        createdAt: new Date()
      });

      input.value = '';
      render();
    }

    // @GEMS-FUNCTION: handleDelete | P0 | 刪除項目
    // @GEMS-FLOW: FilterOut → Rerender
    function handleDelete(id) {
      items = items.filter(item => item.id !== id);
      render();
    }

    // 初始化
    document.addEventListener('DOMContentLoaded', () => {
      render();
      document.getElementById('inputField').addEventListener('keypress', e => {
        if (e.key === 'Enter') handleAdd();
      });
    });
  </script>
</body>
</html>`;

  // 寫入 POC 檔案
  const pocDir = path.join(target, `.gems/iterations/${iteration}/poc`);
  if (!fs.existsSync(pocDir)) {
    fs.mkdirSync(pocDir, { recursive: true });
  }
  const pocFilePath = path.join(pocDir, 'ModulePOC.html');
  fs.writeFileSync(pocFilePath, smartPocHtml, 'utf8');

  anchorOutput({
    context: `POC Step 4 | ${iteration} | 智慧 POC 已自動產生`,
    info: {
      'Title': projectTitle,
      'Features': features.length > 0 ? features.join(', ') : '基本 CRUD',
      'File': pocFilePath
    },
    task: [
      '已自動產生 POC 檔案',
      '請根據需求調整標題、欄位、功能',
      '確認後重新執行此步驟驗證品質'
    ],
    output: `NEXT: node task-pipe/runner.cjs --phase=POC --step=4`
  }, {
    projectRoot: target,
    iteration: parseInt(iteration.replace('iter-', '')),
    phase: 'poc',
    step: 'step-4'
  });

  return { verdict: 'PENDING', scaffoldGenerated: true };
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
