#!/usr/bin/env node
// -*- coding: utf-8 -*-

/**
 * Project Memory v1.0
 * 
 * 靈感來源: OpenClaw 的 file-first memory 設計
 * 但針對 SDID 的結構化流程做了簡化：
 *   - 不需要 vector search / embedding（我們的記憶是確定性的）
 *   - 不需要 AI 自己決定記什麼（腳本自動產出）
 *   - 純 JSON append，人類可讀，AI 可解析
 * 
 * 存放位置: {project}/.gems/project-memory.json
 * 
 * 用途:
 *   1. 新對話開始時，快速恢復 context（「做到哪了」）
 *   2. 跨 Story 的錯誤模式識別（「上次也在 Phase 2 卡住」）
 *   3. 斷點續傳的依據
 */

const fs = require('fs');
const path = require('path');

// ============================================
// Constants
// ============================================
const MEMORY_FILE = 'project-memory.json';
const MAX_ENTRIES = 200;        // 最多保留 200 筆（超過自動裁剪舊的）
const RESUME_DISPLAY = 5;      // 啟動時顯示最近 N 筆
const CHARS_PER_TOKEN = 4;     // 粗估: 英文 ~4 chars/token, 中文 ~2 chars/token, 取保守值

// ============================================
// Core: Read / Write
// ============================================

/**
 * 取得 memory 檔案路徑
 */
function getMemoryPath(projectRoot) {
  return path.join(projectRoot, '.gems', MEMORY_FILE);
}

/**
 * 讀取 project memory
 * @returns {{ version: string, project: string, entries: Array, summary: object }}
 */
function loadMemory(projectRoot) {
  const memPath = getMemoryPath(projectRoot);
  if (!fs.existsSync(memPath)) {
    return createEmptyMemory(projectRoot);
  }
  try {
    const raw = fs.readFileSync(memPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    // 損壞就重建
    return createEmptyMemory(projectRoot);
  }
}

/**
 * 建立空的 memory 結構
 */
function createEmptyMemory(projectRoot) {
  const projectName = path.basename(path.resolve(projectRoot));
  return {
    version: '1.0',
    project: projectName,
    createdAt: new Date().toISOString(),
    entries: [],
    summary: {
      lastPhase: null,
      lastStep: null,
      lastStory: null,
      lastVerdict: null,
      totalPasses: 0,
      totalErrors: 0,
      currentIteration: null,
      knownPitfalls: []    // 自動收集的「坑」
    }
  };
}

/**
 * 儲存 memory（含自動裁剪）
 */
function saveMemory(projectRoot, memory) {
  const memPath = getMemoryPath(projectRoot);
  const dir = path.dirname(memPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 裁剪：保留最新 MAX_ENTRIES 筆
  if (memory.entries.length > MAX_ENTRIES) {
    memory.entries = memory.entries.slice(-MAX_ENTRIES);
  }

  fs.writeFileSync(memPath, JSON.stringify(memory, null, 2), 'utf8');
}

// ============================================
// Core: Record Entry
// ============================================

/**
 * 記錄一筆執行結果
 * 
 * @param {string} projectRoot - 專案根目錄
 * @param {object} opts
 * @param {string} opts.phase - POC/PLAN/BUILD/SCAN
 * @param {string} opts.step - step/phase 編號
 * @param {string} opts.story - Story ID (可選)
 * @param {string} opts.iteration - iter-X
 * @param {string} opts.verdict - PASS/ERROR/BLOCKER/PENDING
 * @param {string} opts.signal - @PASS/@FIX/@BLOCK 等
 * @param {string} opts.summary - 一句話摘要
 * @param {string} [opts.target] - 目標檔案 (錯誤時)
 * @param {string[]} [opts.missing] - 缺失項目 (錯誤時)
 * @param {string} [opts.logPath] - log 檔案路徑
 */
function recordEntry(projectRoot, opts) {
  const memory = loadMemory(projectRoot);

  const entry = {
    timestamp: new Date().toISOString(),
    iteration: opts.iteration || null,
    phase: opts.phase,
    step: opts.step,
    story: opts.story || null,
    verdict: opts.verdict,
    signal: opts.signal || null,
    summary: opts.summary || '',
  };

  // Token 估算 (Level 1: 基於 log 檔案大小 + 終端輸出)
  if (opts.estimatedTokens) {
    entry.tokens = opts.estimatedTokens;
  }

  // 錯誤時記錄更多細節
  if (opts.verdict !== 'PASS') {
    if (opts.target) entry.target = opts.target;
    if (opts.missing && opts.missing.length > 0) entry.missing = opts.missing;
    if (opts.logPath) entry.logPath = opts.logPath;
  }

  memory.entries.push(entry);

  // 更新 summary
  memory.summary.lastPhase = opts.phase;
  memory.summary.lastStep = opts.step;
  memory.summary.lastStory = opts.story || memory.summary.lastStory;
  memory.summary.lastVerdict = opts.verdict;
  memory.summary.currentIteration = opts.iteration || memory.summary.currentIteration;

  if (opts.verdict === 'PASS') {
    memory.summary.totalPasses++;
  } else {
    memory.summary.totalErrors++;
  }

  // 自動收集 pitfall（同一個 phase+step 失敗 2+ 次）
  if (opts.verdict !== 'PASS' && opts.missing && opts.missing.length > 0) {
    const pitfallKey = `${opts.phase}-${opts.step}`;
    const recentSameErrors = memory.entries
      .filter(e => `${e.phase}-${e.step}` === pitfallKey && e.verdict !== 'PASS')
      .length;

    if (recentSameErrors >= 2) {
      const pitfall = `${pitfallKey}: ${opts.missing.join(', ')}`;
      if (!memory.summary.knownPitfalls.includes(pitfall)) {
        memory.summary.knownPitfalls.push(pitfall);
        // 最多保留 10 個 pitfall
        if (memory.summary.knownPitfalls.length > 10) {
          memory.summary.knownPitfalls.shift();
        }
      }
    }
  }

  saveMemory(projectRoot, memory);
  return entry;
}

// ============================================
// Core: Resume Context
// ============================================

/**
 * 產出 context resume 文字（給終端顯示）
 * 
 * @param {string} projectRoot
 * @param {number} [count=RESUME_DISPLAY] - 顯示幾筆
 * @returns {string|null} - 格式化的 resume 文字，或 null（無記憶）
 */
function getResumeContext(projectRoot, count) {
  const memory = loadMemory(projectRoot);
  if (memory.entries.length === 0) return null;

  const n = count || RESUME_DISPLAY;
  const recent = memory.entries.slice(-n);
  const s = memory.summary;

  const lines = [];
  lines.push(`@MEMORY | ${memory.project} | ${s.currentIteration || '?'} | ${s.totalPasses}P/${s.totalErrors}E`);

  // Token 統計 (如果有資料)
  const tokenStats = getTokenStats(projectRoot);
  if (tokenStats.total > 0) {
    const totalK = (tokenStats.total / 1000).toFixed(1);
    lines.push(`  @TOKENS: ~${totalK}K est. input | avg ${tokenStats.avgPerStep}/step | ${tokenStats.count} steps tracked`);
  }

  // 最近記錄
  for (const e of recent) {
    const verdict = e.verdict === 'PASS' ? '✓' : '✗';
    const storyTag = e.story ? ` ${e.story}` : '';
    const short = e.summary.length > 50 ? e.summary.substring(0, 47) + '...' : e.summary;
    lines.push(`  ${verdict} ${e.phase} ${e.step}${storyTag} | ${short}`);
  }

  // Pitfalls
  if (s.knownPitfalls.length > 0) {
    lines.push(`  @PITFALL: ${s.knownPitfalls[s.knownPitfalls.length - 1]}`);
  }

  // 下一步提示
  lines.push(`  LAST: ${s.lastPhase} ${s.lastStep} → ${s.lastVerdict}`);

  return lines.join('\n');
}

/**
 * 取得結構化的 resume 資料（給 AI 解析）
 */
function getResumeData(projectRoot) {
  const memory = loadMemory(projectRoot);
  if (memory.entries.length === 0) return null;

  return {
    project: memory.project,
    summary: memory.summary,
    recentEntries: memory.entries.slice(-RESUME_DISPLAY),
    totalEntries: memory.entries.length
  };
}

/**
 * 查詢特定 phase/step 的歷史錯誤（給 @HINT 用）
 * 
 * @param {string} projectRoot
 * @param {string} phase
 * @param {string} step
 * @param {string} [excludeStory] - 排除當前 Story
 * @returns {{ count: number, lastMissing: string[]|null, hint: string|null }}
 */
function getHistoricalHint(projectRoot, phase, step, excludeStory) {
  const memory = loadMemory(projectRoot);
  const key = `${phase}-${step}`;

  const pastErrors = memory.entries.filter(e =>
    `${e.phase}-${e.step}` === key &&
    e.verdict !== 'PASS' &&
    (!excludeStory || e.story !== excludeStory)
  );

  if (pastErrors.length === 0) {
    return { count: 0, lastMissing: null, hint: null };
  }

  const last = pastErrors[pastErrors.length - 1];
  const missing = last.missing || null;

  let hint = null;
  if (missing && missing.length > 0) {
    hint = `前一個 Story 在此步驟曾因「${missing.join(', ')}」失敗`;
  } else {
    hint = `前一個 Story 在此步驟曾失敗 ${pastErrors.length} 次`;
  }

  return { count: pastErrors.length, lastMissing: missing, hint };
}

// ============================================
// Token Estimation (Level 1)
// ============================================

/**
 * 估算一次 phase 執行的 token 消耗
 * 
 * 計算邏輯:
 *   scriptOutput (終端印出) → AI 讀取 = input tokens
 *   logFile (AI 透過 @READ 讀取) → input tokens
 *   AI 修復程式碼 → output tokens (無法從腳本端估算，記 0)
 * 
 * 這只估「腳本端可觀測的 input token」，不含 AI 的 output。
 * 但因為 SDID 的設計是「腳本輸出驅動 AI 行為」，input 是主要消耗。
 * 
 * @param {object} opts
 * @param {number} [opts.terminalChars] - 終端輸出字元數
 * @param {string} [opts.logPath] - log 檔案路徑 (絕對或相對)
 * @param {string} [opts.projectRoot] - 專案根目錄 (用於解析相對路徑)
 * @returns {number} 估算 token 數
 */
function estimateTokens(opts = {}) {
  let totalChars = 0;

  // 終端輸出
  if (opts.terminalChars) {
    totalChars += opts.terminalChars;
  }

  // Log 檔案大小
  if (opts.logPath) {
    try {
      const logFullPath = opts.projectRoot
        ? path.resolve(opts.projectRoot, opts.logPath)
        : opts.logPath;
      if (fs.existsSync(logFullPath)) {
        const stat = fs.statSync(logFullPath);
        totalChars += stat.size;
      }
    } catch (e) { /* 忽略 */ }
  }

  return Math.ceil(totalChars / CHARS_PER_TOKEN);
}

/**
 * 取得 token 消耗統計
 * 
 * @param {string} projectRoot
 * @returns {{ total: number, byPhase: object, byVerdict: object, avgPerStep: number }}
 */
function getTokenStats(projectRoot) {
  const memory = loadMemory(projectRoot);
  const stats = { total: 0, byPhase: {}, byVerdict: {}, count: 0 };

  for (const e of memory.entries) {
    const t = e.tokens || 0;
    stats.total += t;
    if (t > 0) stats.count++;

    // by phase
    const phaseKey = e.phase || 'UNKNOWN';
    stats.byPhase[phaseKey] = (stats.byPhase[phaseKey] || 0) + t;

    // by verdict
    const vKey = e.verdict || 'UNKNOWN';
    stats.byVerdict[vKey] = (stats.byVerdict[vKey] || 0) + t;
  }

  stats.avgPerStep = stats.count > 0 ? Math.round(stats.total / stats.count) : 0;
  return stats;
}

// ============================================
// Exports
// ============================================
module.exports = {
  loadMemory,
  saveMemory,
  recordEntry,
  getResumeContext,
  getResumeData,
  getHistoricalHint,
  estimateTokens,
  getTokenStats,
  getMemoryPath,
  MEMORY_FILE,
  MAX_ENTRIES,
  RESUME_DISPLAY,
  CHARS_PER_TOKEN
};
