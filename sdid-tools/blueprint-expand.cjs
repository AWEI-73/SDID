#!/usr/bin/env node
/**
 * Blueprint Expand v2.0 - Stub 展開器 (搬運模式)
 * 
 * v2.0 變更: 不再「推導」動作清單，改為從 STUB 的函式 flow 清單「搬運」。
 * STUB 必須已包含函式 flow 清單 + AC 骨架 (由 Gem Architect 在對話時填入)。
 * 如果 STUB 沒有 flow 清單，報 BLOCKER 要求先補。
 * 
 * 進入新 iter 時，將 Stub 的函式 flow 清單格式化為完整動作表格。
 * 
 * 獨立工具，不 import task-pipe。
 * 
 * 用法:
 *   node sdid-tools/blueprint-expand.cjs --draft=<path> --iter=2 --target=<project>
 *   node sdid-tools/blueprint-expand.cjs --draft=<path> --iter=2 --target=<project> --dry-run
 * 
 * 輸出:
 *   更新後的活藍圖 (Stub 函式 flow 清單 → 完整動作表格 + 狀態欄位)
 */

const fs = require('fs');
const path = require('path');
const parser = require('./lib/draft-parser-standalone.cjs');
const logOutput = require('../task-pipe/lib/shared/log-output.cjs');

// ============================================
// 參數解析
// ============================================
function parseArgs() {
  const args = { draft: null, iter: 2, target: null, out: null, dryRun: false, help: false };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--draft=')) args.draft = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--iter=')) args.iter = parseInt(arg.split('=')[1]);
    else if (arg.startsWith('--target=')) args.target = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--out=')) args.out = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

// ============================================
// Fillback Suggestions 讀取
// ============================================

/**
 * 從前一個 iter 的 Fillback 讀取建議
 */
function loadPreviousFillback(projectRoot, currentIter) {
  const prevIter = currentIter - 1;
  if (prevIter < 1) return [];

  const buildDir = path.join(projectRoot, '.gems', 'iterations', `iter-${prevIter}`, 'build');
  if (!fs.existsSync(buildDir)) return [];

  const files = fs.readdirSync(buildDir)
    .filter(f => f.startsWith('iteration_suggestions_') && f.endsWith('.json'));

  const allSuggestions = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(buildDir, file), 'utf8');
      const data = JSON.parse(content);
      if (Array.isArray(data)) allSuggestions.push(...data);
      else if (data.suggestions) allSuggestions.push(...data.suggestions);
      else if (data.items) allSuggestions.push(...data.items);
    } catch (e) { /* ignore */ }
  }

  return allSuggestions;
}

// ============================================
// Stub Flow 清單解析
// ============================================

/**
 * 從 STUB 區塊解析函式 flow 清單
 * 格式: | 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | AC |
 */
function parseStubFlowTable(stubBlock) {
  const lines = stubBlock.split('\n');
  const actions = [];
  let inTable = false;
  let headerParsed = false;

  for (const line of lines) {
    const trimmed = line.trim();
    // 偵測表格開始
    if (trimmed.startsWith('| 業務語意') || trimmed.startsWith('| 業務語意')) {
      inTable = true;
      headerParsed = false;
      continue;
    }
    if (!inTable) continue;
    // 跳過分隔行
    if (/^\|[-| ]+\|$/.test(trimmed)) {
      headerParsed = true;
      continue;
    }
    // 結束表格
    if (!trimmed.startsWith('|')) {
      inTable = false;
      continue;
    }
    if (!headerParsed) continue;

    // 解析行
    const cols = trimmed.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
    if (cols.length >= 6) {
      actions.push({
        semantic: cols[0],
        type: cols[1],
        techName: cols[2],
        priority: cols[3],
        flow: cols[4],
        deps: cols[5],
        ac: cols[6] || '-',
        status: '○○',
      });
    }
  }

  return actions;
}

/**
 * 從 STUB 區塊解析 AC 骨架
 * 格式: **AC-X.Y** — 描述 \n Given/When/Then
 */
function parseStubACs(stubBlock) {
  const acBlocks = [];
  const lines = stubBlock.split('\n');
  let current = null;

  for (const line of lines) {
    const acMatch = line.match(/^\*\*(AC-[\d.]+)\*\*\s*[—-]\s*(.+)/);
    if (acMatch) {
      if (current) acBlocks.push(current);
      current = { id: acMatch[1], title: acMatch[2], lines: [line] };
    } else if (current) {
      if (line.trim() === '' && current.lines.length > 3) {
        acBlocks.push(current);
        current = null;
      } else {
        current.lines.push(line);
      }
    }
  }
  if (current) acBlocks.push(current);

  return acBlocks;
}

/**
 * 找到 STUB 區塊的原始內容
 */
function findStubBlock(lines, iterNum, modName) {
  const stubPatterns = [
    new RegExp(`^###\\s+Iter\\s+${iterNum}:\\s*${escapeRegex(modName)}\\s*\\[STUB\\]`, 'i'),
    new RegExp(`^###\\s+Iter\\s+${iterNum}:\\s*${escapeRegex(modName)}(?:\\s|$)`, 'i'),
  ];

  let headerIdx = -1;
  for (const pattern of stubPatterns) {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) { headerIdx = i; break; }
    }
    if (headerIdx >= 0) break;
  }

  if (headerIdx < 0) return { headerIdx: -1, endIdx: -1, block: '' };

  let endIdx = lines.length;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (/^###\s/.test(lines[i]) || /^---$/.test(lines[i].trim()) || /^##\s/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }

  return {
    headerIdx,
    endIdx,
    block: lines.slice(headerIdx, endIdx).join('\n'),
  };
}

// ============================================
// 藍圖展開邏輯 (v2.0 搬運模式)
// ============================================

/**
 * 生成展開後的完整動作表格 Markdown
 */
function generateExpandedSection(moduleName, iterNum, actions, acBlocks, storyLabel) {
  const lines = [];
  lines.push(`### Iter ${iterNum}: ${moduleName} [CURRENT]`);
  lines.push('');
  lines.push(`> Story 拆法: ${storyLabel}`);
  lines.push('');
  lines.push('| 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | 操作 | 狀態 | AC |');
  lines.push('|---------|------|---------|---|------|------|------|------|----|');

  for (const a of actions) {
    lines.push(`| ${a.semantic} | ${a.type} | ${a.techName} | ${a.priority} | ${a.flow} | ${a.deps} | NEW | ${a.status} | ${a.ac} |`);
  }

  // 搬運 AC 骨架
  if (acBlocks.length > 0) {
    lines.push('');
    for (const ac of acBlocks) {
      lines.push(...ac.lines);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * 在原始 Markdown 中執行展開 (v2.0 搬運模式)
 */
function expandBlueprint(rawContent, draft, iterNum, projectRoot) {
  const changes = [];
  let result = rawContent;

  const targetModules = draft.iterationPlan.filter(e => e.iter === iterNum);

  if (targetModules.length === 0) {
    return { content: result, changes: [{ module: '(none)', status: 'SKIP', reason: `iter-${iterNum} 不在迭代規劃表中` }] };
  }

  // 展開 targetModules，支援逗號分隔的多模組欄位
  const expandedEntries = [];
  for (const entry of targetModules) {
    const modNames = entry.module.split(',').map(m => m.trim()).filter(Boolean);
    for (const m of modNames) {
      expandedEntries.push(Object.assign({}, entry, { module: m }));
    }
  }

  for (const entry of expandedEntries) {
    const modName = entry.module;
    const lines = result.split('\n');
    const { headerIdx, endIdx, block } = findStubBlock(lines, iterNum, modName);

    if (headerIdx < 0) {
      changes.push({ module: modName, status: 'SKIP', reason: `找不到 iter-${iterNum} 的 STUB 區塊` });
      continue;
    }

    // 解析 STUB 的函式 flow 清單
    const actions = parseStubFlowTable(block);

    if (actions.length === 0) {
      // BLOCKER: STUB 沒有函式 flow 清單
      changes.push({
        module: modName,
        status: 'BLOCKER',
        reason: `STUB 沒有函式 flow 清單 — 請先用 Gem Architect 補充 iter-${iterNum} 的函式 flow 清單 + AC 骨架`,
      });
      continue;
    }

    // 解析 AC 骨架
    const acBlocks = parseStubACs(block);

    // 取得 Story 拆法描述
    const storyLabel = block.match(/Story 拆法[：:]\s*(.+)/)?.[1] || 'Story-0 後端 (SVC/API), Story-1 前端串接 (UI/ROUTE)';

    // 生成展開後的 Markdown
    const expandedSection = generateExpandedSection(modName, iterNum, actions, acBlocks, storyLabel);

    // 替換
    const newLines = [...lines.slice(0, headerIdx), expandedSection, '', ...lines.slice(endIdx)];
    result = newLines.join('\n');

    changes.push({
      module: modName,
      status: 'EXPANDED',
      actionCount: actions.length,
      acCount: acBlocks.length,
    });
  }

  // 更新迭代規劃表: [STUB] → [CURRENT]
  const planLines = result.split('\n');
  let promoted = false;
  for (let i = 0; i < planLines.length; i++) {
    if (planLines[i].includes('[STUB]') && planLines[i].includes(`| ${iterNum} `) && !promoted) {
      planLines[i] = planLines[i].replace('[STUB]', '[CURRENT]');
      promoted = true;
    }
  }
  result = planLines.join('\n');

  return { content: result, changes };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================
// 主程式
// ============================================
function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
Blueprint Expand v1.0 - Stub 展開器

用法:
  node sdid-tools/blueprint-expand.cjs --draft=<path> --iter=2 --target=<project>

選項:
  --draft=<path>    活藍圖路徑 (必填)
  --iter=<N>        要展開的迭代編號 (必填)
  --target=<path>   專案根目錄 (用於讀取 Fillback suggestions)
  --out=<path>      輸出路徑 (預設: 覆寫原檔)
  --dry-run         預覽模式，不寫入檔案
  --help            顯示此訊息

展開來源:
  1. 公開 API (模組定義中的 API 簽名)
  2. Fillback suggestions (前一迭代的建議)
  3. 模組依賴推導 (自動生成 types 動作)

注意:
  展開後的動作清單是骨架，建議用 Gem chatbot 確認並補充 flow 細節。
`);
    process.exit(0);
  }

  if (!args.draft) {
    logOutput.anchorErrorSpec({
      targetFile: 'CLI 參數',
      missing: ['--draft'],
      example: `node sdid-tools/blueprint-expand.cjs --draft=<project>/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md --iter=2 --target=<project>`,
      nextCmd: 'node sdid-tools/blueprint-expand.cjs --draft=<path> --iter=N --target=<project>',
      gateSpec: {
        checks: [
          { name: '--draft 參數', pattern: '活藍圖路徑', desc: '必須指定 --draft=<path>' },
          { name: '藍圖可解析', pattern: 'parser.parse()', desc: '藍圖格式必須正確' },
          { name: 'iter 有 Stub', pattern: 'fillLevel === stub', desc: '目標 iter 必須有 [STUB] 模組可展開' },
          { name: '前一 iter 已收縮', pattern: 'gate-shrink-pass', desc: '前一 iter 的 Shrink 已完成' },
        ]
      }
    });
    process.exit(1);
  }

  let rawContent, draft;
  try {
    rawContent = fs.readFileSync(args.draft, 'utf8');
    draft = parser.parse(rawContent);
  } catch (err) {
    logOutput.anchorError('BLOCKER',
      `藍圖讀取/解析失敗: ${err.message}`,
      `確認藍圖路徑正確且格式有效: ${args.draft}`,
      {
        projectRoot: args.target || null,
        iteration: args.iter,
        phase: 'gate',
        step: 'expand',
        details: `解析錯誤: ${err.message}`,
      }
    );
    process.exit(1);
  }

  console.log(`\n📐 Blueprint Expand v1.0`);
  console.log(`   藍圖: ${path.basename(args.draft)}`);
  console.log(`   展開 iter: ${args.iter}`);
  if (args.target) console.log(`   專案: ${path.basename(args.target)}`);
  console.log('');

  // 若目前 draft 的 iterationPlan 找不到目標 iter，往前找最近的完整 draft 補充
  // 場景：generateNextIteration 生成的簡化 draft 不含 iterationPlan，需從前一個 draft 讀取
  if (args.target && draft.iterationPlan.filter(e => e.iter === args.iter).length === 0) {
    for (let prevN = args.iter - 1; prevN >= 1; prevN--) {
      const prevDraftPath = path.join(
        args.target, '.gems', 'iterations', `iter-${prevN}`, 'poc',
        `requirement_draft_iter-${prevN}.md`
      );
      if (fs.existsSync(prevDraftPath)) {
        try {
          const prevRaw = fs.readFileSync(prevDraftPath, 'utf8');
          const prevDraft = parser.parse(prevRaw);
          if (prevDraft.iterationPlan.filter(e => e.iter === args.iter).length > 0) {
            console.log(`   ℹ️  iterationPlan 從 iter-${prevN} draft 補充（目前 draft 無 iter-${args.iter} 規劃）`);
            // 合併：用前一 draft 的 iterationPlan + modules 補齊，但保留目前 draft 的 rawContent 用於寫入
            draft.iterationPlan = prevDraft.iterationPlan;
            draft.modules = Object.assign({}, prevDraft.modules, draft.modules);
            break;
          }
        } catch (e) { /* ignore parse errors */ }
      }
    }
  }

  // 執行展開
  const { content, changes } = expandBlueprint(rawContent, draft, args.iter, args.target);

  // 報告
  const expandedCount = changes.filter(c => c.status === 'EXPANDED').length;
  const blockerCount = changes.filter(c => c.status === 'BLOCKER').length;
  const skipCount = changes.filter(c => c.status === 'SKIP').length;

  for (const change of changes) {
    if (change.status === 'EXPANDED') {
      console.log(`   ✅ ${change.module} → ${change.actionCount} 個動作, ${change.acCount} 個 AC`);
    } else if (change.status === 'BLOCKER') {
      console.log(`   🔴 ${change.module} — BLOCKER: ${change.reason}`);
    } else if (change.status === 'SKIP') {
      console.log(`   ⏭️ ${change.module} — ${change.reason}`);
    }
  }

  console.log(`\n📊 結果: ${expandedCount} 模組展開, ${blockerCount} BLOCKER, ${skipCount} 跳過`);

  if (blockerCount > 0) {
    const blockers = changes.filter(c => c.status === 'BLOCKER');
    const logProjectRoot = args.target || null;
    const details = blockers.map(b => `🔴 ${b.module}: ${b.reason}`).join('\n');
    if (logProjectRoot) {
      logOutput.anchorError('TACTICAL_FIX',
        `iter-${args.iter} 有 ${blockerCount} 個模組缺少函式 flow 清單`,
        `用 Gem Architect 補充 STUB 的函式 flow 清單 + AC 骨架後再執行 expand`,
        {
          projectRoot: logProjectRoot,
          iteration: args.iter,
          phase: 'gate',
          step: 'expand',
          details: `BLOCKER 詳情:\n${details}\n\n修復方式:\n在藍圖的 STUB 區塊加入「函式 Flow 清單」表格，格式:\n| 業務語意 | 類型 | 技術名稱 | P | 流向 | 依賴 | AC |\n每個公開 API 函式一行，flow 3-7 步。`,
        }
      );
    } else {
      console.log(`\n@BLOCKER | STUB 缺少函式 flow 清單`);
      console.log(details);
    }
    process.exit(1);
  }

  if (expandedCount === 0) {
    const logProjectRoot = args.target || null;
    if (logProjectRoot) {
      logOutput.anchorError('TACTICAL_FIX',
        `iter-${args.iter} 沒有模組被展開 — 可能沒有 [STUB] 或已展開`,
        `確認藍圖中 iter-${args.iter} 有 [STUB] 標記的模組`,
        {
          projectRoot: logProjectRoot,
          iteration: args.iter,
          phase: 'gate',
          step: 'expand',
          details: `展開結果:\n${changes.map(c => `${c.module}: ${c.status} — ${c.reason || ''}`).join('\n')}`,
        }
      );
    } else {
      console.log(`\n⚠️ 沒有模組被展開 — iter-${args.iter} 可能沒有 Stub 或已展開`);
    }
    process.exit(0);
  }

  // 寫入
  const outPath = args.out || args.draft;
  if (args.dryRun) {
    console.log(`\n[dry-run] 不寫入檔案`);
    console.log(`[dry-run] 展開後藍圖預覽 (前 50 行):`);
    content.split('\n').slice(0, 50).forEach(l => console.log(`  ${l}`));
  } else {
    fs.writeFileSync(outPath, content, 'utf8');
    console.log(`\n✅ 藍圖已更新: ${path.relative(process.cwd(), outPath)}`);

    // 複製活藍圖快照到 iter-N/poc/requirement_draft_iter-N.md
    // 讓 detectRoute / findDraft 能正確識別 iter-N 為 Blueprint 路線
    if (args.target) {
      const snapPocDir = path.join(args.target, '.gems', 'iterations', `iter-${args.iter}`, 'poc');
      const snapDraftPath = path.join(snapPocDir, `requirement_draft_iter-${args.iter}.md`);
      if (!fs.existsSync(snapDraftPath)) {
        fs.mkdirSync(snapPocDir, { recursive: true });
        fs.copyFileSync(outPath, snapDraftPath);
        console.log(`✅ iter-${args.iter} 快照: ${path.relative(process.cwd(), snapDraftPath)}`);
        console.log(`   ⚠️  請在快照中補充 iter-${args.iter} 的契約細節後再跑 gate`);
      } else {
        console.log(`   ℹ️  iter-${args.iter} 快照已存在，跳過複製`);
      }
    }
  }

  // log 存檔
  const logProjectRoot = args.target || null;
  if (logProjectRoot) {
    const details = changes.map(c => {
      if (c.status === 'EXPANDED') {
        return `✅ ${c.module} → ${c.actionCount} 個動作, ${c.acCount || 0} 個 AC`;
      }
      return `⏭️ ${c.module} — ${c.reason}`;
    }).join('\n');

    const nextCmd = `node sdid-tools/blueprint-gate.cjs --draft=${args.draft} --iter=${args.iter}`;
    logOutput.anchorPass('gate', 'expand',
      `Blueprint Expand 完成 — iter-${args.iter} 已展開 (${expandedCount} 模組)`,
      nextCmd,
      { projectRoot: logProjectRoot, iteration: args.iter, phase: 'gate', step: 'expand', details });
  } else {
    console.log(`\n@PASS | Blueprint Expand 完成 — iter-${args.iter} 已展開`);
    console.log(`下一步: node sdid-tools/blueprint-gate.cjs --draft=${args.draft} --iter=${args.iter}`);
    console.log(`        (驗證展開後的藍圖品質，然後用 Gem chatbot 補充 flow 細節)`);
  }
}

// ============================================
// 導出
// ============================================
module.exports = {
  expandBlueprint,
  loadPreviousFillback,
  parseStubFlowTable,
  parseStubACs,
  findStubBlock,
  generateExpandedSection,
};

if (require.main === module) {
  main();
}
