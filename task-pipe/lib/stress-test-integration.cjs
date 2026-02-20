/**
 * 壓力測試整合模組
 * 供 Phase 7 調用，產出 suggestions 陣列
 */

const fs = require('fs');
const path = require('path');

// 測試案例定義
const TEST_CASES = {
    edgeValues: {
        name: '邊界值處理',
        tests: [
            {
                id: 'EV-001',
                name: '空值檢查',
                check: (code) => code.includes('=== null') || code.includes('=== undefined') || code.includes('!expr') || code.includes('!input'),
                suggestion: { type: 'REFACTOR', description: '新增空值防護檢查', priority: 2 },
            },
            {
                id: 'EV-002',
                name: '數值極端值 (isFinite)',
                check: (code) => code.includes('isFinite') || code.includes('Number.isFinite'),
                suggestion: { type: 'REFACTOR', description: '使用 isFinite() 檢查數值有效性', priority: 2 },
            },
            {
                id: 'EV-003',
                name: '字串長度限制',
                check: (code) => code.includes('.length') && (code.includes('> 0') || code.includes('=== 0')),
                suggestion: { type: 'REFACTOR', description: '新增字串長度驗證', priority: 3 },
            },
        ],
    },
    errorRecovery: {
        name: '錯誤恢復',
        tests: [
            {
                id: 'ER-001',
                name: 'try-catch 錯誤處理',
                check: (code) => code.includes('try {') && code.includes('catch'),
                suggestion: { type: 'REFACTOR', description: '新增 try-catch 錯誤處理區塊', priority: 1 },
            },
            {
                id: 'ER-002',
                name: '明確錯誤訊息',
                check: (code) => code.includes("throw new Error") && code.includes("'"),
                suggestion: { type: 'REFACTOR', description: '改善錯誤訊息可讀性', priority: 3 },
            },
        ],
    },
};

/**
 * 執行真實專案壓力測試並產出 suggestions
 */
function runRealProjectStressTest(projectPath) {
    const suggestions = [];
    let sugIdx = 1;

    // 找 JS 目錄
    const jsDirs = ['js', 'src'];
    let jsPath = null;

    for (const dir of jsDirs) {
        const testPath = path.join(projectPath, dir);
        if (fs.existsSync(testPath)) {
            jsPath = testPath;
            break;
        }
    }

    if (!jsPath) {
        return { suggestions: [], error: '找不到源碼目錄' };
    }

    // 掃描所有 JS 檔案
    const jsFiles = fs.readdirSync(jsPath).filter(f => f.endsWith('.js') && !f.includes('test'));

    for (const file of jsFiles) {
        const filePath = path.join(jsPath, file);
        const code = fs.readFileSync(filePath, 'utf8');

        for (const [, category] of Object.entries(TEST_CASES)) {
            for (const test of category.tests) {
                const passed = test.check(code);

                if (!passed) {
                    suggestions.push({
                        id: `SUG-${sugIdx++}`,
                        type: test.suggestion.type,
                        description: `[${file}] ${test.suggestion.description}`,
                        priority: test.suggestion.priority,
                        testId: test.id,
                        file: file,
                    });
                }
            }
        }
    }

    return {
        suggestions,
        passRate: suggestions.length > 0 ? 0 : 100,
        total: jsFiles.length * 5,
        failed: suggestions.length,
    };
}

module.exports = { runRealProjectStressTest, TEST_CASES };
