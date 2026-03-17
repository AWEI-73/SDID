/**
 * sdid-loop adapter — ★ 主入口 tool
 * 自動偵測專案狀態並執行下一步
 */
import { z } from 'zod';
import { createRequire } from 'node:module';
import path from 'node:path';
import { TOOLS_DIR, resolvePath, runCli, runRunner } from '../lib/utils.mjs';

const require = createRequire(import.meta.url);
const stateMachine = require(path.join(TOOLS_DIR, '..', 'sdid-core', 'state-machine.cjs'));
const orchestrator = require(path.join(TOOLS_DIR, '..', 'sdid-core', 'orchestrator.cjs'));

export const schema = {
  title: 'SDID Loop (主入口)',
  description: `🔁 唯一主流程入口 — 所有 SDID 開發流程必須從此工具開始，禁止直接呼叫其他 sdid-* 工具。自動偵測專案狀態並執行下一步，支援兩條路線（文件驅動自動偵測）：
  Blueprint: GATE → CYNEFIN → CONTRACT → PLAN → BUILD (Phase 1-4) → SCAN → VERIFY
  Task-Pipe: POC → CYNEFIN → spec-to-plan → CONTRACT-QUALITY-GATE → BUILD → SCAN → VERIFY
  POC-FIX / MICRO-FIX 路線自動偵測。
每次呼叫會：(1) 偵測路線+當前階段（由文件存在與否決定，不靠 route 參數） (2) 執行對應工具 (3) 回傳結果 + @TASK 或 @NEXT 指示。
收到 @TASK 時請修改程式碼，修完後再次呼叫此工具。收到 @PASS 時直接再次呼叫。
⛔ 嚴禁在 sdid-loop 之外自行呼叫 sdid-blueprint-gate、sdid-spec-gen、sdid-spec-gate、sdid-build、sdid-scan、sdid-micro-fix-gate、sdid-poc-scaffold。
⛔ 嚴禁讀取 sdid-tools/*.cjs、task-pipe/**/*.cjs、sdid-core/*.cjs 等框架腳本原始碼 — 不得透過讀腳本推斷驗證邏輯來針對性修改 draft 或 src 過關。只根據 @TASK/@BLOCKER 的錯誤訊息修復。`,
  inputSchema: {
    project: z.string().describe('專案根目錄路徑'),
    iter: z.number().optional().describe('迭代編號（省略則自動偵測最新）'),
    story: z.string().optional().describe('指定 Story ID（BUILD 階段用，省略則自動偵測）'),
    forceStart: z.string().optional().describe('強制從指定階段開始（GATE/PLAN/BUILD-N/VERIFY/POC/SCAN）。SHRINK 已移為可選工具，可手動執行 node task-pipe/tools/shrink-tags.cjs。'),
  },
};

export async function handler({ project, iter, story, forceStart }) {
  const fs = require('fs');
  const projectRoot = resolvePath(project);

  if (!fs.existsSync(projectRoot)) {
    return { content: [{ type: 'text', text: `ERROR: 找不到專案目錄: ${projectRoot}` }] };
  }

  // Detect state via orchestrator (handles iter auto-detection + ensureIterStructure)
  const iterOpt = iter ? `iter-${iter}` : undefined;
  let state;
  if (forceStart) {
    // forceStart: 先取得 auto-detected state 以拿到 draftPath/plannedStories/completedStories
    const baseState = orchestrator.detectProjectState(projectRoot, { iter: iterOpt, story: story || null });
    const buildMatch = forceStart.match(/^BUILD-?(\d+)?$/i);
    if (buildMatch) {
      state = { ...baseState, phase: 'BUILD', step: parseInt(buildMatch[1] || '1'), story: story || baseState.plannedStories?.[0] };
    } else {
      const phaseMap = { GATE: 'GATE', PLAN: 'PLAN', SHRINK: 'SHRINK', VERIFY: 'VERIFY', POC: 'POC', SCAN: 'SCAN', 'POC-FIX': 'POC-FIX', 'MICRO-FIX': 'MICRO-FIX', 'CYNEFIN-CHECK': 'CYNEFIN_CHECK', 'CYNEFIN': 'CYNEFIN_CHECK', 'CONTRACT': 'CONTRACT' };
      const phase = phaseMap[forceStart.toUpperCase()];
      if (!phase) {
        return { content: [{ type: 'text', text: `ERROR: 無效的 forceStart: ${forceStart}\n有效值: GATE, PLAN, BUILD-N, VERIFY, POC, SCAN, POC-FIX, MICRO-FIX, CONTRACT\n💡 SHRINK 已移為可選工具，請直接執行: node task-pipe/tools/shrink-tags.cjs --target=<project>` }] };
      }
      state = { ...baseState, phase };
    }
  } else {
    state = orchestrator.detectProjectState(projectRoot, { iter: iterOpt, story: story || null });
    if (story && state.phase === 'BUILD') state.story = story;
  }

  const iterNum = parseInt((state.iteration || state.iter || 'iter-1').replace('iter-', ''), 10);
  // 文件驅動路線偵測：有 draft → Blueprint，有 spec → Task-Pipe
  const detectedRoute = state.route || stateMachine.detectRoute(projectRoot, `iter-${iterNum}`);

  const lines = [];
  lines.push('══════════════════════════════════════════════════');
  lines.push('  SDID Loop — Multi-Route Navigator');
  lines.push('══════════════════════════════════════════════════');
  lines.push('');
  lines.push(`📁 專案: ${projectRoot}`);
  lines.push(`📍 迭代: iter-${iterNum}`);
  lines.push(`📍 路線: ${detectedRoute}`);
  lines.push(`📍 狀態: ${state.phase}${state.step ? ' Phase ' + state.step : ''}${state.story ? ' ' + state.story : ''}`);

  // ========== HUB: 注入現有程式碼 context ==========
  const functionsPath = path.join(projectRoot, '.gems', 'docs', 'functions.json');
  const shouldInjectFull = ['GATE', 'PLAN', 'POC', 'CONTRACT'].includes(state.phase) ||
    (state.phase === 'BUILD' && (state.step || 1) === 1);
  const shouldInjectStory = state.phase === 'BUILD' && (state.step || 1) > 1;

  if (fs.existsSync(functionsPath) && (shouldInjectFull || shouldInjectStory)) {
    try {
      const fj = JSON.parse(fs.readFileSync(functionsPath, 'utf8'));
      // generatedBy 警告：若 functions.json 由 VERIFY auto-scan 產出，行號可能不準
      if (fj.generatedBy === 'blueprint-verify auto-scan') {
        lines.push('  ⚠️  [HUB] functions.json 由 VERIFY auto-scan 產出（非正式 SCAN），行號可能與源碼不符');
        lines.push('       建議：執行 sdid-loop forceStart=SCAN 更新正式快照');
      }
      const allFns = fj.functions || [];
      let fnsToShow = allFns;

      if (shouldInjectStory && state.story) {
        // Phase 2+: 只注入該 Story 相關函式，fallback 全部
        const storyFns = allFns.filter(fn => fn.storyId === state.story);
        fnsToShow = storyFns.length > 0 ? storyFns : allFns;
      }

      if (fnsToShow.length > 0) {
        lines.push('');
        lines.push(`📋 現有函式清單 (functions.json, ${fnsToShow.length}/${allFns.length}):`);

        // M11: 先列出 MODIFY 函式警示
        const modifyFns = fnsToShow.filter(fn =>
          (fn.evolution || '').toUpperCase() === 'MODIFY' ||
          (fn.name || '').includes('[Modify]')
        );
        if (modifyFns.length > 0) {
          lines.push(`  ⚠️ evolution=MODIFY 函式（修改既有實作，請勿重新建立）:`);
          for (const fn of modifyFns) {
            const risk = fn.risk || fn.priority || '?';
            const storyId = fn.storyId ? ` | ${fn.storyId}` : '';
            lines.push(`    ⚠️ ${fn.name} | ${risk} | ${fn.file}${storyId}`);
          }
        }

        for (const fn of fnsToShow) {
          const risk = fn.risk || fn.priority || '?';
          const storyId = fn.storyId ? ` | ${fn.storyId}` : '';
          const isModify = (fn.evolution || '').toUpperCase() === 'MODIFY' || (fn.name || '').includes('[Modify]');
          const prefix = isModify ? '  ⚠️' : '  -';
          lines.push(`${prefix} ${fn.name} | ${risk} | ${fn.file} | ${fn.flow}${storyId}`);
        }
        lines.push('');
      }
    } catch (e) { /* ignore parse errors */ }
  }
  // ========== /HUB ==========

  // Story progress
  if (state.plannedStories?.length > 0) {
    lines.push('');
    lines.push(`📊 Story 進度: ${state.completedStories?.length || 0}/${state.plannedStories.length}`);
    for (const s of state.plannedStories) {
      const done = state.completedStories?.includes(s);
      const icon = done ? '✅' : (s === state.story ? '🔨' : '⏳');
      const status = done ? 'DONE' : (s === state.story ? `BUILD Phase ${state.step || '?'}` : 'PENDING');
      lines.push(`   ${icon} ${s}: ${status}`);
    }
  }

  // Special states
  if (state.phase === 'NO_DRAFT') {
    // v6: draft 集中在 .gems/design/
    const draftTarget = `${projectRoot}/.gems/design/draft_iter-${iterNum}.md`;
    lines.push('');
    lines.push('@ARCHITECT: 找不到 draft — 啟動 Blueprint Architect 引導模式');
    lines.push('');
    lines.push('════════════════════════════════════════════════');
    lines.push('  SDID Blueprint Architect — 互動式需求引導');
    lines.push('════════════════════════════════════════════════');
    lines.push('');
    lines.push('@TASK');
    lines.push('ACTION: 以下列 5 輪對話引導使用者，完成後自行撰寫 draft 存檔');
    lines.push(`FILE: ${draftTarget}`);
    lines.push('');
    // M26: CYNEFIN 提前觸發 — Blueprint Round 1 前加輕量 quick-scan
    lines.push('─── Quick-Scan (M26): 複雜度預判 ────────────');
    lines.push('在開始 5 輪對話前，先問使用者這 2 個問題：');
    lines.push('  Q1: 這個功能有沒有「不確定的部分」？（第三方 API / 演算法 / 未知資料格式）');
    lines.push('  Q2: 有沒有「可能變動的規則」？（業務邏輯 / 計算公式 / 外部依賴）');
    lines.push('判斷：');
    lines.push('  - 兩個都「沒有」→ Complicated（繼續 Blueprint 5 輪）');
    lines.push('  - 任一「有」→ Complex/Chaotic → 建議先走 POC-FIX 驗證，再回 Blueprint');
    lines.push('  ⚠️ Chaotic domain 提早發現，避免 5 輪對話後才發現需要 POC');
    lines.push('');
    lines.push('─── Round 1: 目標釐清 ───────────────────────');
    lines.push('問使用者:');
    lines.push('  1. 這個系統要解決什麼問題？（一句話，≥10 字）');
    lines.push('  2. 誰會用？（列出角色 + 每個角色的主要任務）');
    lines.push('  3. 有沒有「彈性/可變/不固定」的需求？（觸發變異點分析）');
    lines.push('確認後輸出: 一句話目標 + 族群識別表');
    lines.push('');
    lines.push('─── Round 2: 實體識別 ───────────────────────');
    lines.push('問使用者:');
    lines.push('  系統需要管理哪些資料？每筆資料有什麼欄位？');
    lines.push('確認後輸出: 實體定義表格（欄位/型別/約束）');
    lines.push('');
    lines.push('─── Round 3: 模組拆分 ───────────────────────');
    lines.push('問使用者:');
    lines.push('  哪些功能是所有人共用的？哪些是特定角色專屬的？');
    lines.push('確認後輸出: 模組清單 + 每個模組的公開 API + 樣式策略');
    lines.push('');
    lines.push('─── Round 4: 迭代規劃 ───────────────────────');
    lines.push('問使用者:');
    lines.push('  第一版 MVP 要做到什麼程度？哪些可以後面再做？');
    lines.push('確認後輸出: 迭代規劃表（七欄: Iter/範圍/目標/模組/交付/依賴/狀態）');
    lines.push('⚠️ 規則: Iter-1 = Foundation (型別+介面契約+前端殼)，功能性 iter 必須是垂直切片');
    lines.push('');
    lines.push('─── Round 5: 動作細化 ───────────────────────');
    lines.push('問使用者:');
    lines.push('  每個模組具體要做哪些操作？資料怎麼流動？');
    lines.push('確認後輸出: 動作清單（業務語意/類型/技術名稱/P/流向/依賴/操作/狀態）');
    lines.push('⚠️ 動作類型: CONST/LIB/API/SVC/HOOK/UI/ROUTE');
    lines.push('⚠️ 優先級: P0=端到端協議 P1=跨模組整合 P2=獨立功能 P3=輔助');
    lines.push('⚠️ flow 必須描述業務行為，不是框架機制:');
    lines.push('   ✅ UI: FETCH_DATA→RENDER→BIND_EVENTS');
    lines.push('   ❌ 禁止: CONFIG→MOUNT→RENDER');
    lines.push('   ✅ HOOK: CALL_API→UPDATE_STATE→RETURN');
    lines.push('   ❌ 禁止: USESTATE→USEEFFECT→RETURN');
    lines.push('');
    lines.push('─── 完成後: 寫入 Blueprint + Draft ─────────');
    lines.push('');
    lines.push('⭐ v6 結構（新專案）: design/ 集中管理設計文件');
    lines.push(`  選項 A（有全局藍圖）:`);
    lines.push(`    1. 寫 Blueprint: ${projectRoot}/.gems/design/blueprint.md`);
    lines.push(`       格式: task-pipe/templates/blueprint-golden.template.v5.md`);
    lines.push(`       範例: task-pipe/templates/examples/blueprint-ecotrack.example.v5.md`);
    lines.push(`       內容: 目標/實體/路由/迭代規劃/API摘要（不含動作清單）`);
    lines.push('');
    lines.push(`    2. 寫 Draft iter-${iterNum}: ${draftTarget}`);
    lines.push(`       格式: task-pipe/templates/draft-iter-golden.template.v5.md`);
    lines.push(`       範例: task-pipe/templates/examples/draft-iter-1-ecotrack.example.v5.md`);
    lines.push(`       內容: 動作清單 + AC 骨架（單一 iter 的業務語意規格）`);
    lines.push('');
    lines.push(`  選項 B（直接從 draft 開始）:`);
    lines.push(`    寫 ${draftTarget}`);
    lines.push(`    格式: task-pipe/templates/draft-iter-golden.template.v5.md`);
    lines.push(`    範例: task-pipe/templates/examples/draft-iter-1-ecotrack.example.v5.md`);
    lines.push('');
    lines.push('@NEXT_COMMAND: 寫完後再次呼叫 sdid-loop 繼續流程');
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }

  if (state.phase === 'COMPLETE') {
    lines.push('');
    lines.push('@PASS: iter-' + iterNum + ' 全部完成！');
    lines.push(`<promise>${state.draftPath ? 'BLUEPRINT' : 'GEMS'}-COMPLETE</promise>`);
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }

  // 所有路線：VERIFY 前先確認 SCAN 已完成（統一後處理流程）
  if (state.phase === 'VERIFY') {
    const hasScanLog = (() => {
      try {
        const logsDir = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'logs');
        return fs.existsSync(logsDir) &&
          fs.readdirSync(logsDir).some(f => f.startsWith('scan-scan-pass-'));
      } catch { return false; }
    })();
    if (!hasScanLog) {
      state.phase = 'SCAN';
      lines.push(`↪️  ${detectedRoute}: VERIFY 前先執行 SCAN`);
    }
  }

  // Execute the appropriate tool
  lines.push('');
  let result;

  switch (state.phase) {
    case 'GATE': {
      if (!state.draftPath) { lines.push('@BLOCKER: 找不到 draft 檔案'); return { content: [{ type: 'text', text: lines.join('\n') }] }; }
      // v6 路線：design/blueprint.md + design/draft_iter-N.md + iter-N/contract_iter-N.ts
      const blueprintPath = stateMachine.findBlueprint(projectRoot);
      const contractV6Path = stateMachine.findContractV6(projectRoot, iterNum);
      const draftV6Path = stateMachine.findDraftV6(projectRoot, iterNum);

      if (draftV6Path || blueprintPath) {
        // v6 流程
        if (contractV6Path) {
          lines.push(`🚀 執行: contract-gate v5 (v6 路徑)`);
          result = await runCli('blueprint/v5/contract-gate.cjs', [`--contract=${contractV6Path}`, `--target=${projectRoot}`, `--iter=${iterNum}`]);
        } else if (draftV6Path) {
          lines.push(`🚀 執行: draft-gate v5 (v6 路徑)`);
          const draftArgs = [`--draft=${draftV6Path}`, `--target=${projectRoot}`];
          if (blueprintPath) draftArgs.push(`--blueprint=${blueprintPath}`);
          result = await runCli('blueprint/v5/draft-gate.cjs', draftArgs);
        } else if (blueprintPath) {
          lines.push(`🚀 執行: blueprint-gate v5`);
          result = await runCli('blueprint/v5/blueprint-gate.cjs', [`--blueprint=${blueprintPath}`, `--target=${projectRoot}`]);
        }
      } else {
        // v5 legacy: enhanced draft → gate.cjs
        lines.push(`🚀 執行: blueprint-gate.cjs (v5 legacy)`);
        result = await runCli('blueprint/gate.cjs', [`--draft=${state.draftPath}`, `--target=${projectRoot}`, `--iter=${iterNum}`]);
      }
      break;
    }
    case 'PLAN': {
      const iterPath = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`);
      const logsDir = path.join(iterPath, 'logs');

      // Task-Pipe 路線：補齊 Blueprint 的三個品質關卡（CYNEFIN + spec-to-plan + CONTRACT quality gate）
      // Blueprint 路線：contract 已在 CONTRACT phase 通過 quality gate，直接 spec-to-plan 即可
      if (detectedRoute === 'Task-Pipe') {
        // ─── Step A: CYNEFIN-CHECK（強制，未通過不得進 spec-to-plan）─────────────────
        const cynefinPassed = fs.existsSync(logsDir) &&
          fs.readdirSync(logsDir).some(f => f.startsWith('cynefin-check-pass'));
        if (!cynefinPassed) {
          const pocPath = path.join(iterPath, 'poc');
          let inputFile = null;
          if (fs.existsSync(pocPath)) {
            const files = fs.readdirSync(pocPath);
            inputFile = files.find(f => f.startsWith('requirement_spec_')) || files.find(f => f.startsWith('requirement_draft_'));
          }
          const inputPath = inputFile ? path.join(pocPath, inputFile) : path.join(iterPath, 'poc', `requirement_spec_iter-${iterNum}.md`);
          lines.push('');
          lines.push('⚠️  [Task-Pipe] PLAN 前強制 CYNEFIN-CHECK（對齊 Blueprint 路線品質標準）');
          lines.push('');
          lines.push('@TASK');
          lines.push(`ACTION: 讀 .agent/skills/sdid/references/cynefin-check.md 對以下文件做語意域分析`);
          lines.push(`FILE: ${inputPath}`);
          lines.push(`EXPECTED: 產出 report JSON → 執行 node sdid-tools/cynefin-log-writer.cjs --report-file=<report.json> --target=${projectRoot} --iter=${iterNum}`);
          lines.push('');
          lines.push('@REMINDER: cynefin-log-writer @PASS 後再次呼叫 sdid-loop 繼續');
          return { content: [{ type: 'text', text: lines.join('\n') }] };
        }

        // ─── Step B: spec-to-plan（contract.ts + plan 骨架生成）─────────────────────
        const contractPath = path.join(iterPath, 'poc', `contract_iter-${iterNum}.ts`);
        const contractQualityPassed = fs.existsSync(logsDir) &&
          fs.readdirSync(logsDir).some(f => f.startsWith('contract-quality-pass'));

        if (!fs.existsSync(contractPath)) {
          // contract.ts 不存在 → 先跑 spec-to-plan（生成 contract.ts + plan 骨架）
          lines.push(`🚀 [Task-Pipe] CYNEFIN ✓ → 執行 spec-to-plan.cjs (contract/spec → plan 機械轉換)`);
          result = await runCli('../task-pipe/tools/spec-to-plan.cjs', [`--target=${projectRoot}`, `--iteration=iter-${iterNum}`]);
          break;
        }

        // ─── Step B.5: PLAN 產物品質 gate（spec-to-plan 輸出，門檻 80）──────────────────
        const planQualityPassed = fs.existsSync(logsDir) &&
          fs.readdirSync(logsDir).some(f => f.startsWith('plan-quality-pass'));
        if (!planQualityPassed) {
          const planDir = path.join(iterPath, 'plan');
          const planFiles = fs.existsSync(planDir)
            ? fs.readdirSync(planDir).filter(f => f.startsWith('implementation_plan_'))
            : [];
          if (planFiles.length > 0) {
            lines.push('');
            lines.push('📋 [Task-Pipe] PLAN Quality Gate（spec-to-plan 機械輸出品質審查，門檻 80 / 4 維度）');
            lines.push('');
            lines.push('@TASK');
            lines.push(`ACTION: 讀 .agent/skills/sdid/references/design-quality-gate.md 的 PLAN 節點評分細則`);
            lines.push(`FILES: ${planFiles.map(f => path.join(planDir, f)).join(', ')}`);
            lines.push('EXPECTED: 對所有 implementation_plan_Story-*.md 執行 80 分制 4 維度評分:');
            lines.push('  ① STORY-ITEM 完整性（30pts）— 每個 Item 都有 Type/Priority/File/GEMS-FLOW 欄位');
            lines.push('  ② GEMS-FLOW 非佔位符（25pts）— 無 TODO/TBD/待定，每個 STEP 有明確語意');
            lines.push('  ③ AC 映射正確性（25pts）— 同 CONTRACT gate [A][B][C] 三步交叉驗證:');
            lines.push('     [A] plan 裡的 // AC-X.Y 注解與 contract STORY-ITEM 最後欄一致');
            lines.push('     [B] 純計算函式對應 AC 有真實 INPUT/EXPECT（非佔位符）');
            lines.push('     [C] SVC/ROUTE 對應 AC 有 SKIP: MOCK — <理由>');
            lines.push('  ④ Story 範圍紀律（20pts）— 每個 Item 都明確標注所屬 Story，不跨 Story 混用');
            lines.push('');
            lines.push(`@PASS (≥80): 寫入 ${path.join(logsDir, 'plan-quality-pass-<timestamp>.log')}`);
            lines.push('  log 格式: @PASS | PLAN quality gate | Task-Pipe | <score>/100 | iter-' + iterNum);
            lines.push('  寫完後再次呼叫 sdid-loop 繼續 CONTRACT quality gate');
            lines.push('@GUIDED (55~79): 列出失分項 + 修法，AI 自行修正 implementation_plan_*.md，重評只有 @PASS 或 @FAIL');
            lines.push('  常見修法：補齊 GEMS-FLOW 語意、修正 AC 注解對齊 contract、補 SKIP 理由');
            lines.push('@FAIL (<55): 重新修改所有 implementation_plan_*.md，再次呼叫 sdid-loop');
            lines.push('');
            lines.push('@REMINDER: plan-quality-pass log 寫入後才進 CONTRACT quality gate');
            return { content: [{ type: 'text', text: lines.join('\n') }] };
          }
        }

        // ─── Step C: CONTRACT quality gate（與 Blueprint CONTRACT gate 同規格，門檻 90）──
        if (!contractQualityPassed) {
          lines.push('');
          lines.push('📋 [Task-Pipe] CONTRACT Quality Gate（對齊 Blueprint 標準，門檻 90 / 5 維度）');
          lines.push('');
          lines.push('@TASK');
          lines.push(`ACTION: 讀 .agent/skills/sdid/references/design-quality-gate.md 的 CONTRACT 節點評分細則`);
          lines.push(`FILE: ${contractPath}`);
          lines.push('EXPECTED: 對 contract.ts 執行 90 分制 5 維度評分:');
          lines.push('  ① Interface 完整性（25pts）— spec §5.5 每個函式都有對應 STORY-ITEM');
          lines.push('  ② 型別具體性（20pts）— 無 any / unknown / 裸 object');
          lines.push('  ③ AC 映射正確性 + TDD LITE（25pts）— 三步交叉驗證:');
          lines.push('     [A] 列出所有 STORY-ITEM 最後一欄非 "-" 的項目 → 得到 [(funcName, AC-X.Y), ...]');
          lines.push('         對每一對找 @GEMS-AC: AC-X.Y，取 @GEMS-AC-FN，比對 funcName == @GEMS-AC-FN');
          lines.push('         不相等 → 每個扣 8（常見錯誤：同函式多個 AC 時，第一個 AC 被塞給前一個 STORY-ITEM）');
          lines.push('     [B] 純計算函式（LIB/CONST 無外部依賴）的 @GEMS-AC 必須有真實 INPUT + EXPECT，非佔位符');
          lines.push('         缺 INPUT/EXPECT → 每個扣 8');
          lines.push('     [C] SVC/ROUTE 等有外部依賴者：最後一欄應為 "-"，@GEMS-AC-SKIP: MOCK — <理由>');
          lines.push('         缺 SKIP 理由 → 每個扣 5');
          lines.push('  ④ AC 邊界覆蓋（20pts）— 純計算函式至少 1 正常案例 + 1 邊界/錯誤案例');
          lines.push('  ⑤ 命名一致性（10pts）— 與 requirement_spec 實體名稱完全對齊');
          lines.push('');
          lines.push(`@PASS (≥90): 寫入 ${path.join(logsDir, 'contract-quality-pass-<timestamp>.log')}`);
          lines.push('  log 格式: @PASS | CONTRACT quality gate | Task-Pipe | <score>/100 | iter-' + iterNum);
          lines.push('  寫完後再次呼叫 sdid-loop 繼續進 BUILD');
          lines.push('@GUIDED (65~89): 列出失分項 + 修法，AI 自行修正 contract.ts，重評只有 @PASS 或 @FAIL');
          lines.push('  若 STORY-ITEM 結構異動，需重跑 spec-to-plan 重新生成 plan 骨架');
          lines.push('@FAIL (<65): 重新修改 contract.ts，再次呼叫 sdid-loop');
          lines.push('');
          lines.push('@REMINDER: contract-quality-pass log 寫入後才能進 BUILD');
          return { content: [{ type: 'text', text: lines.join('\n') }] };
        }

        // ─── Step D: VSC 垂直切片完整性預檢（避免 Phase 1 VSC-002 BLOCK）──────────────
        const planDir = path.join(iterPath, 'plan');
        const planFiles = fs.existsSync(planDir)
          ? fs.readdirSync(planDir).filter(f => f.startsWith('implementation_plan_'))
          : [];
        const vscPassed = fs.existsSync(logsDir) &&
          fs.readdirSync(logsDir).some(f => f.startsWith('vsc-precheck-pass'));
        if (!vscPassed && planFiles.length > 0) {
          // 快速掃描每個 plan 是否有 ROUTE 但缺 SVC/API
          const vscViolations = [];
          for (const pf of planFiles) {
            const pfContent = fs.readFileSync(path.join(planDir, pf), 'utf8');
            const types = (pfContent.match(/\|\s*(ROUTE|SVC|API|HOOK|UI|DATA|CONST|LIB)\s*\|/gi) || [])
              .map(m => m.replace(/\|/g, '').trim().toUpperCase());
            const hasRoute = types.includes('ROUTE') || types.includes('UI');
            const hasSvc = types.includes('SVC') || types.includes('API');
            const storyMatch = pf.match(/Story-[\d.]+/i);
            if (hasRoute && !hasSvc) {
              vscViolations.push(storyMatch ? storyMatch[0] : pf);
            }
          }
          if (vscViolations.length > 0) {
            lines.push('');
            lines.push(`⚠️  [Task-Pipe] VSC Pre-check: ${vscViolations.join(', ')} 有 ROUTE 但缺 SVC/API — Phase 1 會 BLOCK`);
            lines.push('');
            lines.push('@TASK');
            lines.push(`ACTION: 修正以下 Story 的 implementation_plan，補齊 SVC 層`);
            lines.push(`Stories: ${vscViolations.join(', ')}`);
            lines.push('RULE: 每個 Feature Story 必須有 ROUTE + SVC 組合（垂直切片完整性）');
            lines.push('  - 純前端協調邏輯（CSV 下載、ICS 生成）→ 在 services/ 建 browser-side SVC');
            lines.push('  - 資料查詢 → 在 services/ 建 query SVC');
            lines.push('  - 純 LIB+ROUTE 沒有協調邏輯 → 補一個輕量 SVC 作為呼叫入口');
            lines.push(`範例: | downloadCsvTemplate | SVC | P2 | 明確 | GENERATE→BLOB→DOWNLOAD |`);
            lines.push('');
            lines.push('修正後寫入 vsc-precheck-pass log:');
            lines.push(`  log 格式: @PASS | vsc-precheck | VSC 完整性通過 | iter-${iterNum}`);
            lines.push(`  log 路徑: ${path.join(logsDir, 'vsc-precheck-pass-<timestamp>.log')}`);
            lines.push('  寫完後再次呼叫 sdid-loop 繼續 plan-to-scaffold');
            return { content: [{ type: 'text', text: lines.join('\n') }] };
          }
          // 沒有違規，直接寫 pass log
          fs.mkdirSync(logsDir, { recursive: true });
          const vscTs = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          fs.writeFileSync(
            path.join(logsDir, `vsc-precheck-pass-${vscTs}.log`),
            `@PASS | vsc-precheck | VSC 完整性通過（全部 Story 有 ROUTE+SVC）| iter-${iterNum}\n`
          );
        }

        // ─── Step E: plan-to-scaffold（預建 .ts 骨架，Phase 1 只填實作）───────────────
        const scaffoldGenerated = fs.existsSync(logsDir) &&
          fs.readdirSync(logsDir).some(f => f.startsWith('scaffold-generated-pass'));
        if (!scaffoldGenerated && planFiles.length > 0) {
          lines.push(`🔧 [Task-Pipe] plan-to-scaffold: 預建骨架 .ts 檔案 (${planFiles.length} 個 Story)`);
          let scaffoldFailed = false;
          for (const pf of planFiles) {
            const scaffoldResult = await runCli('plan-to-scaffold.cjs', [
              `--plan=${path.join(planDir, pf)}`,
              `--target=${projectRoot}`
            ]);
            if (!scaffoldResult.ok) {
              lines.push(`⚠️  plan-to-scaffold 部分失敗: ${pf} (繼續執行)`);
              scaffoldFailed = true;
            }
          }
          fs.mkdirSync(logsDir, { recursive: true });
          const scaffoldTs = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          fs.writeFileSync(
            path.join(logsDir, `scaffold-generated-pass-${scaffoldTs}.log`),
            `@PASS | scaffold-generated | plan-to-scaffold ${scaffoldFailed ? '部分' : ''}完成 | ${planFiles.length} 個 Story | iter-${iterNum}\n`
          );
          lines.push('✅ scaffold-generated 完成 → 骨架 .ts 已預建，Phase 1 只需填實作');
          result = { output: lines.join('\n'), exitCode: 0 };
          break;
        }

        // ─── CYNEFIN ✓ + spec-to-plan ✓ + CONTRACT quality gate ✓ + scaffold ✓ → BUILD ─
        lines.push('✅ [Task-Pipe] PLAN 完成（CYNEFIN ✓ + CONTRACT Quality Gate ✓ + scaffold ✓）');
        result = { output: '@PASS: Task-Pipe PLAN 完成\nNEXT: BUILD', exitCode: 0 };
        break;
      }

      // Blueprint / Unknown 路線：contract 已在 CONTRACT phase 通過 quality gate，直接 spec-to-plan
      lines.push(`🚀 執行: spec-to-plan.cjs (contract/spec → plan 機械轉換)`);
      result = await runCli('../task-pipe/tools/spec-to-plan.cjs', [`--target=${projectRoot}`, `--iteration=iter-${iterNum}`]);
      break;
    }
    case 'BUILD': {
      const buildStory = state.story || state.plannedStories?.[0];
      if (!buildStory) { lines.push('@BLOCKER: 找不到待執行的 Story'); return { content: [{ type: 'text', text: lines.join('\n') }] }; }
      const buildStep = state.step || 1;
      lines.push(`🚀 執行: runner.cjs BUILD Phase ${buildStep} ${buildStory}`);

      // M23: Per-step Subagent 提示 — 每個 Phase 建議用獨立 subagent 執行，context 隔離
      const subagentHints = {
        1: { complexity: 'HIGH', model: 'full', reason: '骨架映射層：需讀 plan + contract + ac，context 重，建議獨立 subagent' },
        2: { complexity: 'MEDIUM', model: 'full', reason: 'AC 驗收層：需執行 ac-runner，邏輯密集，建議獨立 subagent' },
        3: { complexity: 'LOW', model: 'lite', reason: '整合層：路由/barrel export，機械性任務，可用輕量模型' },
        4: { complexity: 'LOW', model: 'lite', reason: '標籤品質層：GEMS tag 複查 + Fillback，機械性任務，可用輕量模型' },
      };
      const hint = subagentHints[buildStep];
      if (hint) {
        lines.push(`💡 @SUBAGENT-HINT | Phase ${buildStep} | complexity=${hint.complexity} | model=${hint.model}`);
        lines.push(`   ${hint.reason}`);
        lines.push(`   建議: 用獨立 subagent 執行此 Phase，避免 context 污染前後 Phase`);
      }

      result = await runRunner([`--phase=BUILD`, `--step=${buildStep}`, `--story=${buildStory}`, `--target=${projectRoot}`, `--iteration=iter-${iterNum}`]);
      break;
    }
    case 'SHRINK': {
      // SHRINK 已移為可選工具，自動流程不再強制執行
      // 若由 forceStart=SHRINK 觸發，仍可手動執行（向後相容）
      lines.push(`ℹ️  SHRINK 已移為可選工具，自動跳至下一階段`);
      lines.push(`💡 若需壓縮 GEMS 標籤，請手動執行: node task-pipe/tools/shrink-tags.cjs --target=${projectRoot}`);
      lines.push(`💡 若需壓縮 draft/plan 文件，請手動執行: node sdid-tools/blueprint/shrink.cjs --draft=<draft> --target=${projectRoot} --iter=${iterNum}`);
      lines.push('');
      // 統一重導向至 SCAN（所有路線 BUILD 後先 SCAN 再 VERIFY）
      lines.push(`↪️  自動重導向至: SCAN`);
      lines.push(`🚀 執行: runner.cjs SCAN`);
      result = await runRunner([`--phase=SCAN`, `--target=${projectRoot}`, `--iteration=iter-${iterNum}`]);
      break;
    }
    case 'VERIFY': {
      // M25: Adversarial Review — VERIFY 前先跑 contract vs 源碼語意飄移檢查
      // v6: contract 在 iter-N/ 下
      const contractV6Path = stateMachine.findContractV6(projectRoot, iterNum);
      if (contractV6Path) {
        const reviewLogDir = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'logs');
        const hasReviewLog = fs.existsSync(reviewLogDir) &&
          fs.readdirSync(reviewLogDir).some(f => f.startsWith('adversarial-review-pass-'));
        if (!hasReviewLog) {
          lines.push(`🔍 M25 Adversarial Review: contract vs 源碼語意飄移檢查`);
          result = await runCli('blueprint/v5/adversarial-reviewer.cjs', [
            `--contract=${contractV6Path}`,
            `--target=${projectRoot}`,
            `--iter=${iterNum}`,
          ]);
          // 如果 @DRIFT，停在這裡讓 AI 修復
          if (!result.ok) break;
          lines.push(`✅ Adversarial Review PASS → 繼續 VERIFY`);
        }
      }
      // v6: draft 在 design/draft_iter-N.md
      let verifyInput = stateMachine.findDraftV6(projectRoot, iterNum)
        || stateMachine.findBlueprint(projectRoot)
        || state.draftPath;
      if (!verifyInput) {
        if (effectiveRoute === 'POC-FIX' || effectiveRoute === 'MICRO-FIX') {
          lines.push(`ℹ️  ${effectiveRoute}: 無 draft，VERIFY 自動通過（SCAN 已驗收）`);
          const logsDir = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'logs');
          fs.mkdirSync(logsDir, { recursive: true });
          const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          fs.writeFileSync(path.join(logsDir, `gate-verify-pass-${ts}.log`), `${effectiveRoute} VERIFY: auto-pass (no draft)\n@PASS\n`);
          result = { output: `@PASS: ${effectiveRoute} VERIFY 自動通過`, exitCode: 0 };
          break;
        }
        lines.push('@BLOCKER: 找不到 draft 檔案（預期位置: .gems/design/draft_iter-N.md）');
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      }
      lines.push(`🚀 執行: blueprint-verify.cjs`);
      result = await runCli('blueprint/verify.cjs', [`--draft=${verifyInput}`, `--target=${projectRoot}`, `--iter=${iterNum}`]);
      break;
    }
    case 'POC': {
      const pocStep = String(state.step || '1');
      const iterPath = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`);
      const logsDir = path.join(iterPath, 'logs');
      const pocDir = path.join(iterPath, 'poc');

      // ─── Step 3 後置 gate: TDD LITE 交叉驗證（contract 寫完後立即執行）──────────────
      if (pocStep === '3') {
        const contractPath = path.join(pocDir, `contract_iter-${iterNum}.ts`);
        const tddPassed = fs.existsSync(logsDir) &&
          fs.readdirSync(logsDir).some(f => f.startsWith('poc-step-3-tdd-pass'));
        if (fs.existsSync(contractPath) && !tddPassed) {
          lines.push('');
          lines.push('📋 [Task-Pipe] POC Step 3 TDD LITE Gate（contract 寫完後強制 AC cross-check）');
          lines.push('');
          lines.push('@TASK');
          lines.push(`ACTION: 對 ${contractPath} 執行 TDD LITE 交叉驗證（在進 Step 4 前完成）`);
          lines.push('步驟:');
          lines.push('  [A] 列出所有 STORY-ITEM 最後一欄非 "-" 的項目 → [(funcName, AC-X.Y), ...]');
          lines.push('      對每一對找 @GEMS-AC: AC-X.Y，取 @GEMS-AC-FN，確認 funcName == @GEMS-AC-FN');
          lines.push('      ❌ 常見錯誤：同函式有多個 AC（邊界測試）時，第一個 AC 孤兒化被塞給上一個 STORY-ITEM');
          lines.push('  [B] 純計算函式（LIB/CONST）的 @GEMS-AC 必須有真實 @GEMS-AC-INPUT + @GEMS-AC-EXPECT（非佔位符）');
          lines.push('  [C] SVC/ROUTE 有外部依賴者：最後一欄應為 "-"，對應 @GEMS-AC-SKIP: MOCK — <理由>');
          lines.push('');
          lines.push('若有問題：直接修正 contract.ts，無需重跑 Step 3');
          lines.push(`無問題或修正完成後，寫入 log 格式: @PASS | poc-step-3-tdd | TDD LITE 交叉驗證通過 | iter-${iterNum}`);
          lines.push(`log 路徑: ${path.join(logsDir, `poc-step-3-tdd-pass-<timestamp>.log`)}`);
          lines.push('寫完後再次呼叫 sdid-loop 繼續 Step 4');
          return { content: [{ type: 'text', text: lines.join('\n') }] };
        }
      }

      // ─── Step 4 後置 gate: POC.HTML quality gate（design-quality-gate.md 75pt）────────
      if (pocStep === '4') {
        const pocFiles = fs.existsSync(pocDir) ? fs.readdirSync(pocDir).filter(f => f.endsWith('.html')) : [];
        const htmlQualityPassed = fs.existsSync(logsDir) &&
          fs.readdirSync(logsDir).some(f => f.startsWith('poc-html-quality-pass'));
        if (pocFiles.length > 0 && !htmlQualityPassed) {
          const pocHtml = path.join(pocDir, pocFiles[0]);
          lines.push('');
          lines.push('📋 [Task-Pipe] POC Step 4 HTML Quality Gate（design-quality-gate.md 75pt 評分）');
          lines.push('');
          lines.push('@TASK');
          lines.push(`ACTION: 讀 .agent/skills/sdid/references/design-quality-gate.md POC.HTML 節點評分細則`);
          lines.push(`FILE: ${pocHtml}`);
          lines.push('EXPECTED: 75 分制 4 維度 @GUIDED 三態評分:');
          lines.push('  ① Spec 路由覆蓋（30pts）— draft/spec 每個路由都有示意畫面');
          lines.push('  ② 實體名稱與 spec 一致（25pts）— 畫面名稱與 spec 定義對齊');
          lines.push('  ③ 關鍵互動可操作（25pts）— 非純靜態，submit 有 mock 反應');
          lines.push('  ④ 無佔位內容（20pts）— 無 Lorem ipsum / TODO / 空白欄位');
          lines.push('');
          lines.push(`@PASS (≥75): 寫入 ${path.join(logsDir, 'poc-html-quality-pass-<timestamp>.log')}`);
          lines.push('  log 格式: @PASS | poc-html-quality | <score>/100 | iter-' + iterNum);
          lines.push('  寫完後再次呼叫 sdid-loop 繼續 Step 5');
          lines.push('@GUIDED (50~74): 列出失分項 + 修法，AI 自行修正 HTML，重評只有 @PASS 或 @FAIL');
          lines.push('@FAIL (<50): 回到 Step 4 重新產生 POC HTML');
          return { content: [{ type: 'text', text: lines.join('\n') }] };
        }
      }

      lines.push(`🚀 執行: runner.cjs POC Step ${pocStep}`);
      result = await runRunner([`--phase=POC`, `--step=${pocStep}`, `--target=${projectRoot}`, `--iteration=iter-${iterNum}`]);
      break;
    }
    case 'SCAN': {
      lines.push(`🚀 執行: runner.cjs SCAN`);
      result = await runRunner([`--phase=SCAN`, `--target=${projectRoot}`, `--iteration=iter-${iterNum}`]);
      break;
    }
    case 'CYNEFIN_CHECK': {
      // Cynefin 語意域分析 — AI 手動執行，不走 runner
      const iterPath = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`);
      const pocPath = path.join(iterPath, 'poc');
      let inputFile = null;
      if (fs.existsSync(pocPath)) {
        const files = fs.readdirSync(pocPath);
        inputFile = files.find(f => f.startsWith('requirement_draft_')) || files.find(f => f.startsWith('requirement_spec_'));
      }
      const inputPath = inputFile ? path.join(pocPath, inputFile) : `${iterPath}/poc/requirement_draft_iter-${iterNum}.md`;

      lines.push(`🔍 CYNEFIN-CHECK: 語意域分析`);
      lines.push('');
      lines.push('@TASK');
      lines.push(`ACTION: 讀 .agent/skills/sdid/references/cynefin-check.md 對以下文件做語意域分析`);
      lines.push(`FILE: ${inputPath}`);
      lines.push(`EXPECTED: 產出 report JSON → 執行 node sdid-tools/cynefin-log-writer.cjs --report-file=<report.json> --target=${projectRoot} --iter=${iterNum}`);
      lines.push('');
      lines.push('@REMINDER: 分析完成後必須執行 cynefin-log-writer.cjs 存 log，@PASS 才能進 CONTRACT');

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
    case 'CONTRACT': {
      const iterPath = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`);
      // v6: contract 在 iter-N/ 下（不在 iter-N/poc/）
      const contractPath = path.join(iterPath, `contract_iter-${iterNum}.ts`);

      // contract 已存在 → 直接跑 gate 驗證（含 dirty 重新 gate）
      if (fs.existsSync(contractPath)) {
        if (state.contractDirty) {
          lines.push(`🔄 CONTRACT: contract.ts 已變動，重新 gate 驗證`);
        } else {
          lines.push(`🚀 執行: blueprint-contract-writer.cjs (gate 驗證)`);
        }
        const writerArgs = [
          `--contract=${contractPath}`,
          `--target=${projectRoot}`,
          `--iter=${iterNum}`,
        ];
        if (state.draftPath) writerArgs.push(`--draft=${state.draftPath}`);
        result = await runCli('blueprint/contract-writer.cjs', writerArgs);
        break;
      }

      // contract 不存在 → 輸出 @TASK 讓 AI 從 draft 推導
      const draftPath = state.draftPath;
      lines.push(`📝 CONTRACT: 推導介面邊界`);
      lines.push('');
      lines.push('@TASK');
      lines.push('ACTION: 讀 draft，推導所有實體邊界，寫 contract_iter-N.ts');
      lines.push(`FILE: ${contractPath}`);
      lines.push('');
      lines.push('推導規則:');
      lines.push('1. 從「實體定義」區塊提取所有 Entity → 使用單行注釋格式:');
      lines.push('   // @GEMS-CONTRACT: EntityName');
      lines.push('   // @GEMS-TABLE: tbl_xxx (若有 DB，無 DB 可省略)');
      lines.push('   // @GEMS-STORY: Story-X.Y');
      lines.push('   export interface EntityName { ... }');
      lines.push('   ⚠️ 禁止用 JSDoc /** @GEMS-CONTRACT */ 格式，必須是 // 單行注釋');
      lines.push('2. 每個欄位加 DB 型別註解（VARCHAR/UUID/INT/DECIMAL/ENUM/TIMESTAMP）');
      lines.push('3. 為每個 Entity 建立對應的 View（前端不需要的欄位標 api-only）');
      lines.push('4. 從「模組動作清單」的 API 欄位提取 → @GEMS-API interface');
      lines.push('5. 每個 @GEMS-CONTRACT/@GEMS-API 標註對應的 @GEMS-STORY');
      lines.push('6. ⭐ 加入 @GEMS-STORY + @GEMS-STORY-ITEM 區塊（plan-generator 的唯一輸入）:');
      lines.push('   // ─── STORIES ─────────────────────────────────────────────');
      lines.push('   // @GEMS-STORY: Story-1.0 | shared | 基礎建設 | INFRA');
      lines.push('   // @GEMS-STORY-ITEM: CoreTypes | CONST | P0 | DEFINE→FREEZE→EXPORT | 無 | AC-0.0');
      lines.push('   // @GEMS-STORY-ITEM: AppRouter | ROUTE | P1 | CHECK_AUTH→LOAD_LAYOUT→RENDER_ROUTES | [Internal.CoreTypes] | AC-0.2');
      lines.push('   格式: name | type | priority | flow | deps | AC-id');
      lines.push('');
      lines.push('7. ⭐ TDD LITE 交叉驗證（寫完 STORY-ITEM 後立即執行，防止 AC 飄移）:');
      lines.push('   [A] 列出所有 STORY-ITEM 最後一欄非 "-" 的項目 → [(funcName, AC-X.Y), ...]');
      lines.push('       對每一對找 @GEMS-AC: AC-X.Y，取 @GEMS-AC-FN，確認 funcName == @GEMS-AC-FN');
      lines.push('       ❌ 常見錯誤：同函式有多個 AC（邊界測試）時，第一個 AC 孤兒化被塞給上一個 STORY-ITEM');
      lines.push('   [B] 純計算函式（LIB/CONST）的 @GEMS-AC 必須有真實 @GEMS-AC-INPUT + @GEMS-AC-EXPECT');
      lines.push('   [C] SVC/ROUTE 有依賴者：最後一欄為 "-"，對應 @GEMS-AC-SKIP: MOCK — <理由>');
      lines.push('');
      lines.push('格式參考: task-pipe/templates/contract-golden.template.v3.ts');
      lines.push('範例: task-pipe/templates/examples/contract-iter-1-ecotrack.example.v3.ts');
      if (draftPath) lines.push(`Draft: ${draftPath}`);
      lines.push('');
      lines.push(`@EXPECTED: 寫完後執行:`);
      lines.push(`node sdid-tools/blueprint/contract-writer.cjs --contract=${contractPath} --target=${projectRoot}${draftPath ? ` --draft=${draftPath}` : ''} --iter=${iterNum}`);
      lines.push('');
      lines.push('@REMINDER: 執行 contract-writer @PASS 後再次呼叫 sdid-loop 繼續流程');
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
    case 'POC-FIX': {
      lines.push(`🚀 執行: micro-fix-gate.cjs (POC-FIX 路線)`);
      // v6: poc-fix 工作區在 iter-N/poc-fix/
      result = await runCli('poc-fix/micro-fix-gate.cjs', [`--target=${projectRoot}`, `--iter=${iterNum}`]);
      break;
    }
    case 'MICRO-FIX': {
      lines.push(`🚀 執行: micro-fix-gate.cjs`);
      result = await runCli('poc-fix/micro-fix-gate.cjs', [`--target=${projectRoot}`]);
      break;
    }
    default: {
      lines.push(`@BLOCKER: 未知狀態 ${state.phase}`);
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  }

  lines.push('');
  lines.push('─── 工具輸出 ───────────────────────────────');
  lines.push(result.output);
  lines.push('');
  lines.push('─── 導航指示 ───────────────────────────────');

  if (result.ok) {
    lines.push('✅ 執行完成');
    lines.push('');
    lines.push('@NEXT: 有 @TASK → 修完再呼叫 | 有 @PASS → 直接再呼叫 | 有 @BLOCKER → 修完再呼叫');
  } else {
    lines.push('❌ 執行失敗');
    lines.push('');
    // 主動找最新的 error log，注入 @READ_FIRST 讓 AI 直接讀結構化錯誤
    // 優先找當前 phase/story 相關的 log，避免抓到舊的 gate log
    const logsDir = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'logs');
    let latestErrorLog = null;
    try {
      const fs = require('fs');
      if (fs.existsSync(logsDir)) {
        const allErrorLogs = fs.readdirSync(logsDir)
          .filter(f => /-error-\d{4}-/.test(f) || f.includes('-blocker-'))
          .map(f => ({ name: f, mtime: fs.statSync(path.join(logsDir, f)).mtimeMs }))
          .sort((a, b) => b.mtime - a.mtime);

        // 優先：當前 phase + story 的 error log
        const phaseKey = state.phase === 'BUILD' ? `build-phase-${state.step}` : state.phase?.toLowerCase();
        const storyKey = state.story ? state.story.toLowerCase() : null;
        const specific = allErrorLogs.find(f => {
          const n = f.name.toLowerCase();
          return phaseKey && n.includes(phaseKey) && (!storyKey || n.includes(storyKey));
        });

        // Fallback：全域最新
        latestErrorLog = (specific || allErrorLogs[0])?.name || null;
      }
    } catch (e) { }

    if (latestErrorLog) {
      lines.push(`🛑 @READ_FIRST (必讀，禁止跳過): ${path.join(logsDir, latestErrorLog)}`);
      lines.push('  ↳ 此 log 含有 @TASK、EXPECTED、GATE_SPEC — 是唯一授權的修復依據');
      lines.push('  ↳ 未讀此 log 前，禁止修改任何程式碼');
    } else {
      lines.push('@NEXT: 請讀取上方錯誤訊息，修正問題後再次呼叫 sdid-loop');
      lines.push(`  logs 目錄: ${logsDir}`);
    }
  }

  lines.push('');
  lines.push('@FORBIDDEN ❌ 禁呼叫 spec-gen/scanner 等工具 | ❌ 禁讀框架腳本推斷邏輯 | ✅ 只照 @TASK 修復');

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}
