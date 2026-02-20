#!/usr/bin/env node
/**
 * Pre-Scaffold Hook
 * 
 * 在驗證前自動產出骨架，減少 AI 格式錯誤
 * 
 * 使用方式：
 * node task-pipe/lib/pre-scaffold.cjs --phase=POC --step=3 --target=./my-project
 * 
 * 整合方式：
 * 在各 phase 腳本的開頭加入：
 * const { ensureScaffold } = require('../../lib/pre-scaffold.cjs');
 * ensureScaffold(phase, step, options);
 */
const fs = require('fs');
const path = require('path');
const {
    generateScaffold,
    extractContextFromDraft,
    extractStoriesFromSpec,
    SCAFFOLD_TYPES
} = require('./generator.cjs');

/**
 * 階段到骨架類型的映射
 */
const PHASE_SCAFFOLD_MAP = {
    'POC-1': SCAFFOLD_TYPES.POC_DRAFT,
    'POC-3': SCAFFOLD_TYPES.POC_CONTRACT,
    'POC-4': SCAFFOLD_TYPES.POC_HTML,
    'POC-5': SCAFFOLD_TYPES.POC_SPEC,
    'PLAN-2': SCAFFOLD_TYPES.PLAN_IMPL,
    'PLAN-3': SCAFFOLD_TYPES.PLAN_IMPL
    // BUILD-8 移除：改由 phase-8.cjs 的 autoGenerateOutputs 動態產生（含正確統計）
};

/**
 * 確保骨架存在（主要入口）
 * 
 * @param {string} phase - 階段 (POC, PLAN, BUILD)
 * @param {string} step - 步驟 (0, 1, 2, 3, 7)
 * @param {object} options - { target, iteration, story, level }
 * @returns {object} { generated, path, skipped, reason }
 */
function ensureScaffold(phase, step, options) {
    const { target, iteration = 'iter-1', story, level = 'S' } = options;
    const key = `${phase}-${step}`;
    const scaffoldType = PHASE_SCAFFOLD_MAP[key];

    if (!scaffoldType) {
        return { generated: false, skipped: true, reason: `No scaffold for ${key}` };
    }

    // 計算輸出路徑
    const outputPath = getScaffoldPath(phase, step, target, iteration, story);

    // 如果已存在則跳過
    if (fs.existsSync(outputPath)) {
        return { generated: false, skipped: true, reason: 'File exists', path: outputPath };
    }

    // 收集上下文
    const context = collectContext(phase, step, target, iteration, story, level);

    // 產生骨架
    const result = generateScaffold(scaffoldType, context, outputPath);

    if (result.success) {
        console.log(`@SCAFFOLD_GENERATED: ${result.path}`);
        return { generated: true, path: result.path, type: scaffoldType };
    }

    return { generated: false, error: result.error };
}

/**
 * 計算骨架輸出路徑
 */
function getScaffoldPath(phase, step, target, iteration, story) {
    const basePath = path.join(target, `.gems/iterations/${iteration}`);

    switch (`${phase}-${step}`) {
        case 'POC-5':
            return path.join(basePath, 'poc', `requirement_draft_${iteration}.md`);
        case 'POC-5':
            // Contract 名稱從 draft 推斷
            const draftPath = path.join(basePath, 'poc', `requirement_draft_${iteration}.md`);
            const ctx = extractContextFromDraft(draftPath);
            const moduleName = ctx.projectName?.replace(/[^a-zA-Z]/g, '') || 'Module';
            return path.join(basePath, 'poc', `${moduleName}Contract.ts`);
        case 'POC-4':
            const draftPath2 = path.join(basePath, 'poc', `requirement_draft_${iteration}.md`);
            const ctx2 = extractContextFromDraft(draftPath2);
            const moduleName2 = ctx2.projectName?.replace(/[^a-zA-Z]/g, '') || 'Module';
            return path.join(basePath, 'poc', `${moduleName2}POC.html`);
        case 'POC-5':
            return path.join(basePath, 'poc', `requirement_spec_${iteration}.md`);
        case 'PLAN-2':
        case 'PLAN-3':
            return path.join(basePath, 'plan', `implementation_plan_${story || 'Story-1.0'}.md`);
        case 'BUILD-8':
            return path.join(basePath, 'build', `Fillback_${story || 'Story-1.0'}.md`);
        default:
            return path.join(basePath, 'scaffold_output.md');
    }
}

/**
 * 收集上下文資訊
 */
function collectContext(phase, step, target, iteration, story, level) {
    const basePath = path.join(target, `.gems/iterations/${iteration}`);
    const context = {
        iteration: iteration.replace('iter-', ''),
        level,
        storyId: story
    };

    // 從 draft 提取
    const draftPath = path.join(basePath, 'poc', `requirement_draft_${iteration}.md`);
    if (fs.existsSync(draftPath)) {
        Object.assign(context, extractContextFromDraft(draftPath));
    }

    // 從 spec 提取 stories
    const specPath = path.join(basePath, 'poc', `requirement_spec_${iteration}.md`);
    if (fs.existsSync(specPath)) {
        context.stories = extractStoriesFromSpec(specPath);
    }

    // 從 Contract 提取 moduleName
    const pocDir = path.join(basePath, 'poc');
    if (fs.existsSync(pocDir)) {
        const contracts = fs.readdirSync(pocDir).filter(f => f.endsWith('Contract.ts'));
        if (contracts.length > 0) {
            context.contractFile = contracts[0];
            context.moduleName = contracts[0].replace('Contract.ts', '');
        }
    }

    return context;
}

/**
 * 產生 BUILD Phase 8 的兩個產物
 * @param {object} options - { target, iteration, story }
 * @returns {object} { fillback, suggestions }
 */
function ensureBuildScaffolds(options) {
    const { target, iteration = 'iter-1', story } = options;
    const buildPath = path.join(target, `.gems/iterations/${iteration}/build`);

    const results = {};

    // Fillback
    const fillbackPath = path.join(buildPath, `Fillback_${story}.md`);
    if (!fs.existsSync(fillbackPath)) {
        const context = collectContext('BUILD', '8', target, iteration, story, 'S');
        results.fillback = generateScaffold(SCAFFOLD_TYPES.BUILD_FILLBACK, context, fillbackPath);
    } else {
        results.fillback = { generated: false, skipped: true, path: fillbackPath };
    }

    // Suggestions
    const suggestionsPath = path.join(buildPath, `iteration_suggestions_${story}.json`);
    if (!fs.existsSync(suggestionsPath)) {
        const context = { storyId: story, iteration };
        results.suggestions = generateScaffold(SCAFFOLD_TYPES.BUILD_SUGGESTIONS, context, suggestionsPath);
    } else {
        results.suggestions = { generated: false, skipped: true, path: suggestionsPath };
    }

    return results;
}

// CLI 入口
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};

    for (const arg of args) {
        const match = arg.match(/--(\w+)=(.+)/);
        if (match) options[match[1]] = match[2];
    }

    if (!options.phase || !options.step) {
        console.log(`Usage: node pre-scaffold.cjs --phase=POC --step=3 --target=./project

Options:
  --phase     POC, PLAN, BUILD
  --step      0, 1, 2, 3, 7
  --target    專案路徑 (必填)
  --iteration iter-1 (預設)
  --story     Story-1.0 (PLAN/BUILD 必填)
  --level     S, M, L (預設 S)
`);
        process.exit(1);
    }

    options.target = options.target || '.';
    const result = ensureScaffold(options.phase, options.step, options);
    console.log(JSON.stringify(result, null, 2));
}

module.exports = {
    ensureScaffold,
    ensureBuildScaffolds,
    getScaffoldPath,
    collectContext,
    PHASE_SCAFFOLD_MAP
};
