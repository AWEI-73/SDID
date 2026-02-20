#!/usr/bin/env node
/**
 * GEMS Scanner for Google Apps Script (.gs files) v2.0
 * 
 * 由於 .gs 文件本質上是 JavaScript，我們使用正則表達式來解析 GEMS 標籤
 * 這是一個輕量級的掃描器，專門用於 GAS 專案
 * 
 * v2.0 變更：
 * - 使用 gems-patterns.cjs 共用模組
 * - 支援 JSDoc 和單行註解格式
 */

const fs = require('fs');
const path = require('path');

// 載入共用模組
let gemsPatterns;
try {
    gemsPatterns = require('./gems-patterns.cjs');
} catch (e) {
    // 如果找不到，使用內建的正則
    gemsPatterns = null;
}

// 使用共用正則或 fallback
const GEMS_BASIC_PATTERN = gemsPatterns
    ? gemsPatterns.GEMS_BASIC_PATTERN
    : /(?:\*|\/\/|#)?\s*GEMS:\s*(\S+)\s*\|\s*(P[0-3])\s*\|\s*([✓○⚠]+)\s*\|\s*(.+?)\s*\|\s*(Story-[\d.]+)\s*\|\s*(.+)/;

/**
 * 掃描單個 .gs 文件
 * @param {string} filePath - 文件路徑
 * @returns {object} 掃描結果
 */
function parseGasFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const functions = [];

    // 匹配 GEMS 標籤註解塊 (支援 JSDoc 和連續單行註解)
    // 格式 1: /** ... GEMS: FunctionName | P0 | ✓✓ | ... */ function xxx
    // 格式 2: // GEMS: FunctionName | P0 | ✓✓ | ... \n function xxx
    const gemsBlockRegex = /(?:\/\*\*\s*\n([\s\S]*?)\*\/|(?:\/\/[^\n]*\n)+)\s*(?:function\s+(\w+)|var\s+(\w+)\s*=\s*function|const\s+(\w+)\s*=)/g;

    let match;
    while ((match = gemsBlockRegex.exec(content)) !== null) {
        const commentBlock = match[0];
        const functionName = match[2] || match[3] || match[4];

        // 使用寬鬆正則解析 GEMS 基本標籤
        const gemsMatch = commentBlock.match(GEMS_BASIC_PATTERN);

        if (gemsMatch) {
            const [, name, priority, status, signature, storyId, description] = gemsMatch;

            const fnData = {
                name: functionName || name.trim(),
                file: path.relative(process.cwd(), filePath),
                lineNumber: getLineNumber(content, match.index),
                hasGEMSTag: true,
                gemsTags: {
                    basic: {
                        name: name.trim(),
                        riskLevel: priority.trim(),
                        status: status.trim(),
                        signature: signature.trim(),
                        storyId: storyId.trim(),
                        description: description.trim()
                    },
                    flow: extractTag(commentBlock, 'GEMS-FLOW'),
                    deps: extractTag(commentBlock, 'GEMS-DEPS'),
                    depsRisk: extractTag(commentBlock, 'GEMS-DEPS-RISK'),
                    test: extractTag(commentBlock, 'GEMS-TEST'),
                    testFile: extractTag(commentBlock, 'GEMS-TEST-FILE'),
                    algo: extractTag(commentBlock, 'GEMS-ALGO')
                }
            };

            functions.push(fnData);
        }
    }

    return {
        file: filePath,
        functions
    };
}

/**
 * 提取特定 GEMS 標籤 (支援 JSDoc 和單行格式)
 * @param {string} commentBlock - 註解塊
 * @param {string} tagName - 標籤名稱
 * @returns {string|null}
 */
function extractTag(commentBlock, tagName) {
    // 處理 Windows 換行符 (CRLF) 和 Unix 換行符 (LF)
    const normalizedBlock = commentBlock.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // 寬鬆正則：支援 * GEMS-XXX: 和 // GEMS-XXX:
    const regex = new RegExp(`(?:\\*|\\/\\/)\\s*${tagName}:\\s*(.+?)(?=\\n|$)`, 'i');
    const match = normalizedBlock.match(regex);
    return match ? match[1].trim() : null;
}

/**
 * 獲取行號
 * @param {string} content - 文件內容
 * @param {number} index - 字符索引
 * @returns {number}
 */
function getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
}

/**
 * 掃描目錄中的所有 .gs 文件
 * @param {string} dir - 目錄路徑
 * @returns {array} 所有文件的掃描結果
 */
function scanDirectory(dir) {
    const results = [];

    function scanDir(currentDir) {
        if (!fs.existsSync(currentDir)) return;

        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);

            // 跳過特定目錄
            if (entry.isDirectory()) {
                if (!['node_modules', '.git', '.gems', 'yfinance_cache', 'legecy_v6'].includes(entry.name)) {
                    scanDir(fullPath);
                }
            } else if (entry.isFile() && entry.name.endsWith('.gs')) {
                // console.log(`Scanning file: ${fullPath}`); // Debug log
                results.push(fullPath);
            }
        }
    }

    scanDir(dir);
    console.log(`[GAS-SCAN] Found ${results.length} .gs files`);
    return results;
}

/**
 * 掃描並統計 GEMS 標籤
 * @param {string} srcDir - 源碼目錄
 * @returns {object} 掃描結果和統計
 */
function scanGemsTags(srcDir) {
    const files = scanDirectory(srcDir);
    const result = {
        functions: [],
        stats: { total: 0, tagged: 0, p0: 0, p1: 0, p2: 0, p3: 0 }
    };

    for (const file of files) {
        // console.log(`Parsing file: ${file}`); // Debug log
        try {
            const parsed = parseGasFile(file);

            for (const fn of parsed.functions) {
                result.stats.total++;

                if (fn.hasGEMSTag && fn.gemsTags.basic) {
                    result.stats.tagged++;
                    const priority = fn.gemsTags.basic.riskLevel?.toLowerCase() || 'p3';
                    result.stats[priority]++;

                    result.functions.push({
                        name: fn.name,
                        file: fn.file,
                        line: fn.lineNumber,
                        priority: fn.gemsTags.basic.riskLevel,
                        status: fn.gemsTags.basic.status,
                        signature: fn.gemsTags.basic.signature,
                        storyId: fn.gemsTags.basic.storyId,
                        description: fn.gemsTags.basic.description,
                        flow: fn.gemsTags.flow,
                        deps: fn.gemsTags.deps,
                        depsRisk: fn.gemsTags.depsRisk,
                        test: fn.gemsTags.test,
                        testFile: fn.gemsTags.testFile,
                        algo: fn.gemsTags.algo,
                        fraudIssues: []
                    });
                }
            }
        } catch (e) {
            console.error(`[GAS-SCAN] Error parsing file ${file}: ${e.message}`);
        }
    }

    return result;
}

/**
 * 驗證 P0/P1 合規性
 * @param {array} functions - 函數列表
 * @returns {array} 問題列表
 */
function validateP0P1Compliance(functions) {
    const issues = [];

    for (const fn of functions) {
        if (fn.priority === 'P0' || fn.priority === 'P1') {
            if (!fn.flow) {
                issues.push({ fn: fn.name, priority: fn.priority, issue: '缺少 GEMS-FLOW' });
            }
            if (!fn.deps) {
                issues.push({ fn: fn.name, priority: fn.priority, issue: '缺少 GEMS-DEPS' });
            }
            if (fn.priority === 'P0' && !fn.depsRisk) {
                issues.push({ fn: fn.name, priority: fn.priority, issue: '缺少 GEMS-DEPS-RISK' });
            }
        }
    }

    return issues;
}

module.exports = {
    parseGasFile,
    scanDirectory,
    scanGemsTags,
    validateP0P1Compliance
};

// 命令行測試
if (require.main === module) {
    const testDir = process.argv[2] || '.';
    console.log(`掃描目錄: ${testDir}\n`);

    const result = scanGemsTags(testDir);

    console.log('=== 掃描結果 ===');
    console.log(`總函數: ${result.stats.total}`);
    console.log(`已標籤: ${result.stats.tagged}`);
    console.log(`P0: ${result.stats.p0} | P1: ${result.stats.p1} | P2: ${result.stats.p2} | P3: ${result.stats.p3}`);
    console.log(`覆蓋率: ${result.stats.total > 0 ? Math.round((result.stats.tagged / result.stats.total) * 100) : 0}%\n`);

    console.log('=== 函數列表 ===');
    result.functions.forEach(fn => {
        console.log(`${fn.name} (${fn.priority}) - ${fn.file}:${fn.line}`);
        if (fn.flow) console.log(`  FLOW: ${fn.flow}`);
    });

    console.log('\n=== P0/P1 合規性檢查 ===');
    const issues = validateP0P1Compliance(result.functions);
    if (issues.length === 0) {
        console.log('✓ 全部合規');
    } else {
        issues.forEach(issue => {
            console.log(`⚠ ${issue.fn} (${issue.priority}): ${issue.issue}`);
        });
    }
}
