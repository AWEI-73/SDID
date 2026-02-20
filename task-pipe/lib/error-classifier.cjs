#!/usr/bin/env node
/**
 * Error Classifier v1.0
 * 智能錯誤分類器 - 判斷錯誤是否可自動修復
 * 
 * 借鏡: OpenClaw src/agents/pi-embedded-helpers/errors.ts
 */

/**
 * 錯誤分類結果
 * @typedef {Object} ClassificationResult
 * @property {string} type - 錯誤類型代碼
 * @property {boolean|'maybe'} recoverable - 是否可自動修復
 * @property {string} match - 匹配到的文字
 * @property {string} suggestion - 建議修復動作
 */

// 錯誤模式庫
const ERROR_PATTERNS = [
    // === RECOVERABLE (可自動修復) ===
    {
        pattern: /Missing GEMS-FUNC|缺少 GEMS|GEMS.*缺失|標籤覆蓋率.*不足|缺失函式|覆蓋率.*%|Missing function tags/i,
        type: 'GEMS_TAG_MISSING',
        recoverable: true,
        suggestion: '執行 gems-fixer 自動補標籤'
    },
    {
        pattern: /Route not registered|路由.*未註冊|未找到路由|Module.*not.*route/i,
        type: 'ROUTE_NOT_REGISTERED',
        recoverable: true,
        suggestion: '執行 route-fixer 自動註冊路由'
    },
    {
        pattern: /Module not exported|export.*missing|未匯出|沒有 export/i,
        type: 'EXPORT_MISSING',
        recoverable: true,
        suggestion: '在 index.ts 中加入 export'
    },
    {
        pattern: /Cannot find module|Import.*not found|找不到模組|無法解析.*import/i,
        type: 'IMPORT_MISSING',
        recoverable: true,
        suggestion: '檢查 import 路徑或執行 npm install'
    },
    {
        pattern: /Cannot find.*test.*file|測試檔案.*缺失|test file.*missing/i,
        type: 'TEST_FILE_MISSING',
        recoverable: true,
        suggestion: '建立對應的測試檔案'
    },
    {
        pattern: /GEMS-DEPS-RISK.*缺少|缺少 GEMS-DEPS-RISK|Missing.*DEPS-RISK|P0.*Deps-Risk|P0.*Flow/i,
        type: 'DEPS_RISK_MISSING',
        recoverable: true,
        suggestion: '為 P0 函式加入 GEMS-DEPS-RISK 和 GEMS-FLOW 標籤'
    },

    // === MAYBE (需智能判斷) ===
    {
        pattern: /Test failed.*expected|Expected.*received|斷言失敗|assertion.*fail/i,
        type: 'TEST_ASSERTION_FAIL',
        recoverable: 'maybe',
        suggestion: '檢查測試邏輯或實作是否正確'
    },
    {
        pattern: /Type.*not assignable|型別.*不相容|TS\d{4}/i,
        type: 'TYPE_MISMATCH',
        recoverable: 'maybe',
        suggestion: '檢查 TypeScript 型別定義'
    },
    {
        pattern: /覆蓋率.*%|coverage.*below/i,
        type: 'COVERAGE_LOW',
        recoverable: 'maybe',
        suggestion: '增加標籤或調整覆蓋率門檻'
    },
    {
        pattern: /Integration.*mock|假.*整合.*測試|fake.*integration/i,
        type: 'FAKE_INTEGRATION_TEST',
        recoverable: 'maybe',
        suggestion: '移除 jest.mock，使用真實依賴'
    },

    // === STRUCTURAL (結構性問題，需人類介入) ===
    {
        pattern: /Cannot read.*undefined|TypeError.*undefined|null.*property/i,
        type: 'RUNTIME_ERROR',
        recoverable: false,
        suggestion: '需要 Debug 程式邏輯'
    },
    {
        pattern: /Maximum call stack|RangeError.*stack/i,
        type: 'INFINITE_LOOP',
        recoverable: false,
        suggestion: '檢查遞迴終止條件'
    },
    {
        pattern: /ENOENT|no such file|檔案不存在/i,
        type: 'FILE_NOT_FOUND',
        recoverable: false,
        suggestion: '確認檔案路徑是否正確'
    },
    {
        pattern: /SyntaxError|Unexpected token|語法錯誤/i,
        type: 'SYNTAX_ERROR',
        recoverable: false,
        suggestion: '修正程式碼語法'
    },
    {
        pattern: /EACCES|permission denied|權限不足/i,
        type: 'PERMISSION_ERROR',
        recoverable: false,
        suggestion: '檢查檔案/目錄權限'
    },
    {
        pattern: /out of memory|heap.*exhausted|記憶體不足/i,
        type: 'MEMORY_ERROR',
        recoverable: false,
        suggestion: '優化記憶體使用或增加 Node heap size'
    }
];

/**
 * 分類錯誤類型
 * @param {string} logContent - Log 內容
 * @returns {ClassificationResult}
 */
function classifyError(logContent) {
    if (!logContent || typeof logContent !== 'string') {
        return {
            type: 'UNKNOWN',
            recoverable: false,
            match: '',
            suggestion: '無法分析錯誤內容'
        };
    }

    for (const { pattern, type, recoverable, suggestion } of ERROR_PATTERNS) {
        const match = logContent.match(pattern);
        if (match) {
            return {
                type,
                recoverable,
                match: match[0],
                suggestion
            };
        }
    }

    return {
        type: 'UNKNOWN',
        recoverable: false,
        match: '',
        suggestion: '未知錯誤類型，需人工檢視'
    };
}

/**
 * 批量分類多個錯誤訊息
 * @param {string[]} messages - 錯誤訊息陣列
 * @returns {ClassificationResult[]}
 */
function classifyErrors(messages) {
    return messages.map(msg => classifyError(msg));
}

/**
 * 取得可自動修復的錯誤類型列表
 * @returns {string[]}
 */
function getRecoverableTypes() {
    return ERROR_PATTERNS
        .filter(p => p.recoverable === true)
        .map(p => p.type);
}

/**
 * 取得需要智能判斷的錯誤類型列表
 * @returns {string[]}
 */
function getMaybeRecoverableTypes() {
    return ERROR_PATTERNS
        .filter(p => p.recoverable === 'maybe')
        .map(p => p.type);
}

/**
 * 檢查錯誤是否可自動修復
 * @param {string} errorType - 錯誤類型
 * @returns {boolean}
 */
function isRecoverable(errorType) {
    const pattern = ERROR_PATTERNS.find(p => p.type === errorType);
    return pattern?.recoverable === true;
}

/**
 * 檢查錯誤是否需要智能判斷
 * @param {string} errorType - 錯誤類型
 * @returns {boolean}
 */
function needsSmartGate(errorType) {
    const pattern = ERROR_PATTERNS.find(p => p.type === errorType);
    return pattern?.recoverable === 'maybe';
}

// CLI 測試模式
if (require.main === module) {
    const testCases = [
        'Missing GEMS-FUNC tag for function loginUser',
        'Route not registered: /api/users',
        'Cannot find module "./utils"',
        'Test failed: Expected 5 but received 3',
        'TypeError: Cannot read properties of undefined',
        'SyntaxError: Unexpected token }',
        '標籤覆蓋率不足 (60%)',
        'Integration 測試無效: 使用了 jest.mock()'
    ];

    console.log('=== Error Classifier Test ===\n');
    for (const testCase of testCases) {
        const result = classifyError(testCase);
        console.log(`Input: "${testCase}"`);
        console.log(`  Type: ${result.type}`);
        console.log(`  Recoverable: ${result.recoverable}`);
        console.log(`  Suggestion: ${result.suggestion}\n`);
    }
}

module.exports = {
    classifyError,
    classifyErrors,
    getRecoverableTypes,
    getMaybeRecoverableTypes,
    isRecoverable,
    needsSmartGate,
    ERROR_PATTERNS
};
