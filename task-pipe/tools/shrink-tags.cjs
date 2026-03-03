#!/usr/bin/env node
/**
 * shrink-tags.cjs — GEMS 標籤 Shrink 工具
 *
 * SCAN 完成後執行，把完整 GEMS 標籤壓縮為精簡三格版：
 *
 *   完整版（BUILD 時）:
 *   /**
 *    * GEMS: calcScore | P1 | ✓✓ | (factors)→number | Story-1.0 | 計算碳排分數
 *    * GEMS-FLOW: VALIDATE→NORMALIZE→WEIGHT→SUM→RETURN
 *    * GEMS-DEPS: [SVC.factorService]
 *    * GEMS-DEPS-RISK: MEDIUM
 *    * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 *    * GEMS-TEST-FILE: calc-score.test.ts
 *    *\/
 *   // AC-1.2 (Given 係數存在 → 計算成功)
 *   // [STEP] VALIDATE
 *
 *   Shrink 後:
 *   /** GEMS: calcScore | P1 | VALIDATE→NORMALIZE→WEIGHT→SUM→RETURN *\/
 *   // src/shared/services/calc-score.ts
 *   // AC-1.2 (Given 係數存在 → 計算成功)
 *   // [STEP] VALIDATE
 *
 * 用法:
 *   node task-pipe/tools/shrink-tags.cjs --target=<project>
 *   node task-pipe/tools/shrink-tags.cjs --target=<project> --dry-run
 *   node task-pipe/tools/shrink-tags.cjs --target=<project> --src=src/modules/factor
 *
 * 規則:
 *   - 只處理有完整 GEMS 標籤（多行 /** ... *\/）的函式
 *   - 已是 shrink 格式（/** GEMS: ... *\/）的跳過
 *   - 保留 AC 行、[STEP] 錨點、函式本體
 *   - 砍掉: signature、Story、說明、DEPS、DEPS-RISK、TEST、TEST-FILE
 *   - 加入路徑行（// src/...）在 shrink 標籤後
 */

'use strict';
const fs = require('fs');
const path = require('path');

// ============================================
// 參數解析
// ============================================
function parseArgs() {
  const args = { target: null, src: null, dryRun: false, help: false };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--target='))  args.target  = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--src=')) args.src     = arg.split('=').slice(1).join('=');
    else if (arg === '--dry-run')      args.dryRun   = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

// ============================================
// 找所有 .ts / .tsx 源碼檔
// ============================================
function findSourceFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '__tests__' && !entry.name.startsWith('.')) {
        walk(full);
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')) {
        files.push(full);
      }
    }
  }
  walk(dir);
  return files;
}

// ============================================
// 解析單一檔案，找出所有完整 GEMS 標籤區塊
// 回傳: [{ commentStart, commentEnd, gemsLine, flowLine, isAlreadyShrunk }]
// ============================================
function findFullGEMSBlocks(lines) {
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // 已是 shrink 格式：/** GEMS: ... */
    if (/^\/\*\*\s*GEMS:\s*.+\*\//.test(trimmed)) {
      i++;
      continue;
    }

    // 完整版開頭：/**
    if (trimmed === '/**' || trimmed.startsWith('/**')) {
      const commentStart = i;
      let gemsLine = -1;
      let flowLine = -1;
      let commentEnd = -1;

      // 找 */ 結束行
      for (let j = i; j < Math.min(i + 30, lines.length); j++) {
        const t = lines[j].trim();
        if (t.includes('GEMS:') && !t.includes('GEMS-')) gemsLine = j;
        if (t.includes('GEMS-FLOW:')) flowLine = j;
        if (t === '*/') {
          commentEnd = j;
          break;
        }
      }

      if (commentEnd !== -1 && gemsLine !== -1) {
        blocks.push({ commentStart, commentEnd, gemsLine, flowLine });
        i = commentEnd + 1;
        continue;
      }
    }
    i++;
  }
  return blocks;
}

// ============================================
// 從 GEMS 行提取函式名稱和 Priority
// ============================================
function parseGemsLine(line) {
  // GEMS: funcName | P0 | ✓✓ | (args)→Result | Story-1.0 | 說明
  const m = line.match(/GEMS:\s*(\w+)\s*\|\s*(P[0-3])/);
  if (!m) return null;
  return { name: m[1], priority: m[2] };
}

// ============================================
// 從 GEMS-FLOW 行提取 FLOW 字串
// ============================================
function parseFlowLine(line) {
  const m = line.match(/GEMS-FLOW:\s*(.+)/);
  return m ? m[1].trim() : null;
}

// ============================================
// Shrink 單一檔案
// ============================================
function shrinkFile(filePath, projectRoot, dryRun) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const blocks = findFullGEMSBlocks(lines);

  if (blocks.length === 0) return { changed: false };

  // 計算相對路徑（用於路徑行）
  const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');

  // 從後往前替換（避免行號偏移）
  const newLines = [...lines];
  let shrunkCount = 0;

  for (const block of blocks.reverse()) {
    const { commentStart, commentEnd, gemsLine, flowLine } = block;

    const gemsInfo = parseGemsLine(lines[gemsLine]);
    if (!gemsInfo) continue;

    const flow = flowLine !== -1 ? parseFlowLine(lines[flowLine]) : null;

    // 建立 shrink 標籤行
    const shrinkTag = flow
      ? `/** GEMS: ${gemsInfo.name} | ${gemsInfo.priority} | ${flow} */`
      : `/** GEMS: ${gemsInfo.name} | ${gemsInfo.priority} */`;

    // 路徑行
    const pathLine = `// ${relPath}`;

    // 替換：commentStart ~ commentEnd 換成 shrink 標籤 + 路徑行
    newLines.splice(commentStart, commentEnd - commentStart + 1, shrinkTag, pathLine);
    shrunkCount++;
  }

  if (shrunkCount === 0) return { changed: false };

  if (!dryRun) {
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
  }

  return { changed: true, shrunkCount };
}

// ============================================
// 主程式
// ============================================
function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
shrink-tags.cjs — GEMS 標籤 Shrink 工具

用法:
  node task-pipe/tools/shrink-tags.cjs --target=<project>
  node task-pipe/tools/shrink-tags.cjs --target=<project> --dry-run
  node task-pipe/tools/shrink-tags.cjs --target=<project> --src=src/modules/factor

選項:
  --target=<path>   專案根目錄 (必填)
  --src=<subpath>   只處理指定子目錄（相對於 target/src）
  --dry-run         預覽模式，不寫入
  --help            顯示此訊息
`);
    process.exit(0);
  }

  if (!args.target) {
    console.error('❌ 缺少 --target=<path>');
    process.exit(1);
  }

  const srcRoot = args.src
    ? path.join(args.target, 'src', args.src)
    : path.join(args.target, 'src');

  if (!fs.existsSync(srcRoot)) {
    console.error(`❌ 源碼目錄不存在: ${srcRoot}`);
    process.exit(1);
  }

  console.log(`\n🗜️  shrink-tags`);
  console.log(`   Target: ${args.target}`);
  console.log(`   Src: ${srcRoot}`);
  if (args.dryRun) console.log(`   Mode: dry-run`);
  console.log('');

  const files = findSourceFiles(srcRoot);
  let totalChanged = 0;
  let totalShrunk = 0;

  for (const file of files) {
    const result = shrinkFile(file, args.target, args.dryRun);
    if (result.changed) {
      const rel = path.relative(args.target, file).replace(/\\/g, '/');
      console.log(`   ✅ ${rel} (${result.shrunkCount} 個標籤)`);
      totalChanged++;
      totalShrunk += result.shrunkCount;
    }
  }

  if (totalChanged === 0) {
    console.log('   ℹ️  沒有需要 shrink 的標籤（已是 shrink 格式或無完整標籤）');
  }

  console.log('');
  console.log(`📊 結果: ${totalChanged} 個檔案, ${totalShrunk} 個標籤 shrunk`);
}

/**
 * 程式化呼叫入口
 * @param {string} target - 專案根目錄
 * @param {object} options
 * @param {boolean} [options.dryRun]
 * @param {string} [options.src] - 子目錄（相對於 target/src）
 * @returns {{ filesChanged: number, tagsShrunken: number }}
 */
function shrinkTags(target, options = {}) {
  const { dryRun = false, src } = options;
  const srcRoot = src
    ? path.join(target, 'src', src)
    : path.join(target, 'src');

  if (!fs.existsSync(srcRoot)) return { filesChanged: 0, tagsShrunken: 0 };

  const files = findSourceFiles(srcRoot);
  let filesChanged = 0;
  let tagsShrunken = 0;

  for (const file of files) {
    const result = shrinkFile(file, target, dryRun);
    if (result.changed) {
      filesChanged++;
      tagsShrunken += result.shrunkCount;
    }
  }

  return { filesChanged, tagsShrunken };
}

module.exports = { shrinkTags, shrinkFile, findFullGEMSBlocks };

if (require.main === module) {
  main();
}
