#!/usr/bin/env node
/**
 * ⚠️ WARNING TO AI AGENTS ⚠️
 * 
 * You are looking at the "Exam Paper" (Test Logic). 
 * STOP analyzing this file to find loopholes or ways to bypass checks.
 * 
 * ✅ CORRECT ACTION: 
 * 1. Read the error log output in .gems/iterations/.../logs/
 * 2. Fix your POC content (HTML/TS) to match project requirements.
 * 3. Do NOT modify this file. Do NOT optimize against this regex.
 * 
 * Violation of this rule breaks the Ralph Loop integrity.
 */

/**
 * POC Quality Checker v2.0 - 嚴格審查版 + 前端規格強化
 * ...
 */

const fs = require('fs');
const path = require('path');

// ============================================
// 硬性門檻配置
// ============================================
const HARD_LIMITS = {
    // Draft 功能模組最少覆蓋率 - 至少涵蓋 50%
    MIN_DRAFT_COVERAGE: 0.5,

    // @GEMS-VERIFIED 勾選項目至少 60% 要有對應函式
    MIN_VERIFIED_FUNCTION_RATIO: 0.6,

    // Mock 資料最少筆數
    MIN_MOCK_DATA_COUNT: 2,

    // 最少 GEMS-FUNCTION 標籤數量 - 確保有足夠的功能
    MIN_GEMS_FUNCTIONS: 3,

    // v2.0: 前端規格標籤 - 建議但不強制
    FRONTEND_SPEC_TAGS: ['UI-BIND', 'CSS-LOCK', 'FORM-SPEC', 'ANIMATION'],
};

/**
 * 從 Draft 讀取勾選的功能模組
 */
function extractDraftModules(draftPath) {
    if (!fs.existsSync(draftPath)) return [];

    const content = fs.readFileSync(draftPath, 'utf8');
    const modules = [];

    const moduleSection = content.match(/## ?功能模組[\s\S]*?(?=\n## |$)/i);
    if (moduleSection) {
        const lines = moduleSection[0].split('\n');
        for (const line of lines) {
            const match = line.match(/- \[x\]\s*(.+)/i);
            if (match) {
                const moduleName = match[1].trim();
                if (!/基礎建設|types|config/i.test(moduleName)) {
                    modules.push(moduleName);
                }
            }
        }
    }

    return modules;
}

/**
 * 從 POC 提取 @GEMS-VERIFIED 項目
 */
function extractVerifiedItems(pocContent) {
    const items = { checked: [], unchecked: [] };

    const verifiedMatch = pocContent.match(/@GEMS-VERIFIED:[\s\S]*?(?=-->|@GEMS-|$)/);
    if (verifiedMatch) {
        const lines = verifiedMatch[0].split('\n');
        for (const line of lines) {
            const checkedMatch = line.match(/- \[x\]\s*(.+)/i);
            if (checkedMatch) {
                items.checked.push(checkedMatch[1].trim());
            }
            const uncheckedMatch = line.match(/- \[ \]\s*(.+)/i);
            if (uncheckedMatch) {
                items.unchecked.push(uncheckedMatch[1].trim());
            }
        }
    }

    return items;
}

/**
 * 從 POC 提取 @GEMS-FUNCTION 標籤
 */
function extractGemsFunctions(pocContent) {
    const functions = [];
    const matches = [...pocContent.matchAll(/@GEMS-FUNCTION:\s*([^|\n]+)/g)];
    for (const m of matches) {
        functions.push(m[1].trim());
    }
    return functions;
}

/**
 * 從 POC 提取實際函式定義
 */
function extractActualFunctions(pocContent) {
    const functions = [];
    // 匹配 function name() 或 const name = () => 或 const name = function
    const matches = [...pocContent.matchAll(/function\s+([^\s(]+)\s*\(|const\s+([^\s=]+)\s*=\s*(?:\([^)]*\)\s*=>|function)/g)];
    for (const m of matches) {
        const name = m[1] || m[2];
        if (name) functions.push(name);
    }
    return functions;
}

// ============================================
// v2.0: 前端規格標籤提取函式
// ============================================

/**
 * 從 POC 提取 @GEMS-UI-BIND 綁定規則
 * 格式: @GEMS-UI-BIND:
 *       - _synced:true → .sync-dot.synced (bg-green-500)
 *       - status:待辦 → .status-badge.todo (bg-slate-200)
 */
function extractUIBindings(pocContent) {
    const bindings = [];
    const match = pocContent.match(/@GEMS-UI-BIND:[\s\S]*?(?=-->|@GEMS-|$)/);
    if (!match) return bindings;

    const lines = match[0].split('\n');
    for (const line of lines) {
        // 匹配 "- property:value → .class (styles)"
        const bindMatch = line.match(/-\s*(\w+):([^→]+)→\s*([^\(]+)(?:\(([^)]+)\))?/);
        if (bindMatch) {
            bindings.push({
                property: bindMatch[1].trim(),
                value: bindMatch[2].trim(),
                selector: bindMatch[3].trim(),
                styles: bindMatch[4] ? bindMatch[4].trim() : null
            });
        }
    }
    return bindings;
}

/**
 * 從 POC 提取 @GEMS-CSS-LOCK 鎖定的 CSS 規則
 * 格式: @GEMS-CSS-LOCK:
 *       - SlimHeader: sticky top-0 z-50 bg-white/95 backdrop-blur-md
 *       - BottomNav: fixed bottom-8 rounded-[3rem]
 */
function extractCssLocks(pocContent) {
    const locks = [];
    const match = pocContent.match(/@GEMS-CSS-LOCK:[\s\S]*?(?=-->|@GEMS-|$)/);
    if (!match) return locks;

    const lines = match[0].split('\n');
    for (const line of lines) {
        // 匹配 "- ComponentName: class1 class2 class3"
        const lockMatch = line.match(/-\s*(\w+):\s*(.+)/);
        if (lockMatch) {
            locks.push({
                component: lockMatch[1].trim(),
                classes: lockMatch[2].trim().split(/\s+/)
            });
        }
    }
    return locks;
}

/**
 * 從 POC 提取 @GEMS-FORM-SPEC 表單規格
 * 格式: @GEMS-FORM-SPEC:
 *       | Module | Required | Optional | Dynamic Logic |
 *       |--------|----------|----------|---------------|
 *       | kanban | title    | priority | -             |
 */
function extractFormSpecs(pocContent) {
    const specs = [];
    const match = pocContent.match(/@GEMS-FORM-SPEC:[\s\S]*?(?=-->|@GEMS-|$)/);
    if (!match) return specs;

    const lines = match[0].split('\n');
    for (const line of lines) {
        // 匹配表格行 "| module | required | optional | logic |"
        const tableMatch = line.match(/\|\s*(\w+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/);
        if (tableMatch && !tableMatch[1].toLowerCase().includes('module')) {
            specs.push({
                module: tableMatch[1].trim(),
                required: tableMatch[2].trim().split(',').map(s => s.trim()).filter(Boolean),
                optional: tableMatch[3].trim().split(',').map(s => s.trim()).filter(Boolean),
                dynamicLogic: tableMatch[4].trim()
            });
        }
    }
    return specs;
}

/**
 * 從 POC 提取 @GEMS-ANIMATION 動畫規格
 * 格式: @GEMS-ANIMATION:
 *       - fadeIn: 0.4s ease-out (新項目出現)
 *       - pulse: 1s infinite (pending 狀態)
 */
function extractAnimationSpecs(pocContent) {
    const animations = [];
    const match = pocContent.match(/@GEMS-ANIMATION:[\s\S]*?(?=-->|@GEMS-|$)/);
    if (!match) return animations;

    const lines = match[0].split('\n');
    for (const line of lines) {
        // 匹配 "- animationName: timing (description)"
        const animMatch = line.match(/-\s*([\w:\-]+):\s*([^(]+)(?:\(([^)]+)\))?/);
        if (animMatch) {
            animations.push({
                name: animMatch[1].trim(),
                timing: animMatch[2].trim(),
                description: animMatch[3] ? animMatch[3].trim() : null
            });
        }
    }
    return animations;
}

/**
 * 從 POC 提取 @GEMS-SPEC-REPEAT 區塊 (用於 Prompt Repetition)
 */
function extractSpecRepeat(pocContent) {
    const match = pocContent.match(/@GEMS-SPEC-REPEAT:[\s\S]*?(?=-->|$)/);
    return match ? match[0] : null;
}

/**
 * v3.0: 從 POC 提取 @GEMS-FIELD-COVERAGE 欄位覆蓋聲明
 * 格式: @GEMS-FIELD-COVERAGE:
 *       | Module | Contract Fields | POC Fields | API-Only |
 *       |--------|-----------------|------------|----------|
 *       | Task   | id,title,status | id,title   | status   |
 */
function extractFieldCoverage(pocContent) {
    const coverage = [];
    const match = pocContent.match(/@GEMS-FIELD-COVERAGE:[\s\S]*?(?=-->|@GEMS-|$)/);
    if (!match) return null;

    const lines = match[0].split('\n');
    for (const line of lines) {
        // 匹配表格行 "| Module | Contract | POC | API-Only |"
        const tableMatch = line.match(/\|\s*(\w+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/);
        if (tableMatch && !tableMatch[1].toLowerCase().includes('module')) {
            coverage.push({
                module: tableMatch[1].trim().toLowerCase(),
                contractFields: tableMatch[2].trim().split(',').map(s => s.trim()).filter(Boolean),
                pocFields: tableMatch[3].trim().split(',').map(s => s.trim()).filter(Boolean),
                apiOnly: tableMatch[4].trim().split(',').map(s => s.trim()).filter(Boolean)
            });
        }
    }
    return coverage.length > 0 ? coverage : null;
}

/**
 * v3.0: 檢查 @GEMS-FIELD-COVERAGE 與 Contract 的一致性
 */
function checkFieldCoverage(pocContent, contractPath) {
    const pocCoverage = extractFieldCoverage(pocContent);
    if (!pocCoverage) {
        return { hasCoverage: false, issues: [], missingTag: true };
    }

    if (!contractPath || !fs.existsSync(contractPath)) {
        return { hasCoverage: true, issues: [], coverage: pocCoverage };
    }

    const contractContent = fs.readFileSync(contractPath, 'utf8');
    const issues = [];

    // 從 Contract 提取各模組欄位
    const contractModules = {};
    const interfaceMatches = [...contractContent.matchAll(/export interface (\w+) extends BaseEntity \{([\s\S]*?)\}/g)];
    for (const m of interfaceMatches) {
        const moduleName = m[1].toLowerCase();
        const body = m[2];
        // 移除註解以避免將 @GEMS-FIELD: 視為欄位
        const cleanBody = body.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        const fields = [];
        const fieldMatches = [...cleanBody.matchAll(/(\w+)[\?]?:/g)];
        for (const fm of fieldMatches) {
            if (fm[1] !== 'PK' && fm[1] !== 'FK') {
                fields.push(fm[1]);
            }
        }
        contractModules[moduleName] = fields;
    }

    // 比對每個模組的欄位
    for (const cov of pocCoverage) {
        const contractFields = contractModules[cov.module] || [];
        const declaredFields = [...cov.pocFields, ...cov.apiOnly];

        // 檢查 Contract 有但 POC 沒聲明的欄位
        for (const field of contractFields) {
            if (!declaredFields.includes(field) && !['id', '_synced', 'createdAt', 'updatedAt', 'ctx'].includes(field)) {
                issues.push({
                    type: 'FIELD_NOT_DECLARED',
                    severity: 'MEDIUM',
                    message: `${cov.module}.${field} 在 Contract 中定義但未在 @GEMS-FIELD-COVERAGE 中聲明`
                });
            }
        }

        // 檢查 POC 聲明但 Contract 沒有的欄位
        for (const field of declaredFields) {
            if (!contractFields.includes(field) && !['id', '_synced', 'createdAt', 'updatedAt', 'ctx', '-'].includes(field)) {
                issues.push({
                    type: 'EXTRA_FIELD',
                    severity: 'LOW',
                    message: `${cov.module}.${field} 在 @GEMS-FIELD-COVERAGE 中聲明但 Contract 中不存在`
                });
            }
        }
    }

    return {
        hasCoverage: true,
        coverage: pocCoverage,
        contractModules,
        issues
    };
}

/**
 * 綜合提取所有前端規格標籤
 */
function extractFrontendSpecs(pocContent) {
    return {
        uiBindings: extractUIBindings(pocContent),
        cssLocks: extractCssLocks(pocContent),
        formSpecs: extractFormSpecs(pocContent),
        animations: extractAnimationSpecs(pocContent),
        specRepeat: extractSpecRepeat(pocContent),
        hasFrontendSpecs: Boolean(
            extractUIBindings(pocContent).length ||
            extractCssLocks(pocContent).length ||
            extractFormSpecs(pocContent).length ||
            extractAnimationSpecs(pocContent).length
        )
    };
}

/**
 * 從 POC 提取 Mock 資料
 */
function extractMockData(pocContent) {
    const mocks = [];

    // 匹配陣列形式的 Mock 資料
    const arrayMatches = [...pocContent.matchAll(/(?:let|const|var)\s+(\w+)\s*=\s*\[([\s\S]*?)\];/g)];
    for (const m of arrayMatches) {
        const varName = m[1];
        const content = m[2];
        // 計算物件數量（粗略計算 { 的數量）
        const objectCount = (content.match(/\{/g) || []).length;
        if (objectCount > 0) {
            mocks.push({ name: varName, count: objectCount });
        }
    }

    return mocks;
}

/**
 * 檢查 Mock 資料欄位與 Contract 的對應
 */
function checkMockVsContract(pocContent, contractPath) {
    if (!fs.existsSync(contractPath)) return { match: true, missing: [] };

    const contractContent = fs.readFileSync(contractPath, 'utf8');

    // 從 Contract 提取欄位
    const contractFields = [];
    const fieldMatches = [...contractContent.matchAll(/@GEMS-FIELD:\s*(\w+)/g)];
    for (const m of fieldMatches) {
        contractFields.push(m[1]);
    }

    // 從 Mock 資料提取欄位（簡單匹配 key: value）
    const mockFields = [];
    const mockMatches = [...pocContent.matchAll(/(\w+)\s*:/g)];
    for (const m of mockMatches) {
        mockFields.push(m[1]);
    }

    // 檢查缺少的欄位
    const missing = contractFields.filter(f =>
        !mockFields.some(mf => mf.toLowerCase() === f.toLowerCase())
    );

    return {
        match: missing.length === 0,
        contractFields,
        mockFields: [...new Set(mockFields)],
        missing
    };
}

/**
 * 檢查 Draft 功能與 POC 功能的對應
 * v2.1: 增加智能匹配 - 抽象模組名對應具體函式
 */
function checkDraftVsPoc(draftModules, verifiedItems, gemsFunctions) {
    const covered = [];
    const uncovered = [];

    // [NEW] 通用模組關鍵字映射表 - 抽象名稱對應的具體功能關鍵字
    const moduleAliases = {
        '核心業務': ['add', 'create', 'save', 'update', 'delete', 'render', 'list', 'get', 'handle'],
        '業務模組': ['add', 'create', 'save', 'update', 'delete', 'render', 'list', 'get', 'handle'],
        '模組實作': ['add', 'create', 'save', 'update', 'delete', 'render', 'list', 'get', 'handle'],
        '資料管理': ['save', 'load', 'store', 'fetch', 'get', 'set'],
        'crud': ['add', 'create', 'update', 'delete', 'get', 'list', 'save'],
    };

    for (const module of draftModules) {
        const moduleKeywords = extractKeywords(module);
        let isCovered = false;

        // 方法 1: 直接關鍵字匹配
        const inVerified = verifiedItems.checked.some(v =>
            moduleKeywords.some(mk => v.toLowerCase().includes(mk))
        );
        const inFunctions = gemsFunctions.some(f =>
            moduleKeywords.some(mk => f.toLowerCase().includes(mk))
        );

        if (inVerified || inFunctions) {
            isCovered = true;
        }

        // [NEW] 方法 2: 智能模組匹配 - 如果模組名包含通用關鍵字
        if (!isCovered) {
            for (const [alias, functionPatterns] of Object.entries(moduleAliases)) {
                if (module.toLowerCase().includes(alias)) {
                    // 檢查 POC 是否有這些功能模式的函式
                    const hasMatchingFunction = gemsFunctions.some(f =>
                        functionPatterns.some(pattern => f.toLowerCase().includes(pattern))
                    );
                    if (hasMatchingFunction) {
                        isCovered = true;
                        break;
                    }
                }
            }
        }

        // [NEW] 方法 3: 如果 @GEMS-VERIFIED 有任何勾選項，且數量 >= 3，視為有涵蓋
        // (這代表用戶已經在 POC 中驗證了功能，只是命名不同)
        if (!isCovered && verifiedItems.checked.length >= 3 && gemsFunctions.length >= 3) {
            isCovered = true;
        }

        if (isCovered) {
            covered.push(module);
        } else {
            uncovered.push(module);
        }
    }

    return {
        covered,
        uncovered,
        ratio: draftModules.length > 0 ? covered.length / draftModules.length : 1
    };
}

/**
 * 檢查 @GEMS-VERIFIED 項目是否有對應的函式實作
 * v2.1: 支援 (function: xxx) 格式的函式名稱提取
 */
function checkVerifiedHasFunctions(verifiedItems, actualFunctions) {
    const verified = [];
    const unverified = [];

    for (const item of verifiedItems.checked) {
        // [NEW] 優先提取 (function: xxx) 格式中的函式名
        const functionMatch = item.match(/\(function:\s*(\w+)\)/i);
        const explicitFunctionName = functionMatch ? functionMatch[1].toLowerCase() : null;

        // [NEW] 也提取 (id=xxx) 格式的 ID
        const idMatch = item.match(/\(id[=:]\s*(\w+)\)/i);
        const explicitId = idMatch ? idMatch[1].toLowerCase() : null;

        let hasFunction = false;

        // 方法 1: 直接匹配明確指定的函式名
        if (explicitFunctionName) {
            hasFunction = actualFunctions.some(f =>
                f.toLowerCase() === explicitFunctionName ||
                f.toLowerCase().includes(explicitFunctionName)
            );
        }

        // 方法 2: 如果沒有明確函式名，則用關鍵字匹配
        if (!hasFunction) {
            const itemKeywords = extractKeywords(item);
            hasFunction = actualFunctions.some(f =>
                itemKeywords.some(kw => f.toLowerCase().includes(kw))
            );
        }

        // 方法 3: 如果有 ID，檢查 POC 中是否有對應的 DOM 元素處理
        // (這種情況通常是 UI 元素而非函式，可以放寬)
        if (!hasFunction && explicitId) {
            hasFunction = true; // UI 元素綁定視為有效
        }

        if (hasFunction) {
            verified.push(item);
        } else {
            unverified.push(item);
        }
    }

    return {
        verified,
        unverified,
        ratio: verifiedItems.checked.length > 0 ? verified.length / verifiedItems.checked.length : 1
    };
}

/**
 * 檢查是否有空函式
 */
function checkEmptyFunctions(pocContent) {
    const emptyFunctions = [];

    // 匹配函式定義後只有註解或空白的情況
    const funcMatches = [...pocContent.matchAll(/function\s+(\w+)\s*\([^)]*\)\s*\{([\s\S]*?)\}/g)];
    for (const m of funcMatches) {
        const funcName = m[1];
        const funcBody = m[2].trim();

        // 移除註解
        const bodyWithoutComments = funcBody
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .trim();

        // 如果移除註解後只剩下很少的內容，可能是空函式
        if (bodyWithoutComments.length < 10 || /^[\s\n]*$/.test(bodyWithoutComments)) {
            emptyFunctions.push(funcName);
        }
    }

    return emptyFunctions;
}

function extractKeywords(text) {
    const cleaned = text.replace(/[（][^）]*[）]/g, '').toLowerCase();
    const words = cleaned.split(/[\s,，、\-_]+/).filter(w => w.length > 1);
    const chineseCharacters = cleaned.match(/[\u4e00-\u9fa5]/g) || [];
    return [...new Set([...words, ...chineseCharacters])];
}

/**
 * 主要檢查函式
 */
function checkPocQuality(pocPath, draftPath, contractPath) {
    if (!fs.existsSync(pocPath)) {
        return { verdict: 'SKIP', reason: 'POC 不存在' };
    }

    const pocContent = fs.readFileSync(pocPath, 'utf8');
    const issues = [];
    const blockers = [];
    let score = 100;

    // 提取各種資訊
    const draftModules = extractDraftModules(draftPath);
    const verifiedItems = extractVerifiedItems(pocContent);
    const gemsFunctions = extractGemsFunctions(pocContent);
    const actualFunctions = extractActualFunctions(pocContent);
    const mockData = extractMockData(pocContent);

    // ============================================
    // [NEW] Scaffold 指紋檢測 - 防止「沒改就 PASS」
    // ============================================
    const SCAFFOLD_FINGERPRINTS = [
        '範例項目 A',
        '範例項目 B',
        '已完成項目',
        '專案 POC',  // 通用標題
    ];

    const foundFingerprints = SCAFFOLD_FINGERPRINTS.filter(fp => pocContent.includes(fp));
    if (foundFingerprints.length > 0) {
        issues.push({
            type: 'SCAFFOLD_NOT_CUSTOMIZED',
            severity: 'HIGH',
            message: `POC 仍包含自動生成的範例資料，請客製化：${foundFingerprints.join('、')}`,
            fixGuide: [
                '請將「範例項目 A/B」替換為專案實際資料',
                '請將「專案 POC」替換為專案實際名稱',
                '確保 Mock 資料與 requirement_draft 的功能對應',
            ]
        });
        score -= 20;
    }

    // ============================================
    // [BLOCKER 1] Draft 功能覆蓋率
    // ============================================
    if (draftModules.length > 0) {
        const coverage = checkDraftVsPoc(draftModules, verifiedItems, gemsFunctions);

        if (coverage.ratio < HARD_LIMITS.MIN_DRAFT_COVERAGE) {
            blockers.push({
                type: 'LOW_DRAFT_COVERAGE',
                severity: 'BLOCKER',
                message: `POC 未涵蓋 Draft 功能：覆蓋率 ${Math.round(coverage.ratio * 100)}%（最低 ${HARD_LIMITS.MIN_DRAFT_COVERAGE * 100}%）`,
                fixGuide: [
                    `❌ Draft 承諾的功能：${draftModules.join('、')}`,
                    `❌ POC 只涵蓋：${coverage.covered.join('、') || '無'}`,
                    ``,
                    `✅ 修復方式：在 @GEMS-VERIFIED 中加入對應功能：`,
                    `@GEMS-VERIFIED:`,
                    ...coverage.uncovered.slice(0, 3).map(m => `  - [x] ${m.split('(')[0].trim().substring(0, 20)} (function: yourFunctionName)`),
                    ``,
                    `並實作對應的 JavaScript 函式。`,
                ]
            });
            score -= 40;
        } else if (coverage.uncovered.length > 0) {
            issues.push({
                type: 'PARTIAL_DRAFT_COVERAGE',
                severity: 'HIGH',
                message: `POC 未完整涵蓋 Draft 功能：缺少 ${coverage.uncovered.join('、')}`,
                fixGuide: ['建議在 POC 中增加這些功能的驗證']
            });
            score -= 15;
        }
    }

    // ============================================
    // [BLOCKER 2] @GEMS-VERIFIED 真實性
    // ============================================
    if (verifiedItems.checked.length > 0) {
        const verifyCheck = checkVerifiedHasFunctions(verifiedItems, actualFunctions);

        if (verifyCheck.ratio < HARD_LIMITS.MIN_VERIFIED_FUNCTION_RATIO) {
            // 產生建議的正確格式
            const suggestedFormat = actualFunctions.slice(0, 4).map(f => `  - [x] ${f}`).join('\n');

            blockers.push({
                type: 'FAKE_VERIFIED',
                severity: 'BLOCKER',
                message: `@GEMS-VERIFIED 宣稱的功能沒有對應函式實作：${verifyCheck.unverified.join('、')}`,
                fixGuide: [
                    `❌ 當前格式無法匹配到實際函式`,
                    ``,
                    `✅ 建議修改為（可直接複製）：`,
                    `@GEMS-VERIFIED:`,
                    suggestedFormat,
                    ``,
                    `ℹ️ POC 中已存在的函式：${actualFunctions.join(', ')}`,
                    `ℹ️ 請用這些函式名稱替換 @GEMS-VERIFIED 中的項目`,
                ]
            });
            score -= 35;
        }
    }

    // ============================================
    // [WARNING] GEMS-FUNCTION 數量
    // ============================================
    if (gemsFunctions.length < HARD_LIMITS.MIN_GEMS_FUNCTIONS) {
        issues.push({
            type: 'FEW_GEMS_FUNCTIONS',
            severity: 'HIGH',
            message: `@GEMS-FUNCTION 標籤不足：只有 ${gemsFunctions.length} 個（最少 ${HARD_LIMITS.MIN_GEMS_FUNCTIONS} 個）`,
            fixGuide: [
                '請為核心函式加上 @GEMS-FUNCTION 標籤',
                '',
                '✅ 範例格式（加在函式上方註解）：',
                '// @GEMS-FUNCTION: addNote | P0 | 新增筆記',
                '// @GEMS-FUNCTION: renderList | P0 | 渲染列表',
                '// @GEMS-FUNCTION: handleSubmit | P1 | 處理提交',
            ]
        });
        score -= 15;
    }

    // ============================================
    // [WARNING] Mock 資料檢查
    // ============================================
    const totalMockCount = mockData.reduce((sum, m) => sum + m.count, 0);
    if (totalMockCount < HARD_LIMITS.MIN_MOCK_DATA_COUNT) {
        issues.push({
            type: 'INSUFFICIENT_MOCK',
            severity: 'MEDIUM',
            message: `Mock 資料不足：只有 ${totalMockCount} 筆（最少 ${HARD_LIMITS.MIN_MOCK_DATA_COUNT} 筆）`,
            fixGuide: ['請增加測試資料以確保 POC 功能可驗證']
        });
        score -= 10;
    }

    // ============================================
    // [WARNING] Contract 欄位對應
    // ============================================
    if (contractPath && fs.existsSync(contractPath)) {
        const contractCheck = checkMockVsContract(pocContent, contractPath);
        if (!contractCheck.match && contractCheck.missing.length > 0) {
            issues.push({
                type: 'MOCK_MISSING_FIELDS',
                severity: 'MEDIUM',
                message: `Mock 資料缺少 Contract 定義的欄位：${contractCheck.missing.join('、')}`,
                fixGuide: [
                    `Contract 定義的欄位：${contractCheck.contractFields.join('、')}`,
                    `Mock 資料的欄位：${contractCheck.mockFields.join('、')}`,
                ]
            });
            score -= 10;
        }
    }

    // ============================================
    // [WARNING] 空函式檢查
    // ============================================
    const emptyFuncs = checkEmptyFunctions(pocContent);
    if (emptyFuncs.length > 0) {
        issues.push({
            type: 'EMPTY_FUNCTIONS',
            severity: 'HIGH',
            message: `發現空函式或骨架函式：${emptyFuncs.join('、')}`,
            fixGuide: ['POC 的函式必須有真實邏輯，不能只是骨架']
        });
        score -= 20;
    }

    // ============================================
    // v2.0: [INFO] 前端規格標籤檢查
    // ============================================
    const frontendSpecs = extractFrontendSpecs(pocContent);

    // 如果沒有任何前端規格標籤，發出建議（不是 blocker）
    if (!frontendSpecs.hasFrontendSpecs) {
        issues.push({
            type: 'NO_FRONTEND_SPECS',
            severity: 'LOW',
            message: '未定義前端規格標籤（建議增加以減少 BUILD 微調）',
            fixGuide: [
                '建議增加以下標籤以強化前端規格傳遞:',
                '@GEMS-UI-BIND: 資料屬性到 UI 樣式的綁定',
                '@GEMS-CSS-LOCK: 鎖定關鍵 CSS 組合',
                '@GEMS-FORM-SPEC: Modal/Form 欄位規格',
                '@GEMS-ANIMATION: 動畫效果規格',
            ]
        });
        // 不扣分，只是建議
    } else {
        // 如果有定義，給予加分
        const specCount = frontendSpecs.uiBindings.length +
            frontendSpecs.cssLocks.length +
            frontendSpecs.formSpecs.length +
            frontendSpecs.animations.length;
        if (specCount >= 5) {
            score = Math.min(100, score + 5); // 加分但不超過 100
        }
    }

    // ============================================
    // v3.0: [WARNING] @GEMS-FIELD-COVERAGE 欄位覆蓋檢查
    // ============================================
    const fieldCoverageResult = checkFieldCoverage(pocContent, contractPath);

    if (fieldCoverageResult.missingTag) {
        issues.push({
            type: 'NO_FIELD_COVERAGE',
            severity: 'MEDIUM',
            message: '未定義 @GEMS-FIELD-COVERAGE 標籤（Contract vs POC 欄位對應）',
            fixGuide: [
                '請在 POC 中加入 @GEMS-FIELD-COVERAGE 標籤，格式:',
                '| Module | Contract Fields | POC Fields | API-Only |',
                '| Task | id,title,status | id,title | status |',
            ]
        });
        score -= 5; // 輕微扣分，主要是建議
    } else if (fieldCoverageResult.issues.length > 0) {
        for (const issue of fieldCoverageResult.issues.slice(0, 3)) {
            issues.push(issue);
        }
        score -= fieldCoverageResult.issues.length * 2; // 每個不一致扣 2 分
    }

    // ============================================
    // 計算結果
    // ============================================
    score = Math.max(0, Math.min(100, score));
    const hasBlocker = blockers.length > 0;
    const quality = hasBlocker ? 'SKELETON' : (score >= 80 ? 'GOOD' : (score >= 50 ? 'POOR' : 'SKELETON'));

    return {
        quality,
        score,
        issues: [...blockers, ...issues],
        blockers,
        pocPath,
        stats: {
            draftModules: draftModules.length,
            verifiedChecked: verifiedItems.checked.length,
            verifiedUnchecked: verifiedItems.unchecked.length,
            gemsFunctions: gemsFunctions.length,
            actualFunctions: actualFunctions.length,
            mockDataCount: totalMockCount,
            // v2.0: 前端規格統計
            frontendSpecs: {
                uiBindings: frontendSpecs.uiBindings.length,
                cssLocks: frontendSpecs.cssLocks.length,
                formSpecs: frontendSpecs.formSpecs.length,
                animations: frontendSpecs.animations.length,
                hasRepeatBlock: !!frontendSpecs.specRepeat,
            }
        },
        // v2.0: 導出前端規格供 BUILD 階段使用
        frontendSpecs,
        fixInstructions: generateFixInstructions([...blockers, ...issues], pocPath)
    };

}

/**
 * 產生修正指引
 */
function generateFixInstructions(issues, pocPath) {
    if (issues.length === 0) return null;

    const blockers = issues.filter(i => i.severity === 'BLOCKER');
    const warnings = issues.filter(i => i.severity !== 'BLOCKER');

    const lines = [];
    lines.push(`\n${'='.repeat(60)}`);
    lines.push(`[POC QUALITY CHECK] v1.0 嚴格審查結果`);
    lines.push(`${'='.repeat(60)}\n`);

    if (blockers.length > 0) {
        lines.push(`🚫 發現 ${blockers.length} 個 BLOCKER:\n`);
        blockers.forEach((issue, idx) => {
            lines.push(`[BLOCKER ${idx + 1}] ${issue.message}`);
            if (issue.fixGuide) {
                issue.fixGuide.forEach(g => lines.push(`   ${g}`));
            }
            lines.push('');
        });
    }

    if (warnings.length > 0) {
        lines.push(`⚠️ 發現 ${warnings.length} 個警告:\n`);
        warnings.slice(0, 5).forEach((issue, idx) => {
            lines.push(`[WARN ${idx + 1}] ${issue.message}`);
        });
        lines.push('');
    }

    lines.push(`${'='.repeat(60)}`);
    lines.push(`[!] 修正目標: ${pocPath}`);
    lines.push(`${'='.repeat(60)}\n`);

    return lines.join('\n');
}

/**
 * 執行入口
 */
function run(options) {
    const { target, iteration = 'iter-1' } = options;
    const pocDir = path.join(target, `.gems/iterations/${iteration}/poc`);
    const draftPath = path.join(pocDir, `requirement_draft_${iteration}.md`);

    // 找 POC 檔案
    let pocPath = null;
    let contractPath = null;

    if (fs.existsSync(pocDir)) {
        const files = fs.readdirSync(pocDir);
        for (const f of files) {
            if (f.includes('POC') && (f.endsWith('.html') || f.endsWith('.tsx'))) {
                pocPath = path.join(pocDir, f);
            }
            if (f.endsWith('Contract.ts')) {
                contractPath = path.join(pocDir, f);
            }
        }
    }

    if (!pocPath) {
        return { verdict: 'SKIP', reason: 'POC 不存在' };
    }

    return checkPocQuality(pocPath, draftPath, contractPath);
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const target = args.find(a => a.startsWith('--target='))?.split('=')[1] || process.cwd();
    const iteration = args.find(a => a.startsWith('--iteration='))?.split('=')[1] || 'iter-1';

    const result = run({ target, iteration });

    console.log(`\n[POC QUALITY] 檢查結果 (v2.0)`);
    console.log(`   品質等級: ${result.quality || 'N/A'}`);
    console.log(`   評分: ${result.score || 0}/100`);

    if (result.stats) {
        console.log(`   統計: ${result.stats.gemsFunctions} GEMS-FUNCTION, ${result.stats.mockDataCount} Mock 資料`);
    }

    if (result.blockers?.length > 0) {
        console.log(`   🚫 BLOCKER: ${result.blockers.length} 個`);
    }

    if (result.fixInstructions) {
        console.log(result.fixInstructions);
    } else if (result.verdict !== 'SKIP') {
        console.log(`\n[OK] POC 品質良好\n`);
    } else {
        console.log(`\n[SKIP] ${result.reason}\n`);
    }

    // v2.0: 顯示前端規格統計
    if (result.stats?.frontendSpecs) {
        const fs = result.stats.frontendSpecs;
        const total = fs.uiBindings + fs.cssLocks + fs.formSpecs + fs.animations;
        if (total > 0) {
            console.log(`   📐 前端規格: ${total} 項 (UI-BIND:${fs.uiBindings}, CSS-LOCK:${fs.cssLocks}, FORM-SPEC:${fs.formSpecs}, ANIMATION:${fs.animations})`);
        }
    }
}

module.exports = {
    checkPocQuality,
    run,
    extractDraftModules,
    extractVerifiedItems,
    // v2.0: 導出前端規格提取函式
    extractFrontendSpecs,
    extractUIBindings,
    extractCssLocks,
    extractFormSpecs,
    extractAnimationSpecs,
    extractSpecRepeat,
    // v3.0: 導出欄位覆蓋檢查函式
    extractFieldCoverage,
    checkFieldCoverage,
};
