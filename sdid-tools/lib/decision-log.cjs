'use strict';
/**
 * Decision Log v1.0
 * 將 gate 執行結果寫入 {target}/.gems/decision-log.jsonl
 *
 * 機械寫入：gate 負責 ts / gate / status / errors
 * 語意補充：AI 負責 why / resolution（見 [LOG-REQUIRED] 提示）
 */
const fs = require('fs');
const path = require('path');

/**
 * @param {string} target   - 專案根目錄（來自 gate 的 --target 參數）
 * @param {object} opts
 *   gate     {string}   - gate 名稱（e.g. 'contract-gate'）
 *   status   {string}   - 'PASS' | 'BLOCKER'
 *   iter     {number|string|null}
 *   story    {string|null}
 *   errors   {string[]} - blocker error codes
 *   context  {string|null} - 額外上下文（可選）
 * @returns {string|null} log 檔相對路徑（供 console 輸出用）
 */
function writeDecisionLog(target, { gate, status, iter = null, story = null, errors = [], context = null }) {
  if (!target) return null;

  try {
    const gemsDir = path.join(target, '.gems');
    if (!fs.existsSync(gemsDir)) fs.mkdirSync(gemsDir, { recursive: true });

    const logPath = path.join(gemsDir, 'decision-log.jsonl');
    const entry = {
      ts: new Date().toISOString(),
      gate,
      status,
      iter: iter !== undefined ? iter : null,
      story: story || null,
      errors: errors || [],
      context: context || null,
      why: null,        // AI 補：為什麼這樣改 / 做了什麼決定
      resolution: null  // AI 補：BLOCKER 時怎麼解的
    };

    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf8');
    return path.relative(process.cwd(), logPath);
  } catch (e) {
    // silent — 不讓 log 失敗影響 gate 主流程
    return null;
  }
}

module.exports = { writeDecisionLog };
