#!/usr/bin/env node
/**
 * Contract Gate v5.1 — Per-iter Contract 格式門控（機械化）
 *
 * 只驗三個大項存在（機械判斷）：
 *   1. @GEMS-STORY: 至少一個（單行格式）
 *   2. @GEMS-CONTRACT: 至少一個
 *   3. @CONTRACT-LOCK: 存在
 *
 * Auto-patch:
 *   - @GEMS-STORIES 區塊格式 → @GEMS-STORY: 單行格式（靜默修正）
 *   - @CONTRACT-LOCK 不存在 → 通過後自動注入
 *
 * 語意問題（型別完整性、AC 精確化）→ @GUIDED，不 BLOCK
 * 沒有 WARN 層級。
 *
 * 用法:
 *   node sdid-tools/blueprint/v5/contract-gate.cjs --contract=<path> --target=<project> --iter=<N>
 *
 * 輸出:
 *   @PASS     — 可進入 plan-generator → BUILD
 *   @BLOCKER  — 大項結構缺失
 */
'use strict';
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const a = { contract: null, target: null, iter: 1, help: false };
  for (const x of process.argv.slice(2)) {
    if (x.startsWith('--contract=')) a.contract = path.resolve(x.split('=').slice(1).join('='));
    else if (x.startsWith('--target=')) a.target = path.resolve(x.split('=').slice(1).join('='));
    else if (x.startsWith('--iter=')) a.iter = parseInt(x.split('=')[1]) || 1;
    else if (x === '--help' || x === '-h') a.help = true;
  }
  return a;
}

// ── Auto-patch: @GEMS-STORIES 區塊 → @GEMS-STORY: 單行格式 ──
// 舊格式:
//   // @GEMS-STORIES
//   // Story-1.0 | shared | 基礎建設 | INFRA
// 新格式:
//   // @GEMS-STORY: Story-1.0 | shared | 基礎建設 | INFRA
function autoPatchContract(content) {
  const patches = [];
  let patched = content;

  // 1. @GEMS-STORIES 區塊（舊格式）→ @GEMS-STORY: 單行格式
  const storiesBlockMatch = patched.match(/\/\/\s*@GEMS-STORIES\s*\n((?:\/\/[^\n]*\n?)+)/);
  if (storiesBlockMatch) {
    const blockLines = storiesBlockMatch[1].split('\n').filter(l => l.trim().startsWith('//'));
    const storyLines = blockLines
      .map(l => l.replace(/^\/\/\s*/, '').trim())
      .filter(l => /^Story[-\s]\d+\.\d+/.test(l));
    if (storyLines.length > 0) {
      // 同時修正 Story 空格 → 連字號
      const newLines = storyLines.map(l => {
        const normalized = l.replace(/^Story\s+(\d+\.\d+)/, 'Story-$1');
        return `// @GEMS-STORY: ${normalized}`;
      }).join('\n');
      patched = patched.replace(storiesBlockMatch[0], newLines + '\n');
      patches.push(`@GEMS-STORIES 區塊 → ${storyLines.length} 個 @GEMS-STORY: 單行格式`);
    }
  }

  // 2. @GEMS-ENTITY 別名 → @GEMS-CONTRACT
  //    有些 AI 會寫 @GEMS-ENTITY: 或 @GEMS-TYPE:
  patched = patched.replace(/\/\/\s*@GEMS-ENTITY:\s*/g, '// @GEMS-CONTRACT: ');
  if (patched !== content && !patches.some(p => p.includes('ENTITY'))) {
    patches.push('@GEMS-ENTITY → @GEMS-CONTRACT');
  }
  patched = patched.replace(/\/\/\s*@GEMS-TYPE:\s*/g, '// @GEMS-CONTRACT: ');
  if (patched !== content && !patches.some(p => p.includes('TYPE'))) {
    patches.push('@GEMS-TYPE → @GEMS-CONTRACT');
  }

  // 3. @GEMS-STORY 格式容錯：Story 1.0（空格）→ Story-1.0（連字號）
  patched = patched.replace(/(\/\/\s*@GEMS-STORY:\s*Story)\s+(\d+\.\d+)/g, (_, prefix, ver) => {
    patches.push(`@GEMS-STORY Story ${ver} → Story-${ver}`);
    return `${prefix}-${ver}`;
  });

  // 4. interface 缺少 @GEMS-CONTRACT 標頭 → 自動補（只補第一個 interface）
  //    條件：有 interface 但完全沒有 @GEMS-CONTRACT
  const hasContract = /\/\/\s*@GEMS-CONTRACT:?\s*\w+/.test(patched);
  if (!hasContract) {
    const interfaceMatch = patched.match(/^(export\s+)?interface\s+(\w+)/m);
    if (interfaceMatch) {
      const entityName = interfaceMatch[2];
      patched = patched.replace(
        interfaceMatch[0],
        `// @GEMS-CONTRACT: ${entityName}\n${interfaceMatch[0]}`
      );
      patches.push(`自動補 @GEMS-CONTRACT: ${entityName}（第一個 interface）`);
    }
  }

  return { patched, patches };
}
// ── 讀取最新 cynefin-report.json（contract-gate cross-check 用）──
function findLatestCynefinReport(logsDir) {
  if (!fs.existsSync(logsDir)) return null;
  try {
    const files = fs.readdirSync(logsDir)
      .filter(f => f.startsWith('cynefin-report-') && f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length === 0) return null;
    return JSON.parse(fs.readFileSync(path.join(logsDir, files[0]), 'utf8'));
  } catch {
    return null;
  }
}

// ── Gate checks（只驗三個大項）──
/** GEMS: checkContract | P0 | checkStories(Pure)→checkContracts(Pure)→checkTDDCoverage(Complicated)→RETURN:GateResult | Story-2.0 */
function checkContract(content, iterNum, target = null) {
  const blockers = [];
  const guided = [];
  const B = (code, msg) => blockers.push({ code, msg });
  const G = (code, msg) => guided.push({ code, msg });

  // 大項 1: @GEMS-STORY: 至少一個
  const hasStory = /\/\/\s*@GEMS-STORY:\s*Story-\d+\.\d+/.test(content);
  if (!hasStory)
    B('CG-001', '缺少 @GEMS-STORY: Story-X.Y（至少一個），格式: // @GEMS-STORY: Story-1.0 | module | 描述 | TYPE');

  // 大項 2: @GEMS-CONTRACT: 至少一個
  const hasContract = /\/\/\s*@GEMS-CONTRACT:?\s*\w+/.test(content);
  if (!hasContract)
    B('CG-002', '缺少 @GEMS-CONTRACT: EntityName（至少一個 Entity 定義）');

  // 大項 3: @CONTRACT-LOCK（通過後自動注入，這裡只在 BLOCKER 時提示）
  // 不驗 @CONTRACT-LOCK，因為 @PASS 時會自動注入

  // CG-003: @GEMS-TDD 路徑格式驗證 → BLOCKER（升級自 GUIDED CG-G01）
  // 不再要求 src/ 前綴（支援多根目錄），只驗副檔名
  const tddMatches = [...content.matchAll(/\/\/\s*@GEMS-TDD:\s*(.+)/g)];
  const tddPaths = tddMatches.map(m => m[1].trim()).filter(Boolean);
  const badTddPaths = tddPaths.filter(p => !p.match(/\.(test|spec)\.(ts|tsx)$/));
  if (badTddPaths.length > 0)
    B('CG-003', `@GEMS-TDD 路徑格式錯誤，必須以 .test.ts / .spec.ts / .test.tsx / .spec.tsx 結尾: ${badTddPaths.join(', ')}`);

  // CG-004: CYNEFIN cross-check → BLOCKER
  // 若 cynefin-report 中有 needsTest:true 的 action，contract 必須有 @GEMS-TDD:
  if (target) {
    const logsDir = path.join(target, '.gems', 'iterations', `iter-${iterNum}`, 'logs');
    const cynefinReport = findLatestCynefinReport(logsDir);
    if (cynefinReport && Array.isArray(cynefinReport.actions)) {
      const needsTestActions = cynefinReport.actions.filter(a => a.needsTest === true);
      if (needsTestActions.length > 0 && tddPaths.length === 0) {
        const names = needsTestActions.map(a => a.name).join(', ');
        B('CG-004',
          `CYNEFIN 報告中有 ${needsTestActions.length} 個 needsTest:true action（${names}），` +
          `但 contract 缺少 @GEMS-TDD: 標籤。` +
          `請新增: // @GEMS-TDD: <src路徑>/<模組>.test.ts`
        );
      }
    }
  }

  // @GUIDED: any/unknown 型別
  if (/:\s*any\b|:\s*unknown\b/.test(content))
    G('CG-G02', '發現 any/unknown 型別，建議替換為具體型別');

  // @GUIDED: @GEMS-API 方法缺回傳型別
  const apiMethods = [...content.matchAll(/(\w+)\s*\([^)]*\)\s*;/g)];
  const missingReturn = apiMethods.filter(m => {
    const line = m[0];
    return !line.includes(':') || line.match(/\)\s*;$/);
  });
  if (missingReturn.length > 0)
    G('CG-G03', `部分 @GEMS-API 方法可能缺少回傳型別，建議補齊 ): Promise<ReturnType>`);

  // @GUIDED: 偵測舊 AC 標籤（deprecated）
  if (/\/\/\s*@GEMS-AC:/.test(content))
    G('CG-G04', '@GEMS-AC 標籤已 deprecated（v7.0），請改用 @GEMS-TDD 指向測試檔路徑。參考: task-pipe/templates/examples/ac-golden.ts');

  return { blockers, guided };
}

// ── Main ──
function main() {
  const args = parseArgs();
  if (args.help) {
    console.log(`
Contract Gate v5.1 — Per-iter Contract 格式門控（機械化）

用法:
  node sdid-tools/blueprint/v5/contract-gate.cjs --contract=<path> --target=<project> --iter=<N>

驗三個大項: @GEMS-STORY: 存在 / @GEMS-CONTRACT: 存在 / 格式合法
Auto-patch: @GEMS-STORIES 區塊 → @GEMS-STORY: 單行格式
@PASS 後自動注入 @CONTRACT-LOCK

輸出: @PASS 或 @BLOCKER
`);
    process.exit(0);
  }

  if (!args.contract || !args.target) {
    console.log('@BLOCKER | contract-gate v5.1 | 需要 --contract 和 --target 參數');
    process.exit(1);
  }
  if (!fs.existsSync(args.contract)) {
    console.log(`@BLOCKER | contract-gate v5.1 | 檔案不存在: ${args.contract}`);
    process.exit(1);
  }

  let content = fs.readFileSync(args.contract, 'utf8');

  // Auto-patch
  const { patched, patches } = autoPatchContract(content);
  if (patches.length > 0) {
    fs.writeFileSync(args.contract, patched, 'utf8');
    content = patched;
  }

  const { blockers, guided } = checkContract(content, args.iter, args.target);
  const passed = blockers.length === 0;

  // @CONTRACT-LOCK 注入（@PASS 時）
  if (passed && !content.includes('@CONTRACT-LOCK')) {
    const today = new Date().toISOString().slice(0, 10);
    const lockHeader = [
      `// @CONTRACT-LOCK: ${today} | Gate: iter-${args.iter}`,
      `// @SPEC-CHANGES: (none)`,
      `//`,
      `// ─── 以下契約已通過 Gate，修改需加 [SPEC-FIX] 標記 ──────────────────────────`,
      ``,
    ].join('\n');
    fs.writeFileSync(args.contract, lockHeader + content, 'utf8');
    patches.push('@CONTRACT-LOCK 標頭已注入');
  }

  // Log 存檔
  const logsDir = path.join(args.target, '.gems', 'iterations', `iter-${args.iter}`, 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const status = passed ? 'pass' : 'error';
  const logFile = path.join(logsDir, `contract-gate-${status}-${ts}.log`);
  const logLines = [
    `=== Contract Gate v5.1 ===`,
    `Contract: ${path.basename(args.contract)}`,
    `Iter: ${args.iter}`,
    `Result: ${passed ? 'PASS' : 'BLOCKER'}`,
    '',
  ];
  if (patches.length > 0) {
    logLines.push('=== AUTO-PATCH ===');
    patches.forEach(p => logLines.push(`  ✅ ${p}`));
    logLines.push('');
  }
  if (blockers.length > 0) {
    logLines.push('=== BLOCKERS ===');
    blockers.forEach(b => logLines.push(`[${b.code}] ${b.msg}`));
    logLines.push('');
  }
  if (guided.length > 0) {
    logLines.push('=== GUIDED ===');
    guided.forEach(g => logLines.push(`@GUIDED [${g.code}] ${g.msg}`));
    logLines.push('');
  }
  fs.writeFileSync(logFile, logLines.join('\n'), 'utf8');

  const relContract = path.relative(process.cwd(), args.contract);
  const relTarget = path.relative(process.cwd(), args.target) || '.';
  const relLog = path.relative(args.target, logFile);
  const retryCmd = `node sdid-tools/blueprint/v5/contract-gate.cjs --contract=${relContract} --target=${relTarget} --iter=${args.iter}`;

  // 終端輸出
  console.log('');
  if (passed) {
    console.log(`@PASS | contract-gate v5.1 | iter-${args.iter}`);
    if (patches.length > 0) patches.forEach(p => console.log(`  ✅ auto-patch: ${p}`));
    if (guided.length > 0) {
      console.log('');
      guided.forEach(g => console.log(`  @GUIDED [${g.code}] ${g.msg}`));
    }
    console.log(`  Log: ${relLog}`);
    console.log('');
    console.log(`@CONTEXT_SCOPE`);
    console.log(`  Contract: ${relContract}`);
    console.log(`  BUILD_READ: ${relContract}, implementation_plan_Story-X.Y.md`);
    console.log(`  BUILD_SKIP: draft_iter-${args.iter}.md, 其他 iter contract`);
    console.log('');
    console.log(`NEXT: 呼叫 sdid-loop 繼續流程（contract → plan-generator → BUILD）`);
  } else {
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`@BLOCKER | contract-gate v5.1 | ${blockers.length} item(s) to fix`);
    console.log(`@CONTEXT: Contract iter-${args.iter} | ${relContract}`);
    if (patches.length > 0) patches.forEach(p => console.log(`  ✅ auto-patch: ${p}`));
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log('');
    blockers.forEach((b, i) => {
      console.log(`@TASK-${i+1}`);
      console.log(`  ACTION: FIX_CONTRACT`);
      console.log(`  FILE: ${relContract}`);
      console.log(`  EXPECTED: [${b.code}] ${b.msg}`);
      console.log('');
    });
    if (guided.length > 0) {
      guided.forEach(g => console.log(`  @GUIDED [${g.code}] ${g.msg}`));
      console.log('');
    }
    console.log(`@NEXT_COMMAND`);
    console.log(`  ${retryCmd}`);
    console.log('');
    console.log(`@REMINDER`);
    blockers.forEach(b => console.log(`  - FIX [${b.code}] ${relContract}`));
    console.log(`  NEXT: ${retryCmd}`);
    console.log('');
    console.log(`@READ: ${relLog}`);
    console.log(`@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ ${relContract}`);
    console.log(`═══════════════════════════════════════════════════════════`);
  }

  // --- Decision Log ---
  const { writeDecisionLog } = require('../../lib/decision-log.cjs');
  writeDecisionLog(args.target, {
    gate: 'contract-gate',
    status: passed ? 'PASS' : 'BLOCKER',
    iter: args.iter,
    errors: blockers.map(b => b.code)
  });
  console.log(`[LOG-REQUIRED] gate=contract-gate status=${passed ? 'PASS' : 'BLOCKER'} iter=${args.iter}`);
  console.log(`  → 補上 why${passed ? '' : ' + resolution'} 到 .gems/decision-log.jsonl 再繼續`);
  console.log('');

  process.exit(passed ? 0 : 1);
}

module.exports = { autoPatchContract, checkContract };
if (require.main === module) main();
