#!/usr/bin/env node
/**
 * consolidation-parser.cjs v1.0
 * 解析 poc-consolidation-log.md 的映射表
 *
 * 輸入: poc-consolidation-log.md 路徑
 * 輸出: { changed: string[], mappings: Mapping[], cleanedFiles: string[] }
 *
 * Mapping = { pocSource, functions, targetFile, gemsId }
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * 解析 poc-consolidation-log.md
 * @param {string} filePath - consolidation-log 的絕對或相對路徑
 * @returns {{ changed: string[], mappings: Array<{pocSource:string, functions:string, targetFile:string, gemsId:string}>, cleanedFiles: string[], iter: string, date: string }}
 */
function parseConsolidationLog(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const result = {
    iter: '',
    date: '',
    changed: [],
    mappings: [],
    cleanedFiles: [],
  };

  // 1. 解析 header: > iter: X | date: YYYY-MM-DD
  const headerMatch = content.match(/>\s*iter:\s*(\d+)\s*\|\s*date:\s*([\d-]+)/);
  if (headerMatch) {
    result.iter = headerMatch[1];
    result.date = headerMatch[2];
  }

  // 2. 解析 changed: 行
  const changedMatch = content.match(/^changed:\s*(.+)$/m);
  if (changedMatch) {
    result.changed = changedMatch[1].split(',').map(f => f.trim()).filter(Boolean);
  }

  // 3. 解析映射表（Markdown table）
  //    格式: | POC 原型 | 函式 | 目標正式檔案 | gemsId? |
  let inTable = false;
  let headerParsed = false;
  let hasGemsId = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // 偵測表頭
    if (!inTable && trimmed.startsWith('|') && /POC\s*原型/.test(trimmed)) {
      inTable = true;
      hasGemsId = /gemsId/i.test(trimmed);
      continue;
    }

    // 跳過分隔線 |---|---|---|
    if (inTable && !headerParsed && /^\|[\s-|]+\|$/.test(trimmed)) {
      headerParsed = true;
      continue;
    }

    // 解析資料行
    if (inTable && headerParsed && trimmed.startsWith('|')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 3) {
        result.mappings.push({
          pocSource: cells[0],
          functions: cells[1],
          targetFile: cells[2],
          gemsId: hasGemsId && cells[3] ? cells[3] : '',
        });
      }
      continue;
    }

    // 表結束
    if (inTable && headerParsed && !trimmed.startsWith('|') && trimmed !== '') {
      inTable = false;
      headerParsed = false;
    }
  }

  // 4. 解析清除的暫存檔
  let inCleaned = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s*清除的暫存檔/.test(trimmed)) {
      inCleaned = true;
      continue;
    }
    if (inCleaned && trimmed.startsWith('- ')) {
      result.cleanedFiles.push(trimmed.replace(/^-\s*/, ''));
      continue;
    }
    if (inCleaned && trimmed.startsWith('##')) {
      inCleaned = false;
    }
  }

  return result;
}

module.exports = { parseConsolidationLog };

// CLI 模式
if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('用法: node sdid-tools/lib/consolidation-parser.cjs <poc-consolidation-log.md>');
    process.exit(1);
  }
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`ERROR: 找不到 ${resolved}`);
    process.exit(1);
  }
  const result = parseConsolidationLog(resolved);
  console.log(JSON.stringify(result, null, 2));
}
