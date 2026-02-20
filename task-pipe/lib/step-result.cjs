#!/usr/bin/env node
/**
 * Step Result Writer - 統一的步驟結果寫入工具
 * 
 * 每個 step 執行完後呼叫此工具，將結果寫入 .gems/last_step_result.json
 * 這讓 loop.cjs 可以可靠地讀取 verdict，而不是解析 console 輸出
 */

const fs = require('fs');
const path = require('path');

/**
 * 寫入步驟結果
 * @param {string} projectPath - 專案路徑
 * @param {object} result - 結果物件
 * @param {string} result.phase - 階段 (POC/PLAN/BUILD/SCAN)
 * @param {string} result.step - 步驟 (0/0.5/1/2/...)
 * @param {string} result.verdict - 判定 (PASS/PENDING/BLOCKER)
 * @param {string} [result.message] - 訊息
 * @param {boolean} [result.needsFix] - 是否需要修復
 * @param {string[]} [result.fixHints] - 修復提示
 */
function writeStepResult(projectPath, result) {
    const gemsPath = path.join(projectPath, '.gems');

    if (!fs.existsSync(gemsPath)) {
        fs.mkdirSync(gemsPath, { recursive: true });
    }

    const resultPath = path.join(gemsPath, 'last_step_result.json');

    const data = {
        phase: result.phase,
        step: String(result.step),
        verdict: result.verdict,
        timestamp: new Date().toISOString(),
        message: result.message || '',
        needsFix: result.needsFix || (result.verdict !== 'PASS'),
        fixHints: result.fixHints || [],
    };

    fs.writeFileSync(resultPath, JSON.stringify(data, null, 2), 'utf-8');

    return data;
}

/**
 * 讀取上一個步驟結果
 * @param {string} projectPath - 專案路徑
 * @returns {object|null} 結果物件或 null
 */
function readStepResult(projectPath) {
    const resultPath = path.join(projectPath, '.gems', 'last_step_result.json');

    if (!fs.existsSync(resultPath)) {
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
    } catch (e) {
        return null;
    }
}

/**
 * 清除步驟結果（當步驟成功完成整個 phase 時）
 */
function clearStepResult(projectPath) {
    const resultPath = path.join(projectPath, '.gems', 'last_step_result.json');

    if (fs.existsSync(resultPath)) {
        fs.unlinkSync(resultPath);
    }
}

module.exports = {
    writeStepResult,
    readStepResult,
    clearStepResult,
};
