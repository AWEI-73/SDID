#!/usr/bin/env node
/**
 * 專案類型偵測模組
 * 自動偵測專案類型並提供對應配置
 */
const fs = require('fs');
const path = require('path');

// 預設專案類型配置
const DEFAULT_PROJECT_TYPES = {
  typescript: {
    extensions: ['.ts', '.tsx'],
    srcDir: 'src',
    testDir: '__tests__',
    testCommand: 'npm test',
    defaultLevel: 'M',
    init: 'npm init -y && npm install typescript @types/node ts-node jest ts-jest @types/jest --save-dev && npx tsc --init && npx ts-jest config:init',
    markers: ['tsconfig.json', 'package.json']
  },
  javascript: {
    extensions: ['.js', '.jsx'],
    srcDir: 'src',
    testDir: '__tests__',
    testCommand: 'npm test',
    defaultLevel: 'M',
    init: 'npm init -y && npm pkg set type="module" && npm install jest --save-dev && npm pkg set scripts.test="node --experimental-vm-modules node_modules/jest/bin/jest.js"',
    markers: ['package.json']
  },
  gas: {
    extensions: ['.gs', '.js'],
    srcDir: '.',
    testDir: null,
    testCommand: null,
    defaultLevel: 'S',
    init: null,
    markers: ['appsscript.json', '.clasp.json'],
    note: 'Google Apps Script - 無需初始化，略過測試'
  }
};

/**
 * 偵測專案類型
 * @param {string} target - 專案路徑
 * @param {object} configTypes - config.json 中的 projectTypes
 * @returns {object} { type, config, isGreenfield }
 */
function detectProjectType(target, configTypes = {}) {
  const types = { ...DEFAULT_PROJECT_TYPES, ...configTypes };

  // 0. 優先檢查 GAS 專案（避免被 package.json 誤判為 TS/JS）
  if (fs.existsSync(path.join(target, 'appsscript.json')) ||
    fs.existsSync(path.join(target, '.clasp.json'))) {
    return {
      type: 'gas',
      config: types.gas,
      isGreenfield: !hasSrcFiles(target, types.gas)
    };
  }

  // 1. 檢查 marker 檔案
  for (const [typeName, typeConfig] of Object.entries(types)) {
    if (typeConfig.markers) {
      for (const marker of typeConfig.markers) {
        if (fs.existsSync(path.join(target, marker))) {
          // 特殊處理：有 package.json 但也有 appsscript.json → GAS
          if (typeName === 'javascript' && fs.existsSync(path.join(target, 'appsscript.json'))) {
            continue;
          }
          return {
            type: typeName,
            config: typeConfig,
            isGreenfield: !hasSrcFiles(target, typeConfig)
          };
        }
      }
    }
  }

  // 2. 檢查現有檔案副檔名
  const files = getAllFiles(target);
  for (const [typeName, typeConfig] of Object.entries(types)) {
    for (const ext of typeConfig.extensions) {
      if (files.some(f => f.endsWith(ext))) {
        return {
          type: typeName,
          config: typeConfig,
          isGreenfield: !hasSrcFiles(target, typeConfig)
        };
      }
    }
  }

  // 3. 預設為 typescript（最常見）
  return {
    type: 'typescript',
    config: types.typescript,
    isGreenfield: true
  };
}

/**
 * 檢查是否有源碼檔案
 */
function hasSrcFiles(target, typeConfig) {
  // 檢查多個可能的源碼目錄
  const possibleDirs = [
    typeConfig.srcDir || 'src',
    'js',
    'lib',
    'app',
    '.'  // 根目錄也可能有源碼
  ];

  for (const dir of possibleDirs) {
    const srcDir = path.join(target, dir);
    if (!fs.existsSync(srcDir)) continue;

    const files = getAllFiles(srcDir);
    if (files.some(f => typeConfig.extensions.some(ext => f.endsWith(ext)))) {
      return true;
    }
  }

  return false;
}

/**
 * 遞迴取得所有檔案
 */
function getAllFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        getAllFiles(fullPath, files);
      } else {
        files.push(fullPath);
      }
    }
  } catch {
    // 忽略權限錯誤
  }

  return files;
}

/**
 * 取得綠地專案初始化指引
 */
function getGreenfieldGuide(projectType) {
  const guides = {
    typescript: `
1. 初始化專案 (含測試配置):
   npm init -y
   npm install typescript @types/node ts-node jest ts-jest @types/jest --save-dev
   npx tsc --init
   npx ts-jest config:init

2. 建立目錄結構:
   mkdir -p src/modules src/shared src/config

3. 建立基礎檔案:
   建立 tsconfig.json, jest.config.js 等配置檔`,

    javascript: `
1. 初始化專案 (含測試配置):
   npm init -y
   npm pkg set type="module"
   npm install jest --save-dev
   npm pkg set scripts.test="node --experimental-vm-modules node_modules/jest/bin/jest.js"

2. 建立目錄結構:
   mkdir -p src/modules src/shared src/config`,

    gas: `
1. Google Apps Script 專案無需本地初始化
2. 直接在根目錄建立 .gs 或 .js 檔案
3. 使用 clasp 同步: npm install -g @google/clasp`
  };


  return guides[projectType] || guides.typescript;
}

/**
 * 取得源碼目錄路徑（自動偵測，單一路徑，向後相容）
 */
function getSrcDir(target, projectType, configTypes = {}) {
  const dirs = getSrcDirs(target);
  return dirs[0] || path.join(target, 'src');
}

/**
 * 取得所有源碼目錄路徑（支援多根目錄）
 * 優先讀 blueprint.md 的 **源碼路徑** 欄位，fallback 到 auto-glob
 * @param {string} target - 專案根目錄（絕對路徑）
 * @returns {string[]} 絕對路徑陣列（只含存在的目錄）
 */
function getSrcDirs(target) {
  // 1. 讀 blueprint.md 的 **源碼路徑** 欄位（長期方案：SST）
  const blueprintPath = path.join(target, '.gems', 'design', 'blueprint.md');
  if (fs.existsSync(blueprintPath)) {
    try {
      const content = fs.readFileSync(blueprintPath, 'utf8');
      const match = content.match(/\*\*源碼路徑\*\*:\s*(.+)/);
      if (match) {
        const backtickPaths = match[1].match(/`([^`]+)`/g);
        if (backtickPaths && backtickPaths.length > 0) {
          const resolved = backtickPaths
            .map(p => p.replace(/`/g, '').trim())
            .map(p => path.join(target, p))
            .filter(p => fs.existsSync(p));
          if (resolved.length > 0) return resolved;
        }
      }
    } catch { /* 讀取失敗 fallback */ }
  }

  // 2. Auto-glob：找深度 1 子目錄下的 src/（短期 fallback）
  const IGNORE = new Set(['node_modules', '.gems', '.git', '.claude', 'dist', 'build', 'coverage']);
  const candidates = [];

  // 先檢查 root/src
  const rootSrc = path.join(target, 'src');
  if (fs.existsSync(rootSrc)) candidates.push(rootSrc);

  // 再檢查子目錄下的 src/
  try {
    const entries = fs.readdirSync(target, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || IGNORE.has(entry.name)) continue;
      const subSrc = path.join(target, entry.name, 'src');
      if (fs.existsSync(subSrc)) candidates.push(subSrc);
    }
  } catch { /* readdirSync 失敗 fallback */ }

  return candidates.length > 0 ? candidates : [path.join(target, 'src')];
}

module.exports = {
  detectProjectType,
  hasSrcFiles,
  getGreenfieldGuide,
  getSrcDir,
  getSrcDirs,
  DEFAULT_PROJECT_TYPES
};
