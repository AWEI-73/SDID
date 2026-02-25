#!/usr/bin/env node
/**
 * Level Gate 模組 v2.0
 * 根據專案等級 (S/M/L) 決定要執行哪些 BUILD phases
 * 
 * v2.0: 從 phase-registry.json 讀取 (單一真相來源)
 */
const fs = require('fs');
const path = require('path');

// 嘗試載入 phase-registry-loader
let registryLoader = null;
try {
  registryLoader = require('./phase-registry-loader.cjs');
} catch (e) {
  // 如果載入失敗，使用 fallback
}

// 預設配置 (Fallback)
// BUILD 順序: 1(寫程式) → 2(標籤驗證) → 3(寫測試) → 4(測試檔驗證) → 5(執行測試) → 6/7/8
const DEFAULT_LEVELS = {
  S: {
    description: '小專案，只檢查核心',
    phases: ['1', '2', '7', '8'],  // 已與 config.json 同步
    testRequired: false,
    tagsRequired: ['GEMS']
  },
  M: {
    description: '中專案，加測試',
    phases: ['1', '2', '3', '4', '5', '7', '8'],
    testRequired: true,
    tagsRequired: ['GEMS', 'GEMS-TEST', 'GEMS-TEST-FILE']
  },
  L: {
    description: '大專案，完整檢查',
    phases: ['1', '2', '3', '4', '5', '6', '7', '8'],
    testRequired: true,
    tagsRequired: ['GEMS', 'GEMS-FLOW', 'GEMS-DEPS', 'GEMS-DEPS-RISK', 'GEMS-TEST', 'GEMS-TEST-FILE']
  }
};

/**
 * 載入 level 配置
 * 優先順序: config.json > phase-registry.json > DEFAULT_LEVELS
 */
function loadLevelConfig(configPath) {
  // 1. 嘗試從 config.json 載入
  if (configPath && fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.levels) {
        const levels = {};
        for (const [key, value] of Object.entries(config.levels)) {
          levels[key] = {
            ...value,
            phases: value.build?.phases?.map(String) || DEFAULT_LEVELS[key]?.phases || []
          };
        }
        return levels;
      }
    } catch {
      // 忽略錯誤，繼續嘗試其他來源
    }
  }

  // 2. 嘗試從 phase-registry 載入
  if (registryLoader) {
    try {
      const registry = registryLoader.loadRegistry();
      if (registry.levelPhases) {
        const levels = {};
        for (const [key, phases] of Object.entries(registry.levelPhases)) {
          levels[key] = {
            description: DEFAULT_LEVELS[key]?.description || `Level ${key}`,
            phases: phases,
            testRequired: key !== 'S',
            tagsRequired: DEFAULT_LEVELS[key]?.tagsRequired || ['GEMS']
          };
        }
        return levels;
      }
    } catch {
      // 忽略錯誤，使用 fallback
    }
  }

  // 3. 使用預設值
  return DEFAULT_LEVELS;
}

/**
 * 檢查指定 phase 是否需要執行
 * @param {string} level - S/M/L
 * @param {string} phase - phase ID
 * @param {string} configPath - config.json 路徑
 */
function shouldExecutePhase(level, phase, configPath) {
  const levels = loadLevelConfig(configPath);
  const levelConfig = levels[level.toUpperCase()];

  if (!levelConfig) {
    console.warn(`未知的 level: ${level}，使用 M`);
    return levels.M.phases.includes(phase);
  }

  return levelConfig.phases.includes(phase);
}

/**
 * 取得指定 level 的所有 phases
 */
function getPhasesForLevel(level, configPath) {
  const levels = loadLevelConfig(configPath);
  const levelConfig = levels[level.toUpperCase()] || levels.M;
  return levelConfig.phases;
}

/**
 * 取得下一個需要執行的 phase
 */
function getNextPhase(level, currentPhase, configPath) {
  const phases = getPhasesForLevel(level, configPath);
  const currentIndex = phases.indexOf(currentPhase);

  if (currentIndex === -1 || currentIndex >= phases.length - 1) {
    return null;
  }

  return phases[currentIndex + 1];
}

/**
 * 檢查是否為最後一個 phase
 */
function isLastPhase(level, phase, configPath) {
  const phases = getPhasesForLevel(level, configPath);
  return phases[phases.length - 1] === phase;
}

/**
 * 取得 level 說明
 */
function getLevelDescription(level, configPath) {
  const levels = loadLevelConfig(configPath);
  const levelConfig = levels[level.toUpperCase()];

  if (!levelConfig) return '未知等級';

  return `${levelConfig.description || level} (Phases: ${levelConfig.phases.join(' → ')})`;
}

/**
 * 顯示 level 摘要
 */
function printLevelSummary(level, configPath) {
  const levels = loadLevelConfig(configPath);

  console.log('\n[INFO] 專案等級配置:');
  console.log('─'.repeat(50));

  for (const [key, config] of Object.entries(levels)) {
    const marker = key === level.toUpperCase() ? '→' : ' ';
    console.log(`${marker} [${key}] ${config.description || ''}`);
    console.log(`     Phases: ${config.phases.join(' → ')}`);
  }

  console.log('─'.repeat(50));
}

module.exports = {
  loadLevelConfig,
  shouldExecutePhase,
  getPhasesForLevel,
  getNextPhase,
  isLastPhase,
  getLevelDescription,
  printLevelSummary,
  DEFAULT_LEVELS
};
