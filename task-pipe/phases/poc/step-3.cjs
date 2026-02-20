#!/usr/bin/env node
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
函式規格: ${validation.stats.functions} 個`);

    return { verdict: 'PASS' };
  }

  // 門控規格 - 告訴 AI 這個 step 會檢查什麼
  const gateSpec = {
    checks: [
      { name: '@GEMS-CONTRACT', pattern: '/@GEMS-CONTRACT/', desc: '模組契約標籤' },
      { name: '@GEMS-TABLE', pattern: '/@GEMS-TABLE/', desc: '資料表定義' },
      { name: '@GEMS-FUNCTION', pattern: '/@GEMS-FUNCTION/', desc: '函式規格 (含 Priority)' }
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

// @GEMS-MOCK: items
export const MOCK_ITEMS: Item[] = [
  { id: '1', title: '範例項目', createdAt: '2026-02-04' }
];`;

  anchorTemplatePending({
    targetFile: `${pocPath}/xxxContract.ts`,
    templateContent: templateContent,
    fillItems: [
      '@GEMS-CONTRACT - 模組名稱',
      '@GEMS-TABLE - 資料表名稱與欄位定義',
      '@GEMS-FUNCTION - 函式規格 (含 Priority P0/P1/P2)',
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

  // 優先找符合命名的
  const correct = files.find(f => f.endsWith('Contract.ts'));
  if (correct) return { found: true, path: path.join(pocPath, correct), name: correct };

  // 找稍微不符但可能是的
  const fuzzy = files.find(f => f.includes('Contract') && f.endsWith('.ts'));
  if (fuzzy) return { found: true, path: path.join(pocPath, fuzzy), name: fuzzy, oldName: true };

  return { found: false };
}

function validateContract(content) {
  const errors = [];
  const valid = {
    contractTag: /@GEMS-CONTRACT/.test(content),
    tableTag: /@GEMS-TABLE/.test(content),
    functionTag: /@GEMS-FUNCTION/.test(content),
    mockData: /MOCK/i.test(content) || /mock/i.test(content)
  };

  if (!valid.contractTag) errors.push('@GEMS-CONTRACT');
  if (!valid.tableTag) errors.push('@GEMS-TABLE');
  if (!valid.functionTag) errors.push('@GEMS-FUNCTION');

  // 統計
  const stats = {
    contracts: (content.match(/@GEMS-TABLE/g) || []).length,
    functions: (content.match(/@GEMS-FUNCTION/g) || []).length
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
