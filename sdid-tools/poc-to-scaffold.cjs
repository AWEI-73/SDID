#!/usr/bin/env node
/**
 * POC-to-Scaffold v1.0 — 從 poc-consolidation-log.md 產出 .ts/.tsx 骨架檔
 *
 * POC-FIX 路線的骨架遷移工具，對齊 plan-to-scaffold.cjs 的輸出格式。
 * 讀取 consolidation-log 的映射表，為每個目標檔案產出帶 GEMS 標籤的骨架。
 *
 * 用法:
 *   node sdid-tools/poc-to-scaffold.cjs --log=<consolidation-log.md> --target=<project> [--dry-run]
 *
 * 輸出:
 *   {target}/src/... 骨架 .ts/.tsx 檔（帶 GEMS 標籤 + export 簽名）
 */

'use strict';
const fs = require('fs');
const path = require('path');
const { parseConsolidationLog } = require('./lib/consolidation-parser.cjs');

// ============================================
// 參數解析
// ============================================
function parseArgs() {
  const args = { log: null, target: null, dryRun: false, help: false };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--log='))    args.log    = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--target=')) args.target = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg === '--dry-run')    args.dryRun  = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

// ============================================
// 從函式名推斷 Priority（POC-FIX 沒有 Plan，預設 P1）
// gemsId 有值 → P1（後端核心），空白 → P2（前端/雜項）
// ============================================
function inferPriority(mapping) {
  return mapping.gemsId ? 'P1' : 'P2';
}

// ============================================
// 從函式描述提取乾淨的函式名
// "extractPDF() → extractImagesFromPage()" → "extractImagesFromPage"
// "reconstructQuestions()" → "reconstructQuestions"
// "UI 原型（直接搬 HTML 結構）" → null（非函式）
// ============================================
function extractFunctionName(funcDesc) {
  // 如果有箭頭，取最後一個
  const parts = funcDesc.split('→').map(s => s.trim());
  const last = parts[parts.length - 1];
  const m = last.match(/^(\w+)\s*\(/);
  return m ? m[1] : null;
}

// ============================================
// 從 targetFile 推斷副檔名和類型
// ============================================
function inferType(targetFile, gemsId) {
  if (targetFile.endsWith('.tsx')) return 'UI';
  if (gemsId && gemsId.includes('.')) {
    // gemsId 格式: Module.Action → SVC
    return 'SVC';
  }
  return 'SVC';
}

// ============================================
// 骨架生成（對齊 plan-to-scaffold 格式）
// ============================================
function generateScaffoldFromLog(logPath, targetDir, options = {}) {
  const { dryRun = false } = options;
  const result = { generated: [], skipped: [], errors: [] };

  if (!fs.existsSync(logPath)) {
    result.errors.push(`Consolidation log 不存在: ${logPath}`);
    return result;
  }

  const parsed = parseConsolidationLog(logPath);
  if (parsed.mappings.length === 0) {
    result.errors.push('Consolidation log 中找不到任何映射');
    return result;
  }

  // 按 targetFile 分組（同一個檔案可能有多個函式）
  const fileGroups = {};
  for (const m of parsed.mappings) {
    const key = m.targetFile;
    if (!fileGroups[key]) fileGroups[key] = [];
    fileGroups[key].push(m);
  }

  for (const [targetFile, mappings] of Object.entries(fileGroups)) {
    const fullPath = path.join(targetDir, targetFile);

    // 已存在就跳過
    if (fs.existsSync(fullPath)) {
      result.skipped.push(`${targetFile} (exists)`);
      continue;
    }

    const ext = targetFile.endsWith('.tsx') ? 'tsx' : 'ts';
    const isReact = ext === 'tsx';
    const lines = [];

    lines.push(`// ${targetFile} (由 poc-to-scaffold 自動生成 | POC-FIX iter-${parsed.iter})`);
    lines.push('');

    // imports
    if (isReact) {
      lines.push(`import React from 'react';`);
      lines.push('');
    }

    // 每個函式一個 GEMS 標籤 + export
    for (const m of mappings) {
      const funcName = extractFunctionName(m.functions);
      if (!funcName) {
        // 非函式（如 UI 原型），產一個 placeholder component
        if (isReact) {
          const compName = path.basename(targetFile, path.extname(targetFile));
          lines.push('/**');
          lines.push(` * GEMS: ${compName} | P2 | ○○ | ()→JSX | POC-FIX | ${m.functions}`);
          lines.push(` * GEMS-FLOW: Render`);
          lines.push(` * GEMS-DEPS: 無`);
          lines.push(` * GEMS-DEPS-RISK: LOW`);
          lines.push(` * GEMS-TEST: - Unit | - Integration | - E2E`);
          lines.push(` * GEMS-TEST-FILE: TODO.test.ts`);
          lines.push(' */');
          lines.push(`export default function ${compName}() {`);
          lines.push(`  throw new Error('Not implemented — POC-FIX iter-${parsed.iter}');`);
          lines.push('}');
          lines.push('');
        }
        continue;
      }

      const priority = inferPriority(m);
      const type = inferType(targetFile, m.gemsId);
      const gemsIdComment = m.gemsId ? ` [${m.gemsId}]` : '';

      lines.push('/**');
      lines.push(` * GEMS: ${funcName} | ${priority} | ○○ | (args)→Result | POC-FIX | ${m.functions}${gemsIdComment}`);
      lines.push(` * GEMS-FLOW: TODO`);
      lines.push(` * GEMS-DEPS: 無`);
      lines.push(` * GEMS-DEPS-RISK: LOW`);
      lines.push(` * GEMS-TEST: ✓ Unit | - Integration | - E2E`);
      lines.push(` * GEMS-TEST-FILE: TODO.test.ts`);
      lines.push(' */');

      if (type === 'API') {
        lines.push(`export async function ${funcName}(/* TODO */): Promise<unknown> {`);
      } else {
        lines.push(`export function ${funcName}(/* TODO */): unknown {`);
      }
      lines.push(`  throw new Error('Not implemented — POC-FIX iter-${parsed.iter}');`);
      lines.push('}');
      lines.push('');
    }

    if (dryRun) {
      result.generated.push({ file: targetFile, functions: mappings.length, content: lines.join('\n') });
    } else {
      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, lines.join('\n'), 'utf8');
      result.generated.push({ file: targetFile, functions: mappings.length });
    }
  }

  return result;
}

// ============================================
// 主程式
// ============================================
function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
POC-to-Scaffold v1.0 — 從 poc-consolidation-log.md 產出骨架檔

用法:
  node sdid-tools/poc-to-scaffold.cjs --log=<consolidation-log.md> --target=<project>

選項:
  --log=<path>      poc-consolidation-log.md 路徑 (必填)
  --target=<path>   專案根目錄 (必填)
  --dry-run         預覽模式，不寫入檔案
  --help            顯示此訊息
`);
    process.exit(0);
  }

  if (!args.log || !args.target) {
    const missing = [!args.log && '--log', !args.target && '--target'].filter(Boolean);
    console.error(`❌ 缺少必要參數: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log(`\n🦴 POC-to-Scaffold v1.0`);
  console.log(`   Log: ${path.relative(args.target, args.log)}`);
  console.log(`   Target: ${args.target}`);
  if (args.dryRun) console.log(`   Mode: dry-run`);
  console.log('');

  const result = generateScaffoldFromLog(args.log, args.target, { dryRun: args.dryRun });

  if (result.errors.length > 0) {
    for (const e of result.errors) console.error(`❌ ${e}`);
    process.exit(1);
  }

  for (const g of result.generated) {
    if (args.dryRun) {
      console.log(`   ✅ ${g.file} (${g.functions} 函式) — dry-run`);
      console.log('   ─── 預覽 ───');
      console.log(g.content);
      console.log('   ─── /預覽 ───');
    } else {
      console.log(`   ✅ ${g.file} (${g.functions} 函式)`);
    }
  }
  for (const s of result.skipped) console.log(`   ⏭️  ${s}`);

  console.log('');
  const genCount = result.generated.length;
  const skipCount = result.skipped.length;
  console.log(`📊 結果: ${genCount} 生成, ${skipCount} 跳過`);

  if (!args.dryRun && genCount > 0) {
    const changedFiles = result.generated.map(g => g.file).join(',');
    console.log(`\n下一步: node sdid-tools/micro-fix-gate.cjs --changed=${changedFiles} --target=${path.relative(process.cwd(), args.target) || '.'}`);
  }
}

module.exports = { generateScaffoldFromLog };

if (require.main === module) {
  main();
}
