#!/usr/bin/env node

/**
 * GEMS Full Project Scanner v2.2 (Viz Final)
 * 
 * 整合所有 CJS 工具，產出與 Viz 前端 API 完全對齊的 4 個必要 JSON 報告。
 * 
 * 產出檔案:
 *   1. system-blueprint.json - 前端 API 主要讀取的整合藍圖
 *   2. functions.json        - 函式清單 with specPurpose (獨立備份)
 *   3. schema.json           - 資料庫結構 (獨立備份)
 *   4. tech-stack.json       - 技術棧 (獨立備份)
 * 
 * 使用方式：
 *   node tools/gems-full-scanner.cjs <project-src-path> [options]
 * 
 * 選項：
 *   --output <dir>       報告產出目錄 (預設: .gems/docs)
 *   --iterations <dir>   迭代路徑 (預設: iterations)
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function log(msg, color = '\x1b[0m') {
    console.log(`${color}${msg}\x1b[0m`);
}

const COLORS = {
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    bright: '\x1b[1m'
};

function main() {
    const args = process.argv.slice(2);
    const srcPath = args.find(a => !a.startsWith('--')) || 'src';
    const outputDir = args.find(arg => arg.startsWith('--output='))?.split('=')[1] || '.gems/docs';
    const iterationsPath = args.find(arg => arg.startsWith('--iterations='))?.split('=')[1] || 'iterations';

    const projectRoot = process.cwd();
    const toolsDir = __dirname;
    const absOutputDir = path.isAbsolute(outputDir) ? outputDir : path.join(projectRoot, outputDir);

    log('\n🚀 GEMS Full Project Scanner v2.2 (Viz Final)', COLORS.bright + COLORS.cyan);
    log('═'.repeat(60), COLORS.cyan);
    log(`📂 源碼路徑: ${srcPath}`);
    log(`📁 輸出目錄: ${outputDir}`);
    log('');

    if (!fs.existsSync(absOutputDir)) {
        fs.mkdirSync(absOutputDir, { recursive: true });
    }

    // ========================================
    // Step 1: 執行基礎掃描
    // ========================================
    const steps = [
        {
            name: '1. Tech Stack',
            cmd: `node "${path.join(toolsDir, 'tech-stack-scanner.cjs')}" "${projectRoot}" --output="${path.join(absOutputDir, 'tech-stack.json')}"`
        },
        {
            name: '2. Structure',
            cmd: `node "${path.join(toolsDir, 'structure-scanner.cjs')}" "${srcPath}" --output="${path.join(absOutputDir, 'structure-raw.json')}"`
        },
        {
            name: '3. DB Schema',
            cmd: `node "${path.join(toolsDir, 'schema-parser.cjs')}" "${projectRoot}" --output="${path.join(absOutputDir, 'schema.json')}"`
        },
        {
            name: '4. Functions',
            cmd: `node "${path.join(toolsDir, 'gems-scanner.cjs')}" "${srcPath}" --mode=spec --output="${path.join(absOutputDir, 'functions-raw.json')}"`
        },
        {
            name: '5. Spec Purposes',
            cmd: `node "${path.join(toolsDir, 'spec-purpose-parser.cjs')}" "${iterationsPath}" --output="${path.join(absOutputDir, 'purposes.json')}"`
        }
    ];

    steps.forEach(step => {
        log(`▶️  ${step.name}...`, COLORS.bright);
        try {
            execSync(step.cmd, { stdio: 'ignore' });
            log(`✅ 完成`, COLORS.green);
        } catch (err) {
            log(`❌ 失敗`, COLORS.red);
        }
    });

    log('\n🛠️  Final Processing...', COLORS.magenta);

    // ========================================
    // Step 2: 建立 functions.json (含 specPurpose)
    // ========================================
    let functionsSpec = { version: '6.0', generatedAt: new Date().toISOString(), totalCount: 0, byRisk: { P0: 0, P1: 0, P2: 0, P3: 0 }, functions: [] };
    try {
        const rawFuncPath = path.join(absOutputDir, 'functions-raw.json');
        const purposePath = path.join(absOutputDir, 'purposes.json');
        if (fs.existsSync(rawFuncPath)) {
            const rawData = JSON.parse(fs.readFileSync(rawFuncPath, 'utf8'));
            const purposes = fs.existsSync(purposePath) ? JSON.parse(fs.readFileSync(purposePath, 'utf8')) : {};

            const functions = rawData.functions || [];
            const byRisk = { P0: 0, P1: 0, P2: 0, P3: 0 };

            functions.forEach(f => {
                f.specPurpose = purposes[f.name] || null;
                if (byRisk[f.risk] !== undefined) byRisk[f.risk]++;
            });

            functionsSpec = {
                version: '6.0',
                generatedAt: new Date().toISOString(),
                totalCount: functions.length,
                byRisk,
                functions
            };

            fs.writeFileSync(path.join(absOutputDir, 'functions.json'), JSON.stringify(functionsSpec, null, 2));
            fs.unlinkSync(rawFuncPath);
            if (fs.existsSync(purposePath)) fs.unlinkSync(purposePath);
            log(`✅ functions.json`, COLORS.green);
        }
    } catch (e) { log(`⚠️ functions.json 失敗: ${e.message}`, COLORS.yellow); }

    // ========================================
    // Step 3: 建立 system-blueprint.json (整合版)
    // ========================================
    try {
        const structurePath = path.join(absOutputDir, 'structure-raw.json');
        const schemaPath = path.join(absOutputDir, 'schema.json');
        const techStackPath = path.join(absOutputDir, 'tech-stack.json');

        const structure = fs.existsSync(structurePath) ? JSON.parse(fs.readFileSync(structurePath, 'utf8')) : { modules: {} };
        const schema = fs.existsSync(schemaPath) ? JSON.parse(fs.readFileSync(schemaPath, 'utf8')) : null;
        const techStack = fs.existsSync(techStackPath) ? JSON.parse(fs.readFileSync(techStackPath, 'utf8')) : null;

        const modules = Object.values(structure.modules || {});

        // Build system-blueprint.json
        const blueprint = {
            name: path.basename(projectRoot),
            type: 'project',
            stats: {
                modules: modules.length,
                scripts: modules.reduce((sum, m) => sum + (m.files?.length || 0), 0),
                functions: functionsSpec.totalCount,
                tables: schema?.tables ? Object.keys(schema.tables).length : 0
            },
            techStack: techStack?.items || techStack || [],
            erDiagram: structure.mermaid || '',
            children: []
        };

        // Add Database Node
        if (schema && schema.tables && Object.keys(schema.tables).length > 0) {
            blueprint.children.push({
                name: 'Database',
                type: 'database',
                desc: 'Database Schema',
                aiSummary: schema.aiSummary || '',
                tables: Object.values(schema.tables).map(t => ({
                    name: t.name,
                    desc: t.description || '',
                    columns: t.columns || []
                }))
            });
        }

        // Add Source Modules Node
        blueprint.children.push({
            name: 'Source Modules',
            type: 'folder',
            desc: 'Business Logic Modules',
            children: modules.map(m => ({
                name: m.name,
                type: 'module',
                desc: `${m.name} module`,
                path: m.path,
                scripts: (m.files || []).map(f => ({
                    name: path.basename(f),
                    type: 'script',
                    path: f,
                    functions: functionsSpec.functions
                        .filter(fn => fn.file && fn.file.includes(path.basename(f)))
                        .map(fn => ({
                            name: fn.name,
                            type: 'function',
                            tag: fn.risk,
                            desc: fn.description || '',
                            flow: fn.flow ? fn.flow.split('→') : []
                        }))
                }))
            }))
        });

        fs.writeFileSync(path.join(absOutputDir, 'system-blueprint.json'), JSON.stringify(blueprint, null, 2));
        log(`✅ system-blueprint.json`, COLORS.green);

        // Cleanup structure-raw.json
        if (fs.existsSync(structurePath)) fs.unlinkSync(structurePath);
    } catch (e) { log(`⚠️ system-blueprint.json 失敗: ${e.message}`, COLORS.yellow); }

    // ========================================
    // Step 4: Cleanup
    // ========================================
    try {
        const schemaMdPath = path.join(absOutputDir, 'schema.md');
        if (fs.existsSync(schemaMdPath)) fs.unlinkSync(schemaMdPath);
    } catch (e) { /* ignore */ }

    // ========================================
    // Summary
    // ========================================
    log('\n✨ 產出完成:', COLORS.bright + COLORS.green);
    log(`📍 ${absOutputDir}`, COLORS.green);
    log('\n📄 Viz 標準 4 個 JSON:', COLORS.cyan);
    const expectedFiles = ['system-blueprint.json', 'functions.json', 'schema.json', 'tech-stack.json'];
    expectedFiles.forEach(f => {
        if (fs.existsSync(path.join(absOutputDir, f))) {
            log(`   ✅ ${f}`, COLORS.cyan);
        } else {
            log(`   ❌ ${f}`, COLORS.red);
        }
    });
    log('\n' + '═'.repeat(60), COLORS.cyan);
}

main();
