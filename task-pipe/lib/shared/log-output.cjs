/**
 * Log Output - 精簡終端輸出 + 詳情存檔
 * 
 * 設計原則:
 * 1. 成功輸出 → 一行 @PASS
 * 2. 錯誤輸出 → 結論優先 + 詳情存檔
 * 3. 避免終端機截斷
 */

const fs = require('fs');
const path = require('path');

// Evolution Blueprint: 錯誤分類器整合
let errorClassifier = null;
try {
    const classifierPath = path.resolve(__dirname, '../../lib/error-classifier.cjs');
    if (fs.existsSync(classifierPath)) {
        errorClassifier = require(classifierPath);
    }
} catch (e) {
    // 忽略載入錯誤
}

// v3.1: Project Memory 整合（@HINT 用）
let projectMemory = null;
try {
    projectMemory = require('./project-memory.cjs');
} catch (e) { /* 可選 */ }

// v2.0: 策略漂移模組整合

// P4: @GUARD 可配置化
// 預設值 — 可透過 setGuardRules() 或 config.json 的 guard 區段覆蓋
let GUARD_FORBIDDEN = 'task-pipe/ sdid-tools/';
let GUARD_ALLOWED = '專案檔案';

/**
 * 設定 @GUARD 規則（由 runner.cjs 啟動時從 config.json 注入）
 * @param {{ forbidden?: string, allowed?: string }} rules
 */
function setGuardRules(rules) {
    if (rules.forbidden) GUARD_FORBIDDEN = rules.forbidden;
    if (rules.allowed) GUARD_ALLOWED = rules.allowed;
}

/** 取得 @GUARD 終端輸出字串 */
function getGuardLine(targetFile) {
    const allowed = targetFile || GUARD_ALLOWED;
    return `@GUARD: 🚫 ${GUARD_FORBIDDEN} | ✅ ${allowed}`;
}

/** 取得 @GUARD log 檔案字串 */
function getGuardLogLine() {
    return `🚫 禁止修改 ${GUARD_FORBIDDEN} | ✅ 只能修改 TARGET 檔案`;
}
let retryStrategy = null;
let backtrackRouter = null;
let taintAnalyzer = null;
let incrementalValidator = null;

try {
    retryStrategy = require('./retry-strategy.cjs');
} catch (e) { /* 可選模組 */ }

try {
    backtrackRouter = require('./backtrack-router.cjs');
} catch (e) { /* 可選模組 */ }

try {
    taintAnalyzer = require('./taint-analyzer.cjs');
} catch (e) { /* 可選模組 */ }

try {
    incrementalValidator = require('./incremental-validator.cjs');
} catch (e) { /* 可選模組 */ }

/**
 * 取得 logs 目錄路徑
 * @param {string} projectRoot - 專案根目錄
 * @param {number} iterationNumber - 迭代編號
 * @returns {string} logs 目錄路徑
 */
function getLogsDir(projectRoot, iterationNumber = 1) {
    return path.join(projectRoot, '.gems', 'iterations', `iter-${iterationNumber}`, 'logs');
}

/**
 * 確保 logs 目錄存在
 * @param {string} logsDir - logs 目錄路徑
 */
function ensureLogsDir(logsDir) {
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
}

/**
 * 產生 log 檔案名稱
 * @param {string} phase - 階段 (poc, plan, build, scan)
 * @param {string} step - 步驟 (step-1, phase-1, etc.)
 * @param {string} type - 類型 (error, info, template)
 * @param {string} [story] - Story ID (e.g. 'Story-1.0')，PLAN/BUILD 階段使用
 * @returns {string} 檔案名稱
 */
function getLogFileName(phase, step, type = 'error', story = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    // PLAN/BUILD 階段加入 Story ID 以區分不同 Story 的 log
    // 格式: build-phase-2-Story-1.0-pass-2026-02-10T16-10-25.log
    if (story) {
        return `${phase}-${step}-${story}-${type}-${timestamp}.log`;
    }
    return `${phase}-${step}-${type}-${timestamp}.log`;
}

/**
 * 儲存詳細 log 到檔案
 * @param {object} options - 選項
 * @param {string} options.projectRoot - 專案根目錄
 * @param {number} options.iteration - 迭代編號
 * @param {string} options.phase - 階段
 * @param {string} options.step - 步驟
 * @param {string} options.type - 類型
 * @param {string} options.content - 內容
 * @param {string} [options.story] - Story ID (e.g. 'Story-1.0')
 * @returns {string} 儲存的檔案路徑（相對路徑）
 */
function saveLog(options) {
    const { projectRoot, iteration = 1, phase, step, type = 'error', content, story = null } = options;

    const logsDir = getLogsDir(projectRoot, iteration);
    ensureLogsDir(logsDir);

    const fileName = getLogFileName(phase, step, type, story);
    const filePath = path.join(logsDir, fileName);

    fs.writeFileSync(filePath, content, 'utf8');

    // 回傳相對路徑
    return path.relative(projectRoot, filePath);
}

/**
 * 精簡成功輸出
 * @param {string} nextCommand - 下一步指令
 * @param {string} summary - 可選的摘要
 */
function outputPass(nextCommand, summary = '') {
    if (summary) {
        console.log(`@PASS | ${summary}`);
    }
    console.log(`NEXT: ${nextCommand}`);
}

/**
 * 精簡錯誤輸出（結論優先 + 詳情存檔）
 * @param {object} options - 選項
 * @param {string} options.type - BLOCKER 或 TACTICAL_FIX
 * @param {string} options.summary - 問題摘要
 * @param {string} options.nextCommand - 修復後的指令
 * @param {string} options.details - 詳細內容（存檔）
 * @param {string} options.projectRoot - 專案根目錄
 * @param {number} options.iteration - 迭代編號
 * @param {string} options.phase - 階段
 * @param {string} options.step - 步驟
 */
function outputError(options) {
    const {
        type = 'TACTICAL_FIX',
        summary,
        nextCommand,
        details,
        projectRoot,
        iteration = 1,
        phase,
        step
    } = options;

    // 1. 結論優先
    console.log(`@${type} | ${summary}`);
    console.log(`NEXT: ${nextCommand}`);

    // 2. 詳情存檔
    if (details && projectRoot) {
        const logPath = saveLog({
            projectRoot,
            iteration,
            phase,
            step,
            type: 'error',
            content: details
        });
        console.log(`@READ: ${logPath}`);
        console.log(`  ↳ 包含: 錯誤詳情`);
    }
}

/**
 * 儲存模板並輸出路徑
 * @param {object} options - 選項
 * @param {string} options.templateContent - 模板內容
 * @param {string} options.projectRoot - 專案根目錄
 * @param {number} options.iteration - 迭代編號
 * @param {string} options.phase - 階段
 * @param {string} options.step - 步驟
 * @param {string} options.description - 模板描述
 */
function outputTemplate(options) {
    const {
        templateContent,
        projectRoot,
        iteration = 1,
        phase,
        step,
        description = '模板'
    } = options;

    const logPath = saveLog({
        projectRoot,
        iteration,
        phase,
        step,
        type: 'template',
        content: templateContent
    });

    console.log(`@TEMPLATE | ${description}`);
    console.log(`檔案: ${logPath}`);
}

/**
 * 完整上下文輸出（用於錯誤情況，但保持精簡）
 * @param {object} sections - 各區塊內容
 * @param {string} sections.context - 上下文（精簡）
 * @param {string} sections.task - 任務（精簡）
 * @param {string} sections.output - 輸出結論
 * @param {object} sections.logOptions - 存檔選項（可選）
 */
function outputStructured(sections) {
    const { context, task, output, logOptions } = sections;

    // 精簡輸出
    if (context) console.log(`@CONTEXT\n${context}\n`);
    if (task) console.log(`@TASK\n${task}\n`);
    if (output) console.log(`@OUTPUT\n${output}`);

    // 詳情存檔
    if (logOptions?.details && logOptions?.projectRoot) {
        const logPath = saveLog({
            projectRoot: logOptions.projectRoot,
            iteration: logOptions.iteration || 1,
            phase: logOptions.phase,
            step: logOptions.step,
            type: logOptions.type || 'info',
            content: logOptions.details
        });
        console.log(`\n詳情: ${logPath}`);
    }
}

/**
 * 錨點輸出 - 精簡終端輸出 + 長模板自動存檔
 * 
 * 設計原則:
 * 1. @CONTEXT - 精簡印出（1-3 行）
 * 2. @INFO - 結構化資訊（物件轉 key: value）
 * 3. @GUIDE - 指引內容
 * 4. @RULES - 規則列表
 * 5. @TASK - 任務列表
 * 6. @TEMPLATE - 長內容存檔 + 印出
 * 7. @TACTICAL_FIX / @BLOCKER - 錯誤摘要
 * 8. @OUTPUT - 結論 + 下一步指令
 * 
 * @param {object} sections - 各區塊內容
 * @param {string} sections.context - 上下文（精簡，1-3 行）
 * @param {object} sections.info - 結構化資訊（物件）
 * @param {object} sections.guide - 指引內容
 * @param {string} sections.guide.title - 指引標題
 * @param {string} sections.guide.content - 指引內容
 * @param {Array<string>} sections.rules - 規則列表
 * @param {Array<string>} sections.task - 任務列表
 * @param {object} sections.template - 長模板（存檔 + 印出）
 * @param {string} sections.template.title - 模板標題
 * @param {string} sections.template.content - 模板內容
 * @param {string} sections.template.description - 模板描述
 * @param {string} sections.gemsTemplate - GEMS 標籤模板
 * @param {object} sections.error - 錯誤資訊（可選）
 * @param {string} sections.error.type - TACTICAL_FIX 或 BLOCKER
 * @param {string} sections.error.summary - 錯誤摘要
 * @param {string} sections.error.detail - 錯誤詳情
 * @param {number} sections.error.attempt - 重試次數
 * @param {number} sections.error.maxAttempts - 最大重試次數
 * @param {string} sections.output - 輸出結論 + 下一步
 * @param {object} options - 存檔選項
 * @param {string} options.projectRoot - 專案根目錄
 * @param {number} options.iteration - 迭代編號
 * @param {string} options.phase - 階段 (poc, plan, build, scan)
 * @param {string} options.step - 步驟 (step-1, phase-1, etc.)
 */
function anchorOutput(sections, options = {}) {
    const { context, info, guide, rules, task, template, gemsTemplate, error, output } = sections;
    const { projectRoot, iteration = 1, phase, step, story = null } = options;

    // @CONTEXT - 精簡上下文
    if (context) {
        console.log(`@CONTEXT\n${context}\n`);
    }

    // @INFO - 結構化資訊
    if (info) {
        console.log('@INFO');
        Object.entries(info).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
        });
        console.log('');
    }

    // @GUIDE - 指引內容
    if (guide) {
        const title = guide.title || 'GUIDE';
        console.log(`@${title}`);
        console.log(guide.content);
        console.log('');
    }

    // @FRONTEND_SPECS - 前端規格約束 (v2.0)
    if (sections.frontendSpecs) {
        console.log(sections.frontendSpecs);
        console.log('');
    }

    // @PLAN_SPECS - Plan 標籤規格 (v3.0)
    if (sections.planSpecs) {
        console.log(sections.planSpecs);
        console.log('');
    }

    // @RULES - 規則列表
    if (rules && Array.isArray(rules)) {
        console.log('@RULES');
        rules.forEach(rule => console.log(`- ${rule}`));
        console.log('');
    }

    // @TASK - 任務列表
    if (task && Array.isArray(task)) {
        console.log('@TASK');
        task.forEach((t, i) => console.log(`${i + 1}. ${t}`));
        console.log('');
    }

    // @TEMPLATE - 存檔 + 印出（雙重輸出）
    if (template?.content) {
        const title = template.title || 'TEMPLATE';
        const desc = template.description ? ` (${template.description})` : '';

        // 1. 存檔到 logs/
        if (projectRoot) {
            try {
                const logPath = saveLog({
                    projectRoot,
                    iteration,
                    phase,
                    step,
                    type: 'template',
                    content: template.content,
                    story
                });
                console.log(`@LOG: ${logPath}`);
            } catch (err) {
                // 存檔失敗，忽略
            }
        }

        // 2. 印到終端機
        console.log(`@${title}${desc}`);
        console.log(template.content);
        console.log('');
    }

    // @GEMS-TEMPLATE - GEMS 標籤模板
    if (gemsTemplate) {
        console.log('@TEMPLATE (GEMS 標籤 v2.1)');
        console.log(gemsTemplate);
        console.log('');
    }

    // @ARCHITECTURE_REVIEW 或 @ITERATION_ADVICE - 正向引導
    if (error) {
        let tag = error.type || 'ITERATION_ADVICE';
        let icon = '💡';

        // 語義轉換：將負面詞改為正向詞
        if (tag === 'BLOCKER') {
            tag = 'ARCHITECTURE_REVIEW';
            icon = '📐';
        } else if (tag === 'TACTICAL_FIX') {
            tag = 'ITERATION_ADVICE';
            icon = '🛠️';
        }

        const attemptInfo = error.attempt ? ` (${error.attempt}/${error.maxAttempts || 3})` : '';
        console.log(`${icon} @${tag}${attemptInfo}`);
        console.log(error.summary);
        if (error.detail) {
            console.log(`架構延伸資料: ${error.detail}`);
        }
        console.log('');
    }

    // @OUTPUT - 結論 + 下一步
    if (output) {
        console.log('@OUTPUT');
        console.log(output);
    }

    // ============================================
    // 施工紅線 (統一為 @GUARD，精簡版)
    // ============================================
    if (error) {
        console.log('');
        console.log(getGuardLine());
        console.log('');
    }

    // ============================================
    // 統一存檔：將完整輸出內容存檔到 logs 目錄
    // 確保終端截斷時 AI 可以讀取 logs 獲取完整資訊
    // ============================================
    if (projectRoot && phase && step) {
        try {
            // 組合完整輸出內容
            const logLines = [];

            if (context) logLines.push(`@CONTEXT\n${context}`);
            if (info) {
                logLines.push('@INFO');
                Object.entries(info).forEach(([key, value]) => {
                    logLines.push(`  ${key}: ${value}`);
                });
            }
            if (guide) {
                const title = guide.title || 'GUIDE';
                logLines.push(`@${title}\n${guide.content}`);
            }
            if (sections.frontendSpecs) {
                logLines.push(sections.frontendSpecs);
            }
            if (sections.planSpecs) {
                logLines.push(sections.planSpecs);
            }
            if (rules && Array.isArray(rules)) {
                logLines.push('@RULES');
                rules.forEach(rule => logLines.push(`- ${rule}`));
            }
            if (task && Array.isArray(task)) {
                logLines.push('@TASK');
                task.forEach((t, i) => logLines.push(`${i + 1}. ${t}`));
            }
            if (error) {
                const tag = error.type || 'TACTICAL_FIX';
                const attemptInfo = error.attempt ? ` (${error.attempt}/${error.maxAttempts || 3})` : '';
                logLines.push(`@${tag}${attemptInfo}\n${error.summary}`);
            }
            if (output) logLines.push(`@OUTPUT\n${output}`);

            // Evolution Blueprint: 智能錯誤分析
            // 自動分析錯誤內容並添加 [RECOVERABLE] 標籤與建議
            if (errorClassifier && error) {
                const errorContent = (error.summary || '') + '\n' + (error.detail || '');
                const classification = errorClassifier.classifyError(errorContent);

                if (classification.type !== 'UNKNOWN') {
                    const recoverLabel = classification.recoverable === true
                        ? '[RECOVERABLE]'
                        : classification.recoverable === 'maybe'
                            ? '[MAYBE]'
                            : '[STRUCTURAL]';

                    // 插入到 @OUTPUT 之前
                    const analysisSection = `@ANALYSIS ${recoverLabel}\n錯誤類型: ${classification.type}\n建議行動: ${classification.suggestion}`;
                    // 插入到倒數第二的位置 (OUTPUT 之前)
                    if (logLines.length > 0 && logLines[logLines.length - 1].startsWith('@OUTPUT')) {
                        logLines.splice(logLines.length - 1, 0, analysisSection);
                    } else {
                        logLines.push(analysisSection);
                    }
                }
            }

            // 決定 log 類型
            let logType = 'info';
            if (error?.type === 'BLOCKER') logType = 'error';
            else if (error?.type === 'TACTICAL_FIX') logType = 'fix';
            else if (output?.includes('下一步') || output?.includes('重新執行')) logType = 'pending';

            const logPath = saveLog({
                projectRoot,
                iteration,
                phase,
                step,
                type: logType,
                content: logLines.join('\n\n'),
                story
            });

            // 不再重複印出 @LOG，避免輸出過多
        } catch (err) {
            // 存檔失敗，忽略（不影響主流程）
        }
    }
}

/**
 * 快速成功輸出（一行版本）
 * @param {string} phase - 階段
 * @param {string} step - 步驟
 * @param {string} summary - 摘要
 * @param {string} nextCommand - 下一步指令
 * @param {object} options - 存檔選項（可選）
 */
function anchorPass(phase, step, summary, nextCommand, options = {}) {
    console.log(`@PASS | ${phase} ${step} | ${summary}`);
    console.log(`NEXT: ${nextCommand}`);

    // 可選：存檔成功記錄
    if (options.projectRoot) {
        try {
            const logPath = saveLog({
                projectRoot: options.projectRoot,
                iteration: options.iteration || 1,
                phase: options.phase,
                step: options.step,
                type: 'pass',
                content: `@PASS | ${phase} ${step} | ${summary}\nNEXT: ${nextCommand}`,
                story: options.story || null
            });
        } catch (err) {
            // 存檔失敗，忽略
        }
    }
}

/**
 * 快速錯誤輸出（一行版本）
 * @param {string} type - BLOCKER 或 TACTICAL_FIX
 * @param {string} summary - 錯誤摘要
 * @param {string} nextCommand - 修復後指令
 * @param {object} options - 存檔選項（可選）
 */
function anchorError(type, summary, nextCommand, options = {}) {
    const { attempt, maxAttempts, details, projectRoot, iteration, phase, step, context, story, priority, changedFiles } = options;

    const attemptInfo = attempt ? ` (${attempt}/${maxAttempts || 3})` : '';
    
    // v2.0: 策略漂移分析
    let strategyInfo = null;
    if (retryStrategy && projectRoot && iteration && phase && step) {
        try {
            const advice = retryStrategy.recordRetryAndGetStrategy(
                projectRoot, 
                typeof iteration === 'number' ? `iter-${iteration}` : iteration,
                phase, 
                step,
                { message: summary, type },
                { priority: priority || 'P2', storyId: story }
            );
            strategyInfo = {
                level: advice.level,
                name: advice.levelName,
                action: advice.action,
                isOverLimit: advice.isOverLimit,
                guidance: advice.guidance
            };
        } catch (e) {
            // 忽略策略分析錯誤
        }
    }

    console.log(`@${type}${attemptInfo} | ${summary}`);
    
    // v3.1: @HINT — 歷史錯誤提示
    if (projectMemory && projectRoot && phase && step) {
        try {
            const hint = projectMemory.getHistoricalHint(projectRoot, phase, step, story);
            if (hint.hint) {
                console.log(`@HINT: ${hint.hint} (${hint.count} 次)`);
            }
        } catch (e) { /* 忽略 */ }
    }
    
    // v2.0: 輸出策略漂移資訊
    if (strategyInfo) {
        const levelEmoji = { 1: '🔧', 2: '🔄', 3: '⚠️' };
        console.log(`@STRATEGY_DRIFT | Level ${strategyInfo.level}/3 | ${levelEmoji[strategyInfo.level] || ''} ${strategyInfo.name}`);
        
        if (strategyInfo.level === 1) {
            console.log('  策略: 局部修補 - 在原檔案修復');
        } else if (strategyInfo.level === 2) {
            console.log('  策略: 換個方式 - 重新實作或拆分函式');
        } else if (strategyInfo.level === 3) {
            console.log('  策略: 架構質疑 - 考慮回退到 PLAN 階段');
            // 回溯建議
            if (backtrackRouter) {
                const backtrack = backtrackRouter.analyzeAndRoute([{ message: summary, type }]);
                if (backtrack.needsBacktrack && backtrack.target) {
                    console.log(`  @BACKTRACK_HINT: 建議回溯到 ${backtrack.target.phase}-${backtrack.target.step}`);
                }
            }
        }
        
        if (strategyInfo.isOverLimit) {
            console.log('  ⛔ 已達重試上限，需要人工介入');
        }
    }
    
    // v2.0: 染色分析 - 分析修改檔案的影響範圍
    let impactInfo = null;
    if (taintAnalyzer && projectRoot && changedFiles && changedFiles.length > 0) {
        try {
            const functionsJson = path.join(projectRoot, '.gems/docs/functions.json');
            if (fs.existsSync(functionsJson)) {
                const graph = taintAnalyzer.buildDependencyGraph(functionsJson);
                const impact = taintAnalyzer.analyzeImpact(graph, changedFiles, { maxDepth: 2 });
                
                if (impact.stats.indirectAffected > 0) {
                    impactInfo = impact;
                    console.log(`@TAINT_ANALYSIS | 修改 ${impact.stats.directChanges} 個函式 → 影響 ${impact.stats.indirectAffected} 個依賴者`);
                    console.log(`  受影響檔案: ${impact.affectedFiles.slice(0, 3).join(', ')}${impact.affectedFiles.length > 3 ? '...' : ''}`);
                }
            }
        } catch (e) {
            // 忽略染色分析錯誤
        }
    }
    
    // v2.0: 增量驗證建議 - 告訴 AI 要驗證哪些檔案
    if (incrementalValidator && impactInfo && impactInfo.affectedFiles.length > 0) {
        const currentPhase = parseInt((step || '1').replace(/\D/g, '')) || 1;
        console.log(`@INCREMENTAL_HINT | 建議驗證範圍:`);
        if (currentPhase >= 2) console.log('  - 標籤驗證: 檢查受影響檔案的 GEMS 標籤');
        if (currentPhase >= 5) console.log('  - 測試驗證: 跑受影響檔案的測試');
        if (currentPhase >= 7) console.log('  - 整合驗證: 檢查 import/export 是否正常');
    }
    
    console.log(`NEXT: ${nextCommand}`);

    // 統一存檔：即使沒有 details 也要存基本錯誤資訊
    if (projectRoot && phase && step) {
        try {
            // 組合錯誤內容
            const logLines = [];
            if (context) logLines.push(`@CONTEXT\n${context}`);
            logLines.push(`@${type}${attemptInfo}\n${summary}`);
            
            // v2.0: 加入策略漂移資訊到 log
            if (strategyInfo) {
                logLines.push(`@STRATEGY_DRIFT`);
                logLines.push(`Level: ${strategyInfo.level}/3 (${strategyInfo.name})`);
                logLines.push(`Action: ${strategyInfo.action}`);
                if (strategyInfo.guidance) {
                    logLines.push(`Guidance: ${strategyInfo.guidance.title || ''}`);
                    if (strategyInfo.guidance.instructions) {
                        strategyInfo.guidance.instructions.forEach(inst => {
                            logLines.push(`  - ${inst}`);
                        });
                    }
                }
            }
            
            // v2.0: 加入染色分析到 log
            if (impactInfo) {
                logLines.push(`@TAINT_ANALYSIS`);
                logLines.push(`直接修改: ${impactInfo.stats.directChanges} 個函式`);
                logLines.push(`間接影響: ${impactInfo.stats.indirectAffected} 個函式`);
                logLines.push(`受影響檔案:`);
                impactInfo.affectedFiles.forEach(f => logLines.push(`  - ${f}`));
            }
            
            logLines.push(`NEXT: ${nextCommand}`);
            if (details) logLines.push(`\n詳情:\n${details}`);

            // Evolution Blueprint: 智能錯誤分析
            if (errorClassifier) {
                const errorContent = summary + '\n' + (details || '');
                const classification = errorClassifier.classifyError(errorContent);

                if (classification.type !== 'UNKNOWN') {
                    const recoverLabel = classification.recoverable === true
                        ? '[RECOVERABLE]'
                        : classification.recoverable === 'maybe'
                            ? '[MAYBE]'
                            : '[STRUCTURAL]';

                    logLines.push(`@ANALYSIS ${recoverLabel}\n錯誤類型: ${classification.type}\n建議行動: ${classification.suggestion}`);
                }
            }

            const logPath = saveLog({
                projectRoot,
                iteration: typeof iteration === 'number' ? iteration : parseInt((iteration || 'iter-1').replace('iter-', '')),
                phase,
                step,
                type: 'error',
                content: logLines.join('\n\n'),
                story: story || null
            });

            // v3.0: 使用 @READ 強制 AI 讀取 log
            console.log(`@READ: ${logPath}`);
            console.log(`  ↳ 包含: 錯誤詳情 + 策略建議 + 修復指引`);
        } catch (err) {
            // 存檔失敗，忽略
        }
    }

    // 施工紅線 (統一為 @GUARD)
    console.log('');
    console.log(getGuardLine());
}

/**
 * 精準錯誤輸出 - Point-to-Point 格式
 * 設計目標：讓 AI 只看這個輸出就知道要做什麼，不需要去讀工具腳本
 * 
 * @param {object} spec - 錯誤規格
 * @param {string} spec.targetFile - 目標檔案路徑
 * @param {string[]} spec.missing - 缺少的項目
 * @param {string} spec.example - 可直接複製的範例
 * @param {string} spec.nextCmd - 修復後執行的指令
 * @param {object} spec.gateSpec - 門控規格（驗證邏輯說明）
 * @param {object} options - 存檔選項
 */
function anchorErrorSpec(spec, options = {}) {
    const { targetFile, missing, example, nextCmd, attempt, maxAttempts, gateSpec } = spec;
    const { projectRoot, iteration = 1, phase, step, story = null } = options;

    const attemptInfo = attempt ? ` (${attempt}/${maxAttempts || 3})` : '';

    // === 終端輸出 (精簡 — 細節在 log) ===
    console.log('');
    console.log(`@ERROR_SPEC${attemptInfo} | ${phase || ''} ${step || ''} | 缺少: ${missing.join(', ')}`);
    console.log(`TARGET: ${targetFile}`);
    console.log(`MISSING: ${missing.join(', ')}`);

    // 存檔 (完整內容)
    let logPath = null;
    if (projectRoot && phase && step) {
        try {
            let logContent = `=== SIGNAL ===\n@ERROR_SPEC${attemptInfo}\n\n=== TARGET ===\nFILE: ${targetFile}\nMISSING: ${missing.join(', ')}\n`;
            if (gateSpec && gateSpec.checks) {
                logContent += `\n=== GATE_SPEC ===\n`;
                gateSpec.checks.forEach(check => {
                    const status = check.pass ? '✅' : '❌';
                    logContent += `${status} ${check.name}: ${check.pattern || check.desc || ''}\n`;
                });
            }
            logContent += `\n=== EXAMPLE (可直接複製) ===\n${example}\n`;
            logContent += `\n=== NEXT ===\n${nextCmd}\n`;
            logContent += `\n=== GUARD ===\n${getGuardLogLine()}`;

            logPath = saveLog({
                projectRoot,
                iteration,
                phase,
                step,
                type: 'error-spec',
                content: logContent,
                story
            });
        } catch (err) {
            // 忽略存檔錯誤
        }
    }

    // @READ 指標 — 強制 AI 讀 log 取得 GATE_SPEC + EXAMPLE
    if (logPath) {
        console.log(`@READ: ${logPath}`);
        console.log(`  ↳ 包含: GATE_SPEC 檢查項 + 修復範例 + 缺失明細`);
    }
    console.log(`NEXT: ${nextCmd}`);
    console.log(getGuardLine(targetFile));
    console.log('');
}

/**
 * Template 待填寫輸出 - 明確告知 AI 需要填寫內容
 * 
 * @param {object} spec - 模板規格
 * @param {string} spec.targetFile - 目標檔案路徑
 * @param {string} spec.templateContent - 模板內容
 * @param {string[]} spec.fillItems - 需要填寫的項目
 * @param {string} spec.nextCmd - 填寫完成後執行的指令
 * @param {object} spec.gateSpec - 門控規格（驗證邏輯說明）
 * @param {object} options - 存檔選項
 */
function anchorTemplatePending(spec, options = {}) {
    const { targetFile, templateContent, fillItems, nextCmd, gateSpec } = spec;
    const { projectRoot, iteration = 1, phase, step, story = null } = options;

    // === 終端輸出 (精簡 — 模板在 log) ===
    console.log('');
    console.log(`@TEMPLATE_PENDING | ${phase || ''} ${step || ''} | 需填寫 ${fillItems.length} 個項目`);
    console.log(`TARGET: ${targetFile}`);

    // 列出填寫項目 (這個保留在終端，因為很短)
    console.log('FILL_ITEMS:');
    fillItems.forEach((item, i) => {
        console.log(`  ${i + 1}. ${item}`);
    });

    // 存檔 (完整內容含模板)
    let logPath = null;
    if (projectRoot && phase && step) {
        try {
            let logContent = `=== SIGNAL ===\n@TEMPLATE_PENDING\n\n=== TARGET ===\nFILE: ${targetFile}\n`;
            if (gateSpec && gateSpec.checks) {
                logContent += `\n=== GATE_SPEC (填寫後會檢查) ===\n`;
                gateSpec.checks.forEach(check => {
                    logContent += `⏳ ${check.name}: ${check.pattern || check.desc || ''}\n`;
                });
            }
            logContent += `\n=== FILL_ITEMS ===\n${fillItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n`;
            logContent += `\n=== TEMPLATE (可直接複製) ===\n${templateContent}\n`;
            logContent += `\n=== NEXT ===\n${nextCmd}\n`;
            logContent += `\n=== GUARD ===\n${getGuardLogLine()}`;

            logPath = saveLog({
                projectRoot,
                iteration,
                phase,
                step,
                type: 'template',
                content: logContent,
                story
            });
        } catch (err) {
            // 忽略存檔錯誤
        }
    }

    // @READ 指標 — 強制 AI 讀 log 取得完整模板
    if (logPath) {
        console.log(`@READ: ${logPath}`);
        console.log(`  ↳ 包含: 完整模板 + GATE_SPEC 檢查項`);
    }
    console.log(`NEXT: ${nextCmd}`);
    console.log(getGuardLine(targetFile));
    console.log('');
}

/**
 * 指令式任務區塊輸出 - 讓大小模型都能直接執行
 * 
 * 設計原則 (基於研究):
 * 1. 結構化指令取代描述式 (Martin Fowler Context Engineering)
 * 2. 關鍵指令結尾重複 (Google Research: Prompt Repetition, arXiv:2512.14982)
 * 3. 約束 token 空間到只剩正確行動 (Zed Blog: On Programming with Agents)
 * 
 * @param {object} spec - 任務規格
 * @param {Array<object>} spec.tasks - 任務列表 [{action, file, expected, reference, gemsSpec}]
 * @param {string} spec.nextCommand - 修復後執行的完整命令
 * @param {string} [spec.verdict] - BLOCKER 或 TACTICAL_FIX
 * @param {string} [spec.context] - 簡短上下文 (1 行)
 * @param {object} [spec.strategyDrift] - 策略漂移資訊 (重試時才有)
 * @param {object} options - 存檔選項
 */
function emitTaskBlock(spec, options = {}) {
    const { tasks = [], nextCommand, verdict = 'BLOCKER', context, strategyDrift } = spec;
    const { projectRoot, iteration = 1, phase, step, story = null } = options;

    // === 終端輸出 ===
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`@${verdict} | ${tasks.length} item(s) to fix`);
    if (context) console.log(`@CONTEXT: ${context}`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    // 策略漂移 (僅重試時出現)
    if (strategyDrift) {
        console.log(`@STRATEGY_DRIFT Level: ${strategyDrift.level}/3 (${strategyDrift.name})`);
        if (strategyDrift.hint) console.log(`  HINT: ${strategyDrift.hint}`);
        console.log('');
    }

    // @TASK 區塊 - 每個任務一個明確指令
    tasks.forEach((t, i) => {
        console.log(`@TASK-${i + 1}`);
        console.log(`  ACTION: ${t.action}`);
        console.log(`  FILE: ${t.file}`);
        if (t.expected) console.log(`  EXPECTED: ${t.expected}`);
        if (t.reference) console.log(`  REFERENCE: ${t.reference}`);
        if (t.gemsSpec) console.log(`  GEMS_SPEC: ${t.gemsSpec}`);
        console.log('');
    });

    // @NEXT_COMMAND - 修復後要跑的命令
    console.log(`@NEXT_COMMAND`);
    console.log(`  ${nextCommand}`);
    console.log('');

    // @REMINDER - Prompt Repetition (關鍵指令重複一次)
    // 基於 Google Research arXiv:2512.14982 - 重複 prompt 提升 non-reasoning 準確率
    console.log('@REMINDER');
    tasks.forEach((t) => {
        console.log(`  - ${t.action} ${t.file}`);
    });
    console.log(`  NEXT: ${nextCommand}`);
    console.log('');

    // 施工紅線 (統一為 @GUARD)
    console.log(getGuardLine());
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    // === 存檔 ===
    if (projectRoot && phase && step) {
        try {
            const logLines = [];
            logLines.push(`@${verdict} | ${tasks.length} item(s) to fix`);
            if (context) logLines.push(`@CONTEXT: ${context}`);
            logLines.push('');

            if (strategyDrift) {
                logLines.push(`@STRATEGY_DRIFT Level: ${strategyDrift.level}/3 (${strategyDrift.name})`);
                if (strategyDrift.hint) logLines.push(`  HINT: ${strategyDrift.hint}`);
                logLines.push('');
            }

            tasks.forEach((t, i) => {
                logLines.push(`@TASK-${i + 1}`);
                logLines.push(`  ACTION: ${t.action}`);
                logLines.push(`  FILE: ${t.file}`);
                if (t.expected) logLines.push(`  EXPECTED: ${t.expected}`);
                if (t.reference) logLines.push(`  REFERENCE: ${t.reference}`);
                if (t.gemsSpec) logLines.push(`  GEMS_SPEC: ${t.gemsSpec}`);
                logLines.push('');
            });

            logLines.push(`@NEXT_COMMAND: ${nextCommand}`);
            logLines.push('');
            logLines.push('@REMINDER');
            tasks.forEach((t) => {
                logLines.push(`  - ${t.action} ${t.file}`);
            });
            logLines.push(`  @NEXT_COMMAND: ${nextCommand}`);

            saveLog({
                projectRoot,
                iteration: typeof iteration === 'number' ? iteration : parseInt((iteration || 'iter-1').replace('iter-', '')),
                phase,
                step,
                type: 'error',
                content: logLines.join('\n'),
                story
            });
        } catch (err) {
            // 存檔失敗，忽略
        }
    }
}

// ============================================
// v3.1 統一 Emit 函式 (Phase 1 整併)
// 4 個函式取代 10 個，統一引導品質
// 舊函式保留向後相容，新 step 請用 emit*
// ============================================

/**
 * emitPass — 成功輸出 + 進度提示
 * 
 * @param {object} spec
 * @param {string} spec.scope - "BUILD Phase 2" 或 "POC Step 1"
 * @param {string} spec.summary - 一句話摘要
 * @param {string} spec.nextCmd - NEXT 指令
 * @param {string} [spec.progress] - "Story-1.0 [Phase 2/8] | 整體 [Story 1/4]"
 * @param {string} [spec.nextHint] - 下一步預告 "Phase 3: 骨架建立"
 * @param {object} [options] - 存檔選項 { projectRoot, iteration, phase, step, story }
 */
function emitPass(spec, options = {}) {
    const { scope, summary, nextCmd, progress, nextHint } = spec;
    const { projectRoot, iteration, phase, step, story } = options;

    console.log(`@PASS | ${scope} | ${summary}`);
    if (progress) {
        console.log(`PROGRESS: ${progress}`);
    }
    console.log(`NEXT: ${nextCmd}`);
    if (nextHint) {
        console.log(`  ↳ ${nextHint}`);
    }

    // 記錄到 project-memory
    if (projectMemory && projectRoot) {
        try {
            projectMemory.recordEntry(projectRoot, {
                phase, step, story, iteration,
                verdict: 'PASS', signal: '@PASS',
                summary: summary.substring(0, 100)
            });
        } catch (e) { /* 忽略 */ }
    }

    // 存檔
    if (projectRoot && phase && step) {
        try {
            saveLog({
                projectRoot,
                iteration: typeof iteration === 'number' ? iteration : parseInt((iteration || 'iter-1').replace('iter-', '')),
                phase, step, type: 'pass',
                content: `@PASS | ${scope} | ${summary}\n${progress ? `PROGRESS: ${progress}\n` : ''}NEXT: ${nextCmd}`,
                story
            });
        } catch (e) { /* 忽略 */ }
    }
}

/**
 * emitFix — 可修復錯誤（合併 anchorError + anchorErrorSpec + emitTaskBlock）
 * 
 * 終端只印信號 + TARGET + @READ + NEXT（不印 MISSING 細節）
 * 細節存 log，AI 必須讀 log 才能修復
 * 
 * @param {object} spec
 * @param {string} spec.scope - "BUILD Phase 2 | Story-1.0"
 * @param {string} spec.summary - 一句話摘要
 * @param {string} spec.targetFile - 目標檔案
 * @param {string[]} spec.missing - 缺少的項目
 * @param {string} spec.nextCmd - NEXT 指令
 * @param {string} [spec.example] - 修復範例（存 log）
 * @param {object} [spec.gateSpec] - Gate 檢查項（存 log）
 * @param {number} [spec.attempt] - 重試次數
 * @param {number} [spec.maxAttempts] - 最大重試次數
 * @param {Array<object>} [spec.tasks] - emitTaskBlock 風格的任務列表
 * @param {object} [options] - { projectRoot, iteration, phase, step, story }
 */
function emitFix(spec, options = {}) {
    const { scope, summary, targetFile, missing = [], nextCmd,
            example, gateSpec, attempt, maxAttempts, tasks } = spec;
    const { projectRoot, iteration, phase, step, story } = options;

    const attemptInfo = attempt ? ` (${attempt}/${maxAttempts || 3})` : '';

    // === 終端輸出（精簡） ===
    console.log('');
    console.log(`@FIX${attemptInfo} | ${scope} | ${summary}`);
    if (targetFile) {
        console.log(`TARGET: ${targetFile}`);
    }

    // @HINT — 歷史錯誤提示
    if (projectMemory && projectRoot && phase && step) {
        try {
            const hint = projectMemory.getHistoricalHint(projectRoot, phase, step, story);
            if (hint.hint) {
                console.log(`@HINT: ${hint.hint} (${hint.count} 次)`);
            }
        } catch (e) { /* 忽略 */ }
    }

    // tasks 模式（多任務）
    if (tasks && tasks.length > 0) {
        tasks.forEach((t, i) => {
            console.log(`@TASK-${i + 1}`);
            console.log(`  ACTION: ${t.action}`);
            console.log(`  FILE: ${t.file}`);
            if (t.expected) console.log(`  EXPECTED: ${t.expected}`);
        });
        console.log('');
    }

    // === 存 log（完整細節） ===
    let logPath = null;
    if (projectRoot && phase && step) {
        try {
            const logLines = [];
            logLines.push(`=== SIGNAL ===`);
            logLines.push(`@FIX${attemptInfo} | ${scope} | ${summary}`);
            logLines.push('');
            logLines.push(`=== TARGET ===`);
            logLines.push(`FILE: ${targetFile || '(none)'}`);
            logLines.push(`MISSING: ${missing.join(', ')}`);

            if (gateSpec && gateSpec.checks) {
                logLines.push('');
                logLines.push(`=== GATE_SPEC ===`);
                gateSpec.checks.forEach(check => {
                    const status = check.pass ? '✅' : '❌';
                    logLines.push(`${status} ${check.name}: ${check.pattern || check.desc || ''}`);
                });
            }

            if (example) {
                logLines.push('');
                logLines.push(`=== EXAMPLE (可直接複製) ===`);
                logLines.push(example);
            }

            if (tasks && tasks.length > 0) {
                logLines.push('');
                logLines.push(`=== TASKS ===`);
                tasks.forEach((t, i) => {
                    logLines.push(`@TASK-${i + 1}`);
                    logLines.push(`  ACTION: ${t.action}`);
                    logLines.push(`  FILE: ${t.file}`);
                    if (t.expected) logLines.push(`  EXPECTED: ${t.expected}`);
                    if (t.reference) logLines.push(`  REFERENCE: ${t.reference}`);
                    if (t.gemsSpec) logLines.push(`  GEMS_SPEC: ${t.gemsSpec}`);
                });
            }

            logLines.push('');
            logLines.push(`=== NEXT ===`);
            logLines.push(nextCmd);
            logLines.push('');
            logLines.push(`=== GUARD ===`);
            logLines.push(getGuardLogLine());

            logPath = saveLog({
                projectRoot,
                iteration: typeof iteration === 'number' ? iteration : parseInt((iteration || 'iter-1').replace('iter-', '')),
                phase, step, type: 'error',
                content: logLines.join('\n'),
                story
            });
        } catch (e) { /* 忽略 */ }
    }

    // @READ 指標
    if (logPath) {
        console.log(`@READ: ${logPath}`);
        console.log(`  ↳ 包含: MISSING 明細 + 修復範例 + GATE_SPEC`);
    }
    console.log(`NEXT: ${nextCmd}`);

    // @GUARD（首次才印完整版）
    if (!attempt || attempt <= 1) {
        console.log(getGuardLine());
    }
    console.log('');

    // 記錄到 project-memory
    if (projectMemory && projectRoot) {
        try {
            projectMemory.recordEntry(projectRoot, {
                phase, step, story, iteration,
                verdict: 'ERROR', signal: '@FIX',
                summary: summary.substring(0, 100),
                missing, target: targetFile
            });
        } catch (e) { /* 忽略 */ }
    }
}

/**
 * emitFill — 需要填空的模板（合併 outputTemplate + anchorTemplatePending）
 * 
 * @param {object} spec
 * @param {string} spec.scope - "PLAN Step 2 | Story-1.0"
 * @param {string} spec.summary - "需建立 Implementation Plan"
 * @param {string} spec.targetFile - 目標檔案
 * @param {string[]} spec.fillItems - 需要填寫的項目
 * @param {string} spec.nextCmd - NEXT 指令
 * @param {string} [spec.templateContent] - 模板內容（存 log）
 * @param {object} [spec.gateSpec] - Gate 檢查項
 * @param {object} [options] - { projectRoot, iteration, phase, step, story }
 */
function emitFill(spec, options = {}) {
    const { scope, summary, targetFile, fillItems = [], nextCmd,
            templateContent, gateSpec } = spec;
    const { projectRoot, iteration, phase, step, story } = options;

    // === 終端輸出（精簡） ===
    console.log('');
    console.log(`@FILL | ${scope} | ${summary}`);
    console.log(`TARGET: ${targetFile}`);
    console.log('FILL_ITEMS:');
    fillItems.forEach((item, i) => {
        console.log(`  ${i + 1}. ${item}`);
    });

    // === 存 log（含完整模板） ===
    let logPath = null;
    if (projectRoot && phase && step) {
        try {
            const logLines = [];
            logLines.push(`=== SIGNAL ===`);
            logLines.push(`@FILL | ${scope} | ${summary}`);
            logLines.push('');
            logLines.push(`=== TARGET ===`);
            logLines.push(`FILE: ${targetFile}`);

            if (gateSpec && gateSpec.checks) {
                logLines.push('');
                logLines.push(`=== GATE_SPEC (填寫後會檢查) ===`);
                gateSpec.checks.forEach(check => {
                    logLines.push(`⏳ ${check.name}: ${check.pattern || check.desc || ''}`);
                });
            }

            logLines.push('');
            logLines.push(`=== FILL_ITEMS ===`);
            fillItems.forEach((item, i) => logLines.push(`${i + 1}. ${item}`));

            if (templateContent) {
                logLines.push('');
                logLines.push(`=== TEMPLATE (可直接複製) ===`);
                logLines.push(templateContent);
            }

            logLines.push('');
            logLines.push(`=== NEXT ===`);
            logLines.push(nextCmd);
            logLines.push('');
            logLines.push(`=== GUARD ===`);
            logLines.push(getGuardLogLine());

            logPath = saveLog({
                projectRoot,
                iteration: typeof iteration === 'number' ? iteration : parseInt((iteration || 'iter-1').replace('iter-', '')),
                phase, step, type: 'template',
                content: logLines.join('\n'),
                story
            });
        } catch (e) { /* 忽略 */ }
    }

    if (logPath) {
        console.log(`@READ: ${logPath}`);
        console.log(`  ↳ 包含: 完整模板 + GATE_SPEC 檢查項`);
    }
    console.log(`NEXT: ${nextCmd}`);
    console.log(getGuardLine(targetFile));
    console.log('');
}

/**
 * emitBlock — 結構性阻擋，需要架構審查或人工介入
 * 
 * @param {object} spec
 * @param {string} spec.scope - "BUILD Phase 7 | Story-1.0"
 * @param {string} spec.summary - 問題摘要
 * @param {string} spec.nextCmd - NEXT 指令或建議
 * @param {string} [spec.targetFile] - 目標檔案
 * @param {string[]} [spec.missing] - 缺少的項目
 * @param {string} [spec.details] - 詳細說明（存 log）
 * @param {object} [spec.gateSpec] - Gate 檢查項
 * @param {object} [options] - { projectRoot, iteration, phase, step, story }
 */
function emitBlock(spec, options = {}) {
    const { scope, summary, nextCmd, targetFile, missing = [],
            details, gateSpec } = spec;
    const { projectRoot, iteration, phase, step, story } = options;

    // === 終端輸出 ===
    console.log('');
    console.log(`@BLOCK | ${scope} | ${summary}`);
    if (targetFile) {
        console.log(`TARGET: ${targetFile}`);
    }

    // @HINT
    if (projectMemory && projectRoot && phase && step) {
        try {
            const hint = projectMemory.getHistoricalHint(projectRoot, phase, step, story);
            if (hint.hint) {
                console.log(`@HINT: ${hint.hint} (${hint.count} 次)`);
            }
        } catch (e) { /* 忽略 */ }
    }

    // === 存 log ===
    let logPath = null;
    if (projectRoot && phase && step) {
        try {
            const logLines = [];
            logLines.push(`=== SIGNAL ===`);
            logLines.push(`@BLOCK | ${scope} | ${summary}`);
            logLines.push('');
            if (targetFile) {
                logLines.push(`=== TARGET ===`);
                logLines.push(`FILE: ${targetFile}`);
                if (missing.length > 0) logLines.push(`MISSING: ${missing.join(', ')}`);
            }
            if (gateSpec && gateSpec.checks) {
                logLines.push('');
                logLines.push(`=== GATE_SPEC ===`);
                gateSpec.checks.forEach(check => {
                    const status = check.pass ? '✅' : '❌';
                    logLines.push(`${status} ${check.name}: ${check.pattern || check.desc || ''}`);
                });
            }
            if (details) {
                logLines.push('');
                logLines.push(`=== DETAILS ===`);
                logLines.push(details);
            }
            logLines.push('');
            logLines.push(`=== NEXT ===`);
            logLines.push(nextCmd);
            logLines.push('');
            logLines.push(`=== GUARD ===`);
            logLines.push(getGuardLogLine());

            logPath = saveLog({
                projectRoot,
                iteration: typeof iteration === 'number' ? iteration : parseInt((iteration || 'iter-1').replace('iter-', '')),
                phase, step, type: 'error',
                content: logLines.join('\n'),
                story
            });
        } catch (e) { /* 忽略 */ }
    }

    if (logPath) {
        console.log(`@READ: ${logPath}`);
        console.log(`  ↳ 包含: 錯誤詳情 + GATE_SPEC + 修復建議`);
    }
    console.log(`NEXT: ${nextCmd}`);
    console.log(getGuardLine());
    console.log('');

    // 記錄到 project-memory
    if (projectMemory && projectRoot) {
        try {
            projectMemory.recordEntry(projectRoot, {
                phase, step, story, iteration,
                verdict: 'BLOCKER', signal: '@BLOCK',
                summary: summary.substring(0, 100),
                missing, target: targetFile
            });
        } catch (e) { /* 忽略 */ }
    }
}

module.exports = {
    getLogsDir,
    ensureLogsDir,
    saveLog,
    outputPass,
    outputError,
    outputTemplate,
    outputStructured,
    // 錨點輸出 (v1.5-v2.5, 向後相容)
    anchorOutput,
    anchorPass,
    anchorError,
    anchorErrorSpec,
    anchorTemplatePending,
    emitTaskBlock,
    // v3.1 統一 Emit 函式 (推薦使用)
    emitPass,
    emitFix,
    emitFill,
    emitBlock,
    // P4: @GUARD 可配置化
    setGuardRules,
    getGuardLine,
    getGuardLogLine,
};
