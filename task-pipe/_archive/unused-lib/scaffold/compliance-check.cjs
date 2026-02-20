#!/usr/bin/env node
/**
 * GEMS 標籤符合度檢查 - 對照 gems-tagging-complete-guide.md v2.1
 */

const { scaffoldGenerators } = require('./generator.cjs');

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║  GEMS 標籤符合度檢查 - 對照官方指南 v2.1                         ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

const plan = scaffoldGenerators.implementation_plan({
    storyId: 'Story-1.0',
    moduleName: 'Task'
});

// 官方指南 v2.1 必備標籤檢查
const guideV21Checks = [
    // Section 2: 基礎標籤格式
    {
        name: '基礎標籤格式',
        desc: 'GEMS: EntityName | P0 | ✓✓ | Input→Output | Story-X.X | 描述',
        regex: /GEMS:\s+\w+\s*\|\s*P[0-3]\s*\|\s*[✓○⚠]+\s*\|\s*[^|]+\|\s*Story-[\d.]+\s*\|/,
        required: true,
        section: '§2'
    },

    // Section 3.1: GEMS-FLOW
    {
        name: 'GEMS-FLOW 格式',
        desc: 'GEMS-FLOW: Step1→Step2→Step3',
        regex: /GEMS-FLOW:\s*\w+→\w+/,
        required: true,
        section: '§3.1'
    },
    {
        name: 'GEMS-FLOW 顆粒度',
        desc: '3-5 個步驟（不超過 7 個）',
        regex: /GEMS-FLOW:\s*(\w+→){2,6}\w+/,
        required: true,
        section: '§3.1'
    },

    // Section 3.2: GEMS-DEPS (v2.1 折衷格式)
    {
        name: 'GEMS-DEPS 格式',
        desc: '[Type.Name (說明)] 或 [Type.Name]',
        regex: /GEMS-DEPS:\s*\[[\w.]+/,
        required: true,
        section: '§3.2'
    },
    {
        name: 'GEMS-DEPS 精確化',
        desc: '有 Internal/Shared/Database/Module 等類型',
        regex: /\[(Internal|Shared|Database|Module|Config|Lib)\./,
        required: true,
        section: '§3.2'
    },
    {
        name: 'GEMS-DEPS-RISK',
        desc: 'LOW / MEDIUM / HIGH',
        regex: /GEMS-DEPS-RISK:\s*(LOW|MEDIUM|HIGH)/,
        required: true,
        section: '§3.2'
    },

    // Section 3.4: [STEP] 錨點 (v2.1 新增)
    {
        name: '[STEP] 錨點存在',
        desc: 'P0/P1 必須有 [STEP] 錨點',
        regex: /\/\/\s*\[STEP\]/,
        required: true,
        section: '§3.4'
    },
    {
        name: '[STEP] 多個錨點',
        desc: '與 FLOW 步驟數對應',
        regex: /\[STEP\].*\[STEP\].*\[STEP\]/s,
        required: true,
        section: '§3.4'
    },

    // Section 5: 測試標籤
    {
        name: 'GEMS-TEST',
        desc: '✓ Unit | ✓ Integration | - E2E',
        regex: /GEMS-TEST:\s*[✓-]\s*Unit/,
        required: true,
        section: '§5'
    },
    {
        name: 'GEMS-TEST-FILE',
        desc: '指定測試檔案名',
        regex: /GEMS-TEST-FILE:\s*\w+\.test\.(ts|js|tsx)/,
        required: true,
        section: '§5'
    },

    // 額外檢查 - 不應該有的 (Anti-patterns)
    {
        name: '無 GEMS-ALGO (已廢棄)',
        desc: 'v2.1 已移除 ALGO',
        regex: /GEMS-ALGO:/,
        shouldNotExist: true,
        section: '§3.3'
    },
    {
        name: '無籠統 DEPS',
        desc: '不應有 [Supabase] 或 [Database] 這種籠統標籤',
        regex: /GEMS-DEPS:\s*\[(Supabase|Database)\]/,
        shouldNotExist: true,
        section: '§3.2'
    },

    // UI 標籤 (可選)
    {
        name: 'GEMS-UI (可選)',
        desc: 'UI 元件的佈局結構',
        regex: /GEMS-UI:/,
        required: false,
        section: '§10.2'
    }
];

let passed = 0;
let failed = 0;
let optional = 0;

console.log('對照官方指南 gems-tagging-complete-guide.md v2.1:\n');

for (const check of guideV21Checks) {
    const exists = check.regex.test(plan);

    if (check.shouldNotExist) {
        // 反向檢查：不應該存在
        if (!exists) {
            console.log(`✅ ${check.section} ${check.name}`);
            console.log(`   ✓ 正確：${check.desc}`);
            passed++;
        } else {
            console.log(`❌ ${check.section} ${check.name}`);
            console.log(`   ✗ 錯誤：發現了不應存在的 ${check.desc}`);
            failed++;
        }
    } else if (check.required) {
        if (exists) {
            console.log(`✅ ${check.section} ${check.name}`);
            passed++;
        } else {
            console.log(`❌ ${check.section} ${check.name}`);
            console.log(`   缺少：${check.desc}`);
            failed++;
        }
    } else {
        if (exists) {
            console.log(`☑️  ${check.section} ${check.name} (可選)`);
            optional++;
        } else {
            console.log(`⬜ ${check.section} ${check.name} (可選，未包含)`);
        }
    }
}

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log(`符合度: ${passed}/${passed + failed} 必填項 (${Math.round(passed / (passed + failed) * 100)}%)`);
console.log(`可選項: ${optional} 個已包含`);
console.log('═══════════════════════════════════════════════════════════════════\n');

if (failed === 0) {
    console.log('🎉 完全符合 GEMS 標籤指南 v2.1！');
} else {
    console.log(`⚠️  有 ${failed} 個項目需要修正`);
}
