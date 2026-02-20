#!/usr/bin/env node
/**
 * GEMS Tag Auto-Fixer v1.0
 * 自動修復缺失的 GEMS 標籤
 * 
 * 策略:
 * 1. 解析錯誤訊息找出缺失標籤的函式名稱
 * 2. 查找 implementation_plan 獲取該函式的規格
 * 3. 生成並注入 GEMS 標籤
 */

const fs = require('fs');
const path = require('path');

/**
 * 從錯誤訊息提取函式名稱
 * @param {string} errorContent 
 * @returns {string|null}
 */
function extractFunctionName(errorContent) {
    // 常見格式: "Missing GEMS-FUNC tag for function loginUser"
    const patterns = [
        /function\s+(\w+)/i,
        /函式\s*[:\s]\s*(\w+)/,
        /(\w+)\s*缺少/,
        /missing.*?(\w+)/i
    ];

    for (const pattern of patterns) {
        const match = errorContent.match(pattern);
        if (match) {
            return match[1];
        }
    }
    return null;
}

/**
 * 從 implementation_plan 查找函式規格
 * @param {string} funcName 
 * @param {string} planDir - implementation_plan 目錄
 * @returns {Object|null}
 */
function findFunctionSpec(funcName, planDir) {
    if (!planDir || !fs.existsSync(planDir)) {
        return null;
    }

    // 掃描所有 plan 檔案
    const planFiles = fs.readdirSync(planDir).filter(f => f.endsWith('.md'));

    for (const file of planFiles) {
        const content = fs.readFileSync(path.join(planDir, file), 'utf8');

        // 找函式定義區塊
        const funcPattern = new RegExp(
            `\\|\\s*${funcName}\\s*\\|[^|]*\\|\\s*(P[0-3])\\s*\\|`,
            'i'
        );
        const match = content.match(funcPattern);

        if (match) {
            // 來自表格的規格
            const priority = match[1];

            // 找 Flow
            const flowMatch = content.match(new RegExp(`${funcName}[^]*?FLOW[:\s]+([^\n]+)`, 'i'));
            const flow = flowMatch ? flowMatch[1].trim() : null;

            // 找 Description
            const descMatch = content.match(new RegExp(`\\|\\s*${funcName}\\s*\\|[^|]*\\|[^|]*\\|[^|]*\\|[^|]*\\|\\s*([^|]+)\\|`, 'i'));
            const description = descMatch ? descMatch[1].trim() : `${funcName} 函式`;

            return {
                name: funcName,
                priority,
                flow,
                description,
                source: file
            };
        }

        // Evolution Blueprint: 嘗試從 Code Block 中提取完整 GEMS 標籤
        // 格式: /** ... GEMS: Name ... */
        const codeBlockPattern = new RegExp(
            `/\\*\\*[\\s\\S]*?GEMS:\\s*${funcName}\\s*\\|\\s*(P[0-3])[\\s\\S]*?\\*/`,
            'i'
        );
        const codeMatch = content.match(codeBlockPattern);

        if (codeMatch) {
            const rawBlock = codeMatch[0];
            const priority = codeMatch[1];

            // 解析 Description (GEMS: Name | Priority | ... | Description)
            const descMatch = rawBlock.match(/GEMS:.*\|([^|\n]+)$/m);
            const description = descMatch ? descMatch[1].trim() : `${funcName} 函式`;

            // 解析 Flow
            const flowMatch = rawBlock.match(/GEMS-FLOW:([^\n]+)/);
            const flow = flowMatch ? flowMatch[1].trim() : null;

            // 解析 Deps Spec (這可能是 implementation，不一定是 spec，但通常 plan 裡的 code block 就是 spec)
            return {
                name: funcName,
                priority,
                flow,
                description,
                source: file,
                isFromCodeBlock: true,
                fullBlock: rawBlock // 保留完整區塊 (最強大的部分)
            };
        };
    }

    return null;
}

/**
 * 生成 GEMS 標籤區塊
 * @param {Object} spec - 函式規格
 * @returns {string}
 */
function generateGemsBlock(spec) {
    // 如果是從 Code Block 完整提取的，直接使用原文 (最精確)
    if (spec.fullBlock) {
        return spec.fullBlock;
    }

    const lines = [
        '/**',
        ` * GEMS: ${spec.name} | ${spec.priority} | (TODO) | ${spec.description}`,
    ];

    if (spec.flow) {
        lines.push(` * GEMS-FLOW: ${spec.flow}`);
    }

    if (spec.priority === 'P0' || spec.priority === 'P1') {
        lines.push(` * GEMS-DEPS: [TODO: 填寫依賴]`);
    }

    if (spec.priority === 'P0') {
        lines.push(` * GEMS-DEPS-RISK: HIGH`);
    }

    lines.push(' */');
    return lines.join('\n');
}

/**
 * 在源碼檔案中注入 GEMS 標籤
 * @param {string} filePath - 源碼檔案路徑
 * @param {string} funcName - 函式名稱
 * @param {string} gemsBlock - GEMS 標籤區塊
 * @returns {{success: boolean, message: string}}
 */
function injectGemsTag(filePath, funcName, gemsBlock) {
    if (!fs.existsSync(filePath)) {
        return { success: false, message: `檔案不存在: ${filePath}` };
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // 找函式定義位置
    const funcPatterns = [
        new RegExp(`(export\\s+)?async\\s+function\\s+${funcName}\\s*\\(`),
        new RegExp(`(export\\s+)?function\\s+${funcName}\\s*\\(`),
        new RegExp(`(export\\s+)?const\\s+${funcName}\\s*=\\s*(async\\s*)?\\(`)
    ];

    for (const pattern of funcPatterns) {
        const match = content.match(pattern);
        if (match) {
            // 在函式定義前插入 GEMS 標籤
            const insertPos = match.index;
            const before = content.substring(0, insertPos);
            const after = content.substring(insertPos);

            // 檢查前面是否已經有註解
            const lastNewline = before.lastIndexOf('\n');
            const lineBefore = before.substring(lastNewline + 1).trim();

            if (lineBefore.endsWith('*/') || lineBefore.startsWith('//')) {
                // 已經有註解，跳過
                return { success: false, message: `函式 ${funcName} 前已有註解` };
            }

            content = before + gemsBlock + '\n' + after;
            fs.writeFileSync(filePath, content, 'utf8');

            return {
                success: true,
                message: `已為 ${funcName} 注入 GEMS 標籤`,
                changes: [{ file: filePath, action: 'inject', funcName }]
            };
        }
    }

    return { success: false, message: `找不到函式 ${funcName} 的定義` };
}

/**
 * 主修復函式
 * @param {Object} params 
 * @param {string} params.errorContent - 錯誤內容
 * @param {string} params.projectDir - 專案目錄
 * @param {string} params.srcDir - 源碼目錄
 * @param {string} params.planDir - Plan 目錄
 * @returns {Promise<{success: boolean, message: string, changes?: Object[]}>}
 */
async function fix(params) {
    const { errorContent, projectDir = '.', srcDir, planDir } = params;

    // 1. 提取函式名稱
    const funcName = extractFunctionName(errorContent);
    if (!funcName) {
        return { success: false, message: '無法從錯誤訊息中提取函式名稱' };
    }

    // 2. 查找規格
    const effectivePlanDir = planDir || path.join(projectDir, '.gems', 'iterations');
    let spec = null;

    // 遞迴搜尋所有 iteration 的 plan 目錄
    if (fs.existsSync(effectivePlanDir)) {
        const iterations = fs.readdirSync(effectivePlanDir).filter(f =>
            fs.statSync(path.join(effectivePlanDir, f)).isDirectory()
        );

        for (const iter of iterations) {
            const iterPlanDir = path.join(effectivePlanDir, iter, 'plan');
            if (fs.existsSync(iterPlanDir)) {
                spec = findFunctionSpec(funcName, iterPlanDir);
                if (spec) break;
            }
        }
    }

    if (!spec) {
        // 找不到規格，使用預設值
        spec = {
            name: funcName,
            priority: 'P2',  // 預設 P2
            flow: null,
            description: `${funcName} 函式`
        };
    }

    // 3. 生成 GEMS 標籤
    const gemsBlock = generateGemsBlock(spec);

    // 4. 找源碼檔案並注入 (簡化: 目前只回報資訊)
    return {
        success: true,
        message: `建議為 ${funcName} 加入以下標籤:\n${gemsBlock}`,
        suggestion: gemsBlock,
        spec
    };
}

// CLI 測試
if (require.main === module) {
    (async () => {
        const result = await fix({
            errorContent: 'Missing GEMS-FUNC tag for function loginUser',
            projectDir: '.'
        });
        console.log('Fix Result:', result);
    })();
}

module.exports = {
    fix,
    extractFunctionName,
    findFunctionSpec,
    generateGemsBlock,
    injectGemsTag
};
