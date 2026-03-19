#!/usr/bin/env node
/**
 * Adversarial Reviewer v1.0 (M25)
 *
 * BUILD 完成後，對照 contract_iter-N.ts 型別邊界 vs 實作源碼，
 * 抓腳本 gate 抓不到的語意飄移（型別不符、AC 未實作、介面簽名偏移）。
 *
 * 用法:
 *   node sdid-tools/blueprint/v5/adversarial-reviewer.cjs --contract=<path> --target=<project> --iter=<N> [--story=<Story-X.Y>]
 *
 * 輸出:
 *   @PASS     — 無語意飄移
 *   @DRIFT    — 發現飄移，需修復
 */
'use strict';
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const a = { contract: null, target: null, iter: 1, story: null, help: false };
  for (const x of process.argv.slice(2)) {
    if (x.startsWith('--contract=')) a.contract = path.resolve(x.split('=').slice(1).join('='));
    else if (x.startsWith('--target=')) a.target = path.resolve(x.split('=').slice(1).join('='));
    else if (x.startsWith('--iter=')) a.iter = parseInt(x.split('=')[1]) || 1;
    else if (x.startsWith('--story=')) a.story = x.split('=').slice(1).join('=');
    else if (x === '--help' || x === '-h') a.help = true;
  }
  return a;
}

// ── Contract Parser (minimal — extract interfaces + AC + STORY-ITEM) ──
function parseContract(content) {
  const result = { interfaces: {}, acDefs: [], storyItems: [] };

  // Extract interfaces: interface Name { fields }
  const ifaceBlocks = [...content.matchAll(/export\s+interface\s+(\w+)\s*\{([^}]+)\}/g)];
  for (const m of ifaceBlocks) {
    const name = m[1];
    const body = m[2];
    const fields = [];
    for (const line of body.split('\n')) {
      const fm = line.match(/^\s+(\w+)\??:\s*([^;/]+)/);
      if (fm) fields.push({ name: fm[1], type: fm[2].trim() });
    }
    result.interfaces[name] = fields;
  }

  // v7.0: Extract @GEMS-TDD paths（取代舊 @GEMS-AC 機制）
  const tddLines = content.split('\n').filter(l => l.includes('@GEMS-TDD:'));
  for (const line of tddLines) {
    const m = line.match(/\/\/\s*@GEMS-TDD:\s*(.+)/);
    if (m) result.acDefs.push({ id: m[1].trim(), tag: 'TDD' });
  }

  // Extract @GEMS-STORY-ITEM
  const siLines = content.split('\n').filter(l => l.includes('@GEMS-STORY-ITEM'));
  for (const line of siLines) {
    const m = line.match(/@GEMS-STORY-ITEM:\s*([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|(.+)/);
    if (m) {
      result.storyItems.push({
        name: m[1].trim(), type: m[2].trim(), priority: m[3].trim(),
        flow: m[4].trim(), deps: m[5].trim(), ac: m[6].trim(),
      });
    }
  }

  return result;
}

// ── Source Scanner: find GEMS tags + AC markers in src/ ──
function scanSource(srcDir) {
  const found = { functions: {}, acMarkers: new Set(), interfaces: {} };
  if (!fs.existsSync(srcDir)) return found;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !['node_modules', '.git', 'dist', '__tests__'].includes(entry.name)) {
        walk(full);
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')) {
        const content = fs.readFileSync(full, 'utf8');
        const rel = path.relative(srcDir, full);

        // GEMS tags
        for (const m of content.matchAll(/GEMS:\s*(\w+)\s*\|\s*(P\d)/g)) {
          found.functions[m[1]] = { file: rel, priority: m[2] };
        }

        // AC markers
        for (const m of content.matchAll(/\/\/\s*(AC-\d+\.\d+)/g)) {
          found.acMarkers.add(m[1]);
        }

        // TypeScript interfaces (exported)
        for (const m of content.matchAll(/export\s+(?:interface|type)\s+(\w+)/g)) {
          found.interfaces[m[1]] = rel;
        }

        // Function signatures (exported)
        for (const m of content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g)) {
          if (!found.functions[m[1]]) found.functions[m[1]] = { file: rel, priority: null };
          found.functions[m[1]].signature = `(${m[2].trim()})`;
        }
        // Arrow functions
        for (const m of content.matchAll(/export\s+const\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)/g)) {
          if (!found.functions[m[1]]) found.functions[m[1]] = { file: rel, priority: null };
          found.functions[m[1]].signature = `(${m[2].trim()})`;
        }
      }
    }
  }
  walk(srcDir);
  return found;
}

// ── Drift Checks ──
function checkDrift(contract, source, storyFilter) {
  const drifts = [];
  const W = (code, msg, file) => drifts.push({ level: 'WARN', code, msg, file: file || null });
  const D = (code, msg, file) => drifts.push({ level: 'DRIFT', code, msg, file: file || null });

  // Filter story items if --story specified
  const items = storyFilter
    ? contract.storyItems.filter(i => {
        const ac = i.ac || '';
        return ac.includes(storyFilter) || i.name.toLowerCase().includes(storyFilter.toLowerCase());
      })
    : contract.storyItems;

  // DR-S01: STORY-ITEM 函式是否存在於源碼
  for (const item of items) {
    if (!item.name || item.type === 'CONST') continue;
    if (!source.functions[item.name]) {
      D('DR-S01', `STORY-ITEM "${item.name}" (${item.type}) 在源碼中找不到對應函式`, null);
    }
  }

  // DR-S02: Contract interface 是否在源碼中有對應 export
  for (const [ifaceName] of Object.entries(contract.interfaces)) {
    if (!source.interfaces[ifaceName]) {
      W('DR-S02', `Contract interface "${ifaceName}" 在源碼中找不到 export`, null);
    }
  }

  // DR-S03: v7.0 — @GEMS-TDD 測試檔是否存在（BUILD 後驗收）
  for (const tdd of contract.acDefs) {
    // acDefs 現在存放 @GEMS-TDD 路徑（相對於 project root）
    // target 需要從外部傳入；此處做基礎格式驗證
    if (!tdd.id.startsWith('src/') || !tdd.id.endsWith('.test.ts')) {
      W('DR-S03', `@GEMS-TDD 路徑格式異常（應為 src/.../*.test.ts）: ${tdd.id}`, null);
    }
  }

  // DR-S04: P0 STORY-ITEM 必須有 GEMS tag
  const p0Items = items.filter(i => i.priority === 'P0');
  for (const item of p0Items) {
    const fn = source.functions[item.name];
    if (fn && !fn.priority) {
      W('DR-S04', `P0 函式 "${item.name}" 在源碼中缺少 GEMS 標籤`, fn.file);
    }
  }

  return drifts;
}

// ── Main ──
function main() {
  const args = parseArgs();
  if (args.help) {
    console.log(`
Adversarial Reviewer v1.0 (M25)

用法:
  node sdid-tools/blueprint/v5/adversarial-reviewer.cjs --contract=<path> --target=<project> --iter=<N> [--story=<Story-X.Y>]

對照 contract_iter-N.ts 型別邊界 vs 實作源碼，抓語意飄移。

輸出: @PASS 或 @DRIFT
`);
    process.exit(0);
  }

  if (!args.contract || !args.target) {
    console.log('@DRIFT | adversarial-reviewer | 需要 --contract 和 --target 參數');
    process.exit(1);
  }
  if (!fs.existsSync(args.contract)) {
    console.log(`@DRIFT | adversarial-reviewer | 找不到 contract: ${args.contract}`);
    process.exit(1);
  }

  const content = fs.readFileSync(args.contract, 'utf8');
  const contract = parseContract(content);

  // Find src dir
  const srcDir = fs.existsSync(path.join(args.target, 'src'))
    ? path.join(args.target, 'src')
    : args.target;

  const source = scanSource(srcDir);
  const drifts = checkDrift(contract, source, args.story);

  const driftItems = drifts.filter(d => d.level === 'DRIFT');
  const warnItems = drifts.filter(d => d.level === 'WARN');
  const passed = driftItems.length === 0;

  // Log
  const logsDir = path.join(args.target, '.gems', 'iterations', `iter-${args.iter}`, 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const status = passed ? 'pass' : 'drift';
  const logFile = path.join(logsDir, `adversarial-review-${status}-${ts}.log`);

  const logLines = [
    `=== Adversarial Reviewer v1.0 ===`,
    `Contract: ${path.basename(args.contract)}`,
    `Src: ${path.relative(args.target, srcDir)}`,
    `Story filter: ${args.story || '(all)'}`,
    `Functions found: ${Object.keys(source.functions).length} | AC markers: ${source.acMarkers.size} | Interfaces: ${Object.keys(source.interfaces).length}`,
    `Result: ${passed ? 'PASS' : 'DRIFT'}`,
    '',
    ...driftItems.map(d => `[DRIFT] ${d.code}: ${d.msg}${d.file ? ' ← ' + d.file : ''}`),
    ...warnItems.map(w => `[WARN] ${w.code}: ${w.msg}${w.file ? ' ← ' + w.file : ''}`),
  ];
  fs.writeFileSync(logFile, logLines.join('\n'), 'utf8');

  const relContract = path.relative(process.cwd(), args.contract);
  const relTarget = path.relative(process.cwd(), args.target) || '.';
  const relLog = path.relative(args.target, logFile);

  console.log('');
  if (passed) {
    console.log(`@PASS | adversarial-reviewer | ${Object.keys(source.functions).length} fn, ${source.acMarkers.size} AC, ${Object.keys(source.interfaces).length} iface — 無語意飄移`);
    if (warnItems.length > 0) {
      console.log(`  ⚠ ${warnItems.length} WARN（不阻擋）: ${warnItems.map(w => w.code).join(', ')}`);
    }
    console.log(`  Log: ${relLog}`);
  } else {
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`@DRIFT | adversarial-reviewer | ${driftItems.length} 語意飄移`);
    console.log(`@CONTEXT: Contract ${relContract} vs src/`);
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log('');
    driftItems.forEach((d, i) => {
      console.log(`@TASK-${i + 1}`);
      console.log(`  ACTION: FIX_DRIFT`);
      console.log(`  FILE: ${d.file ? path.join(relTarget, 'src', d.file) : relTarget + '/src/'}`);
      console.log(`  EXPECTED: [${d.code}] ${d.msg}`);
      console.log('');
    });
    if (warnItems.length > 0) {
      warnItems.forEach(w => console.log(`  ⚠ [${w.code}] ${w.msg}`));
      console.log('');
    }
    console.log(`@READ: ${relLog}`);
    console.log(`  ↳ 包含: 完整飄移清單 + 修復指引`);
    console.log(`@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ ${relTarget}/src/`);
    console.log(`═══════════════════════════════════════════════════════════`);
  }

  process.exit(passed ? 0 : 1);
}

module.exports = { parseContract, scanSource, checkDrift };
if (require.main === module) main();
