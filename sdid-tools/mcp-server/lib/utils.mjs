/**
 * MCP Server 共用工具函式
 * stripAnsi, runCli, runRunner, resolvePath
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** sdid-tools/ 根目錄 */
export const TOOLS_DIR = path.resolve(__dirname, '..', '..');

/** SDID workspace 根目錄 */
export const SDID_ROOT = path.resolve(TOOLS_DIR, '..');

/** 去掉 ANSI escape codes */
export function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/** 將路徑解析為絕對路徑 */
export function resolvePath(p) {
  if (!p) return p;
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

/** 執行 sdid-tools/ 下的 CLI 工具，捕獲 stdout+stderr */
export async function runCli(script, args) {
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

/** 執行 task-pipe/runner.cjs */
export async function runRunner(args) {
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
