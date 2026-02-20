#!/usr/bin/env node
/**
 * Phase Registry Loader v1.0
 * 
 * 提供統一介面讀取 phase-registry.json
 * 所有需要 phase 資訊的模組都應該從這裡取得
 */
const fs = require('fs');
const path = require('path');

// Registry 快取
let registryCache = null;

/**
 * 載入 Phase Registry
 * @returns {object} Registry 物件
 */
function loadRegistry() {
    if (registryCache) return registryCache;

    const registryPath = path.join(__dirname, '..', '..', 'phase-registry.json');

    if (!fs.existsSync(registryPath)) {
        throw new Error(`Phase Registry not found: ${registryPath}`);
    }

    try {
        registryCache = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        return registryCache;
    } catch (err) {
        throw new Error(`Failed to parse Phase Registry: ${err.message}`);
    }
}

/**
 * 取得指定階段的所有步驟定義
 * @param {string} phase - POC, PLAN, BUILD, SCAN
 * @returns {object} 步驟定義
 */
function getPhaseDefinitions(phase) {
    const registry = loadRegistry();
    return registry[phase]?.definitions || {};
}

/**
 * 取得指定步驟的定義
 * @param {string} phase - POC, PLAN, BUILD, SCAN
 * @param {string} step - 步驟編號
 * @returns {object|null} 步驟定義
 */
function getStepDefinition(phase, step) {
    const defs = getPhaseDefinitions(phase);
    return defs[step] || null;
}

/**
 * 取得指定 Level 的 BUILD phases
 * @param {string} level - S, M, L
 * @returns {string[]} Phase 列表
 */
function getBuildPhasesForLevel(level) {
    const registry = loadRegistry();
    return registry.levelPhases?.[level.toUpperCase()] || registry.levelPhases?.M || [];
}

/**
 * 取得所有可能的 BUILD phases
 * @returns {string[]} 所有 Phase 列表
 */
function getAllBuildPhases() {
    const registry = loadRegistry();
    return registry.BUILD?.phases || [];
}

/**
 * 取得完整流程順序
 * @returns {Array<{phase: string, step: string}>} 流程順序
 */
function getFlowSequence() {
    const registry = loadRegistry();
    return registry.flowSequence || [];
}

/**
 * 取得指定 Level 的流程順序 (過濾 BUILD phases)
 * @param {string} level - S, M, L
 * @returns {Array<{phase: string, step: string}>} 過濾後的流程順序
 */
function getFlowSequenceForLevel(level) {
    const registry = loadRegistry();
    const fullSequence = registry.flowSequence || [];
    const buildPhases = getBuildPhasesForLevel(level);

    return fullSequence.filter(item => {
        if (item.phase !== 'BUILD') return true;
        return buildPhases.includes(item.step);
    });
}

/**
 * 取得下一個步驟
 * @param {string} phase - 當前階段
 * @param {string} step - 當前步驟
 * @param {string} level - Level (S/M/L)
 * @returns {object|null} 下一步驟 {phase, step}
 */
function getNextStep(phase, step, level = 'M') {
    const sequence = getFlowSequenceForLevel(level);
    const currentIndex = sequence.findIndex(
        s => s.phase === phase && s.step === step
    );

    if (currentIndex === -1 || currentIndex >= sequence.length - 1) {
        return null;
    }

    return sequence[currentIndex + 1];
}

/**
 * 檢查指定 phase 是否應該在此 Level 執行
 * @param {string} phase - 階段
 * @param {string} step - 步驟
 * @param {string} level - Level (S/M/L)
 * @returns {boolean}
 */
function shouldExecuteStep(phase, step, level = 'M') {
    if (phase !== 'BUILD') return true;

    const buildPhases = getBuildPhasesForLevel(level);
    return buildPhases.includes(step);
}

/**
 * 取得 dry-run 時顯示的 actions
 * @param {string} phase - 階段
 * @param {string} step - 步驟
 * @returns {string[]} Action 列表
 */
function getStepActions(phase, step) {
    const def = getStepDefinition(phase, step);
    return def?.actions || ['Execute phase script'];
}

/**
 * 取得步驟的前綴 (step 或 phase)
 * @param {string} phase - 階段
 * @returns {string} 前綴
 */
function getStepPrefix(phase) {
    const registry = loadRegistry();
    return registry[phase]?.prefix || 'step';
}

/**
 * 取得步驟的腳本檔案名稱
 * @param {string} phase - 階段
 * @param {string} step - 步驟
 * @returns {string} 檔案名稱
 */
function getStepFile(phase, step) {
    const def = getStepDefinition(phase, step);
    if (def?.file) return def.file;

    const prefix = getStepPrefix(phase);
    return `${prefix}-${step}.cjs`;
}

/**
 * 檢查步驟是否已廢棄
 * @param {string} phase - 階段
 * @param {string} step - 步驟
 * @returns {boolean}
 */
function isStepDeprecated(phase, step) {
    const def = getStepDefinition(phase, step);
    return def?.deprecated === true;
}

/**
 * 取得廢棄原因
 * @param {string} phase - 階段
 * @param {string} step - 步驟
 * @returns {string|null}
 */
function getDeprecatedReason(phase, step) {
    const def = getStepDefinition(phase, step);
    return def?.deprecatedReason || null;
}

/**
 * 清除快取 (用於測試)
 */
function clearCache() {
    registryCache = null;
}

/**
 * 取得各 Phase 的步驟列表 (供 loop.cjs 使用)
 * @param {string} level - S, M, L
 * @returns {object} { POC: [...], PLAN: [...], BUILD: [...], SCAN: [...] }
 */
function getPhaseSteps(level = 'M') {
    const registry = loadRegistry();
    return {
        POC: registry.POC?.steps || ['1', '2', '3', '4', '5'],
        PLAN: registry.PLAN?.steps || ['1', '2', '3', '4', '5'],
        BUILD: getBuildPhasesForLevel(level),
        SCAN: [null]
    };
}

/**
 * 產生下一步指令
 * @param {string} phase - 當前階段
 * @param {string} step - 當前步驟
 * @param {string} story - Story ID
 * @param {string} level - Level (S/M/L)
 * @returns {string} 下一步指令
 */
function getNextCommand(phase, step, story, level = 'M') {
    const next = getNextStep(phase, step, level);

    if (!next) {
        // 已是最後一步，如果是 BUILD 完成則進 SCAN
        if (phase === 'BUILD') {
            return `node task-pipe/runner.cjs --phase=SCAN`;
        }
        return null;
    }

    let cmd = `node task-pipe/runner.cjs --phase=${next.phase} --step=${next.step}`;

    // BUILD 和部分 PLAN 步驟需要 --story
    if (next.phase === 'BUILD' || (next.phase === 'PLAN' && next.step !== '1')) {
        if (story) {
            cmd += ` --story=${story}`;
        }
    }

    return cmd;
}

/**
 * 產生重試指令 (失敗時使用)
 * @param {string} phase - 當前階段
 * @param {string} step - 當前步驟
 * @param {string} story - Story ID
 * @returns {string} 重試指令
 */
function getRetryCommand(phase, step, story) {
    let cmd = `node task-pipe/runner.cjs --phase=${phase} --step=${step}`;
    if (story && (phase === 'BUILD' || (phase === 'PLAN' && step !== '1'))) {
        cmd += ` --story=${story}`;
    }
    return cmd;
}

module.exports = {
    loadRegistry,
    getPhaseDefinitions,
    getStepDefinition,
    getBuildPhasesForLevel,
    getAllBuildPhases,
    getFlowSequence,
    getFlowSequenceForLevel,
    getNextStep,
    shouldExecuteStep,
    getStepActions,
    getStepPrefix,
    getStepFile,
    isStepDeprecated,
    getDeprecatedReason,
    clearCache,
    // v2.0 新增
    getPhaseSteps,
    getNextCommand,
    getRetryCommand
};
