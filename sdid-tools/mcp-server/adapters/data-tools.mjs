/**
 * Data tool adapters
 * dict-sync, scanner
 */
import { z } from 'zod';
import { createRequire } from 'node:module';
import path from 'node:path';
import { TOOLS_DIR, resolvePath } from '../lib/utils.mjs';

const require = createRequire(import.meta.url);
const fs = require('fs');
const scanner = require(path.join(TOOLS_DIR, 'gems-scanner-v2.cjs'));
const dictSync = require(path.join(TOOLS_DIR, 'dict-sync.cjs'));

// ── sdid-dict-sync ──

export const dictSyncTool = {
  schema: {
    title: 'SDID Dict Sync',
    description: '🔧 手動補充工具 — 行號回寫。掃描源碼，將函式的 lineRange 和 status 同步回 .gems/specs/*.json。BUILD 完成後手動呼叫。',
    inputSchema: {
      project: z.string().describe('專案根目錄路徑'),
      src: z.string().optional().describe('源碼子目錄（預設 src）'),
      dryRun: z.boolean().optional().describe('預覽模式，不實際寫入'),
    },
  },
  async handler({ project, src, dryRun }) {
    const projectRoot = resolvePath(project);
    try {
      const result = dictSync.syncDict(projectRoot, { srcSubDir: src || 'src', dryRun: !!dryRun });
      const lines = ['## dict-sync 結果', ''];
      lines.push(`更新: ${result.updated} 筆`);
      lines.push(`跳過: ${result.skipped} 筆`);
      if (result.details && result.details.length > 0) {
        lines.push('', '### 明細');
        for (const d of result.details) lines.push(`- ${d}`);
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `ERROR: ${err.message}` }] };
    }
  },
};

// ── sdid-scanner ──

export const scannerTool = {
  schema: {
    title: 'SDID GEMS Scanner',
    description: '🔍 查詢工具 — GEMS 標籤掃描。掃描源碼中的 @GEMS 標籤，產出 function-index-v2.json 和覆蓋率報告。不執行流程，純查詢用。',
    inputSchema: {
      project: z.string().describe('專案根目錄路徑'),
      src: z.string().optional().describe('源碼子目錄（預設 src）'),
    },
  },
  async handler({ project, src }) {
    const projectRoot = resolvePath(project);
    const srcDir = path.join(projectRoot, src || 'src');

    if (!fs.existsSync(srcDir)) {
      return { content: [{ type: 'text', text: `ERROR: 找不到 src 目錄: ${srcDir}` }] };
    }

    try {
      const result = scanner.scanV2(srcDir, projectRoot);

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
        if (result.untagged.length > 20) lines.push(`- ... 還有 ${result.untagged.length - 20} 個`);
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `ERROR: ${err.message}` }] };
    }
  },
};
