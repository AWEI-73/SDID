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

function ensureIterStructure(projectRoot, iterNum) {
  stateMachine.ensureIterStructure(projectRoot, iterNum);
}

function inferBlueprintState(projectRoot, iterNum) {
  const plannedStories = stateMachine.findPlannedStories(projectRoot, iterNum);
  const completedStories = stateMachine.findCompletedStories(projectRoot, iterNum);
  const draftPath = stateMachine.findDraft(projectRoot, iterNum);
  const inferred = stateMachine.inferStateFromLogs(projectRoot, iterNum, plannedStories, completedStories);
  if (!inferred) {
    return { phase: draftPath ? 'GATE' : 'NO_DRAFT', draftPath, plannedStories, completedStories };
  }
  return { ...inferred, draftPath, plannedStories, completedStories };
}

export const schema = {
  title: 'SDID Loop (主入口)',
  description: `★ 推薦入口 — 自動偵測專案狀態並執行下一步，支援四條路線：
  Blueprint: GATE → PLAN → BUILD (Phase 1-8) → SHRINK → VERIFY
  Task-Pipe: POC → PLAN → BUILD → SCAN
  POC-FIX:   micro-fix-gate → 修復循環
  MICRO-FIX: micro-fix-gate → DONE
每次呼叫會：(1) 偵測路線+當前階段 (2) 執行對應工具 (3) 回傳結果 + @TASK 或 @NEXT 指示。
收到 @TASK 時請修改程式碼，修完後再次呼叫此工具。收到 @PASS 時直接再次呼叫。
⚠️ 不要自行組合其他工具，此工具會自動處理完整流程。`,
  inputSchema: {
    project: z.string().describe('專案根目錄路徑'),
    iter: z.number().optional().describe('迭代編號（省略則自動偵測最新）'),
    story: z.string().optional().describe('指定 Story ID（BUILD 階段用，省略則自動偵測）'),
    forceStart: z.string().optional().describe('強制從指定階段開始（GATE/PLAN/BUILD-N/SHRINK/VERIFY）'),
  },
};

export async function handler({ project, iter, story, forceStart }) {
  const fs = require('fs');
  const projectRoot = resolvePath(project);

  if (!fs.existsSync(projectRoot)) {
    return { content: [{ type: 'text', text: `ERROR: 找不到專案目錄: ${projectRoot}` }] };
  }

  // Detect latest iteration
  let iterNum = iter;
  if (!iterNum) {
    const iterDir = path.join(projectRoot, '.gems', 'iterations');
    if (fs.existsSync(iterDir)) {
      const iters = fs.readdirSync(iterDir)
        .filter(d => /^iter-\d+$/.test(d))
        .map(d => parseInt(d.replace('iter-', ''), 10))
        .sort((a, b) => b - a);
      iterNum = iters[0] || 1;
    } else {
      iterNum = 1;
    }
  }

  ensureIterStructure(projectRoot, iterNum);

  // Detect state
  let state;
  if (forceStart) {
    const buildMatch = forceStart.match(/^BUILD-?(\d+)?$/i);
    if (buildMatch) {
      const inferred = inferBlueprintState(projectRoot, iterNum);
      state = { phase: 'BUILD', step: parseInt(buildMatch[1] || '1'), story: story || inferred.plannedStories?.[0], draftPath: inferred.draftPath, plannedStories: inferred.plannedStories, completedStories: inferred.completedStories };
    } else {
      const phaseMap = { GATE: 'GATE', PLAN: 'PLAN', SHRINK: 'SHRINK', VERIFY: 'VERIFY', POC: 'POC', SCAN: 'SCAN', 'NEXT-ITER': 'NEXT_ITER', 'POC-FIX': 'POC-FIX', 'MICRO-FIX': 'MICRO-FIX' };
      const phase = phaseMap[forceStart.toUpperCase()];
      if (!phase) {
        return { content: [{ type: 'text', text: `ERROR: 無效的 forceStart: ${forceStart}\n有效值: GATE, PLAN, BUILD-N, SHRINK, VERIFY, POC, SCAN, NEXT-ITER, POC-FIX, MICRO-FIX` }] };
      }
      const inferred = inferBlueprintState(projectRoot, iterNum);
      state = { phase, draftPath: inferred.draftPath, plannedStories: inferred.plannedStories, completedStories: inferred.completedStories };
    }
  } else {
    state = inferBlueprintState(projectRoot, iterNum);
    if (story && state.phase === 'BUILD') state.story = story;
  }

  const lines = [];
  lines.push('══════════════════════════════════════════════════');
  lines.push('  SDID Loop — Multi-Route Navigator');
  lines.push('══════════════════════════════════════════════════');
  lines.push('');
  lines.push(`📁 專案: ${projectRoot}`);
  lines.push(`📍 迭代: iter-${iterNum}`);
  const route = stateMachine.detectRoute(projectRoot);
  lines.push(`📍 路線: ${route}`);
  lines.push(`📍 狀態: ${state.phase}${state.step ? ' Phase ' + state.step : ''}${state.story ? ' ' + state.story : ''}`);

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
    lines.push('');
    lines.push('@BLOCKER: 找不到 requirement_draft');
    lines.push(`請先建立活藍圖: ${projectRoot}/.gems/iterations/iter-${iterNum}/poc/requirement_draft_iter-${iterNum}.md`);
    lines.push('參考模板: sdid-tools/../task-pipe/templates/enhanced-draft-golden.template.v2.md');
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }

  if (state.phase === 'COMPLETE') {
    lines.push('');
    lines.push('@PASS: iter-' + iterNum + ' 全部完成！');
    lines.push(`<promise>${route === 'Blueprint' ? 'BLUEPRINT' : route.toUpperCase()}-COMPLETE</promise>`);
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }

  // Execute the appropriate tool
  lines.push('');
  let result;

  switch (state.phase) {
    case 'GATE': {
      if (!state.draftPath) { lines.push('@BLOCKER: 找不到 draft 檔案'); return { content: [{ type: 'text', text: lines.join('\n') }] }; }
      lines.push(`🚀 執行: blueprint-gate.cjs`);
      result = await runCli('blueprint-gate.cjs', [`--draft=${state.draftPath}`, `--target=${projectRoot}`, `--iter=${iterNum}`]);
      break;
    }
    case 'PLAN': {
      if (!state.draftPath) { lines.push('@BLOCKER: 找不到 draft 檔案'); return { content: [{ type: 'text', text: lines.join('\n') }] }; }
      lines.push(`🚀 執行: draft-to-plan.cjs`);
      result = await runCli('draft-to-plan.cjs', [`--draft=${state.draftPath}`, `--iter=${iterNum}`, `--target=${projectRoot}`]);
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
      if (!state.draftPath) { lines.push('@BLOCKER: 找不到 draft 檔案'); return { content: [{ type: 'text', text: lines.join('\n') }] }; }
      lines.push(`🚀 執行: blueprint-shrink.cjs`);
      result = await runCli('blueprint-shrink.cjs', [`--draft=${state.draftPath}`, `--iter=${iterNum}`, `--target=${projectRoot}`]);
      break;
    }
    case 'VERIFY': {
      if (!state.draftPath) { lines.push('@BLOCKER: 找不到 draft 檔案'); return { content: [{ type: 'text', text: lines.join('\n') }] }; }
      lines.push(`🚀 執行: blueprint-verify.cjs`);
      result = await runCli('blueprint-verify.cjs', [`--draft=${state.draftPath}`, `--target=${projectRoot}`, `--iter=${iterNum}`]);
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
    case 'NEXT_ITER': {
      if (!state.draftPath) { lines.push('@BLOCKER: 找不到 draft 檔案，無法 EXPAND'); return { content: [{ type: 'text', text: lines.join('\n') }] }; }
      lines.push(`🚀 執行: blueprint-expand.cjs → iter-${iterNum + 1}`);
      result = await runCli('blueprint-expand.cjs', [`--draft=${state.draftPath}`, `--iter=${iterNum + 1}`, `--target=${projectRoot}`]);
      break;
    }
    case 'POC-FIX': {
      lines.push(`🚀 執行: micro-fix-gate.cjs (POC-FIX 路線)`);
      result = await runCli('micro-fix-gate.cjs', [`--target=${projectRoot}`, `--iter=${iterNum}`]);
      break;
    }
    case 'MICRO-FIX': {
      lines.push(`🚀 執行: micro-fix-gate.cjs`);
      result = await runCli('micro-fix-gate.cjs', [`--target=${projectRoot}`, `--iter=${iterNum}`]);
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
    lines.push('@NEXT: 請讀取上方輸出：');
    lines.push('  - 如果有 @TASK → 根據指示修改程式碼，修完後再次呼叫 sdid-loop');
    lines.push('  - 如果有 @PASS → 直接再次呼叫 sdid-loop（會自動進入下一階段）');
    lines.push('  - 如果有 @BLOCKER → 根據錯誤訊息修正，修完後再次呼叫 sdid-loop');
  } else {
    lines.push('❌ 執行失敗');
    lines.push('');
    lines.push('@NEXT: 請讀取上方錯誤訊息，修正問題後再次呼叫 sdid-loop');
    lines.push(`  logs 目錄: ${projectRoot}/.gems/iterations/iter-${iterNum}/logs/`);
  }

  lines.push('');
  lines.push('⚠️ 不要自行呼叫 spec-gen、spec-gate、scanner 等工具，sdid-loop 會處理完整流程。');

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}
