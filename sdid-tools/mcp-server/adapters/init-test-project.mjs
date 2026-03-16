/**
 * sdid-init-test-project
 * 建立臨時測試專案，供 flow audit 使用。
 * 回傳 projectPath 和 draftPath，AI 拿到後照正常 SDID 流程跑。
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const DRAFTS = {
  todo: (name) => `# 📋 ${name} - 需求草稿

**迭代**: iter-1
**日期**: ${new Date().toISOString().split('T')[0]}
**狀態**: ✅ 已確認

## 一句話目標
建立一個簡潔的待辦事項管理應用，支援新增、完成、刪除任務。

## 功能模組清單
- [x] 基礎建設 (types, config)
- [x] 任務管理模組 (Task CRUD)
- [x] UI 介面模組

**草稿狀態**: ✅ PASS
**POC Level**: S
`,
  calculator: (name) => `# 📋 ${name} - 需求草稿

**迭代**: iter-1
**日期**: ${new Date().toISOString().split('T')[0]}
**狀態**: ✅ 已確認

## 一句話目標
建立一個具備計算歷史記錄的計算機應用。

## 功能模組清單
- [x] 基礎建設 (types, config)
- [x] 計算核心模組
- [x] 歷史記錄模組

**草稿狀態**: ✅ PASS
**POC Level**: S
`,
};

export const initTestProject = {
  schema: {
    name: 'sdid-init-test-project',
    description: '建立臨時測試專案供 flow audit 使用。回傳 projectPath 和 draftPath，AI 拿到後照正常 SDID 流程跑。',
    inputSchema: {
      type: 'object',
      properties: {
        flow: {
          type: 'string',
          enum: ['taskpipe', 'blueprint'],
          description: '流程類型，預設 taskpipe',
        },
        type: {
          type: 'string',
          enum: ['todo', 'calculator'],
          description: '測試專案類型，預設 todo',
        },
      },
    },
  },

  handler: async ({ flow = 'taskpipe', type = 'todo' }) => {
    const name = `sdid-audit-${flow}-${type}-${Date.now()}`;
    const projectPath = path.join(os.tmpdir(), name);
    const pocDir = path.join(projectPath, '.gems', 'iterations', 'iter-1', 'poc');

    fs.mkdirSync(pocDir, { recursive: true });

    const draftFn = DRAFTS[type] || DRAFTS.todo;
    const draftContent = draftFn(name);
    const draftPath = path.join(pocDir, 'requirement_draft_iter-1.md');
    fs.writeFileSync(draftPath, draftContent, 'utf8');

    return {
      content: [{
        type: 'text',
        text: [
          `✅ 測試專案已建立`,
          ``,
          `projectPath: ${projectPath}`,
          `draftPath: ${draftPath}`,
          `flow: ${flow}`,
          `type: ${type}`,
          ``,
          `下一步：呼叫 sdid-loop，project=${projectPath}`,
          `跑完整個 iter-1 後，把觀察到的問題寫成 flow audit 報告。`,
        ].join('\n'),
      }],
    };
  },
};
