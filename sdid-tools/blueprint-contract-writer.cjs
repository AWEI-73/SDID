#!/usr/bin/env node
/**
 * Blueprint Contract Writer v1.0
 * 接收 AI 產出的 contract_iter-N.ts，驗證格式（gate），存 log
 *
 * 擴展→收斂模式:
 *   擴展: AI 從 draft 自由推導實體邊界，寫 contract_iter-N.ts
 *   收斂: 此工具驗證標籤完整性，通過後存 contract-pass-*.log
 *   整合: draft-to-plan 讀 contract 鎖定型別
 *
 * 用法:
 *   node sdid-tools/blueprint-contract-writer.cjs --contract=<path> --target=<project> --iter=<N>
 *
 * 輸出:
 *   @PASS      — 格式合格，log 存檔，draft-to-plan 可讀取
 *   @BLOCKER   — 格式問題，必須修復後重跑
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────
// 參數解析
// ─────────────────────────────────────────────────────────────
function parseArgs() {
  const args = { contract: null, target: null, iter: 1, draft: null, help: false };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--contract=')) args.contract = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--target='))  args.target  = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--iter='))    args.iter    = parseInt(arg.split('=')[1]) || 1;
    else if (arg.startsWith('--draft='))   args.draft   = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

// ─────────────────────────────────────────────────────────────
// 解析 contract 檔案
// ─────────────────────────────────────────────────────────────

/**
 * 從 contract TS 內容解析所有標籤
 * 回傳結構化資料供 gate 驗證 + draft-to-plan 讀取
 */
function parseContract(content) {
  const result = {
    version: null,
    iter: null,
    project: null,
    entities: [],   // @GEMS-CONTRACT
    views: [],      // @GEMS-VIEW
    apis: [],       // @GEMS-API
    enums: [],      // @GEMS-ENUM
    seeds: [],      // @GEMS-SEED
    raw: content,
  };

  // 版本資訊
  const verMatch = content.match(/@GEMS-CONTRACT-VERSION:\s*(.+)/);
  if (verMatch) result.version = verMatch[1].trim();
  const iterMatch = content.match(/@GEMS-ITER:\s*(.+)/);
  if (iterMatch) result.iter = iterMatch[1].trim();
  const projMatch = content.match(/@GEMS-PROJECT:\s*(.+)/);
  if (projMatch) result.project = projMatch[1].trim();

  // 解析 @GEMS-ENUM
  const enumMatches = [...content.matchAll(/@GEMS-ENUM:\s*(\w+)/g)];
  for (const m of enumMatches) {
    result.enums.push({ name: m[1] });
  }

  // 解析 @GEMS-SEED blocks
  // 格式:
  //   // @GEMS-SEED: ConstName
  //   // @GEMS-SEED-TYPE: TypeName
  //   // @GEMS-SEED-STORY: Story-X.Y
  //   export const CONST_NAME: TypeName[] = [ ... ];
  const seedBlocks = [...content.matchAll(
    /\/\/\s*@GEMS-SEED:\s*(\w+)[^\n]*\n(?:\/\/[^\n]*\n)*export const (\w+)[^=]+=\s*(\[[\s\S]*?\]);/g
  )];
  for (const block of seedBlocks) {
    const name = block[1];
    const constName = block[2];
    const rawData = block[3];
    const typeMatch = block[0].match(/@GEMS-SEED-TYPE:\s*(\w+)/);
    const storyMatch = block[0].match(/@GEMS-SEED-STORY:\s*(Story-[\d.]+)/);
    let data = null;
    try { data = JSON.parse(rawData); } catch { /* 保留 raw */ }
    result.seeds.push({
      name,
      constName,
      type: typeMatch ? typeMatch[1] : name,
      story: storyMatch ? storyMatch[1] : null,
      data,
      rawData,
    });
  }

  // 解析 @GEMS-CONTRACT blocks
  // 支援格式：
  //   // @GEMS-CONTRACT: EntityName  (標準，有冒號)
  //   // @GEMS-CONTRACT EntityName   (無冒號)
  //   /** @GEMS-CONTRACT: EntityName */ (JSDoc)
  // 標籤和 export interface 之間可以有任意 // 或 /** */ 行
  const contractBlocks = [...content.matchAll(
    /(?:\/\/\s*@GEMS-CONTRACT:?\s*(\w+)|\/\*\*[\s\S]*?@GEMS-CONTRACT:?\s*(\w+)[\s\S]*?\*\/)\s*\n(?:(?:\/\/[^\n]*|\/\*\*[\s\S]*?\*\/)\s*\n)*export interface (\w+) \{([^}]+)\}/g
  )];

  for (const block of contractBlocks) {
    const name = block[1] || block[2];
    const ifaceName = block[3];
    const body = block[4]; // interface body 永遠在 block[4]

    // 找 @GEMS-TABLE
    const tableMatch = block[0].match(/@GEMS-TABLE:\s*(\S+)/);
    // 找 @GEMS-STORY
    const storyMatch = block[0].match(/@GEMS-STORY:\s*(Story-[\d.]+)/);

    // 解析欄位
    const fields = parseFields(body);

    result.entities.push({
      name,
      table: tableMatch ? tableMatch[1] : null,
      story: storyMatch ? storyMatch[1] : null,
      fields,
    });
  }

  // 解析 @GEMS-VIEW blocks
  const viewBlocks = [...content.matchAll(
    /(?:\/\/\s*@GEMS-VIEW:?\s*(\w+)|\/\*\*[\s\S]*?@GEMS-VIEW:?\s*(\w+)[\s\S]*?\*\/)\s*\n(?:(?:\/\/[^\n]*|\/\*\*[\s\S]*?\*\/)\s*\n)*export interface (\w+) \{([^}]+)\}/g
  )];
  for (const block of viewBlocks) {
    const name = block[1] || block[2];
    const body = block[4];
    const coverageMatch = block[0].match(/@GEMS-FIELD-COVERAGE:\s*([^\n]+)/);
    result.views.push({
      name,
      coverage: coverageMatch ? parseCoverage(coverageMatch[1]) : null,
      fields: parseFields(body),
    });
  }

  // 解析 @GEMS-API blocks
  const apiBlocks = [...content.matchAll(
    /(?:\/\/\s*@GEMS-API:?\s*(\w+)|\/\*\*[\s\S]*?@GEMS-API:?\s*(\w+)[\s\S]*?\*\/)\s*\n(?:(?:\/\/[^\n]*|\/\*\*[\s\S]*?\*\/)\s*\n)*export interface (\w+) \{([^}]+)\}/g
  )];
  for (const block of apiBlocks) {
    const name = block[1] || block[2];
    const body = block[4]; // interface body 永遠在 block[4]
    const storyMatch = block[0].match(/@GEMS-STORY:\s*(Story-[\d.]+)/);
    result.apis.push({
      name,
      story: storyMatch ? storyMatch[1] : null,
      methods: parseMethods(body),
    });
  }

  return result;
}

function parseFields(body) {
  const fields = [];
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    // 格式: fieldName: Type; // DB_TYPE, ...
    const m = line.match(/^(\w+)\??:\s*([^;]+);?\s*(?:\/\/\s*(.+))?$/);
    if (!m) continue;
    const dbComment = m[3] || '';
    fields.push({
      name: m[1],
      tsType: m[2].trim(),
      dbType: dbComment.trim(),
      hasDbAnnotation: /VARCHAR|UUID|INT|DECIMAL|ENUM|TIMESTAMP|BOOL|TEXT|JSON/i.test(dbComment),
    });
  }
  return fields;
}

function parseMethods(body) {
  const methods = [];
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    // 格式: methodName(params): ReturnType;
    const m = line.match(/^(\w+)\s*\(([^)]*)\)\s*:\s*([^;]+);?/);
    if (!m) continue;
    methods.push({
      name: m[1],
      params: m[2].trim(),
      returnType: m[3].trim(),
      hasReturnType: m[3].trim() !== '' && m[3].trim() !== 'void',
    });
  }
  return methods;
}

function parseCoverage(str) {
  // 格式: field=frontend, field2=api-only
  const result = {};
  for (const part of str.split(',')) {
    const [k, v] = part.trim().split('=');
    if (k && v) result[k.trim()] = v.trim();
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Gate 驗證
// ─────────────────────────────────────────────────────────────

function runGate(parsed, content, draftActions) {
  const blockers = [];
  const warnings = [];

  // CONTRACT-001: 沒有任何 @GEMS-CONTRACT
  if (parsed.entities.length === 0) {
    blockers.push({
      code: 'CONTRACT-001',
      message: '沒有任何 @GEMS-CONTRACT 標籤 — 至少需要一個 Entity 定義',
      fix: '在 interface 上方加 // @GEMS-CONTRACT: EntityName',
    });
    return { blockers, warnings }; // 後續驗證無意義
  }

  for (const entity of parsed.entities) {
    // CONTRACT-002: 缺 @GEMS-TABLE
    if (!entity.table) {
      const isLikelyViewType = /Props$|Return$|State$|Config$|Options$|Params$|Args$|Result$/i.test(entity.name);
      blockers.push({
        code: 'CONTRACT-002',
        message: `@GEMS-CONTRACT: ${entity.name} 缺少 @GEMS-TABLE`,
        fix: isLikelyViewType
          ? `"${entity.name}" 看起來是 UI Props / Hook 回傳型別，不應使用 @GEMS-CONTRACT（沒有 DB table）。請改用 // @GEMS-VIEW: ${entity.name} 或直接移除標籤。只有真正的 DB Entity 才用 @GEMS-CONTRACT。`
          : `在 @GEMS-CONTRACT: ${entity.name} 下方加 // @GEMS-TABLE: tbl_xxx`,
      });
    }

    // CONTRACT-004: 缺 id 欄位
    const hasId = entity.fields.some(f => f.name === 'id');
    if (!hasId) {
      blockers.push({
        code: 'CONTRACT-004',
        message: `@GEMS-CONTRACT: ${entity.name} 缺少 id 欄位`,
        fix: `加入 id: string; // UUID, PK`,
      });
    }

    // CONTRACT-003: 欄位缺 DB 型別註解
    const missingAnnotation = entity.fields.filter(f => !f.hasDbAnnotation && f.name !== 'id');
    if (missingAnnotation.length > 0) {
      blockers.push({
        code: 'CONTRACT-003',
        message: `@GEMS-CONTRACT: ${entity.name} 欄位缺少 DB 型別註解: ${missingAnnotation.map(f => f.name).join(', ')}`,
        fix: `每個欄位後加 // VARCHAR(100), NOT NULL 等 DB 型別`,
      });
    }

    // CONTRACT-007: 缺 @GEMS-STORY
    if (!entity.story) {
      blockers.push({
        code: 'CONTRACT-007',
        message: `@GEMS-CONTRACT: ${entity.name} 缺少 @GEMS-STORY 對應`,
        fix: `加入 // @GEMS-STORY: Story-X.Y`,
      });
    }

    // CONTRACT-W01: 有 Entity 但沒有對應 View
    const hasView = parsed.views.some(v => v.name === `${entity.name}View`);
    if (!hasView) {
      warnings.push({
        code: 'CONTRACT-W01',
        message: `@GEMS-CONTRACT: ${entity.name} 沒有對應的 @GEMS-VIEW: ${entity.name}View`,
        fix: `建議加入 ${entity.name}View interface，標註哪些欄位是 api-only`,
      });
    }
  }

  // CONTRACT-005: 禁止 any / unknown
  if (/:\s*any\b|:\s*unknown\b/.test(content)) {
    blockers.push({
      code: 'CONTRACT-005',
      message: '使用了 any 或 unknown 型別 — contract 必須有明確型別',
      fix: '將 any/unknown 替換為具體型別',
    });
  }

  // CONTRACT-006: @GEMS-API 方法缺回傳型別
  for (const api of parsed.apis) {
    const missingReturn = api.methods.filter(m => !m.hasReturnType);
    if (missingReturn.length > 0) {
      blockers.push({
        code: 'CONTRACT-006',
        message: `@GEMS-API: ${api.name} 方法缺少回傳型別: ${missingReturn.map(m => m.name).join(', ')}`,
        fix: `每個方法加回傳型別，如 ): Promise<Entity>`,
      });
    }

    // CONTRACT-W03: API 沒有 @GEMS-STORY
    if (!api.story) {
      warnings.push({
        code: 'CONTRACT-W03',
        message: `@GEMS-API: ${api.name} 沒有 @GEMS-STORY 對應`,
        fix: `加入 // @GEMS-STORY: Story-X.Y`,
      });
    }
  }

  // CONTRACT-W02: Entity 有 View 但沒有 @GEMS-FIELD-COVERAGE
  for (const view of parsed.views) {
    if (!view.coverage) {
      warnings.push({
        code: 'CONTRACT-W02',
        message: `@GEMS-VIEW: ${view.name} 沒有 @GEMS-FIELD-COVERAGE`,
        fix: `加入 // @GEMS-FIELD-COVERAGE: id=frontend, createdAt=api-only`,
      });
    }
  }

  // CONTRACT-008: @GEMS-API 方法名必須對應 draft 動作清單的 techName（有 draft 時才驗）
  if (draftActions && draftActions.length > 0) {
    // 收集 draft 所有 techName（清除 [Modify] 標記，轉小寫比對）
    const draftTechNames = new Set(
      draftActions.map(a => (a.techName || '').replace(/\s*\[Modify\]/i, '').trim().toLowerCase())
        .filter(Boolean)
    );
    for (const api of parsed.apis) {
      const missingInDraft = api.methods.filter(m => !draftTechNames.has(m.name.toLowerCase()));
      if (missingInDraft.length > 0) {
        warnings.push({
          code: 'CONTRACT-W04',
          message: `@GEMS-API: ${api.name} 方法 [${missingInDraft.map(m => m.name).join(', ')}] 在 draft 動作清單找不到對應 techName`,
          fix: `確認方法名與 draft 動作清單的「技術名稱」欄位一致，或在 draft 補上對應動作`,
        });
      }
    }
    // 反向：draft 有 API 類型的動作，但 contract 沒有對應方法
    const apiActions = draftActions.filter(a => a.type === 'API' || a.type === 'SVC');
    const contractMethodNames = new Set(
      parsed.apis.flatMap(api => api.methods.map(m => m.name.toLowerCase()))
    );
    const missingInContract = apiActions.filter(a => {
      const name = (a.techName || '').replace(/\s*\[Modify\]/i, '').trim().toLowerCase();
      return name && !contractMethodNames.has(name);
    });
    if (missingInContract.length > 0) {
      blockers.push({
        code: 'CONTRACT-008',
        message: `draft 動作清單有 API/SVC 函式未出現在任何 @GEMS-API: [${missingInContract.map(a => a.techName).join(', ')}]`,
        fix: `在 contract 的 @GEMS-API interface 加入這些方法，確保函式邊界對齊`,
      });
    }
  }

  return { blockers, warnings };
}

// ─────────────────────────────────────────────────────────────
// Log 產生
// ─────────────────────────────────────────────────────────────

function buildLogContent(parsed, gateResult, iterNum, contractPath) {
  const ts = new Date().toISOString();
  const pass = gateResult.blockers.length === 0;
  const lines = [];

  lines.push('=== BLUEPRINT CONTRACT LOG ===');
  lines.push(`時間: ${ts}`);
  lines.push(`迭代: iter-${iterNum}`);
  lines.push(`Contract: ${contractPath}`);
  lines.push(`結果: ${pass ? 'PASS' : 'BLOCKER'}`);
  lines.push('');
  lines.push('--- 解析結果 ---');
  lines.push(`Entities: ${parsed.entities.map(e => e.name).join(', ') || '無'}`);
  lines.push(`Views:    ${parsed.views.map(v => v.name).join(', ') || '無'}`);
  lines.push(`APIs:     ${parsed.apis.map(a => a.name).join(', ') || '無'}`);
  lines.push(`Enums:    ${parsed.enums.map(e => e.name).join(', ') || '無'}`);
  lines.push(`Seeds:    ${(parsed.seeds || []).map(s => s.constName + '(' + (s.data ? s.data.length : '?') + ' rows)').join(', ') || '無'}`);
  lines.push('');

  if (gateResult.blockers.length > 0) {
    lines.push('--- BLOCKERS ---');
    for (const b of gateResult.blockers) {
      lines.push(`[${b.code}] ${b.message}`);
      lines.push(`  修復: ${b.fix}`);
    }
    lines.push('');
  }

  if (gateResult.warnings.length > 0) {
    lines.push('--- WARNINGS ---');
    for (const w of gateResult.warnings) {
      lines.push(`[${w.code}] ${w.message}`);
    }
    lines.push('');
  }

  // Entity 摘要（供 draft-to-plan 快速參考）
  lines.push('--- Entity 摘要 ---');
  for (const entity of parsed.entities) {
    lines.push(`${entity.name} → ${entity.table || '?'} (${entity.story || '?'})`);
    for (const f of entity.fields) {
      lines.push(`  ${f.name}: ${f.tsType} // ${f.dbType}`);
    }
  }

  lines.push('==============================');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// 主程式
// ─────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
Blueprint Contract Writer v1.0

用法:
  node sdid-tools/blueprint-contract-writer.cjs --contract=<path> --target=<project> --iter=<N>

選項:
  --contract=<path>  contract_iter-N.ts 路徑（必填）
  --target=<path>    專案根目錄（必填）
  --iter=<N>         迭代編號（預設: 1）
  --help             顯示此訊息

Gate 規則:
  CONTRACT-001  沒有 @GEMS-CONTRACT 標籤
  CONTRACT-002  @GEMS-CONTRACT 缺 @GEMS-TABLE
  CONTRACT-003  欄位缺 DB 型別註解
  CONTRACT-004  Entity 缺 id 欄位
  CONTRACT-005  使用 any/unknown
  CONTRACT-006  @GEMS-API 方法缺回傳型別
  CONTRACT-007  @GEMS-CONTRACT 缺 @GEMS-STORY

輸出:
  @PASS    — contract-pass-*.log 存檔，draft-to-plan 可讀取
  @BLOCKER — contract-error-*.log 存檔，必須修復
`);
    process.exit(0);
  }

  if (!args.contract || !args.target) {
    console.error('錯誤: 需要 --contract 和 --target 參數');
    console.error('用法: node sdid-tools/blueprint-contract-writer.cjs --contract=<path> --target=<project> --iter=N');
    process.exit(1);
  }

  if (!fs.existsSync(args.contract)) {
    console.log('');
    console.log(`@BLOCKER | contract-writer | 找不到 contract 檔案: ${args.contract}`);
    console.log('');
    console.log('@TASK:');
    console.log(`  ACTION: 寫 contract_iter-${args.iter}.ts`);
    console.log(`  FILE: ${path.join(args.target, '.gems', 'iterations', `iter-${args.iter}`, 'poc', `contract_iter-${args.iter}.ts`)}`);
    console.log('  EXPECTED: 參考 .agent/poc/gems-next/BLUEPRINT_CONTRACT_DESIGN.md 格式');
    process.exit(1);
  }

  const content = fs.readFileSync(args.contract, 'utf8');
  const parsed = parseContract(content);

  // 如果有 --draft，讀取動作清單供 CONTRACT-008 交叉比對
  let draftActions = null;
  if (args.draft && fs.existsSync(args.draft)) {
    try {
      const draftParser = require('./lib/draft-parser-standalone.cjs');
      const draft = draftParser.load(args.draft);
      const modules = draftParser.getModulesByIter(draft, args.iter);
      draftActions = modules.flatMap(m => m.actions || []);
    } catch (e) {
      console.warn(`  ⚠ draft 解析失敗，跳過 CONTRACT-008 驗證: ${e.message}`);
    }
  }

  const gateResult = runGate(parsed, content, draftActions);

  // 確保 logs 目錄
  const logsDir = path.join(args.target, '.gems', 'iterations', `iter-${args.iter}`, 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const pass = gateResult.blockers.length === 0;
  const logType = pass ? 'pass' : 'error';
  const logFile = path.join(logsDir, `contract-${logType}-${ts}.log`);
  const logContent = buildLogContent(parsed, gateResult, args.iter, args.contract);
  fs.writeFileSync(logFile, logContent, 'utf8');

  const relLog = path.relative(args.target, logFile);
  const relContract = path.relative(args.target, args.contract);

  if (pass) {
    console.log('');
    console.log(`@PASS | contract-writer | ${parsed.entities.length} Entity, ${parsed.apis.length} API, ${parsed.views.length} View, ${(parsed.seeds || []).length} Seed`);
    if (gateResult.warnings.length > 0) {
      console.log(`  ⚠ ${gateResult.warnings.length} 個 WARNING（不阻擋）`);
      for (const w of gateResult.warnings) {
        console.log(`    [${w.code}] ${w.message}`);
      }
    }
    console.log(`  Contract: ${relContract}`);
    console.log(`  Log: ${relLog}`);
    console.log('');
    console.log(`NEXT: node sdid-tools/draft-to-plan.cjs --draft=<draft> --iter=${args.iter} --target=${path.relative(process.cwd(), args.target) || '.'}`);
    process.exit(0);
  } else {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`@BLOCKER | contract-writer | ${gateResult.blockers.length} 個問題必須修復`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    for (const b of gateResult.blockers) {
      console.log(`  ❌ [${b.code}] ${b.message}`);
      console.log(`     修復: ${b.fix}`);
      console.log('');
    }
    console.log(`  Contract: ${relContract}`);
    console.log(`  Log: ${relLog}`);
    console.log('');
    console.log('修復後重跑:');
    console.log(`  node sdid-tools/blueprint-contract-writer.cjs --contract=${relContract} --target=${path.relative(process.cwd(), args.target) || '.'} --iter=${args.iter}`);
    console.log('═══════════════════════════════════════════════════════════');
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────
// 導出（供 draft-to-plan 讀取 contract）
// ─────────────────────────────────────────────────────────────

/**
 * 讀取並解析 contract 檔案
 * @param {string} projectRoot
 * @param {number} iterNum
 * @returns {object|null} parsed contract 或 null（檔案不存在）
 */
function loadContract(projectRoot, iterNum) {
  const contractPath = path.join(
    projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'poc', `contract_iter-${iterNum}.ts`
  );
  if (!fs.existsSync(contractPath)) return null;
  try {
    const content = fs.readFileSync(contractPath, 'utf8');
    return parseContract(content);
  } catch (e) {
    return null;
  }
}

module.exports = { parseContract, runGate, loadContract };

if (require.main === module) {
  main();
}
