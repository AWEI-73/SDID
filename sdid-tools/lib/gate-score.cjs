#!/usr/bin/env node
/**
 * gate-score.cjs — Blueprint Score 計算 + 函式快照輸出
 * 由 blueprint-gate.cjs 拆出，勿直接執行。
 */
'use strict';
const fs = require('fs');
const path = require('path');

function calcBlueprintScore(draft, rawContent = '') {
  const BACKEND_TYPES = new Set(['SVC', 'API', 'DATA', 'REPO', 'DB']);
  const FRONTEND_TYPES = new Set(['UI', 'HOOK', 'ROUTE', 'PAGE', 'COMPONENT']);
  const GENERIC_STEPS = new Set(['INIT', 'PROCESS', 'RETURN', 'START', 'END', 'EXECUTE', 'INPUT', 'OUTPUT', 'HANDLE', 'RUN', 'DO', 'FINISH']);

  const isFoundationModule = (name) => {
    const lower = name.toLowerCase();
    return lower === 'shared' || lower.includes('foundation') || lower.includes('infra') || lower.includes('config');
  };

  // ── 1. 垂直切片覆蓋 (25 分) ──
  // 收集非 Foundation iter 的前後端覆蓋情況
  const iterCoverage = {}; // { iterNum: { backend, frontend } }
  for (const [modName, mod] of Object.entries(draft.moduleActions)) {
    if (mod.fillLevel === 'done') continue;
    if (isFoundationModule(modName)) continue;
    const iterNum = mod.iter;
    if (!iterCoverage[iterNum]) iterCoverage[iterNum] = { backend: false, frontend: false };
    for (const item of (mod.items || [])) {
      const t = (item.type || '').toUpperCase();
      if (BACKEND_TYPES.has(t)) iterCoverage[iterNum].backend = true;
      if (FRONTEND_TYPES.has(t)) iterCoverage[iterNum].frontend = true;
    }
  }
  const nonFoundationIters = Object.keys(iterCoverage).length;
  const fullSliceIters = Object.values(iterCoverage).filter(c => c.backend && c.frontend).length;
  const backendOnlyIters = Object.values(iterCoverage).filter(c => c.backend && !c.frontend).length;
  // 全部 iter 都是 Foundation（沒有業務 story）→ 0 分，不能拿滿分
  const vscScore = nonFoundationIters === 0 ? 0 : Math.round((fullSliceIters / nonFoundationIters) * 25);

  // ── 2. Story 密度 (20 分) ──
  // 每個非 Foundation iter 的 story 數，目標 ≥2
  // Story 計數：優先讀 block 內的 "> Story 拆法: Story-0 ..., Story-1 ..." 標記
  // 若無標記，每個 block = 1 story（向後相容）

  // 先從 rawContent 解析每個 ### Iter N: ModuleName block 的 Story 子分組數
  const blockStoryCount = {}; // { modName: N }
  if (rawContent) {
    // 切出 ## 📋 模組動作清單 區塊
    const actionSectionMatch = rawContent.match(/## 📋 模組動作清單([\s\S]*?)(?=\n## |\n---\n|$)/);
    if (actionSectionMatch) {
      const actionSection = actionSectionMatch[1];
      // 找每個 ### Iter N: ModuleName block
      const blockMatches = [...actionSection.matchAll(/###\s+Iter\s+\d+:\s*([^\n\[\(]+)([\s\S]*?)(?=\n###\s+Iter|\n## |$)/gi)];
      for (const bm of blockMatches) {
        const modName = bm[1].trim();
        const blockContent = bm[2];
        // 找 "> Story 拆法: Story-0 ..., Story-1 ..." 或 "> Story 拆法: Story-0 ...; Story-1 ..."
        const storyHintMatch = blockContent.match(/>\s*Story\s*拆法\s*[:：]\s*(.+)/i);
        if (storyHintMatch) {
          // 數 Story-N 出現幾次
          const storyCount = (storyHintMatch[1].match(/Story-\d+/gi) || []).length;
          if (storyCount >= 2) {
            blockStoryCount[modName] = storyCount;
            continue;
          }
        }
        // 也支援 **Story-0:** 或 #### Story-0: 格式
        const inlineStoryCount = (blockContent.match(/(?:\*\*Story-\d+[：:*]|\#{3,4}\s*Story-\d+)/gi) || []).length;
        if (inlineStoryCount >= 2) {
          blockStoryCount[modName] = inlineStoryCount;
        }
      }
    }
  }

  const iterStoryCounts = {};
  for (const [modName, mod] of Object.entries(draft.moduleActions)) {
    if (mod.fillLevel === 'done') continue;
    if (isFoundationModule(modName)) continue;
    const iterNum = mod.iter;
    if (!iterStoryCounts[iterNum]) iterStoryCounts[iterNum] = 0;
    // 如果 block 內有 Story 子分組標記，用子分組數；否則算 1
    iterStoryCounts[iterNum] += blockStoryCount[modName] || 1;
  }
  const storyCounts = Object.values(iterStoryCounts);
  // 全部 iter 都是 Foundation（沒有業務 story）→ 0 分
  let densityScore = storyCounts.length === 0 ? 0 : 20;
  if (storyCounts.length > 0) {
    const avg = storyCounts.reduce((a, b) => a + b, 0) / storyCounts.length;
    const singleStoryIters = storyCounts.filter(c => c < 2).length;
    // 每個只有 1 個 story 的 iter 扣 5 分，最多扣完
    densityScore = Math.max(0, 20 - singleStoryIters * 5);
  }

  // ── 3. Flow 品質 (20 分) ──
  let totalActions = 0;
  let goodFlowActions = 0;
  for (const [, mod] of Object.entries(draft.moduleActions)) {
    if (mod.fillLevel === 'done') continue;
    for (const item of (mod.items || [])) {
      totalActions++;
      if (!item.flow) continue;
      const steps = item.flow.split('→').map(s => s.trim().toUpperCase());
      const genericCount = steps.filter(s => GENERIC_STEPS.has(s)).length;
      // flow 有 3+ 步且不全是泛用詞 = 好的 flow
      if (steps.length >= 3 && genericCount < steps.length) goodFlowActions++;
    }
  }
  const flowScore = totalActions === 0 ? 20 : Math.round((goodFlowActions / totalActions) * 20);

  // ── 4. AC 覆蓋率 (20 分) ──
  let p01Total = 0;
  let p01WithAC = 0;
  for (const [, mod] of Object.entries(draft.moduleActions)) {
    if (mod.fillLevel === 'done') continue;
    for (const item of (mod.items || [])) {
      const p = (item.priority || '').toUpperCase();
      if (p !== 'P0' && p !== 'P1') continue;
      p01Total++;
      const ac = (item.ac || item['AC'] || '').trim();
      if (ac && ac !== '-' && ac !== '無') p01WithAC++;
    }
  }
  const acScore = p01Total === 0 ? 20 : Math.round((p01WithAC / p01Total) * 20);

  // ── 5. 基礎建設完整度 (15 分) ──
  // 檢查 Foundation iter 是否有 4 個必要元素
  let infraScore = 0;
  let hasTypes = false;    // CONST 型別定義 (+4)
  let hasContract = false; // CONST API 介面契約 (+4)
  let hasShell = false;    // ROUTE 前端殼 (+4)
  let hasStyle = false;    // 樣式策略定義 (+3)

  for (const [modName, mod] of Object.entries(draft.moduleActions)) {
    if (!isFoundationModule(modName)) continue;
    if (mod.fillLevel === 'done') continue;
    for (const item of (mod.items || [])) {
      const t = (item.type || '').toUpperCase();
      const name = (item.techName || '').toLowerCase();
      if (t === 'CONST' && (name.includes('type') || name.includes('core') || name.includes('enum'))) hasTypes = true;
      if (t === 'CONST' && (name.includes('service') || name.includes('contract') || name.includes('interface') || name.startsWith('i'))) hasContract = true;
      if (t === 'ROUTE' || t === 'APP') hasShell = true;
    }
  }
  // 樣式策略：必須是單一值（與 FMT-008 邏輯一致，有 / 並列不算）
  for (const [, mod] of Object.entries(draft.modules)) {
    if (mod.styleStrategy && mod.styleStrategy.trim() !== '') { hasStyle = true; break; }
  }
  if (!hasStyle && rawContent) {
    const styleMatch2 = rawContent.match(/\*\*樣式策略\*\*\s*:\s*(.+)/);
    if (styleMatch2) {
      const styleVal = styleMatch2[1].trim();
      // 有 / 並列多個選項 → 還沒選定，不算有樣式策略
      hasStyle = styleVal.length > 0 && !/\s*\/\s*/.test(styleVal);
    }
  }

  if (hasTypes) infraScore += 4;
  if (hasContract) infraScore += 4;
  if (hasShell) infraScore += 4;
  if (hasStyle) infraScore += 3;

  // ── 總分 ──
  const total = vscScore + densityScore + flowScore + acScore + infraScore;
  const grade = total >= 90 ? 'EXCELLENT' : total >= 75 ? 'GOOD' : total >= 60 ? 'FAIR' : 'WEAK';

  // ── 建議清單 ──
  const suggestions = [];
  if (nonFoundationIters === 0) {
    suggestions.push('所有 iter 都是 Foundation，缺少業務 story（後端 SVC/API + 前端 UI/ROUTE）。Foundation 只是基礎建設，不算業務交付');
  }
  if (backendOnlyIters > 0) {
    const iterNums = Object.entries(iterCoverage)
      .filter(([, c]) => c.backend && !c.frontend)
      .map(([n]) => `iter-${n}`).join(', ');
    suggestions.push(`${iterNums} 只有後端 story，考慮加入前端 story 或確認這是刻意的純 API iter`);
  }
  const singleStoryIterNums = Object.entries(iterStoryCounts)
    .filter(([, c]) => c < 2).map(([n]) => `iter-${n}`);
  if (singleStoryIterNums.length > 0) {
    suggestions.push(`${singleStoryIterNums.join(', ')} 只有 1 個 story，建議拆為後端 story + 前端 story`);
  }
  if (!hasTypes) suggestions.push('Foundation 缺少核心型別定義 (CoreTypes/enums)');
  if (!hasContract) suggestions.push('Foundation 缺少 API 介面契約 (IXxxService interface)');
  if (!hasShell) suggestions.push('Foundation 缺少前端主入口殼 (AppRouter/Layout ROUTE)');
  if (!hasStyle) suggestions.push('Foundation 缺少樣式策略定義 (CSS Modules / Tailwind / ...)');

  return {
    total,
    grade,
    breakdown: { vsc: vscScore, density: densityScore, flow: flowScore, ac: acScore, infra: infraScore },
    details: { fullSliceIters, backendOnlyIters, nonFoundationIters, avgStories: storyCounts.length > 0 ? (storyCounts.reduce((a,b)=>a+b,0)/storyCounts.length).toFixed(1) : 'N/A', goodFlowActions, totalActions, p01WithAC, p01Total, hasTypes, hasContract, hasShell, hasStyle },
    suggestions,
  };
}

// ============================================
// 報告生成
// ============================================
/**
 * 讀取 functions.json 並輸出既有函式快照
 * 讓 AI 在寫/修藍圖時知道之前 iter 已有哪些函式，避免重複定義
 */
function printExistingFunctionsSnapshot(projectRoot, currentIter) {
  if (!projectRoot) return;
  const functionsPath = path.join(projectRoot, '.gems', 'docs', 'functions.json');
  if (!fs.existsSync(functionsPath)) return;

  let fj;
  try { fj = JSON.parse(fs.readFileSync(functionsPath, 'utf8')); } catch { return; }

  const fns = fj.functions || [];
  if (fns.length === 0) return;

  const critical = fns.filter(fn => { const r = fn.risk || fn.priority || ''; return r === 'P0' || r === 'P1'; });
  const others = fns.filter(fn => { const r = fn.risk || fn.priority || ''; return r !== 'P0' && r !== 'P1'; });

  console.log('');
  console.log(`📦 既有函式快照 (${fns.length} 個，顯示 P0/P1) — 寫藍圖時請勿重複定義:`);
  for (const fn of critical) {
    const risk = fn.risk || fn.priority || '?';
    const story = fn.storyId ? ` [${fn.storyId}]` : '';
    console.log(`  - ${fn.name} | ${risk}${story} | ${fn.file} | ${fn.flow || '?'}`);
  }
  if (others.length > 0) {
    console.log(`  ... 另有 ${others.length} 個 P2/P3 函式 (略)`);
  }
  console.log('');
}


module.exports = {
  calcBlueprintScore,
  printExistingFunctionsSnapshot,
};
