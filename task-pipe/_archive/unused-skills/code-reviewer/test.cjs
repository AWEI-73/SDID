#!/usr/bin/env node
/**
 * Code Reviewer Skill - 測試腳本
 * 快速驗證 Code Reviewer 功能
 */

const { SimpleCodeReviewer } = require('./index.cjs');
const { RetryTracker } = require('./retry-tracker.cjs');

console.log('🧪 Simple Code Reviewer - 測試\n');
console.log('='.repeat(60));

// 測試 1: BUILD Phase 4
console.log('\n📋 測試 1: BUILD Phase 4 - 標籤驗收\n');

const reviewer = new SimpleCodeReviewer('build', '4');

const mockErrors = [
    { message: '缺少 GEMS-DEPS 標籤', location: 'src/utils/storage.js:45', severity: 'high' },
    { message: 'P0 函式缺少 GEMS-FLOW', location: 'src/config.js:12', severity: 'high' },
    { message: '[STEP] 錨點數量不符', location: 'src/utils/storage.js:60', severity: 'medium' }
];

const report = reviewer.generateReport({
    errors: mockErrors,
    retryCount: 3,
    timestamp: new Date().toISOString()
});

console.log('✅ 結構化報告產生成功\n');
console.log('📊 報告摘要:');
console.log(`   - 階段: ${report.metadata.phase}`);
console.log(`   - 失敗次數: ${report.metadata.retryCount}`);
console.log(`   - 嚴重程度: ${report.ragData.severity}`);
console.log(`   - 錯誤類型: ${report.ragData.errorTypes.join(', ')}`);
console.log(`   - 關鍵字: ${report.ragData.keywords.slice(0, 5).join(', ')}`);

console.log('\n📝 Markdown 報告:\n');
console.log('─'.repeat(60));
const markdown = reviewer.formatMarkdown(report);
console.log(markdown);
console.log('─'.repeat(60));

// 測試 2: POC Step 1
console.log('\n📋 測試 2: POC Step 1 - 模糊消除\n');

const pocReviewer = new SimpleCodeReviewer('poc', '1');

const pocErrors = [
    { message: '需求描述不明確' },
    { message: '功能模組未勾選' },
    { message: '用詞過於模糊' }
];

const pocReport = pocReviewer.generateReport({
    errors: pocErrors,
    retryCount: 2
});

console.log('✅ POC 報告產生成功\n');
console.log('📊 常見錯誤模式:');
pocReport.analysis.commonPatterns.forEach(p => {
    console.log(`   - ${p.pattern} (${p.confidence})`);
});

console.log('\n💡 建議行動:');
pocReport.recommendations.preventive.forEach((action, idx) => {
    console.log(`   ${idx + 1}. ${action}`);
});

// 測試 3: Retry Tracker
console.log('\n📋 測試 3: Retry Tracker\n');

const tracker = new RetryTracker('.', 'iter-1', 'Story-1.0', 'phase-4');

console.log('第 1 次失敗:');
let result = tracker.increment([{ message: '錯誤 1' }]);
console.log(`   - 應該 Review: ${result.shouldReview}`);
console.log(`   - 失敗次數: ${result.context.retries}`);

console.log('\n第 2 次失敗:');
result = tracker.increment([{ message: '錯誤 2' }]);
console.log(`   - 應該 Review: ${result.shouldReview}`);
console.log(`   - 失敗次數: ${result.context.retries}`);

console.log('\n第 3 次失敗:');
result = tracker.increment([{ message: '錯誤 3' }]);
console.log(`   - 應該 Review: ${result.shouldReview} ✅`);
console.log(`   - 失敗次數: ${result.context.retries}`);

// 清理測試檔案
tracker.reset();

console.log('\n' + '='.repeat(60));
console.log('✅ 所有測試完成！\n');

// 輸出 JSON 範例
console.log('📦 JSON 報告範例（用於 RAG）:\n');
console.log(JSON.stringify(report, null, 2).substring(0, 500) + '...\n');
