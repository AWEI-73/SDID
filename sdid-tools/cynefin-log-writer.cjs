#!/usr/bin/env node
/**
 * Cynefin Log Writer v1.0
 * 接收 AI 產出的 cynefin review report，格式化存成 log 檔
 *
 * 用法:
 *   node sdid-tools/cynefin-log-writer.cjs --report=<json-string> --target=<project> --iter=<N>
 *   node sdid-tools/cynefin-log-writer.cjs --report-file=<path> --target=<project> --iter=<N>
 *
 * 輸出:
 *   @PASS        — 無 BLOCKER，log 存檔完成
 *   @NEEDS-FIX   — 有 BLOCKER，log 存檔完成，AI 需要修改文件後重跑
 *
 * Log 命名:
 *   cynefin-check-pass-<timestamp>.log
 *   cynefin-check-fail-<timestamp>.log
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ============================================
// 參數解析
// ============================================
function parseArgs() {
  const args = { report: null, reportFile: null, target: null, iter: 1, help: false };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--report=')) {
      args.report = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('--report-file=')) {
      args.reportFile = path.resolve(arg.split('=').slice(1).join('='));
    } else if (arg.startsWith('--target=')) {
      args.target = path.resolve(arg.split('=').slice(1).join('='));
    } else if (arg.startsWith('--iter=')) {
      args.iter = parseInt(arg.split('=')[1]) || 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }
  return args;
}

// ============================================
// Log 基礎設施
// ============================================
function getLogsDir(projectRoot, iterNum) {
  return path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'logs');
}

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ============================================
// Report 解析與驗證
// ============================================

/**
 * 解析 AI 產出的 report JSON
 * 支援兩種格式：
 *   1. JSON string (--report='{...}')
 *   2. JSON file (--report-file=path)
 */
function parseReport(args) {
  let raw;
  if (args.reportFile) {
    if (!fs.existsSync(args.reportFile)) {
      throw new Error(`Report file not found: ${args.reportFile}`);
    }
    raw = fs.readFileSync(args.reportFile, 'utf8');
  } else if (args.report) {
    raw = args.report;
  } else {
    throw new Error('需要 --report 或 --report-file 參數');
  }

  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Report JSON 解析失敗: ${e.message}`);
  }
}

/**
 * 驗證 report 結構
 * 必要欄位: route, inputFile, modules[]
 * 每個 module: name, domain, flowSteps, depsCount, issues[]
 */
function validateReport(report) {
  const errors = [];
  if (!report.route) errors.push('缺少 route (Blueprint|TaskPipe)');
  if (!report.inputFile) errors.push('缺少 inputFile');
  if (!Array.isArray(report.modules)) errors.push('缺少 modules 陣列');
  if (errors.length > 0) throw new Error(`Report 格式錯誤: ${errors.join(', ')}`);
}

// ============================================
// 分級判斷
// ============================================

/**
 * 從 modules 的 issues 判斷整體結果
 * BLOCKER → @NEEDS-FIX
 * 只有 WARNING/INFO → @PASS (帶警告)
 */
function determineResult(modules) {
  const blockers = [];
  const warnings = [];

  for (const mod of modules) {
    if (!mod.issues || mod.issues.length === 0) continue;
    for (const issue of mod.issues) {
      if (issue.level === 'BLOCKER') {
        blockers.push({ module: mod.name, issue });
      } else if (issue.level === 'WARNING') {
        warnings.push({ module: mod.name, issue });
      }
    }
  }

  return { pass: blockers.length === 0, blockers, warnings };
}

// ============================================
// Log 內容產生
// ============================================
function buildLogContent(report, result, iterNum) {
  const ts = new Date().toISOString();
  const lines = [];

  lines.push('=== CYNEFIN CHECK LOG ===');
  lines.push(`時間: ${ts}`);
  lines.push(`路線: ${report.route}`);
  lines.push(`迭代: iter-${iterNum}`);
  lines.push(`輸入文件: ${report.inputFile}`);
  lines.push(`結果: ${result.pass ? 'PASS' : 'NEEDS-FIX'}`);
  lines.push('');
  lines.push('--- 模組分析 ---');
  lines.push('');

  for (const mod of report.modules) {
    lines.push(`模組: ${mod.name}`);
    lines.push(`  域: ${mod.domain}`);

    // 三問
    if (mod.threeQuestions) {
      lines.push('  三問域識別:');
      lines.push(`    Q1 做法清楚？ → ${mod.threeQuestions.q1_clear ? '是' : '否'}`);
      lines.push(`    Q2 有參考？   → ${mod.threeQuestions.q2_reference ? '是' : '否'}`);
      lines.push(`    Q3 代價大？   → ${mod.threeQuestions.q3_costly ? '是' : '否'}`);
    }

    // 指標
    const flowOk = !mod.flowSteps || mod.flowSteps <= 7;
    const depsOk = !mod.depsCount || mod.depsCount <= 5;
    lines.push(`  FLOW 步驟: ${mod.flowSteps ?? 'N/A'}  ${flowOk ? '✓' : '⚠ 超標(閾值7)'}`);
    lines.push(`  deps 數量: ${mod.depsCount ?? 'N/A'}  ${depsOk ? '✓' : '⚠ 超標(閾值5)'}`);
    lines.push(`  時間耦合: ${mod.timeCoupling ? '⚠ Clear 等待 Complex' : '無'}`);

    // Issues
    if (mod.issues && mod.issues.length > 0) {
      lines.push('');
      for (const issue of mod.issues) {
        lines.push(`  [${issue.level}] ${issue.description}`);
        if (issue.suggestions && issue.suggestions.length > 0) {
          lines.push('  建議:');
          for (const s of issue.suggestions) {
            lines.push(`    - ${s}`);
          }
        }
        if (issue.fixTarget) {
          lines.push(`  需修改: ${issue.fixTarget}`);
        }
      }
    }
    lines.push('');
  }

  lines.push('--- 總結 ---');
  const passCount = report.modules.filter(m => !m.issues || m.issues.every(i => i.level !== 'BLOCKER')).length;
  const failCount = report.modules.length - passCount;
  lines.push(`通過模組: ${passCount}`);
  lines.push(`問題模組: ${failCount}`);

  if (result.blockers.length > 0) {
    lines.push('');
    lines.push('BLOCKER 清單:');
    for (const b of result.blockers) {
      lines.push(`  [${b.module}] ${b.issue.description}`);
    }
    lines.push('');
    lines.push('下一步: 根據上方建議修改文件，然後重跑 CYNEFIN-CHECK');
  } else {
    lines.push('');
    lines.push('下一步: 進入 PLAN');
  }

  lines.push('=========================');
  return lines.join('\n');
}

// ============================================
// 主程式
// ============================================
function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
Cynefin Log Writer v1.0

用法:
  node sdid-tools/cynefin-log-writer.cjs --report='<json>' --target=<project> [--iter=N]
  node sdid-tools/cynefin-log-writer.cjs --report-file=<path> --target=<project> [--iter=N]

Report JSON 格式:
  {
    "route": "Blueprint|TaskPipe",
    "inputFile": "path/to/draft.md",
    "modules": [
      {
        "name": "模組名",
        "domain": "Clear|Complicated|Complex",
        "threeQuestions": { "q1_clear": true, "q2_reference": false, "q3_costly": true },
        "flowSteps": 4,
        "depsCount": 2,
        "timeCoupling": false,
        "issues": [
          {
            "level": "BLOCKER|WARNING|INFO",
            "description": "問題描述",
            "suggestions": ["建議1", "建議2"],
            "fixTarget": "需修改的文件路徑"
          }
        ]
      }
    ]
  }
`);
    process.exit(0);
  }

  if (!args.target) {
    console.error('錯誤: 需要 --target 參數');
    process.exit(1);
  }

  // 解析 report
  let report;
  try {
    report = parseReport(args);
    validateReport(report);
  } catch (e) {
    console.error(`@ERROR | cynefin-log-writer | ${e.message}`);
    process.exit(1);
  }

  // 判斷結果
  const result = determineResult(report.modules);

  // 存 log
  const logsDir = getLogsDir(args.target, args.iter);
  ensureDir(logsDir);

  const ts = getTimestamp();
  const logType = result.pass ? 'pass' : 'fail';
  const logFileName = `cynefin-check-${logType}-${ts}.log`;
  const logPath = path.join(logsDir, logFileName);
  const logContent = buildLogContent(report, result, args.iter);

  fs.writeFileSync(logPath, logContent, 'utf8');

  const relPath = path.relative(args.target, logPath);

  // 終端輸出
  if (result.pass) {
    console.log(`@PASS | cynefin-check | ${report.modules.length} 個模組全部通過`);
    if (result.warnings.length > 0) {
      console.log(`  ⚠ ${result.warnings.length} 個 WARNING（不阻擋流程）`);
      for (const w of result.warnings) {
        console.log(`    [${w.module}] ${w.issue.description}`);
      }
    }
    console.log(`  Log: ${relPath}`);
    console.log(`NEXT: 進入 PLAN`);
    process.exit(0);
  } else {
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`@NEEDS-FIX | cynefin-check | 發現 ${result.blockers.length} 個 BLOCKER`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    for (const b of result.blockers) {
      console.log(`  ❌ [${b.module}] ${b.issue.description}`);
      if (b.issue.suggestions) {
        for (const s of b.issue.suggestions) {
          console.log(`     → ${s}`);
        }
      }
      if (b.issue.fixTarget) {
        console.log(`     修改: ${b.issue.fixTarget}`);
      }
      console.log('');
    }
    console.log(`  Log: ${relPath}`);
    console.log('');
    console.log('修復後重跑:');
    const targetArg = `--target=${path.relative(process.cwd(), args.target) || '.'}`;
    console.log(`  node sdid-tools/cynefin-log-writer.cjs --report-file=<report.json> ${targetArg} --iter=${args.iter}`);
    console.log('═══════════════════════════════════════════════════════════');
    process.exit(1);
  }
}

main();
