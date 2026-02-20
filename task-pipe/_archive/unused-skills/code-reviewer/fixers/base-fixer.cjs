/**
 * Base Auto Fixer
 * 所有階段 Fixer 的基礎類別
 */

const fs = require('fs');
const path = require('path');

class BaseAutoFixer {
    constructor(options) {
        this.target = options.target;
        this.dryRun = options.dryRun || false;
        this.phase = options.phase;
        this.step = options.step;
    }

    /**
     * 產生修正計畫（子類別必須實作）
     * @param {Object} reviewReport - Code Review 報告
     * @returns {Object} 修正計畫
     */
    generateFixPlan(reviewReport) {
        throw new Error('子類別必須實作 generateFixPlan()');
    }

    /**
     * 執行修正（子類別必須實作）
     * @param {Object} fixPlan - 修正計畫
     * @returns {Object} 修正結果
     */
    async applyFixes(fixPlan) {
        throw new Error('子類別必須實作 applyFixes()');
    }

    /**
     * 產生修正報告
     */
    generateFixReport(fixPlan, results) {
        const lines = [];

        lines.push(`# Auto Fix Report - ${this.phase}${this.step ? ` Step ${this.step}` : ''}\n`);
        lines.push(`**時間**: ${new Date().toISOString()}`);
        lines.push(`**總修正項目**: ${fixPlan.totalFixes}`);
        lines.push(`**可自動修正**: ${fixPlan.fixes.filter(f => f.autoFixable).length}`);
        lines.push(`**需人工修正**: ${fixPlan.fixes.filter(f => !f.autoFixable).length}\n`);

        if (results) {
            lines.push(`## 執行結果\n`);
            lines.push(`- ✅ 成功: ${results.success}`);
            lines.push(`- ❌ 失敗: ${results.failed}`);
            lines.push(`- ⏭️ 跳過: ${results.skipped}\n`);
        }

        lines.push(`## 修正項目\n`);

        for (const fix of fixPlan.fixes) {
            const result = results?.results.find(r => r.fix === fix);
            const status = result ? this.getStatusIcon(result.status) : '⏳';

            lines.push(`### ${status} ${fix.type} - ${fix.file || fix.target}\n`);

            if (fix.autoFixable) {
                lines.push(`**動作**: 自動修正`);
                if (fix.template) {
                    lines.push(`**內容**: \`${fix.template}\``);
                }
                lines.push(``);
            } else {
                lines.push(`**動作**: 需人工修正`);
                lines.push(`**建議**: ${fix.suggestion}\n`);
            }

            if (result && result.status === 'FAILED') {
                lines.push(`**錯誤**: ${result.error}\n`);
            }
        }

        return lines.join('\n');
    }

    getStatusIcon(status) {
        const icons = {
            'SUCCESS': '✅',
            'FAILED': '❌',
            'SKIPPED': '⏭️',
            'DRY_RUN': '🔍'
        };
        return icons[status] || '❓';
    }

    /**
     * 估算修正時間
     */
    estimateTime(fixes) {
        const autoFixCount = fixes.filter(f => f.autoFixable).length;
        const manualFixCount = fixes.length - autoFixCount;

        return {
            auto: `${autoFixCount * 0.1} 分鐘`,
            manual: `${manualFixCount * 5} 分鐘`,
            total: `${autoFixCount * 0.1 + manualFixCount * 5} 分鐘`
        };
    }

    /**
     * 讀取檔案
     */
    readFile(filePath) {
        const fullPath = path.join(this.target, filePath);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`檔案不存在: ${fullPath}`);
        }
        return fs.readFileSync(fullPath, 'utf8');
    }

    /**
     * 寫入檔案
     */
    writeFile(filePath, content) {
        const fullPath = path.join(this.target, filePath);
        const dir = path.dirname(fullPath);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(fullPath, content);
    }
}

module.exports = { BaseAutoFixer };
