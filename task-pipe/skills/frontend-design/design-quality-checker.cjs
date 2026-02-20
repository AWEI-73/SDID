#!/usr/bin/env node
/**
 * Frontend Design Quality Checker v1.0
 * 
 * 目的: 檢查 POC 的設計品質，確保避免「AI Slop」美學
 * 
 * 檢查項目:
 * - @GEMS-DESIGN-BRIEF 結構完整性
 * - 禁用字體檢測
 * - 配色系統檢測
 * - 動態效果存在性
 * - CSS 變數使用
 */

const fs = require('fs');
const path = require('path');

// ============================================
// 設計品質規則配置
// ============================================

const DESIGN_RULES = {
    // 禁用的通用字體
    FORBIDDEN_FONTS: [
        'Arial',
        'Inter',
        'Roboto',
        'Helvetica',
        'system-ui',
        '-apple-system',
        'BlinkMacSystemFont',
    ],

    // 禁用的背景色
    FORBIDDEN_BACKGROUNDS: [
        '#FFFFFF',
        '#FFF',
        'white',
        'rgb(255, 255, 255)',
        'rgba(255, 255, 255, 1)',
    ],

    // @GEMS-DESIGN-BRIEF 必填欄位
    REQUIRED_BRIEF_FIELDS: [
        'Purpose',
        'Aesthetic',
        'Typography',
    ],

    // @GEMS-DESIGN-BRIEF 建議欄位
    RECOMMENDED_BRIEF_FIELDS: [
        'ColorPalette',
        'Motion',
        'Avoid',
        'Memorable',
    ],
};

// ============================================
// 評分權重
// ============================================

const SCORE_WEIGHTS = {
    DESIGN_BRIEF_STRUCTURE: 20,     // @GEMS-DESIGN-BRIEF 結構
    TYPOGRAPHY: 20,                  // 字體選擇
    COLOR_SYSTEM: 25,                // 配色系統
    MOTION: 15,                      // 動態效果
    CSS_VARIABLES: 10,               // CSS 變數使用
    MEMORABLE_ELEMENT: 10,           // 記憶點
};

/**
 * 提取 @GEMS-DESIGN-BRIEF 內容
 */
function extractDesignBrief(content) {
    const match = content.match(/@GEMS-DESIGN-BRIEF:[\s\S]*?(?=@GEMS-|-->|$)/);
    if (!match) return null;

    const briefContent = match[0];
    const result = {
        raw: briefContent,
        fields: {},
    };

    // 解析各欄位
    const fields = ['Purpose', 'Aesthetic', 'Typography', 'ColorPalette', 'Motion', 'Avoid', 'Memorable'];
    for (const field of fields) {
        const fieldMatch = briefContent.match(new RegExp(`-\\s*${field}:\\s*([^\\n]+|[\\s\\S]*?(?=-\\s*[A-Z]|$))`, 'i'));
        if (fieldMatch) {
            result.fields[field] = fieldMatch[1].trim();
        }
    }

    return result;
}

/**
 * 檢查禁用字體
 * 改進版：允許系統字體作為 fallback，只要有獨特的主字體
 */
function checkForbiddenFonts(content) {
    const issues = [];
    const foundFonts = [];
    let hasPrimaryUniqueFont = false;

    // 獨特字體列表（常見的設計字體）
    const UNIQUE_FONTS = [
        // Display / 標題字體
        'Space Grotesk', 'Outfit', 'Syne', 'Poppins', 'Montserrat',
        'Playfair Display', 'Lora', 'Merriweather', 'Raleway', 'Work Sans',
        'DM Sans', 'Nunito', 'Mulish', 'Josefin Sans', 'Quicksand',
        'Manrope', 'Barlow', 'Source Sans', 'Noto Sans', 'Open Sans',
        'Plus Jakarta Sans', 'Geist',
        // Mono / 數據字體
        'Fira Code', 'JetBrains Mono', 'IBM Plex', 'Ubuntu', 'Geist Mono',
        // 中文字體
        'Noto Sans TC', 'Noto Sans SC', 'LXGW WenKai',
    ];

    // 檢查是否有獨特的主字體
    for (const uniqueFont of UNIQUE_FONTS) {
        if (new RegExp(`font-family[^;]*['"]?${uniqueFont}`, 'gi').test(content)) {
            hasPrimaryUniqueFont = true;
            break;
        }
    }

    // 如果已有獨特主字體，則忽略 fallback 的系統字體
    if (hasPrimaryUniqueFont) {
        return { issues, foundFonts, hasPrimaryUniqueFont };
    }

    // 否則檢查是否只使用了通用字體
    for (const font of DESIGN_RULES.FORBIDDEN_FONTS) {
        const regex = new RegExp(`font-family[^;]*${font}`, 'gi');
        if (regex.test(content)) {
            foundFonts.push(font);
        }
    }

    if (foundFonts.length > 0) {
        issues.push({
            type: 'FORBIDDEN_FONT',
            severity: 'HIGH',
            message: `主字體使用了通用字體: ${foundFonts.join(', ')}`,
            suggestion: '請換用獨特字體如 Space Grotesk, Outfit, Syne (Google Fonts)',
        });
    }

    return { issues, foundFonts, hasPrimaryUniqueFont };
}

/**
 * 檢查禁用背景色
 */
function checkForbiddenBackgrounds(content) {
    const issues = [];
    let hasPureWhite = false;

    for (const bg of DESIGN_RULES.FORBIDDEN_BACKGROUNDS) {
        const regex = new RegExp(`background(?:-color)?\\s*:\\s*${bg.replace(/[()]/g, '\\$&')}`, 'gi');
        if (regex.test(content)) {
            hasPureWhite = true;
            break;
        }
    }

    if (hasPureWhite) {
        issues.push({
            type: 'PURE_WHITE_BACKGROUND',
            severity: 'MEDIUM',
            message: '使用了純白背景 #FFFFFF',
            suggestion: '建議改用帶灰調的暖白 (#F9FAFB) 或深色系背景',
        });
    }

    return { issues, hasPureWhite };
}

/**
 * 檢查 CSS 變數使用
 */
function checkCssVariables(content) {
    const issues = [];

    // 檢查是否有 :root 或 CSS 變數定義
    const hasRoot = /:root\s*\{/.test(content);
    const hasVarUsage = /var\(--/.test(content);
    const varCount = (content.match(/--[\w-]+\s*:/g) || []).length;

    if (!hasRoot || !hasVarUsage) {
        issues.push({
            type: 'NO_CSS_VARIABLES',
            severity: 'MEDIUM',
            message: '未使用 CSS 變數系統',
            suggestion: '建議在 :root 中定義 --color-primary, --color-bg 等變數',
        });
    }

    return { issues, hasRoot, hasVarUsage, varCount };
}

/**
 * 檢查動態效果
 */
function checkMotionEffects(content) {
    const issues = [];

    const hasTransition = /transition\s*:/.test(content);
    const hasTransform = /transform\s*:/.test(content);
    const hasHover = /:hover\s*\{/.test(content);
    const hasAnimation = /@keyframes|animation\s*:/.test(content);

    const motionScore = [hasTransition, hasTransform, hasHover, hasAnimation].filter(Boolean).length;

    if (motionScore < 2) {
        issues.push({
            type: 'LACK_OF_MOTION',
            severity: 'LOW',
            message: '動態效果不足',
            suggestion: '建議加入 hover 效果、transition 過渡動畫',
        });
    }

    return { issues, hasTransition, hasTransform, hasHover, hasAnimation, motionScore };
}

/**
 * 檢查 @GEMS-DESIGN-BRIEF 結構
 */
function checkDesignBriefStructure(brief) {
    const issues = [];

    if (!brief) {
        issues.push({
            type: 'MISSING_DESIGN_BRIEF',
            severity: 'BLOCKER',
            message: '缺少 @GEMS-DESIGN-BRIEF',
            suggestion: '請在 POC 中加入完整的 @GEMS-DESIGN-BRIEF 區塊',
        });
        return { issues, missingRequired: DESIGN_RULES.REQUIRED_BRIEF_FIELDS, missingRecommended: DESIGN_RULES.RECOMMENDED_BRIEF_FIELDS };
    }

    const missingRequired = [];
    const missingRecommended = [];

    for (const field of DESIGN_RULES.REQUIRED_BRIEF_FIELDS) {
        if (!brief.fields[field]) {
            missingRequired.push(field);
        }
    }

    for (const field of DESIGN_RULES.RECOMMENDED_BRIEF_FIELDS) {
        if (!brief.fields[field]) {
            missingRecommended.push(field);
        }
    }

    if (missingRequired.length > 0) {
        issues.push({
            type: 'INCOMPLETE_DESIGN_BRIEF',
            severity: 'HIGH',
            message: `@GEMS-DESIGN-BRIEF 缺少必填欄位: ${missingRequired.join(', ')}`,
            suggestion: '請補充完整的 Purpose, Aesthetic, Typography 欄位',
        });
    }

    if (missingRecommended.length > 0) {
        issues.push({
            type: 'MISSING_RECOMMENDED_FIELDS',
            severity: 'LOW',
            message: `@GEMS-DESIGN-BRIEF 缺少建議欄位: ${missingRecommended.join(', ')}`,
            suggestion: '建議補充 ColorPalette, Motion, Avoid, Memorable 欄位',
        });
    }

    return { issues, missingRequired, missingRecommended };
}

/**
 * 檢查是否有獨特設計元素（記憶點）
 */
function checkMemorableElements(content, brief) {
    const issues = [];
    let hasMemorableElement = false;

    // 檢查是否有特殊視覺效果
    const specialEffects = [
        /box-shadow.*rgba.*0\.[2-9]|1\)/,  // 明顯陰影
        /gradient/i,                         // 漸層
        /blur\(/,                            // 模糊效果
        /@keyframes/,                        // 自定義動畫
        /cubic-bezier/,                      // 自定義緩動
        /backdrop-filter/,                   // 毛玻璃效果
    ];

    for (const pattern of specialEffects) {
        if (pattern.test(content)) {
            hasMemorableElement = true;
            break;
        }
    }

    // 檢查 @GEMS-DESIGN-BRIEF 的 Memorable 欄位
    if (brief && brief.fields.Memorable) {
        hasMemorableElement = true;
    }

    if (!hasMemorableElement) {
        issues.push({
            type: 'NO_MEMORABLE_ELEMENT',
            severity: 'LOW',
            message: '缺少獨特的設計記憶點',
            suggestion: '建議加入特色視覺效果，如漸層、光暈、毛玻璃等',
        });
    }

    return { issues, hasMemorableElement };
}

/**
 * 主要檢查函式
 */
function checkDesignQuality(pocPath) {
    if (!fs.existsSync(pocPath)) {
        return { verdict: 'SKIP', reason: 'POC 不存在' };
    }

    const content = fs.readFileSync(pocPath, 'utf8');
    const allIssues = [];
    let score = 100;

    // 1. 提取並檢查 @GEMS-DESIGN-BRIEF
    const brief = extractDesignBrief(content);
    const briefCheck = checkDesignBriefStructure(brief);
    allIssues.push(...briefCheck.issues);

    if (briefCheck.missingRequired?.length === DESIGN_RULES.REQUIRED_BRIEF_FIELDS.length) {
        score -= SCORE_WEIGHTS.DESIGN_BRIEF_STRUCTURE;
    } else if (briefCheck.missingRequired?.length > 0) {
        score -= Math.round(SCORE_WEIGHTS.DESIGN_BRIEF_STRUCTURE * 0.5);
    }

    // 2. 檢查禁用字體
    const fontCheck = checkForbiddenFonts(content);
    allIssues.push(...fontCheck.issues);
    if (fontCheck.foundFonts.length > 0) {
        score -= SCORE_WEIGHTS.TYPOGRAPHY;
    }

    // 3. 檢查禁用背景色
    const bgCheck = checkForbiddenBackgrounds(content);
    allIssues.push(...bgCheck.issues);
    if (bgCheck.hasPureWhite) {
        score -= Math.round(SCORE_WEIGHTS.COLOR_SYSTEM * 0.4);
    }

    // 4. 檢查 CSS 變數
    const cssVarCheck = checkCssVariables(content);
    allIssues.push(...cssVarCheck.issues);
    if (!cssVarCheck.hasRoot || !cssVarCheck.hasVarUsage) {
        score -= SCORE_WEIGHTS.CSS_VARIABLES;
    }

    // 5. 檢查動態效果
    const motionCheck = checkMotionEffects(content);
    allIssues.push(...motionCheck.issues);
    if (motionCheck.motionScore < 2) {
        score -= SCORE_WEIGHTS.MOTION;
    }

    // 6. 檢查記憶點
    const memorableCheck = checkMemorableElements(content, brief);
    allIssues.push(...memorableCheck.issues);
    if (!memorableCheck.hasMemorableElement) {
        score -= SCORE_WEIGHTS.MEMORABLE_ELEMENT;
    }

    // 計算品質等級
    score = Math.max(0, Math.min(100, score));
    const hasBlocker = allIssues.some(i => i.severity === 'BLOCKER');
    const quality = hasBlocker ? 'SKELETON' : (score >= 80 ? 'GOOD' : (score >= 50 ? 'POOR' : 'SKELETON'));

    return {
        quality,
        score,
        issues: allIssues,
        details: {
            brief: brief ? {
                hasRequired: briefCheck.missingRequired?.length === 0,
                missingRequired: briefCheck.missingRequired,
                missingRecommended: briefCheck.missingRecommended,
            } : null,
            typography: {
                ok: fontCheck.foundFonts.length === 0,
                forbiddenFonts: fontCheck.foundFonts,
            },
            color: {
                ok: !bgCheck.hasPureWhite,
                hasCssVariables: cssVarCheck.hasRoot && cssVarCheck.hasVarUsage,
                varCount: cssVarCheck.varCount,
            },
            motion: {
                score: motionCheck.motionScore,
                hasTransition: motionCheck.hasTransition,
                hasHover: motionCheck.hasHover,
            },
            memorable: memorableCheck.hasMemorableElement,
        },
    };
}

/**
 * 產生修正指引
 */
function generateDesignFixInstructions(result, pocPath) {
    if (result.issues.length === 0) return null;

    const lines = [];
    lines.push(`\n${'='.repeat(60)}`);
    lines.push(`[DESIGN QUALITY CHECK] v1.0 設計品質檢查結果`);
    lines.push(`${'='.repeat(60)}\n`);
    lines.push(`📊 設計評分: ${result.score}/100 (${result.quality})\n`);

    const blockers = result.issues.filter(i => i.severity === 'BLOCKER');
    const high = result.issues.filter(i => i.severity === 'HIGH');
    const medium = result.issues.filter(i => i.severity === 'MEDIUM');
    const low = result.issues.filter(i => i.severity === 'LOW');

    if (blockers.length > 0) {
        lines.push(`🚫 BLOCKER (${blockers.length}):`);
        blockers.forEach(i => {
            lines.push(`   • ${i.message}`);
            lines.push(`     → ${i.suggestion}`);
        });
        lines.push('');
    }

    if (high.length > 0) {
        lines.push(`🔴 HIGH (${high.length}):`);
        high.forEach(i => {
            lines.push(`   • ${i.message}`);
            lines.push(`     → ${i.suggestion}`);
        });
        lines.push('');
    }

    if (medium.length > 0) {
        lines.push(`🟡 MEDIUM (${medium.length}):`);
        medium.forEach(i => {
            lines.push(`   • ${i.message}`);
        });
        lines.push('');
    }

    if (low.length > 0) {
        lines.push(`🟢 建議改善 (${low.length}):`);
        low.forEach(i => {
            lines.push(`   • ${i.message}`);
        });
        lines.push('');
    }

    lines.push(`${'='.repeat(60)}`);
    lines.push(`[!] 修正目標: ${pocPath}`);
    lines.push(`[!] 設計指南: task-pipe/skills/frontend-design/SUMMARY.md`);
    lines.push(`${'='.repeat(60)}\n`);

    return lines.join('\n');
}

/**
 * 執行入口
 */
function run(options) {
    const { target, iteration = 'iter-1' } = options;
    const pocDir = path.join(target, `.gems/iterations/${iteration}/poc`);

    // 找 POC 檔案
    let pocPath = null;
    if (fs.existsSync(pocDir)) {
        const files = fs.readdirSync(pocDir);
        for (const f of files) {
            if (f.includes('POC') && (f.endsWith('.html') || f.endsWith('.tsx'))) {
                pocPath = path.join(pocDir, f);
                break;
            }
        }
    }

    if (!pocPath) {
        return { verdict: 'SKIP', reason: 'POC 不存在' };
    }

    const result = checkDesignQuality(pocPath);
    result.fixInstructions = generateDesignFixInstructions(result, pocPath);

    return result;
}

// CLI 執行
if (require.main === module) {
    const args = process.argv.slice(2);
    const target = args.find(a => a.startsWith('--target='))?.split('=')[1] || process.cwd();
    const iteration = args.find(a => a.startsWith('--iteration='))?.split('=')[1] || 'iter-1';

    const result = run({ target, iteration });

    console.log(`\n[DESIGN QUALITY] 檢查結果 (v1.0)`);
    console.log(`   設計品質: ${result.quality || 'N/A'}`);
    console.log(`   評分: ${result.score || 0}/100`);

    if (result.fixInstructions) {
        console.log(result.fixInstructions);
    } else if (result.verdict !== 'SKIP') {
        console.log(`\n[OK] 設計品質良好\n`);
    } else {
        console.log(`\n[SKIP] ${result.reason}\n`);
    }
}

module.exports = { checkDesignQuality, run };
