/**
 * Auto Fixer - 向後兼容層
 * 
 * 注意：此檔案已棄用，請使用 fixers/index.cjs 的 AutoFixerFactory
 * 保留此檔案是為了向後兼容
 */

const { AutoFixerFactory } = require('./fixers');

// 向後兼容：GemsTagAutoFixer = BuildPhase4Fixer
class GemsTagAutoFixer {
    constructor(options) {
        console.warn('[DEPRECATED] GemsTagAutoFixer 已棄用，請使用 AutoFixerFactory.create("BUILD", "4", options)');
        this.fixer = AutoFixerFactory.create('BUILD', '4', options);
    }

    generateFixPlan(reviewReport) {
        return this.fixer.generateFixPlan(reviewReport);
    }

    async applyFixes(fixPlan) {
        return this.fixer.applyFixes(fixPlan);
    }

    generateFixReport(fixPlan, results) {
        return this.fixer.generateFixReport(fixPlan, results);
    }
}

module.exports = { GemsTagAutoFixer };
