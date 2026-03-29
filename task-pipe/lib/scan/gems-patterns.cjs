/**
 * GEMS Patterns - 統一的 GEMS 標籤正則定義
 * 用於 Scanner (BUILD Phase 4) 與 Validator (Integration Check)
 */

// 基礎 GEMS 標籤：支援單行與多行註解
// v5.0 格式（無狀態欄）：GEMS: funcName | P0 | (args)→Return | Story-ID | 描述
// v4.x 格式（有狀態欄）：GEMS: funcName | P0 | ✓✓ | (args)→Return | Story-ID | 描述
// 統一 pattern：只抓 name 和 priority，其餘欄位用 split 解析
const GEMS_BASIC_PATTERN = /GEMS:\s*(\w+)\s*\|\s*(P[0-3])\s*\|(.*)/;

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
            // 解析剩餘欄位（pipe 分隔），跳過 v4.x 的狀態欄（✓✓ / ○○ 等）
            const rawFields = basicMatch[3].split('|').map(f => f.trim()).filter(Boolean);
            const fields = rawFields.filter(f => !/^[✓○✗-]+$/.test(f)); // 跳過純狀態符號欄
            // 用 Story- 前綴識別 storyId，其餘依序為 signature, description
            const storyField = fields.find(f => /^Story-[\d.]+$/.test(f));
            const nonStoryFields = fields.filter(f => !/^Story-[\d.]+$/.test(f));
            result.basic = {
                functionName: basicMatch[1].trim(),
                priority: basicMatch[2].trim(),
                status: '✓✓',
                signature: nonStoryFields[0] || '',
                storyId: storyField || '',
                description: nonStoryFields[1] || ''
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
