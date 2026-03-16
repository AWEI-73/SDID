/**
 * sdid-test adapter
 * 跑 task-pipe/tests/ 下的整合測試，回傳報告
 */
import { z } from 'zod';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { SDID_ROOT, stripAnsi } from '../lib/utils.mjs';

const execFileAsync = promisify(execFile);

const RUNNER = path.join(SDID_ROOT, 'task-pipe', 'tests', 'run-all-tests.cjs');

export const testRunner = {
  schema: {
    title: 'SDID Test Runner',
    description: '跑 SDID 整合測試並回傳報告。可篩選特定測試、選擇報告格式（text/json/md）。',
    inputSchema: {
      filter: z.string().optional().describe('篩選測試檔名（如 "e2e"、"strategy"、"state"）'),
      report: z.enum(['text', 'json', 'md']).optional().describe('報告格式（預設 text）'),
      timeout: z.number().optional().describe('每個測試的 timeout ms（預設 30000）'),
    },
  },
  async handler({ filter, report = 'text', timeout = 30000 }) {
    const args = [`--report=${report}`, `--timeout=${timeout}`];
    if (filter) args.push(`--filter=${filter}`);

    try {
      const { stdout, stderr } = await execFileAsync('node', [RUNNER, ...args], {
        cwd: SDID_ROOT,
        timeout: timeout * 20 + 10000, // 總 timeout = 每個測試 timeout × 20 + buffer
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      });
      return { content: [{ type: 'text', text: stripAnsi(stdout + (stderr ? '\n' + stderr : '')) }] };
    } catch (err) {
      // exit code 1 = 有測試失敗，仍然回傳輸出
      const output = stripAnsi((err.stdout || '') + '\n' + (err.stderr || err.message || ''));
      return { content: [{ type: 'text', text: output }] };
    }
  },
};
