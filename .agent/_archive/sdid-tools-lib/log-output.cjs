/**
 * SDID Log Output - 精簡終端輸出 + 詳情存檔
 * 
 * 與 task-pipe/lib/shared/log-output.cjs 相同 API，但完全獨立實作。
 * 設計原則:
 * 1. 成功輸出 → 一行 @PASS
 * 2. 錯誤輸出 → 結論優先 + 詳情存檔
 * 3. log 檔名格式與 task-pipe 一致，寫入同一個 .gems/iterations/iter-X/logs/
 * 
 * Blueprint Flow phase 映射:
 *   blueprint-gate   → gate-check
 *   draft-to-plan    → gate-plan
 *   blueprint-shrink → gate-shrink
 *   blueprint-expand → gate-expand
 *   blueprint-verify → gate-verify
 */

const fs = require('fs');
const path = require('path');

// P4: @GUARD 可配置化 (與 task-pipe 同步)
let GUARD_FORBIDDEN = 'task-pipe/ sdid-tools/';
let GUARD_ALLOWED = '專案檔案';

function setGuardRules(rules) {
  if (rules.forbidden) GUARD_FORBIDDEN = rules.forbidden;
  if (rules.allowed) GUARD_ALLOWED = rules.allowed;
}

function getGuardLine(targetFile) {
  const allowed = targetFile || GUARD_ALLOWED;
  return `@GUARD: 🚫 ${GUARD_FORBIDDEN} | ✅ ${allowed}`;
}

function getGuardLogLine() {
  return `🚫 禁止修改 ${GUARD_FORBIDDEN} | ✅ 只能修改 TARGET 檔案`;
}

// ============================================
// 基礎設施
// ============================================

/**
 * 取得 logs 目錄路徑
 */
function getLogsDir(projectRoot, iterationNumber = 1) {
  return path.join(projectRoot, '.gems', 'iterations', `iter-${iterationNumber}`, 'logs');
}

/**
 * 確保 logs 目錄存在
 */
function ensureLogsDir(logsDir) {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

/**
 * 產生 log 檔案名稱 (與 task-pipe 格式一致)
 */
function getLogFileName(phase, step, type = 'error', story = null) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  if (story) {
    return `${phase}-${step}-${story}-${type}-${timestamp}.log`;
  }
  return `${phase}-${step}-${type}-${timestamp}.log`;
}

/**
 * 儲存 log 到檔案
 * @returns {string} 相對路徑
 */
function saveLog(options) {
  const { projectRoot, iteration = 1, phase, step, type = 'error', content, story = null } = options;

  const logsDir = getLogsDir(projectRoot, iteration);
  ensureLogsDir(logsDir);

  const fileName = getLogFileName(phase, step, type, story);
  const filePath = path.join(logsDir, fileName);

  fs.writeFileSync(filePath, content, 'utf8');
  return path.relative(projectRoot, filePath);
}


// ============================================
// 快速輸出 (一行版本)
// ============================================

/**
 * 快速成功輸出
 */
function anchorPass(phase, step, summary, nextCommand, options = {}) {
  console.log(`@PASS | ${phase} ${step} | ${summary}`);
  console.log(`NEXT: ${nextCommand}`);

  if (options.projectRoot) {
    try {
      saveLog({
        projectRoot: options.projectRoot,
        iteration: options.iteration || 1,
        phase: options.phase || phase,
        step: options.step || step,
        type: 'pass',
        content: `@PASS | ${phase} ${step} | ${summary}\nNEXT: ${nextCommand}`,
        story: options.story || null,
      });
    } catch (err) { /* ignore */ }
  }
}

/**
 * 快速錯誤輸出
 */
function anchorError(type, summary, nextCommand, options = {}) {
  const { attempt, maxAttempts, details, projectRoot, iteration, phase, step, context, story } = options;
  const attemptInfo = attempt ? ` (${attempt}/${maxAttempts || 3})` : '';

  console.log(`@${type}${attemptInfo} | ${summary}`);
  console.log(`NEXT: ${nextCommand}`);

  if (projectRoot && phase && step) {
    try {
      const logLines = [];
      if (context) logLines.push(`@CONTEXT\n${context}`);
      logLines.push(`@${type}${attemptInfo}\n${summary}`);
      logLines.push(`NEXT: ${nextCommand}`);
      if (details) logLines.push(`\n詳情:\n${details}`);

      const logPath = saveLog({
        projectRoot,
        iteration: typeof iteration === 'number' ? iteration : parseInt((iteration || 'iter-1').replace('iter-', '')),
        phase,
        step,
        type: 'error',
        content: logLines.join('\n\n'),
        story: story || null,
      });

      // v3.0: 使用 @READ 強制 AI 讀取 log
      console.log(`@READ: ${logPath}`);
      console.log(`  ↳ 包含: 錯誤詳情 + 修復指引`);
    } catch (err) { /* ignore */ }
  }

  // 施工紅線 (統一為 @GUARD)
  console.log('');
  console.log(getGuardLine());
}

// ============================================
// 錨點輸出 (完整版本)
// ============================================

/**
 * 錨點輸出 - 精簡終端 + 長模板自動存檔
 * API 與 task-pipe/lib/shared/log-output.cjs 的 anchorOutput 一致
 */
function anchorOutput(sections, options = {}) {
  const { context, info, guide, rules, task, template, gemsTemplate, error, output } = sections;
  const { projectRoot, iteration = 1, phase, step, story = null } = options;

  if (context) {
    console.log(`@CONTEXT\n${context}\n`);
  }

  if (info) {
    console.log('@INFO');
    Object.entries(info).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    console.log('');
  }

  if (guide) {
    const title = guide.title || 'GUIDE';
    console.log(`@${title}`);
    console.log(guide.content);
    console.log('');
  }

  if (sections.frontendSpecs) {
    console.log(sections.frontendSpecs);
    console.log('');
  }

  if (sections.planSpecs) {
    console.log(sections.planSpecs);
    console.log('');
  }

  if (rules && Array.isArray(rules)) {
    console.log('@RULES');
    rules.forEach(rule => console.log(`- ${rule}`));
    console.log('');
  }

  if (task && Array.isArray(task)) {
    console.log('@TASK');
    task.forEach((t, i) => console.log(`${i + 1}. ${t}`));
    console.log('');
  }

  // @TEMPLATE - 存檔 + 印出
  if (template?.content) {
    const title = template.title || 'TEMPLATE';
    const desc = template.description ? ` (${template.description})` : '';

    if (projectRoot) {
      try {
        const logPath = saveLog({
          projectRoot, iteration, phase, step,
          type: 'template',
          content: template.content,
          story,
        });
        console.log(`@LOG: ${logPath}`);
      } catch (err) { /* ignore */ }
    }

    console.log(`@${title}${desc}`);
    console.log(template.content);
    console.log('');
  }

  if (gemsTemplate) {
    console.log('@TEMPLATE (GEMS 標籤 v2.1)');
    console.log(gemsTemplate);
    console.log('');
  }

  if (error) {
    let tag = error.type || 'ITERATION_ADVICE';
    let icon = '💡';
    if (tag === 'BLOCKER') { tag = 'ARCHITECTURE_REVIEW'; icon = '📐'; }
    else if (tag === 'TACTICAL_FIX') { tag = 'ITERATION_ADVICE'; icon = '🛠️'; }

    const attemptInfo = error.attempt ? ` (${error.attempt}/${error.maxAttempts || 3})` : '';
    console.log(`${icon} @${tag}${attemptInfo}`);
    console.log(error.summary);
    if (error.detail) {
      console.log(`架構延伸資料: ${error.detail}`);
    }
    console.log('');
  }

  if (output) {
    console.log('@OUTPUT');
    console.log(output);
  }

  // 施工紅線 (統一為 @GUARD)
  if (error) {
    console.log('');
    console.log(getGuardLine());
    console.log('');
  }

  // 統一存檔
  if (projectRoot && phase && step) {
    try {
      const logLines = [];
      if (context) logLines.push(`@CONTEXT\n${context}`);
      if (info) {
        logLines.push('@INFO');
        Object.entries(info).forEach(([key, value]) => {
          logLines.push(`  ${key}: ${value}`);
        });
      }
      if (guide) logLines.push(`@${guide.title || 'GUIDE'}\n${guide.content}`);
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

      let logType = 'info';
      if (error?.type === 'BLOCKER') logType = 'error';
      else if (error?.type === 'TACTICAL_FIX') logType = 'fix';
      else if (output?.includes('下一步') || output?.includes('重新執行')) logType = 'pending';

      saveLog({
        projectRoot, iteration, phase, step,
        type: logType,
        content: logLines.join('\n\n'),
        story,
      });
    } catch (err) { /* ignore */ }
  }
}


// ============================================
// 精準錯誤輸出 (Point-to-Point)
// ============================================

/**
 * 精準錯誤輸出 - 讓 AI 只看這個就知道要做什麼
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
        projectRoot, iteration, phase, step,
        type: 'error-spec',
        content: logContent,
        story,
      });
    } catch (err) { /* ignore */ }
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
 * Template 待填寫輸出
 */
function anchorTemplatePending(spec, options = {}) {
  const { targetFile, templateContent, fillItems, nextCmd, gateSpec } = spec;
  const { projectRoot, iteration = 1, phase, step, story = null } = options;

  // === 終端輸出 (精簡 — 模板在 log) ===
  console.log('');
  console.log(`@TEMPLATE_PENDING | ${phase || ''} ${step || ''} | 需填寫 ${fillItems.length} 個項目`);
  console.log(`TARGET: ${targetFile}`);

  // 列出填寫項目 (保留在終端，因為很短)
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
        projectRoot, iteration, phase, step,
        type: 'template',
        content: logContent,
        story,
      });
    } catch (err) { /* ignore */ }
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

// ============================================
// 向後相容: outputPass / outputError
// ============================================

function outputPass(nextCommand, summary = '') {
  if (summary) console.log(`@PASS | ${summary}`);
  console.log(`NEXT: ${nextCommand}`);
}

function outputError(options) {
  const { type = 'TACTICAL_FIX', summary, nextCommand, details, projectRoot, iteration = 1, phase, step } = options;
  console.log(`@${type} | ${summary}`);
  console.log(`NEXT: ${nextCommand}`);
  if (details && projectRoot) {
    const logPath = saveLog({ projectRoot, iteration, phase, step, type: 'error', content: details });
    console.log(`@READ: ${logPath}`);
    console.log(`  ↳ 包含: 錯誤詳情`);
  }
}

// ============================================
// v3.1 統一 Emit 函式 (與 task-pipe 同步)
// ============================================

// project-memory 整合（可選）
let projectMemory = null;
try {
  const pmPath = require('path').resolve(__dirname, '../../task-pipe/lib/shared/project-memory.cjs');
  if (require('fs').existsSync(pmPath)) {
    projectMemory = require(pmPath);
  }
} catch (e) { /* 可選 */ }

/**
 * emitPass — 成功輸出 + 進度提示
 */
function emitPass(spec, options = {}) {
  const { scope, summary, nextCmd, progress, nextHint } = spec;
  const { projectRoot, iteration, phase, step, story } = options;

  console.log(`@PASS | ${scope} | ${summary}`);
  if (progress) console.log(`PROGRESS: ${progress}`);
  console.log(`NEXT: ${nextCmd}`);
  if (nextHint) console.log(`  ↳ ${nextHint}`);

  if (projectRoot && phase && step) {
    try {
      saveLog({
        projectRoot,
        iteration: typeof iteration === 'number' ? iteration : parseInt((iteration || 'iter-1').replace('iter-', '')),
        phase, step, type: 'pass',
        content: `@PASS | ${scope} | ${summary}\nNEXT: ${nextCmd}`,
        story
      });
    } catch (e) { /* 忽略 */ }
  }
}

/**
 * emitFix — 可修復錯誤
 */
function emitFix(spec, options = {}) {
  const { scope, summary, targetFile, missing = [], nextCmd,
          example, gateSpec, attempt, maxAttempts, tasks } = spec;
  const { projectRoot, iteration, phase, step, story } = options;

  const attemptInfo = attempt ? ` (${attempt}/${maxAttempts || 3})` : '';

  console.log('');
  console.log(`@FIX${attemptInfo} | ${scope} | ${summary}`);
  if (targetFile) console.log(`TARGET: ${targetFile}`);

  if (projectMemory && projectRoot && phase && step) {
    try {
      const hint = projectMemory.getHistoricalHint(projectRoot, phase, step, story);
      if (hint.hint) console.log(`@HINT: ${hint.hint} (${hint.count} 次)`);
    } catch (e) { /* 忽略 */ }
  }

  if (tasks && tasks.length > 0) {
    tasks.forEach((t, i) => {
      console.log(`@TASK-${i + 1}`);
      console.log(`  ACTION: ${t.action}`);
      console.log(`  FILE: ${t.file}`);
      if (t.expected) console.log(`  EXPECTED: ${t.expected}`);
    });
    console.log('');
  }

  let logPath = null;
  if (projectRoot && phase && step) {
    try {
      const logLines = [];
      logLines.push(`=== SIGNAL ===\n@FIX${attemptInfo} | ${scope} | ${summary}\n`);
      logLines.push(`=== TARGET ===\nFILE: ${targetFile || '(none)'}\nMISSING: ${missing.join(', ')}`);
      if (gateSpec && gateSpec.checks) {
        logLines.push('\n=== GATE_SPEC ===');
        gateSpec.checks.forEach(c => logLines.push(`${c.pass ? '✅' : '❌'} ${c.name}: ${c.pattern || c.desc || ''}`));
      }
      if (example) logLines.push(`\n=== EXAMPLE (可直接複製) ===\n${example}`);
      logLines.push(`\n=== NEXT ===\n${nextCmd}`);
      logLines.push(`\n=== GUARD ===\n${getGuardLogLine()}`);

      logPath = saveLog({
        projectRoot,
        iteration: typeof iteration === 'number' ? iteration : parseInt((iteration || 'iter-1').replace('iter-', '')),
        phase, step, type: 'error', content: logLines.join('\n'), story
      });
    } catch (e) { /* 忽略 */ }
  }

  if (logPath) {
    console.log(`@READ: ${logPath}`);
    console.log(`  ↳ 包含: MISSING 明細 + 修復範例 + GATE_SPEC`);
  }
  console.log(`NEXT: ${nextCmd}`);
  if (!attempt || attempt <= 1) {
    console.log(getGuardLine());
  }
  console.log('');
}

/**
 * emitFill — 需要填空的模板
 */
function emitFill(spec, options = {}) {
  const { scope, summary, targetFile, fillItems = [], nextCmd, templateContent, gateSpec } = spec;
  const { projectRoot, iteration, phase, step, story } = options;

  console.log('');
  console.log(`@FILL | ${scope} | ${summary}`);
  console.log(`TARGET: ${targetFile}`);
  console.log('FILL_ITEMS:');
  fillItems.forEach((item, i) => console.log(`  ${i + 1}. ${item}`));

  let logPath = null;
  if (projectRoot && phase && step) {
    try {
      const logLines = [];
      logLines.push(`=== SIGNAL ===\n@FILL | ${scope} | ${summary}\n`);
      logLines.push(`=== TARGET ===\nFILE: ${targetFile}`);
      if (gateSpec && gateSpec.checks) {
        logLines.push('\n=== GATE_SPEC ===');
        gateSpec.checks.forEach(c => logLines.push(`⏳ ${c.name}: ${c.pattern || c.desc || ''}`));
      }
      logLines.push(`\n=== FILL_ITEMS ===\n${fillItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}`);
      if (templateContent) logLines.push(`\n=== TEMPLATE (可直接複製) ===\n${templateContent}`);
      logLines.push(`\n=== NEXT ===\n${nextCmd}`);
      logLines.push(`\n=== GUARD ===\n${getGuardLogLine()}`);

      logPath = saveLog({
        projectRoot,
        iteration: typeof iteration === 'number' ? iteration : parseInt((iteration || 'iter-1').replace('iter-', '')),
        phase, step, type: 'template', content: logLines.join('\n'), story
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
 * emitBlock — 結構性阻擋
 */
function emitBlock(spec, options = {}) {
  const { scope, summary, nextCmd, targetFile, missing = [], details, gateSpec } = spec;
  const { projectRoot, iteration, phase, step, story } = options;

  console.log('');
  console.log(`@BLOCK | ${scope} | ${summary}`);
  if (targetFile) console.log(`TARGET: ${targetFile}`);

  if (projectMemory && projectRoot && phase && step) {
    try {
      const hint = projectMemory.getHistoricalHint(projectRoot, phase, step, story);
      if (hint.hint) console.log(`@HINT: ${hint.hint} (${hint.count} 次)`);
    } catch (e) { /* 忽略 */ }
  }

  let logPath = null;
  if (projectRoot && phase && step) {
    try {
      const logLines = [];
      logLines.push(`=== SIGNAL ===\n@BLOCK | ${scope} | ${summary}`);
      if (targetFile) logLines.push(`\n=== TARGET ===\nFILE: ${targetFile}\nMISSING: ${missing.join(', ')}`);
      if (gateSpec && gateSpec.checks) {
        logLines.push('\n=== GATE_SPEC ===');
        gateSpec.checks.forEach(c => logLines.push(`${c.pass ? '✅' : '❌'} ${c.name}: ${c.pattern || c.desc || ''}`));
      }
      if (details) logLines.push(`\n=== DETAILS ===\n${details}`);
      logLines.push(`\n=== NEXT ===\n${nextCmd}`);
      logLines.push(`\n=== GUARD ===\n${getGuardLogLine()}`);

      logPath = saveLog({
        projectRoot,
        iteration: typeof iteration === 'number' ? iteration : parseInt((iteration || 'iter-1').replace('iter-', '')),
        phase, step, type: 'error', content: logLines.join('\n'), story
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
}

// ============================================
// 導出
// ============================================
module.exports = {
  getLogsDir,
  ensureLogsDir,
  saveLog,
  outputPass,
  outputError,
  anchorOutput,
  anchorPass,
  anchorError,
  anchorErrorSpec,
  anchorTemplatePending,
  // v3.1 統一 Emit 函式
  emitPass,
  emitFix,
  emitFill,
  emitBlock,
  // P4: @GUARD 可配置化
  setGuardRules,
  getGuardLine,
  getGuardLogLine,
};
