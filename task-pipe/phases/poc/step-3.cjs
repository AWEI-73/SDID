#!/usr/bin/env node
// [LEGACY] Task-Pipe route — 保留供有明確需求但無 POC 場景使用，非主推路線
/**
 * POC Step 3: 契約設計
 * 輸入: requirement_draft | 產物: xxxContract.ts
 * 
 * v2.0 更新：Contract 必須包含函式規格，不只是資料結構
 */
const fs = require('fs');
const path = require('path');
const { getOutputHeader } = require('../../lib/shared/output-header.cjs');
const { createErrorHandler, MAX_ATTEMPTS } = require('../../lib/shared/error-handler.cjs');
const { anchorPass, anchorErrorSpec, anchorTemplatePending, emitPass, emitFix } = require('../../lib/shared/log-output.cjs');

function run(options) {
  const { target, iteration = 'iter-1' } = options;
  const pocPath = `.gems/iterations/${iteration}/poc`;

  // 初始化錯誤處理器
  const errorHandler = createErrorHandler('POC', 'step-3', null);

  console.log(getOutputHeader('POC', 'Step 3'));

  // 找 Contract
  const contract = findContract(target, iteration);

  if (contract.found) {
    // 驗證
    const content = fs.readFileSync(contract.path, 'utf8');
    const validation = validateContract(content);

    if (contract.oldName) {
      console.log(`WARN: 命名錯誤: ${contract.name} -> 應為 xxxContract.ts`);
    }

    if (validation.errors.length) {
      // TACTICAL_FIX 機制
      const attempt = errorHandler.recordError('E2', validation.errors.join('; '));

      // 門控規格
      const gateSpec = {
        checks: [
          { name: '@GEMS-CONTRACT', pattern: '/@GEMS-CONTRACT/', pass: !validation.errors.includes('@GEMS-CONTRACT') },
          { name: '@GEMS-TABLE', pattern: '/@GEMS-TABLE/', pass: !validation.errors.includes('@GEMS-TABLE') },
          { name: '@GEMS-FUNCTION', pattern: '/@GEMS-FUNCTION/', pass: !validation.errors.includes('@GEMS-FUNCTION') }
        ]
      };

      if (errorHandler.shouldBlock()) {
        // 使用精準錯誤輸出
        anchorErrorSpec({
          targetFile: contract.path,
          missing: validation.errors,
          example: `/**
 * @GEMS-CONTRACT: ModuleName
 * @GEMS-VERSION: 1.0
 */

// @GEMS-TABLE: items
export interface Item {
  id: string;      // UUID, PK
  title: string;   // VARCHAR(100), NOT NULL
}

/**
 * @GEMS-FUNCTION: createItem | P0
 * @DESC: 建立新項目
 * @ARGS: title: string
 * @RETURN: Item
 */`,
          nextCmd: `node task-pipe/runner.cjs --phase=POC --step=3`,
          attempt: MAX_ATTEMPTS,
          maxAttempts: MAX_ATTEMPTS,
          gateSpec: gateSpec
        }, {
          projectRoot: target,
          iteration: parseInt(iteration.replace('iter-', '')),
          phase: 'poc',
          step: 'step-3'
        });
        return { verdict: 'BLOCKER', reason: 'tactical_fix_limit', attempts: MAX_ATTEMPTS };
      }

      // 使用精準錯誤輸出
      anchorErrorSpec({
        targetFile: contract.path,
        missing: validation.errors,
        example: validation.errors.includes('@GEMS-CONTRACT')
          ? `/**
 * @GEMS-CONTRACT: ModuleName
 * @GEMS-VERSION: 1.0
 */`
          : validation.errors.includes('@GEMS-TABLE')
            ? `// @GEMS-TABLE: items
export interface Item {
  id: string;      // UUID, PK
  title: string;   // VARCHAR(100), NOT NULL
}`
            : `/**
 * @GEMS-FUNCTION: createItem | P0
 * @DESC: 建立新項目
 * @ARGS: title: string
 * @RETURN: Item
 */`,
        nextCmd: `node task-pipe/runner.cjs --phase=POC --step=3`,
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        gateSpec: gateSpec
      }, {
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'poc',
        step: 'step-3'
      });
      return { verdict: 'PENDING', attempt };
    }

    // 成功時重置計數
    errorHandler.resetAttempts();

    anchorPass('POC', 'Step 3', `Contract 驗證通過`,
      `node task-pipe/runner.cjs --phase=POC --step=4`,
      {
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'poc',
        step: 'step-3'
      });

    // 額外顯示統計資訊 (對齊原本的輸出)
    console.log(`@CONTEXT
Contract: ${contract.path}
資料結構: ${validation.stats.contracts} 個
AC 規格: ${validation.stats.acSpecs} 個
函式規格: ${validation.stats.functions} 個`);

    return { verdict: 'PASS' };
  }

  // 門控規格 - 告訴 AI 這個 step 會檢查什麼
  const gateSpec = {
    checks: [
      { name: '@GEMS-CONTRACT', pattern: '/@GEMS-CONTRACT/', desc: '模組契約標籤' },
      { name: '@GEMS-TABLE', pattern: '/@GEMS-TABLE/', desc: '資料表定義' },
      { name: '@GEMS-FUNCTION 或 @GEMS-API 或 @GEMS-AC', desc: '函式/服務/AC 規格（三選一）' }
    ]
  };

  // 沒找到 Contract -> 使用 Template Pending 輸出
  const templateContent = `/**
 * @GEMS-CONTRACT: FeatureName
 * @GEMS-VERSION: 1.0
 */

// @GEMS-TABLE: items
export interface Item {
  // @GEMS-FIELD: UUID, PK, NOT NULL
  id: string;
  
  // @GEMS-FIELD: VARCHAR(100), NOT NULL
  title: string;
  
  // @GEMS-FIELD: TIMESTAMP, NOT NULL
  createdAt: string;
}

/**
 * @GEMS-FUNCTION: createItem | P0
 * @DESC: 建立新項目（端到端流程）
 * @ARGS: title: string
 * @RETURN: Item
 * @FLOW: ValidateInput→SaveToStorage→ReturnResult
 */

/**
 * @GEMS-FUNCTION: getItemList | P1
 * @DESC: 取得項目列表（有依賴）
 * @ARGS: none
 * @RETURN: Item[]
 */

/**
 * @GEMS-FUNCTION: formatItemTitle | P2
 * @DESC: 格式化標題（純工具）
 * @ARGS: title: string
 * @RETURN: string
 */

// ─── AC SPECS (純計算函式驗收，由 ac-runner.cjs Phase 2 機械執行) ────────────
//
// ⚠️ 重要：Task-Pipe 路線的 AC 切片由此處提供
// spec-to-plan 會自動從 5.5 函式規格表提取純計算函式產出 ac.ts 骨架
// 但若你在 contract.ts 直接填寫 @GEMS-AC，contract-writer 會自動分離 ac.ts
//
// 只放「純計算」類函式（無 side effect、無 DOM、無 API call）
// 格式:
//   @GEMS-AC: AC-X.Y
//   @GEMS-AC-FN: functionName
//   @GEMS-AC-MODULE: 相對於 src/ 的模組路徑（不含副檔名）
//   @GEMS-AC-INPUT: JSON 陣列，對應函式參數
//   @GEMS-AC-EXPECT: JSON 值，deep-equal 比對
//
// 有外部依賴時用 SKIP:
//   @GEMS-AC: AC-X.Y
//   @GEMS-AC-SKIP: MOCK — 需要 DB/API，靠 jest mock 驗收
//
// 沒有純計算函式時，整個區塊可省略（Phase 2 會 SKIP）

// @GEMS-AC: AC-1.0
// @GEMS-AC-FN: formatItemTitle
// @GEMS-AC-MODULE: modules/FeatureName/lib/format-item-title
// @GEMS-AC-INPUT: ["hello world"]
// @GEMS-AC-EXPECT: "Hello World"

// @GEMS-MOCK: items
export const MOCK_ITEMS: Item[] = [
  { id: '1', title: '範例項目', createdAt: '2026-02-04' }
];`;

  const iterNum = parseInt(iteration.replace('iter-', ''));
  anchorTemplatePending({
    targetFile: `${pocPath}/contract_iter-${iterNum}.ts`,
    templateContent: templateContent,
    fillItems: [
      '@GEMS-CONTRACT - 模組名稱',
      '@GEMS-TABLE - 資料表名稱與欄位定義',
      '@GEMS-FUNCTION - 函式規格 (含 Priority P0/P1/P2)',
      '@GEMS-AC - 純計算函式驗收（無 side effect 才填，否則省略整個區塊）',
      '@GEMS-MOCK - 測試用假資料'
    ],
    nextCmd: `node task-pipe/runner.cjs --phase=POC --step=3`,
    gateSpec: gateSpec
  }, {
    projectRoot: target,
    iteration: parseInt(iteration.replace('iter-', '')),
    phase: 'poc',
    step: 'step-3'
  });

  // 額外輸出 Priority 指引
  console.log('');
  console.log('@PRIORITY_GUIDE (v3.3)');
  console.log('  P0 = 端到端流程 (UI→邏輯→儲存→回饋) → 1-2 個');
  console.log('  P1 = 有依賴狀態 (有 import) → 主力函式');
  console.log('  P2 = 內部工具 (純邏輯) → 工具函式');
  console.log('  P3 = 輔助函式 (常數)');
  console.log('');

  return { verdict: 'PENDING' };
}

function findContract(target, iteration) {
  const pocPath = path.join(target, `.gems/iterations/${iteration}/poc`);
  if (!fs.existsSync(pocPath)) return { found: false };

  const files = fs.readdirSync(pocPath);
  const iterNum = iteration.replace('iter-', '');

  // ① 新格式優先：contract_iter-N.ts（與 BUILD Phase 3/4/5 一致）
  const newStyle = files.find(f => f === `contract_iter-${iterNum}.ts`);
  if (newStyle) return { found: true, path: path.join(pocPath, newStyle), name: newStyle };

  // ② 舊格式向後相容：xxxContract.ts
  const correct = files.find(f => f.endsWith('Contract.ts'));
  if (correct) return { found: true, path: path.join(pocPath, correct), name: correct };

  const fuzzy = files.find(f => f.includes('Contract') && f.endsWith('.ts'));
  if (fuzzy) return { found: true, path: path.join(pocPath, fuzzy), name: fuzzy, oldName: true };

  return { found: false };
}

function validateContract(content) {
  const errors = [];
  const valid = {
    contractTag: /@GEMS-CONTRACT/.test(content),
    tableTag: /@GEMS-TABLE/.test(content),
    // 接受任一：舊格式 @GEMS-FUNCTION / 新格式 @GEMS-API / AC格式 @GEMS-AC:
    functionTag: /@GEMS-FUNCTION|@GEMS-API|@GEMS-AC:/.test(content),
    mockData: /MOCK/i.test(content) || /mock/i.test(content)
  };

  if (!valid.contractTag) errors.push('@GEMS-CONTRACT');
  if (!valid.tableTag) errors.push('@GEMS-TABLE');
  if (!valid.functionTag) errors.push('@GEMS-FUNCTION 或 @GEMS-API 或 @GEMS-AC');

  // 統計
  const stats = {
    contracts: (content.match(/@GEMS-TABLE/g) || []).length,
    functions: (content.match(/@GEMS-FUNCTION/g) || []).length,
    acSpecs: (content.match(/@GEMS-AC:/g) || []).length
  };

  return { errors, stats };
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
