/**
 * sdid-audit-save-report
 * AI 跑完 flow audit 後，呼叫此工具存報告 + 清除 temp 專案。
 *
 * 輸入：
 *   report      — 報告內容（Markdown 字串）
 *   projectPath — 測試專案路徑（temp 目錄），用於清除
 *   keep        — 是否保留測試專案（debug 用，預設 false）
 *
 * 輸出：
 *   reportPath  — 報告存放位置
 */

import fs from 'fs';
import path from 'path';
import { SDID_ROOT } from '../lib/utils.mjs';

const REPORT_DIR = path.join(SDID_ROOT, '.agent', 'skills', 'sdid-flow-tester');

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export const auditReport = {
  schema: {
    name: 'sdid-audit-save-report',
    description: 'AI 跑完 SDID flow audit 後，呼叫此工具存稽核報告並清除臨時測試專案。',
    inputSchema: {
      type: 'object',
      required: ['report', 'projectPath'],
      properties: {
        report: {
          type: 'string',
          description: '稽核報告內容（Markdown 格式）',
        },
        projectPath: {
          type: 'string',
          description: '測試專案的絕對路徑（由 sdid-init-test-project 回傳），跑完後清除用',
        },
        keep: {
          type: 'boolean',
          description: '是否保留測試專案目錄（debug 用，預設 false）',
        },
      },
    },
  },

  handler: async ({ report, projectPath, keep = false }) => {
    const lines = [];

    // 1. 存報告
    try {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
      const reportPath = path.join(REPORT_DIR, `last-report-${timestamp()}.md`);
      fs.writeFileSync(reportPath, report, 'utf8');
      lines.push(`✅ 報告已存：${reportPath}`);
    } catch (err) {
      lines.push(`⚠️  報告存檔失敗：${err.message}`);
    }

    // 2. 清除測試專案（除非 keep=true）
    if (!keep && projectPath) {
      try {
        fs.rmSync(projectPath, { recursive: true, force: true });
        lines.push(`🧹 測試專案已清除：${path.basename(projectPath)}`);
      } catch (err) {
        lines.push(`⚠️  清除失敗：${err.message}`);
      }
    } else if (keep) {
      lines.push(`📂 測試專案保留：${projectPath}`);
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  },
};
