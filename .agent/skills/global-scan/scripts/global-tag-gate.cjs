#!/usr/bin/env node
/**
 * Global Tag Gate v1.0
 * 專案全域 GEMS 標籤門控
 * 
 * 任務：掃描整個專案源碼，確保所有已標記 GEMS 的函式（特別是 P0/P1）都符合合規標準，
 * 包含必填的 FLOW、DEPS、TEST 等資訊。
 * "沒填的要他補!"
 * 
 * 用法:
 *   node sdid-tools/global-tag-gate.cjs --target=<project>
 */

const fs = require('fs');
const path = require('path');

// Resolve SDID root and then sdid-tools/lib
const sdidToolsLib = path.resolve(__dirname, '../../../../sdid-tools/lib');
const logOutput = require(path.join(sdidToolsLib, 'log-output.cjs'));

// 我們可以載入 gems-validator 來借用驗證邏輯
function loadValidator(projectRoot) {
    const taskPipeLib = path.resolve(projectRoot, '..', 'task-pipe', 'lib', 'scan');
    const litePath = path.join(taskPipeLib, 'gems-validator-lite.cjs');
    const fullPath = path.join(taskPipeLib, 'gems-validator.cjs');
    const enhancedPath = path.join(taskPipeLib, 'gems-scanner-enhanced.cjs');

    if (fs.existsSync(enhancedPath)) {
        const scanner = require(enhancedPath);
        return scanner;
    }
    return null;
}

function main() {
    const args = { target: null };
    for (const arg of process.argv.slice(2)) {
        if (arg.startsWith('--target=')) {
            args.target = path.resolve(arg.split('=')[1]);
        }
    }

    if (!args.target) {
        console.error('❌ 請指定 --target=<path>');
        process.exit(1);
    }

    const srcDir = path.join(args.target, 'src');
    if (!fs.existsSync(srcDir)) {
        console.error(`❌ 源碼目錄不存在: ${srcDir}`);
        process.exit(1);
    }

    const scanner = loadValidator(args.target);
    if (!scanner) {
        console.error(`❌ 找不到 gems-scanner-enhanced.cjs`);
        process.exit(1);
    }

    console.log(`\n🔍 開啟全域標籤掃描 (Global Tag Gate)...`);
    const result = scanner.scanGemsTagsEnhanced(srcDir);

    const blockers = [];
    const warns = [];

    // ===================================
    // 核心檢查：沒填的要他補
    // ===================================
    result.functions.forEach(f => {
        const priority = (f.priority || 'P3').toUpperCase();
        const prefix = `[${priority}] ${f.name}`;

        // 1. 取得底層 scanner 的 issues
        if (f.issues && f.issues.length > 0) {
            f.issues.forEach(msg => blockers.push({ fn: f.name, file: f.file, p: priority, msg }));
        } else {
            // 如果底層漏了，我們自己補邏輯
            if (priority === 'P0' || priority === 'P1') {
                if (!f.flow || f.flow.trim() === '') {
                    blockers.push({ fn: f.name, file: f.file, p: priority, msg: '缺少 GEMS-FLOW (流程說明)' });
                }
                if (priority === 'P0' && (!f.depsRisk || f.depsRisk.trim() === '')) {
                    blockers.push({ fn: f.name, file: f.file, p: priority, msg: '缺少 GEMS-DEPS-RISK (風險等級)' });
                }
                if (priority === 'P1' && (!f.deps || f.deps.trim() === '')) {
                    blockers.push({ fn: f.name, file: f.file, p: priority, msg: '缺少 GEMS-DEPS (依賴標記)' });
                }
            }
        }

        // 2. 額外檢查: 測試相關
        if (priority === 'P0' || priority === 'P1') {
            if (!f.test && !f.testFile && f.testStatus === undefined) {
                warns.push({ fn: f.name, file: f.file, p: priority, msg: '建議補上 GEMS-TEST 以利後續防錯測試' });
            }
        }
    });

    // ===================================
    // 3. 彙整未標記的函式 (Untagged)
    // ===================================
    if (result.untagged && result.untagged.length > 0) {
        const untaggedCount = result.untagged.length;
        warns.push({
            fn: `多個未標記函式`,
            file: '全域',
            p: 'UNKNOWN',
            msg: `專案中有 ${untaggedCount} 個函式沒有任何 GEMS 標籤。可加上 --show-untagged 參數來列印完整清單。`
        });

        if (process.argv.includes('--show-untagged')) {
            console.log(`\n=== 👻 未標記函式清單 (${untaggedCount} 項) ===`);
            // 只列出前 30 個避免洗頻
            result.untagged.slice(0, 30).forEach(u => {
                console.log(`- ${u.name} (${u.file}:${u.line})`);
            });
            if (untaggedCount > 30) {
                console.log(`... 還有 ${untaggedCount - 30} 個未列出`);
            }
            console.log('');
        }
    }

    // ===================================
    // 產生報告與結果
    // ===================================
    const logOpts = {
        projectRoot: args.target,
        iteration: 'GLOBAL',
        phase: 'gate',
        step: 'tag'
    };

    const title = `全域標籤門控 | 查核 ${result.stats.tagged} 個標籤 (共 ${result.stats.total} 函式)`;

    if (blockers.length > 0) {
        const details = [];
        details.push(`=== ❌ BLOCKER (${blockers.length} 項) ===`);
        blockers.forEach(b => details.push(`- ${b.fn} (${b.file}): ${b.msg}`));

        if (warns.length > 0) {
            details.push(`\n=== ⚠️ WARN (${warns.length} 項) ===`);
            warns.forEach(w => details.push(`- ${w.fn} (${w.file}): ${w.msg}`));
        }

        const detailText = details.join('\n');
        console.log(`\n@BLOCKER | 發現沒填寫完整的標籤`);
        console.log(detailText);

        logOutput.anchorError(
            'MISSING_TAGS',
            title,
            '請前往指定檔案，把缺漏的 GEMS-FLOW、DEPS 或風險等級補齊。',
            { ...logOpts, details: detailText }
        );
        process.exit(1);

    } else {
        // PASS
        const details = [];
        if (warns.length > 0) {
            details.push(`=== ⚠️ 建議事項 (${warns.length} 項) ===`);
            warns.forEach(w => details.push(`- ${w.fn} (${w.file}): ${w.msg}`));
        } else {
            details.push('所有 P0/P1 已完整填寫對應標籤。');
        }

        const detailText = details.join('\n');
        console.log(`\n@PASS | 標籤合規 (${title})`);
        if (warns.length > 0) console.log(detailText);

        logOutput.anchorPass('gate', 'tag', title, '繼續開發或發布。', {
            ...logOpts, details: detailText
        });
        process.exit(0);
    }
}

if (require.main === module) {
    main();
}
