#!/usr/bin/env node
/**
 * 統一的腳本輸出標頭
 * 用於在所有腳本輸出前加入禁止搜尋的警告
 */

/**
 * 產生標準輸出標頭（包含禁止搜尋警告）
 * @param {string} phase - 階段名稱（POC, PLAN, BUILD）
 * @param {string} step - 步驟名稱（0, 1, 2, 3 或 phase-1, phase-2 等）
 * @returns {string} 標頭文字
 */
function getOutputHeader(phase, step) {
  return `
[!] ${phase} ${step} - 禁止搜尋檔案 - 只讀此輸出
================================================================
`;
}

/**
 * 產生簡化版標頭（BUILD 階段使用）
 * @param {string} phase - 階段名稱
 * @param {string} step - 步驟名稱
 * @returns {string} 標頭文字
 */
function getSimpleHeader(phase, step) {
  return `[!] ${phase} ${step} - 禁止搜尋 - 只讀此輸出\n`;
}

module.exports = {
  getOutputHeader,
  getSimpleHeader
};
