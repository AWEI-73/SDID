#!/usr/bin/env node
/**
 * Scaffold Module - 骨架產生器模組
 * 
 * 在驗證前自動產出符合 GEMS 標籤規範的骨架檔案
 * 
 * 使用方式:
 * const { generateScaffold, ensureScaffold, SCAFFOLD_TYPES } = require('./lib/scaffold');
 */

const {
    generateScaffold,
    validateScaffold,
    extractContextFromDraft,
    extractStoriesFromSpec,
    scaffoldGenerators,
    SCAFFOLD_TYPES,
    POC_SPEC_REQUIRED,
    PLAN_REQUIRED,
    BUILD_SUGGESTIONS_REQUIRED
} = require('./generator.cjs');

const {
    ensureScaffold,
    ensureBuildScaffolds,
    getScaffoldPath,
    collectContext,
    PHASE_SCAFFOLD_MAP
} = require('./hook.cjs');

module.exports = {
    // 主要功能
    generateScaffold,
    validateScaffold,
    ensureScaffold,
    ensureBuildScaffolds,

    // 輔助功能
    extractContextFromDraft,
    extractStoriesFromSpec,
    getScaffoldPath,
    collectContext,

    // 內部模組（供進階使用）
    scaffoldGenerators,

    // 常數
    SCAFFOLD_TYPES,
    PHASE_SCAFFOLD_MAP,

    // 驗證規則
    POC_SPEC_REQUIRED,
    PLAN_REQUIRED,
    BUILD_SUGGESTIONS_REQUIRED
};
