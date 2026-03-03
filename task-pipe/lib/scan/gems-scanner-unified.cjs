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

  // AST 模式（v2）
  if ((mode === 'ast' || mode === 'auto') && scannerV2) {
    try {
      const root = projectRoot || inferProjectRoot(srcDir);
      const v2Result = scannerV2.scanV2(srcDir, root);
      if (v2Result && (v2Result.functions?.length > 0 || v2Result.tagged?.length > 0)) {
        return normalizeV2Result(v2Result);
      }
    } catch (e) {
      if (mode === 'ast') {
        throw new Error(`AST scanner 失敗: ${e.message}`);
      }
      // auto mode: fallback to regex
    }
  }

  // Regex fallback
  const regexResult = validator.scanGemsTags(srcDir);
  return {
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
