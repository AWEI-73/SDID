#!/usr/bin/env node
/**
 * POC Gate v1.0 — poc.html 前端驗證門控
 *
 * 定位：draft-gate @PASS 之後、contract-gate 之前的可選 checkpoint。
 * 驗證 poc.html 是否包含有效的 @GEMS-VERIFIED 標籤與真實函式實作。
 *
 * 檢查項目（機械判斷）：
 *   - @GEMS-VERIFIED 存在且有勾選項目
 *   - 勾選項目有對應的 JS 函式實作（非空骨架）
 *   - Mock 資料存在（至少 1 筆）
 *   - 無 scaffold 指紋（未改寫的通用模板）
 *
 * 輸出:
 *   @PASS    — 可繼續 contract-gate
 *   @BLOCKER — 需修復後重跑
 *
 * 用法:
 *   node sdid-tools/blueprint/v5/poc-gate.cjs --poc=<path> [--target=<project>] [--iter=<N>]
 */
'use strict';
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const a = { poc: null, target: null, iter: null };
  for (const x of process.argv.slice(2)) {
    if (x.startsWith('--poc='))    a.poc    = path.resolve(x.split('=').slice(1).join('='));
    else if (x.startsWith('--target=')) a.target = path.resolve(x.split('=').slice(1).join('='));
    else if (x.startsWith('--iter='))  a.iter   = parseInt(x.split('=')[1]);
  }
  return a;
}

// ── Scaffold 指紋（未改寫的通用模板殘跡）──
const SCAFFOLD_FINGERPRINTS = [
  '範例項目 A', '範例項目 B', '已完成項目',
  'Module 管理', 'id="inputField"', '輸入內容...',
  '專案 POC',
];

// ── 提取 @GEMS-VERIFIED 勾選項目 ──
function extractVerified(html) {
  const checked = [], unchecked = [];
  const m = html.match(/@GEMS-VERIFIED:([\s\S]*?)(?=-->|@GEMS-[A-Z]|$)/);
  if (!m) return { checked, unchecked, exists: false };
  for (const line of m[1].split('\n')) {
    const c = line.match(/- \[x\]\s*(.+)/i);
    if (c) checked.push(c[1].trim());
    const u = line.match(/- \[ \]\s*(.+)/i);
    if (u) unchecked.push(u[1].trim());
  }
  return { checked, unchecked, exists: true };
}

// ── 提取實際 JS 函式名稱 ──
function extractFunctions(html) {
  const fns = [];
  for (const m of html.matchAll(/function\s+(\w+)\s*\(|const\s+(\w+)\s*=\s*(?:\([^)]*\)\s*=>|function)/g)) {
    const name = m[1] || m[2];
    if (name) fns.push(name);
  }
  return fns;
}

// ── 檢查函式是否為空骨架 ──
function isEmptyFunction(html, fnName) {
  const m = html.match(new RegExp(`function\\s+${fnName}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\}`, 'm'));
  if (!m) return false;
  const body = m[1].replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
  return body.length < 10;
}

// ── 提取 Mock 資料數量 ──
function countMockData(html) {
  let count = 0;
  for (const m of html.matchAll(/(?:let|const|var)\s+\w+\s*=\s*\[([\s\S]*?)\];/g)) {
    count += (m[1].match(/\{/g) || []).length;
  }
  return count;
}

// ── 關鍵字匹配（verified item ↔ function name）──
function matchesFunction(item, fns) {
  // 優先：(function: xxx) 格式
  const explicit = item.match(/\(function:\s*(\w+)\)/i);
  if (explicit) return fns.some(f => f.toLowerCase().includes(explicit[1].toLowerCase()));
  // fallback：關鍵字匹配
  const keywords = item.toLowerCase().replace(/[（(][^）)]*[）)]/g, '').split(/[\s,，、\-_]+/).filter(w => w.length > 1);
  return fns.some(f => keywords.some(kw => f.toLowerCase().includes(kw)));
}

// ── 主要 gate 邏輯 ──
/** GEMS: checkPoc | P1 | parseHtml(Pure)→checkRequired(Pure)→validateFunctions(Pure)→RETURN:GateResult | Story-2.0 */
function checkPoc(html) {
  const blockers = [];
  const guided = [];
  const B = (code, msg, fix) => blockers.push({ code, msg, fix });
  const G = (code, msg) => guided.push({ code, msg });

  // 1. Scaffold 指紋
  const fingerprints = SCAFFOLD_FINGERPRINTS.filter(fp => html.includes(fp));
  if (fingerprints.length > 0) {
    B('PG-001', `POC 仍含通用 scaffold 內容，未根據專案改寫：${fingerprints.join('、')}`,
      '將 <title>、Mock 資料、函式邏輯改成符合專案的內容');
  }

  // 2. @GEMS-VERIFIED 存在
  const verified = extractVerified(html);
  if (!verified.exists) {
    B('PG-002', '缺少 @GEMS-VERIFIED 標籤',
      '在 HTML 註解中加入 @GEMS-VERIFIED: 並列出已實作的功能');
    return { blockers, guided }; // 後續無意義
  }
  if (verified.checked.length === 0) {
    B('PG-003', '@GEMS-VERIFIED 沒有任何勾選項目（[x]）',
      '至少勾選 1 個已實作的功能');
  }

  // 3. 勾選項目有對應函式
  const fns = extractFunctions(html);
  if (verified.checked.length > 0 && fns.length === 0) {
    B('PG-004', '@GEMS-VERIFIED 有勾選項目但 POC 沒有任何 JS 函式',
      '實作對應的 JavaScript 函式');
  } else if (verified.checked.length > 0) {
    const unmatched = verified.checked.filter(item => !matchesFunction(item, fns));
    const ratio = 1 - unmatched.length / verified.checked.length;
    if (ratio < 0.5) {
      B('PG-005', `@GEMS-VERIFIED 勾選項目找不到對應函式：${unmatched.slice(0, 3).join('、')}`,
        `已偵測到的函式：${fns.join(', ')}。請在 @GEMS-VERIFIED 中用 (function: fnName) 格式明確對應`);
    } else if (unmatched.length > 0) {
      G('PG-G01', `部分勾選項目未明確對應函式：${unmatched.join('、')}。建議用 (function: fnName) 格式標註`);
    }
  }

  // 4. 空函式檢查
  const emptyFns = fns.filter(fn => isEmptyFunction(html, fn));
  if (emptyFns.length > 0) {
    B('PG-006', `發現空骨架函式：${emptyFns.join('、')}`,
      'POC 函式必須有真實邏輯，不能只是空殼');
  }

  // 5. Mock 資料
  const mockCount = countMockData(html);
  if (mockCount === 0) {
    G('PG-G02', '未偵測到 Mock 資料陣列，建議加入至少 2 筆測試資料');
  }

  // 6. @GEMS-DESIGN-BRIEF（建議）
  if (!html.includes('@GEMS-DESIGN-BRIEF')) {
    G('PG-G03', '建議加入 @GEMS-DESIGN-BRIEF 記錄 UI 設計意圖（Purpose / Aesthetic / ColorPalette）');
  }

  return { blockers, guided, stats: { verified: verified.checked, unchecked: verified.unchecked, fns, mockCount } };
}

function main() {
  const args = parseArgs();

  if (!args.poc) {
    console.log('@BLOCKER | poc-gate v1.0 | 需要 --poc=<path> 參數');
    process.exit(1);
  }
  if (!fs.existsSync(args.poc)) {
    console.log(`@BLOCKER | poc-gate v1.0 | 檔案不存在: ${args.poc}`);
    process.exit(1);
  }

  const html = fs.readFileSync(args.poc, 'utf8');
  const relPoc = path.relative(process.cwd(), args.poc);
  const relTarget = args.target ? path.relative(process.cwd(), args.target) || '.' : null;

  // 推斷 iter
  let iterNum = args.iter;
  if (!iterNum) {
    const m = args.poc.match(/iter-(\d+)/);
    iterNum = m ? parseInt(m[1]) : 1;
  }

  const { blockers, guided, stats } = checkPoc(html);
  const passed = blockers.length === 0;

  const contractPath = relTarget
    ? `${relTarget}/.gems/iterations/iter-${iterNum}/contract_iter-${iterNum}.ts`
    : `.gems/iterations/iter-${iterNum}/contract_iter-${iterNum}.ts`;
  const bpAbsPath = args.target ? path.join(args.target, '.gems', 'design', 'blueprint.md') : null;
  const bpExists = bpAbsPath && fs.existsSync(bpAbsPath);
  const bpFlag = bpExists ? ` --blueprint=${path.relative(process.cwd(), bpAbsPath)}` : '';
  const nextCmd = `node sdid-tools/blueprint/v5/contract-gate.cjs --contract=${contractPath}${relTarget ? ' --target=' + relTarget : ''} --iter=${iterNum}${bpFlag}`;
  const retryCmd = `node sdid-tools/blueprint/v5/poc-gate.cjs --poc=${relPoc}${relTarget ? ' --target=' + relTarget : ''} --iter=${iterNum}`;

  // Log 存檔
  if (args.target) {
    const logsDir = path.join(args.target, '.gems', 'iterations', `iter-${iterNum}`, 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const logFile = path.join(logsDir, `poc-gate-${passed ? 'pass' : 'error'}-${ts}.log`);
    const lines = [
      `=== SIGNAL ===`,
      passed ? `@PASS | poc-gate v1.0` : `@BLOCKER | poc-gate v1.0`,
      ``,
      `=== TARGET ===`,
      `FILE: ${relPoc}`,
      stats ? `Verified: ${stats.verified.length} | Functions: ${stats.fns.length} | Mock: ${stats.mockCount}` : '',
      ``,
    ];
    if (!passed) {
      lines.push(`=== BLOCKERS ===`);
      blockers.forEach((b, i) => {
        lines.push(`@TASK-${i + 1}`);
        lines.push(`  ACTION: FIX_POC`);
        lines.push(`  FILE: ${relPoc}`);
        lines.push(`  EXPECTED: [${b.code}] ${b.msg}`);
        lines.push(`  FIX: ${b.fix}`);
        lines.push(``);
      });
    }
    if (guided && guided.length > 0) {
      lines.push(`=== GUIDED ===`);
      guided.forEach(g => lines.push(`  @GUIDED [${g.code}] ${g.msg}`));
      lines.push(``);
    }
    lines.push(`=== NEXT ===`, passed ? nextCmd : retryCmd, ``);
    fs.writeFileSync(logFile, lines.join('\n'), 'utf8');
  }

  // 終端輸出
  console.log('');
  if (passed) {
    console.log(`@PASS | poc-gate v1.0 | ${relPoc}`);
    if (stats) {
      console.log(`  Verified: ${stats.verified.length} 項 | Functions: ${stats.fns.length} 個 | Mock: ${stats.mockCount} 筆`);
    }
    if (guided && guided.length > 0) {
      console.log('');
      guided.forEach(g => console.log(`  @GUIDED [${g.code}] ${g.msg}`));
    }
    console.log('');
    console.log(`@CONTEXT_SCOPE`);
    console.log(`  POC: ${relPoc}`);
    if (stats) {
      console.log(`  Verified features: ${stats.verified.join(', ')}`);
      if (stats.unchecked.length > 0) {
        console.log(`  Deferred (未實作): ${stats.unchecked.join(', ')}`);
      }
    }
    console.log('');
    console.log(`@TASK`);
    console.log(`  ACTION: WRITE_CONTRACT`);
    console.log(`  FILE: ${contractPath}`);
    console.log(`  EXPECTED: 從 draft + poc @GEMS-VERIFIED 推導 contract_iter-${iterNum}.ts`);
    console.log(`  NOTE: Deferred 功能標記為 DEFERRED 在 contract 的 @GEMS-STORY 中`);
    console.log(`  REFERENCE: task-pipe/templates/contract-golden.template.v3.ts`);
    console.log('');
    console.log(`NEXT: ${nextCmd}`);
  } else {
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`@BLOCKER | poc-gate v1.0 | ${blockers.length} item(s) to fix`);
    console.log(`@CONTEXT: POC ${relPoc}`);
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log('');
    blockers.forEach((b, i) => {
      console.log(`@TASK-${i + 1}`);
      console.log(`  ACTION: FIX_POC`);
      console.log(`  FILE: ${relPoc}`);
      console.log(`  EXPECTED: [${b.code}] ${b.msg}`);
      console.log(`  FIX: ${b.fix}`);
      console.log('');
    });
    if (guided && guided.length > 0) {
      guided.forEach(g => console.log(`  @GUIDED [${g.code}] ${g.msg}`));
      console.log('');
    }
    console.log(`@NEXT_COMMAND`);
    console.log(`  ${retryCmd}`);
    console.log('');
    console.log(`@REMINDER`);
    blockers.forEach(b => console.log(`  - FIX [${b.code}] ${relPoc}`));
    console.log(`  NEXT: ${retryCmd}`);
    console.log(`═══════════════════════════════════════════════════════════`);
  }

  // --- Decision Log ---
  const { writeDecisionLog } = require('../../lib/decision-log.cjs');
  writeDecisionLog(args.target, {
    gate: 'poc-gate',
    status: passed ? 'PASS' : 'BLOCKER',
    iter: iterNum,
    errors: blockers.map(b => b.code)
  });
  console.log(`[LOG-REQUIRED] gate=poc-gate status=${passed ? 'PASS' : 'BLOCKER'} iter=${iterNum}`);
  console.log(`  → 補上 why${passed ? '' : ' + resolution'} 到 .gems/decision-log.jsonl 再繼續`);
  console.log('');

  process.exit(passed ? 0 : 1);
}

module.exports = { checkPoc, extractVerified, extractFunctions };
if (require.main === module) main();
