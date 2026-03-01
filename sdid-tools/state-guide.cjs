#!/usr/bin/env node
/**
 * state-guide.cjs  (Wave 2 — AI 進入指令包)
 *
 * AI 每次進入時執行，輸出「狀態指令包」：
 *   📍 現在在哪  📖 該讀什麼  ⚠️ 歷史提示  🎯 下一步  🚫 施工紅線
 *
 * 資料來源:
 *   .gems/last_step_result.json     ← 上一步 phase/step/verdict
 *   .gems/iterations/{iter}/.state.json  ← 完整流程狀態 (stories)
 *   .gems/function-index-v2.json    ← gemsId → specFile/line/flow
 *   .gems/specs/*.json              ← allowedImports / storyRef
 *   .gems/project-memory.json       ← pitfalls / 歷史錯誤
 *
 * 用法:
 *   node sdid-tools/state-guide.cjs --project=ExamForge
 *   node sdid-tools/state-guide.cjs --project=ExamForge --iter=iter-11
 *   node sdid-tools/state-guide.cjs --project=ExamForge --story=Story-11.1
 *   node sdid-tools/state-guide.cjs --project=ExamForge --gems=PDF.ParseBufferWithImages
 *
 * 退出碼:
 *   0 = 成功輸出
 *   1 = 找不到 project
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────────────────────

function tryJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

// ─────────────────────────────────────────────────────────────
// 步驟 → 腳本路徑 映射
// ─────────────────────────────────────────────────────────────

const PHASE_SCRIPT_MAP = {
  POC:   (step) => `task-pipe/phases/poc/step-${step}.cjs`,
  PLAN:  (step) => `task-pipe/phases/plan/step-${step}.cjs`,
  BUILD: (step) => `task-pipe/phases/build/phase-${step}.cjs`,
  SCAN:  (step) => `task-pipe/phases/scan/step-${step}.cjs`,
};

function getPhaseScript(phase, step) {
  const fn = PHASE_SCRIPT_MAP[phase?.toUpperCase()];
  return fn ? fn(step) : `task-pipe/phases/${phase?.toLowerCase()}/step-${step}.cjs`;
}

// ─────────────────────────────────────────────────────────────
// 路線偵測
// ─────────────────────────────────────────────────────────────

function detectRoute(projectRoot) {
  // 優先看入口文件（比 .gems/specs 更準確）
  // Blueprint  → requirement-draft.md    (REQUIREMENT DRAFT)
  // Task-Pipe  → requirement-spec.md     (REQUIREMENT SPEC)
  // POC-FIX    → poc-consolidation-log.md (POC 整合輸出)
  const iterDirs = path.join(projectRoot, '.gems', 'iterations');
  if (fs.existsSync(iterDirs)) {
    for (const iter of fs.readdirSync(iterDirs)) {
      const pocLog = path.join(iterDirs, iter, 'poc', 'poc-consolidation-log.md');
      if (fs.existsSync(pocLog)) return 'POC-FIX';
    }
  }
  // 根目錄直接放的 consolidation log（ExamForge 舊位置）
  const rootPocLog = path.join(projectRoot, '.gems', 'poc-consolidation-log.md');
  if (fs.existsSync(rootPocLog)) return 'POC-FIX';

  if (fs.existsSync(path.join(projectRoot, 'requirement-draft.md'))) return 'Blueprint';
  if (fs.existsSync(path.join(projectRoot, 'requirement-spec.md')))  return 'Task-Pipe (LEGACY)';

  // fallback：看 .gems/specs 有沒有字典（有的話視為 POC-FIX）
  const specsDir = path.join(projectRoot, '.gems', 'specs');
  if (fs.existsSync(specsDir)) {
    const specFiles = fs.readdirSync(specsDir).filter(f => f.endsWith('.json') && f !== '_index.json');
    if (specFiles.length > 0) return 'POC-FIX';
  }
  return 'Task-Pipe (LEGACY)';
}

// ─────────────────────────────────────────────────────────────
// 迭代偵測
// ─────────────────────────────────────────────────────────────

function detectActiveIter(projectRoot) {
  const itersDir = path.join(projectRoot, '.gems', 'iterations');
  if (!fs.existsSync(itersDir)) return 'iter-1';

  const dirs = fs.readdirSync(itersDir)
    .filter(d => /^iter-\d+$/.test(d))
    .sort((a, b) => {
      const na = parseInt(a.replace('iter-', ''));
      const nb = parseInt(b.replace('iter-', ''));
      return nb - na; // 降序
    });

  if (dirs.length === 0) return 'iter-1';

  for (const d of dirs) {
    const st = tryJson(path.join(itersDir, d, '.state.json'));
    if (st && st.status === 'active') return d;
  }

  return dirs[0]; // 返回最新迭代
}

// ─────────────────────────────────────────────────────────────
// 目標函式解析 (從 function-index-v2.json + specs)
// ─────────────────────────────────────────────────────────────

/**
 * 找出與 storyId 相關的 gemsId 列表
 * @param {string} projectRoot
 * @param {string|null} storyId    — 如 "Story-11.1"
 * @param {string|null} filterGems — 指定單一 gemsId（--gems=）
 */
function resolveTargetGems(projectRoot, storyId, filterGems) {
  const indexPath = path.join(projectRoot, '.gems', 'function-index-v2.json');
  const index     = tryJson(indexPath);
  if (!index) return [];

  const specsDir  = path.join(projectRoot, '.gems', 'specs');
  const specCache = new Map(); // relPath → data

  function loadSpec(relPath) {
    if (specCache.has(relPath)) return specCache.get(relPath);
    const abs = path.join(projectRoot, '.gems', relPath);
    const d   = tryJson(abs);
    specCache.set(relPath, d);
    return d;
  }

  const results = [];
  const byGemsId = index.byGemsId || {};

  for (const [gemsId, entry] of Object.entries(byGemsId)) {
    // --gems 過濾
    if (filterGems && gemsId !== filterGems) continue;

    const specData  = entry.specFile ? loadSpec(entry.specFile) : null;
    const dictEntry = specData ? specData[gemsId] : null;

    // storyRef 過濾（--story 或 auto-detect）
    if (storyId && !filterGems) {
      const ref = dictEntry?.storyRef;
      if (ref && ref !== storyId) continue;
    }

    // lineRange 優先從 dict spec 取（L589-653），fallback 到 index 的 line
    const lineRange  = dictEntry?.lineRange || (entry.line ? `L${entry.line}` : null);

    results.push({
      gemsId,
      name:           entry.name,
      file:           entry.file,
      lineRange,
      priority:       entry.priority,
      flow:           entry.flow,
      specFile:       entry.specFile,
      dictBacked:     entry.dictBacked,
      allowedImports: dictEntry?.allowedImports || [],
      storyRef:       dictEntry?.storyRef || null,
      status:         dictEntry?.status || null,
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// 歷史提示 (project-memory)
// ─────────────────────────────────────────────────────────────

function resolveHints(projectRoot, phase, step, story) {
  const memPath = path.join(projectRoot, '.gems', 'project-memory.json');
  const mem     = tryJson(memPath);
  if (!mem) return { pitfalls: [], histHint: null, resumeCtx: null };

  const s = mem.summary || {};

  // 取最近 2 個 pitfall
  const pitfalls = (s.knownPitfalls || []).slice(-2);

  // 同相位同步驟的歷史失敗
  const phaseStep = `${phase}-${step}`;
  const pastErrors = (mem.entries || []).filter(e =>
    `${e.phase}-${e.step}` === phaseStep &&
    e.verdict !== 'PASS' &&
    (!story || e.story !== story)
  );

  let histHint = null;
  if (pastErrors.length > 0) {
    const last    = pastErrors[pastErrors.length - 1];
    const missing = last.missing || [];
    if (missing.length > 0) {
      histHint = `上次 ${phaseStep} 在 ${last.story || '?'} 失敗：${missing.join(', ')}`;
    } else {
      histHint = `此步驟曾失敗 ${pastErrors.length} 次（最近: ${last.story || '?'}）`;
    }
  }

  // 簡短 resume ctx
  const total = `${s.totalPasses || 0}P/${s.totalErrors || 0}E`;
  const resumeCtx = `${mem.project || '?'} | ${s.currentIteration || '?'} | ${total}`;

  return { pitfalls, histHint, resumeCtx };
}

// ─────────────────────────────────────────────────────────────
// 輸出組裝
// ─────────────────────────────────────────────────────────────

function formatGuide(opts) {
  const {
    phase, step, story, iter, route, resumeCtx,
    scriptPath, gems, pitfalls, histHint,
    phase2Script,
  } = opts;

  const SEP = '═'.repeat(47);
  const lines = [];

  lines.push('');
  lines.push(SEP);
  lines.push('  SDID State Guide');
  lines.push(SEP);
  lines.push('');

  // 📍 狀態
  const phaseLabel = phase ? `${phase} Phase, Step ${step}` : '（未知）';
  lines.push(`📍 狀態: ${phaseLabel}, ${story || '（無 Story）'}, ${iter}`);

  // memory 統計
  if (resumeCtx) lines.push(`   memory: ${resumeCtx}`);

  lines.push(`📂 路線: ${route}`);
  lines.push('');

  // 📖 該讀的
  lines.push('📖 該讀的:');
  if (scriptPath)   lines.push(`   腳本規則: ${scriptPath}`);
  if (phase2Script) lines.push(`   GEMS 驗收: ${phase2Script}（可提前確認標籤）`);

  if (gems.length > 0) {
    // 收集不重複的 specFile
    const specFiles = [...new Set(gems.map(g => g.specFile).filter(Boolean))];
    for (const sf of specFiles) {
      lines.push(`   字典規格: .gems/${sf}`);
    }
    lines.push('');
    lines.push('   目標函式:');
    for (const g of gems) {
      const filePart = g.file ? `${g.file.replace(/\\/g, '/')} ${g.lineRange || ''}`.trim() : '';
      lines.push(`   • ${g.gemsId} [${g.priority || '?'}] ${g.status ? `(${g.status})` : ''}`);
      if (filePart) lines.push(`     → ${filePart}`);
      if (g.flow)   lines.push(`     flow: ${g.flow}`);
    }
  } else {
    lines.push('   目標函式: （本迭代無 GEMS dict 條目匹配）');
  }

  lines.push('');

  // ⚠️ 歷史提示
  lines.push('⚠️  歷史提示:');
  if (pitfalls.length > 0) {
    for (const p of pitfalls) lines.push(`   @PITFALL: ${p}`);
  } else {
    lines.push('   （無已知 pitfall）');
  }
  if (histHint) {
    lines.push(`   @HINT: ${histHint}`);
  }
  lines.push('');

  // 🎯 下一步
  lines.push('🎯 下一步:');
  if (phase && step && story) {
    lines.push(`   @NEXT_COMMAND: node task-pipe/runner.cjs --phase=${phase} --step=${step} --story=${story}`);
  } else {
    lines.push('   @NEXT_COMMAND: （請先確認 phase/step/story）');
  }
  lines.push('');

  // 🚫 施工紅線
  lines.push('🚫 施工紅線:');
  const hasImports = gems.some(g => g.allowedImports && g.allowedImports.length > 0);
  if (hasImports) {
    for (const g of gems) {
      if (g.allowedImports && g.allowedImports.length > 0) {
        lines.push(`   @GUARD [${g.gemsId}]: allowedImports = [${g.allowedImports.join(', ')}]`);
      }
    }
    lines.push('   @GUARD: 禁止新增 allowedImports 以外的 import');
  } else {
    lines.push('   @GUARD: 禁止新增 allowedImports 以外的 import（dict 未設定白名單）');
  }
  lines.push('   @GUARD: 禁止修改 src/shared/types（型別異動須走 Skill A 字典更新）');
  lines.push('');
  lines.push(SEP);
  lines.push('');

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────

if (require.main === module) {
  const argv = process.argv.slice(2);
  let projectRoot = process.cwd();
  let iterOpt     = null;
  let storyOpt    = null;
  let gemsOpt     = null;

  for (const a of argv) {
    if (a.startsWith('--project=')) projectRoot = path.resolve(a.split('=')[1]);
    if (a.startsWith('--iter='))    iterOpt     = a.split('=')[1];
    if (a.startsWith('--story='))   storyOpt    = a.split('=')[1];
    if (a.startsWith('--gems='))    gemsOpt     = a.split('=')[1];
    if (a === '--help' || a === '-h') {
      console.log('Usage: node sdid-tools/state-guide.cjs --project=<dir> [--iter=iter-N] [--story=Story-N.N] [--gems=Domain.Action]');
      process.exit(0);
    }
  }

  if (!fs.existsSync(projectRoot)) {
    console.error(`✗ 找不到專案: ${projectRoot}`);
    process.exit(1);
  }

  // ── 1. 迭代 ──
  const iter = iterOpt || detectActiveIter(projectRoot);

  // ── 2. 路線 ──
  const route = detectRoute(projectRoot);

  // ── 3. 狀態 ──
  const lastStep = tryJson(path.join(projectRoot, '.gems', 'last_step_result.json'));
  const state    = tryJson(path.join(projectRoot, '.gems', 'iterations', iter, '.state.json'));

  // ── 4. Story 先決定（才能正確取 phase/step）──
  let story = storyOpt;
  let phase = null;
  let step  = null;

  if (!story && state?.stories) {
    const inProg = Object.values(state.stories).filter(s => s.status === 'in-progress');
    if (inProg.length > 0) {
      inProg.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      story = inProg[0].id;
      // 從 story 取 phase/step（最準確）
      phase = inProg[0].currentPhase || null;
      step  = inProg[0].currentStep  || null;
    }
  }

  // 若 story state 沒有 phase/step，fallback 到 flow.currentNode
  if (!phase && state?.flow?.currentNode && state.flow.currentNode !== 'COMPLETE') {
    const m = state.flow.currentNode.match(/^([A-Z]+)-(\d+)$/);
    if (m) { phase = m[1]; step = m[2]; }
  }

  // 最終 fallback: last_step_result
  if (!phase) { phase = lastStep?.phase || null; step = lastStep?.step || null; }

  // ── 5. 腳本路徑 ──
  const scriptPath  = phase && step ? getPhaseScript(phase, step) : null;
  const phase2Script = (phase === 'BUILD' && parseInt(step) !== 2)
    ? 'task-pipe/phases/build/phase-2.cjs'
    : null;

  // ── 6. 目標函式 ──
  const gems = resolveTargetGems(projectRoot, story, gemsOpt);

  // ── 7. 歷史提示 ──
  const { pitfalls, histHint, resumeCtx } = resolveHints(projectRoot, phase, step, story);

  // ── 8. 輸出 ──
  const guide = formatGuide({
    phase, step, story, iter, route, resumeCtx,
    scriptPath, phase2Script,
    gems, pitfalls, histHint,
  });

  process.stdout.write(guide);
  process.exit(0);
}

module.exports = { detectRoute, detectActiveIter, resolveTargetGems, resolveHints, formatGuide };
