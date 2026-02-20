#!/usr/bin/env node
/**
 * POC Content Quality Checker v3.0 - 嚴格審查版
 * 目的: 強制 AI 產出完整的 requirement_spec，而非骨架
 * 
 * v3.0 更新：
 * - [NEW] 硬性門檻：Story 數量、AC 數量、Draft/Spec 對應
 * - [NEW] 從 Draft 讀取功能模組，檢查 Spec 是否有對應
 * - [NEW] 內容長度下限檢查
 * - 提供具體的行號定位
 * - 明確禁止修改驗證工具
 */

const fs = require('fs');
const path = require('path');

// ============================================
// 硬性門檻配置 (BLOCKER 級別)
// ============================================
const HARD_LIMITS = {
    // Story 數量下限（不含 Story X.0）- 至少要有 2 個業務功能
    MIN_BUSINESS_STORIES: 2,

    // 每個 Story 至少需要的 AC 數量
    MIN_AC_PER_STORY: 1,

    // Given/When/Then 各行最少字數 - 確保具體描述
    MIN_GWT_LENGTH: 10,

    // 用戶故事「作為/想要/以便」各段最少字數
    MIN_STORY_SEGMENT_LENGTH: 6,

    // Draft 中勾選的模組至少要有 60% 對應到 Spec 的 Story
    MIN_DRAFT_COVERAGE: 0.6,

    // 功能細節列表最少項目數（每個業務 Story）
    MIN_FEATURE_DETAILS: 1,
};

// ============================================
// 佔位符模式
// ============================================
const PLACEHOLDER_PATTERNS = [
    { pattern: /\{角色\}/g, fix: '具體角色名稱（例如：系統管理員、一般使用者）' },
    { pattern: /\{功能\}/g, fix: '具體功能描述（例如：新增任務、編輯內容）' },
    { pattern: /\{目標\}/g, fix: '具體目標說明（例如：提高工作效率、減少錯誤）' },
    { pattern: /\{前置條件\}/g, fix: '具體前置條件（例如：使用者已登入系統）' },
    { pattern: /\{操作動作\}/g, fix: '具體操作描述（例如：點擊新增按鈕）' },
    { pattern: /\{預期結果\}/g, fix: '具體預期結果（例如：顯示成功訊息）' },
    { pattern: /\[角色\]/g, fix: '具體角色名稱' },
    { pattern: /\[功能\]/g, fix: '具體功能描述' },
    { pattern: /\[目標\]/g, fix: '具體目標說明' },
    { pattern: /\[情境\]/g, fix: '具體情境描述' },
    { pattern: /\[動作\]/g, fix: '具體動作描述' },
    { pattern: /\[預期結果\]/g, fix: '具體預期結果' },
    { pattern: /\[請填寫[^\]]*\]/g, fix: '實際內容（移除佔位符）' },
    { pattern: /\[請描述[^\]]*\]/g, fix: '實際描述內容' },
    { pattern: /\[請列出[^\]]*\]/g, fix: '實際列表內容' },
    { pattern: /\[請補充[^\]]*\]/g, fix: '實際補充內容' },
];

/**
 * 從 Draft 讀取勾選的功能模組
 */
function extractDraftModules(draftPath) {
    if (!fs.existsSync(draftPath)) return [];

    const content = fs.readFileSync(draftPath, 'utf8');
    const modules = [];

    // 匹配 - [x] 功能名稱 格式
    const moduleSection = content.match(/## ?功能模組[\s\S]*?(?=\n## |$)/i);
    if (moduleSection) {
        const lines = moduleSection[0].split('\n');
        for (const line of lines) {
            const match = line.match(/- \[x\]\s*(.+)/i);
            if (match) {
                const moduleName = match[1].trim();
                // 排除基礎建設
                if (!/基礎建設|types|config/i.test(moduleName)) {
                    modules.push(moduleName);
                }
            }
        }
    }

    return modules;
}

/**
 * 從 Spec 提取 Story 與 AC
 */
function extractSpecContent(content) {
    const c = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 提取所有 Story
    const storyMatches = [...c.matchAll(/### Story[- ]?(\d+\.\d+):?\s*([^\n]+)/gi)];
    const stories = storyMatches.map(m => ({
        id: m[1],
        title: m[2].trim(),
        isBasic: m[1].endsWith('.0'), // X.0 是基礎建設
    }));

    // 提取所有 AC
    const acMatches = [...c.matchAll(/### AC[- ]?(\d+\.\d+):?\s*([^\n]+)/gi)];
    const acs = acMatches.map(m => ({
        id: m[1],
        title: m[2].trim(),
    }));

    // 提取 Given/When/Then 內容
    const gwtBlocks = [...c.matchAll(/```gherkin\s*([\s\S]*?)```/g)];
    const gwtContents = gwtBlocks.map(m => {
        const block = m[1];
        const given = block.match(/Given\s+(.+)/)?.[1]?.trim() || '';
        const when = block.match(/When\s+(.+)/)?.[1]?.trim() || '';
        const then = block.match(/Then\s+(.+)/)?.[1]?.trim() || '';
        return { given, when, then };
    });

    // 提取用戶故事內容
    const userStoryBlocks = [...c.matchAll(/作為\s+([^，,\n]+)[，,]?\s*我?想要\s+([^，,\n]+)[，,]?\s*以便(?:於)?\s+([^\n]+)/g)];
    const userStories = userStoryBlocks.map(m => ({
        role: m[1].trim(),
        feature: m[2].trim(),
        goal: m[3].trim(),
    }));

    return { stories, acs, gwtContents, userStories };
}

/**
 * 找出內容中的佔位符並標示行號
 */
function findPlaceholdersWithLineNumbers(content) {
    const lines = content.split('\n');
    const findings = [];

    lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        PLACEHOLDER_PATTERNS.forEach(({ pattern, fix }) => {
            const matches = line.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    findings.push({
                        lineNumber: lineNum,
                        placeholder: match,
                        lineContent: line.trim().substring(0, 60) + (line.length > 60 ? '...' : ''),
                        suggestedFix: fix
                    });
                });
            }
        });
    });

    return findings;
}

/**
 * 檢查 Draft → Spec 功能對應
 */
function checkDraftCoverage(draftModules, specStories) {
    if (draftModules.length === 0) return { covered: [], uncovered: [], ratio: 1 };

    const covered = [];
    const uncovered = [];

    for (const module of draftModules) {
        const moduleKeywords = extractKeywords(module);
        const found = specStories.some(story => {
            const storyKeywords = extractKeywords(story.title);
            return moduleKeywords.some(mk =>
                storyKeywords.some(sk =>
                    mk.includes(sk) || sk.includes(mk) ||
                    levenshteinSimilarity(mk, sk) > 0.6
                )
            );
        });

        if (found) {
            covered.push(module);
        } else {
            uncovered.push(module);
        }
    }

    return {
        covered,
        uncovered,
        ratio: covered.length / draftModules.length
    };
}

function extractKeywords(text) {
    const cleaned = text.replace(/[（(][^）)]*[）)]/g, '').toLowerCase();
    const words = cleaned.split(/[\s,，、]+/).filter(w => w.length > 1);
    const chineseWords = cleaned.match(/[\u4e00-\u9fa5]{2,}/g) || [];
    return [...new Set([...words, ...chineseWords])];
}

function levenshteinSimilarity(a, b) {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.includes(shorter)) return 0.8;
    const overlap = [...shorter].filter(c => longer.includes(c)).length;
    return overlap / longer.length;
}

/**
 * 主要檢查函式 - v3.0 嚴格審查版
 */
function checkContentQuality(content, specPath = '', draftPath = '') {
    const issues = [];
    const blockers = []; // 硬性門檻問題
    let score = 100;

    const c = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = c.split('\n');

    // 提取結構化內容
    const { stories, acs, gwtContents, userStories } = extractSpecContent(c);
    const businessStories = stories.filter(s => !s.isBasic);

    // ============================================
    // [BLOCKER 1] Story 數量檢查
    // ============================================
    if (businessStories.length < HARD_LIMITS.MIN_BUSINESS_STORIES) {
        blockers.push({
            type: 'INSUFFICIENT_STORIES',
            severity: 'BLOCKER',
            message: `Story 數量不足：找到 ${businessStories.length} 個業務 Story（不含 X.0），最少需要 ${HARD_LIMITS.MIN_BUSINESS_STORIES} 個`,
            fixGuide: [
                '❌ 目前 Spec 只有 Story X.0（基礎建設）',
                '✅ 請根據 Draft 中勾選的功能模組，為每個功能新增對應的 Story',
                '範例：如果 Draft 有「筆記 CRUD」「Markdown 預覽」，則需要：',
                '  - Story-1.1: 筆記 CRUD',
                '  - Story-1.2: Markdown 預覽',
            ]
        });
        score -= 40;
    }

    // ============================================
    // [BLOCKER 2] AC 數量檢查
    // ============================================
    const expectedACs = stories.length;
    if (acs.length < expectedACs * HARD_LIMITS.MIN_AC_PER_STORY) {
        blockers.push({
            type: 'INSUFFICIENT_ACS',
            severity: 'BLOCKER',
            message: `AC 數量不足：找到 ${acs.length} 個 AC，${stories.length} 個 Story 至少需要 ${expectedACs} 個 AC`,
            fixGuide: [
                '❌ 每個 Story 必須有對應的驗收標準',
                '✅ 請為每個 Story 新增至少一個 AC',
                '範例：Story-1.1 需要有 AC-1.1',
            ]
        });
        score -= 30;
    }

    // ============================================
    // [BLOCKER 3] Draft → Spec 功能對應檢查
    // ============================================
    if (draftPath && fs.existsSync(draftPath)) {
        const draftModules = extractDraftModules(draftPath);
        if (draftModules.length > 0) {
            const coverage = checkDraftCoverage(draftModules, stories);

            if (coverage.ratio < HARD_LIMITS.MIN_DRAFT_COVERAGE) {
                blockers.push({
                    type: 'DRAFT_COVERAGE_LOW',
                    severity: 'BLOCKER',
                    message: `Draft 功能覆蓋率不足：${Math.round(coverage.ratio * 100)}%（最低 ${HARD_LIMITS.MIN_DRAFT_COVERAGE * 100}%）`,
                    fixGuide: [
                        `❌ Draft 列出 ${draftModules.length} 個功能模組：${draftModules.join('、')}`,
                        `❌ 但 Spec 只涵蓋了 ${coverage.covered.length} 個：${coverage.covered.join('、') || '無'}`,
                        `✅ 缺少的功能需要新增對應 Story：${coverage.uncovered.join('、')}`,
                    ]
                });
                score -= 35;
            }
        }
    }

    // ============================================
    // [BLOCKER 4] GWT 內容長度檢查
    // ============================================
    const shortGWT = [];
    gwtContents.forEach((gwt, idx) => {
        if (gwt.given.length < HARD_LIMITS.MIN_GWT_LENGTH && gwt.given.length > 0) {
            shortGWT.push({ idx: idx + 1, part: 'Given', content: gwt.given, length: gwt.given.length });
        }
        if (gwt.when.length < HARD_LIMITS.MIN_GWT_LENGTH && gwt.when.length > 0) {
            shortGWT.push({ idx: idx + 1, part: 'When', content: gwt.when, length: gwt.when.length });
        }
        if (gwt.then.length < HARD_LIMITS.MIN_GWT_LENGTH && gwt.then.length > 0) {
            shortGWT.push({ idx: idx + 1, part: 'Then', content: gwt.then, length: gwt.then.length });
        }
    });

    if (shortGWT.length > 0) {
        issues.push({
            type: 'SHORT_GWT',
            severity: 'HIGH',
            message: `驗收標準描述過短：${shortGWT.length} 處不足 ${HARD_LIMITS.MIN_GWT_LENGTH} 字`,
            details: shortGWT.slice(0, 3).map(s => `AC #${s.idx} 的 ${s.part} 只有 ${s.length} 字：「${s.content}」`),
            fixGuide: [
                '❌ 太短的描述：Given 開啟頁面',
                '✅ 具體的描述：Given 使用者已登入系統並進入筆記管理頁面',
            ]
        });
        score -= 15;
    }

    // ============================================
    // [BLOCKER 5] 佔位符檢查
    // ============================================
    const placeholders = findPlaceholdersWithLineNumbers(c);
    if (placeholders.length > 0) {
        blockers.push({
            type: 'PLACEHOLDER_FOUND',
            severity: 'BLOCKER',
            message: `發現 ${placeholders.length} 個佔位符尚未填寫`,
            details: placeholders.slice(0, 5),
            fixGuide: placeholders.slice(0, 3).map(p =>
                `Line ${p.lineNumber}: 將「${p.placeholder}」改為 ${p.suggestedFix}`
            )
        });
        score -= Math.min(placeholders.length * 5, 30);
    }

    // ============================================
    // [WARNING] 用戶故事格式檢查
    // ============================================
    if (userStories.length === 0) {
        issues.push({
            type: 'NO_USER_STORY_FORMAT',
            severity: 'HIGH',
            message: '找不到符合格式的用戶故事（作為...想要...以便...）',
            fixGuide: [
                '格式：作為 [角色]，我想要 [功能]，以便 [目標]',
                '範例：作為 知識工作者，我想要 撰寫 Markdown 筆記，以便 整理個人知識',
            ]
        });
        score -= 20;
    } else {
        // 檢查用戶故事內容長度
        userStories.forEach((us, idx) => {
            if (us.role.length < HARD_LIMITS.MIN_STORY_SEGMENT_LENGTH) {
                issues.push({
                    type: 'SHORT_USER_STORY_ROLE',
                    severity: 'MEDIUM',
                    message: `用戶故事 #${idx + 1} 的角色描述過短：「${us.role}」`,
                    fixGuide: ['角色應具體描述，例如：「系統管理員」「知識工作者」']
                });
                score -= 5;
            }
            if (us.feature.length < HARD_LIMITS.MIN_STORY_SEGMENT_LENGTH) {
                issues.push({
                    type: 'SHORT_USER_STORY_FEATURE',
                    severity: 'MEDIUM',
                    message: `用戶故事 #${idx + 1} 的功能描述過短：「${us.feature}」`,
                    fixGuide: ['功能應具體描述，例如：「新增與編輯 Markdown 筆記」']
                });
                score -= 5;
            }
        });
    }

    // ============================================
    // [WARNING] 資料契約檢查
    // ============================================
    const dataContractSection = c.match(/## 2\.[^#]*資料契約[\s\S]*?(?=\n## \d|$)/);
    if (dataContractSection) {
        const dc = dataContractSection[0];
        // 檢查是否只有「參見」
        if (/^[\s\S]*參見[\s\S]*Contract\.ts[\s\S]*$/i.test(dc) && !/欄位|型別|Field/i.test(dc)) {
            issues.push({
                type: 'EMPTY_DATA_CONTRACT',
                severity: 'HIGH',
                message: '資料契約只有「參見 Contract.ts」，缺少欄位摘要',
                fixGuide: [
                    '❌ 只寫：參見 MarkdownContract.ts',
                    '✅ 應包含欄位摘要表格：',
                    '| 欄位 | 型別 | 說明 |',
                    '| id | string | 唯一識別碼 |',
                    '| title | string | 筆記標題 |',
                ]
            });
            score -= 10;
        }
    }

    // ============================================
    // 計算最終結果
    // ============================================
    score = Math.max(0, Math.min(100, score));

    // 如果有 BLOCKER，直接判定為 SKELETON
    const hasBlocker = blockers.length > 0;
    const quality = hasBlocker ? 'SKELETON' : (score >= 80 ? 'GOOD' : (score >= 50 ? 'POOR' : 'SKELETON'));

    return {
        quality,
        score,
        issues: [...blockers, ...issues],
        blockers,
        specPath,
        draftPath,
        stats: {
            storyCount: stories.length,
            businessStoryCount: businessStories.length,
            acCount: acs.length,
            userStoryCount: userStories.length,
            placeholderCount: placeholders.length,
        },
        fixInstructions: generateFixInstructions([...blockers, ...issues], specPath)
    };
}

/**
 * 產生人類可讀的修正指引
 */
function generateFixInstructions(issues, specPath) {
    if (issues.length === 0) return null;

    const instructions = [];
    const blockers = issues.filter(i => i.severity === 'BLOCKER');
    const warnings = issues.filter(i => i.severity !== 'BLOCKER');

    instructions.push(`\n${'='.repeat(60)}`);
    instructions.push(`[QUALITY CHECK] v3.0 嚴格審查結果`);
    instructions.push(`${'='.repeat(60)}\n`);

    if (blockers.length > 0) {
        instructions.push(`🚫 發現 ${blockers.length} 個 BLOCKER（必須修正）:\n`);
        blockers.forEach((issue, idx) => {
            instructions.push(`[BLOCKER ${idx + 1}] ${issue.message}`);
            if (issue.fixGuide && issue.fixGuide.length > 0) {
                issue.fixGuide.forEach(guide => {
                    instructions.push(`   ${guide}`);
                });
            }
            instructions.push('');
        });
    }

    if (warnings.length > 0) {
        instructions.push(`⚠️ 發現 ${warnings.length} 個警告:\n`);
        warnings.slice(0, 5).forEach((issue, idx) => {
            instructions.push(`[WARN ${idx + 1}] ${issue.message}`);
            if (issue.lineNumber) {
                instructions.push(`   位置: 第 ${issue.lineNumber} 行`);
            }
        });
        instructions.push('');
    }

    instructions.push(`${'='.repeat(60)}`);
    instructions.push(`[!] 重要提醒`);
    instructions.push(`   - 請修改: ${specPath || 'requirement_spec_iter-X.md'}`);
    instructions.push(`   - 禁止修改: task-pipe/*.cjs 驗證工具`);
    instructions.push(`   - 修正後重新執行 step=3 即可通過`);
    instructions.push(`${'='.repeat(60)}\n`);

    return instructions.join('\n');
}

/**
 * 執行入口
 */
function run(options) {
    const { target, iteration = 'iter-1' } = options;
    const specPath = path.join(target, `.gems/iterations/${iteration}/poc/requirement_spec_${iteration}.md`);
    const draftPath = path.join(target, `.gems/iterations/${iteration}/poc/requirement_draft_${iteration}.md`);

    if (!fs.existsSync(specPath)) return { verdict: 'SKIP' };

    const content = fs.readFileSync(specPath, 'utf8');
    return checkContentQuality(content, specPath, draftPath);
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const target = args.find(a => a.startsWith('--target='))?.split('=')[1] || process.cwd();
    const iteration = args.find(a => a.startsWith('--iteration='))?.split('=')[1] || 'iter-1';

    const result = run({ target, iteration });

    console.log(`\n[QUALITY] 內容品質檢查結果 (v3.0)`);
    console.log(`   品質等級: ${result.quality}`);
    console.log(`   評分: ${result.score}/100`);
    console.log(`   統計: ${result.stats?.storyCount || 0} Stories, ${result.stats?.acCount || 0} ACs`);

    if (result.blockers?.length > 0) {
        console.log(`   🚫 BLOCKER: ${result.blockers.length} 個`);
    }

    if (result.fixInstructions) {
        console.log(result.fixInstructions);
    } else {
        console.log(`\n[OK] 內容品質良好，無需修正\n`);
    }
}

module.exports = { checkContentQuality, run, findPlaceholdersWithLineNumbers, extractDraftModules };
