#!/usr/bin/env node
/**
 * Pipeline Validator v3 - 自動化測試環境產生器
 * 
 * 功能:
 * 1. 自動產生 test-{timestamp} 資料夾
 * 2. 在資料夾內放入 {專案類型}.md（原始需求）
 * 3. 輸出 AGENT PROMPT 讓 AI 直接執行 runner.cjs
 * 
 * 流程:
 * auto-runner → 產生 test-xxx/{專案}.md
 * runner.cjs → 偵測到 .md → 自動進入 POC Step 0
 * POC Step 0 → 讀取 .md 產生 requirement_draft
 * 
 * 使用方式:
 * node task-pipe/tools/auto-runner/index.cjs --generate-test-prompt
 * node task-pipe/tools/auto-runner/index.cjs --generate-test-prompt --type=todo --level=M
 */

const fs = require('fs');
const path = require('path');
const { summaryOutput } = require('../../lib/shared/safe-output.cjs');

// ============================================
// 項目模板庫（原始需求內容）
// ============================================
const PROJECT_TEMPLATES = {
    todo: {
        name: 'todo-app',
        description: '待辦事項管理系統',
        objective: '建立一個具備 CRUD 功能的待辦事項管理系統，讓使用者可以新增、編輯、刪除任務，並能標記完成狀態',
        features: [
            '任務 CRUD 管理：新增、編輯、刪除任務',
            '任務狀態切換：標記任務完成/未完成',
            '任務列表顯示：顯示所有任務，支援篩選',
            '資料持久化：LocalStorage 儲存',
        ],
        style: '簡潔現代風格',
        dataStructure: 'Task (id: string, title: string, completed: boolean, createdAt: Date)',
        userRole: '一般使用者，需要追蹤每日待辦事項',
        boundary: '單一使用者最多 1000 筆任務',
    },
    note: {
        name: 'note-app',
        description: 'Markdown 筆記應用',
        objective: '建立一個支援 Markdown 的筆記管理系統，讓使用者可以撰寫、編輯、分類筆記',
        features: [
            '筆記 CRUD：新增、編輯、刪除筆記',
            'Markdown 預覽：即時預覽 Markdown 內容',
            '分類管理：為筆記新增分類標籤',
            '搜尋功能：全文搜尋筆記內容',
        ],
        style: '極簡設計',
        dataStructure: 'Note (id: string, title: string, content: string, category: string, updatedAt: Date)',
        userRole: '知識工作者，需要撰寫和整理筆記',
        boundary: '單一筆記最多 10000 字',
    },
    counter: {
        name: 'counter-app',
        description: '計數器應用',
        objective: '建立一個多功能計數器工具，讓使用者可以建立多個計數器並追蹤數值變化',
        features: [
            '數值增減：點擊按鈕增減計數',
            '計數器管理：建立多個獨立計數器',
            '歷史記錄：記錄每次操作時間',
            '資料儲存：LocalStorage 持久化',
        ],
        style: '大字體顯示',
        dataStructure: 'Counter (id: string, name: string, value: number, history: Array<{action: string, timestamp: Date}>)',
        userRole: '需要計數的使用者，如健身計次、庫存盤點',
        boundary: '單一計數器數值範圍 -999999 到 999999',
    },
    calculator: {
        name: 'calculator',
        description: '簡單計算機',
        objective: '建立一個基本的計算機應用，支援四則運算和歷史記錄',
        features: [
            '基本運算：加減乘除四則運算',
            '歷史記錄：顯示過去的計算結果',
            '鍵盤支援：支援數字鍵盤輸入',
            '清除功能：C 清除當前 / AC 全部清除',
        ],
        style: '經典計算機風格',
        dataStructure: 'Calculation (id: string, expression: string, result: number, createdAt: Date)',
        userRole: '需要快速計算的使用者',
        boundary: '支援最多 15 位數字的運算',
    },
    'question-bank': {
        name: 'question-bank',
        description: '題庫管理系統',
        objective: '建立一個題庫管理系統，允許老師管理試題、建立試卷並進行預覽。',
        features: [
            '試題 CRUD：新增、編輯、刪除試題（含題目、選項、正解）',
            '分類管理：按學科或難度分類',
            '試卷組成：從題庫中選題組成試卷',
            '隨機抽題：根據條件自動產生試卷',
        ],
        style: '專業教學風格',
        dataStructure: 'Question (id: string, content: string, options: Array<string>, answer: number, level: string, category: string)',
        userRole: '教師或教學行政人員',
        boundary: '支援最多 5000 題，每份試卷最多 100 題',
    },
};

// ============================================
// 產生「原始需求」MD（給 AI 讀的，不是 requirement_draft）
// ============================================
function generateProjectRequest(template, level) {
    return `# ${template.description}

## 專案目標

${template.objective}

## 功能需求

${template.features.map((f, i) => `${i + 1}. ${f}`).join('\n')}

## 使用者

${template.userRole}

## 資料結構

${template.dataStructure}

## 限制條件

${template.boundary}

## 風格

${template.style}

## 驗證等級

**Level**: ${level}
`;
}

// ============================================
// 主要函式：產生測試環境
// ============================================
function generateTestProject(options = {}) {
    // 隨機選擇項目類型
    const types = Object.keys(PROJECT_TEMPLATES);
    const selectedType = options.type || types[Math.floor(Math.random() * types.length)];
    const template = PROJECT_TEMPLATES[selectedType];

    if (!template) {
        throw new Error(`未知的項目類型: ${selectedType}`);
    }

    // 等級設定
    const level = (options.level || 'M').toUpperCase();

    // 建立 test-{timestamp} 資料夾
    const timestamp = Date.now();
    const testFolderName = `test-${timestamp}`;
    const testDir = path.join(process.cwd(), testFolderName);

    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }

    // 產生並寫入「原始需求」MD
    const requestContent = generateProjectRequest(template, level);
    const requestFileName = `${template.name}.md`;
    const requestPath = path.join(testDir, requestFileName);
    fs.writeFileSync(requestPath, requestContent);

    return {
        testFolderName,
        testDir,
        projectName: template.name,
        requestFileName,
        requestPath,
        type: selectedType,
        level,
        template,
    };
}

// ============================================
// CLI 入口
// ============================================
function main() {
    const args = process.argv.slice(2);

    // 顯示使用說明
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Pipeline Validator v3 - 自動化測試環境產生器

使用方式:
  node task-pipe/tools/auto-runner/index.cjs --generate-test-prompt

選項:
  --type=<type>      指定項目類型 (todo, note, counter, calculator)
  --level=<S|M|L>    指定等級 (S=快速, M=標準, L=完整)
  --help, -h         顯示此說明

範例:
  node task-pipe/tools/auto-runner/index.cjs --generate-test-prompt
  node task-pipe/tools/auto-runner/index.cjs --generate-test-prompt --type=todo --level=L
`);
        return;
    }

    // 檢查是否要產生測試專案
    if (!args.includes('--generate-test-prompt')) {
        console.log('使用方式:');
        console.log('  node task-pipe/tools/auto-runner/index.cjs --generate-test-prompt');
        console.log('  node task-pipe/tools/auto-runner/index.cjs --help');
        return;
    }

    // 解析選項
    const options = {};

    const typeArg = args.find(a => a.startsWith('--type='));
    if (typeArg) {
        options.type = typeArg.split('=')[1];
    }

    const levelArg = args.find(a => a.startsWith('--level='));
    if (levelArg) {
        options.level = levelArg.split('=')[1];
    }

    // 產生測試環境
    const result = generateTestProject(options);

    // 摘要輸出（終端機）
    const summary = `
================================================================================
Pipeline Validator v3 - Test Environment Ready
================================================================================

Test Project: ${result.testFolderName}
Request File: ${result.requestFileName}
Project Type: ${result.type}
Level: ${result.level}

@EXECUTE
node task-pipe/runner.cjs --target=${result.testFolderName}

[i] Full instructions saved to: ${result.testFolderName}/_instructions.txt
================================================================================
`;

    // 完整輸出（檔案）
    const fullOutput = `
================================================================================
Pipeline Validator v3 - Test Environment Ready
================================================================================

Test Project: ${result.testFolderName}
Request File: ${result.requestFileName}
Project Type: ${result.type}
Level: ${result.level}

--------------------------------------------------------------------------------

@EXECUTE

Execute the following command to start GEMS flow:

node task-pipe/runner.cjs --target=${result.testFolderName}

--------------------------------------------------------------------------------

[!!!] CRITICAL QUALITY REQUIREMENTS [!!!]

⚠️ POC Step 2 嚴格品質檢查 (v3.0):
- POC 必須涵蓋 Draft 列出的所有功能模組（覆蓋率 ≥ 30%）
- @GEMS-VERIFIED 勾選的項目必須有對應的函式實作
- 禁止使用通用模板，必須根據 Draft 內容調整
- 如果品質評分 < 50，會觸發 BLOCKER 無法進入下一步

⚠️ POC Step 3 嚴格品質檢查 (v3.0):
- requirement_spec 必須有 ≥ 2 個 Story（包含業務 Story）
- 每個 Story 必須有對應的 AC（驗收標準）
- Draft 列出的功能必須對應到 Spec 的 Story（覆蓋率 ≥ 50%）
- 禁止只寫 Story X.0 就通過
- 如果品質評分 < 50，會觸發 BLOCKER 無法進入 PLAN

🚫 禁止行為:
- ❌ 只寫骨架就提交
- ❌ 複製貼上通用模板
- ❌ @GEMS-VERIFIED 勾選但沒有實作對應函式
- ❌ requirement_spec 只有一個籠統的 Story

✅ 必須達成:
- ✅ POC 中的每個 @GEMS-FUNCTION 都有真實邏輯
- ✅ Mock 資料欄位符合 Contract 定義
- ✅ 每個 Story 有明確的角色/功能/目標描述
- ✅ 每個 AC 的 Given/When/Then 有具體內容（≥ 8 字）

--------------------------------------------------------------------------------

[!] Important Reminders:

1. Do not read .cjs source code
2. Only read terminal output
3. Follow the anchors in output
4. After each step, read output and execute next step
5. Stop and report when encountering BLOCKER

--------------------------------------------------------------------------------

[!] Terminal Output Truncation:

If terminal output appears truncated or garbled, check the logs directory:

  .gems/iterations/iter-X/logs/

Log files contain:
- *-pass-*.log   : Success output + next command
- *-error-*.log  : Error details + fix instructions
- *-template-*.log : Template content (for scaffolds)

Example: view_file(".gems/iterations/iter-1/logs/poc-step-1-pass-*.log")

--------------------------------------------------------------------------------

Project Details:
- Folder: ${result.testFolderName}
- Request: ${result.requestFileName}
- Type: ${result.type}
- Level: ${result.level}
- Template: ${result.template.name}

Next Steps:
1. Execute: node task-pipe/runner.cjs --target=${result.testFolderName}
2. Read terminal output (or logs if truncated)
3. Follow @CONTEXT, @RULES, @TASK anchors
4. Execute next command as instructed

--------------------------------------------------------------------------------
`;

    // 使用摘要模式輸出
    const outputFile = path.join(result.testDir, '_instructions.txt');
    summaryOutput(summary, fullOutput, outputFile);
}

if (require.main === module) {
    main();
}

module.exports = { generateTestProject, generateProjectRequest, PROJECT_TEMPLATES };
