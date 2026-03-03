/**
 * @deprecated 請使用 task-pipe/lib/scan/gems-scanner-unified.cjs
 * 此檔案僅保留向後相容，不再維護。
 * 
 * gems-scanner-v2-proxy.cjs
 * 
 * Thin proxy to sdid-tools/gems-scanner-v2.cjs (AST-based scanner)
 * 讓 task-pipe 內部統一引用，不需要跨目錄 resolve 路徑。
 * 
 * 用法：
 *   const { scanV2, generateFunctionIndexV2 } = require('./gems-scanner-v2-proxy.cjs');
 */
'use strict';

const path = require('path');
const fs = require('fs');

const SCANNER_V2_PATH = path.resolve(__dirname, '..', '..', '..', 'sdid-tools', 'gems-scanner-v2.cjs');

if (!fs.existsSync(SCANNER_V2_PATH)) {
  console.error(`[gems-scanner-v2-proxy] 找不到 ${SCANNER_V2_PATH}`);
  module.exports = {};
} else {
  module.exports = require(SCANNER_V2_PATH);
}
