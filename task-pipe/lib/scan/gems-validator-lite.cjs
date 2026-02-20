#!/usr/bin/env node
/**
 * GEMS Validator Lite v1.0
 * 寬鬆版標籤驗證器 - 格式不限，內容必須
 * 
 * 核心理念:
 * - 標籤注入方式可能不同 (腳本、手寫、AI)
 * - 格式 (星號、縮進) 會變異
 * - 但內容物 (FLOW, DEPS) 通常穩定
 * 
 * Mock 黃金法則:
 * - P0: 嚴格禁止 Mock (僅未實作/擴充允許)
 * - P1: 真實優先 (有實作必用真)
 * - P2: 允許 Mock
 */

const fs = require('fs');
const path = require('path');

// ==============================================
// 關鍵字庫 (支援多種格式)
// ==============================================

const KEYWORDS = {
    // Priority 識別
    priority: [
        /\|\s*(P[0-3])\s*\|/i,
        /\b(P[0-3])\b/i
    ],

    // 函式名稱 (GEMS: 後面第一個詞)
    functionName: [
        /GEMS[:\s]+(\w+)/i,
        /Function[:\s]+(\w+)/i,
        /^(\w+)\s*\|/m
    ],

    // Flow 流程
    flow: [
        /(?:GEMS-FLOW|FLOW|流程|步驟)[:\s：]+(.+)/im,
        /(\w+)\s*(?:→|->|=>)\s*(\w+)/g,
        /(?:Step|步驟)\s*\d+[:\s：]*(.+)/gim
    ],

    // Dependencies 依賴
    deps: [
        /(?:GEMS-DEPS|DEPS|依賴|DEPENDENCIES)[:\s：]+(.+)/im,
        /\[([^\]]+)\]/,  // [xxx, yyy] 格式
        /(?:uses?|calls?|imports?|需要|調用|依賴)\s+(\w+)/gim
    ],

    // Risk Level 風險等級
    depsRisk: [
        /(?:GEMS-DEPS-RISK|DEPS-RISK|風險等級|RISK)[:\s：]*(LOW|MEDIUM|HIGH|低|中|高)/im
    ],

    // Test Coverage 測試
    test: [
        /(?:GEMS-TEST|TEST|測試)[:\s：]*(.+)/im,
        /(✓|Unit|Integration|E2E)/g
    ],

    // Test File 測試檔案
    testFile: [
        /(?:GEMS-TEST-FILE|TEST-FILE|測試檔案)[:\s：]*(.+)/im,
        /(\w+\.test\.(ts|tsx|js|jsx))/i
    ],

    // Description 描述 (抓最後一個 | 之後的文字)
    description: [
        /\|\s*([^|｜\n]{5,})$/m,
        /(?:描述|說明|描述|desc)[:\s：]*(.+)/im,
        /Description[:\s：]*(.+)/im
    ],

    // Story ID
    storyId: [
        /(Story-\d+\.\d+)/i,
        /(iter-\d+)/i
    ]
};

// 風險對照表 (中英文)
const RISK_NORMALIZE = {
    'low': 'LOW',
    '低': 'LOW',
    'medium': 'MEDIUM',
    '中': 'MEDIUM',
    'high': 'HIGH',
    '高': 'HIGH'
};

// ==============================================
// 智能提取函式
// ==============================================

/**
 * 智能提取標籤內容 (嘗試多種格式)
 * @param {string} comment - 註解區塊
 * @returns {Object} 提取結果
 */
function extractSmartTags(comment) {
    const result = {
        functionName: null,
        priority: null,
        description: null,
        flow: null,
        deps: null,
        depsRisk: null,
        test: null,
        testFile: null,
        storyId: null,
        _raw: comment  // 保留原始內容供 debug
    };

    if (!comment || typeof comment !== 'string') {
        return result;
    }

    // 逐一嘗試提取各欄位
    for (const [field, patterns] of Object.entries(KEYWORDS)) {
        for (const pattern of patterns) {
            const match = comment.match(pattern);
            if (match) {
                let value = match[1] || match[0];

                // 特殊處理: 風險等級正規化
                if (field === 'depsRisk' && value) {
                    value = RISK_NORMALIZE[value.toLowerCase()] || value.toUpperCase();
                }

                // 特殊處理: Priority 正規化
                if (field === 'priority' && value) {
                    value = value.toUpperCase();
                }

                result[field] = value.trim();
                break;  // 找到就跳下一個欄位
            }
        }
    }

    // 補充: 如果沒抓到描述，嘗試從整段註解找
    if (!result.description) {
        const lines = comment.split('\n');
        for (const line of lines) {
            const cleaned = line.replace(/^[\s/*#]+/, '').trim();
            // 排除關鍵字開頭的行
            if (cleaned.length > 10 && !cleaned.match(/^(GEMS|FLOW|DEPS|TEST|P[0-3]|Story|Function|Step)/i)) {
                result.description = cleaned;
                break;
            }
        }
    }

    return result;
}

/**
 * 驗證規格落實 (基於 Priority 決定必要欄位)
 * @param {Object} tags - extractSmartTags 的結果
 * @returns {Object[]} 問題清單
 */
function validateSpecCompliance(tags) {
    const issues = [];
    const priority = tags.priority;

    // 共通: 必須有 Priority + Description
    if (!priority) {
        issues.push({ field: 'priority', severity: 'ERROR', msg: '缺少 Priority (P0/P1/P2)' });
    }
    if (!tags.description) {
        issues.push({ field: 'description', severity: 'WARNING', msg: '建議有描述文字' });
    }

    // P0 規則 (端到端協議)
    if (priority === 'P0') {
        if (!tags.flow) {
            issues.push({ field: 'flow', severity: 'ERROR', msg: 'P0 必須有 Flow (流程說明)' });
        }
        if (!tags.depsRisk) {
            issues.push({ field: 'depsRisk', severity: 'ERROR', msg: 'P0 必須有 Deps-Risk (風險等級)' });
        }
        // P0 + LOW Risk 警告
        if (tags.depsRisk === 'LOW') {
            issues.push({
                field: 'depsRisk',
                severity: 'INFO',
                msg: 'P0 標記為 LOW Risk，請確認風險評估是否正確 (P0 通常為 HIGH/MEDIUM)'
            });
        }
    }

    // P1 規則 (整合依賴)
    if (priority === 'P1') {
        if (!tags.flow) {
            issues.push({ field: 'flow', severity: 'ERROR', msg: 'P1 必須有 Flow' });
        }
        if (!tags.deps) {
            issues.push({ field: 'deps', severity: 'ERROR', msg: 'P1 必須有 Deps (標記依賴項目)' });
        }
    }

    // P2 規則 (獨立功能)
    if (priority === 'P2') {
        if (!tags.flow) {
            issues.push({ field: 'flow', severity: 'INFO', msg: 'P2 建議有 Flow (規格書用)' });
        }
    }

    return issues;
}

/**
 * 計算驗證分數 (0-100)
 * @param {Object[]} issues - validateSpecCompliance 的結果
 * @returns {number}
 */
function calculateComplianceScore(issues) {
    const errorCount = issues.filter(i => i.severity === 'ERROR').length;
    const warningCount = issues.filter(i => i.severity === 'WARNING').length;

    // 每個 ERROR 扣 20 分，WARNING 扣 5 分
    const score = 100 - (errorCount * 20) - (warningCount * 5);
    return Math.max(0, Math.min(100, score));
}

/**
 * 判斷是否通過驗證
 * @param {Object[]} issues - validateSpecCompliance 的結果
 * @returns {boolean}
 */
function isCompliant(issues) {
    return issues.filter(i => i.severity === 'ERROR').length === 0;
}

// ==============================================
// 檔案掃描
// ==============================================

/**
 * 掃描源碼目錄，提取所有 GEMS 標籤 (寬鬆版)
 * @param {string} srcDir - 源碼目錄
 * @returns {Object} { functions: [], stats: {} }
 */
function scanGemsTagsLite(srcDir) {
    const result = {
        functions: [],
        stats: { total: 0, tagged: 0, p0: 0, p1: 0, p2: 0, p3: 0, compliant: 0, issues: 0 }
    };

    const files = findSourceFiles(srcDir);

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const relativePath = path.relative(process.cwd(), file);
        const lines = content.split('\n');

        // 找函式與類別 (簡化版 regex)
        // v1.1: 新增 class 偵測 — class 也可以有 GEMS 標籤（如 MemoryStore）
        // v1.2: 新增 interface 偵測 — interface 也可以有 GEMS 標籤（如 StorageAdapter）
        // v1.3: 新增 enum 偵測 — enum 也可以有 GEMS 標籤（如 UserRole）
        // v1.4: 新增 type alias 偵測 — type Foo = ... 也可以有 GEMS 標籤
        const funcPattern = /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(|(?:export\s+)?(?:abstract\s+)?class\s+(\w+)|(?:export\s+)?interface\s+(\w+)|(?:export\s+)?enum\s+(\w+)|(?:export\s+)?type\s+(\w+)\s*=/g;
        let match;

        while ((match = funcPattern.exec(content)) !== null) {
            const funcName = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
            result.stats.total++;

            // 計算函式所在行號
            const funcLineNum = content.substring(0, match.index).split('\n').length;

            // 找函式前的註解區塊 (擴大搜索範圍)
            const beforeFunc = content.substring(Math.max(0, match.index - 3000), match.index);

            // v1.6: 改用寬鬆策略 — 找 beforeFunc 中最後一個包含 GEMS 關鍵字的 /** ... */ 區塊
            // 舊邏輯要求 /** */ 緊接在函式前，但 import/const 語句會阻斷匹配
            let comment = '';

            // 策略 1: 找緊接在函式前的 /** */ (原始邏輯，仍優先)
            let commentMatch = beforeFunc.match(/\/\*\*([^*]|\*(?!\/))*\*\/(?:\s*(?:\/\/[^\n]*\n?))*\s*$/);
            if (commentMatch) {
                comment = commentMatch[0];
            }

            // 策略 2: 如果策略 1 沒找到，找 beforeFunc 中最後一個含 GEMS 的 /** */ 區塊
            // 這處理 GEMS 標籤在檔案頂部、中間隔著 import/const 的情況
            if (!comment) {
                const allBlocks = [...beforeFunc.matchAll(/\/\*\*[\s\S]*?\*\//g)];
                for (let bi = allBlocks.length - 1; bi >= 0; bi--) {
                    if (/GEMS/i.test(allBlocks[bi][0])) {
                        // 找到了，把它和後面的 // 單行註解一起抓
                        const blockEnd = allBlocks[bi].index + allBlocks[bi][0].length;
                        const afterBlock = beforeFunc.substring(blockEnd);
                        // 收集 /** */ 後面的 // [STEP] 等單行註解
                        const trailingComments = [];
                        for (const line of afterBlock.split('\n')) {
                            const trimmed = line.trim();
                            if (trimmed.startsWith('//')) {
                                trailingComments.push(trimmed);
                            } else if (trimmed === '') {
                                continue;
                            } else {
                                break;  // 遇到 import/const 等就停
                            }
                        }
                        comment = allBlocks[bi][0] + (trailingComments.length > 0 ? '\n' + trailingComments.join('\n') : '');
                        break;
                    }
                }
            }

            // 策略 3: 連續單行註解 (往上掃描，跳過 import/const/type 等語句)
            if (!comment) {
                const singleLineComments = [];
                for (let i = funcLineNum - 2; i >= Math.max(0, funcLineNum - 30); i--) {
                    const line = lines[i]?.trim() || '';
                    if (line.startsWith('//')) {
                        singleLineComments.unshift(line);
                    } else if (line === '') {
                        continue;  // 允許空行
                    } else if (/^(?:import\s|export\s(?:type\s)?{|const\s|let\s|var\s|type\s)/.test(line)) {
                        continue;  // v1.6: 跳過 import/const/let/var/type 語句，繼續往上找
                    } else {
                        break;  // 遇到其他非註解行，停止
                    }
                }
                if (singleLineComments.length > 0) {
                    comment = singleLineComments.join('\n');
                }
            }

            if (comment) {
                const tags = extractSmartTags(comment);

                // 只要有 Priority 就算有標籤
                if (tags.priority) {
                    // v1.5: 如果 GEMS 標籤有明確的 functionName，且與程式碼宣告名不同，
                    // 優先使用 GEMS 標籤的名稱（模組級標籤，如 CoreTypes 覆蓋整個檔案）
                    const reportName = tags.functionName || funcName;

                    // 避免同一個 GEMS 標籤被重複計算（檔案級標籤只算一次）
                    const alreadyReported = tags.functionName &&
                        result.functions.some(f => f.name === tags.functionName && f.file === relativePath);

                    if (alreadyReported) {
                        // 跳過：這個 GEMS 標籤已經被前一個宣告報告過了
                        continue;
                    }

                    result.stats.tagged++;
                    const priority = tags.priority.toLowerCase();
                    if (result.stats[priority] !== undefined) {
                        result.stats[priority]++;
                    }

                    // 驗證合規性
                    const issues = validateSpecCompliance(tags);
                    const compliant = isCompliant(issues);

                    if (compliant) {
                        result.stats.compliant++;
                    } else {
                        result.stats.issues++;
                    }

                    result.functions.push({
                        name: reportName,
                        file: relativePath,
                        line: funcLineNum,
                        priority: tags.priority,
                        description: tags.description,
                        flow: tags.flow,
                        deps: tags.deps,
                        depsRisk: tags.depsRisk,
                        test: tags.test,
                        testFile: tags.testFile,
                        storyId: tags.storyId,
                        issues,
                        compliant
                    });
                }
            }
        }
    }

    return result;
}

/**
 * 找源碼檔案
 */
function findSourceFiles(dir, files = []) {
    if (!fs.existsSync(dir)) return files;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.includes('__tests__') && entry.name !== 'node_modules' && entry.name !== 'dist') {
            findSourceFiles(fullPath, files);
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
            files.push(fullPath);
        }
    }
    return files;
}

// ==============================================
// CLI 測試模式
// ==============================================

if (require.main === module) {
    const testComments = [
        // 範例 1: 標準格式
        `/**
     * GEMS: BottomNav | P0 | ✓✓ | (props)→Element | Story-1.2 | 底部導覽列
     * GEMS-FLOW: GetModules→RenderTabs→BindEvents
     * GEMS-DEPS: [UserConfig, ModuleRegistry]
     * GEMS-DEPS-RISK: LOW
     */`,

        // 範例 2: 手寫簡化
        `// GEMS: LoginUser P0 使用者登入驗證
     // FLOW: ValidateInput -> CheckCredentials -> CreateSession
     // DEPS-RISK: HIGH`,

        // 範例 3: 自然語言
        `/**
     * Function: SaveData (P1)
     * Description: 儲存資料到資料庫
     * 
     * Flow:
     * 1. ValidateData
     * 2. SerializeData
     * 3. WriteToDatabase
     * 
     * Dependencies: Database, Logger (Risk: Medium)
     */`,

        // 範例 4: 最簡化
        `// P2 helper function for formatting`
    ];

    console.log('=== GEMS Validator Lite Test ===\n');

    for (let i = 0; i < testComments.length; i++) {
        console.log(`--- Test Case ${i + 1} ---`);
        const tags = extractSmartTags(testComments[i]);
        const issues = validateSpecCompliance(tags);
        const score = calculateComplianceScore(issues);

        console.log(`Priority: ${tags.priority || '(none)'}`);
        console.log(`Flow: ${tags.flow || '(none)'}`);
        console.log(`Deps: ${tags.deps || '(none)'}`);
        console.log(`Deps-Risk: ${tags.depsRisk || '(none)'}`);
        console.log(`Description: ${tags.description || '(none)'}`);
        console.log(`Score: ${score}/100`);
        console.log(`Issues: ${issues.length > 0 ? issues.map(i => `${i.severity}: ${i.msg}`).join(', ') : '(none)'}`);
        console.log(`Compliant: ${isCompliant(issues) ? '✓' : '✗'}\n`);
    }
}

module.exports = {
    extractSmartTags,
    validateSpecCompliance,
    calculateComplianceScore,
    isCompliant,
    scanGemsTagsLite,
    findSourceFiles,
    KEYWORDS
};
