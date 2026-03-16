#!/usr/bin/env node
/**
 * Next Command Helper
 * 
 * 提供 phase 腳本使用的動態指令產生函式
 * 透過 phase-registry 取得正確的下一步
 */
const path = require('path');

// 嘗試載入 registry loader
let registryLoader = null;
try {
    registryLoader = require('./phase-registry-loader.cjs');
} catch (e) {
    // Fallback 模式
}

// Fallback 定義 (當 registry 無法載入時使用)
// S/M/L level 已廢棄，BUILD 固定跑 Phase 1-4，Phase 3 由 story type 決定是否跳過
const FALLBACK_BUILD_ORDER = ['1', '2', '3', '4'];

const FALLBACK_POC_ORDER = ['0', '0.5', '1', '2', '3'];
const FALLBACK_PLAN_ORDER = ['1', '2', '2.5', '2.6', '3'];

/**
 * 取得下一步指令
 * @param {string} phase - 當前階段 (BUILD, POC, PLAN)
 * @param {string} step - 當前步驟
 * @param {object} options - { story, level, target, iteration }
 * @returns {string} 下一步指令
 */
function getNextCmd(phase, step, options = {}) {
    const { story, level = 'M', target, iteration } = options;

    if (registryLoader) {
        try {
            const cmd = registryLoader.getNextCommand(phase, step, story, level);
            if (cmd) return appendTargetIteration(cmd, target, iteration);
        } catch (e) {
            // Fallback
        }
    }

    // Fallback 邏輯
    let order;
    if (phase === 'BUILD') {
        order = FALLBACK_BUILD_ORDER; // 固定 1→2→3→4，Phase 3 由 runner 的 story type 判斷是否跳過
    } else if (phase === 'POC') {
        order = FALLBACK_POC_ORDER;
    } else if (phase === 'PLAN') {
        order = FALLBACK_PLAN_ORDER;
    } else {
        return null;
    }

    const currentIndex = order.indexOf(step);
    if (currentIndex === -1 || currentIndex >= order.length - 1) {
        // 最後一步
        let cmd;
        if (phase === 'BUILD') {
            cmd = `node task-pipe/runner.cjs --phase=SCAN`;
        } else if (phase === 'POC') {
            // Task-Pipe 路線：POC Step 5 pass 後直接機械轉換，跳過 PLAN 步驟
            const t = target ? ` --target=${target}` : '';
            const it = iteration ? ` --iteration=${iteration}` : '';
            return `node task-pipe/tools/spec-to-plan.cjs${t}${it}`;
        } else if (phase === 'PLAN') {
            cmd = story
                ? `node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${story}`
                : `node task-pipe/runner.cjs --phase=BUILD --step=1`;
        } else {
            return null;
        }
        return appendTargetIteration(cmd, target, iteration);
    }

    const nextStep = order[currentIndex + 1];
    let cmd = `node task-pipe/runner.cjs --phase=${phase} --step=${nextStep}`;

    // 添加 story 參數
    if (story && (phase === 'BUILD' || (phase === 'PLAN' && nextStep !== '1'))) {
        cmd += ` --story=${story}`;
    }

    return appendTargetIteration(cmd, target, iteration);
}

/**
 * 取得重試指令
 * @param {string} phase - 當前階段
 * @param {string} step - 當前步驟
 * @param {object} options - { story, target, iteration }
 * @returns {string} 重試指令
 */
function getRetryCmd(phase, step, options = {}) {
    const { story, target, iteration } = options;

    if (registryLoader) {
        try {
            const cmd = registryLoader.getRetryCommand(phase, step, story);
            if (cmd) return appendTargetIteration(cmd, target, iteration);
        } catch (e) {
            // Fallback
        }
    }

    let cmd = `node task-pipe/runner.cjs --phase=${phase} --step=${step}`;

    if (story && (phase === 'BUILD' || (phase === 'PLAN' && step !== '1'))) {
        cmd += ` --story=${story}`;
    }

    return appendTargetIteration(cmd, target, iteration);
}

/**
 * 附加 --target 和 --iteration 到指令（如果有提供）
 * @param {string} cmd - 基礎指令
 * @param {string} target - 目標路徑
 * @param {string} iteration - 迭代名稱 (e.g. iter-1)
 * @returns {string}
 */
function appendTargetIteration(cmd, target, iteration) {
    if (target) cmd += ` --target=${target}`;
    if (iteration && iteration !== 'iter-1') cmd += ` --iteration=${iteration}`;
    return cmd;
}

/**
 * 取得帶 --pass 的確認指令 (用於 Phase 6 等需要手動確認的步驟)
 * @param {string} phase - 當前階段
 * @param {string} step - 當前步驟
 * @param {object} options - { story, target }
 * @returns {string} 確認指令
 */
function getPassCmd(phase, step, options = {}) {
    return getRetryCmd(phase, step, options) + ' --pass';
}

module.exports = {
    getNextCmd,
    getRetryCmd,
    getPassCmd
};
