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
  有 requirement_draft → Blueprint 路線: GATE → CYNEFIN → CONTRACT → PLAN → BUILD (Phase 1-4) → VERIFY
  有 requirement_spec  → Task-Pipe 路線: POC → spec-to-plan → BUILD (Phase 1-4) → SCAN
  POC-FIX / MICRO-FIX 路線自動偵測。
每次呼叫會：(1) 偵測當前階段（由文件存在與否決定，不靠 route 參數） (2) 執行對應工具 (3) 回傳結果 + @TASK 或 @NEXT 指示。
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
      const phaseMap = { GATE: 'GATE', PLAN: 'PLAN', SHRINK: 'SHRINK', VERIFY: 'VERIFY', POC: 'POC', SCAN: 'SCAN', 'NEXT-ITER': 'NEXT_ITER', 'POC-FIX': 'POC-FIX', 'MICRO-FIX': 'MICRO-FIX', 'CYNEFIN-CHECK': 'CYNEFIN_CHECK', 'CYNEFIN': 'CYNEFIN_CHECK', 'CONTRACT': 'CONTRACT' };
      const phase = phaseMap[forceStart.toUpperCase()];
      if (!phase) {
        return { content: [{ type: 'text', text: `ERROR: 無效的 forceStart: ${forceStart}\n有效值: GATE, PLAN, BUILD-N, VERIFY, POC, SCAN, NEXT-ITER, POC-FIX, MICRO-FIX, CONTRACT\n💡 SHRINK 已移為可選工具，請直接執行: node task-pipe/tools/shrink-tags.cjs --target=<project>` }] };
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
  const shouldInjectFull = ['GATE', 'PLAN', 'POC'].includes(state.phase) ||
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
    const draftTarget = `${projectRoot}/.gems/iterations/iter-${iterNum}/poc/requirement_draft_iter-${iterNum}.md`;
    lines.push('');
    lines.push('@ARCHITECT: 找不到 requirement_draft — 啟動 Blueprint Architect 引導模式');
    lines.push('');
    lines.push('════════════════════════════════════════════════');
    lines.push('  SDID Blueprint Architect — 互動式需求引導');
    lines.push('════════════════════════════════════════════════');
    lines.push('');
    lines.push('@TASK');
    lines.push('ACTION: 以下列 5 輪對話引導使用者，完成後自行撰寫 draft 存檔');
    lines.push(`FILE: ${draftTarget}`);
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
    lines.push('─── 完成後: 寫入 draft ──────────────────────');
    lines.push(`@EXPECTED: 將完整活藍圖寫入 ${draftTarget}`);
    lines.push('格式參考: task-pipe/templates/enhanced-draft-golden.template.v2.md');
    lines.push('');
    lines.push('必要區塊:');
    lines.push('  - 一句話目標 (≥10 字)');
    lines.push('  - 族群識別表');
    lines.push('  - 實體定義');
    lines.push('  - 模組清單 + 公開 API + 樣式策略');
    lines.push('  - 迭代規劃表 (七欄)');
    lines.push('  - 動作清單 (含 P/flow/deps/操作欄位)');
    lines.push('  - 草稿狀態: [x] DONE');
    lines.push('  - 方法論: SDID v2.1');
    lines.push('');
    lines.push('@NEXT_COMMAND: 寫完 draft 後再次呼叫 sdid-loop 繼續流程');
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }

  if (state.phase === 'COMPLETE') {
    lines.push('');
    lines.push('@PASS: iter-' + iterNum + ' 全部完成！');
    lines.push(`<promise>${state.draftPath ? 'BLUEPRINT' : 'GEMS'}-COMPLETE</promise>`);
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }

  // Task-Pipe（無 draft）：BUILD 完成後 → SCAN（不經 VERIFY）
  if (!state.draftPath && state.phase === 'VERIFY') {
    const logsDir = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'logs');
    const hasScanLog = fs.existsSync(logsDir) &&
      fs.readdirSync(logsDir).some(f => f.startsWith('scan-pass-'));
    if (!hasScanLog) {
      state.phase = 'SCAN';
      lines.push(`↪️  Task-Pipe: VERIFY → SCAN（尚未執行 SCAN）`);
    }
  }

  // Execute the appropriate tool
  lines.push('');
  let result;

  switch (state.phase) {
    case 'GATE': {
      if (!state.draftPath) { lines.push('@BLOCKER: 找不到 draft 檔案'); return { content: [{ type: 'text', text: lines.join('\n') }] }; }
      lines.push(`🚀 執行: blueprint-gate.cjs`);
      result = await runCli('blueprint/gate.cjs', [`--draft=${state.draftPath}`, `--target=${projectRoot}`, `--iter=${iterNum}`]);
      break;
    }
    case 'PLAN': {
      if (state.draftPath) {
        // Blueprint：有 draft → draft-to-plan（含 contract 支援）
        lines.push(`🚀 執行: draft-to-plan.cjs`);
        const dtpArgs = [`--draft=${state.draftPath}`, `--iter=${iterNum}`, `--target=${projectRoot}`];
        result = await runCli('blueprint/draft-to-plan.cjs', dtpArgs);
      } else {
        // Task-Pipe：無 draft，spec 已有函式規格表 → spec-to-plan 機械轉換
        lines.push(`🚀 執行: spec-to-plan.cjs (spec → plan 機械轉換)`);
        result = await runCli('../task-pipe/tools/spec-to-plan.cjs', [`--target=${projectRoot}`, `--iteration=iter-${iterNum}`]);
      }
      break;
    }
    case 'BUILD': {
      const buildStory = state.story || state.plannedStories?.[0];
      if (!buildStory) { lines.push('@BLOCKER: 找不到待執行的 Story'); return { content: [{ type: 'text', text: lines.join('\n') }] }; }
      const buildStep = state.step || 1;
      lines.push(`🚀 執行: runner.cjs BUILD Phase ${buildStep} ${buildStory}`);
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
      // 根據文件存在與否決定下一步（無 draft → Task-Pipe → SCAN；有 draft → Blueprint → VERIFY）
      state.phase = state.draftPath ? 'VERIFY' : 'SCAN';
      lines.push(`↪️  自動重導向至: ${state.phase}`);
      // fall through to next phase by re-invoking logic below
      if (state.phase === 'SCAN') {
        lines.push(`🚀 執行: runner.cjs SCAN`);
        result = await runRunner([`--phase=SCAN`, `--target=${projectRoot}`, `--iteration=iter-${iterNum}`]);
        break;
      }
      if (!state.draftPath) { lines.push('@BLOCKER: 找不到 draft 檔案'); return { content: [{ type: 'text', text: lines.join('\n') }] }; }
      lines.push(`🚀 執行: blueprint-verify.cjs`);
      result = await runCli('blueprint/verify.cjs', [`--draft=${state.draftPath}`, `--target=${projectRoot}`, `--iter=${iterNum}`]);
      break;
    }
    case 'VERIFY': {
      if (!state.draftPath) { lines.push('@BLOCKER: 找不到 draft 檔案'); return { content: [{ type: 'text', text: lines.join('\n') }] }; }
      lines.push(`🚀 執行: blueprint-verify.cjs`);
      result = await runCli('blueprint/verify.cjs', [`--draft=${state.draftPath}`, `--target=${projectRoot}`, `--iter=${iterNum}`]);
      break;
    }
    case 'POC': {
      const pocStep = state.step || '1';
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
      const contractPath = path.join(iterPath, 'poc', `contract_iter-${iterNum}.ts`);

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
      lines.push('   // @GEMS-TABLE: tbl_xxx');
      lines.push('   // @GEMS-STORY: Story-X.Y');
      lines.push('   export interface EntityName { ... }');
      lines.push('   ⚠️ 禁止用 JSDoc /** @GEMS-CONTRACT */ 格式，必須是 // 單行注釋');
      lines.push('2. 每個欄位加 DB 型別註解（VARCHAR/UUID/INT/DECIMAL/ENUM/TIMESTAMP）');
      lines.push('3. 為每個 Entity 建立對應的 View（前端不需要的欄位標 api-only）');
      lines.push('4. 從「模組動作清單」的 API 欄位提取 → @GEMS-API interface');
      lines.push('5. 每個 @GEMS-CONTRACT/@GEMS-API 標註對應的 @GEMS-STORY');
      lines.push('');
      lines.push('格式參考: .agent/poc/gems-next/BLUEPRINT_CONTRACT_DESIGN.md');
      if (draftPath) lines.push(`Draft: ${draftPath}`);
      lines.push('');
      lines.push(`@EXPECTED: 寫完後執行:`);
      lines.push(`node sdid-tools/blueprint/contract-writer.cjs --contract=${contractPath} --target=${projectRoot}${draftPath ? ` --draft=${draftPath}` : ''} --iter=${iterNum}`);
      lines.push('');
      lines.push('@REMINDER: 執行 contract-writer @PASS 後再次呼叫 sdid-loop 繼續流程');
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
    case 'NEXT_ITER': {
      if (!state.draftPath) { lines.push('@BLOCKER: 找不到 draft 檔案，無法 EXPAND'); return { content: [{ type: 'text', text: lines.join('\n') }] }; }
      lines.push(`🚀 執行: blueprint-expand.cjs → iter-${iterNum + 1}`);
      result = await runCli('blueprint/expand.cjs', [`--draft=${state.draftPath}`, `--iter=${iterNum + 1}`, `--target=${projectRoot}`]);
      break;
    }
    case 'POC-FIX': {
      lines.push(`🚀 執行: micro-fix-gate.cjs (POC-FIX 路線)`);
      result = await runCli('poc-fix/micro-fix-gate.cjs', [`--target=${projectRoot}`, `--iter=${iterNum}`]);
      break;
    }
    case 'MICRO-FIX': {
      lines.push(`🚀 執行: micro-fix-gate.cjs`);
      result = await runCli('poc-fix/micro-fix-gate.cjs', [`--target=${projectRoot}`, `--iter=${iterNum}`]);
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
