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
const FALLBACK_BUILD_ORDER = {
    'S': ['1', '2', '8'],
    'M': ['1', '2', '3', '4', '5', '7', '8'],
    'L': ['1', '2', '3', '4', '5', '6', '7', '8']
};

const FALLBACK_POC_ORDER = ['0', '0.5', '1', '2', '3'];
const FALLBACK_PLAN_ORDER = ['1', '2', '2.5', '2.6', '3'];

/**
 * 取得下一步指令
 * @param {string} phase - 當前階段 (BUILD, POC, PLAN)
 * @param {string} step - 當前步驟
 * @param {object} options - { story, level, target }
 * @returns {string} 下一步指令
 */
function getNextCmd(phase, step, options = {}) {
    const { story, level = 'M', target } = options;

    if (registryLoader) {
        try {
            return registryLoader.getNextCommand(phase, step, story, level);
        } catch (e) {
            // Fallback
        }
    }

    // Fallback 邏輯
    let order;
    if (phase === 'BUILD') {
        order = FALLBACK_BUILD_ORDER[level] || FALLBACK_BUILD_ORDER['M'];
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
        if (phase === 'BUILD') {
            return `node task-pipe/runner.cjs --phase=SCAN`;
        } else if (phase === 'POC') {
            return `node task-pipe/runner.cjs --phase=PLAN --step=1`;
        } else if (phase === 'PLAN') {
            return story
                ? `node task-pipe/runner.cjs --phase=BUILD --step=1 --story=${story}`
                : `node task-pipe/runner.cjs --phase=BUILD --step=1`;
        }
        return null;
    }

    const nextStep = order[currentIndex + 1];
    let cmd = `node task-pipe/runner.cjs --phase=${phase} --step=${nextStep}`;

    // 添加 story 參數
    if (story && (phase === 'BUILD' || (phase === 'PLAN' && nextStep !== '1'))) {
        cmd += ` --story=${story}`;
    }

    // 添加 target 參數
    if (target && phase === 'POC') {
        cmd += ` --target=${target}`;
    }

    return cmd;
}

/**
 * 取得重試指令
 * @param {string} phase - 當前階段
 * @param {string} step - 當前步驟
 * @param {object} options - { story, target }
 * @returns {string} 重試指令
 */
function getRetryCmd(phase, step, options = {}) {
    const { story, target } = options;

    if (registryLoader) {
        try {
            return registryLoader.getRetryCommand(phase, step, story);
        } catch (e) {
            // Fallback
        }
    }

    let cmd = `node task-pipe/runner.cjs --phase=${phase} --step=${step}`;

    if (story && (phase === 'BUILD' || (phase === 'PLAN' && step !== '1'))) {
        cmd += ` --story=${story}`;
    }

    if (target) {
        cmd += ` --target=${target}`;
    }

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
