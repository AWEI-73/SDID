/**
 * POC Step 0 Auto Fixer
 * 自動補充需求描述和功能模組
 */

const { BaseAutoFixer } = require('./base-fixer.cjs');

class PocStep0Fixer extends BaseAutoFixer {
    constructor(options) {
        super({ ...options, phase: 'POC', step: '0' });
    }

    /**
     * 產生修正計畫
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
            canAutoFix: fixes.some(f => f.autoFixable)
        };
    }

    /**
     * 建立修正計畫
     */
    createFix(error) {
        const { message } = error;

        if (message.includes('功能模組未勾選')) {
            return {
                type: 'CHECK_MODULE',
                target: 'requirement_draft',
                autoFixable: false,
                action: 'manual',
                suggestion: '請在 requirement_draft 中勾選至少 2 個功能模組（包含基礎建設）'
            };
        }

        if (message.includes('需求描述為空')) {
            return {
                type: 'ADD_DESCRIPTION',
                target: 'requirement_draft',
                autoFixable: true,
                action: 'fillTemplate',
                template: '請描述你的需求...'
            };
        }

        if (message.includes('缺使用者角色')) {
            return {
                type: 'ADD_USER_ROLE',
                target: 'requirement_draft',
                autoFixable: true,
                action: 'checkItem',
                section: '釐清項目',
                item: '使用者角色'
            };
        }

        return null;
    }

    /**
     * 執行修正
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
                        message: `[DRY RUN] 會修正 ${fix.target}: ${fix.type}`
                    });
                } else {
                    await this.applyFix(fix);
                    results.push({
                        fix: fix,
                        status: 'SUCCESS',
                        message: `已修正 ${fix.target}`
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
        const draftPath = '.gems/iterations/iter-1/poc/requirement_draft_iter-1.md';
        const content = this.readFile(draftPath);
        let lines = content.split('\n');

        if (fix.action === 'checkItem') {
            // 將 [ ] 改為 [x]
            lines = lines.map(line => {
                if (line.includes(fix.item) && line.includes('[ ]')) {
                    return line.replace('[ ]', '[x]');
                }
                return line;
            });

            this.writeFile(draftPath, lines.join('\n'));
        }

        if (fix.action === 'fillTemplate') {
            // 在需求描述區塊填入模板
            const descIndex = lines.findIndex(l => l.includes('## 需求描述'));
            if (descIndex !== -1) {
                lines.splice(descIndex + 1, 0, fix.template);
                this.writeFile(draftPath, lines.join('\n'));
            }
        }
    }
}

module.exports = { PocStep0Fixer };
