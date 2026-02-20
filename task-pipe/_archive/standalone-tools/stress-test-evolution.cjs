const { extractSmartTags, validateSpecCompliance, calculateComplianceScore } = require('../lib/scan/gems-validator-lite.cjs');
const { classifyError, classifyErrors } = require('../lib/error-classifier.cjs');

console.log('🔥 Evolution Blueprint - Code Core Stress Test 🔥\n');

// ==========================================
// 1. Validator Lite 邊界測試
// ==========================================
console.log('>>> [1] Validator Lite Edge Cases');

const edgeCaseTags = [
    {
        name: 'Emoji Power',
        content: `/**
 * GEMS: renderUI | P1 | 🍎🍌 Tag Check
 * FLOW: Init ➡️ Load ➡️ 🚀 Launch
 * DEPS: [API_v2, 🛠Utils]
 */`
    },
    {
        name: 'Chaos Format',
        content: `
       //    GEMS   :   messyFunction    |P0|
        //FLOW:step1->step2
     //DEPS:none
        `
    },
    {
        name: 'Chinese Keywords',
        content: `// GEMS: 儲存資料 P1
// 流程: 驗證 -> 寫入
// 依賴: [資料庫]
// 風險: 高`
    },
    {
        name: 'Minimalist (Missing Fields)',
        content: `// P0 CriticalFunction`
    },
    {
        name: 'Broken/Incomplete',
        content: `/* GEMS: broken | P? | */`
    },
    {
        name: 'False Positive (Should Ignore)',
        content: `// This function handles GEMS payment processing logic
// flow of money is important`
    }
];

edgeCaseTags.forEach(test => {
    console.log(`\nTesting: ${test.name}`);
    console.log(`Input: ${test.content.trim().replace(/\n/g, '\\n')}`);
    const result = extractSmartTags(test.content);
    console.log(`  -> Func: ${result.functionName || '(null)'}`);
    console.log(`  -> Priority: ${result.priority || '(null)'}`);
    console.log(`  -> Flow: ${result.flow || '(null)'}`);
    console.log(`  -> Deps: ${result.deps || '(null)'}`);

    // 驗證規格
    const issues = validateSpecCompliance(result);
    // 只有當優先級存在時才計算分數
    const score = result.priority ? calculateComplianceScore(issues) : 0;
    console.log(`  -> Score: ${score}/100`);
    if (issues.length > 0) {
        console.log(`  -> Issues: ${issues.map(i => i.msg).join(', ')}`);
    }
});

// ==========================================
// 2. Error Classifier 壓力測試
// ==========================================
console.log('\n\n>>> [2] Error Classifier Stress Test');

const hugeLog = "Error: Something went wrong\n" + "at stack trace line ...\n".repeat(1000) + "Caused by: Missing GEMS-FUNC tag in file.ts";

const ambiguousLogs = [
    "Error: ECONNREFUSED 127.0.0.1:8080", // 網路錯誤
    "Warning: React does not recognize the `active` prop", // 警告非錯誤
    hugeLog, // 巨型 Log (關鍵字在最後)
    "TSError: ⨯ Unable to compile TypeScript:\nsrc/main.ts(12,5): error TS2307: Cannot find module './App' or its corresponding type declarations."
];

ambiguousLogs.forEach((log, idx) => {
    const preview = log.length > 100 ? log.substring(0, 50) + `... (${log.length} chars)` : log;
    console.log(`\nLog #${idx + 1}: ${preview}`);

    const start = process.hrtime();
    const result = classifyError(log);
    const end = process.hrtime(start);
    const timeMs = (end[0] * 1000 + end[1] / 1e6).toFixed(3);

    console.log(`  -> Type: ${result.type}`);
    console.log(`  -> Recoverable: ${result.recoverable}`);
    console.log(`  -> Suggestion: ${result.suggestion}`);
    console.log(`  -> Time: ${timeMs}ms`);
});

console.log('\nDone.');
