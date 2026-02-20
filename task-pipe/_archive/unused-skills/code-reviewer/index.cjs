/**
 * Code Review Skill - MVP
 * 依照 Pipeline 階段提供針對性的錯誤回饋
 * 
 * 設計理念：
 * 1. 每個階段有特定的錯誤模式
 * 2. Review 策略依階段調整
 * 3. 產出結構化報告（未來可用於 RAG）
 */

const fs = require('fs');
const path = require('path');

// ============================================
// 階段錯誤特徵定義
// ============================================

const PHASE_PROFILES = {
    // POC 階段
    'poc-1': {
        name: 'POC Step 1 - 模糊消除',
        commonErrors: [
            '需求描述不明確',
            '功能模組未勾選',
            '釐清項目未完成',
            '用詞過於模糊'
        ],
        reviewFocus: ['需求完整性', '邏輯一致性'],
        suggestedActions: [
            '補充使用者角色描述',
            '明確核心目標',
            '定義資料結構',
            '列出邊界條件'
        ]
    },

    'poc-2': {
        name: 'POC Step 2 - 規模評估',
        commonErrors: [
            '規模評估不準確',
            'Story 數量超出限制',
            '複雜度評估錯誤'
        ],
        reviewFocus: ['規模合理性', 'Story 數量'],
        suggestedActions: [
            '重新評估專案規模',
            '調整 Story 拆分',
            '確認複雜度等級'
        ]
    },

    'poc-3': {
        name: 'POC Step 3 - 契約設計',
        commonErrors: [
            '缺少 @GEMS-CONTRACT 標籤',
            '缺少 @GEMS-TABLE 標籤',
            '缺少 @GEMS-FUNCTION 標籤',
            'MOCK 資料不足'
        ],
        reviewFocus: ['資料結構設計', '函式規格完整性'],
        suggestedActions: [
            '補充資料表註解（UUID/VARCHAR/PK）',
            '定義函式簽名',
            '提供 MOCK 資料'
        ]
    },

    'poc-4': {
        name: 'POC Step 4 - UI 原型',
        commonErrors: [
            '缺少 @GEMS-DESIGN-BRIEF',
            '缺少 @GEMS-VERIFIED',
            'POC 無法運行',
            '缺少互動功能'
        ],
        reviewFocus: ['UI 可用性', '功能驗證範圍'],
        suggestedActions: [
            '補充設計說明',
            '標記已驗證功能',
            '確保 POC 可雙擊運行'
        ]
    },

    'poc-5': {
        name: 'POC Step 5 - 需求規格',
        commonErrors: [
            '缺用戶故事',
            '缺驗收標準',
            '缺 Story 定義',
            'Story 拆分不合理'
        ],
        reviewFocus: ['需求完整性', 'Story 獨立性'],
        suggestedActions: [
            '補充用戶故事（As a...I want...So that...）',
            '定義驗收標準',
            '確保 Story 可獨立測試'
        ]
    },

    // PLAN 階段
    'plan-1': {
        name: 'PLAN Step 1 - 需求確認',
        commonErrors: [
            '缺資料契約',
            'POC 產出不完整',
            'Story 識別失敗'
        ],
        reviewFocus: ['POC 完整性', 'Story 清單正確性'],
        suggestedActions: [
            '確認 POC 所有步驟已完成',
            '檢查 requirement_spec 格式'
        ]
    },

    'plan-2': {
        name: 'PLAN Step 2 - 規格注入',
        commonErrors: [
            'implementation_plan 格式錯誤',
            '檔案結構定義不完整',
            'Item 拆分不合理'
        ],
        reviewFocus: ['模組化設計', 'Item 獨立性'],
        suggestedActions: [
            '參考 implementation_plan.template.md',
            '確保每個 Item 可獨立開發'
        ]
    },

    'plan-3': {
        name: 'PLAN Step 3 - 架構審查',
        commonErrors: [
            '架構設計不合理',
            '模組依賴過於複雜',
            '缺少 Constitution Audit'
        ],
        reviewFocus: ['架構合理性', '模組獨立性'],
        suggestedActions: [
            '執行 Constitution Audit',
            '簡化模組依賴',
            '確認架構符合規範'
        ]
    },

    'plan-4': {
        name: 'PLAN Step 4 - 標籤規格設計',
        commonErrors: [
            'GEMS 標籤覆蓋率不足',
            '缺少 GEMS-DEPS',
            '缺少 [STEP] 錨點',
            'P0 函式標籤不完整'
        ],
        reviewFocus: ['標籤完整性', 'FLOW 步驟設計'],
        suggestedActions: [
            '補充 GEMS-DEPS 和 GEMS-DEPS-RISK',
            '為 P0/P1 函式加入 [STEP] 錨點',
            '確保標籤覆蓋率 >= 80%'
        ]
    },

    'plan-5': {
        name: 'PLAN Step 5 - 需求規格說明',
        commonErrors: [
            '規格說明不完整',
            '缺少最終確認',
            '文件格式錯誤'
        ],
        reviewFocus: ['規格完整性', '文件品質'],
        suggestedActions: [
            '補充規格說明',
            '確認所有項目已完成',
            '檢查文件格式'
        ]
    },

    // BUILD 階段
    'build-1': {
        name: 'BUILD Phase 1 - 開發腳本',
        commonErrors: [
            '源碼目錄不存在',
            '檔案結構與 Plan 不符',
            'TypeScript 編譯錯誤'
        ],
        reviewFocus: ['檔案結構', '編譯正確性'],
        suggestedActions: [
            '建立 src/ 目錄',
            '依照 implementation_plan 建立檔案',
            '執行 tsc --noEmit 檢查'
        ]
    },

    'build-2': {
        name: 'BUILD Phase 2 - 骨架檢查',
        commonErrors: [
            '缺少必要檔案',
            '模組結構不符合規範',
            'index.ts 未匯出'
        ],
        reviewFocus: ['模組完整性', '匯出正確性'],
        suggestedActions: [
            '檢查 implementation_plan 的檔案清單',
            '確保每個模組有 index.ts',
            '驗證匯出路徑'
        ]
    },

    'build-3': {
        name: 'BUILD Phase 3 - 測試執行',
        commonErrors: [
            '測試失敗',
            '測試覆蓋率不足',
            '缺少測試檔案'
        ],
        reviewFocus: ['測試正確性', '測試覆蓋率'],
        suggestedActions: [
            '檢查測試案例是否涵蓋邊界條件',
            '確保 P0 函式有單元測試',
            '執行 npm test 驗證'
        ]
    },

    'build-4': {
        name: 'BUILD Phase 4 - 標籤驗收',
        commonErrors: [
            'GEMS 標籤覆蓋率 < 80%',
            'P0/P1 缺少擴展標籤',
            '標籤與實作不一致',
            '[STEP] 錨點數量不符'
        ],
        reviewFocus: ['標籤合規性', '標籤與程式碼一致性'],
        suggestedActions: [
            '補充缺失的 GEMS 標籤',
            '確保標籤在函式定義正上方（< 2000 字元）',
            '驗證 [STEP] 錨點與 GEMS-FLOW 對應'
        ]
    },

    'build-5': {
        name: 'BUILD Phase 5 - 測試檔案驗證',
        commonErrors: [
            '測試檔案不存在',
            '測試檔案路徑錯誤',
            'GEMS-TEST-FILE 標籤錯誤'
        ],
        reviewFocus: ['測試檔案存在性', '測試檔案命名'],
        suggestedActions: [
            '在 __tests__/ 目錄建立測試檔案',
            '確保測試檔案名稱與 GEMS-TEST-FILE 一致'
        ]
    },

    'build-6': {
        name: 'BUILD Phase 6 - 整合測試',
        commonErrors: [
            '整合測試失敗',
            '模組間互動錯誤',
            '資料流不正確'
        ],
        reviewFocus: ['模組互動', '資料流正確性'],
        suggestedActions: [
            '檢查模組間的依賴關係',
            '驗證資料轉換邏輯',
            '確保 API 契約一致'
        ]
    },

    'build-7': {
        name: 'BUILD Phase 7 - Fillback',
        commonErrors: [
            'Fillback 格式錯誤',
            'iteration_suggestions 缺失',
            '技術債未記錄'
        ],
        reviewFocus: ['文件完整性', '建議品質'],
        suggestedActions: [
            '填寫 technicalHighlights',
            '記錄 technicalDebt',
            '提供 nextIteration 建議'
        ]
    }
};

// ============================================
// 簡化版 Code Reviewer
// ============================================

class SimpleCodeReviewer {
    constructor(phase, step) {
        this.phaseKey = step ? `${phase.toLowerCase()}-${step}` : phase.toLowerCase();
        this.profile = PHASE_PROFILES[this.phaseKey] || this.getGenericProfile(phase);
    }

    getGenericProfile(phase) {
        return {
            name: `${phase.toUpperCase()} Phase`,
            commonErrors: ['未知錯誤'],
            reviewFocus: ['一般性檢查'],
            suggestedActions: ['檢查錯誤訊息並修正']
        };
    }

    /**
     * 產生結構化的錯誤回饋報告
     * @param {Object} context - 錯誤上下文
     * @returns {Object} 結構化報告（可用於 RAG）
     */
    generateReport(context) {
        const { errors, retryCount, timestamp } = context;

        const report = {
            // 基本資訊
            metadata: {
                phase: this.profile.name,
                phaseKey: this.phaseKey,
                timestamp: timestamp || new Date().toISOString(),
                retryCount: retryCount || 0
            },

            // 錯誤分析
            analysis: {
                detectedErrors: this.categorizeErrors(errors),
                commonPatterns: this.matchCommonErrors(errors),
                reviewFocus: this.profile.reviewFocus
            },

            // 建議行動
            recommendations: {
                immediate: this.getImmediateActions(errors),
                preventive: this.profile.suggestedActions,
                references: this.getReferences()
            },

            // RAG 優化用的結構化資料
            ragData: {
                errorTypes: this.extractErrorTypes(errors),
                keywords: this.extractKeywords(errors),
                severity: this.assessSeverity(errors, retryCount)
            }
        };

        return report;
    }

    categorizeErrors(errors) {
        if (!errors || errors.length === 0) return [];

        return errors.map(error => ({
            type: this.inferErrorType(error),
            message: error.message || error,
            location: error.location || error.file || 'unknown',
            severity: error.severity || 'medium'
        }));
    }

    matchCommonErrors(errors) {
        const matched = [];
        const errorTexts = errors.map(e => e.message || e).join(' ');

        this.profile.commonErrors.forEach(commonError => {
            const keywords = commonError.toLowerCase().split(/\s+/);
            const isMatch = keywords.some(kw => errorTexts.toLowerCase().includes(kw));

            if (isMatch) {
                matched.push({
                    pattern: commonError,
                    confidence: 'high'
                });
            }
        });

        return matched;
    }

    getImmediateActions(errors) {
        const actions = [];

        // 根據錯誤類型提供即時建議
        errors.forEach(error => {
            const errorText = (error.message || error).toLowerCase();

            if (errorText.includes('缺') || errorText.includes('missing')) {
                actions.push({
                    action: '補充缺失內容',
                    target: error.location || 'unknown',
                    priority: 'high'
                });
            }

            if (errorText.includes('格式') || errorText.includes('format')) {
                actions.push({
                    action: '修正格式',
                    target: error.location || 'unknown',
                    priority: 'medium'
                });
            }

            if (errorText.includes('標籤') || errorText.includes('tag')) {
                actions.push({
                    action: '補充 GEMS 標籤',
                    target: error.location || 'unknown',
                    priority: 'high'
                });
            }
        });

        return actions;
    }

    getReferences() {
        const refs = {
            'poc-1': ['task-pipe/phases/poc/step-1.cjs', 'requirement_draft 模板'],
            'poc-2': ['task-pipe/phases/poc/step-2.cjs', '規模評估指南'],
            'poc-3': ['control-tower/docs/templates/contract.template.ts'],
            'poc-4': ['POC HTML 模板', 'GEMS-DESIGN-BRIEF 規範'],
            'poc-5': ['requirement_spec 模板', 'Story 拆分指南'],
            'plan-2': ['implementation_plan.template.md'],
            'plan-3': ['架構審查指南', 'Constitution Audit'],
            'plan-4': ['GEMS Tag System v2.1'],
            'plan-5': ['需求規格說明指南'],
            'build-4': ['gems-scanner.cjs', 'GEMS 標籤規範'],
            'build-5': ['測試檔案命名規範']
        };

        return refs[this.phaseKey] || ['GEMS 文件'];
    }

    inferErrorType(error) {
        const text = (error.message || error).toLowerCase();

        if (text.includes('缺') || text.includes('missing')) return 'MISSING_CONTENT';
        if (text.includes('格式') || text.includes('format')) return 'FORMAT_ERROR';
        if (text.includes('標籤') || text.includes('tag')) return 'TAG_ERROR';
        if (text.includes('測試') || text.includes('test')) return 'TEST_ERROR';
        if (text.includes('檔案') || text.includes('file')) return 'FILE_ERROR';

        return 'UNKNOWN';
    }

    extractErrorTypes(errors) {
        const types = new Set();
        errors.forEach(error => {
            types.add(this.inferErrorType(error));
        });
        return Array.from(types);
    }

    extractKeywords(errors) {
        const keywords = new Set();
        const stopWords = ['的', '是', '在', '有', '和', '或', '但', '了'];

        errors.forEach(error => {
            const text = error.message || error;
            const words = text.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+/g) || [];

            words.forEach(word => {
                if (word.length > 1 && !stopWords.includes(word)) {
                    keywords.add(word);
                }
            });
        });

        return Array.from(keywords);
    }

    assessSeverity(errors, retryCount) {
        if (retryCount >= 3) return 'CRITICAL';
        if (errors.some(e => (e.severity || '').toLowerCase() === 'high')) return 'HIGH';
        if (errors.length > 5) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * 產生人類可讀的報告（Markdown 格式）
     */
    formatMarkdown(report) {
        const lines = [];

        lines.push(`# Code Review Report`);
        lines.push(``);
        lines.push(`**階段**: ${report.metadata.phase}`);
        lines.push(`**時間**: ${report.metadata.timestamp}`);
        lines.push(`**失敗次數**: ${report.metadata.retryCount}`);
        lines.push(`**嚴重程度**: ${report.ragData.severity}`);
        lines.push(``);
        lines.push(`---`);
        lines.push(``);

        // 錯誤分析
        lines.push(`## 🔍 錯誤分析`);
        lines.push(``);

        if (report.analysis.commonPatterns.length > 0) {
            lines.push(`### 常見錯誤模式`);
            report.analysis.commonPatterns.forEach(pattern => {
                lines.push(`- ${pattern.pattern} (信心度: ${pattern.confidence})`);
            });
            lines.push(``);
        }

        if (report.analysis.detectedErrors.length > 0) {
            lines.push(`### 偵測到的錯誤`);
            report.analysis.detectedErrors.forEach((error, idx) => {
                lines.push(`${idx + 1}. **${error.type}**: ${error.message}`);
                if (error.location !== 'unknown') {
                    lines.push(`   - 位置: \`${error.location}\``);
                }
            });
            lines.push(``);
        }

        // 建議行動
        lines.push(`## 💡 建議行動`);
        lines.push(``);

        if (report.recommendations.immediate.length > 0) {
            lines.push(`### 立即修正`);
            report.recommendations.immediate.forEach((action, idx) => {
                lines.push(`${idx + 1}. ${action.action} - \`${action.target}\` (優先級: ${action.priority})`);
            });
            lines.push(``);
        }

        lines.push(`### 預防措施`);
        report.recommendations.preventive.forEach((action, idx) => {
            lines.push(`${idx + 1}. ${action}`);
        });
        lines.push(``);

        // 參考資料
        lines.push(`## 📚 參考資料`);
        lines.push(``);
        report.recommendations.references.forEach(ref => {
            lines.push(`- ${ref}`);
        });
        lines.push(``);

        lines.push(`---`);
        lines.push(``);
        lines.push(`**審查重點**: ${report.analysis.reviewFocus.join(', ')}`);

        return lines.join('\n');
    }
}

// ============================================
// 導出
// ============================================

module.exports = {
    SimpleCodeReviewer,
    PHASE_PROFILES
};
