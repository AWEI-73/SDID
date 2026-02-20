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
const { detectProjectType, getSrcDir } = require('../../lib/shared/project-type.cjs');
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

  // 偵測專案類型
  const { type: projectType } = detectProjectType(absTarget);
  const srcDir = getSrcDir(absTarget, projectType);

  // 確保目錄存在
  [docsPath, backupsPath].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // v2.4: 使用本地 scanner（task-pipe 獨立運作）
  const scannerPaths = [
    path.join(__dirname, '..', '..', 'lib', 'gems-scanner.cjs')
  ];

  const scannerPath = scannerPaths.find(p => fs.existsSync(p));

  const runOptions = {
    projectRoot: absTarget,
    iteration: parseInt(iteration.replace('iter-', '') || '1'),
    phase: 'scan',
    step: 'scan'
  };

  if (!scannerPath) {
    // 沒有 scanner，使用內建的簡易掃描
    return runBuiltinScan(absTarget, srcDir, iteration, docsPath, backupsPath, iterPath, errorHandler, runOptions, projectType);
  }

  // 使用找到的 scanner
  return runFullScan(absTarget, srcDir, iteration, scannerPath, docsPath, backupsPath, iterPath, errorHandler, runOptions);
}

/**
 * 使用完整 scanner
 */
function runFullScan(target, srcDir, iteration, scannerPath, docsPath, backupsPath, iterPath, errorHandler, runOptions) {
  anchorOutput({
    context: `Phase SCAN | 規格書產出 | ${iteration}`,
    info: {
      'Scanner': 'gems-full-scanner.cjs',
      '源碼': srcDir,
      '輸出': docsPath
    },
    task: ['執行掃描並產出規格書'],
    output: 'Scanning...'
  }, runOptions);

  try {
    // 備份當前 iteration 與源碼
    backupIteration(iterPath, srcDir, backupsPath, iteration);

    // 執行 scanner - 注意：srcDir 是相對於 target 的路徑
    const iterationsPath = path.join(target, '.gems', 'iterations');
    const relativeSrcDir = path.relative(target, srcDir);
    const cmd = `node "${scannerPath}" "${relativeSrcDir}" --output="${docsPath}" --iterations="${iterationsPath}"`;

    execSync(cmd, {
      cwd: target,
      stdio: 'inherit',
      encoding: 'utf8'
    });

    // 驗證產出
    const expectedFiles = ['system-blueprint.json', 'functions.json', 'schema.json', 'tech-stack.json'];
    const produced = expectedFiles.filter(f => fs.existsSync(path.join(docsPath, f)));
    const missing = expectedFiles.filter(f => !fs.existsSync(path.join(docsPath, f)));

    if (missing.length > 0) {
      console.log(`\n[WARN] 缺少產出檔案: ${missing.join(', ')}`);
    }

    anchorPass('SCAN', 'Full Scan',
      `SCAN 完成 | 產出: ${produced.length}/${expectedFiles.length}`,
      `位置: ${path.relative(process.cwd(), docsPath) || docsPath}`,
      { ...runOptions, details: produced.join(', ') }
    );

    return { verdict: 'PASS', produced, missing };

  } catch (err) {
    // TACTICAL_FIX 機制
    const attempt = errorHandler.recordError('E6', err.message);

    if (errorHandler.shouldBlock()) {
      anchorError('BLOCKER',
        `SCAN 連續失敗 (${MAX_ATTEMPTS}/${MAX_ATTEMPTS})`,
        '需要人類介入',
        {
          details: `### SCAN Phase 執行連續失敗
錯誤: ${err.message}
建議行動:
1. 檢查 scanner 工具是否正確安裝
2. 確認源碼目錄與依賴`,
          ...runOptions
        });
      return { verdict: 'BLOCKER', reason: 'tactical_fix_limit', error: err.message };
    }

    const recoveryLevel = errorHandler.getRecoveryLevel();

    anchorOutput({
      context: `Phase SCAN | 失敗 | Attempt ${attempt}`,
      error: {
        type: 'TACTICAL_FIX',
        summary: `SCAN 執行失敗: ${err.message}`,
        attempt,
        maxAttempts: MAX_ATTEMPTS
      },
      template: {
        title: `RECOVERY_ACTION (Level ${recoveryLevel})`,
        content: recoveryLevel === 1
          ? '重新執行掃描'
          : recoveryLevel === 2
            ? '檢查源碼目錄與依賴'
            : '完整診斷，準備人類介入'
      },
      output: `NEXT: node task-pipe/runner.cjs --phase=SCAN --target=${relativeTarget}`
    }, runOptions);

    return { verdict: 'PENDING', attempt, error: err.message };
  }
}

/**
 * 內建簡易掃描（沒有完整 scanner 時使用）
 * v7.0: 使用增強版掃描器，支援行號索引
 */
function runBuiltinScan(target, srcDir, iteration, docsPath, backupsPath, iterPath, errorHandler, runOptions, projectType) {
  anchorOutput({
    context: `Phase SCAN | 規格書產出 | ${iteration}`,
    info: {
      'Scanner': 'Enhanced v7.0 (行號索引)',
      '源碼': srcDir,
      '輸出': docsPath
    },
    task: ['執行增強掃描 (含 startLine/endLine)'],
    output: 'Scanning...'
  }, runOptions);

  try {
    // 備份當前 iteration 與源碼
    backupIteration(iterPath, srcDir, backupsPath, iteration);
    // v7.0: 優先使用增強版掃描器
    let scanResult;
    let scannerVersion = '6.0';

    try {
      const { scanGemsTagsEnhanced, generateFunctionIndex } = require('../../lib/scan/gems-scanner-enhanced.cjs');
      scanResult = scanGemsTagsEnhanced(srcDir);
      scannerVersion = '7.0';

      // 產出函式索引檔 (給 AI 快速查詢)
      const index = generateFunctionIndex(scanResult.functions);
      fs.writeFileSync(
        path.join(docsPath, 'function-index.json'),
        JSON.stringify(index, null, 2)
      );
    } catch (e) {
      // Fallback 到舊版
      console.log(`[SCAN] Enhanced scanner not available, using lite version`);
      const { scanGemsTags } = require('../../lib/scan/gems-validator.cjs');
      scanResult = scanGemsTags(srcDir);
    }

    // 產出 functions.json (v7.0 含行號)
    const functionsJson = {
      version: scannerVersion,
      generatedAt: new Date().toISOString(),
      totalCount: scanResult.functions?.length || scanResult.stats?.tagged || 0,
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
      }))
    };

    fs.writeFileSync(
      path.join(docsPath, 'functions.json'),
      JSON.stringify(functionsJson, null, 2)
    );

    // [New] 產出 schema.json (IndexedDB support)
    const schema = generateSchema(srcDir);
    fs.writeFileSync(path.join(docsPath, 'schema.json'), JSON.stringify(schema, null, 2));

    // 另外產出 DB_SCHEMA.md 供閱讀
    generateSchemaMarkdown(schema, docsPath);

    // [New] 產出 tech-stack.json
    const techStack = generateTechStack(target);
    fs.writeFileSync(path.join(docsPath, 'tech-stack.json'), JSON.stringify(techStack, null, 2));

    // 另外產出 TECH_STACK.md 供閱讀
    generateTechStackMarkdown(techStack, docsPath);

    // 產出簡易 system-blueprint.json
    const blueprint = {
      name: path.basename(target),
      type: 'project',
      generatedAt: new Date().toISOString(),
      stats: {
        functions: scanResult.functions.length,
        p0: scanResult.stats.p0,
        p1: scanResult.stats.p1,
        p2: scanResult.stats.p2,
        p3: scanResult.stats.p3,
        entities: Object.keys(schema).length,
        techStack: Object.keys(techStack.dependencies || {}).length
      },
      note: '由 task-pipe 內建掃描產出 (含 IndexedDB/TechStack 支援)'
    };

    fs.writeFileSync(
      path.join(docsPath, 'system-blueprint.json'),
      JSON.stringify(blueprint, null, 2)
    );

    // v8.0: 產出 Semantic Contract (contract.json + CONTRACT.md)
    try {
      const { generateContract, formatContractMarkdown } = require('../../lib/scan/contract-generator.cjs');
      const contract = generateContract(target, srcDir, iteration);

      fs.writeFileSync(
        path.join(docsPath, 'contract.json'),
        JSON.stringify(contract, null, 2)
      );

      fs.writeFileSync(
        path.join(docsPath, 'CONTRACT.md'),
        formatContractMarkdown(contract)
      );

      console.log(`[SCAN] Contract generated: ${contract.summary.functions} functions, ${contract.summary.stories} stories`);
    } catch (e) {
      console.log(`[SCAN] Contract generation skipped: ${e.message}`);
    }

    const produced = ['functions.json', 'system-blueprint.json', 'schema.json', 'tech-stack.json', 'contract.json', 'CONTRACT.md'];
    if (scannerVersion === '7.0') {
      produced.push('function-index.json');
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
          '行號索引': scannerVersion === '7.0' ? '✓' : '-'
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

function generateSchema(srcDir) {
  const typesPath = path.join(srcDir, 'types', 'index.ts');
  const entities = {};

  if (!fs.existsSync(typesPath)) return entities;

  const content = fs.readFileSync(typesPath, 'utf-8');
  const lines = content.split('\n');

  let parsingEntity = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('@GEMS-FIELD:')) {
      const tagContent = trimmed.split('@GEMS-FIELD:')[1].trim();
      const parts = tagContent.split('|').map(s => s.trim());

      if (parts.length === 2 && /^[A-Z]/.test(parts[0])) {
        // Entity: Name | Desc
        const [name, rawDesc] = parts;
        parsingEntity = name;
        entities[parsingEntity] = {
          description: rawDesc.replace(/\*\/\s*$/, '').trim(),
          fields: []
        };
      } else if (parts.length >= 3 && parsingEntity) {
        // Field
        const [name, type, ...rest] = parts;
        let constraint = '-';
        let desc = '-';
        if (rest.length === 1) {
          desc = rest[0].replace(/\*\/\s*$/, '').trim();
        } else if (rest.length >= 2) {
          constraint = rest[0];
          desc = rest[1].replace(/\*\/\s*$/, '').trim();
        }
        entities[parsingEntity].fields.push({ name, type, constraint, description: desc });
      }
    }
  }
  return entities;
}

function generateSchemaMarkdown(schema, docsPath) {
  let md = '# Database Schema (IndexedDB)\n';
  md += `> Generated on ${new Date().toLocaleString()}\n\n`;

  for (const [entityName, data] of Object.entries(schema)) {
    md += `## ${entityName} (${data.description})\n\n`;
    md += `| Field | Type | Constraints | Description |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    data.fields.forEach(f => {
      md += `| **${f.name}** | \`${f.type}\` | ${f.constraint} | ${f.description} |\n`;
    });
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
