#!/usr/bin/env node
/**
 * Plan-to-Scaffold v1.0 - 從 Implementation Plan 直接產出 .ts/.tsx 骨架檔
 *
 * 適用場景：
 *   - Task-Pipe 路線（沒有藍圖，plan 由 PLAN 階段手寫）
 *   - 補生成骨架（draft-to-plan 跑過但骨架遺失）
 *
 * 用法:
 *   node sdid-tools/plan-to-scaffold.cjs --plan=<path> --target=<project>
 *   node sdid-tools/plan-to-scaffold.cjs --plan=<path> --target=<project> --dry-run
 *
 * 輸出:
 *   {target}/src/... 骨架 .ts/.tsx 檔（帶完整 GEMS 標籤 + AC + STEP 錨點 + export 簽名）
 */

'use strict';
const fs = require('fs');
const path = require('path');

const { extractPlanSpec, extractFileManifest } = require('../task-pipe/lib/plan/plan-spec-extractor.cjs');

// ============================================
// 參數解析
// ============================================
function parseArgs() {
  const args = { plan: null, target: null, dryRun: false, help: false };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--plan='))   args.plan   = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--target=')) args.target = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg === '--dry-run')    args.dryRun  = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

// ============================================
// 輔助：從 FLOW 字串生成 [STEP] 錨點行
// ============================================
function flowToStepLines(flow) {
  if (!flow) return [];
  return flow.split('→').map(s => s.trim()).filter(Boolean).map(s => `// [STEP] ${s}`);
}

// ============================================
// 輔助：從 plan 的 Item 區塊提取 AC 行
// ============================================
function extractACLines(planContent, funcName) {
  // 找包含該函式的 Item 區塊
  const marker = '### Item ';
  let pos = 0;
  while (true) {
    const idx = planContent.indexOf(marker, pos);
    if (idx === -1) break;

    const nextItem = planContent.indexOf(marker, idx + marker.length);
    const nextSection = planContent.indexOf('\n## ', idx + 1);
    let blockEnd = planContent.length;
    if (nextItem !== -1) blockEnd = Math.min(blockEnd, nextItem);
    if (nextSection !== -1) blockEnd = Math.min(blockEnd, nextSection);
    const block = planContent.substring(idx, blockEnd);

    const hasFunc = block.includes(`GEMS: ${funcName} `) || block.includes(`GEMS: ${funcName}|`);
    if (hasFunc) {
      // 找 **驗收條件**: AC-X.Y ... 行
      const acMatch = block.match(/\*\*驗收條件\*\*[：:]\s*(AC-[\d.,\s]+)/i);
      if (acMatch) {
        // 支援多個 AC（逗號分隔）
        return acMatch[1].split(/[,;]\s*/).map(s => s.trim()).filter(Boolean).map(s => `// ${s}`);
      }
      break;
    }
    pos = idx + marker.length;
  }
  return [];
}

// ============================================
// 骨架生成
// ============================================
function generateScaffoldFromPlan(planPath, targetDir, options = {}) {
  const { dryRun = false } = options;
  const result = { generated: [], skipped: [], errors: [] };

  if (!fs.existsSync(planPath)) {
    result.errors.push(`Plan 不存在: ${planPath}`);
    return result;
  }

  const planContent = fs.readFileSync(planPath, 'utf8');

  // 從 plan 提取完整 GEMS 規格（含 flow, deps, test, testFile）
  const spec = extractPlanSpec(planPath);
  // 從 plan 提取精確檔案路徑（Item 的檔案表格）
  const fileManifest = extractFileManifest(planPath);

  // 建立 funcName → filePath 映射
  const fileMap = {};
  for (const f of fileManifest.files) {
    fileMap[f.functionName.toLowerCase()] = f.path;
  }

  // 從 plan 檔名推導 storyId
  const storyMatch = path.basename(planPath).match(/implementation_plan_(Story-[\d.]+)\.md/i);
  const storyId = storyMatch ? storyMatch[1] : 'Story-X.Y';

  if (spec.functions.length === 0) {
    result.errors.push('Plan 中找不到任何 GEMS 函式規格');
    return result;
  }

  for (const fn of spec.functions) {
    const filePath = fileMap[fn.name.toLowerCase()] || '';

    if (!filePath) {
      result.skipped.push(`${fn.name} (找不到檔案路徑)`);
      continue;
    }

    const fullPath = path.join(targetDir, filePath);

    // 已存在就跳過（不覆蓋）
    if (fs.existsSync(fullPath)) {
      result.skipped.push(`${fn.name} (exists: ${filePath})`);
      continue;
    }

    const isTsx = filePath.endsWith('.tsx');

    // AC 行
    const acLines = extractACLines(planContent, fn.name);

    // STEP 錨點
    const stepLines = flowToStepLines(fn.flow);

    // 組裝骨架
    const lines = [
      `// ${filePath} (由 plan-to-scaffold 自動生成)`,
      '',
      '/**',
      ` * GEMS: ${fn.name} | ${fn.priority} | ○○ | (args)→Result | ${storyId} | ${fn.description || fn.name}`,
      ` * GEMS-FLOW: ${fn.flow || 'TODO'}`,
      ` * GEMS-DEPS: ${fn.deps || '無'}`,
      ` * GEMS-DEPS-RISK: ${fn.depsRisk || 'LOW'}`,
      ` * GEMS-TEST: ${fn.test || '✓ Unit | - Integration | - E2E'}`,
      ` * GEMS-TEST-FILE: ${fn.testFile || 'TODO.test.ts'}`,
      ' */',
      ...acLines,
      ...stepLines,
    ];

    if (isTsx) {
      lines.push(`export default function ${fn.name}() {`);
      lines.push(`  throw new Error('Not implemented — ${storyId}');`);
      lines.push('}');
    } else {
      lines.push(`export function ${fn.name}(/* TODO */) {`);
      lines.push(`  throw new Error('Not implemented — ${storyId}');`);
      lines.push('}');
    }
    lines.push('');

    if (dryRun) {
      result.generated.push(`${fn.name} → ${filePath} (dry-run)`);
    } else {
      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, lines.join('\n'), 'utf8');
      result.generated.push(`${fn.name} → ${filePath}`);
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
Plan-to-Scaffold v1.0 - 從 Implementation Plan 產出 .ts/.tsx 骨架檔

用法:
  node sdid-tools/plan-to-scaffold.cjs --plan=<path> --target=<project>

選項:
  --plan=<path>     implementation_plan_Story-X.Y.md 路徑 (必填)
  --target=<path>   專案根目錄 (必填)
  --dry-run         預覽模式，不寫入檔案
  --help            顯示此訊息
`);
    process.exit(0);
  }

  if (!args.plan || !args.target) {
    const missing = [!args.plan && '--plan', !args.target && '--target'].filter(Boolean);
    console.error(`❌ 缺少必要參數: ${missing.join(', ')}`);
    console.error(`   範例: node sdid-tools/plan-to-scaffold.cjs --plan=.gems/iterations/iter-1/plan/implementation_plan_Story-1.0.md --target=.`);
    process.exit(1);
  }

  const storyMatch = path.basename(args.plan).match(/implementation_plan_(Story-[\d.]+)\.md/i);
  const storyId = storyMatch ? storyMatch[1] : path.basename(args.plan);

  console.log(`\n🦴 Plan-to-Scaffold v1.0`);
  console.log(`   Plan: ${path.relative(args.target, args.plan)}`);
  console.log(`   Story: ${storyId}`);
  console.log(`   Target: ${args.target}`);
  if (args.dryRun) console.log(`   Mode: dry-run`);
  console.log('');

  const result = generateScaffoldFromPlan(args.plan, args.target, { dryRun: args.dryRun });

  if (result.errors.length > 0) {
    for (const e of result.errors) console.error(`❌ ${e}`);
    process.exit(1);
  }

  for (const g of result.generated) console.log(`   ✅ ${g}`);
  for (const s of result.skipped)   console.log(`   ⏭️  ${s}`);

  console.log('');
  console.log(`📊 結果: ${result.generated.length} 生成, ${result.skipped.length} 跳過`);

  if (!args.dryRun && result.generated.length > 0) {
    console.log(`\n下一步: node task-pipe/runner.cjs --phase=BUILD --step=2 --story=${storyId} --target=${path.relative(process.cwd(), args.target) || '.'}`);
  }
}

module.exports = { generateScaffoldFromPlan };

if (require.main === module) {
  main();
}
