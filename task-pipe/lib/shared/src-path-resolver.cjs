#!/usr/bin/env node
/**
 * Source Path Resolver
 * 統一處理各種專案類型的源碼目錄解析，特別是 GAS 專案
 */
const path = require('path');
const { detectProjectType, getSrcDir } = require('./project-type.cjs');

/**
 * 解析源碼目錄路徑
 * 自動處理 GAS 專案（srcDir='.'）和中文路徑
 * 
 * @param {string} target - 專案根目錄
 * @param {string} projectType - 專案類型（可選，會自動偵測）
 * @returns {string} 絕對路徑的源碼目錄
 */
function resolveSrcPath(target, projectType = null) {
    // 自動偵測專案類型
    if (!projectType) {
        const detected = detectProjectType(target);
        projectType = detected.type;
    }

    // getSrcDir 已經處理了 GAS 專案（srcDir='.'）的情況
    // 並返回絕對路徑
    return getSrcDir(target, projectType);
}

/**
 * 檢查是否為 GAS 專案
 * @param {string} target - 專案根目錄
 * @returns {boolean}
 */
function isGasProject(target) {
    const { type } = detectProjectType(target);
    return type === 'gas';
}

module.exports = {
    resolveSrcPath,
    isGasProject
};
