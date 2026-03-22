#!/usr/bin/env node
/**
 * gate-report.cjs — Blueprint Gate 報告生成 + 修復指引
 * 由 blueprint-gate.cjs 拆出，勿直接執行。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const logOutput = require('../../task-pipe/lib/shared/log-output.cjs');
const parser = require('./draft-parser-standalone.cjs');
const { calcBlueprintScore, printExistingFunctionsSnapshot } = require('./gate-score.cjs');

/**
 * 讀取上一輪 gate score log，回傳分數（供 @PREV-SCORE 顯示）
 */
function readPrevScore(projectRoot, iter) {
  if (!projectRoot) return null;
  const logsDir = path.join(projectRoot, '.gems', 'iterations', `iter-${iter}`, 'logs');
  if (!fs.existsSync(logsDir)) return null;
  const scoreLogs = fs.readdirSync(logsDir)
    .filter(f => f.startsWith('gate-check-score-'))
    .sort().reverse();
  if (scoreLogs.length === 0) return null;
  try {
    const content = fs.readFileSync(path.join(logsDir, scoreLogs[0]), 'utf8');
    const m = content.match(/score=(\d+)/);
    return m ? parseInt(m[1]) : null;
  } catch { return null; }
}

/**
 * 存 score log 供下輪讀取
 */
function saveScoreLog(projectRoot, iter, score, logOptions) {
  if (!projectRoot) return;
  const logsDir = path.join(projectRoot, '.gems', 'iterations', `iter-${iter}`, 'logs');
  if (!fs.existsSync(logsDir)) return;
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const logPath = path.join(logsDir, `gate-check-score-${ts}.log`);
  fs.writeFileSync(logPath, `score=${score.total}\ngrade=${score.grade}\nbreakdown=${JSON.stringify(score.breakdown)}\n`);
}

/** GEMS: generateReport | P1 | calcStats(Clear)→readPrevScore(Clear)→formatOutput(Complicated)→saveLog(Clear)→RETURN:ReportResult | Story-2.0 */
function generateReport(draft, allIssues, args, rawContent = '') {
  const stats = parser.calculateStats(draft);
  const blockers = allIssues.filter(i => i.level === 'BLOCKER');
  const warns = allIssues.filter(i => i.level === 'WARN');
  const passed = blockers.length === 0;

  // 嚴格模式：WARN 也算 FAIL
  const finalPass = args.strict ? (allIssues.length === 0) : passed;

  // 推導 projectRoot (從 --target 或從 draft 路徑推導)
  const projectRoot = args.target || inferProjectRoot(args.draft);
  const logOptions = projectRoot ? {
    projectRoot,
    iteration: args.iter || 1,
    phase: 'gate',
    step: 'check',
  } : {};

  // 用迭代規劃表 + 動作清單的聯集計算真實模組數
  const planModules = new Set(draft.iterationPlan.map(e => e.module));
  const actionModules = new Set(Object.keys(draft.moduleActions));
  const allModules = new Set([...planModules, ...actionModules]);
  const realModuleCount = allModules.size || stats.totalModules;

  // 組合詳情內容 (存檔用)
  const detailLines = [
    `📐 Blueprint Gate v1.1`,
    `藍圖: ${path.basename(args.draft)}`,
    `Level: ${stats.level || '?'} | 模組: ${realModuleCount} | 動作: ${stats.totalActions} | 迭代: ${stats.totalIterations}`,
    `目標 iter: ${args.iter || 'auto'}`,
    `嚴格模式: ${args.strict ? '是' : '否'}`,
    '',
  ];

  if (blockers.length > 0) {
    detailLines.push(`❌ BLOCKER (${blockers.length}):`);
    for (const b of blockers) {
      detailLines.push(`  [${b.code}] ${b.msg}`);
      detailLines.push(`    修復: ${getFixGuidance(b.code)}`);
    }
    detailLines.push('');
  }
  if (warns.length > 0) {
    detailLines.push(`⚠️ WARN (${warns.length}):`);
    for (const w of warns) {
      detailLines.push(`  [${w.code}] ${w.msg}`);
    }
    detailLines.push('');
  }
  if (allIssues.length === 0) {
    detailLines.push('✅ 零問題，藍圖品質優秀');
  }

  const details = detailLines.join('\n');

  // ── Blueprint Score 輸出 ──
  const score = calcBlueprintScore(draft, rawContent);
  const gradeEmoji = { EXCELLENT: '🏆', GOOD: '✅', FAIR: '⚠️', WEAK: '🔴' }[score.grade] || '?';
  const bar = (val, max) => {
    const filled = Math.round((val / max) * 6);
    return '█'.repeat(filled) + '░'.repeat(6 - filled);
  };
  console.log('');
  console.log(`📊 Blueprint Score: ${score.total}/100 [${score.grade}] ${gradeEmoji}`);
  console.log('');
  console.log(`  垂直切片覆蓋  ${bar(score.breakdown.vsc, 25)}  ${score.breakdown.vsc}/25  (${score.details.fullSliceIters}/${score.details.nonFoundationIters} iter 有前後端)`);
  console.log(`  Story 密度    ${bar(score.breakdown.density, 20)}  ${score.breakdown.density}/20  (平均 ${score.details.avgStories} story/iter)`);
  console.log(`  Flow 品質     ${bar(score.breakdown.flow, 20)}  ${score.breakdown.flow}/20  (${score.details.goodFlowActions}/${score.details.totalActions} 動作有業務語意 flow)`);
  console.log(`  AC 品質       ${bar(score.breakdown.ac, 20)}  ${score.breakdown.ac}/20  (${score.details.p01WithQualityAC ?? score.details.p01WithAC}/${score.details.p01Total} P0/P1 有 Given/When/Then AC)`);
  console.log(`  基礎建設      ${bar(score.breakdown.infra, 15)}  ${score.breakdown.infra}/15  (型別:${score.details.hasTypes?'✓':'✗'} 介面契約:${score.details.hasContract?'✓':'✗'} 前端殼:${score.details.hasShell?'✓':'✗'} 樣式:${score.details.hasStyle?'✓':'✗'})`);
  if (score.suggestions.length > 0) {
    console.log('');
    console.log('  💡 建議:');
    for (const s of score.suggestions) console.log(`     - ${s}`);
  }
  console.log('');

  // 存 score log 供下輪讀取 @PREV-SCORE
  if (projectRoot) saveScoreLog(projectRoot, args.iter || 1, score);

  // 注入既有函式快照（讓 AI 在修藍圖時知道之前已有什麼）
  printExistingFunctionsSnapshot(projectRoot, args.iter || 1);

  if (finalPass) {
    // Score 門檻：低於 80 分 → @REGEN（重生成，不是 patch）
    const SCORE_THRESHOLD = 80;
    if (score.total < SCORE_THRESHOLD) {
      const prevScore = readPrevScore(projectRoot, args.iter || 1);
      const prevScoreLine = prevScore !== null
        ? (() => {
            const delta = score.total - prevScore;
            const trend = delta > 0 ? `+${delta}，方向對繼續` : delta < 0 ? `${delta}，退步了，檢查是否改壞了什麼` : `±0，沒有進展，換個方向`;
            return `@PREV-SCORE: ${prevScore} → ${score.total} (${trend})`;
          })()
        : null;

      const breakdown = score.breakdown || {};
      const regenCmd = `node sdid-tools/blueprint/gate.cjs --draft=${args.draft}${args.iter ? ' --iter=' + args.iter : ''}`;

      console.log(`\n@REGEN | score=${score.total}/100 | threshold=${SCORE_THRESHOLD} | grade=${score.grade}`);
      console.log(`  分項: 垂直切片 ${breakdown.vsc ?? '?'}/25 | Story密度 ${breakdown.density ?? '?'}/20 | Flow品質 ${breakdown.flow ?? '?'}/20 | AC品質 ${breakdown.ac ?? '?'}/20 | 基礎建設 ${breakdown.infra ?? '?'}/15`);
      if (prevScoreLine) console.log(`  ${prevScoreLine}`);
      if (score.suggestions.length > 0) {
        console.log(`@REGEN-HINT: 重新生成整個 draft，帶入以下方向（不是 patch 舊文字）`);
        for (const s of score.suggestions) console.log(`  - ${s}`);
      }
      console.log(`@NEXT_COMMAND: 修改 draft 後重跑: ${regenCmd}`);

      if (projectRoot) {
        logOutput.emitBlock({
          scope: `Blueprint Gate | iter-${args.iter || 1}`,
          summary: `Blueprint Score ${score.total}/100 低於門檻 ${SCORE_THRESHOLD}，需重新生成 draft`,
          nextCmd: regenCmd,
        }, logOptions);
      }
      return { passed: false, blockers: 1, warns: warns.length, issues: [...allIssues, { level: 'BLOCKER', code: 'SCORE-001', msg: `Blueprint Score ${score.total}/100 低於門檻 ${SCORE_THRESHOLD}` }] };
    }

    const nextCmd = `node sdid-tools/blueprint/draft-to-plan.cjs --draft=${args.draft} --iter=${args.iter || 1} --target=<project>`;
    const summary = `Blueprint Gate 通過 (${blockers.length} blocker, ${warns.length} warn)`;

    if (projectRoot) {
      logOutput.anchorPass('gate', 'check', summary, nextCmd, logOptions);
    } else {
      logOutput.outputPass(nextCmd, summary);
    }
  } else {
    const nextCmd = `修復藍圖後重跑: node sdid-tools/blueprint/gate.cjs --draft=${args.draft}${args.iter ? ' --iter=' + args.iter : ''}`;
    const summary = `Blueprint Gate 失敗 — ${blockers.length} 個結構性問題必須修復`;

    // 將 blockers 轉成 @TASK 格式，讓 AI 知道要修什麼
    const tasks = blockers.map(b => ({
      action: 'FIX_BLUEPRINT',
      file: path.basename(args.draft),
      expected: `修復 [${b.code}]: ${b.msg}`,
      reference: getFixGuidance(b.code)
    }));

    if (projectRoot) {
      logOutput.emitBlock({
        scope: `Blueprint Gate | iter-${args.iter || 1}`,
        summary,
        nextCmd,
        details,
        tasks,
      }, logOptions);
    } else {
      logOutput.outputError({
        type: 'BLOCKER',
        summary,
        nextCommand: nextCmd,
        details,
      });
    }
  }

  return { passed: finalPass, blockers: blockers.length, warns: warns.length, issues: allIssues };
}

/**
 * 從 draft 路徑推導 projectRoot
 * 例: /project/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md → /project
 */
function inferProjectRoot(draftPath) {
  if (!draftPath) return null;
  const normalized = path.resolve(draftPath);
  const gemsIdx = normalized.indexOf(path.join('.gems', 'iterations'));
  if (gemsIdx > 0) {
    return normalized.substring(0, gemsIdx).replace(/[/\\]$/, '');
  }
  return null;
}

/**
 * 修復指引
 */
function getFixGuidance(code) {
  const guidance = {
    'FMT-001': '加入「## 一句話目標」區塊，至少 10 字描述 MVP 目標，例如: 開發一個整合 Google Sheets 的 React 儀表板，提供寬表視圖與逾期提醒',
    'FMT-002': '補充「## 用戶原始需求」區塊，至少 50 字描述使用者痛點、現況與期望，越具體越好',
    'FMT-003': '加入「### 1. 族群識別」表格，格式: | 族群 | 痛點 | 目標 |，至少列出 1 個使用者族群',
    'FMT-004': '加入「### 2. 實體定義」區塊，每個實體用 #### EntityName + 欄位表格定義，格式: | 欄位 | 型別 | 說明 |，每個實體至少 3 個欄位',
    'FMT-005': '加入「### 4. 獨立模組」區塊，每個模組用 #### 模組：Name 定義，包含依賴和公開 API',
    'FMT-006': '加入「## 📅 迭代規劃表」表格，欄位: | Iter | 範圍 | 目標 | 模組 | 交付 | 依賴 | 狀態 |',
    'FMT-007': '加入「## 📋 模組動作清單」區塊，每個 iter 用 ### Iter N: ModuleName [CURRENT/STUB] 定義，包含動作表格',
    'FMT-008': '在「### 3. 共用模組」區塊加入樣式策略，例如: **樣式策略**: CSS Modules (.module.css) 或 Tailwind CSS 或 Global CSS',
    'FMT-009': '動作類型只能是: CONST(常數/型別) / LIB(函式庫) / API(API端點) / SVC(服務層) / HOOK(React Hook) / UI(元件) / ROUTE(路由/頁面) / SCRIPT(腳本)。feat/mock/ui/Data/View/Config 等都是無效值',
    'FMT-010': '每個實體至少需要 3 個欄位（含型別和說明），例如 TrainingClass 應有 id/name/startDate 等核心欄位',
    'FMT-011': '公開 API 必須有完整型別簽名，格式: functionName(param: Type): ReturnType，例如: parseSheet(rows: SheetRow[]): TrainingClass[]',
    'FMT-012': '加入「### 5. 路由結構」區塊，用 code block 描述 src/ 目錄樹，例如: src/ ├── shared/ │   └── types/ ├── modules/ │   └── {moduleName}/ └── index.ts',
    'TAG-001': '動作清單中每一行都必須有「技術名稱」欄位 (函式名或型別名，例如: CoreTypes / parseSheet / WideTable)',
    'TAG-002': '優先級必須是 P0/P1/P2/P3 其中之一 (P0=核心必做, P1=重要, P2=一般, P3=可延後)',
    'TAG-003': '流向欄位必須有 3-7 個步驟，用 → 分隔，例如: VALIDATE_INPUT→PARSE_DATA→TRANSFORM→RETURN',
    'TAG-004': '建議在 deps 欄位標註依賴，格式: [Internal.FunctionName] 或 [Shared.TypeName] 或 無',
    'PH-001': '替換所有 {placeholder} 為實際內容，例如 {moduleA} → Dashboard，{模組A中文名} → 儀表板',
    'DEP-001': '重新安排模組依賴，消除循環引用。例如 A→B→A 是循環，應改為 A→B 或 B→A',
    'DAG-001': '確保每個 iter 只依賴更早 iter 的模組，iter-2 不能依賴 iter-3 的模組',
    'CONS-001': '為迭代規劃表中的每個模組加入對應的動作清單 (### Iter N: ModuleName)',
    'CONS-002': '動作清單中的模組名稱應與迭代規劃表一致，或確認這是刻意的額外模組',
    'EVO-001': '演化層依賴違規: 低層動作不能依賴高層動作，調整依賴方向或演化層標記',
    'EVO-002': 'Modify 動作需要對應的 BASE 動作存在，確認基礎函式已定義',
    'STS-001': '加入草稿狀態欄位，格式: **草稿狀態**: [x] DONE 或 [~] PENDING',
    'STS-002': '完成所有釐清項目後，將「草稿狀態」從 [~] PENDING 改為 [x] DONE 才能進入 Gate',
    'STS-003': '草稿狀態格式不明確，建議使用 **草稿狀態**: [x] DONE 或 **草稿狀態**: [~] PENDING',
    'LVL-001': '模組數超過參考值，確認範圍是否合理，或升級 Level (S→M 或 M→L)',
    'DEPCON-001': '同步迭代規劃表的「依賴」欄位，與模組定義的 deps 保持一致',
    'DEPCON-002': '在動作清單的 deps 欄位標註具體依賴，例如: [Shared.CoreTypes] 或 [Internal.parseSheet]',
    'LOAD-001': '將部分模組移到下一個 iter，或升級 Level 以容納更多模組',
    'API-001': '確保公開 API 列出的每個函式在動作清單中都有對應的 techName 行',
    'API-002': '如果是內部函式，從公開 API 移除；如果是公開函式，加入公開 API 列表',
    'FLOW-001': 'flow 步驟過少，建議 3-7 個步驟，例如: VALIDATE→FETCH→TRANSFORM→RETURN',
    'FLOW-002': 'flow 步驟過多，建議拆分為多個函式，每個函式 3-7 個步驟',
    'FLOW-010': 'flow 步驟必須有業務語意，例如 VALIDATE_INPUT→SERIALIZE→FORMAT→RETURN，不能全部是 INIT→PROCESS→RETURN',
    'FLOW-011': '建議將泛用步驟替換為具體業務步驟，例如 INIT→PARSE_JSON→VALIDATE_SCHEMA→BUILD_OBJECTS→RETURN',
    'SIG-001': '公開 API 應寫成完整簽名: functionName(param: Type): ReturnType，例如: getClasses(orgId: string): TrainingClass[]',
    'SIG-002': '公開 API 簽名應包含回傳型別，例如: ): TrainingClass[] 或 ): void 或 ): Promise<Result>',
    'SIG-003': '公開 API 參數應標註型別，例如: (classId: string, date: string) 而非 (classId, date)',
    'SIZE-001': '模組動作數超過 8 個，建議拆分為子模組，例如將 shared 拆為 shared/types + shared/storage',
    'ACC-001': 'P0/P1 動作必須有 AC 欄位。在動作清單的 AC 欄填入編號（如 AC-1.0），並在「## ✅ 驗收條件」區塊定義 Given/When/Then',
    'ACC-002': 'AC 編號填了但驗收條件區塊沒有對應定義。在「## ✅ 驗收條件」區塊加入 **AC-X.Y**: Given ... When ... Then ...',
    'BUDGET-001': 'Story 動作數超過上限 10。請拆成多個 Story（不是多個 iter），每個 Story 建議 4-6 個動作',
    'BUDGET-002': 'Story 動作數超過建議值 6，注意開發品質，必要時拆為 Story-X.0 + Story-X.1',
    'STUB-001': 'Stub iter 應加入描述，格式: > 模組說明，依賴 shared + xxx',
    'STUB-002': 'Stub iter 在迭代規劃表中應標註依賴，例如: | 2 | Core | ... | Dashboard | FULL | shared | [STUB] |',
    'STUB-003': 'Stub iter 必須有函式 Flow 清單表格，格式: | 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | AC |，每個公開 API 函式都要有 flow + AC 骨架',
    'VSC-001': 'Foundation 模組必須加入 ROUTE 類型的前端主入口殼。在動作清單加入: | 前端主入口殼 | ROUTE | AppRouter | P1 | CHECK_AUTH→LOAD_LAYOUT→RENDER_ROUTES | [Internal.CoreTypes] | ○○ | NEW | AC-0.x |',
    'VSC-002': 'iter 只有後端 story，考慮加入前端 story (UI/ROUTE)，或在 Story 描述中說明這是刻意的純 API iter',
    'VSC-003': 'iter 只有前端 story，確認後端邏輯是否已在前一個 iter 完成，或補上 SVC/API story',
    'VSC-004': 'STUB iter 只有後端規劃，建議在同一個 iter 加入前端 story，或確認前端會在後續 iter 補上',
    'VSC-005': 'STUB iter 只有前端規劃，建議補上 SVC/API story',
    'SCORE-001': 'Blueprint Score 低於門檻，參考建議區塊改善各維度分數，重點補強: 垂直切片(前後端同 iter) + Story 密度(每 iter 至少 2 個 story)',
  };
  return guidance[code] || '參考 task-pipe/templates/enhanced-draft-golden.template.v2.md 修正格式，或查看 task-pipe/templates/examples/enhanced-draft-ecotrack.example.md 範例';
}

module.exports = {
  generateReport,
  inferProjectRoot,
  getFixGuidance,
  readPrevScore,
  saveScoreLog,
};


