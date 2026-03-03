/**
 * CLI-based tool adapters
 * spec-gen, spec-gate, blueprint-gate, micro-fix-gate, sdid-run
 */
import { z } from 'zod';
import { createRequire } from 'node:module';
import path from 'node:path';
import { TOOLS_DIR, SDID_ROOT, resolvePath, runCli, stripAnsi } from '../lib/utils.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

// ── sdid-spec-gen ──

export const specGen = {
  schema: {
    title: 'SDID Spec Generator',
    description: '字典生成 — 讀 Enhanced Draft 或 requirement_spec，產出 .gems/specs/*.json + _index.json。自動偵測 Blueprint/Task-Pipe 格式。',
    inputSchema: {
      project: z.string().describe('專案根目錄路徑'),
      input: z.string().describe('輸入的 Draft/Spec markdown 檔案路徑'),
      iter: z.number().optional().describe('只處理指定迭代（如 2 代表 Iter 2）'),
      dryRun: z.boolean().optional().describe('預覽模式，不實際寫入檔案'),
    },
  },
  async handler({ project, input, iter, dryRun }) {
    const args = [`--project=${resolvePath(project)}`, `--input=${resolvePath(input)}`];
    if (iter) args.push(`--iter=${iter}`);
    if (dryRun) args.push('--dry-run');
    const result = await runCli('spec-gen.cjs', args);
    return { content: [{ type: 'text', text: result.output }] };
  },
};

// ── sdid-spec-gate ──

export const specGate = {
  schema: {
    title: 'SDID Spec Gate',
    description: '字典品質驗證 — 執行 5 項檢查（schema/index 格式/一致性/manages 路徑/lineRange）。回傳 PASS 或 FAIL + 錯誤明細。',
    inputSchema: {
      project: z.string().describe('專案根目錄路徑'),
      fixIndex: z.boolean().optional().describe('自動補齊 _index.json 遺漏的 P0/P1 條目'),
      dryRun: z.boolean().optional().describe('搭配 fixIndex，只顯示不寫入'),
    },
  },
  async handler({ project, fixIndex, dryRun }) {
    const args = [`--project=${resolvePath(project)}`];
    if (fixIndex) args.push('--fix-index');
    if (dryRun) args.push('--dry-run');
    const result = await runCli('spec-gate.cjs', args);
    return { content: [{ type: 'text', text: result.output }] };
  },
};

// ── sdid-blueprint-gate ──

export const blueprintGate = {
  schema: {
    title: 'SDID Blueprint Gate',
    description: '藍圖品質驗證 — 檢查 Enhanced Draft 的機械規則（AC 完整性、佔位符、依賴、迭代預算等）。',
    inputSchema: {
      draft: z.string().describe('Enhanced Draft 檔案路徑'),
      iter: z.number().optional().describe('目標迭代（預設自動偵測）'),
      target: z.string().optional().describe('專案根目錄（用於 log 存檔）'),
    },
  },
  async handler({ draft, iter, target }) {
    const args = [`--draft=${resolvePath(draft)}`];
    if (iter) args.push(`--iter=${iter}`);
    if (target) args.push(`--target=${resolvePath(target)}`);
    const result = await runCli('blueprint-gate.cjs', args);
    return { content: [{ type: 'text', text: result.output }] };
  },
};

// ── sdid-micro-fix-gate ──

export const microFixGate = {
  schema: {
    title: 'SDID Micro-Fix Gate',
    description: '小修驗收 — 檢查改動檔案的 GEMS 標籤覆蓋率和 export 完整性。適用於 MICRO-FIX 和 POC-FIX 路線。',
    inputSchema: {
      target: z.string().describe('專案根目錄路徑'),
      changed: z.string().optional().describe('逗號分隔的改動檔案清單（省略則自動掃 src/）'),
    },
  },
  async handler({ target, changed }) {
    const args = [`--target=${resolvePath(target)}`];
    if (changed) args.push(`--changed=${changed}`);
    const result = await runCli('micro-fix-gate.cjs', args);
    return { content: [{ type: 'text', text: result.output }] };
  },
};

// ── sdid-run (通用 CLI 執行器) ──

const ALLOWED_PREFIXES = ['sdid-tools/', 'task-pipe/'];

function isAllowedCommand(cmd) {
  const withoutNode = cmd.trim().replace(/^node\s+/, '');
  return ALLOWED_PREFIXES.some(prefix => withoutNode.startsWith(prefix));
}

export const run = {
  schema: {
    title: 'SDID CLI Runner',
    description: '通用 SDID CLI 執行器 — 執行任何 sdid-tools/ 或 task-pipe/ 下的腳本命令，回傳 stdout（含 anchor 標籤）。搭配 sdid-state-guide 的 NEXT: 命令使用。',
    inputSchema: {
      command: z.string().describe('完整的 node 命令（如 "node sdid-tools/blueprint-gate.cjs --draft=... --target=..."）'),
      project: z.string().optional().describe('專案根目錄路徑（用於替換命令中的 --target=<project>）'),
    },
  },
  async handler({ command, project }) {
    try {
      let cmd = command;
      if (project) {
        const resolved = resolvePath(project);
        cmd = cmd.replace(/--target=<project>/g, `--target=${resolved}`);
        cmd = cmd.replace(/<project>/g, resolved);
      }

      if (!isAllowedCommand(cmd)) {
        return { content: [{ type: 'text', text: `ERROR: 安全限制 — 只允許執行 sdid-tools/ 和 task-pipe/ 下的腳本。\n收到: ${cmd}` }] };
      }

      const trimmed = cmd.trim().replace(/^node\s+/, '');
      const parts = trimmed.split(/\s+/);
      const scriptRelative = parts[0];
      const args = parts.slice(1);
      const scriptPath = path.join(SDID_ROOT, scriptRelative);

      const { stdout, stderr } = await execFileAsync('node', [scriptPath, ...args], {
        cwd: SDID_ROOT,
        timeout: 120000,
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      });

      return { content: [{ type: 'text', text: stripAnsi(stdout + (stderr ? '\n' + stderr : '')) }] };
    } catch (err) {
      const output = stripAnsi((err.stdout || '') + '\n' + (err.stderr || err.message || ''));
      return { content: [{ type: 'text', text: output }] };
    }
  },
};
