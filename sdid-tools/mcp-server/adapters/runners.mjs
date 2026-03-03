/**
 * Runner tool adapters
 * sdid-build, sdid-scan
 */
import { z } from 'zod';
import { resolvePath, runRunner } from '../lib/utils.mjs';

// ── sdid-build ──

export const build = {
  schema: {
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
  async handler({ target, phase, step, story, iteration, auto, dryRun, diagnose }) {
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
  },
};

// ── sdid-scan ──

export const scan = {
  schema: {
    title: 'SDID SCAN Runner',
    description: '執行 SCAN Phase — 產出 .gems/docs/ 全景報告（function-index、覆蓋率、未標籤清單）。',
    inputSchema: {
      target: z.string().describe('專案根目錄路徑'),
      iteration: z.string().optional().describe('迭代（如 iter-11），省略則自動偵測'),
    },
  },
  async handler({ target, iteration }) {
    const args = [`--target=${resolvePath(target)}`, '--phase=SCAN'];
    if (iteration) args.push(`--iteration=${iteration}`);
    const result = await runRunner(args);
    return { content: [{ type: 'text', text: result.output }] };
  },
};
