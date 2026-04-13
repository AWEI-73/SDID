#!/usr/bin/env node
/**
 * REVIEW Phase: 專案健康度 + 下一步方向
 *
 * 在 SCAN 後執行，讀取：
 *   - .gems/docs/functions.json    → 標籤健康、流程複雜度、@TEST 覆蓋
 *   - .gems/design/blueprint.md   → 技術債、下一 iter 規劃
 *   - .gems/iterations/iter-N/contract_iter-N.ts → 目前 iter 未覆蓋的 @TEST
 *
 * 輸出：
 *   - Console: 結構化 dispatch 報告（人 + AI 都能讀）
 *   - .gems/docs/project-review.json（供 AI subagent 消費）
 *   - .gems/iterations/iter-N/logs/review-pass-*.log
 *
 * 用法：
 *   node task-pipe/runner.cjs --phase=REVIEW --target=<project>
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { emitPass } = require('../../lib/shared/log-output.cjs');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');

/** GEMS: reviewPhase | P1 | loadHealth(IO)→loadDebt(IO)→buildDispatch(Pure)→emit(IO) | Story-7.0 */
function run(options) {
  const { target, iteration } = options;
  const relativeTarget = path.relative(process.cwd(), target) || '.';

  console.log(getSimpleHeader('REVIEW', 'Project Health'));

  const gemsPath = path.join(target, '.gems');
  const docsPath = path.join(gemsPath, 'docs');

  // iteration 自動偵測（如果沒傳）
  const activeIter = iteration || detectActiveIter(gemsPath);
  const iterNum = activeIter.replace('iter-', '');
  const iterPath = path.join(gemsPath, 'iterations', activeIter);
  const logsDir = path.join(iterPath, 'logs');

  console.log(`\n📋 專案健康回顧 | ${activeIter}\n`);

  // ── 1. 讀 functions.json ──────────────────────────────────────────────────
  const health = loadFunctionsHealth(docsPath);

  // ── 2. 讀 blueprint.md 技術債 ──────────────────────────────────────────────
  const debt = loadBlueprintDebt(target);

  // ── 3. 讀 contract 找未覆蓋的 @TEST ────────────────────────────────────────
  const contractGaps = loadContractGaps(target, activeIter, iterNum);

  // ── 4. 組 dispatch 清單 ────────────────────────────────────────────────────
  const dispatch = buildDispatch(health, debt, contractGaps, target, activeIter);

  // ── 5. 印出報告 ────────────────────────────────────────────────────────────
  printReport(health, debt, contractGaps, dispatch);

  // ── 6. 寫 project-review.json ──────────────────────────────────────────────
  const reviewJson = {
    reviewedAt: new Date().toISOString(),
    project: path.basename(target),
    iteration: activeIter,
    health: health.summary,
    technicalDebt: debt.items,
    contractGaps: contractGaps,
    dispatch,
  };

  try {
    if (!fs.existsSync(docsPath)) fs.mkdirSync(docsPath, { recursive: true });
    fs.writeFileSync(
      path.join(docsPath, 'project-review.json'),
      JSON.stringify(reviewJson, null, 2)
    );
    console.log(`\n💾 project-review.json → ${path.join(relativeTarget, '.gems/docs/project-review.json')}`);
  } catch { /* 非關鍵 */ }

  // ── 7. 寫 pass log ──────────────────────────────────────────────────────────
  try {
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    fs.writeFileSync(
      path.join(logsDir, `review-pass-${ts}.log`),
      `@PASS\niteration: ${activeIter}\ndispatch: ${dispatch.length} items\n`
    );
  } catch { /* 非關鍵 */ }

  const hasCritical = dispatch.some(d => d.priority === 1);
  emitPass({
    scope: `REVIEW | ${activeIter}`,
    summary: `健康: P0=${health.summary.p0}/${health.summary.total} | 技術債: ${debt.items.length} | Dispatch: ${dispatch.length} 項`,
    nextCmd: hasCritical
      ? `# 優先處理 Priority-1 項目後重跑`
      : `node task-pipe/runner.cjs --phase=SCAN --target=${relativeTarget}  # 下次 SCAN 後再 REVIEW`
  }, { projectRoot: target, iteration: parseInt(iterNum), phase: 'review', step: 'review' });

  return { verdict: 'PASS', dispatch };
}

// ─── 讀 functions.json ────────────────────────────────────────────────────────

function loadFunctionsHealth(docsPath) {
  const functionsPath = path.join(docsPath, 'functions.json');
  if (!fs.existsSync(functionsPath)) {
    return { summary: { total: 0, p0: 0, p1: 0, tagged: 0, untagged: 0 }, functions: [], raw: null };
  }

  const raw = JSON.parse(fs.readFileSync(functionsPath, 'utf8'));
  const fns = raw.functions || [];
  const untagged = raw.untagged || [];

  const p0NoTest = fns.filter(f => f.risk === 'P0' && !f.testPath && !f.testStatus);
  const p0NoFlow = fns.filter(f => f.risk === 'P0' && !f.flow);
  const highComplexity = fns.filter(f => f.flowComplexity > 5);
  const storyIdEmpty = fns.filter(f => !f.storyId);

  return {
    summary: {
      total: raw.totalCount || fns.length,
      p0: raw.byRisk?.P0 || 0,
      p1: raw.byRisk?.P1 || 0,
      p2: raw.byRisk?.P2 || 0,
      p3: raw.byRisk?.P3 || 0,
      untagged: untagged.length,
      generatedAt: raw.generatedAt,
    },
    p0NoTest,
    p0NoFlow,
    highComplexity,
    storyIdEmpty,
    functions: fns,
    untagged,
  };
}

// ─── 讀 blueprint.md 技術債 ────────────────────────────────────────────────────

function loadBlueprintDebt(target) {
  const blueprintPath = path.join(target, '.gems', 'design', 'blueprint.md');
  if (!fs.existsSync(blueprintPath)) {
    return { items: [], nextIterSuggestions: [] };
  }

  const content = fs.readFileSync(blueprintPath, 'utf8');
  const items = [];
  const nextIterSuggestions = [];

  // 找技術債 section（支援多種標題格式）
  const debtMatch = content.match(/#{1,3}\s*(?:已知)?技術債[\s\S]*?(?=\n#{1,3}\s|\n---)/);
  if (debtMatch) {
    const debtSection = debtMatch[0];
    const lines = debtSection.split('\n');
    for (const line of lines) {
      // 支援 bullet 格式：- text
      if (line.trim().match(/^[-*]\s+/)) {
        const text = line.replace(/^[-*]\s+/, '').trim();
        if (text) {
          const priority = /urgent|緊急|critical|阻塞/i.test(text) ? 'HIGH'
            : /MEDIUM|medium/i.test(text) ? 'MEDIUM' : 'LOW';
          items.push({ source: 'blueprint.md', text, priority });
        }
      // 支援 table 格式：| 問題 | 位置 | 嚴重度 |（跳過 header/separator 行）
      } else if (line.trim().startsWith('|') && !line.includes('---') && !line.includes('問題') && !line.includes('issue')) {
        const cells = line.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length >= 1) {
          const text = cells[0];
          const severityCell = cells[cells.length - 1] || '';
          const priority = /HIGH|urgent|緊急|critical|阻塞/i.test(severityCell) ? 'HIGH'
            : /MEDIUM|medium/i.test(severityCell) ? 'MEDIUM' : 'LOW';
          if (text) items.push({ source: 'blueprint.md', text, priority });
        }
      }
    }
  }

  // 找下一 iter 方向（迭代規劃表中的 pending/planned 行）
  const iterTableMatch = content.match(/#{1,3}\s*迭代規劃[\s\S]*?(?=\n#{1,3}\s|\n---|\Z)/);
  if (iterTableMatch) {
    const tableSection = iterTableMatch[0];
    const pendingRows = tableSection.split('\n').filter(l =>
      /pending|planned|⬜|未開始/i.test(l) && l.includes('|')
    );
    for (const row of pendingRows.slice(0, 3)) {
      const cells = row.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 2) {
        nextIterSuggestions.push(cells.slice(0, 2).join(' — '));
      }
    }
  }

  return { items, nextIterSuggestions };
}

// ─── 讀 contract 找未覆蓋的 @TEST ─────────────────────────────────────────────

function loadContractGaps(target, iteration, iterNum) {
  const contractPath = path.join(target, `.gems/iterations/${iteration}/contract_iter-${iterNum}.ts`);
  if (!fs.existsSync(contractPath)) return [];

  const content = fs.readFileSync(contractPath, 'utf8');
  const isV4 = /\/\/\s*@CONTRACT:\s*\w+/.test(content);
  if (!isV4) return [];

  const gaps = [];
  const blockRegex = /\/\/\s*@CONTRACT:\s*(.+?)(?=\n\/\/\s*@CONTRACT:|\nexport\s+(?:interface|declare|type|class|function)|$)/gs;

  for (const m of content.matchAll(blockRegex)) {
    const block = m[0];
    const parts = m[1].trim().split('|').map(s => s.trim());
    const name = parts[0];
    const priority = parts[1];
    const type = parts[2];

    const hasTest = /\/\/\s*@TEST:\s*\S+/.test(block);
    const testPath = hasTest ? block.match(/\/\/\s*@TEST:\s*(.+)/)?.[1]?.trim() : null;

    // 只回報有 @TEST 路徑但檔案不存在的（已知應建測試但還沒建）
    if (testPath) {
      const abs = path.join(target, testPath);
      if (!fs.existsSync(abs)) {
        gaps.push({ name, priority, type, testPath, issue: 'test_file_missing' });
      }
    } else if (priority === 'P0') {
      gaps.push({ name, priority, type, testPath: null, issue: 'no_test_declared' });
    }
  }

  return gaps;
}

// ─── 組 dispatch 清單 ────────────────────────────────────────────────────────
// Priority: 1=立刻做  2=本週  3=下一 iter  4=長期

function buildDispatch(health, debt, contractGaps, target, iteration) {
  const dispatch = [];

  // P0 沒有 @TEST → Priority 1
  for (const fn of (health.p0NoTest || [])) {
    dispatch.push({
      priority: 1,
      type: 'TEST_COVERAGE',
      action: `補 @TEST：${fn.name}（P0，缺整合測試）`,
      target: fn.file || '未知路徑',
      hint: `在 contract 加 @TEST 路徑，寫 RED 測試後跑 contract-gate`
    });
  }

  // contract gaps → Priority 1（P0）或 2（P1）
  for (const gap of contractGaps) {
    const p = gap.priority === 'P0' ? 1 : 2;
    const msg = gap.issue === 'test_file_missing'
      ? `補測試：${gap.name} 的 @TEST 路徑 ${gap.testPath} 不存在`
      : `補 @TEST：${gap.name}（P0 ${gap.type}，contract 未宣告測試）`;
    dispatch.push({ priority: p, type: 'CONTRACT_GAP', action: msg, target: gap.testPath || gap.name, hint: `寫 RED 測試 → contract-gate → BUILD Phase 2` });
  }

  // P0 沒有 flow → Priority 2
  for (const fn of (health.p0NoFlow || [])) {
    dispatch.push({
      priority: 2,
      type: 'FLOW_MISSING',
      action: `補 @GEMS-FLOW：${fn.name}（P0，缺 flow 標籤）`,
      target: fn.file || '未知路徑',
      hint: `在 GEMS 標籤加 STEP1(Clear)→STEP2(Complicated) 格式`
    });
  }

  // 技術債 HIGH → Priority 2
  for (const item of debt.items.filter(d => d.priority === 'HIGH')) {
    dispatch.push({ priority: 2, type: 'TECH_DEBT', action: item.text, target: 'blueprint.md', hint: `來自 blueprint.md 技術債` });
  }

  // 大量 untagged → Priority 2（如果超過 20%）
  const total = health.summary.total + health.summary.untagged;
  if (health.summary.untagged > 0 && total > 0 && health.summary.untagged / total > 0.2) {
    dispatch.push({
      priority: 2,
      type: 'TAG_COVERAGE',
      action: `補 GEMS 標籤：${health.summary.untagged} 個未標記函式（佔 ${Math.round(health.summary.untagged / total * 100)}%）`,
      target: 'src/',
      hint: `SCAN 輸出 untagged 列表，逐一補 /** GEMS: name | P1 | ... */ 標籤`
    });
  }

  // 技術債 MEDIUM → Priority 3
  for (const item of debt.items.filter(d => d.priority === 'MEDIUM')) {
    dispatch.push({ priority: 3, type: 'TECH_DEBT', action: item.text, target: 'blueprint.md', hint: `來自 blueprint.md 技術債` });
  }

  // 高複雜度函式 → Priority 3
  for (const fn of (health.highComplexity || [])) {
    dispatch.push({
      priority: 3,
      type: 'REFACTOR',
      action: `考慮拆分：${fn.name}（flowComplexity=${fn.flowComplexity}，超過 5 步驟）`,
      target: fn.file || '未知路徑',
      hint: `CYNEFIN gate 建議：複雜度過高的函式考慮拆成多個小函式`
    });
  }

  // 下一 iter 方向 → Priority 4
  for (const suggestion of debt.nextIterSuggestions) {
    dispatch.push({ priority: 4, type: 'NEXT_ITER', action: suggestion, target: 'blueprint.md', hint: `blueprint.md 迭代規劃表` });
  }

  // 技術債 LOW → Priority 4
  for (const item of debt.items.filter(d => d.priority === 'LOW')) {
    dispatch.push({ priority: 4, type: 'TECH_DEBT', action: item.text, target: 'blueprint.md', hint: `來自 blueprint.md 技術債` });
  }

  return dispatch.sort((a, b) => a.priority - b.priority);
}

// ─── 印報告 ────────────────────────────────────────────────────────────────────

function printReport(health, debt, contractGaps, dispatch) {
  const s = health.summary;

  // 健康指標
  console.log('┌── 健康指標 ──────────────────────────────────────────┐');
  console.log(`│  函式總數: ${String(s.total).padEnd(4)} (P0:${s.p0} P1:${s.p1} P2:${s.p2} P3:${s.p3})`);
  console.log(`│  未標記:   ${s.untagged > 0 ? `⚠️  ${s.untagged}` : '✅ 0'}`);
  console.log(`│  掃描時間: ${s.generatedAt ? s.generatedAt.slice(0, 10) : '未知'}`);
  if (contractGaps.length > 0)
    console.log(`│  contract gaps: ${contractGaps.length} 個 @TEST 未建立`);
  console.log('└──────────────────────────────────────────────────────┘\n');

  // dispatch 清單
  if (dispatch.length === 0) {
    console.log('✅ 沒有待處理項目，專案健康良好');
    return;
  }

  const typeIcon = { TEST_COVERAGE: '🔴', CONTRACT_GAP: '🔴', FLOW_MISSING: '🟡', TECH_DEBT: '🟠', TAG_COVERAGE: '🟡', REFACTOR: '🔵', NEXT_ITER: '🟢' };
  const priorityLabel = { 1: '立刻', 2: '本週', 3: '下一 iter', 4: '長期' };

  let lastPriority = 0;
  for (const item of dispatch) {
    if (item.priority !== lastPriority) {
      console.log(`\n── Priority ${item.priority}：${priorityLabel[item.priority] || ''} ───────────────`);
      lastPriority = item.priority;
    }
    const icon = typeIcon[item.type] || '⚪';
    console.log(`  ${icon} [${item.type}] ${item.action}`);
    console.log(`     → ${item.hint}`);
  }
  console.log('');
}

// ─── 工具 ───────────────────────────────────────────────────────────────────

function detectActiveIter(gemsPath) {
  const itersPath = path.join(gemsPath, 'iterations');
  if (!fs.existsSync(itersPath)) return 'iter-1';
  const iters = fs.readdirSync(itersPath)
    .filter(d => /^iter-\d+$/.test(d))
    .sort((a, b) => parseInt(b.replace('iter-', '')) - parseInt(a.replace('iter-', '')));
  return iters[0] || 'iter-1';
}

// ─── CLI ────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  let target = process.cwd();
  let iteration = null;
  args.forEach(arg => {
    if (arg.startsWith('--target=')) target = arg.split('=')[1];
    if (arg.startsWith('--iteration=')) iteration = arg.split('=')[1];
  });
  if (!path.isAbsolute(target)) target = path.resolve(process.cwd(), target);
  run({ target, iteration });
}

module.exports = { run };
