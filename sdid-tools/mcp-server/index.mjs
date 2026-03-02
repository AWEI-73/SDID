#!/usr/bin/env node
/**
 * SDID MCP Server
 *
 * 將 sdid-tools 暴露為 MCP tools，供 Claude Code 直接呼叫。
 * Transport: stdio（Claude Code 原生支持）
 *
 * Tools:
 *   sdid-state-guide     — 路由大腦（狀態/該讀/歷史/下一步/紅線）
 *   sdid-spec-gen        — 字典生成（Draft → specs/*.json）
 *   sdid-spec-gate       — 字典品質驗證（5 項檢查）
 *   sdid-dict-sync       — 行號回寫（源碼 → specs lineRange）
 *   sdid-scanner          — GEMS 標籤掃描（覆蓋率報告）
 *   sdid-blueprint-gate  — 藍圖品質驗證
 *   sdid-micro-fix-gate  — 小修驗收 gate
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
// Tool 1: sdid-state-guide
// ═══════════════════════════════════════════════════════════════

server.registerTool(
  'sdid-state-guide',
  {
    title: 'SDID State Guide',
    description: '取得專案目前的 SDID 狀態指令包（📍狀態/📖該讀什麼/⚠️歷史提示/🎯下一步/🚫紅線）。每次進入專案時應優先呼叫此工具。',
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

      const route = stateGuide.detectRoute(projectRoot);
      const activeIter = iter || stateGuide.detectActiveIter(projectRoot);
      const targetGems = stateGuide.resolveTargetGems(projectRoot, story, gems);
      const hints = stateGuide.resolveHints(projectRoot, null, null, story);

      const output = stateGuide.formatGuide({
        phase: hints.phase || null,
        step: hints.step || null,
        story: story || hints.story || null,
        iter: activeIter,
        route,
        resumeCtx: hints.resumeCtx || null,
        scriptPath: hints.scriptPath || null,
        gems: targetGems,
        pitfalls: hints.pitfalls || [],
        histHint: hints.histHint || null,
        phase2Script: hints.phase2Script || null,
      });

      return { content: [{ type: 'text', text: output }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `ERROR: ${err.message}` }] };
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

      // 寫 function-index-v2.json
      const docsDir = path.join(projectRoot, '.gems', 'docs');
      if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
      const allFunctions = [...(result.tagged || []), ...(result.untagged || [])];
      const indexResult = scanner.generateFunctionIndexV2(allFunctions);
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

// ─────────────────────────────────────────────────────────────
// 啟動
// ─────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
