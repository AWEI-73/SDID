#!/usr/bin/env node
/**
 * Draft Gate v5.1 — Per-iter Draft 格式門控（機械化）
 *
 * 只驗大項結構存在（機械判斷），語意品質由前面的 skill 評分負責。
 * 格式問題 → auto-patch（機械修正，靜默）
 * 語意問題 → @GUIDED（具體指引，不 BLOCK）
 * 結構缺失 → @BLOCKER
 * 沒有 WARN 層級。
 *
 * Auto-patch 項目:
 *   - UI+ROUTE 複合類型 → 拆成兩行
 *   - 子 section 動作（## Story-X.Y 動作）→ 合併到頂層 ## 動作清單
 *   - 缺少 ## TDD 測試需求 → 補空節（[TDD] 動作各補一行提示）
 *
 * 用法:
 *   node sdid-tools/blueprint/v5/draft-gate.cjs --draft=<path> [--blueprint=<path>] [--target=<project>]
 *
 * 輸出:
 *   @PASS     — 可產 contract_iter-N.ts
 *   @BLOCKER  — 結構缺失，auto-patch 無法處理
 */
'use strict';
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const a = { draft: null, blueprint: null, target: null, help: false };
  for (const x of process.argv.slice(2)) {
    if (x.startsWith('--draft=')) a.draft = path.resolve(x.split('=').slice(1).join('='));
    else if (x.startsWith('--blueprint=')) a.blueprint = path.resolve(x.split('=').slice(1).join('='));
    else if (x.startsWith('--target=')) a.target = path.resolve(x.split('=').slice(1).join('='));
    else if (x === '--help' || x === '-h') a.help = true;
  }
  return a;
}

// ── Valid action types ──
const VALID_TYPES = new Set([
  'CONST', 'LIB', 'API', 'SVC', 'HOOK', 'UI', 'ROUTE', 'SCRIPT',
  'CALC', 'CREATE', 'READ', 'MODIFY', 'DELETE',
]);

// ── Composite types → auto-patch splits them ──
const COMPOSITE_SPLITS = {
  'UI+ROUTE': ['UI', 'ROUTE'],
  'ROUTE+UI': ['ROUTE', 'UI'],
  'SVC+HOOK': ['SVC', 'HOOK'],
  'HOOK+SVC': ['HOOK', 'SVC'],
};

// ── Auto-patch: fix raw content before parsing ──
function autoPatch(raw) {
  let patched = raw;
  const patches = [];

  // 0. 標題格式容錯：## 一句話目標 / ## 目標 / ## 本迭代目標 → 統一為 **目標**
  //    偵測 ## 開頭的目標行，轉換為 metadata 格式
  const goalHeaderPattern = /^##\s*(一句話目標|本迭代目標|目標)\s*\n+([^\n#]+)/m;
  const goalHeaderMatch = patched.match(goalHeaderPattern);
  if (goalHeaderMatch && !/\*\*目標\*\*/.test(patched)) {
    const goalText = goalHeaderMatch[2].trim();
    patched = patched.replace(goalHeaderPattern, `**目標**: ${goalText}`);
    patches.push(`標題格式修正: ## ${goalHeaderMatch[1]} → **目標**`);
  }

  // 0b. 表格欄位名稱容錯：常見別名 → 標準名稱
  //     「功能描述」→「描述」、「動作類型」→「類型」、「技術名稱」→「技術名」等
  const colAliases = [
    [/\|\s*功能描述\s*\|/, '| 描述 |'],
    [/\|\s*動作類型\s*\|/, '| 類型 |'],
    [/\|\s*技術名稱\s*\|/, '| 技術名 |'],
    [/\|\s*函式簽名\s*\|/, '| 簽名 |'],
    [/\|\s*優先順序\s*\|/, '| 優先級 |'],
    [/\|\s*執行流程\s*\|/, '| 流向 |'],
    [/\|\s*依賴關係\s*\|/, '| 依賴 |'],
    [/\|\s*驗收條件\s*\|/, '| AC |'],
  ];
  for (const [pattern, replacement] of colAliases) {
    if (pattern.test(patched)) {
      patched = patched.replace(pattern, replacement);
      patches.push(`欄位名稱修正: ${pattern.source.replace(/\\s\*/g, ' ').replace(/\\\|/g, '|')} → ${replacement}`);
    }
  }

  // 0c. Story 拆法格式容錯：> Story 1.0 → > Story-1.0（空格改連字號）
  patched = patched.replace(/>\s*Story\s+(\d+\.\d+)/g, (_, v) => {
    patches.push(`Story 格式修正: Story ${v} → Story-${v}`);
    return `> Story-${v}`;
  });

  // 1. 合併子 section 動作到頂層 ## 動作清單
  //    偵測 ## Story-X.Y 或 ## Story X.Y 下的表格行，移到主表格
  const subSectionPattern = /^##\s+Story[-\s]\d+\.\d+.*\n(?:\|[^\n]+\n\|[-|\s]+\n)?((?:\|[^\n]+\n?)+)/gm;
  const subRows = [];
  let subMatch;
  while ((subMatch = subSectionPattern.exec(raw)) !== null) {
    const rows = subMatch[1].split('\n').filter(l => l.startsWith('|'));
    subRows.push(...rows);
  }
  if (subRows.length > 0) {
    // 移除子 section（整個 ## Story-X.Y 區塊）
    patched = patched.replace(/^##\s+Story[-\s]\d+\.\d+[^\n]*\n(?:\|[^\n]+\n\|[-|\s]+\n)?((?:\|[^\n]+\n?)+)/gm, '');
    // 把 subRows 插入主表格末尾
    patched = patched.replace(
      /(##\s*動作清單\s*\n\|[^\n]+\n\|[-|\s]+\n)((?:\|[^\n]+\n?)*)/,
      (_, header, body) => header + body.trimEnd() + '\n' + subRows.join('\n') + '\n'
    );
    patches.push(`合併 ${subRows.length} 個子 section 動作到頂層 ## 動作清單`);
  }

  // 2. UI+ROUTE 複合類型 → 拆成兩行
  const tableLinePattern = /^\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|$/gm;
  let newContent = patched;
  const splitLines = [];
  let splitMatch;
  while ((splitMatch = tableLinePattern.exec(patched)) !== null) {
    const cols = splitMatch.slice(1).map(c => c.trim());
    const typeUpper = cols[1].toUpperCase();
    if (COMPOSITE_SPLITS[typeUpper]) {
      const [t1, t2] = COMPOSITE_SPLITS[typeUpper];
      const line1 = `| ${cols[0]} | ${t1} | ${cols[2]} | ${cols[3]} | ${cols[4]} | ${cols[5]} | ${cols[6]} | ${cols[7]} |`;
      const line2 = `| ${cols[0]} | ${t2} | ${cols[2]} | ${cols[3]} | ${cols[4]} | ${cols[5]} | ${cols[6]} | ${cols[7]} |`;
      newContent = newContent.replace(splitMatch[0], line1 + '\n' + line2);
      splitLines.push(cols[2] || cols[0]);
    }
  }
  if (splitLines.length > 0) {
    patched = newContent;
    patches.push(`拆分複合類型: ${splitLines.join(', ')}`);
  }

  // 3. 補缺少的 ## TDD 測試需求（v7.0）
  const hasTddSection = /##\s*TDD\s*測試需求/.test(patched);
  if (!hasTddSection) {
    // 找 [TDD] 標記動作，補對應提示行
    const tddLines = [];
    const tableM = patched.match(/##\s*動作清單\s*\n\|[^\n]+\n\|[-|\s]+\n((?:\|[^\n]+\n?)+)/);
    if (tableM) {
      const rows = tableM[1].split('\n').filter(l => l.startsWith('|'));
      for (const r of rows) {
        const cols = r.split('|').map(c => c.trim()).filter(Boolean);
        if (cols.length >= 8) {
          const techName = cols[2];
          const tddTag = (cols[7] || '').trim();
          if (/\[TDD\]/i.test(tddTag)) {
            tddLines.push(`- ${techName}: Given / When / Then`);
          }
        }
      }
    }
    const tddComment = tddLines.length > 0
      ? tddLines.join('\n')
      : '<!-- 無 [TDD] action → Phase 2 只跑 tsc --noEmit -->';
    const tddSection = '\n## TDD 測試需求\n\n' + tddComment + '\n';
    // 插在 ## 模組 API 摘要 前，或末尾
    if (/##\s*模組\s*API\s*摘要/.test(patched)) {
      patched = patched.replace(/##\s*模組\s*API\s*摘要/, tddSection + '\n## 模組 API 摘要');
    } else {
      patched = patched.trimEnd() + tddSection;
    }
    patches.push(`補充 ## TDD 測試需求（${tddLines.length} 個 [TDD] action）`);
  }

  // 4. 舊版 ## AC 骨架 → 自動重命名（向後相容）
  if (/##\s*AC\s*骨架/.test(patched)) {
    patched = patched.replace(/##\s*AC\s*骨架/g, '## TDD 測試需求');
    patches.push('## AC 骨架 → ## TDD 測試需求（向後相容重命名）');
  }

  return { patched, patches };
}

// ── Per-iter Draft v5 Parser ──
function parseDraft(raw) {
  const d = {
    iterNum: null, module: '', goal: '', deps: '',
    storyStrategy: '', actions: [], acDefs: [], apiSummary: [],
  };

  const iterM = raw.match(/\*\*迭代\*\*:\s*iter-(\d+)/);
  if (iterM) d.iterNum = parseInt(iterM[1]);
  const modM = raw.match(/\*\*模組\*\*:\s*(.+)/);
  if (modM) d.module = modM[1].trim();
  const goalM = raw.match(/\*\*目標\*\*:\s*(.+)/);
  if (goalM) d.goal = goalM[1].trim();
  const depM = raw.match(/\*\*依賴\*\*:\s*(.+)/);
  if (depM) d.deps = depM[1].trim();

  const storyM = raw.match(/##\s*Story\s*拆法\s*\n+>\s*(.+)/);
  if (storyM) d.storyStrategy = storyM[1].trim();

  const tableM = raw.match(/##\s*動作清單\s*\n\|[^\n]+\n\|[-|\s]+\n((?:\|[^\n]+\n?)+)/);
  if (tableM) {
    const rows = tableM[1].split('\n').filter(l => l.startsWith('|'));
    for (const r of rows) {
      const cols = r.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 8) {
        d.actions.push({
          desc: cols[0], type: cols[1], techName: cols[2],
          signature: cols[3], priority: cols[4], flow: cols[5],
          deps: cols[6], ac: cols[7],
        });
      }
    }
  }

  // v7.0: TDD 測試需求 section 的行（Given/When/Then 格式）
  const tddSection = raw.match(/##\s*TDD\s*測試需求\s*\n([\s\S]*?)(?=\n##|$)/);
  if (tddSection) {
    const tddLines = tddSection[1].split('\n').filter(l => /^\s*-\s/.test(l) && !/<!--/.test(l));
    for (const line of tddLines) {
      const m = line.match(/^\s*-\s*(\w+):\s*(.+)/);
      if (m) {
        d.acDefs.push({ id: m[1], tag: 'TDD', techName: m[1], gwt: m[2].trim() });
      }
    }
  }

  const apiSection = raw.match(/##\s*模組\s*API\s*摘要\s*\n([\s\S]*?)(?=\n##|$)/);
  if (apiSection) {
    d.apiSummary = apiSection[1].split('\n').filter(l => /^\s*-\s/.test(l)).map(l => l.replace(/^\s*-\s*/, '').trim());
  }

  return d;
}

// ── Gate checks（只驗大項結構，不驗語意）──
/** GEMS: checkDraft | P0 | validateSections(Pure)→checkEntities(Pure)→checkStories(Pure)→RETURN:GateResult | Story-2.0 */
function checkDraft(d, raw, blueprint) {
  const blockers = [];
  const guided = []; // 語意問題 → 具體指引，不 BLOCK
  const B = (code, msg) => blockers.push({ code, msg });
  const G = (code, msg) => guided.push({ code, msg });

  // 判斷是否為 Foundation iter（iter-1 或 Story 全為 X.0）
  // Foundation iter 豁免 UI 強制檢查
  const isFoundationIter = d.iterNum === 1 ||
    d.actions.every(a => /^Story-\d+\.0$/.test(a.storyId || '') || !a.storyId);

  // 大項 1: Header metadata
  if (!d.iterNum) B('DR-001', '缺少 **迭代**: iter-N');
  if (!d.module)  B('DR-001', '缺少 **模組**: moduleName');
  if (!d.goal || d.goal.length < 5) B('DR-001', '缺少 **目標** 或過短');

  // 大項 2: 動作清單存在
  if (d.actions.length === 0) {
    B('DR-003', '缺少「## 動作清單」表格（8 欄）');
    return { blockers, guided }; // 後續無意義
  }

  // 大項 3: 動作數上限（>10 才 BLOCK，拆 Story）
  if (d.actions.length > 10)
    B('DR-004', `動作清單有 ${d.actions.length} 個動作，超過上限 10，請拆 Story`);

  // 大項 4: 每個動作的必填欄位（純格式）
  const acRefs = new Set();
  for (const item of d.actions) {
    const prefix = `[${item.techName || '?'}]`;
    if (!item.techName || item.techName.trim() === '')
      B('DR-010', `${prefix} 缺少技術名稱`);
    const t = (item.type || '').toUpperCase();
    if (!VALID_TYPES.has(t))
      B('DR-011', `${prefix} 類型 "${item.type}" 無效，合法值: ${[...VALID_TYPES].join('/')}`);
    if (!/^P[0-3]$/.test(item.priority || ''))
      B('DR-012', `${prefix} 優先級格式錯誤: "${item.priority}"（應為 P0-P3）`);
    if (!item.flow || item.flow.trim() === '')
      B('DR-013', `${prefix} 缺少流向（flow），用 → 分隔步驟`);
    const p = (item.priority || '').toUpperCase();
    const tddTag = (item.ac || '').trim();
    if ((p === 'P0' || p === 'P1') && (!tddTag || tddTag === '-' || tddTag === '無'))
      B('DR-016', `${prefix} P0/P1 動作缺少 TDD 欄位（應填 [TDD] / [DB] / [UI]）`);
    // v7.0: TDD 欄位不再有 AC-X.Y 引用，跳過 acRefs 收集
  }

  // 大項 5: TDD 測試需求 section 存在（auto-patch 已補，v7.0 不再驗 AC 引用）
  // 只確認 section 本身存在（已由 auto-patch 處理，這裡不 BLOCK）

  // 大項 6: Placeholder 未替換
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
    B('DR-030', `發現未替換佔位符: ${[...placeholders].slice(0, 5).join(', ')}`);

  // @GUIDED: 語意問題（不 BLOCK，給具體指引）
  // TDD 測試需求有定義但缺 Given/When/Then → 指引補齊
  for (const tdd of d.acDefs) {
    if (!tdd.gwt || (!tdd.gwt.includes('Given') && !tdd.gwt.includes('When')))
      G('DR-G01', `${tdd.techName} TDD 測試需求缺少 Given/When/Then，格式: Given <前提> / When <操作> / Then <可觀察結果（具體值）>`);
  }

  // @GUIDED: Foundation iter 提示（不 BLOCK）
  if (isFoundationIter) {
    // Foundation iter 不強制要求 UI 動作，但給引導
    const hasUi = d.actions.some(a => ['UI', 'ROUTE'].includes((a.type || '').toUpperCase()));
    if (!hasUi) {
      G('DR-G04', `Foundation iter（iter-${d.iterNum}）不強制 UI 動作。若此 iter 為純後端/基礎建設，這是正常的。iter-2+ 的 Feature Story 才需要完整垂直切片（SVC+ROUTE+UI）`);
    }
  }

  // @GUIDED: Blueprint 交叉驗證（有 --blueprint 時）
  if (blueprint) {
    try {
      const { parseBlueprint } = require('./blueprint-gate.cjs');
      const bp = parseBlueprint(fs.readFileSync(blueprint, 'utf8'));
      const planEntry = bp.iterationPlan.find(e => e.iter === d.iterNum);
      if (!planEntry)
        G('DR-G02', `iter-${d.iterNum} 不在 Blueprint 迭代規劃表中，確認 iter 編號是否正確`);
      else if (planEntry.module.toLowerCase() !== d.module.toLowerCase())
        G('DR-G03', `Draft 模組 "${d.module}" 與 Blueprint 規劃表 "${planEntry.module}" 不一致，請統一命名`);
    } catch (e) { /* blueprint-gate 不存在時跳過 */ }
  }

  return { blockers, guided };
}

// ── Gold template hints per error code ──
function getDraftFixHint(code) {
  const hints = {
    'DR-001': `**迭代**: iter-1\n**模組**: ModuleName\n**目標**: 一句話說明本迭代要完成什麼`,
    'DR-003': `## 動作清單\n| 描述 | 類型 | 技術名 | 簽名 | 優先級 | 流向 | 依賴 | TDD |\n|------|------|--------|------|--------|------|------|-----|\n| 建立班級 | SVC | createClass | (data)→Class | P1 | VALIDATE→INSERT→RETURN | - | [DB] |`,
    'DR-010': `技術名 = camelCase 函式名，例如: createClass, parseCSV`,
    'DR-011': `合法類型: CONST / LIB / API / SVC / HOOK / UI / ROUTE / SCRIPT / CALC / CREATE / READ / MODIFY / DELETE`,
    'DR-012': `優先級格式: P0 / P1 / P2 / P3`,
    'DR-013': `流向格式: STEP1→STEP2→STEP3，例如: VALIDATE→INSERT→RETURN`,
    'DR-016': `P0/P1 動作必須有 TDD 欄位，填 [TDD]（純計算）/ [DB]（資料庫操作）/ [UI]（前端元件）`,
    'DR-020': `## TDD 測試需求\n- createClass: Given 有效資料 / When 呼叫 createClass / Then 回傳含 id 的新建物件`,
  };
  return hints[code] || null;
}

// ── Main ──
function main() {
  const args = parseArgs();
  if (args.help) {
    console.log(`
Draft Gate v5.1 — Per-iter Draft 格式門控（機械化）

用法:
  node sdid-tools/blueprint/v5/draft-gate.cjs --draft=<path> [--blueprint=<path>] [--target=<project>]

格式問題 → auto-patch（靜默修正）
語意問題 → @GUIDED（具體指引，不 BLOCK）
結構缺失 → @BLOCKER

輸出: @PASS 或 @BLOCKER
`);
    process.exit(0);
  }

  if (!args.draft) {
    console.log('@BLOCKER | draft-gate v5.1 | 需要 --draft=<path> 參數');
    process.exit(1);
  }
  if (!fs.existsSync(args.draft)) {
    console.log(`@BLOCKER | draft-gate v5.1 | 檔案不存在: ${args.draft}`);
    process.exit(1);
  }

  let raw = fs.readFileSync(args.draft, 'utf8');

  // Auto-patch（靜默修正格式問題）
  const { patched, patches } = autoPatch(raw);
  if (patches.length > 0) {
    fs.writeFileSync(args.draft, patched, 'utf8');
    raw = patched;
  }

  const d = parseDraft(raw);
  const { blockers, guided } = checkDraft(d, raw, args.blueprint);
  const passed = blockers.length === 0;

  const relDraft = path.relative(process.cwd(), args.draft);
  const relTarget = args.target ? path.relative(process.cwd(), args.target) || '.' : null;
  const iterNum = d.iterNum || 1;
  const contractPath = relTarget
    ? `${relTarget}/.gems/iterations/iter-${iterNum}/contract_iter-${iterNum}.ts`
    : `<project>/.gems/iterations/iter-${iterNum}/contract_iter-${iterNum}.ts`;
  const nextContractCmd = `node sdid-tools/blueprint/v5/contract-gate.cjs --contract=${contractPath}${relTarget ? ' --target=' + relTarget : ''} --iter=${iterNum}`;
  const retryCmd = `node sdid-tools/blueprint/v5/draft-gate.cjs --draft=${relDraft}${args.blueprint ? ' --blueprint=' + path.relative(process.cwd(), args.blueprint) : ''}${relTarget ? ' --target=' + relTarget : ''}`;

  // Log 存檔
  let logPath = null;
  if (args.target) {
    const logsDir = path.join(args.target, '.gems', 'iterations', `iter-${iterNum}`, 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const status = passed ? 'pass' : 'error';
    const logFile = path.join(logsDir, `draft-gate-${status}-${ts}.log`);
    const logLines = [
      `=== SIGNAL ===`,
      passed ? `@PASS | draft-gate v5.1` : `@BLOCKER | draft-gate v5.1`,
      ``,
      `=== TARGET ===`,
      `FILE: ${relDraft}`,
      `Iter: ${iterNum} | Module: ${d.module} | Actions: ${d.actions.length} | ACs: ${d.acDefs.length}`,
      ``,
    ];
    if (patches.length > 0) {
      logLines.push(`=== AUTO-PATCH ===`);
      patches.forEach(p => logLines.push(`  ✅ ${p}`));
      logLines.push(``);
    }
    if (!passed) {
      logLines.push(`=== BLOCKERS ===`);
      blockers.forEach((b, i) => {
        logLines.push(`@TASK-${i+1}`);
        logLines.push(`  ACTION: FIX_DRAFT`);
        logLines.push(`  FILE: ${relDraft}`);
        logLines.push(`  EXPECTED: [${b.code}] ${b.msg}`);
        const hint = getDraftFixHint(b.code);
        if (hint) logLines.push(`  HINT:\n${hint.split('\n').map(l => '    ' + l).join('\n')}`);
        logLines.push(``);
      });
    }
    if (guided.length > 0) {
      logLines.push(`=== GUIDED ===`);
      guided.forEach(g => logLines.push(`  @GUIDED [${g.code}] ${g.msg}`));
      logLines.push(``);
    }
    logLines.push(`=== NEXT ===`, passed ? nextContractCmd : retryCmd, ``);
    logLines.push(`=== GUARD ===`, `🚫 禁止修改 task-pipe/ sdid-tools/ | ✅ 只能修改 ${relDraft}`);
    fs.writeFileSync(logFile, logLines.join('\n'), 'utf8');
    logPath = path.relative(args.target, logFile);
  }

  // 終端輸出
  console.log('');
  if (passed) {
    console.log(`@PASS | draft-gate v5.1 | iter-${iterNum} ${d.module} | ${d.actions.length} 動作, ${d.acDefs.length} AC`);
    if (patches.length > 0) {
      patches.forEach(p => console.log(`  ✅ auto-patch: ${p}`));
    }
    if (guided.length > 0) {
      console.log('');
      guided.forEach(g => console.log(`  @GUIDED [${g.code}] ${g.msg}`));
    }
    console.log('');
    // 偵測 poc.html 是否存在
    const pocHtmlDir = args.target ? path.join(args.target, '.gems', 'iterations', `iter-${iterNum}`, 'poc') : null;
    let pocHtmlPath = null;
    let pocHtmlExists = false;
    if (pocHtmlDir && fs.existsSync(pocHtmlDir)) {
      const htmlFiles = fs.readdirSync(pocHtmlDir).filter(f => f.endsWith('.html') || f.endsWith('POC.html'));
      if (htmlFiles.length > 0) {
        pocHtmlExists = true;
        pocHtmlPath = relTarget
          ? `${relTarget}/.gems/iterations/iter-${iterNum}/poc/${htmlFiles[0]}`
          : `.gems/iterations/iter-${iterNum}/poc/${htmlFiles[0]}`;
      }
    }
    const pocHtmlTarget = pocHtmlPath || (relTarget
      ? `${relTarget}/.gems/iterations/iter-${iterNum}/poc/${d.module}POC.html`
      : `.gems/iterations/iter-${iterNum}/poc/${d.module}POC.html`);

    console.log(`@CONTEXT_SCOPE`);
    console.log(`  Draft: ${relDraft}`);
    console.log(`  Module: ${d.module} | Actions: ${d.actions.length} | P0/P1 ACs: ${d.acDefs.filter(a => a.tag !== 'SKIP').length}`);
    console.log(`  Action types: ${[...new Set(d.actions.map(a => a.type))].join(', ')}`);
    console.log(`  POC HTML: ${pocHtmlExists ? `✅ ${pocHtmlPath}` : `❌ 尚未產出`}`);
    console.log('');
    const pocGateCmd = `node sdid-tools/blueprint/v5/poc-gate.cjs --poc=${pocHtmlTarget}${relTarget ? ' --target=' + relTarget : ''} --iter=${iterNum}`;
    if (!pocHtmlExists) {
      console.log(`@TASK-1`);
      console.log(`  ACTION: WRITE_POC_HTML`);
      console.log(`  FILE: ${pocHtmlTarget}`);
      console.log(`  EXPECTED: 產出互動式 POC HTML，包含 @GEMS-VERIFIED 標籤標註已/未實作功能`);
      console.log(`  REFERENCE: task-pipe/templates/examples/poc-golden.html`);
      console.log('');
      console.log(`@TASK-2`);
      console.log(`  ACTION: WRITE_CONTRACT`);
      console.log(`  FILE: ${contractPath}`);
      console.log(`  EXPECTED: 從 draft 推導 contract_iter-${iterNum}.ts（@GEMS-CONTRACT + @GEMS-API + @GEMS-STORY: + @GEMS-TDD 路徑）`);
      console.log(`  REFERENCE: task-pipe/templates/contract-golden.template.v3.ts`);
      console.log(`  EXAMPLE: task-pipe/templates/examples/contract-iter-1-ecotrack.example.v3.ts`);
      console.log('');
      console.log(`NEXT (poc 完成後): ${pocGateCmd}`);
      console.log(`NEXT (跳過 poc):   ${nextContractCmd}`);
    } else {
      console.log(`@TASK`);
      console.log(`  ACTION: WRITE_CONTRACT`);
      console.log(`  FILE: ${contractPath}`);
      console.log(`  EXPECTED: 從 draft + poc @GEMS-VERIFIED 推導 contract_iter-${iterNum}.ts`);
      console.log(`  REFERENCE: task-pipe/templates/contract-golden.template.v3.ts`);
      console.log(`  EXAMPLE: task-pipe/templates/examples/contract-iter-1-ecotrack.example.v3.ts`);
      console.log('');
      console.log(`NEXT (驗證 poc): ${pocGateCmd}`);
      console.log(`NEXT (跳過 poc): ${nextContractCmd}`);
    }
  } else {
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`@BLOCKER | draft-gate v5.1 | ${blockers.length} item(s) to fix`);
    console.log(`@CONTEXT: Draft iter-${iterNum} ${d.module} | ${relDraft}`);
    if (patches.length > 0) {
      patches.forEach(p => console.log(`  ✅ auto-patch: ${p}`));
    }
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log('');
    blockers.forEach((b, i) => {
      console.log(`@TASK-${i+1}`);
      console.log(`  ACTION: FIX_DRAFT`);
      console.log(`  FILE: ${relDraft}`);
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
    blockers.forEach(b => console.log(`  - FIX [${b.code}] ${relDraft}`));
    console.log(`  NEXT: ${retryCmd}`);
    console.log('');
    if (logPath) console.log(`@READ: ${logPath}`);
    console.log(`@GUARD: 🚫 task-pipe/ sdid-tools/ | ✅ ${relDraft}`);
    console.log(`═══════════════════════════════════════════════════════════`);
  }

  process.exit(passed ? 0 : 1);
}

module.exports = { parseDraft, checkDraft, autoPatch };
if (require.main === module) main();
