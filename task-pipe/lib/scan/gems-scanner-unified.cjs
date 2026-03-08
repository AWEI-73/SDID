#!/usr/bin/env node
/**
 * GEMS Scanner Unified v1.0
 * 
 * 統一掃描入口 — 所有 consumer 都引用這個檔案。
 * 策略：優先 gems-scanner-v2 (AST)，fallback 到 gems-validator (Regex)。
 * 
 * 取代：
 *   - gems-scanner-v2-proxy.cjs (thin proxy → v2)
 *   - gems-scanner-enhanced.cjs (Regex + 行號)
 *   - gems-scanner.cjs (v5.2 舊格式, @deprecated)
 *   - 直接 require gems-validator.cjs 的 scanGemsTags
 * 
 * 用法：
 *   const { scan, scanGemsTags, validateP0P1Compliance, ... } = require('./gems-scanner-unified.cjs');
 */
'use strict';

const path = require('path');
const fs = require('fs');

// ── 載入 scanner 版本 ──

let scannerV2 = null;
const V2_PATH = path.resolve(__dirname, '..', '..', '..', 'sdid-tools', 'gems-scanner-v2.cjs');
try {
  if (fs.existsSync(V2_PATH)) {
    scannerV2 = require(V2_PATH);
  }
} catch (e) { /* v2 not available */ }

// Regex fallback 永遠可用
const validator = require('./gems-validator.cjs');

// AC 行解析（from enhanced scanner）
const { findACLines } = require('./gems-scanner-enhanced.cjs');

// ── 統一掃描 API ──

/**
 * 統一掃描入口
 * @param {string} srcDir - 源碼目錄（絕對路徑）
 * @param {string} [projectRoot] - 專案根目錄（v2 需要，用於讀 .gems/specs）
 * @param {object} [options] - 選項
 * @param {string} [options.mode] - 'ast' | 'regex' | 'auto'（預設 auto）
 * @returns {{ functions: Array, stats: object, untagged?: Array, scannerVersion: string }}
 */
function scan(srcDir, projectRoot, options = {}) {
  const mode = options.mode || 'auto';
  let result;

  // AST 模式（v2）
  if ((mode === 'ast' || mode === 'auto') && scannerV2) {
    try {
      const root = projectRoot || inferProjectRoot(srcDir);
      const v2Result = scannerV2.scanV2(srcDir, root);
      if (v2Result && (v2Result.functions?.length > 0 || v2Result.tagged?.length > 0)) {
        result = normalizeV2Result(v2Result);
      }
    } catch (e) {
      if (mode === 'ast') {
        throw new Error(`AST scanner 失敗: ${e.message}`);
      }
      // auto mode: fallback to regex
    }
  }

  if (!result) {
    // Regex fallback
    const regexResult = validator.scanGemsTags(srcDir);
    result = {
      functions: regexResult.functions || [],
      stats: {
        total: regexResult.stats?.total || 0,
        tagged: regexResult.stats?.tagged || 0,
        p0: regexResult.stats?.p0 || 0,
        p1: regexResult.stats?.p1 || 0,
        p2: regexResult.stats?.p2 || 0,
        p3: regexResult.stats?.p3 || 0,
      },
      untagged: [],
      scannerVersion: 'regex-6.0',
    };
  }

  // AC 後處理：為每個函式補上 acIds（如果 scanner 沒提供）
  enrichWithACIds(result.functions, srcDir);

  // Shrink 格式後處理：掃描 shrink 格式標籤（/** GEMS: name | P | FLOW */）
  // v2 scanner 和 regex scanner 都不認識 shrink 格式，需要額外掃描
  const shrinkFns = parseShrinkFormat(srcDir, projectRoot);
  if (shrinkFns.length > 0) {
    // 合併：shrink 函式如果已在 result.functions 中就跳過（以 name 去重）
    const existingNames = new Set(result.functions.map(f => f.name));
    for (const fn of shrinkFns) {
      if (!existingNames.has(fn.name)) {
        result.functions.push(fn);
        // 更新 stats
        const p = fn.priority;
        if (p === 'P0') result.stats.p0 = (result.stats.p0 || 0) + 1;
        else if (p === 'P1') result.stats.p1 = (result.stats.p1 || 0) + 1;
        else if (p === 'P2') result.stats.p2 = (result.stats.p2 || 0) + 1;
        else if (p === 'P3') result.stats.p3 = (result.stats.p3 || 0) + 1;
        result.stats.tagged = (result.stats.tagged || 0) + 1;
        result.stats.total = (result.stats.total || 0) + 1;
      }
    }
  }

  return result;
}

/**
 * 為函式補上 acIds — 讀取源碼中 GEMS 標籤結束後、STEP 前的 AC-X.Y 行
 * @param {Array} functions - 函式陣列（會被 mutate）
 * @param {string} srcDir - 源碼目錄
 */
function enrichWithACIds(functions, srcDir) {
  // 按檔案分組，避免重複讀取
  const byFile = new Map();
  for (const fn of functions) {
    if (fn.acIds) continue; // 已有就跳過
    if (!fn.file) continue;
    if (!byFile.has(fn.file)) byFile.set(fn.file, []);
    byFile.get(fn.file).push(fn);
  }

  for (const [relFile, fns] of byFile) {
    // 嘗試解析檔案路徑
    let fullPath = relFile;
    if (!path.isAbsolute(relFile)) {
      // 嘗試從 srcDir 的父目錄解析（因為 file 通常是 src/... 相對路徑）
      const projectRoot = inferProjectRoot(srcDir);
      fullPath = path.join(projectRoot, relFile);
    }
    if (!fs.existsSync(fullPath)) continue;

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      for (const fn of fns) {
        // 找 GEMS 標籤結束行（ */ 行）
        // 從函式的 startLine 往上找
        const funcLine = fn.startLine || 0;
        if (funcLine <= 0) continue;

        let gemsEndLine = 0;
        for (let i = funcLine - 2; i >= Math.max(0, funcLine - 50); i--) {
          if (lines[i] && lines[i].trim() === '*/') {
            gemsEndLine = i + 1; // 轉 1-based
            break;
          }
        }
        if (gemsEndLine === 0) continue;

        const acIds = findACLines(lines, gemsEndLine, funcLine);
        if (acIds.length > 0) {
          fn.acIds = acIds;
        }
      }
    } catch { /* 讀取失敗就跳過 */ }
  }
}

/**
 * 正規化 v2 結果到統一格式
 */
function normalizeV2Result(v2Result) {
  const tagged = v2Result.tagged || v2Result.functions || [];
  const untagged = v2Result.untagged || [];

  return {
    functions: tagged.map(f => ({
      name: f.name,
      file: f.file,
      startLine: f.startLine || null,
      endLine: f.endLine || null,
      priority: f.priority,
      status: f.status || '✓✓',
      signature: f.signature || '',
      storyId: f.storyId || null,
      description: f.description || '',
      flow: f.flow || null,
      deps: f.deps || [],
      depsRisk: f.depsRisk || null,
      test: f.test || null,
      testFile: f.testFile || null,
      gemsId: f.gemsId || null,
      fraudIssues: [],
    })),
    stats: {
      total: (v2Result.stats?.totalScanned || 0),
      tagged: v2Result.stats?.tagged || tagged.length,
      p0: v2Result.stats?.P0 || 0,
      p1: v2Result.stats?.P1 || 0,
      p2: v2Result.stats?.P2 || 0,
      p3: v2Result.stats?.P3 || 0,
      coverageRate: v2Result.stats?.coverageRate || '0%',
      untaggedCount: v2Result.stats?.untaggedCount || untagged.length,
      dictBacked: v2Result.stats?.dictBacked || 0,
      commentOnly: v2Result.stats?.commentOnly || 0,
    },
    untagged,
    scannerVersion: 'ast-v2',
  };
}

/**
 * 從 srcDir 推斷 projectRoot
 */
function inferProjectRoot(srcDir) {
  let dir = path.resolve(srcDir, '..');
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, '.gems')) || fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.resolve(dir, '..');
  }
  return path.resolve(srcDir, '..');
}

/**
 * 解析 shrink 格式標籤（/** GEMS: name | P | FLOW *\/）
 * v2 scanner 和 regex scanner 都不認識此格式，需要額外掃描
 * @param {string} srcDir
 * @returns {Array} 函式陣列
 */
function parseShrinkFormat(srcDir, projectRoot) {
  const results = [];
  if (!fs.existsSync(srcDir)) return results;
  const root = projectRoot || inferProjectRoot(srcDir);

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        walk(full);
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        parseFileShrink(full, results, root);
      }
    }
  }
  walk(srcDir);
  return results;
}

function parseFileShrink(filePath, results, projectRoot) {
  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); } catch { return; }
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // 匹配 shrink 格式：/** GEMS: name | P0 | FLOW */  或  /** GEMS: name | P0 | FLOW | Story-X.Y */
    const m = trimmed.match(/^\/\*\*\s*GEMS:\s*(\w+)\s*\|\s*(P[0-3])(?:\s*\|\s*([^|*][^*]*))?(?:\s*\|\s*(Story-[\d.]+))?\s*\*\//);
    if (!m) continue;

    const name = m[1];
    const priority = m[2];
    const flow = m[3] ? m[3].trim() : null;
    const storyId = m[4] ? m[4].trim() : null;

    // 收集後續的 AC 行和 STEP 行
    const acIds = [];
    let j = i + 1;
    // 跳過路徑行（// src/...）
    while (j < lines.length && lines[j].trim().startsWith('// src/')) j++;
    // 收集 AC 行
    while (j < lines.length) {
      const t = lines[j].trim();
      const acM = t.match(/^\/\/\s*(AC-[\d.]+)/);
      if (acM) { acIds.push(acM[1]); j++; }
      else break;
    }

    const relFile = projectRoot ? path.relative(projectRoot, filePath) : filePath;
    results.push({
      name,
      file: relFile,
      startLine: i + 1,
      priority,
      flow,
      storyId: storyId || null,
      acIds: acIds.length > 0 ? acIds : undefined,
      status: '✓✓',
      description: '',
      storyId: null,
      deps: [],
      depsRisk: null,
      test: null,
      testFile: null,
      gemsId: null,
      fraudIssues: [],
      shrinkFormat: true,
    });
  }
}

// ── Re-export gems-validator API（向後相容）──

const {
  scanGemsTags,
  validateP0P1Compliance,
  validateTestFiles,
  generateValidationReport,
  findSourceFiles,
  GEMS_PATTERNS,
  extractTags,
  validateTestTypes,
  isFakeIntegrationTest,
  findTestTypeFiles,
} = validator;

// ── v2 專用 API（如果可用）──

const scanV2 = scannerV2 ? scannerV2.scanV2 : null;
const generateFunctionIndexV2 = scannerV2 ? scannerV2.generateFunctionIndexV2 : null;

module.exports = {
  // 統一入口
  scan,
  // Wave 3.3: exposed so blueprint-verify can refresh stale acIds in-place
  enrichWithACIds,

  // v2 API（可能為 null）
  scanV2,
  generateFunctionIndexV2,

  // gems-validator API（向後相容）
  scanGemsTags,
  validateP0P1Compliance,
  validateTestFiles,
  generateValidationReport,
  findSourceFiles,
  GEMS_PATTERNS,
  extractTags,
  validateTestTypes,
  isFakeIntegrationTest,
  findTestTypeFiles,

  // 元資訊
  hasAstScanner: !!scannerV2,
};
