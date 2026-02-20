/**
 * BUILD Phase 4 Auto Fixer
 * 專門處理 GEMS 標籤問題的自動修正
 */

const { BaseAutoFixer } = require('./base-fixer.cjs');

class BuildPhase4Fixer extends BaseAutoFixer {
    constructor(options) {
        super({ ...options, phase: 'BUILD', step: '4' });
    }

    /**
     * 根據 Code Review 報告產生修正計畫
     */
    generateFixPlan(reviewReport) {
        const fixes = [];

        for (const error of reviewReport.analysis.detectedErrors) {
            const fix = this.createFix(error);
            if (fix) {
                fixes.push(fix);
            }
        }

        return {
            totalFixes: fixes.length,
            fixes: fixes,
            estimatedTime: this.estimateTime(fixes),
            canAutoFix: fixes.every(f => f.autoFixable)
        };
    }

    /**
     * 根據錯誤類型建立修正計畫
     */
    createFix(error) {
        const { type, message, location } = error;

        // 解析檔案和行號
        const [file, line] = (location || '').split(':');

        if (!file) return null;

        switch (type) {
            case 'MISSING_CONTENT':
            case 'TAG_ERROR':
                if (message.includes('GEMS-DEPS') && !message.includes('RISK')) {
                    return {
                        type: 'ADD_TAG',
                        file: file,
                        line: parseInt(line) || 0,
                        tag: 'GEMS-DEPS',
                        template: ' * GEMS-DEPS: [Internal.helper (說明)]',
                        autoFixable: true,
                        action: 'insertLine'
                    };
                }
                if (message.includes('GEMS-FLOW')) {
                    return {
                        type: 'ADD_TAG',
                        file: file,
                        line: parseInt(line) || 0,
                        tag: 'GEMS-FLOW',
                        template: ' * GEMS-FLOW: Step1→Step2→Result',
                        autoFixable: true,
                        action: 'insertLine'
                    };
                }
                if (message.includes('GEMS-DEPS-RISK')) {
                    return {
                        type: 'ADD_TAG',
                        file: file,
                        line: parseInt(line) || 0,
                        tag: 'GEMS-DEPS-RISK',
                        template: ' * GEMS-DEPS-RISK: LOW',
                        autoFixable: true,
                        action: 'insertLine'
                    };
                }
                if (message.includes('GEMS-TEST') && !message.includes('FILE')) {
                    return {
                        type: 'ADD_TAG',
                        file: file,
                        line: parseInt(line) || 0,
                        tag: 'GEMS-TEST',
                        template: ' * GEMS-TEST: ✓ Unit | - Integration | - E2E',
                        autoFixable: true,
                        action: 'insertLine'
                    };
                }
                if (message.includes('GEMS-TEST-FILE')) {
                    return {
                        type: 'ADD_TAG',
                        file: file,
                        line: parseInt(line) || 0,
                        tag: 'GEMS-TEST-FILE',
                        template: ' * GEMS-TEST-FILE: functionName.test.ts',
                        autoFixable: true,
                        action: 'insertLine'
                    };
                }
                if (message.includes('[STEP]')) {
                    return {
                        type: 'ADD_STEP_ANCHOR',
                        file: file,
                        line: parseInt(line) || 0,
                        autoFixable: false,
                        action: 'manual',
                        suggestion: '在程式碼中加入 // [STEP] StepName 註解，對應 GEMS-FLOW 的步驟'
                    };
                }
                break;
        }

        return null;
    }

    /**
     * 執行自動修正
     */
    async applyFixes(fixPlan) {
        const results = [];

        for (const fix of fixPlan.fixes) {
            if (!fix.autoFixable) {
                results.push({
                    fix: fix,
                    status: 'SKIPPED',
                    reason: '需要人工修正'
                });
                continue;
            }

            try {
                if (this.dryRun) {
                    results.push({
                        fix: fix,
                        status: 'DRY_RUN',
                        message: `[DRY RUN] 會在 ${fix.file}:${fix.line} 插入: ${fix.template}`
                    });
                } else {
                    await this.applyFix(fix);
                    results.push({
                        fix: fix,
                        status: 'SUCCESS',
                        message: `已修正 ${fix.file}:${fix.line}`
                    });
                }
            } catch (error) {
                results.push({
                    fix: fix,
                    status: 'FAILED',
                    error: error.message
                });
            }
        }

        return {
            total: results.length,
            success: results.filter(r => r.status === 'SUCCESS').length,
            failed: results.filter(r => r.status === 'FAILED').length,
            skipped: results.filter(r => r.status === 'SKIPPED').length,
            results: results
        };
    }

    /**
     * 執行單個修正
     */
    async applyFix(fix) {
        const content = this.readFile(fix.file);
        const lines = content.split('\n');

        if (fix.action === 'insertLine') {
            const targetLine = fix.line - 1; // 0-indexed

            // 找到註解區塊的結束位置
            let insertPos = targetLine;
            for (let i = targetLine - 1; i >= 0; i--) {
                const trimmed = lines[i].trim();
                if (trimmed.startsWith('*') && !trimmed.startsWith('*/')) {
                    insertPos = i + 1;
                    break;
                }
                if (trimmed.startsWith('/**')) {
                    insertPos = i + 1;
                    break;
                }
            }

            // 插入新標籤
            lines.splice(insertPos, 0, fix.template);

            // 寫回檔案
            this.writeFile(fix.file, lines.join('\n'));
        }
    }
}

module.exports = { BuildPhase4Fixer };
