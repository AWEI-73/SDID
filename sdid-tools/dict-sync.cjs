#!/usr/bin/env node
/**
 * dict-sync.cjs  (Wave 3 — phase-8 字典同步)
 *
 * BUILD 後執行：將 AST 掃描結果同步回 .gems/specs/*.json
 *
 * 同步項目：
 *   lineRange  — 用實際行號覆蓋 spec 的佔位符（L1-1）
 *   status     — 依 GEMS 源碼標籤回填（✓✓/✓/⬜）
 *
 * GEMS 源碼 status → dict status 對照：
 *   ✓✓ (實作+測試)  → ✓✓
 *   ✓○ (實作無測試) → ✓
 *   ○○ (未實作)     → ⬜
 *   新格式 (inline) → 不變動 status（inline 無 status 欄位）
 *
 * 用法：
 *   node sdid-tools/dict-sync.cjs --project=ExamForge [--src=src] [--dry-run]
 *
 * 退出碼：
 *   0 = 同步完成（含 spec-gate PASS）
 *   1 = spec-gate FAIL
 *   2 = 設定錯誤
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const { scanV2 }  = require('./lib/gems-scanner-v2.cjs');
const specGatePath = path.join(__dirname, 'spec-gate.cjs');

// ─────────────────────────────────────────────────────────────
// GEMS 源碼 status 解析
// ─────────────────────────────────────────────────────────────

// 舊格式第3欄：✓✓ / ✓○ / ○○ / ✓⚠
const OLD_STATUS_RE = /\*\s*GEMS:\s*\S+\s*\|\s*P[0-3]\s*\|\s*([✓○⚠]+)/;

/**
 * 從 GEMS 源碼注釋提取 status
 * @param {string} commentText
 * @returns {string|null} dict status (✓✓ / ✓ / ⬜) or null
 */
function extractSourceStatus(commentText) {
  if (!commentText) return null;
  const m = commentText.match(OLD_STATUS_RE);
  if (!m) return null; // inline 格式無 status 欄位

  const raw = m[1]; // ✓✓ / ✓○ / ○○ / ✓⚠
  if (raw === '✓✓') return '✓✓';
  if (raw.startsWith('✓')) return '✓';   // ✓○ → 實作但未全測
  return '⬜';                           // ○○ → 未實作
}

// ─────────────────────────────────────────────────────────────
// 載入 spec 檔
// ─────────────────────────────────────────────────────────────

function loadSpecFiles(projectRoot) {
  const specsDir = path.join(projectRoot, '.gems', 'specs');
  const specMap  = new Map(); // specFile (相對) → { absPath, data }

  if (!fs.existsSync(specsDir)) return specMap;

  for (const f of fs.readdirSync(specsDir)) {
    if (!f.endsWith('.json') || f === '_index.json') continue;
    const abs  = path.join(specsDir, f);
    const rel  = `specs/${f}`;
    try {
      specMap.set(rel, { absPath: abs, data: JSON.parse(fs.readFileSync(abs, 'utf8')) });
    } catch { /* skip corrupt files */ }
  }
  return specMap;
}

// ─────────────────────────────────────────────────────────────
// 同步邏輯
// ─────────────────────────────────────────────────────────────

/**
 * 執行字典同步
 * @returns {{ updated: string[], notFound: string[], unchanged: string[], dryRun: boolean }}
 */
function syncDict(projectRoot, srcDir, dryRun) {
  // 1. AST 掃描
  console.log('  掃描源碼 (AST)...');
  const scanResult = scanV2(srcDir, projectRoot);

  // 建立 gemsId → 掃描結果的 map
  const scanMap = new Map(); // gemsId → func entry
  for (const func of scanResult.functions) {
    if (func.gemsId) scanMap.set(func.gemsId, func);
  }

  // 2. 載入 spec 檔
  const specMap = loadSpecFiles(projectRoot);

  const updated   = [];
  const notFound  = [];
  const unchanged = [];

  // 3. 逐一比對 dict 條目
  for (const [specRel, { absPath, data }] of specMap) {
    let specDirty = false;

    for (const [key, entry] of Object.entries(data)) {
      if (key === '$meta') continue;

      const scanned = scanMap.get(key);

      if (!scanned) {
        // 實作中找不到
        notFound.push(key);
        continue;
      }

      const changes = {};

      // ── lineRange 更新 ──
      const actualRange = `L${scanned.startLine}-${scanned.endLine || scanned.startLine}`;
      if (entry.lineRange !== actualRange) {
        changes.lineRange = { from: entry.lineRange, to: actualRange };
        entry.lineRange   = actualRange;
        specDirty = true;
      }

      // ── status 更新（只升不降：⬜ < 🔧 < ✓ < ✓✓）──
      const STATUS_RANK = { '⬜': 0, '🔧': 1, '✓': 2, '✓✓': 3 };
      const srcStatus = extractSourceStatus(scanned.commentText);
      if (srcStatus && srcStatus !== '⬜') {
        const curRank = STATUS_RANK[entry.status] ?? 0;
        const newRank = STATUS_RANK[srcStatus]    ?? 0;
        if (newRank > curRank) {
          changes.status = { from: entry.status, to: srcStatus };
          entry.status   = srcStatus;
          specDirty = true;
        }
      }

      if (Object.keys(changes).length > 0) {
        updated.push({ gemsId: key, specFile: specRel, changes });
      } else {
        unchanged.push(key);
      }
    }

    // 4. 寫回 spec 檔
    if (specDirty && !dryRun) {
      fs.writeFileSync(absPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    }
  }

  return { updated, notFound, unchanged, dryRun, scanMap };
}

// ─────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  let projectRoot = process.cwd();
  let srcSubDir   = 'src';
  let dryRun      = false;

  for (const a of args) {
    if (a.startsWith('--project=')) projectRoot = path.resolve(a.split('=')[1]);
    if (a.startsWith('--src='))     srcSubDir   = a.split('=')[1];
    if (a === '--dry-run')          dryRun      = true;
  }

  const srcDir = path.join(projectRoot, srcSubDir);

  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║       GEMS dict-sync  (Wave 3)        ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log(`  專案: ${projectRoot}`);
  console.log(`  掃描: ${srcDir}`);
  if (dryRun) console.log('  模式: DRY-RUN（不寫入）');

  if (!fs.existsSync(srcDir)) {
    console.error(`\n✗ 找不到 src 目錄: ${srcDir}`);
    process.exit(2);
  }

  const { updated, notFound, unchanged } = syncDict(projectRoot, srcDir, dryRun);

  // ── 報告 ──
  console.log('\n─── 同步結果 ──────────────────────────');

  if (updated.length) {
    console.log(`\n  已更新 (${updated.length}):`);
    for (const u of updated) {
      console.log(`    ${u.gemsId}  [${u.specFile}]`);
      for (const [field, { from, to }] of Object.entries(u.changes)) {
        console.log(`      ${field}: "${from}" → "${to}"`);
      }
    }
  }

  if (notFound.length) {
    console.log(`\n  未找到實作 (${notFound.length}) ← 可能尚未 BUILD:`);
    for (const g of notFound) console.log(`    ${g}`);
  }

  if (unchanged.length) {
    console.log(`\n  無變更 (${unchanged.length}):`);
    for (const g of unchanged) console.log(`    ${g}`);
  }

  if (dryRun) {
    console.log('\n─── DRY-RUN：以上變更未寫入 ──────────');
    process.exit(0);
  }

  // ── spec-gate 驗證 ──
  console.log('\n─── spec-gate 驗證 ─────────────────────');
  const { execSync } = require('child_process');
  try {
    const out = execSync(
      `node "${specGatePath}" --project="${projectRoot}"`,
      { encoding: 'utf8' }
    );
    console.log(out);
    console.log('✅ dict-sync 完成，spec-gate PASS');
  } catch (e) {
    console.error(e.stdout || e.message);
    console.error('✗ spec-gate FAIL — 請手動修正 dict 後重跑');
    process.exit(1);
  }
}

module.exports = { syncDict, extractSourceStatus };
