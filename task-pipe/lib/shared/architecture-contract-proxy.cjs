'use strict';
/**
 * Architecture Contract Proxy
 * Thin proxy → sdid-core/architecture-contract.cjs
 * 讓 task-pipe/phases/ 下的腳本可以用相對路徑引用 Contract，
 * 而不需要知道 sdid-core/ 的絕對位置。
 */
const path = require('path');
const contractPath = path.resolve(__dirname, '../../../sdid-core/architecture-contract.cjs');
module.exports = require(contractPath);
