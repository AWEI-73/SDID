#!/usr/bin/env node
/**
 * Blueprint Gate v5.0 — 全局骨架品質門控
 *
 * 驗證 Blueprint v5 格式完整性。
 * Blueprint 只含：目標、實體、路由、迭代規劃表、變異點、API摘要。
 * 不含動作清單/AC（那些在 per-iter draft）。
 *
 * 用法:
 *   node sdid-tools/blueprint/v5/blueprint-gate.cjs --blueprint=<path> [--target=<project>]
 *
 * 輸出:
 *   @PASS     — 可產 per-iter draft
 *   @BLOCKER  — 必須修復
 */
'use strict';
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const a = { blueprint: null, target: null, strict: false, help: false };
  for (const x of process.argv.slice(2)) {
    if (x.startsWith('--blueprint=')) a.blueprint = path.resolve(x.split('=').slice(1).join('='));
    else if (x.startsWith('--target=')) a.target = path.resolve(x.split('=').slice(1).join('='));
    else if (x === '--strict') a.strict = true;
    else if (x === '--help' || x === '-h') a.help = true;
  }
  return a;
}

// ── Blueprint v5 Auto-patch ──
// 格式問題直接偵測→修正，不 BLOCKER
function autoPatchBlueprint(raw) {
  let patched = raw;
  const patches = [];

  // 1. 樣式策略複合值 → 取第一個（"CSS Modules / Tailwind" → "CSS Modules"）
  patched = patched.replace(/(\*\*樣式策略\*\*:\s*)([^\n/]+)\s*\/\s*[^\n]+/g, (_, prefix, first) => {
    const val = first.trim();
    patches.push(`樣式策略複合值 → 取第一個: "${val}"`);
    return `${prefix}${val}`;
  });

  // 2. 迭代規劃表缺 [CURRENT] → 第一個 iter 標記 [CURRENT]
  const hasCurrent = /\[CURRENT\]/i.test(patched);
  if (!hasCurrent) {
    // 找迭代規劃表第一個資料行，加 [CURRENT]
    const iterTableMatch = patched.match(/(##\s*3\.\s*迭代規劃[\s\S]*?\n\|[^\n]+\n\|[-|\s]+\n)(\|[^\n]+)/);
    if (iterTableMatch) {
      const firstRow = iterTableMatch[2];
      // 把最後一欄（status）改為 [CURRENT]
      const newRow = firstRow.replace(/\|\s*([^|]*)\s*\|?\s*$/, '| [CURRENT] |');
      patched = patched.replace(firstRow, newRow);
      patches.push('迭代規劃表缺 [CURRENT] → 第一個 iter 自動標記');
    }
  }

  // 3. 一句話目標格式容錯：## 一句話目標 + 下一行 → **一句話目標**: 單行
  const olHeaderMatch = patched.match(/##\s*一句話目標\s*\n+([^\n#>]+)/);
  if (olHeaderMatch && !/\*\*一句話目標\*\*/.test(patched)) {
    const goalText = olHeaderMatch[1].trim();
    patched = patched.replace(/##\s*一句話目標\s*\n+([^\n#>]+)/, `**一句話目標**: ${goalText}\n`);
    patches.push(`## 一句話目標 → **一句話目標**: 單行格式`);
  }

  // 5. 實體表格欄位名稱容錯（與 draft-gate 一致）
  const entityColAliases = [
    [/\|\s*欄位名稱\s*\|/, '| 欄位 |'],
    [/\|\s*資料型別\s*\|/, '| 型別 |'],
    [/\|\s*限制條件\s*\|/, '| 約束 |'],
    [/\|\s*備註\s*\|/, '| 說明 |'],
  ];
  for (const [pattern, replacement] of entityColAliases) {
    if (pattern.test(patched)) {
      patched = patched.replace(pattern, replacement);
      patches.push(`實體表格欄位名稱修正: → ${replacement.trim()}`);
    }
  }

  return { patched, patches };
}

// ── Blueprint v5 Parser ──
function parseBlueprint(raw) {  const bp = {
    title: '', date: '', level: '',
    goal: '', oneLineGoal: '', exclusions: [],
    groups: [], entities: {}, routes: '', styleStrategy: '',
    iterationPlan: [], apiSummary: [], variationPoints: [],
  };

  // Title
  const titleM = raw.match(/^#\s+(.+?)\s*-\s*Blueprint/m);
  if (titleM) bp.title = titleM[1].trim();

  // Date + Level
  const dateM = raw.match(/\*\*日期\*\*:\s*(.+)/);
  if (dateM) bp.date = dateM[1].trim();
  const lvlM = raw.match(/\*\*規模\*\*:\s*(\S+)/);
  if (lvlM) bp.level = lvlM[1].trim().toUpperCase();

  // Goal (blockquote)
  const goalM = raw.match(/##\s*1\.\s*目標[\s\S]*?>\s*(.+(?:\n>\s*.+)*)/);
  if (goalM) bp.goal = goalM[1].replace(/^>\s*/gm, '').trim();

  // One-line goal
  const olM = raw.match(/\*\*一句話目標\*\*:\s*(.+)/);
  if (olM) bp.oneLineGoal = olM[1].trim();

  // Exclusions
  const exclSection = raw.match(/\*\*不做什麼\*\*:\s*\n((?:\s*-\s*.+\n?)+)/);
  if (exclSection) {
    bp.exclusions = exclSection[1].split('\n').map(l => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
  }

  // Groups
  const groupSection = raw.match(/###\s*族群\s*\n([\s\S]*?)(?=\n###|\n---|\n##|$)/);
  if (groupSection) {
    bp.groups = groupSection[1].split('\n').filter(l => /^\s*-\s/.test(l)).map(l => l.replace(/^\s*-\s*/, '').trim());
  }

  // Entities (#### EntityName + table)
  const entityBlocks = [...raw.matchAll(/####\s+(\w+)\s*\n\|[^\n]+\n\|[-|\s]+\n((?:\|[^\n]+\n?)+)/g)];
  for (const m of entityBlocks) {
    const name = m[1];
    const rows = m[2].split('\n').filter(l => l.startsWith('|'));
    bp.entities[name] = rows.map(r => {
      const cols = r.split('|').map(c => c.trim()).filter(Boolean);
      return { name: cols[0], type: cols[1], constraint: cols[2], desc: cols[3] };
    });
  }

  // Routes
  const routeM = raw.match(/###\s*路由結構\s*\n```[\s\S]*?\n([\s\S]*?)```/);
  if (routeM) bp.routes = routeM[1].trim();

  // Style strategy
  const styleM = raw.match(/\*\*樣式策略\*\*:\s*(.+)/);
  if (styleM) bp.styleStrategy = styleM[1].trim();

  // Iteration plan table
  const iterSection = raw.match(/##\s*3\.\s*迭代規劃[\s\S]*?\n\|[^\n]+\n\|[-|\s]+\n((?:\|[^\n]+\n?)+)/);
  if (iterSection) {
    const rows = iterSection[1].split('\n').filter(l => l.startsWith('|'));
    for (const r of rows) {
      const cols = r.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 5) {
        bp.iterationPlan.push({
          iter: parseInt(cols[0]) || 0,
          module: cols[1],
          goal: cols[2],
          delivery: cols[3],
          status: cols[4],
        });
      }
    }
  }

  // API summary
  const apiSection = raw.match(/###\s*模組\s*API\s*摘要\s*\n([\s\S]*?)(?=\n---|\n##|$)/);
  if (apiSection) {
    bp.apiSummary = apiSection[1].split('\n').filter(l => /^\s*-\s/.test(l)).map(l => l.replace(/^\s*-\s*/, '').trim());
  }

  // Variation points table
  const varSection = raw.match(/##\s*4\.\s*變異點[\s\S]*?\n\|[^\n]+\n\|[-|\s]+\n((?:\|[^\n]+\n?)+)/);
  if (varSection) {
    const rows = varSection[1].split('\n').filter(l => l.startsWith('|'));
    for (const r of rows) {
      const cols = r.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 3) {
        bp.variationPoints.push({ name: cols[0], fixed: cols[1], desc: cols[2] });
      }
    }
  }

  return bp;
}

// ── Checkers ──
function checkBlueprint(bp, raw) {
  const issues = [];
  const B = (code, msg) => issues.push({ level: 'BLOCKER', code, msg });
  const W = (code, msg) => issues.push({ level: 'WARN', code, msg });

  // BP-001: 一句話目標
  if (!bp.oneLineGoal || bp.oneLineGoal.length < 10)
    B('BP-001', '缺少「一句話目標」或長度不足 10 字');

  // BP-002: 原始需求
  if (!bp.goal || bp.goal.length < 20)
    W('BP-002', '「原始需求」過短或缺失 (建議 50 字以上)');

  // BP-003: 族群
  if (bp.groups.length === 0)
    W('BP-003', '缺少「族群」定義');

  // BP-004: 實體
  if (Object.keys(bp.entities).length === 0)
    B('BP-004', '缺少「實體定義」— 至少需要一個 Entity 表格');

  // BP-005: 實體欄位數
  for (const [name, fields] of Object.entries(bp.entities)) {
    if (fields.length < 3)
      B('BP-005', `實體 ${name} 只有 ${fields.length} 個欄位，至少需要 3 個`);
  }

  // BP-006: 路由結構
  if (!bp.routes)
    W('BP-006', '缺少「路由結構」定義');

  // BP-007: 樣式策略
  if (!bp.styleStrategy)
    B('BP-007', '缺少「樣式策略」定義');
  else if (/\s*\/\s*/.test(bp.styleStrategy))
    B('BP-007', `樣式策略必須選定單一值: "${bp.styleStrategy}"`);

  // BP-008: 迭代規劃表
  if (bp.iterationPlan.length === 0)
    B('BP-008', '缺少「迭代規劃表」');

  // BP-009: 必須有 [CURRENT]
  const hasCurrent = bp.iterationPlan.some(e => /CURRENT/i.test(e.status));
  if (bp.iterationPlan.length > 0 && !hasCurrent)
    B('BP-009', '迭代規劃表沒有 [CURRENT] 標記');

  // BP-010: API 摘要
  if (bp.apiSummary.length === 0)
    W('BP-010', '缺少「模組 API 摘要」');

  // BP-011: API 摘要 vs 迭代規劃表模組一致性
  const planModules = new Set(bp.iterationPlan.map(e => e.module.toLowerCase()));
  for (const line of bp.apiSummary) {
    const mod = (line.split(':')[0] || '').trim().toLowerCase();
    if (mod && !planModules.has(mod))
      W('BP-011', `API 摘要模組 "${mod}" 不在迭代規劃表中`);
  }

  // BP-012: 佔位符偵測
  const placeholders = new Set();
  let inCode = false, inComment = false;
  for (const line of raw.split('\n')) {
    if (line.trim().startsWith('```')) { inCode = !inCode; continue; }
    if (line.includes('<!--')) inComment = true;
    if (line.includes('-->')) { inComment = false; continue; }
    if (inCode || inComment) continue;
    const ms = line.match(/\{[a-zA-Z_\u4e00-\u9fff]+\}/g);
    if (ms) ms.forEach(m => { if (!['{x}','{i}','{n}'].includes(m.toLowerCase())) placeholders.add(m); });
  }
  if (placeholders.size > 0)
    B('BP-012', `發現 ${placeholders.size} 個未替換佔位符: ${[...placeholders].slice(0, 5).join(', ')}`);

  // BP-014: 排除項目
  if (bp.exclusions.length === 0)
    W('BP-014', '缺少「不做什麼」排除項目，建議至少列 2 項');

  return issues;
}

// ── Report + Main ──
function getFixGuidance(code) {
  const g = {
    'BP-001': '加入 **一句話目標**: 至少 10 字描述 MVP 目標',
    'BP-002': '補充原始需求 blockquote，至少 50 字',
    'BP-003': '加入 ### 族群 列表',
    'BP-004': '加入 #### EntityName + 欄位表格',
    'BP-005': '每個實體至少 3 個欄位（含 id）',
    'BP-006': '加入 ### 路由結構 code block',
    'BP-007': '選定單一樣式策略: CSS Modules / Tailwind / Global CSS',
    'BP-008': '加入 ## 3. 迭代規劃 表格',
    'BP-009': '在迭代規劃表標記一個 [CURRENT]',
    'BP-010': '加入 ### 模組 API 摘要',
    'BP-011': '確保 API 摘要的模組名與迭代規劃表一致',
    'BP-012': '替換所有 {placeholder} 為實際內容',
    'BP-014': '加入 **不做什麼**: 列出排除項目',
  };
  return g[code] || '參考 task-pipe/templates/blueprint-golden.template.v5.md';
}

function main() {
  const args = parseArgs();
  if (args.help) {
    console.log(`
Blueprint Gate v5.0 — 全局骨架品質門控

用法:
  node sdid-tools/blueprint/v5/blueprint-gate.cjs --blueprint=<path> [--target=<project>]

驗證 Blueprint v5 格式（目標/實體/路由/迭代規劃/API摘要）。
不驗動作清單/AC（那些在 draft-gate）。

輸出: @PASS 或 @BLOCKER
`);
    process.exit(0);
  }

  if (!args.blueprint) {
    console.log('@BLOCKER | blueprint-gate v5 | 需要 --blueprint=<path> 參數');
    console.log('REFERENCE: task-pipe/templates/blueprint-golden.template.v5.md');
    process.exit(1);
  }
  if (!fs.existsSync(args.blueprint)) {
    console.log(`@BLOCKER | blueprint-gate v5 | 檔案不存在: ${args.blueprint}`);
    process.exit(1);
  }

  let raw = fs.readFileSync(args.blueprint, 'utf8');

  // Auto-patch（靜默修正格式問題）
  const { patched: patchedRaw, patches: bpPatches } = autoPatchBlueprint(raw);
  if (bpPatches.length > 0) {
    fs.writeFileSync(args.blueprint, patchedRaw, 'utf8');
    raw = patchedRaw;
  }

  const bp = parseBlueprint(raw);
  const issues = checkBlueprint(bp, raw);
  const blockers = issues.filter(i => i.level === 'BLOCKER');
  const warns = issues.filter(i => i.level === 'WARN');
  const passed = args.strict ? issues.length === 0 : blockers.length === 0;

  // Log 存檔
  if (args.target) {
    const currentIter = bp.iterationPlan.find(e => /CURRENT/i.test(e.status));
    const iterNum = currentIter ? currentIter.iter : 1;
    const logsDir = path.join(args.target, '.gems', 'iterations', `iter-${iterNum}`, 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const status = passed ? 'pass' : 'error';
    const logFile = path.join(logsDir, `blueprint-gate-${status}-${ts}.log`);
    const logLines = [
      `=== Blueprint Gate v5.0 ===`,
      `Blueprint: ${path.basename(args.blueprint)}`,
      `Entities: ${Object.keys(bp.entities).length} | Iters: ${bp.iterationPlan.length}`,
      `Result: ${passed ? 'PASS' : 'BLOCKER'}`,
      '',
      ...issues.map(i => `[${i.level}] ${i.code}: ${i.msg}`),
    ];
    fs.writeFileSync(logFile, logLines.join('\n'), 'utf8');
  }

  const relBp = path.relative(process.cwd(), args.blueprint);
  const relTarget = args.target ? path.relative(process.cwd(), args.target) || '.' : null;
  const currentIter = bp.iterationPlan.find(e => /CURRENT/i.test(e.status));
  const iterNum = currentIter ? currentIter.iter : 1;
  const nextDraftCmd = `node sdid-tools/blueprint/v5/draft-gate.cjs --draft=<draft_iter-${iterNum}.md> --blueprint=${relBp}${relTarget ? ' --target=' + relTarget : ''}`;
  const retryCmd = `node sdid-tools/blueprint/v5/blueprint-gate.cjs --blueprint=${relBp}${relTarget ? ' --target=' + relTarget : ''}`;

  // Log 存檔（含 @TASK 結構供 AI 讀取）
  let logPath = null;
  if (args.target) {
    const logsDir = path.join(args.target, '.gems', 'iterations', `iter-${iterNum}`, 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const status = passed ? 'pass' : 'error';
    const logFile = path.join(logsDir, `blueprint-gate-${status}-${ts}.log`);
    const logLines = [
      `=== SIGNAL ===`,
      passed ? `@PASS | blueprint-gate v5` : `@BLOCKER | blueprint-gate v5`,
      ``,
      `=== TARGET ===`,
      `FILE: ${relBp}`,
      `Entities: ${Object.keys(bp.entities).length} | Iters: ${bp.iterationPlan.length}`,
      ``,
    ];
    if (!passed) {
      logLines.push(`=== BLOCKERS ===`);
      blockers.forEach((b, i) => {
        logLines.push(`@TASK-${i+1}`);
        logLines.push(`  ACTION: FIX_BLUEPRINT`);
        logLines.push(`  FILE: ${relBp}`);
        logLines.push(`  EXPECTED: 修復 [${b.code}]: ${b.msg}`);
        logLines.push(`  REFERENCE: ${getFixGuidance(b.code)}`);
        logLines.push(``);
      });
      if (warns.length > 0) {
        logLines.push(`=== WARNINGS ===`);
        warns.forEach(w => logLines.push(`  [${w.code}] ${w.msg}`));
        logLines.push(``);
      }
    }
    logLines.push(`=== NEXT ===`, retryCmd, ``);
    logLines.push(`=== GUARD ===`, `🚫 禁止修改 task-pipe/ sdid-tools/ | ✅ 只能修改 ${relBp}`);
    fs.writeFileSync(logFile, logLines.join('\n'), 'utf8');
    logPath = path.relative(args.target, logFile);
  }

  // 終端輸出
  console.log('');
  if (passed) {
    console.log(`@PASS | blueprint-gate v5 | ${Object.keys(bp.entities).length} Entity, ${bp.iterationPlan.length} iter`);
    if (bpPatches.length > 0) {
      bpPatches.forEach(p => console.log(`  ✅ auto-patch: ${p}`));
    }
    if (warns.length > 0) {
      console.log(`  ⚠ ${warns.length} WARN（不阻擋）: ${warns.map(w => w.code).join(', ')}`);
    }
    console.log('');
    // @CONTEXT_SCOPE 引導：告訴 AI 下一步要讀什麼、怎麼產 draft
    console.log(`@CONTEXT_SCOPE`);
    console.log(`  Blueprint: ${relBp}`);
    console.log(`  CURRENT iter: iter-${iterNum} (${currentIter ? currentIter.module : '?'})`);
    console.log(`  Iter plan: ${bp.iterationPlan.map(e => `iter-${e.iter}:${e.module}[${e.status}]`).join(', ')}`);
    console.log(`  API summary: ${bp.apiSummary.slice(0, 2).join(' | ')}${bp.apiSummary.length > 2 ? '...' : ''}`);
    console.log('');
    console.log(`@TASK`);
    console.log(`  ACTION: WRITE_DRAFT`);
    console.log(`  FILE: <project>/.gems/iterations/iter-${iterNum}/poc/draft_iter-${iterNum}.md`);
    console.log(`  EXPECTED: 依 Blueprint iter-${iterNum} 規劃產出 per-iter draft（動作清單 + TDD 測試需求）`);
    console.log(`  REFERENCE: task-pipe/templates/draft-iter-golden.template.v5.md`);
    console.log(`  EXAMPLE: task-pipe/templates/examples/draft-iter-1-ecotrack.example.v5.md`);
    console.log('');
    console.log(`NEXT: ${nextDraftCmd}`);
  } else {
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`@BLOCKER | blueprint-gate v5 | ${blockers.length} item(s) to fix`);
    console.log(`@CONTEXT: Blueprint v5 | ${relBp}`);
    if (bpPatches.length > 0) {
      bpPatches.forEach(p => console.log(`  ✅ auto-patch: ${p}`));
    }
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log('');
    blockers.forEach((b, i) => {
      console.log(`@TASK-${i+1}`);
      console.log(`  ACTION: FIX_BLUEPRINT`);
      console.log(`  FILE: ${relBp}`);
      console.log(`  EXPECTED: [${b.code}] ${b.msg}`);
      console.log(`  REFERENCE: ${getFixGuidance(b.code)}`);
      console.log('');
    });
    if (warns.length > 0) {
      warns.forEach(w => console.log(`  ⚠ [${w.code}] ${w.msg}`));
      console.log('');
    }
    console.log(`@NEXT_COMMAND`);
    console.log(`  ${retryCmd}`);
    console.log('');
    console.log(`@REMINDER`);
    blockers.forEach(b => console.log(`  - FIX [${b.code}] ${relBp}`));
    console.log(`  NEXT: ${retryCmd}`);
    console.log('');
    if (logPath) {
      console.log(`@READ: ${logPath}`);
      console.log(`  ↳ 包含: 完整 TASK 清單 + 修復指引`);
    }
    console.log(`@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ ${relBp}`);
    console.log(`═══════════════════════════════════════════════════════════`);
  }

  process.exit(passed ? 0 : 1);
}

module.exports = { parseBlueprint, checkBlueprint, getFixGuidance, autoPatchBlueprint };
if (require.main === module) main();
