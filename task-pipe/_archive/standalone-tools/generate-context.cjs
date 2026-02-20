#!/usr/bin/env node
/**
 * Generate Context for AI
 * 
 * 產生可以直接貼到 AI 對話的上下文
 * 
 * 用法:
 *   node task-pipe/tools/generate-context.cjs [projectPath]
 *   node task-pipe/tools/generate-context.cjs my_workflow > context.txt
 */

const fs = require('fs');
const path = require('path');

const projectPath = process.argv[2] || '.';
const docsPath = path.join(projectPath, '.gems', 'docs');

// 載入索引
let functionsJson = null;
let functionIndex = null;

try {
  functionsJson = JSON.parse(fs.readFileSync(path.join(docsPath, 'functions.json'), 'utf8'));
  functionIndex = JSON.parse(fs.readFileSync(path.join(docsPath, 'function-index.json'), 'utf8'));
} catch (e) {
  console.error(`錯誤: 找不到索引檔案，請先執行 SCAN`);
  console.error(`  node task-pipe/runner.cjs --phase=SCAN --target=${projectPath}`);
  process.exit(1);
}

// 產生上下文
const context = `
# 專案函式索引

## 統計
- 總函式: ${functionsJson.functions.length}
- P0 (核心): ${functionsJson.byRisk?.P0 || functionIndex.byPriority.P0?.length || 0}
- P1 (重要): ${functionsJson.byRisk?.P1 || functionIndex.byPriority.P1?.length || 0}
- 平均行數: ${functionsJson.avgFunctionLines || '?'}

## P0 函式 (修改需謹慎)
${(functionIndex.byPriority.P0 || []).map(name => {
  const func = functionsJson.functions.find(f => f.name === name);
  if (!func) return `- ${name}`;
  return `- ${name} | ${func.file} | 行 ${func.startLine}-${func.endLine} | FLOW: ${func.flow || '?'}`;
}).join('\n')}

## 按檔案索引
${Object.entries(functionIndex.byFile).map(([file, funcs]) => {
  return `### ${file}\n${funcs.map(f => `- ${f.name} (${f.priority}) | 行 ${f.lines}`).join('\n')}`;
}).join('\n\n')}

## 修改規則

1. **分片讀取**: 只讀函式的行範圍，不要讀整個檔案
2. **遵守 FLOW**: 修改必須保持流程順序
3. **遵守 DEPS**: 不能引入未宣告的依賴
4. **P0 謹慎**: 核心函式修改需特別小心

## 範例

修改 createTask:
1. 查索引: createTask 在 KanbanService.ts 的 19-40 行
2. 只讀那 22 行
3. 修改時遵守 FLOW: ValidateInput→DataStore.add→EventBus.emit→Return
`;

console.log(context);
