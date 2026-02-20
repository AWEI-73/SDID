#!/usr/bin/env node
/**
 * Blueprint Shrink v1.0 - 活藍圖收縮器
 * 
 * iter 完成後，將已完成的動作清單折疊為一行摘要 [DONE]，
 * 並將 Fillback suggestions 附加到下一個 Stub 的備註。
 * 
 * 獨立工具，不 import task-pipe。
 * 
 * 用法:
 *   node sdid-tools/blueprint-shrink.cjs --draft=<path> --iter=1 --target=<project>
 *   node sdid-tools/blueprint-shrink.cjs --draft=<path> --iter=1 --target=<project> --dry-run
 * 
 * 輸出:
 *   更新後的活藍圖 (原檔覆寫或 --out 指定路徑)
 */

const fs = require('fs');
const path = require('path');
const parser = require('./lib/draft-parser-standalone.cjs');
const logOutput = require('./lib/log-output.cjs');

// ============================================
// 參數解析
// ============================================
function parseArgs() {
  const args = { draft: null, iter: 1, target: null, out: null, dryRun: false, help: false };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--draft=')) args.draft = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--iter=')) args.iter = parseInt(arg.split('=')[1]);
    else if (arg.startsWith('--target=')) args.target = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--out=')) args.out = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

// ============================================
// Fillback Suggestions 讀取
// ============================================

/**
 * 從 .gems/iterations/iter-N/build/ 讀取所有 iteration_suggestions_*.json
 */
function loadFillbackSuggestions(projectRoot, iterNum) {
  const buildDir = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'build');
  if (!fs.existsSync(buildDir)) return [];

  const files = fs.readdirSync(buildDir).filter(f => f.startsWith('iteration_suggestions_') && f.endsWith('.json'));
  const allSuggestions = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(buildDir, file), 'utf8');
      const data = JSON.parse(content);
      // 支援陣列或物件格式
      if (Array.isArray(data)) {
        allSuggestions.push(...data);
      } else if (data.suggestions) {
        allSuggestions.push(...data.suggestions);
      } else if (data.items) {
        allSuggestions.push(...data.items);
      }
    } catch (e) {
      // 忽略解析錯誤
    }
  }

  return allSuggestions;
}

/**
 * 從 Fillback 中提取與特定模組相關的建議
 */
function getSuggestionsForModule(suggestions, moduleName) {
  return suggestions.filter(s => {
    const text = JSON.stringify(s).toLowerCase();
    return text.includes(moduleName.toLowerCase());
  });
}

// ============================================
// 統計收集
// ============================================

/**
 * 從動作清單收集統計資訊
 */
function collectActionStats(mod) {
  const items = mod.items || [];
  const priorityCounts = { P0: 0, P1: 0, P2: 0, P3: 0 };
  let completedCount = 0;
  const evolutionLayers = new Set();

  for (const item of items) {
    const p = item.priority || 'P2';
    priorityCounts[p] = (priorityCounts[p] || 0) + 1;
    if (item.status === '✓✓' || item.status === '[DONE]') {
      completedCount++;
    }
    // v2.1: 收集演化層
    const evo = item.evolution || item['演化'] || 'BASE';
    evolutionLayers.add(evo);
  }

  const prioritySummary = Object.entries(priorityCounts)
    .filter(([, count]) => count > 0)
    .map(([p, count]) => `${count}×${p}`)
    .join(', ');

  return {
    total: items.length,
    completed: completedCount,
    prioritySummary,
    evolutionLayers: Array.from(evolutionLayers),
  };
}

/**
 * 從 .gems/iterations/iter-N/ 讀取測試結果統計
 */
function loadTestStats(projectRoot, iterNum) {
  const logsDir = path.join(projectRoot, '.gems', 'iterations', `iter-${iterNum}`, 'logs');
  if (!fs.existsSync(logsDir)) return null;

  // 找最後一個 pass log 來提取測試數
  const passLogs = fs.readdirSync(logsDir)
    .filter(f => f.includes('-pass-'))
    .sort()
    .reverse();

  for (const logFile of passLogs) {
    try {
      const content = fs.readFileSync(path.join(logsDir, logFile), 'utf8');
      const testMatch = content.match(/(\d+)\s*(?:tests?\s*)?pass/i);
      if (testMatch) return { passCount: parseInt(testMatch[1]) };
    } catch (e) { /* ignore */ }
  }

  return null;
}

// ============================================
// 藍圖收縮邏輯
// ============================================

/**
 * 生成 [DONE] 或 [EVOLVED] 摘要行
 */
function generateDoneSummary(moduleName, stats, testStats) {
  const testInfo = testStats ? ` | 測試: ${testStats.passCount} pass` : '';
  // v2.1: 如果有演化層標記且不全是 BASE，使用 [EVOLVED]
  const hasEvolution = stats.evolutionLayers && stats.evolutionLayers.length > 0 
    && stats.evolutionLayers.some(l => l !== 'BASE');
  const statusTag = hasEvolution ? 'EVOLVED' : 'DONE';
  const evoInfo = hasEvolution ? ` | 演化: ${stats.evolutionLayers.join(',')}` : '';
  return `### Iter ${stats.iter}: ${moduleName} [${statusTag}]\n> ✅ ${stats.total} 個動作完成 (${stats.prioritySummary})${testInfo}${evoInfo}`;
}

/**
 * 生成附加到 Stub 的 Fillback 備註
 */
function generateFillbackNote(suggestions) {
  if (suggestions.length === 0) return '';

  const lines = ['', '> 📝 Fillback 備註 (來自前一迭代):'];
  for (const s of suggestions.slice(0, 5)) {
    const desc = s.description || s.title || s.suggestion || JSON.stringify(s).slice(0, 80);
    lines.push(`> - ${desc}`);
  }
  if (suggestions.length > 5) {
    lines.push(`> - ... 還有 ${suggestions.length - 5} 項`);
  }

  return lines.join('\n');
}

/**
 * 在原始 Markdown 中執行收縮
 * 
 * 策略：直接操作原始文字，找到目標 iter 的動作清單區塊，替換為 [DONE] 摘要
 */
function shrinkBlueprint(rawContent, draft, iterNum, projectRoot) {
  const changes = [];
  let result = rawContent;

  // 1. 收縮動作清單
  for (const [modName, mod] of Object.entries(draft.moduleActions)) {
    if (mod.iter !== iterNum) continue;
    if (mod.fillLevel === 'stub' || mod.fillLevel === 'done') continue;

    const stats = collectActionStats(mod);
    stats.iter = iterNum;
    const testStats = projectRoot ? loadTestStats(projectRoot, iterNum) : null;
    const doneSummary = generateDoneSummary(modName, stats, testStats);

    // 找到原始文字中的動作清單區塊
    // 模式: ### Iter N: moduleName [CURRENT] 或 ### Iter N: moduleName
    const headerPatterns = [
      new RegExp(`### Iter ${iterNum}:\\s*${escapeRegex(modName)}\\s*\\[CURRENT\\]`, 'i'),
      new RegExp(`### Iter ${iterNum}:\\s*${escapeRegex(modName)}(?:\\s|$)`, 'i'),
    ];

    let headerIdx = -1;
    const lines = result.split('\n');

    for (const pattern of headerPatterns) {
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          headerIdx = i;
          break;
        }
      }
      if (headerIdx >= 0) break;
    }

    if (headerIdx < 0) {
      changes.push({ module: modName, status: 'SKIP', reason: '找不到動作清單區塊' });
      continue;
    }

    // 找到區塊結束位置 (下一個 ### 或 --- 或 ##)
    let endIdx = lines.length;
    for (let i = headerIdx + 1; i < lines.length; i++) {
      if (/^###\s/.test(lines[i]) || /^---$/.test(lines[i].trim()) || /^##\s/.test(lines[i])) {
        endIdx = i;
        break;
      }
    }

    // 替換區塊
    const newLines = [...lines.slice(0, headerIdx), doneSummary, '', ...lines.slice(endIdx)];
    result = newLines.join('\n');

    changes.push({ module: modName, status: 'DONE', stats });
  }

  // 2. 更新迭代規劃表中的狀態
  // [CURRENT] → [DONE]
  const currentPattern = new RegExp(`(\\|[^|]*\\|[^|]*\\|[^|]*\\|[^|]*\\|[^|]*\\|[^|]*\\|)\\s*\\[CURRENT\\]\\s*\\|`, 'g');
  // 只替換目標 iter 的行
  const planLines = result.split('\n');
  for (let i = 0; i < planLines.length; i++) {
    const line = planLines[i];
    if (line.includes('[CURRENT]') && line.includes(`| ${iterNum} `)) {
      planLines[i] = line.replace('[CURRENT]', '[DONE]');
    }
  }

  // 3. 將下一個 iter 的 [STUB] 改為 [CURRENT] (如果存在)
  const nextIter = iterNum + 1;
  let promotedNext = false;
  for (let i = 0; i < planLines.length; i++) {
    const line = planLines[i];
    if (line.includes('[STUB]') && line.includes(`| ${nextIter} `) && !promotedNext) {
      planLines[i] = line.replace('[STUB]', '[CURRENT]');
      promotedNext = true;
    }
  }

  result = planLines.join('\n');

  // 4. 附加 Fillback 備註到下一個 Stub
  if (projectRoot) {
    const suggestions = loadFillbackSuggestions(projectRoot, iterNum);
    if (suggestions.length > 0) {
      // 找下一個 iter 的 Stub 區塊
      const nextIterModules = draft.iterationPlan
        .filter(e => e.iter === nextIter)
        .map(e => e.module);

      for (const nextMod of nextIterModules) {
        const modSuggestions = getSuggestionsForModule(suggestions, nextMod);
        if (modSuggestions.length === 0) continue;

        const fillbackNote = generateFillbackNote(modSuggestions);
        const stubPattern = new RegExp(`(### Iter ${nextIter}:\\s*${escapeRegex(nextMod)}[^\\n]*)`, 'i');
        const stubMatch = result.match(stubPattern);

        if (stubMatch) {
          // 在 Stub 區塊末尾（下一個 ### 之前）插入 Fillback 備註
          const stubLines = result.split('\n');
          let insertIdx = -1;
          for (let i = 0; i < stubLines.length; i++) {
            if (stubPattern.test(stubLines[i])) {
              // 找到 Stub 區塊的結尾
              for (let j = i + 1; j < stubLines.length; j++) {
                if (/^###\s/.test(stubLines[j]) || /^---$/.test(stubLines[j].trim()) || /^##\s/.test(stubLines[j])) {
                  insertIdx = j;
                  break;
                }
              }
              if (insertIdx < 0) insertIdx = stubLines.length;
              break;
            }
          }

          if (insertIdx >= 0) {
            stubLines.splice(insertIdx, 0, fillbackNote);
            result = stubLines.join('\n');
            changes.push({ module: nextMod, status: 'FILLBACK_ATTACHED', count: modSuggestions.length });
          }
        }
      }
    }
  }

  return { content: result, changes };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================
// 主程式
// ============================================
function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
Blueprint Shrink v1.0 - 活藍圖收縮器

用法:
  node sdid-tools/blueprint-shrink.cjs --draft=<path> --iter=1 --target=<project>

選項:
  --draft=<path>    活藍圖路徑 (必填)
  --iter=<N>        已完成的迭代編號 (必填)
  --target=<path>   專案根目錄 (用於讀取 Fillback suggestions)
  --out=<path>      輸出路徑 (預設: 覆寫原檔)
  --dry-run         預覽模式，不寫入檔案
  --help            顯示此訊息
`);
    process.exit(0);
  }

  if (!args.draft) {
    logOutput.anchorErrorSpec({
      targetFile: 'CLI 參數',
      missing: ['--draft'],
      example: `node sdid-tools/blueprint-shrink.cjs --draft=<project>/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md --iter=1 --target=<project>`,
      nextCmd: 'node sdid-tools/blueprint-shrink.cjs --draft=<path> --iter=N --target=<project>',
      gateSpec: {
        checks: [
          { name: '--draft 參數', pattern: '活藍圖路徑', desc: '必須指定 --draft=<path>' },
          { name: '藍圖可解析', pattern: 'parser.parse()', desc: '藍圖格式必須正確' },
          { name: 'iter 有可收縮模組', pattern: 'fillLevel !== stub/done', desc: '目標 iter 必須有 Full 動作清單' },
          { name: 'BUILD 已完成', pattern: 'Fillback_Story-X.Y.md', desc: '所有 Story 的 BUILD Phase 8 已完成' },
        ]
      }
    });
    process.exit(1);
  }

  let rawContent, draft;
  try {
    rawContent = fs.readFileSync(args.draft, 'utf8');
    draft = parser.parse(rawContent);
  } catch (err) {
    logOutput.anchorError('BLOCKER',
      `藍圖讀取/解析失敗: ${err.message}`,
      `確認藍圖路徑正確且格式有效: ${args.draft}`,
      {
        projectRoot: args.target || null,
        iteration: args.iter,
        phase: 'gate',
        step: 'shrink',
        details: `解析錯誤: ${err.message}`,
      }
    );
    process.exit(1);
  }

  console.log(`\n📐 Blueprint Shrink v1.0`);
  console.log(`   藍圖: ${path.basename(args.draft)}`);
  console.log(`   收縮 iter: ${args.iter}`);
  console.log('');

  // 執行收縮
  const { content, changes } = shrinkBlueprint(rawContent, draft, args.iter, args.target);

  // 報告
  const doneCount = changes.filter(c => c.status === 'DONE').length;
  const skipCount = changes.filter(c => c.status === 'SKIP').length;
  const fillbackCount = changes.filter(c => c.status === 'FILLBACK_ATTACHED').length;

  for (const change of changes) {
    if (change.status === 'DONE') {
      console.log(`   ✅ ${change.module} → [DONE] (${change.stats.total} 動作, ${change.stats.prioritySummary})`);
    } else if (change.status === 'SKIP') {
      console.log(`   ⏭️ ${change.module} — ${change.reason}`);
    } else if (change.status === 'FILLBACK_ATTACHED') {
      console.log(`   📝 ${change.module} ← Fillback 備註 (${change.count} 項)`);
    }
  }

  console.log(`\n📊 結果: ${doneCount} 模組收縮, ${fillbackCount} 個 Fillback 附加, ${skipCount} 跳過`);

  if (doneCount === 0) {
    const logProjectRoot = args.target || null;
    if (logProjectRoot) {
      logOutput.anchorError('TACTICAL_FIX',
        `iter-${args.iter} 沒有模組被收縮 — 可能已是 [DONE]/[STUB] 或找不到動作清單區塊`,
        `確認藍圖中 iter-${args.iter} 有 [CURRENT] 標記的模組，且 BUILD 已完成`,
        {
          projectRoot: logProjectRoot,
          iteration: args.iter,
          phase: 'gate',
          step: 'shrink',
          details: `收縮結果:\n${changes.map(c => `${c.module}: ${c.status} — ${c.reason || ''}`).join('\n')}\n\n可能原因:\n1. 所有模組已是 [DONE] 或 [STUB]\n2. 動作清單區塊標題格式不匹配\n3. iter 編號錯誤`,
        }
      );
    } else {
      console.log(`\n⚠️ 沒有模組被收縮 — iter-${args.iter} 可能已經是 [DONE] 或 [STUB]`);
    }
    process.exit(0);
  }

  // 寫入
  const outPath = args.out || args.draft;
  if (args.dryRun) {
    console.log(`\n[dry-run] 不寫入檔案`);
    console.log(`[dry-run] 收縮後藍圖預覽 (前 30 行):`);
    content.split('\n').slice(0, 30).forEach(l => console.log(`  ${l}`));
  } else {
    fs.writeFileSync(outPath, content, 'utf8');
    console.log(`\n✅ 藍圖已更新: ${path.relative(process.cwd(), outPath)}`);
  }

  // log 存檔
  const logProjectRoot = args.target || null;
  if (logProjectRoot) {
    const details = changes.map(c => {
      if (c.status === 'DONE') return `✅ ${c.module} → [DONE] (${c.stats.total} 動作, ${c.stats.prioritySummary})`;
      if (c.status === 'SKIP') return `⏭️ ${c.module} — ${c.reason}`;
      if (c.status === 'FILLBACK_ATTACHED') return `📝 ${c.module} ← Fillback (${c.count} 項)`;
      return `${c.module}: ${c.status}`;
    }).join('\n');

    logOutput.anchorPass('gate', 'shrink',
      `Blueprint Shrink 完成 — iter-${args.iter} 已收縮 (${doneCount} 模組)`,
      `使用 Gem chatbot 展開 iter-${args.iter + 1} 的 Stub，或執行 blueprint-expand.cjs`,
      { projectRoot: logProjectRoot, iteration: args.iter, phase: 'gate', step: 'shrink', details });
  } else {
    console.log(`\n@PASS | Blueprint Shrink 完成 — iter-${args.iter} 已收縮`);
    console.log(`下一步: 使用 Gem chatbot 展開 iter-${args.iter + 1} 的 Stub，或執行 blueprint-expand.cjs`);
  }
}

// ============================================
// 導出
// ============================================
module.exports = {
  shrinkBlueprint,
  loadFillbackSuggestions,
  getSuggestionsForModule,
  collectActionStats,
  generateDoneSummary,
  generateFillbackNote,
};

if (require.main === module) {
  main();
}
