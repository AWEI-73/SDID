#!/usr/bin/env node
/**
 * SCAN Phase: 規格書產出
 * 
 * 執行所有 scanner 工具，產出專案規格書到 .gems/docs/
 * 
 * 產出:
 *   - system-blueprint.json - 整合藍圖
 *   - functions.json - 函式清單 (含 specPurpose)
 *   - schema.json - 資料庫結構
 *   - tech-stack.json - 技術棧
 * 
 * 備份:
 *   - 將當前 iteration 的產物與源碼備份到 .gems/backups/
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { detectProjectType, getSrcDir, getSrcDirs } = require('../../lib/shared/project-type.cjs');
const { createErrorHandler, MAX_ATTEMPTS } = require('../../lib/shared/error-handler.cjs');
const { anchorOutput, anchorPass, anchorError, emitPass, emitBlock } = require('../../lib/shared/log-output.cjs');

function run(options) {
  // 初始化錯誤處理器
  const errorHandler = createErrorHandler('SCAN', 'scan', null);
  const { target, iteration = 'iter-1' } = options;
  // 計算相對路徑（用於輸出指令，避免絕對路徑問題）
  const relativeTarget = path.relative(process.cwd(), target) || '.';


  // 確保使用絕對路徑
  const absTarget = path.isAbsolute(target) ? target : path.resolve(target);
  const gemsPath = path.join(absTarget, '.gems');
  const docsPath = path.join(gemsPath, 'docs');
  const backupsPath = path.join(gemsPath, 'backups');
  const iterPath = path.join(gemsPath, 'iterations', iteration);

  // 偵測專案類型 + 取得所有源碼目錄（multi-root 支援）
  const { type: projectType } = detectProjectType(absTarget);
  const srcDirs = getSrcDirs(absTarget);      // string[] — blueprint 宣告 or auto-glob
  const srcDir = srcDirs[0];                  // 向後相容：single-dir ops 用第一個

  // 確保目錄存在
  [docsPath, backupsPath].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // v2.5: 統一使用 builtin scan（支援 gems-scanner-v2 AST → enhanced → lite 降級鏈）
  // 舊的 gems-scanner.cjs (task-pipe/lib/) 已淘汰，不再使用
  const runOptions = {
    projectRoot: absTarget,
    iteration: parseInt(iteration.replace('iter-', '') || '1'),
    phase: 'scan',
    step: 'scan'
  };

  return runBuiltinScan(absTarget, srcDirs, iteration, docsPath, backupsPath, iterPath, errorHandler, runOptions, projectType);
}

// [REMOVED] runFullScan — 舊 gems-scanner.cjs 路線已淘汰
// Phase 2 使用 gems-scanner-v2 (sdid-tools/)，SCAN 統一走 runBuiltinScan

/**
 * 內建簡易掃描（沒有完整 scanner 時使用）
 * v7.0: 使用增強版掃描器，支援行號索引
 */
/**
 * 合併多個 unified.scan() 結果（multi-root 支援）
 */
function mergeScanResults(results) {
  if (results.length === 1) return results[0];
  const merged = {
    functions: [],
    stats: { total: 0, tagged: 0, p0: 0, p1: 0, p2: 0, p3: 0, avgFunctionLines: 0 },
    untagged: [],
    scannerVersion: results[0]?.scannerVersion || 'regex-6.0',
  };
  for (const r of results) {
    if (!r) continue;
    merged.functions.push(...(r.functions || []));
    merged.untagged.push(...(r.untagged || []));
    for (const k of ['total', 'tagged', 'p0', 'p1', 'p2', 'p3']) {
      merged.stats[k] = (merged.stats[k] || 0) + (r.stats?.[k] || 0);
    }
  }
  // 平均行數：以全部函式重算
  const linesArr = merged.functions.map(f => f.lines || 0).filter(l => l > 0);
  merged.stats.avgFunctionLines = linesArr.length > 0
    ? Math.round(linesArr.reduce((a, b) => a + b, 0) / linesArr.length)
    : 0;
  return merged;
}

function runBuiltinScan(target, srcDirs, iteration, docsPath, backupsPath, iterPath, errorHandler, runOptions, projectType) {
  // 向後相容：srcDirs 可能是 string（舊呼叫）或 string[]（新呼叫）
  if (!Array.isArray(srcDirs)) srcDirs = [srcDirs];
  const existingSrcDirs = srcDirs.filter(d => fs.existsSync(d));
  const srcDir = existingSrcDirs[0] || srcDirs[0]; // primary（顯示 + backup 用）

  // v2.5: 統一使用 gems-scanner-unified（AST → Regex 自動降級）
  const unified = require('../../lib/scan/gems-scanner-unified.cjs');
  const scannerLabel = unified.hasAstScanner ? 'gems-scanner-v2 (AST)' : 'gems-validator (Regex)';

  anchorOutput({
    context: `Phase SCAN | 規格書產出 | ${iteration}`,
    info: {
      'Scanner': scannerLabel,
      '源碼': existingSrcDirs.length > 1 ? existingSrcDirs.join(', ') : (existingSrcDirs[0] || srcDir),
      '輸出': docsPath
    },
    task: ['執行掃描 (含 startLine/endLine)'],
    output: 'Scanning...'
  }, runOptions);

  try {
    // 備份當前 iteration 與第一個源碼目錄
    backupIteration(iterPath, srcDir, backupsPath, iteration);

    let scanResult;
    let scannerVersion;

    // SHRINK 已移為可選工具，SCAN 直接讀源碼中的 GEMS 標籤（支援完整多行格式與 shrink 格式）
    // 若需在 SCAN 前壓縮標籤，請手動執行: node task-pipe/tools/shrink-tags.cjs --target=<project>
    // multi-root：掃描所有存在的 srcDirs，合併結果
    const rawResults = (existingSrcDirs.length > 0 ? existingSrcDirs : [srcDir])
      .map(d => { try { return unified.scan(d, target); } catch { return null; } })
      .filter(Boolean);
    const raw = mergeScanResults(rawResults);
    scannerVersion = raw.scannerVersion === 'ast-v2' ? '8.0' : '6.0';

    if (raw.scannerVersion === 'ast-v2') {
      // AST 結果需要轉換為 SCAN phase 期望的格式
      scanResult = {
        functions: raw.functions.map(f => ({
          name: f.name,
          file: f.file,
          startLine: f.startLine,
          endLine: f.endLine,
          line: f.startLine,
          commentLine: f.startLine > 1 ? f.startLine - 1 : null,
          lines: (f.endLine && f.startLine) ? f.endLine - f.startLine + 1 : null,
          priority: f.priority,
          description: f.description,
          signature: f.signature || '',
          storyId: f.storyId || '',
          flow: f.flow || '',
          deps: f.deps || '',
          depsRisk: f.depsRisk || '',
          testStatus: f.test || '',
          gemsId: f.gemsId,
        })),
        stats: {
          total: raw.stats.total,
          tagged: raw.stats.tagged,
          p0: raw.stats.p0,
          p1: raw.stats.p1,
          p2: raw.stats.p2,
          p3: raw.stats.p3,
          avgFunctionLines: 0,
        }
      };
      console.log(`[SCAN] 使用 gems-scanner-unified (AST)`);
    } else {
      scanResult = {
        functions: raw.functions,
        stats: raw.stats,
      };
      console.log(`[SCAN] 使用 gems-scanner-unified (Regex fallback)`);
    }

    // 產出 function-index
    if (unified.generateFunctionIndexV2 && scanResult.functions?.length > 0) {
      try {
        const { generateFunctionIndex } = require('../../lib/scan/gems-scanner-enhanced.cjs');
        const index = generateFunctionIndex(scanResult.functions);
        fs.writeFileSync(
          path.join(docsPath, 'function-index.json'),
          JSON.stringify(index, null, 2)
        );
      } catch { /* enhanced not available, skip index */ }
    }

    // 產出 functions.json (v7.0 含行號)
    const functionsJson = {
      version: scannerVersion,
      generatedBy: 'scan',
      generatedAt: new Date().toISOString(),
      totalCount: scanResult.functions?.length || scanResult.stats?.tagged || 0,
      untaggedCount: (raw.untagged || []).length,
      byRisk: {
        P0: scanResult.stats.p0,
        P1: scanResult.stats.p1,
        P2: scanResult.stats.p2,
        P3: scanResult.stats.p3
      },
      avgFunctionLines: scanResult.stats.avgFunctionLines || 0,
      functions: scanResult.functions.map(f => ({
        name: f.name,
        file: f.file,
        // v7.0: 新增行號欄位
        startLine: f.startLine || f.line || null,
        endLine: f.endLine || null,
        commentLine: f.commentLine || null,
        lines: f.lines || null,
        // 原有欄位
        risk: f.priority,
        description: f.description || '',
        signature: f.signature || '',
        storyId: f.storyId || '',
        flow: f.flow || '',
        deps: f.deps || [],
        depsRisk: f.depsRisk || '',
        testStatus: f.testStatus || ''
      })),
      // M17: untagged 函式清單
      untagged: (raw.untagged || []).map(f => ({
        name: f.name,
        file: f.file,
        line: f.line || null
      }))
    };

    fs.writeFileSync(
      path.join(docsPath, 'functions.json'),
      JSON.stringify(functionsJson, null, 2)
    );

    // DB schema — 只產 DB_SCHEMA.md（人讀），不再產 schema.json
    // multi-root：合併所有 srcDirs 的 schema
    const schema = (existingSrcDirs.length > 0 ? existingSrcDirs : [srcDir])
      .reduce((acc, d) => Object.assign(acc, generateSchema(d)), {});
    generateSchemaMarkdown(schema, docsPath);

    // Tech stack
    const techStack = generateTechStack(target);

    // CONTRACT.md（人讀）+ stories 分組（給 project-overview 用）
    let storiesByStory = {};
    try {
      const { generateContract, formatContractMarkdown } = require('../../lib/scan/contract-generator.cjs');
      const contract = generateContract(target, srcDir, iteration);
      fs.writeFileSync(path.join(docsPath, 'CONTRACT.md'), formatContractMarkdown(contract));
      storiesByStory = contract.stories || {};
      console.log(`[SCAN] CONTRACT.md generated: ${contract.summary.functions} functions, ${contract.summary.stories} stories`);
    } catch (e) {
      console.log(`[SCAN] CONTRACT.md skipped: ${e.message}`);
    }

    // project-overview.json — 整合 stats + tech-stack + stories 分組
    const overview = {
      name: path.basename(target),
      generatedAt: new Date().toISOString(),
      stats: {
        functions: scanResult.functions.length,
        P0: scanResult.stats.p0,
        P1: scanResult.stats.p1,
        P2: scanResult.stats.p2,
        P3: scanResult.stats.p3,
        tables: Object.keys(schema).length,
        stories: Object.keys(storiesByStory).length
      },
      techStack: {
        dependencies: techStack.dependencies || {},
        devDependencies: techStack.devDependencies || {}
      },
      stories: storiesByStory
    };
    fs.writeFileSync(path.join(docsPath, 'project-overview.json'), JSON.stringify(overview, null, 2));

    // 清理舊產物（向後相容：刪掉已整合的檔案）
    ['system-blueprint.json', 'schema.json', 'tech-stack.json', 'TECH_STACK.md', 'contract.json', 'function-index.json'].forEach(f => {
      const p = path.join(docsPath, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });

    const produced = ['functions.json', 'project-overview.json', 'DB_SCHEMA.md', 'CONTRACT.md'];

    // SCAN 完成 → 標記 iteration 為 completed，讓 loop 下次正確偵測到新 iter
    try {
      const stateManager = require('../../lib/shared/state-manager-v3.cjs');
      stateManager.completeIteration(absTarget, iteration);
    } catch (e) { /* state-manager 不可用時靜默跳過 */ }

    // M12: 存 iter 函式快照 — SCAN 完成後將 functions.json 複製到 iter 目錄
    try {
      const snapshotPath = path.join(iterPath, 'functions-snapshot.json');
      fs.writeFileSync(snapshotPath, JSON.stringify(functionsJson, null, 2));
      console.log(`[SCAN] functions-snapshot.json → ${path.relative(process.cwd(), snapshotPath)}`);
    } catch (e) { /* 快照失敗不影響主流程 */ }

    // M17: 輸出 untagged 函式清單（讓 AI 知道要補哪些 GEMS tag）
    const untaggedFns = raw.untagged || [];
    if (untaggedFns.length > 0) {
      const relTarget = path.relative(process.cwd(), target);
      console.log('');
      console.log(`@UNTAGGED | ${untaggedFns.length} 個函式缺少 GEMS tag（P0/P1 必填）`);
      untaggedFns.slice(0, 10).forEach(fn => {
        // fn.file 是相對於 target 的路徑（e.g. src\shared\services\foo.ts）
        const relFile = path.join(relTarget, fn.file);
        console.log(`  - ${fn.name} | ${relFile}:${fn.line || '?'}`);
      });
      if (untaggedFns.length > 10) {
        console.log(`  ... 還有 ${untaggedFns.length - 10} 個（見 functions.json untagged）`);
      }
      console.log('');
    }

    anchorPass('SCAN', 'Enhanced Scan v7.0',
      `SCAN 完成 | Funcs: ${scanResult.functions.length} | 平均 ${scanResult.stats.avgFunctionLines || '?'} 行/函式`,
      `位置: ${path.relative(process.cwd(), docsPath) || docsPath}`,
      {
        ...runOptions,
        info: {
          'Version': scannerVersion,
          'P0': scanResult.stats.p0,
          'P1': scanResult.stats.p1,
          '行號索引': scannerVersion === '7.0' ? '✓' : '-',
          'Shrink': '無'
        }
      }
    );

    return {
      verdict: 'PASS',
      produced,
      mode: scannerVersion === '7.0' ? 'enhanced-v7' : 'builtin-lite'
    };

  } catch (err) {
    // ... (Error handling logic unchanged)
    const attempt = errorHandler.recordError('E6', err.message);
    if (errorHandler.shouldBlock()) {
      anchorError('BLOCKER', `SCAN (Builtin) 連續失敗 (${MAX_ATTEMPTS}/${MAX_ATTEMPTS})`, '需要人類介入', { details: err.message, ...runOptions });
      return { verdict: 'BLOCKER', reason: 'tactical_fix_limit', error: err.message };
    }
    const recoveryLevel = errorHandler.getRecoveryLevel();
    anchorOutput({
      context: `Phase SCAN (Builtin) | 失敗 | Attempt ${attempt}`,
      error: { type: 'TACTICAL_FIX', summary: `SCAN 失敗: ${err.message}`, attempt, maxAttempts: MAX_ATTEMPTS },
      template: { title: `RECOVERY`, content: 'Check logs' },
      output: `NEXT: Retry scan`
    }, runOptions);
    return { verdict: 'PENDING', attempt, error: err.message }; // Simplified error return for brevity in replace
  }
}

// --- Helper Functions ---

/**
 * 掃描 schema 來源（優先順序）：
 *   1. src/**\/*.sql — 獨立 SQL 檔案（最可靠）
 *   2. src/**\/*.ts/js 裡的 backtick CREATE TABLE 字串常數（fallback）
 *   3. @GEMS-FIELD 標籤（向後相容）
 */
function generateSchema(srcDir) {
  const entities = {};

  function collectFiles(dir, exts, results = []) {
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collectFiles(full, exts, results);
      else if (exts.some(e => entry.name.endsWith(e))) results.push(full);
    }
    return results;
  }

  const projectRoot = path.dirname(srcDir);

  // 1. 優先掃 .sql 檔案（src/ 和 project root 下）
  const sqlFiles = [
    ...collectFiles(srcDir, ['.sql']),
    ...collectFiles(projectRoot, ['.sql']).filter(f => !f.startsWith(srcDir))
  ];
  for (const file of sqlFiles) {
    let content;
    try { content = fs.readFileSync(file, 'utf-8'); } catch { continue; }
    Object.assign(entities, parseAllCreateTables(content, path.relative(srcDir, file)));
  }

  // 2. Fallback：掃 .ts/.js 裡的 backtick SQL 字串（只補 .sql 沒抓到的）
  const tsFiles = collectFiles(srcDir, ['.ts', '.js', '.tsx']);
  for (const file of tsFiles) {
    let content;
    try { content = fs.readFileSync(file, 'utf-8'); } catch { continue; }
    const sqlPattern = /`([\s\S]*?CREATE\s+TABLE[\s\S]*?)`/gi;
    let match;
    while ((match = sqlPattern.exec(content)) !== null) {
      const parsed = parseAllCreateTables(match[1], path.relative(srcDir, file));
      for (const [k, v] of Object.entries(parsed)) {
        if (!entities[k]) entities[k] = v;
      }
    }
  }

  // 3. 舊的 @GEMS-FIELD 標籤掃描（向後相容）
  const typesPath = path.join(srcDir, 'types', 'index.ts');
  if (fs.existsSync(typesPath)) {
    const content = fs.readFileSync(typesPath, 'utf-8');
    let parsingEntity = null;
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.includes('@GEMS-FIELD:')) continue;
      const tagContent = trimmed.split('@GEMS-FIELD:')[1].trim();
      const parts = tagContent.split('|').map(s => s.trim());
      if (parts.length === 2 && /^[A-Z]/.test(parts[0])) {
        const [name, rawDesc] = parts;
        parsingEntity = name;
        if (!entities[parsingEntity]) {
          entities[parsingEntity] = { description: rawDesc.replace(/\*\/\s*$/, '').trim(), fields: [] };
        }
      } else if (parts.length >= 3 && parsingEntity) {
        const [name, type, ...rest] = parts;
        let constraint = '-', desc = '-';
        if (rest.length === 1) desc = rest[0].replace(/\*\/\s*$/, '').trim();
        else if (rest.length >= 2) { constraint = rest[0]; desc = rest[1].replace(/\*\/\s*$/, '').trim(); }
        if (!entities[parsingEntity].fields) entities[parsingEntity].fields = [];
        entities[parsingEntity].fields.push({ name, type, constraint, description: desc });
      }
    }
  }

  return entities;
}

/**
 * 從一段 SQL 文字中解析所有 CREATE TABLE，回傳 { tableName: { ... } }
 */
function parseAllCreateTables(sql, sourceFile) {
  const result = {};
  const tablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\)\s*;?/gi;
  let match;
  while ((match = tablePattern.exec(sql)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const columns = [];
    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim().replace(/,\s*$/, '');
      if (!line || /^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT)\s*\(/i.test(line)) continue;
      const colMatch = line.match(/^(\w+)\s+(\w+)(.*)?$/);
      if (!colMatch) continue;
      const [, colName, colType, rest = ''] = colMatch;
      columns.push({ name: colName, type: colType.toUpperCase(), constraints: rest.trim() });
    }
    result[tableName] = {
      description: `SQLite table — ${tableName}`,
      sourceFile: sourceFile || '',
      columns
    };
  }
  return result;
}

function generateSchemaMarkdown(schema, docsPath) {
  let md = '# Database Schema\n';
  md += `> Generated on ${new Date().toLocaleString()}\n\n`;

  for (const [entityName, data] of Object.entries(schema)) {
    const sourceNote = data.sourceFile ? ` — \`${data.sourceFile}\`` : '';
    md += `## ${entityName}${sourceNote}\n\n`;
    md += `> ${data.description}\n\n`;

    // SQLite CREATE TABLE 掃描結果（columns）
    if (data.columns && data.columns.length > 0) {
      md += `| Column | Type | Constraints |\n`;
      md += `| :--- | :--- | :--- |\n`;
      data.columns.forEach(c => {
        md += `| \`${c.name}\` | \`${c.type}\` | ${c.constraints || ''} |\n`;
      });
    }

    // 舊 @GEMS-FIELD 格式（fields）
    if (data.fields && data.fields.length > 0) {
      md += `| Field | Type | Constraints | Description |\n`;
      md += `| :--- | :--- | :--- | :--- |\n`;
      data.fields.forEach(f => {
        md += `| **${f.name}** | \`${f.type}\` | ${f.constraint} | ${f.description} |\n`;
      });
    }

    md += `\n---\n\n`;
  }
  fs.writeFileSync(path.join(docsPath, 'DB_SCHEMA.md'), md);
}

function generateTechStack(target) {
  const pkgPath = path.join(target, 'package.json');
  if (!fs.existsSync(pkgPath)) return { dependencies: {}, devDependencies: {} };

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return {
      name: pkg.name,
      version: pkg.version,
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {}
    };
  } catch (e) {
    return { error: 'Invalid package.json' };
  }
}

function generateTechStackMarkdown(techStack, docsPath) {
  let md = '# Tech Stack\n\n';
  md += '| Package | Version | Type |\n|---|---|---|\n';

  // Simple listing for now
  Object.entries(techStack.dependencies || {}).forEach(([k, v]) => {
    md += `| ${k} | ${v} | Prod |\n`;
  });
  Object.entries(techStack.devDependencies || {}).forEach(([k, v]) => {
    md += `| ${k} | ${v} | Dev |\n`;
  });

  fs.writeFileSync(path.join(docsPath, 'TECH_STACK.md'), md);
}

// 備份 iteration 產物與源碼 (Unchanged below, just ensuring closure)
function backupIteration(iterPath, srcDir, backupsPath, iteration) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  // User request: 簡化備份名稱，僅保留日期
  const backupName = `backup_${timestamp}`;
  const backupDir = path.join(backupsPath, backupName);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // 1. 備份 GEMS 文案 (Iteration 資料夾)
  if (fs.existsSync(iterPath)) {
    const gemDest = path.join(backupDir, '.gems_snapshot');
    copyDirSync(iterPath, gemDest);
  }

  // 2. 備份實際代碼 (srcDir)
  if (fs.existsSync(srcDir)) {
    const srcDest = path.join(backupDir, 'src_snapshot');
    copyDirSync(srcDir, srcDest);
  }

  // console.log(`[Backup] ...`); // Optional log
}

function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

// 自我執行判斷 (Unchanged)
if (require.main === module) {
  const args = process.argv.slice(2);
  let target = process.cwd();
  let iteration = 'iter-1';

  args.forEach(arg => {
    if (arg.startsWith('--target=')) target = arg.split('=')[1];
    if (arg.startsWith('--project-path=')) target = arg.split('=')[1];
    if (arg.startsWith('--iteration=')) iteration = arg.split('=')[1];
  });

  if (!path.isAbsolute(target)) {
    target = path.resolve(process.cwd(), target);
  }

  run({ target, iteration });
}

module.exports = { run };
