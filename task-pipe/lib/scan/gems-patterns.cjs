/**
 * GEMS Patterns - 統一的 GEMS 標籤正則定義
 * 用於 Scanner (BUILD Phase 4) 與 Validator (Integration Check)
 */

// 基礎 GEMS 標籤：支援單行與多行註解
// 格式：GEMS: funcName | P0 | ✓✓ | (args)→Return | Story-ID | 描述
const GEMS_BASIC_PATTERN = /GEMS:\s*(\w+)\s*\|\s*(P[0-3])\s*\|\s*([✓○-]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)(?:\s*\|\s*(.*))?/;

// 擴展標籤模式 (支援 /** */ 和 // 格式)
const GEMS_EXTENDED_PATTERNS = {
    // GEMS-FLOW: Step1→Step2
    flow: /GEMS-FLOW:\s*(.+)/,
    // GEMS-DEPS: [Type.Function], [Type.Function (Desc)]
    deps: /GEMS-DEPS:\s*(.+)/,
    // GEMS-DEPS-RISK: LOW | MEDIUM | HIGH
    depsRisk: /GEMS-DEPS-RISK:\s*(LOW|MEDIUM|HIGH)/i,
    // GEMS-TEST: ✓ Unit | - Integration | - E2E
    test: /GEMS-TEST:\s*(.+)/,
    // GEMS-TEST-FILE: xxx.test.ts
    testFile: /GEMS-TEST-FILE:\s*(.+)/
};

/**
 * 提取註解區塊中的 GEMS 標籤
 * @param {string} comment - 註解字串
 * @returns {object} 解析結果
 */
function extractGEMSTags(comment) {
    const result = {};
    const lines = comment.split('\n');

    for (const line of lines) {
        const cleanLine = cleanString(line);

        // 1. Basic GEMS
        const basicMatch = cleanLine.match(GEMS_BASIC_PATTERN);
        if (basicMatch) {
            result.basic = {
                functionName: basicMatch[1].trim(),
                priority: basicMatch[2].trim(),
                status: basicMatch[3].trim(),
                signature: basicMatch[4].trim(),
                storyId: basicMatch[5].trim(),
                description: basicMatch[6] ? basicMatch[6].trim() : ''
            };
            continue;
        }

        // 2. Extended GEMS
        for (const [key, pattern] of Object.entries(GEMS_EXTENDED_PATTERNS)) {
            const match = cleanLine.match(pattern);
            if (match) {
                result[key] = match[1].trim();
            }
        }
    }

    return result;
}

/**
 * 清理註解符號 (*, //)
 */
function cleanString(str) {
    return str.replace(/^[\s*/]+|[\s*/]+$/g, '').trim();
}

module.exports = {
    GEMS_BASIC_PATTERN,
    GEMS_EXTENDED_PATTERNS,
    extractGEMSTags,
    cleanString
};
