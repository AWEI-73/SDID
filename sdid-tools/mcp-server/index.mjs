#!/usr/bin/env node
/**
 * SDID MCP Server
 *
 * 將 sdid-tools 暴露為 MCP tools，供 Claude Code 直接呼叫。
 * Transport: stdio（Claude Code 原生支持）
 *
 * Tools:
 *   sdid-loop            — ★ 主入口：自動偵測狀態並執行下一步（Blueprint/Task-Pipe 通用）
 *   sdid-state-guide     — 路由大腦（狀態/該讀/歷史/下一步/紅線）— Wave 3: 支援 Blueprint 全流程
 *   sdid-run             — 通用 CLI 執行器（安全白名單限 sdid-tools/ + task-pipe/）
 *   sdid-spec-gen        — 字典生成（Draft → specs/*.json）
 *   sdid-spec-gate       — 字典品質驗證（5 項檢查）
 *   sdid-dict-sync       — 行號回寫（源碼 → specs lineRange）
 *   sdid-scanner          — GEMS 標籤掃描（覆蓋率報告）
 *   sdid-blueprint-gate  — 藍圖品質驗證
 *   sdid-micro-fix-gate  — 小修驗收 gate
 *   sdid-build           — BUILD/POC/PLAN runner
 *   sdid-scan            — SCAN runner
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = path.resolve(__dirname, '..');

// ─────────────────────────────────────────────────────────────
// CJS 工具載入（有 module.exports 的）
// ─────────────────────────────────────────────────────────────

const stateGuide = require(path.join(TOOLS_DIR, 'state-guide.cjs'));
const stateMachine = require(path.join(TOOLS_DIR, '..', 'sdid-core', 'state-machine.cjs'));
const scanner = require(path.join(TOOLS_DIR, 'gems-scanner-v2.cjs'));
const dictSync = require(path.join(TOOLS_DIR, 'dict-sync.cjs'));

// ─────────────────────────────────────────────────────────────
// 工具函式
// ─────────────────────────────────────────────────────────────

/** 去掉 ANSI escape codes */
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/** 執行 CLI 工具，捕獲 stdout+stderr */
async function runCli(script, args) {
  const scriptPath = path.join(TOOLS_DIR, script);
  try {
    const { stdout, stderr } = await execFileAsync('node', [scriptPath, ...args], {
      cwd: TOOLS_DIR,
      timeout: 60000,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    });
    return { ok: true, output: stripAnsi(stdout + (stderr ? '\n' + stderr : '')) };
  } catch (err) {
    const output = stripAnsi((err.stdout || '') + '\n' + (err.stderr || err.message || ''));
    return { ok: false, output };
  }
}

/** 將路徑解析為絕對路徑 */
function resolvePath(p) {
  if (!p) return p;
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

// ─────────────────────────────────────────────────────────────
// MCP Server
// ─────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'sdid',
  version: '1.0.0',
});

// ═══════════════════════════════════════════════════════════════
// Tool 0: sdid-loop ★ 主入口
// ═══════════════════════════════════════════════════════════════

/**
 * 確保 .gems iteration 目錄結構完整（委派給 state-machine）
 */
function ensureIterStructure(projectRoot, iterNum) {
  stateMachine.ensureIterStructure(projectRoot, iterNum);
}

/**
 * 從 logs 目錄推斷 Blueprint Flow 當前狀態（委派給 state-machine）
 */
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


server.registerTool(
  'sdid-loop',
  {
    title: 'SDID Loop (主入口)',
    description: `★ 推薦入口 — 自動偵測專案狀態並執行 Blueprint Flow 的下一步。
外部 AI 只需反覆呼叫此工具即可完成整個流程：GATE → PLAN → BUILD (Phase 1-8) → SHRINK → VERIFY。
每次呼叫會：(1) 偵測當前階段 (2) 執行對應工具 (3) 回傳結果 + @TASK 或 @NEXT 指示。
收到 @TASK 時請修改程式碼，修完後再次呼叫此工具。收到 @PASS 時直接再次呼叫。
⚠️ 不要自行組合其他工具（spec-gen、spec-gate 等），此工具會自動處理完整流程。`,
    inputSchema: {
      project: z.string().describe('專案根目錄路徑'),
      iter: z.number().optional().describe('迭代編號（省略則自動偵測最新）'),
      story: z.string().optional().describe('指定 Story ID（BUILD 階段用，省略則自動偵測）'),
      forceStart: z.string().optional().describe('強制從指定階段開始（GATE/PLAN/BUILD-N/SHRINK/VERIFY）'),
    },
  },
  async ({ project, iter, story, forceStart }) => {
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

    // Ensure directory structure
    ensureIterStructure(projectRoot, iterNum);

    // Detect state (use state-guide first, fallback to log inference)
    let state;
    if (forceStart) {
      const buildMatch = forceStart.match(/^BUILD-?(\d+)?$/i);
      if (buildMatch) {
        const inferred = inferBlueprintState(projectRoot, iterNum);
        state = { phase: 'BUILD', step: parseInt(buildMatch[1] || '1'), story: story || inferred.plannedStories?.[0], draftPath: inferred.draftPath, plannedStories: inferred.plannedStories, completedStories: inferred.completedStories };
      } else {
        const phaseMap = { GATE: 'GATE', PLAN: 'PLAN', SHRINK: 'SHRINK', VERIFY: 'VERIFY' };
        const phase = phaseMap[forceStart.toUpperCase()];
        if (!phase) {
          return { content: [{ type: 'text', text: `ERROR: 無效的 forceStart: ${forceStart}\n有效值: GATE, PLAN, BUILD-N, SHRINK, VERIFY` }] };
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
    lines.push('  SDID Loop — Blueprint Flow Navigator');
    lines.push('══════════════════════════════════════════════════');
    lines.push('');
    lines.push(`📁 專案: ${projectRoot}`);
    lines.push(`📍 迭代: iter-${iterNum}`);
    lines.push(`📍 狀態: ${state.phase}${state.step ? ' Phase ' + state.step : ''}${state.story ? ' ' + state.story : ''}`);

    // Show story progress
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

    // Handle special states
    if (state.phase === 'NO_DRAFT') {
      lines.push('');
      lines.push('@BLOCKER: 找不到 requirement_draft');
      lines.push(`請先建立活藍圖: ${projectRoot}/.gems/iterations/iter-${iterNum}/poc/requirement_draft_iter-${iterNum}.md`);
      lines.push('參考模板: sdid-tools/../task-pipe/templates/enhanced-draft-golden.template.v2.md');
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    if (state.phase === 'COMPLETE') {
      lines.push('');
      lines.push('@PASS: iter-' + iterNum + ' Blueprint Flow 全部完成！');
      lines.push('<promise>BLUEPRINT-COMPLETE</promise>');
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    // Execute the appropriate tool
    lines.push('');
    let result;
    const SDID_ROOT = path.resolve(TOOLS_DIR, '..');

    switch (state.phase) {
      case 'GATE': {
        if (!state.draftPath) {
          lines.push('@BLOCKER: 找不到 draft 檔案');
          return { content: [{ type: 'text', text: lines.join('\n') }] };
        }
        lines.push(`🚀 執行: blueprint-gate.cjs`);
        result = await runCli('blueprint-gate.cjs', [
          `--draft=${state.draftPath}`,
          `--target=${projectRoot}`,
          `--iter=${iterNum}`
        ]);
        break;
      }

      case 'PLAN': {
        if (!state.draftPath) {
          lines.push('@BLOCKER: 找不到 draft 檔案');
          return { content: [{ type: 'text', text: lines.join('\n') }] };
        }
        lines.push(`🚀 執行: draft-to-plan.cjs`);
        result = await runCli('draft-to-plan.cjs', [
          `--draft=${state.draftPath}`,
          `--iter=${iterNum}`,
          `--target=${projectRoot}`
        ]);
        break;
      }

      case 'BUILD': {
        const buildStory = state.story || state.plannedStories?.[0];
        if (!buildStory) {
          lines.push('@BLOCKER: 找不到待執行的 Story');
          return { content: [{ type: 'text', text: lines.join('\n') }] };
        }
        const buildStep = state.step || 1;
        lines.push(`🚀 執行: runner.cjs BUILD Phase ${buildStep} ${buildStory}`);
        result = await runRunner([
          `--phase=BUILD`,
          `--step=${buildStep}`,
          `--story=${buildStory}`,
          `--target=${projectRoot}`,
          `--iteration=iter-${iterNum}`
        ]);
        break;
      }

      case 'SHRINK': {
        if (!state.draftPath) {
          lines.push('@BLOCKER: 找不到 draft 檔案');
          return { content: [{ type: 'text', text: lines.join('\n') }] };
        }
        lines.push(`🚀 執行: blueprint-shrink.cjs`);
        result = await runCli('blueprint-shrink.cjs', [
          `--draft=${state.draftPath}`,
          `--iter=${iterNum}`,
          `--target=${projectRoot}`
        ]);
        break;
      }

      case 'VERIFY': {
        if (!state.draftPath) {
          lines.push('@BLOCKER: 找不到 draft 檔案');
          return { content: [{ type: 'text', text: lines.join('\n') }] };
        }
        lines.push(`🚀 執行: blueprint-verify.cjs`);
        result = await runCli('blueprint-verify.cjs', [
          `--draft=${state.draftPath}`,
          `--target=${projectRoot}`,
          `--iter=${iterNum}`
        ]);
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
);

// ═══════════════════════════════════════════════════════════════
// Tool 1: sdid-state-guide
// ═══════════════════════════════════════════════════════════════

server.registerTool(
  'sdid-state-guide',
  {
    title: 'SDID State Guide',
    description: '取得專案目前的 SDID 狀態指令包（📍狀態/📖該讀什麼/⚠️歷史提示/🎯下一步/🚫紅線）。每次進入專案時應優先呼叫此工具。支援 Blueprint 和 Task-Pipe 兩條路線的完整狀態偵測。',
    inputSchema: {
      project: z.string().describe('專案根目錄路徑（如 ExamForge）'),
      iter: z.string().optional().describe('指定迭代（如 iter-11），省略則自動偵測'),
      story: z.string().optional().describe('指定 Story（如 Story-11.1）'),
      gems: z.string().optional().describe('指定 gemsId（如 PDF.ParseBufferWithImages）'),
    },
  },
  async ({ project, iter, story, gems }) => {
    const projectRoot = resolvePath(project);
    try {
      const fs = require('fs');
      if (!fs.existsSync(projectRoot)) {
        return { content: [{ type: 'text', text: `ERROR: 找不到專案目錄: ${projectRoot}` }] };
      }

      const activeIter = iter || stateGuide.detectActiveIter(projectRoot);

      // Wave 3: 使用 detectFullState 統一偵測
      const fullState = stateGuide.detectFullState(projectRoot, activeIter, story || null);
      const { phase, step, route } = fullState;
      const resolvedStory = story || fullState.story;

      const targetGems = stateGuide.resolveTargetGems(projectRoot, resolvedStory, gems);
      const hints = stateGuide.resolveHints(projectRoot, phase, step, resolvedStory);

      // 腳本路徑
      const PHASE_SCRIPT_MAP = {
        POC: (s) => `task-pipe/phases/poc/step-${s}.cjs`,
        PLAN: (s) => `task-pipe/phases/plan/step-${s}.cjs`,
        BUILD: (s) => `task-pipe/phases/build/phase-${s}.cjs`,
        SCAN: (s) => `task-pipe/phases/scan/step-${s}.cjs`,
      };
      const scriptFn = PHASE_SCRIPT_MAP[phase?.toUpperCase()];
      const scriptPath = scriptFn && step ? scriptFn(step) : null;
      const phase2Script = (phase === 'BUILD' && parseInt(step) !== 2)
        ? 'task-pipe/phases/build/phase-2.cjs' : null;

      const output = stateGuide.formatGuide({
        phase, step,
        story: resolvedStory,
        iter: activeIter,
        route,
        resumeCtx: hints.resumeCtx || null,
        scriptPath,
        gems: targetGems,
        pitfalls: hints.pitfalls || [],
        histHint: hints.histHint || null,
        phase2Script,
        fullState,
      });

      return { content: [{ type: 'text', text: output }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `ERROR: ${err.message}\n${err.stack}` }] };
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// Tool 2: sdid-spec-gen
// ═══════════════════════════════════════════════════════════════

server.registerTool(
  'sdid-spec-gen',
  {
    title: 'SDID Spec Generator',
    description: '字典生成 — 讀 Enhanced Draft 或 requirement_spec，產出 .gems/specs/*.json + _index.json。自動偵測 Blueprint/Task-Pipe 格式。',
    inputSchema: {
      project: z.string().describe('專案根目錄路徑'),
      input: z.string().describe('輸入的 Draft/Spec markdown 檔案路徑'),
      iter: z.number().optional().describe('只處理指定迭代（如 2 代表 Iter 2）'),
      dryRun: z.boolean().optional().describe('預覽模式，不實際寫入檔案'),
    },
  },
  async ({ project, input, iter, dryRun }) => {
    const args = [`--project=${resolvePath(project)}`, `--input=${resolvePath(input)}`];
    if (iter) args.push(`--iter=${iter}`);
    if (dryRun) args.push('--dry-run');

    const result = await runCli('spec-gen.cjs', args);
    return { content: [{ type: 'text', text: result.output }] };
  }
);

// ═══════════════════════════════════════════════════════════════
// Tool 3: sdid-spec-gate
// ═══════════════════════════════════════════════════════════════

server.registerTool(
  'sdid-spec-gate',
  {
    title: 'SDID Spec Gate',
    description: '字典品質驗證 — 執行 5 項檢查（schema/index 格式/一致性/manages 路徑/lineRange）。回傳 PASS 或 FAIL + 錯誤明細。',
    inputSchema: {
      project: z.string().describe('專案根目錄路徑'),
      fixIndex: z.boolean().optional().describe('自動補齊 _index.json 遺漏的 P0/P1 條目'),
      dryRun: z.boolean().optional().describe('搭配 fixIndex，只顯示不寫入'),
    },
  },
  async ({ project, fixIndex, dryRun }) => {
    const args = [`--project=${resolvePath(project)}`];
    if (fixIndex) args.push('--fix-index');
    if (dryRun) args.push('--dry-run');

    const result = await runCli('spec-gate.cjs', args);
    return { content: [{ type: 'text', text: result.output }] };
  }
);

// ═══════════════════════════════════════════════════════════════
// Tool 4: sdid-dict-sync
// ═══════════════════════════════════════════════════════════════

server.registerTool(
  'sdid-dict-sync',
  {
    title: 'SDID Dict Sync',
    description: '行號回寫 — 掃描源碼，將函式的 lineRange 和 status 同步回 .gems/specs/*.json。status 只升不降。',
    inputSchema: {
      project: z.string().describe('專案根目錄路徑'),
      src: z.string().optional().describe('源碼子目錄（預設 src）'),
      dryRun: z.boolean().optional().describe('預覽模式，不實際寫入'),
    },
  },
  async ({ project, src, dryRun }) => {
    const projectRoot = resolvePath(project);
    try {
      const result = dictSync.syncDict(projectRoot, { srcSubDir: src || 'src', dryRun: !!dryRun });
      const lines = ['## dict-sync 結果', ''];
      lines.push(`更新: ${result.updated} 筆`);
      lines.push(`跳過: ${result.skipped} 筆`);
      if (result.details && result.details.length > 0) {
        lines.push('', '### 明細');
        for (const d of result.details) {
          lines.push(`- ${d}`);
        }
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `ERROR: ${err.message}` }] };
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// Tool 5: sdid-scanner
// ═══════════════════════════════════════════════════════════════

server.registerTool(
  'sdid-scanner',
  {
    title: 'SDID GEMS Scanner',
    description: 'GEMS 標籤掃描 — 掃描源碼中的 @GEMS 標籤，產出 function-index-v2.json 和覆蓋率報告。',
    inputSchema: {
      project: z.string().describe('專案根目錄路徑'),
      src: z.string().optional().describe('源碼子目錄（預設 src）'),
    },
  },
  async ({ project, src }) => {
    const projectRoot = resolvePath(project);
    const fs = require('fs');
    const srcDir = path.join(projectRoot, src || 'src');

    if (!fs.existsSync(srcDir)) {
      return { content: [{ type: 'text', text: `ERROR: 找不到 src 目錄: ${srcDir}` }] };
    }

    try {
      const result = scanner.scanV2(srcDir, projectRoot);

      // 寫 function-index-v2.json（使用 projectRoot 作為基準）
      const docsDir = path.join(projectRoot, '.gems', 'docs');
      if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
      const allFunctions = [...(result.tagged || []), ...(result.untagged || [])];
      const indexResult = scanner.generateFunctionIndexV2(result.functions || allFunctions);
      fs.writeFileSync(
        path.join(docsDir, 'function-index-v2.json'),
        JSON.stringify(indexResult, null, 2)
      );

      const lines = [
        '## GEMS Scanner 結果',
        '',
        `已標籤: ${result.stats.tagged} (覆蓋率 ${result.stats.coverageRate})`,
        `未標籤: ${result.stats.untaggedCount}`,
        `P0: ${result.stats.P0} | P1: ${result.stats.P1} | P2: ${result.stats.P2} | P3: ${result.stats.P3}`,
        `dict-backed: ${result.stats.dictBacked}`,
        `comment-only: ${result.stats.commentOnly}`,
      ];

      if (result.stats.untaggedCount > 0 && result.untagged) {
        lines.push('', '### 未標籤函式');
        for (const fn of result.untagged.slice(0, 20)) {
          lines.push(`- ${fn.name} (${fn.file}:${fn.line})`);
        }
        if (result.untagged.length > 20) {
          lines.push(`- ... 還有 ${result.untagged.length - 20} 個`);
        }
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `ERROR: ${err.message}` }] };
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// Tool 6: sdid-blueprint-gate
// ═══════════════════════════════════════════════════════════════

server.registerTool(
  'sdid-blueprint-gate',
  {
    title: 'SDID Blueprint Gate',
    description: '藍圖品質驗證 — 檢查 Enhanced Draft 的機械規則（AC 完整性、佔位符、依賴、迭代預算等）。',
    inputSchema: {
      draft: z.string().describe('Enhanced Draft 檔案路徑'),
      iter: z.number().optional().describe('目標迭代（預設自動偵測）'),
      target: z.string().optional().describe('專案根目錄（用於 log 存檔）'),
    },
  },
  async ({ draft, iter, target }) => {
    const args = [`--draft=${resolvePath(draft)}`];
    if (iter) args.push(`--iter=${iter}`);
    if (target) args.push(`--target=${resolvePath(target)}`);

    const result = await runCli('blueprint-gate.cjs', args);
    return { content: [{ type: 'text', text: result.output }] };
  }
);

// ═══════════════════════════════════════════════════════════════
// Tool 7: sdid-micro-fix-gate
// ═══════════════════════════════════════════════════════════════

server.registerTool(
  'sdid-micro-fix-gate',
  {
    title: 'SDID Micro-Fix Gate',
    description: '小修驗收 — 檢查改動檔案的 GEMS 標籤覆蓋率和 export 完整性。適用於 MICRO-FIX 和 POC-FIX 路線。',
    inputSchema: {
      target: z.string().describe('專案根目錄路徑'),
      changed: z.string().optional().describe('逗號分隔的改動檔案清單（省略則自動掃 src/）'),
    },
  },
  async ({ target, changed }) => {
    const args = [`--target=${resolvePath(target)}`];
    if (changed) args.push(`--changed=${changed}`);

    const result = await runCli('micro-fix-gate.cjs', args);
    return { content: [{ type: 'text', text: result.output }] };
  }
);

// ═══════════════════════════════════════════════════════════════
// Tool 8: sdid-build
// ═══════════════════════════════════════════════════════════════

/** runner.cjs 在 task-pipe/ 目錄，需要獨立的 helper */
async function runRunner(args) {
  const SDID_ROOT = path.resolve(TOOLS_DIR, '..');
  const runnerPath = path.join(SDID_ROOT, 'task-pipe', 'runner.cjs');
  try {
    const { stdout, stderr } = await execFileAsync('node', [runnerPath, '--ai', ...args], {
      cwd: SDID_ROOT,
      timeout: 120000,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    });
    return { ok: true, output: stripAnsi(stdout + (stderr ? '\n' + stderr : '')) };
  } catch (err) {
    const output = stripAnsi((err.stdout || '') + '\n' + (err.stderr || err.message || ''));
    return { ok: false, output };
  }
}

server.registerTool(
  'sdid-build',
  {
    title: 'SDID BUILD Runner',
    description: '執行 BUILD Phase（1-8）或自動偵測下一步。回傳該 phase 的指令和驗證結果。加 --auto 可自動串接到下一個 phase 直到 BLOCKER。',
    inputSchema: {
      target: z.string().describe('專案根目錄路徑'),
      phase: z.enum(['BUILD', 'POC', 'PLAN']).optional().describe('階段（BUILD/POC/PLAN），省略則自動偵測'),
      step: z.number().optional().describe('步驟編號（如 BUILD Phase 1-8）'),
      story: z.string().optional().describe('Story ID（如 Story-11.0）'),
      iteration: z.string().optional().describe('迭代（如 iter-11），省略則自動偵測'),
      auto: z.boolean().optional().describe('Auto Mode：PASS 後自動跑下一個 Phase'),
      dryRun: z.boolean().optional().describe('預覽模式'),
      diagnose: z.boolean().optional().describe('診斷專案狀態'),
    },
  },
  async ({ target, phase, step, story, iteration, auto, dryRun, diagnose }) => {
    const args = [`--target=${resolvePath(target)}`];
    if (phase) args.push(`--phase=${phase}`);
    if (step) args.push(`--step=${step}`);
    if (story) args.push(`--story=${story}`);
    if (iteration) args.push(`--iteration=${iteration}`);
    if (auto) args.push('--auto');
    if (dryRun) args.push('--dry-run');
    if (diagnose) args.push('--diagnose');

    const result = await runRunner(args);
    return { content: [{ type: 'text', text: result.output }] };
  }
);

// ═══════════════════════════════════════════════════════════════
// Tool 9: sdid-scan
// ═══════════════════════════════════════════════════════════════

server.registerTool(
  'sdid-scan',
  {
    title: 'SDID SCAN Runner',
    description: '執行 SCAN Phase — 產出 .gems/docs/ 全景報告（function-index、覆蓋率、未標籤清單）。',
    inputSchema: {
      target: z.string().describe('專案根目錄路徑'),
      iteration: z.string().optional().describe('迭代（如 iter-11），省略則自動偵測'),
    },
  },
  async ({ target, iteration }) => {
    const args = [`--target=${resolvePath(target)}`, '--phase=SCAN'];
    if (iteration) args.push(`--iteration=${iteration}`);

    const result = await runRunner(args);
    return { content: [{ type: 'text', text: result.output }] };
  }
);

// ═══════════════════════════════════════════════════════════════
// Tool 10: sdid-run (Wave 3 — 通用 CLI 執行器)
// ═══════════════════════════════════════════════════════════════

/** 安全白名單：只允許執行 sdid-tools/ 和 task-pipe/ 下的腳本 */
const ALLOWED_PREFIXES = ['sdid-tools/', 'task-pipe/'];

function isAllowedCommand(cmd) {
  // 格式: node <script> [args...]
  const trimmed = cmd.trim();
  // 移除開頭的 node 
  const withoutNode = trimmed.replace(/^node\s+/, '');
  return ALLOWED_PREFIXES.some(prefix => withoutNode.startsWith(prefix));
}

server.registerTool(
  'sdid-run',
  {
    title: 'SDID CLI Runner',
    description: '通用 SDID CLI 執行器 — 執行任何 sdid-tools/ 或 task-pipe/ 下的腳本命令，回傳 stdout（含 anchor 標籤）。搭配 sdid-state-guide 的 NEXT: 命令使用。',
    inputSchema: {
      command: z.string().describe('完整的 node 命令（如 "node sdid-tools/blueprint-gate.cjs --draft=... --target=..."）'),
      project: z.string().optional().describe('專案根目錄路徑（用於替換命令中的 --target=<project>）'),
    },
  },
  async ({ command, project }) => {
    try {
      // 替換 <project> 佔位符
      let cmd = command;
      if (project) {
        const resolved = resolvePath(project);
        cmd = cmd.replace(/--target=<project>/g, `--target=${resolved}`);
        cmd = cmd.replace(/<project>/g, resolved);
      }

      // 安全檢查
      if (!isAllowedCommand(cmd)) {
        return {
          content: [{
            type: 'text',
            text: `ERROR: 安全限制 — 只允許執行 sdid-tools/ 和 task-pipe/ 下的腳本。\n收到: ${cmd}`
          }]
        };
      }

      // 解析命令
      const trimmed = cmd.trim().replace(/^node\s+/, '');
      const parts = trimmed.split(/\s+/);
      const scriptRelative = parts[0];
      const args = parts.slice(1);

      const SDID_ROOT = path.resolve(TOOLS_DIR, '..');
      const scriptPath = path.join(SDID_ROOT, scriptRelative);

      const { stdout, stderr } = await execFileAsync('node', [scriptPath, ...args], {
        cwd: SDID_ROOT,
        timeout: 120000,
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      });

      const output = stripAnsi(stdout + (stderr ? '\n' + stderr : ''));
      return { content: [{ type: 'text', text: output }] };
    } catch (err) {
      const output = stripAnsi((err.stdout || '') + '\n' + (err.stderr || err.message || ''));
      return { content: [{ type: 'text', text: output }] };
    }
  }
);

// ─────────────────────────────────────────────────────────────
// 啟動
// ─────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
