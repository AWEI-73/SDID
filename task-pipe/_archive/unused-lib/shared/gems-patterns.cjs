#!/usr/bin/env node
/**
 * GEMS Patterns v1.0 - 統一的 GEMS 標籤解析模組
 * 
 * 設計原則：
 * - 寬鬆格式：接受多種註解格式 (JSDoc, 單行, 無星號等)
 * - 嚴格內容：必要欄位不可缺少
 * - 統一邏輯：Scanner 和 Validator 使用相同的解析邏輯
 * 
 * 支援的 GEMS 格式：
 * 1. JSDoc: * GEMS: name | P0 | ✓✓ | sig | Story-X.X | desc
 * 2. 單行: // GEMS: name | P0 | ✓✓ | sig | Story-X.X | desc
 * 3. 無前綴: GEMS: name | P0 | ✓✓ | sig | Story-X.X | desc
 */

/**
 * 寬鬆版 GEMS 標籤正則表達式
 * 
 * 格式解析：
 * - (?:\*|\/\/)?  → 可選的 JSDoc 星號或單行註解符號
 * - \s*GEMS:\s*   → "GEMS:" 關鍵字 (周圍可有空格)
 * - (\S+)         → [1] 函式名稱 (必填)
 * - \s*\|\s*      → pipe 分隔符 (周圍可有空格)
 * - (P[0-3])      → [2] 優先級 P0-P3 (必填)
 * - ([✓○⚠]+)      → [3] 狀態符號 (必填)
 * - (.+?)         → [4] 簽名 (非貪婪，必填)
 * - (Story-[\d.]+) → [5] Story ID (必填)
 * - (.+)          → [6] 描述 (必填)
 */
const GEMS_BASIC_PATTERN = /(?:\*|\/\/|#)?\s*GEMS:\s*(\S+)\s*\|\s*(P[0-3])\s*\|\s*([✓○⚠]+)\s*\|\s*(.+?)\s*\|\s*(Story-[\d.]+)\s*\|\s*(.+)/;

/**
 * 寬鬆版擴展標籤正則表達式
 * 支援 JSDoc (* GEMS-XXX:) 和單行 (// GEMS-XXX:) 格式
 */
const GEMS_EXTENDED_PATTERNS = {
    // GEMS-FLOW: Step1→Step2→Step3
    flow: /(?:\*|\/\/|#)?\s*GEMS-FLOW:\s*(.+)/,

    // GEMS-DEPS: [Type.Name (說明)]
    deps: /(?:\*|\/\/|#)?\s*GEMS-DEPS:\s*(.+)/,

    // GEMS-DEPS-RISK: LOW|MEDIUM|HIGH|CRITICAL
    depsRisk: /(?:\*|\/\/|#)?\s*GEMS-DEPS-RISK:\s*(LOW|MEDIUM|HIGH|CRITICAL|low|medium|high|critical)/i,

    // GEMS-TEST: ✓ Unit | - Integration | - E2E
    test: /(?:\*|\/\/|#)?\s*GEMS-TEST:\s*(.+)/,

    // GEMS-TEST-FILE: filename.test.ts
    testFile: /(?:\*|\/\/|#)?\s*GEMS-TEST-FILE:\s*(.+)/,

    // GEMS-ALGO: (v2.1 已廢棄，但仍支援解析)
    algo: /(?:\*|\/\/|#)?\s*GEMS-ALGO:\s*(.+)/,

    // GEMS-UI: ComponentName
    ui: /(?:\*|\/\/|#)?\s*GEMS-UI:\s*(.+)/
};

/**
 * POC 檔案級標籤 (寬鬆版)
 */
const POC_PATTERNS = {
    story: /@?GEMS-STORY:\s*([^\n]+)/i,
    desc: /@?GEMS-DESC:\s*([^\n]+)/i,
    author: /@?GEMS-AUTHOR:\s*([^\n]+)/i,
    contract: /@?GEMS-CONTRACT:\s*(\w+)/gi,
    mock: /@?GEMS-MOCK:\s*([^\n]+)/i
};

/**
 * 清理字串：移除控制字元、統一箭頭符號
 * @param {string} str - 原始字串
 * @returns {string} 清理後的字串
 */
function cleanString(str) {
    if (!str) return null;

    let cleaned = str;

    // 統一箭頭符號（全形→半形）
    cleaned = cleaned.replace(/→/g, '->');

    // 移除控制字元 (保留換行和 tab)
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

    return cleaned.trim();
}

/**
 * 從註解區塊提取 GEMS 標籤
 * 使用寬鬆格式解析，嚴格內容驗證
 * 
 * @param {string} comment - 註解區塊
 * @returns {object} 解析結果 { basic, flow, deps, depsRisk, test, testFile, algo, ui, parseErrors }
 */
function extractGEMSTags(comment) {
    const result = {
        basic: null,
        flow: null,
        deps: null,
        depsRisk: null,
        test: null,
        testFile: null,
        algo: null,
        ui: null,
        parseErrors: []  // 記錄解析錯誤（格式問題但非完全失敗）
    };

    if (!comment) return result;

    const lines = comment.split('\n');

    for (const line of lines) {
        // === 基本標籤 ===
        const basicMatch = line.match(GEMS_BASIC_PATTERN);
        if (basicMatch) {
            // 驗證必要欄位都存在
            const [, functionName, priority, status, signature, storyId, description] = basicMatch;

            if (!functionName || !priority || !status || !signature || !storyId || !description) {
                result.parseErrors.push(`GEMS 基本標籤缺少必要欄位: ${line.trim()}`);
            } else {
                result.basic = {
                    functionName: cleanString(functionName),
                    riskLevel: priority,      // 為了相容性，保留 riskLevel
                    priority: priority,       // 同時提供 priority
                    status: cleanString(status),
                    signature: cleanString(signature),
                    storyId: cleanString(storyId),
                    description: cleanString(description)
                };
            }
            continue;
        }

        // === 擴展標籤 ===
        const flowMatch = line.match(GEMS_EXTENDED_PATTERNS.flow);
        if (flowMatch && !result.flow) {
            result.flow = cleanString(flowMatch[1]);
            continue;
        }

        const depsMatch = line.match(GEMS_EXTENDED_PATTERNS.deps);
        if (depsMatch && !result.deps) {
            result.deps = cleanString(depsMatch[1]);
            continue;
        }

        const depsRiskMatch = line.match(GEMS_EXTENDED_PATTERNS.depsRisk);
        if (depsRiskMatch && !result.depsRisk) {
            result.depsRisk = cleanString(depsRiskMatch[1]).toUpperCase();
            continue;
        }

        const testMatch = line.match(GEMS_EXTENDED_PATTERNS.test);
        if (testMatch && !result.test) {
            result.test = cleanString(testMatch[1]);
            continue;
        }

        const testFileMatch = line.match(GEMS_EXTENDED_PATTERNS.testFile);
        if (testFileMatch && !result.testFile) {
            result.testFile = cleanString(testFileMatch[1]);
            continue;
        }

        const algoMatch = line.match(GEMS_EXTENDED_PATTERNS.algo);
        if (algoMatch && !result.algo) {
            result.algo = cleanString(algoMatch[1]);
            continue;
        }

        const uiMatch = line.match(GEMS_EXTENDED_PATTERNS.ui);
        if (uiMatch && !result.ui) {
            result.ui = cleanString(uiMatch[1]);
            continue;
        }
    }

    return result;
}

/**
 * 從檔案內容提取 POC 檔案級標籤
 * 
 * @param {string} content - 檔案內容
 * @returns {object} { story, desc, author, contracts, mock }
 */
function extractPOCTags(content) {
    const result = {
        story: null,
        desc: null,
        author: null,
        contracts: [],
        mock: null
    };

    if (!content) return result;

    const storyMatch = content.match(POC_PATTERNS.story);
    if (storyMatch) result.story = cleanString(storyMatch[1]);

    const descMatch = content.match(POC_PATTERNS.desc);
    if (descMatch) result.desc = cleanString(descMatch[1]);

    const authorMatch = content.match(POC_PATTERNS.author);
    if (authorMatch) result.author = cleanString(authorMatch[1]);

    const mockMatch = content.match(POC_PATTERNS.mock);
    if (mockMatch) result.mock = cleanString(mockMatch[1]);

    // 提取所有 CONTRACT
    POC_PATTERNS.contract.lastIndex = 0;
    let contractMatch;
    while ((contractMatch = POC_PATTERNS.contract.exec(content)) !== null) {
        result.contracts.push(contractMatch[1]);
    }

    return result;
}

/**
 * 驗證 GEMS 標籤是否完整（針對不同優先級）
 * 
 * @param {object} tags - extractGEMSTags 的輸出
 * @param {string} functionName - 函式名稱（用於錯誤訊息）
 * @returns {object} { isValid, issues }
 */
function validateTagCompleteness(tags, functionName = 'unknown') {
    const issues = [];

    // 如果沒有 basic 標籤，直接返回
    if (!tags.basic) {
        return { isValid: false, issues: [{ level: 'error', message: 'Missing GEMS basic tag' }] };
    }

    const { priority } = tags.basic;

    // P0: 最嚴格，必須有 FLOW, DEPS, DEPS-RISK, TEST, TEST-FILE
    if (priority === 'P0') {
        if (!tags.flow) issues.push({ level: 'error', fn: functionName, priority, issue: '缺少 GEMS-FLOW' });
        if (!tags.deps) issues.push({ level: 'warning', fn: functionName, priority, issue: '缺少 GEMS-DEPS' });
        if (!tags.depsRisk) issues.push({ level: 'error', fn: functionName, priority, issue: '缺少 GEMS-DEPS-RISK' });
        if (!tags.test) issues.push({ level: 'error', fn: functionName, priority, issue: '缺少 GEMS-TEST' });
        if (!tags.testFile) issues.push({ level: 'error', fn: functionName, priority, issue: '缺少 GEMS-TEST-FILE' });
    }

    // P1: 必須有 FLOW, TEST, TEST-FILE
    if (priority === 'P1') {
        if (!tags.flow) issues.push({ level: 'error', fn: functionName, priority, issue: '缺少 GEMS-FLOW' });
        if (!tags.test) issues.push({ level: 'error', fn: functionName, priority, issue: '缺少 GEMS-TEST' });
        if (!tags.testFile) issues.push({ level: 'error', fn: functionName, priority, issue: '缺少 GEMS-TEST-FILE' });
    }

    // P2/P3: 只需 basic 標籤（已在 extractGEMSTags 中驗證）

    return {
        isValid: issues.filter(i => i.level === 'error').length === 0,
        issues
    };
}

/**
 * 快速檢查註解是否包含 GEMS 標籤（不完整解析）
 * 
 * @param {string} comment - 註解內容
 * @returns {boolean} 是否包含 GEMS 標籤
 */
function hasGEMSTag(comment) {
    if (!comment) return false;
    // 寬鬆匹配：只要包含 GEMS: 就算
    return /GEMS:\s*\S+/.test(comment);
}

module.exports = {
    // 核心正則
    GEMS_BASIC_PATTERN,
    GEMS_EXTENDED_PATTERNS,
    POC_PATTERNS,

    // 工具函式
    cleanString,
    extractGEMSTags,
    extractPOCTags,
    validateTagCompleteness,
    hasGEMSTag
};
