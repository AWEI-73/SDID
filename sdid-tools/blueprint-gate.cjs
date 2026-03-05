#!/usr/bin/env node
/**
 * Blueprint Gate v1.3 - 活藍圖品質門控
 * 
 * 驗證活藍圖 (Enhanced Draft v2) 的格式完整性、標籤完整性、
 * 依賴無循環、迭代 DAG、佔位符偵測、Stub 最低資訊檢查。
 * v1.1: 新增草稿狀態檢查、依賴一致性檢查、迭代負載檢查、Level 限制升級為 BLOCKER
 * v1.2: 新增公開 API↔動作清單一致性、Flow 精確度偵測、API 簽名完整性
 * v1.3: Budget 改為 per-Story (每 Story 最多 6 動作 WARN)，移除 per-iter 硬限制
 *       Level 限制改為 WARN（不再 BLOCKER），Foundation 必含 AppRouter 升為 BLOCKER
 *       動作清單新增 操作(NEW/MOD) 欄位支援
 * 
 * 獨立工具，不 import task-pipe。
 * 
 * 用法:
 *   node sdid-tools/blueprint-gate.cjs --draft=<path> [--iter=1] [--level=M]
 *   node sdid-tools/blueprint-gate.cjs --draft=<path> --strict
 * 
 * 輸出:
 *   @PASS — 藍圖品質合格，可進入 draft-to-plan
 *   @BLOCKER — 有結構性問題，必須修復
 *   @WARN — 有建議改善項目，但不阻擋
 */

const fs = require('fs');
const path = require('path');
const parser = require('./lib/draft-parser-standalone.cjs');

// ============================================
// 參數解析
// ============================================
function parseArgs() {
  const args = { draft: null, iter: null, level: 'M', strict: false, help: false, target: null };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--draft=')) args.draft = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--iter=')) args.iter = parseInt(arg.split('=')[1]);
    else if (arg.startsWith('--level=')) args.level = arg.split('=')[1].toUpperCase();
    else if (arg.startsWith('--target=')) args.target = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg === '--strict') args.strict = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

// ============================================
// 驗證器
// ============================================

/**
 * 1. 格式完整性 — 必要區塊是否存在
 */
// ============================================
// 驗證器 (拆出到 lib/)
// ============================================
const {
  checkFormatCompleteness, checkPlaceholders, checkDraftStatus,
  checkTagIntegrity, checkFlowStepCount, checkFlowPrecision,
  checkAPIActionConsistency, checkAPISignatureCompleteness,
  checkDependencyCycles, checkIterationDAG, checkInfraSize,
  checkStubMinimum, checkPlanActionConsistency, checkLevelLimits,
  checkEvolutionLayers, checkDepsConsistency, checkIterModuleLoad,
  checkIterActionBudget, checkVerticalSliceCompleteness, checkACIntegrity,
} = require('./lib/gate-checkers.cjs');

const { calcBlueprintScore, printExistingFunctionsSnapshot } = require('./lib/gate-score.cjs');
const { generateReport, inferProjectRoot, getFixGuidance } = require('./lib/gate-report.cjs');

// ============================================
// 主程式
// ============================================
function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
Blueprint Gate v1.1 - 活藍圖品質門控

用法:
  node sdid-tools/blueprint-gate.cjs --draft=<path> [--iter=1] [--level=M] [--target=<project>]

選項:
  --draft=<path>    活藍圖路徑 (必填)
  --iter=<N>        目標迭代 (預設: 自動偵測 [CURRENT])
  --level=<S|M|L>   檢查深度 (預設: M)
  --target=<path>   專案根目錄 (用於 log 存檔，可省略會自動推導)
  --strict          嚴格模式 (WARN 也算 FAIL)
  --help            顯示此訊息

驗證規則 (17 項):
  FMT-001~007  格式完整性
  PH-001       佔位符偵測
  STS-001~003  草稿狀態檢查 (v1.1)
  TAG-001~004  標籤完整性
  FLOW-001~002 Flow 步驟數
  FLOW-010~011 Flow 精確度 (v1.2 泛用 flow 偵測)
  API-001~002  公開 API ↔ 動作清單一致性 (v1.2)
  SIG-001~003  API 簽名完整性 (v1.2)
  DEP-001      依賴無循環
  DAG-001      迭代依賴 DAG
  SIZE-001     基礎設施拆分
  STUB-001~002 Stub 最低資訊
  CONS-001~002 規劃表↔動作清單一致性
  LVL-001      Level 限制 (v1.1 升級為 BLOCKER)
  EVO-001~002  演化層依賴
  DEPCON-001~002 依賴一致性 (v1.1)
  LOAD-001     迭代模組負載 (v1.1)
  BUDGET-001~002 迭代動作預算 (v1.3, per-Story: WARN>6/BLOCKER>10)
  VSC-001      Foundation 必含前端主入口殼 ROUTE (BLOCKER)
  VSC-002~005  垂直切片覆蓋 (v2.0: per-iter 聚合 WARN，不再 per-story BLOCKER)
  ACC-001      AC 驗收條件完整性 (v2.2, P0/P1 必填)
  STUB-003     Stub 必須有函式 flow 清單 (v2.3, BLOCKER)

📊 Blueprint Score (不擋，純輸出):
  垂直切片覆蓋 25分 / Story密度 20分 / Flow品質 20分 / AC覆蓋率 20分 / 基礎建設 15分
  分級: 90+ EXCELLENT / 75-89 GOOD / 60-74 FAIR / 0-59 WEAK

輸出:
  @PASS     — 品質合格 (log 存檔到 .gems/iterations/iter-X/logs/)
  @BLOCKER  — 結構性問題，必須修復
`);
    process.exit(0);
  }

  if (!args.draft) {
    // 嘗試從 --target 自動偵測 enhanced-draft.md
    if (args.target) {
      const candidates = [
        path.join(args.target, '.gems', 'draft', 'enhanced-draft.md'),
        path.join(args.target, '.gems', 'iterations', `iter-${args.iter || 1}`, 'poc', `requirement_draft_iter-${args.iter || 1}.md`),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          args.draft = c;
          console.log(`📍 自動偵測藍圖: ${path.relative(process.cwd(), c)}`);
          break;
        }
      }
    }

    if (!args.draft) {
      // 綠地引導：沒有藍圖，引導去 Gem chatbot
      console.log('');
      console.log('@BLOCK | Blueprint Gate | 找不到活藍圖 (enhanced-draft.md)');
      console.log('');
      console.log('@TASK 1:');
      console.log('  ACTION: CREATE_BLUEPRINT');
      console.log('  FILE: .gems/draft/enhanced-draft.md');
      console.log('  EXPECTED: 使用 Gem chatbot (gemini-gem-architect) 建立活藍圖');
      console.log('  REFERENCE: sdid-tools/prompts/gemini-gem-architect-v2.1.md');
      console.log('');
      console.log('步驟:');
      console.log('  1. 開啟 Gemini Gem (gemini-gem-architect-v2.1)');
      console.log('  2. 描述你的專案需求，讓 Gem 產出 Enhanced Draft v2');
      console.log('  3. 儲存到 <project>/.gems/draft/enhanced-draft.md');
      console.log(`  4. 重跑: node sdid-tools/blueprint-gate.cjs --draft=<project>/.gems/draft/enhanced-draft.md${args.target ? ' --target=' + path.relative(process.cwd(), args.target) : ''}`);
      console.log('');
      process.exit(1);
    }
  }

  // draft 路徑存在但檔案不存在
  if (!fs.existsSync(args.draft)) {
    console.log('');
    console.log(`@BLOCK | Blueprint Gate | 藍圖檔案不存在: ${path.relative(process.cwd(), args.draft)}`);
    console.log('');
    console.log('@TASK 1:');
    console.log('  ACTION: CREATE_BLUEPRINT');
    console.log(`  FILE: ${path.relative(process.cwd(), args.draft)}`);
    console.log('  EXPECTED: 使用 Gem chatbot 建立活藍圖，或確認路徑是否正確');
    console.log('  REFERENCE: sdid-tools/prompts/gemini-gem-architect-v2.1.md');
    console.log('');
    process.exit(1);
  }

  // 讀取原始內容 (佔位符檢查用)
  const rawContent = fs.readFileSync(args.draft, 'utf8');

  // 解析藍圖
  const draft = parser.parse(rawContent);

  // 自動偵測目標 iter
  if (!args.iter) {
    args.iter = parser.getCurrentIter(draft);
  }

  // 執行所有驗證
  const allIssues = [
    ...checkFormatCompleteness(draft, rawContent),
    ...checkPlaceholders(rawContent, args.draft),
    ...checkDraftStatus(rawContent),
    ...checkTagIntegrity(draft, args.iter),
    ...checkFlowStepCount(draft, args.iter),
    ...checkFlowPrecision(draft, args.iter),
    ...checkAPIActionConsistency(draft, args.iter),
    ...checkAPISignatureCompleteness(draft, args.iter),
    ...checkDependencyCycles(draft),
    ...checkIterationDAG(draft),
    ...checkInfraSize(draft),
    ...checkStubMinimum(draft, args.iter),
    ...checkPlanActionConsistency(draft),
    ...checkLevelLimits(draft),
    ...checkEvolutionLayers(draft),
    ...checkDepsConsistency(draft, args.iter),
    ...checkIterModuleLoad(draft),
    ...checkIterActionBudget(draft),
    ...checkVerticalSliceCompleteness(draft, args.iter),
    ...checkACIntegrity(draft, args.iter),
  ];

  // 生成報告
  const result = generateReport(draft, allIssues, args, rawContent);
  process.exit(result.passed ? 0 : 1);
}

// ============================================
// 導出 (供其他工具使用)
// ============================================

// ============================================
// 導出 (供其他工具使用)
// ============================================
module.exports = {
  checkFormatCompleteness,
  checkPlaceholders,
  checkDraftStatus,
  checkTagIntegrity,
  checkFlowStepCount,
  checkFlowPrecision,
  checkAPIActionConsistency,
  checkAPISignatureCompleteness,
  checkDependencyCycles,
  checkIterationDAG,
  checkInfraSize,
  checkStubMinimum,
  checkPlanActionConsistency,
  checkLevelLimits,
  checkEvolutionLayers,
  checkDepsConsistency,
  checkIterModuleLoad,
  checkIterActionBudget,
  checkVerticalSliceCompleteness,
  checkACIntegrity,
  calcBlueprintScore,
  getFixGuidance,
};

if (require.main === module) {
  main();
}
