#!/usr/bin/env node
/**
 * tag-shrink.cjs — GEMS 標籤壓縮器
 *
 * 觸發時機: BUILD Phase 8 @PASS 之後
 *
 * 功能：
 *   1. 掃描原始碼中的 // @GEMS-FUNCTION: Name + 對應 JSDoc block
 *   2. 對照 .gems/specs/*.json 字典，找出對應的 gemsId
 *   3. 將 JSDoc block 壓縮成 2 行錨點
 *   4. 計算函式新行數，更新字典 lineRange
 *   5. 更新 .gems/specs/_index.json
 *
 * 用法:
 *   node sdid-tools/tag-shrink.cjs --target=<file> --project=<projectRoot>
 *   node sdid-tools/tag-shrink.cjs --target=<file> --project=<projectRoot> --dry-run
 *
 * 輸出:
 *   壓縮後的原始碼（原檔覆寫）+ 字典更新
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ──────────────────────────────────────────
// 參數解析
// ──────────────────────────────────────────

function parseArgs() {
  const args = { target: null, project: null, dryRun: false, help: false };
  for (const arg of process.argv.slice(2)) {
    if      (arg.startsWith('--target='))  args.target  = path.resolve(arg.slice(9));
    else if (arg.startsWith('--project=')) args.project = path.resolve(arg.slice(10));
    else if (arg === '--dry-run')           args.dryRun  = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

// ──────────────────────────────────────────
// 字典工具
// ──────────────────────────────────────────

/**
 * 讀取所有 .gems/specs/*.json（排除 _index.json）
 * 回傳 Map<specFilename, { entries: {gemsId → entry}, manages: string|null }>
 */
function loadAllSpecs(gemsDir) {
  const specsDir = path.join(gemsDir, 'specs');
  if (!fs.existsSync(specsDir)) return new Map();

  const result = new Map();
  const files = fs.readdirSync(specsDir).filter(f => f.endsWith('.json') && f !== '_index.json');

  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(specsDir, file), 'utf8'));
      const manages = raw.$meta?.manages ?? null;
      const entries = {};
      for (const [k, v] of Object.entries(raw)) {
        if (k !== '$meta') entries[k] = v;
      }
      result.set(file, { entries, manages });
    } catch (e) {
      console.warn(`  WARN: 讀取字典失敗 ${file}: ${e.message}`);
    }
  }
  return result;
}

/**
 * 把原始碼路徑轉為與字典 targetFile 格式相符的相對路徑（正斜線）
 */
function toRelativePath(absoluteFile, projectRoot) {
  return path.relative(projectRoot, absoluteFile).replace(/\\/g, '/');
}

/**
 * 在所有字典中找符合 targetFile + functionName 的 gemsId + specFile
 * 匹配優先順序：精確 → function name 含 gemsId Action → gemsId Action 含 function name
 */
function lookupGemsId(functionName, relativeFile, allSpecs) {
  const nameLower = functionName.toLowerCase();
  const candidates = [];

  for (const [specFile, { entries, manages }] of allSpecs) {
    for (const [gemsId, entry] of Object.entries(entries)) {
      const targetMatches =
        (manages && manages.replace(/\\/g, '/') === relativeFile) ||
        (entry.targetFile && entry.targetFile.replace(/\\/g, '/') === relativeFile);

      if (!targetMatches) continue;

      const action = gemsId.split('.')[1]?.toLowerCase() ?? '';

      if (action === nameLower) {
        candidates.push({ gemsId, specFile, entry, score: 3 });         // 精確
      } else if (nameLower.startsWith(action)) {
        candidates.push({ gemsId, specFile, entry, score: 2 });         // functionName 前綴包含 action
      } else if (action.startsWith(nameLower)) {
        candidates.push({ gemsId, specFile, entry, score: 1 });         // action 前綴包含 functionName
      }
    }
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // 多個 → 取分數最高的，若平手則 warn
  candidates.sort((a, b) => b.score - a.score);
  if (candidates[0].score === candidates[1].score) {
    console.warn(`  WARN: "${functionName}" 有多個候選 gemsId，取第一個: ${candidates[0].gemsId}`);
  }
  return candidates[0];
}

// ──────────────────────────────────────────
// JSDoc block 解析
// ──────────────────────────────────────────

/**
 * 從 JSDoc block（行陣列）萃取 GEMS-FLOW 的值
 */
function extractFlow(jsdocLines) {
  for (const line of jsdocLines) {
    const m = line.match(/\*\s*GEMS-FLOW:\s*(.+)/);
    if (m) return m[1].trim().replace(/\s+→\s+/g, '→').replace(/\s+->\s+/g, '→');
  }
  return null;
}

// ──────────────────────────────────────────
// 函式結尾偵測（簡易大括號計數）
// ──────────────────────────────────────────

/**
 * 從 funcDeclarationIdx（0-indexed）往下計數大括號，回傳函式最後一行（1-indexed）
 * 若找不到合法結尾則回傳 null
 */
function findFunctionEnd(lines, funcDeclarationIdx) {
  let depth = 0;
  let started = false;

  for (let i = funcDeclarationIdx; i < lines.length; i++) {
    const line = lines[i];
    // 略過純字串/注釋的誤判（簡化：只計非字串內的 { }）
    for (const ch of line) {
      if (ch === '{') { depth++; started = true; }
      else if (ch === '}') { depth--; }
    }
    if (started && depth <= 0) return i + 1; // 1-indexed
  }
  return null;
}

// ──────────────────────────────────────────
// 壓縮錨點生成
// ──────────────────────────────────────────

/**
 * 生成 2 行壓縮錨點
 * // @GEMS [P0] PDF.ExtractorInterfaces | FLOW: DefineMetadata→...→Return | L57-68
 * //   → .gems/specs/pdf-text-extractor.json
 */
function generateAnchor(gemsId, entry, specFile, lineStart, lineEnd) {
  const priority = entry.priority ?? '?';
  const flow     = entry.flow     ?? '?';
  const lineRange = lineEnd ? `L${lineStart}-${lineEnd}` : `L${lineStart}-?`;

  const line1 = `// @GEMS [${priority}] ${gemsId} | FLOW: ${flow} | ${lineRange}`;
  const line2 = `//   → .gems/specs/${specFile}`;
  return [line1, line2];
}

// ──────────────────────────────────────────
// 主縮減邏輯
// ──────────────────────────────────────────

/**
 * 縮減一個檔案
 * @returns {{ shrunk: ShrinkResult[], content: string }}
 */
function shrinkFile(fileContent, relativeFile, allSpecs, gemsDir) {
  const lines = fileContent.split('\n');
  // 結果：{ functionName, gemsId, specFile, blockStart, blockEnd, anchor, newLineStart, newLineEnd }
  const shrunk = [];
  const skipped = [];

  // 找所有 // @GEMS-FUNCTION: Name 行（0-indexed）
  const markerIndices = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\/\/ @GEMS-FUNCTION:\s*(\w+)\s*$/);
    if (m) markerIndices.push({ lineIdx: i, functionName: m[1] });
  }

  if (markerIndices.length === 0) return { shrunk: [], skipped: [], content: fileContent };

  // ── Pass 1：收集所有候選替換（不計算最終行號）──
  const candidates = [];

  for (const { lineIdx, functionName } of markerIndices) {
    const jsdocStart = lineIdx + 1;
    if (jsdocStart >= lines.length || !lines[jsdocStart]?.trimStart().startsWith('/**')) {
      skipped.push({ functionName, reason: '// @GEMS-FUNCTION 後沒有 /** ... */ block' });
      continue;
    }

    let jsdocEnd = -1;
    for (let j = jsdocStart; j < Math.min(jsdocStart + 30, lines.length); j++) {
      if (lines[j].trimEnd().endsWith('*/')) { jsdocEnd = j; break; }
    }
    if (jsdocEnd === -1) {
      skipped.push({ functionName, reason: 'JSDoc block 沒有找到 */' });
      continue;
    }

    const match = lookupGemsId(functionName, relativeFile, allSpecs);
    if (!match) {
      skipped.push({ functionName, reason: `字典中找不到對應的 gemsId（targetFile: ${relativeFile}）` });
      continue;
    }

    const { gemsId, specFile, entry } = match;
    const funcDeclIdx  = jsdocEnd + 1;                      // 0-indexed，函式宣告行
    const funcEndLine  = findFunctionEnd(lines, funcDeclIdx); // 1-indexed 或 null

    candidates.push({ functionName, gemsId, specFile, entry,
      blockStart: lineIdx, blockEnd: jsdocEnd,
      funcDeclIdx, funcEnd0: funcEndLine ? funcEndLine - 1 : null });
  }

  if (candidates.length === 0) return { shrunk: [], skipped, content: fileContent };

  // ── Pass 2：計算最終行號（考慮所有替換的累積偏移）──
  //   對原始位置 P（0-indexed），最終位置 = P - Σ reduction_i（所有 blockStart_i ≤ P 的替換）
  //   reduction_i = blockLines_i - 2（壓縮後只剩 2 行）
  const replacements = [];

  for (const cand of candidates) {
    const { functionName, gemsId, specFile, entry, blockStart, blockEnd, funcDeclIdx, funcEnd0 } = cand;

    // 所有候選中，blockStart ≤ funcDeclIdx 的都會對函式宣告行產生偏移
    let totalReduction = 0;
    for (const other of candidates) {
      if (other.blockStart <= funcDeclIdx) {
        totalReduction += (other.blockEnd - other.blockStart + 1) - 2;
      }
    }

    const newFuncStart = funcDeclIdx - totalReduction + 1;             // 1-indexed
    const newFuncEnd   = funcEnd0 !== null
      ? funcEnd0 - totalReduction + 1                                  // 1-indexed
      : null;

    const anchor = generateAnchor(gemsId, entry, specFile, newFuncStart, newFuncEnd);

    replacements.push({ functionName, gemsId, specFile, entry,
      blockStart, blockEnd, anchor, newLineStart: newFuncStart, newLineEnd: newFuncEnd });

    shrunk.push({ functionName, gemsId, specFile, entry,
      newLineStart: newFuncStart, newLineEnd: newFuncEnd });
  }

  if (replacements.length === 0) return { shrunk: [], skipped, content: fileContent };

  // 反向套用替換（從後往前，保持行號正確）
  const resultLines = [...lines];
  for (const rep of [...replacements].reverse()) {
    const { blockStart, blockEnd, anchor } = rep;
    resultLines.splice(blockStart, blockEnd - blockStart + 1, ...anchor);
  }

  return { shrunk, skipped, content: resultLines.join('\n') };
}

// ──────────────────────────────────────────
// 字典更新
// ──────────────────────────────────────────

function updateDictAndIndex(shrunk, gemsDir) {
  const specsDir = path.join(gemsDir, 'specs');
  const indexPath = path.join(specsDir, '_index.json');

  // 讀 _index.json
  let index = {};
  if (fs.existsSync(indexPath)) {
    try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch (e) {}
  }

  // 按 specFile 分組更新
  const bySpec = {};
  for (const s of shrunk) {
    (bySpec[s.specFile] = bySpec[s.specFile] || []).push(s);
  }

  for (const [specFile, items] of Object.entries(bySpec)) {
    const specPath = path.join(specsDir, specFile);
    if (!fs.existsSync(specPath)) continue;

    let dict;
    try { dict = JSON.parse(fs.readFileSync(specPath, 'utf8')); } catch (e) { continue; }

    for (const { gemsId, newLineStart, newLineEnd } of items) {
      if (!dict[gemsId]) continue;
      const lineRange = newLineEnd
        ? `L${newLineStart}-${newLineEnd}`
        : `L${newLineStart}-?`;
      dict[gemsId].lineRange = lineRange;
      // 更新 _index
      index[gemsId] = `specs/${specFile}`;
    }

    fs.writeFileSync(specPath, JSON.stringify(dict, null, 2), 'utf8');
  }

  // 寫回 _index.json（保留 $meta）
  const sortedIndex = {};
  if (index.$meta) sortedIndex.$meta = index.$meta;
  for (const k of Object.keys(index).filter(k => k !== '$meta').sort()) {
    sortedIndex[k] = index[k];
  }
  fs.writeFileSync(indexPath, JSON.stringify(sortedIndex, null, 2), 'utf8');
}

// ──────────────────────────────────────────
// 主程式
// ──────────────────────────────────────────

function main() {
  const args = parseArgs();

  if (args.help || !args.target || !args.project) {
    console.log(`
tag-shrink.cjs — GEMS 標籤壓縮器

用法:
  node sdid-tools/tag-shrink.cjs --target=<file> --project=<projectRoot>
  node sdid-tools/tag-shrink.cjs --target=<file> --project=<projectRoot> --dry-run

選項:
  --target=<file>      要壓縮的原始碼檔案（必填）
  --project=<dir>      專案根目錄（必填，有 .gems/ 的那層）
  --dry-run            只顯示結果，不寫入任何檔案
  --help               顯示此訊息

說明:
  掃描原始碼中的 // @GEMS-FUNCTION: Name + /** ... */ JSDoc block，
  對照 .gems/specs/*.json 字典，壓縮成 2 行錨點：
    // @GEMS [P0] PDF.ExtractorInterfaces | FLOW: Validate→... | L57-68
    //   → .gems/specs/pdf-text-extractor.json
`);
    process.exit(!args.help ? 1 : 0);
  }

  const gemsDir    = path.join(args.project, '.gems');
  const relFile    = toRelativePath(args.target, args.project);
  const allSpecs   = loadAllSpecs(gemsDir);

  console.log(`\n🔧 tag-shrink`);
  console.log(`   目標: ${relFile}`);
  console.log(`   字典: ${allSpecs.size} 個 spec 檔`);
  if (args.dryRun) console.log(`   模式: dry-run（不寫入）\n`);
  else             console.log('');

  let fileContent;
  try {
    fileContent = fs.readFileSync(args.target, 'utf8');
  } catch (e) {
    console.error(`ERROR: 讀取檔案失敗 — ${e.message}`);
    process.exit(1);
  }

  const { shrunk, skipped, content } = shrinkFile(fileContent, relFile, allSpecs, gemsDir);

  // 結果輸出
  if (shrunk.length === 0 && skipped.length === 0) {
    console.log('ℹ️  找不到任何 // @GEMS-FUNCTION: 標記，無需處理');
    process.exit(0);
  }

  for (const s of shrunk) {
    const range = s.newLineEnd ? `L${s.newLineStart}-${s.newLineEnd}` : `L${s.newLineStart}-?`;
    console.log(`   ✅ ${s.functionName} → ${s.gemsId} | ${range}`);
    console.log(`      // @GEMS [${s.entry?.priority ?? '?'}] ${s.gemsId} | FLOW: ${s.entry?.flow ?? '?'} | ${range}`);
    console.log(`      //   → .gems/specs/${s.specFile}`);
  }

  for (const s of skipped) {
    console.log(`   ⏭️  ${s.functionName} — SKIP: ${s.reason}`);
  }

  console.log(`\n📊 ${shrunk.length} 個壓縮，${skipped.length} 個跳過`);

  if (args.dryRun) {
    console.log('\n[dry-run] 壓縮後預覽（前 30 行）:');
    content.split('\n').slice(0, 30).forEach((l, i) => console.log(`  ${String(i+1).padStart(3)}: ${l}`));
    console.log('\n[dry-run] 不寫入任何檔案');
    process.exit(0);
  }

  if (shrunk.length > 0) {
    fs.writeFileSync(args.target, content, 'utf8');
    console.log(`\n✅ 原始碼已更新: ${relFile}`);

    updateDictAndIndex(shrunk, gemsDir);
    console.log(`✅ 字典與 _index.json 已更新`);
  }

  console.log('\n@PASS | tag-shrink 完成');
}

// ──────────────────────────────────────────
// exports（供測試 / phase-8 呼叫）
// ──────────────────────────────────────────

module.exports = {
  shrinkFile,
  loadAllSpecs,
  lookupGemsId,
  generateAnchor,
  findFunctionEnd,
  toRelativePath,
  updateDictAndIndex,
};

if (require.main === module) main();
