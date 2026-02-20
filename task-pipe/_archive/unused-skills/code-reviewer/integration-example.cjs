/**
 * 通用階段失敗處理（含自動修正）
 * 支援所有 Pipeline 階段
 */

const fs = require('fs');
const path = require('path');
const { RetryTracker } = require('../../skills/code-reviewer/retry-tracker.cjs');
const { SimpleCodeReviewer } = require('../../skills/code-reviewer/index.cjs');
const { AutoFixerFactory } = require('../../skills/code-reviewer/fixers');

/**
 * 通用階段失敗處理流程（含自動修正）
 * 
 * @param {Object} options - 選項
 * @param {string} options.phase - 階段 (POC, PLAN, BUILD)
 * @param {string} options.step - 步驟
 * @param {string} options.target - 專案目錄
 * @param {string} options.iteration - 迭代
 * @param {string} options.story - Story ID (可選)
 * @param {Array} options.errors - 錯誤列表
 * @param {boolean} options.autoFix - 是否自動修正
 */
async function handlePhaseFailure(options) {
    const { phase, step, target, iteration, story, errors, autoFix = false } = options;

    const phaseKey = `${phase.toLowerCase()}-${step}`;

    // 1. 追蹤失敗次數
    const tracker = new RetryTracker(target, iteration, story || 'main', phaseKey);
    const retryState = tracker.increment(errors);

    // 前 2 次失敗：只提供錯誤訊息
    if (!retryState.shouldReview) {
        return {
            verdict: 'PENDING',
            retryCount: retryState.context.retries,
            message: `第 ${retryState.context.retries} 次失敗，請修正後重試`
        };
    }

    // 第 3 次失敗：啟動 Code Review
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 CODE REVIEW ACTIVATED (失敗 ${retryState.context.retries} 次)`);
    console.log(`   階段: ${phase} Step ${step}`);
    console.log(`${'='.repeat(60)}\n`);

    // 2. 產生 Code Review 報告
    const reviewer = new SimpleCodeReviewer(phase.toLowerCase(), step);
    const reviewReport = reviewer.generateReport({
        errors: errors,
        retryCount: retryState.context.retries,
        timestamp: retryState.context.lastFailure
    });

    // 3. 檢查是否支援自動修正
    const isFixerSupported = AutoFixerFactory.isSupported(phase, step);

    let fixPlan = null;
    let fixResults = null;
    let fixer = null;

    if (isFixerSupported) {
        // 建立對應的 Fixer
        fixer = AutoFixerFactory.create(phase, step, { target, dryRun: !autoFix });

        // 產生修正計畫
        fixPlan = fixer.generateFixPlan(reviewReport);

        console.log(`📋 修正計畫:`);
        console.log(`   - 總修正項目: ${fixPlan.totalFixes}`);
        console.log(`   - 可自動修正: ${fixPlan.fixes.filter(f => f.autoFixable).length}`);
        console.log(`   - 需人工修正: ${fixPlan.fixes.filter(f => !f.autoFixable).length}`);
        console.log(`   - 預估時間: ${fixPlan.estimatedTime.total}\n`);

        // 4. 執行自動修正（如果啟用）
        if (autoFix && fixPlan.fixes.some(f => f.autoFixable)) {
            console.log(`🔧 執行自動修正...\n`);
            fixResults = await fixer.applyFixes(fixPlan);

            console.log(`✅ 自動修正完成:`);
            console.log(`   - 成功: ${fixResults.success}`);
            console.log(`   - 失敗: ${fixResults.failed}`);
            console.log(`   - 跳過: ${fixResults.skipped}\n`);
        } else if (!autoFix) {
            console.log(`🔍 DRY RUN 模式（不會實際修改檔案）\n`);
            fixResults = await fixer.applyFixes(fixPlan);
        }
    } else {
        console.log(`⚠️ ${phase} Step ${step} 尚未支援自動修正\n`);
    }

    // 5. 儲存報告
    const reportDir = path.join(target, `.gems/iterations/${iteration}/build`);
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    // Code Review 報告
    const storyPart = story ? `_${story}` : '';
    const reviewPath = path.join(reportDir, `code_review${storyPart}_${phaseKey}.md`);
    const reviewJson = path.join(reportDir, `code_review${storyPart}_${phaseKey}.json`);
    fs.writeFileSync(reviewPath, reviewer.formatMarkdown(reviewReport));
    fs.writeFileSync(reviewJson, JSON.stringify(reviewReport, null, 2));

    // 修正報告（如果有）
    if (fixPlan && fixer) {
        const fixPath = path.join(reportDir, `auto_fix${storyPart}_${phaseKey}.md`);
        const fixJson = path.join(reportDir, `auto_fix${storyPart}_${phaseKey}.json`);
        fs.writeFileSync(fixPath, fixer.generateFixReport(fixPlan, fixResults));
        fs.writeFileSync(fixJson, JSON.stringify({ fixPlan, fixResults }, null, 2));

        console.log(`📄 報告已產生:`);
        console.log(`   - Code Review: ${reviewPath}`);
        console.log(`   - 修正計畫: ${fixPath}\n`);
    } else {
        console.log(`📄 報告已產生:`);
        console.log(`   - Code Review: ${reviewPath}\n`);
    }

    // 6. 決定下一步
    if (autoFix && fixResults && fixResults.success > 0) {
        console.log(`✅ 已自動修正 ${fixResults.success} 個問題`);
        console.log(`\n@NEXT_STEP`);
        console.log(`重新執行: node task-pipe/runner.cjs --phase=${phase} --step=${step}${story ? ` --story=${story}` : ''}\n`);

        return {
            verdict: 'AUTO_FIXED',
            fixResults: fixResults,
            reviewReport: reviewReport
        };
    } else {
        console.log(`@TASK`);
        console.log(`請查看報告並修正問題:`);
        console.log(`1. 查看 Code Review: ${reviewPath}`);
        if (fixPlan) {
            console.log(`2. 查看修正計畫: ${path.join(reportDir, `auto_fix${storyPart}_${phaseKey}.md`)}`);
        }

        if (fixPlan && fixPlan.fixes.some(f => f.autoFixable)) {
            console.log(`\n💡 提示: 可以啟用自動修正:`);
            console.log(`   --auto-fix 參數會自動修正可修正的問題\n`);
        }

        console.log(`修正後重新執行: node task-pipe/runner.cjs --phase=${phase} --step=${step}${story ? ` --story=${story}` : ''}\n`);

        return {
            verdict: 'NEEDS_REVIEW',
            reviewReport: reviewReport,
            fixPlan: fixPlan
        };
    }
}

module.exports = {
    handlePhaseFailure
};
