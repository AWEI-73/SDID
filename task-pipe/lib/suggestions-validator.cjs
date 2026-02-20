#!/usr/bin/env node
/**
 * Suggestions 驗證模組
 * 驗證 iteration_suggestions JSON 的必填欄位
 */
const fs = require('fs');

// 必填欄位定義
const REQUIRED_FIELDS = {
  root: ['storyId', 'status'],
  status: ['Completed', 'Partial', 'Blocked', 'InProgress']
};

// 建議欄位（有則驗證格式）
const OPTIONAL_FIELDS = {
  iteration: 'string',
  moduleId: 'string',
  completedItems: 'array',
  suggestions: 'array',
  technicalDebt: 'array',
  summary: 'object'
};

/**
 * 驗證 suggestions JSON
 * @param {object|string} input - JSON 物件或檔案路徑
 * @returns {object} { valid, errors, warnings }
 */
function validate(input) {
  let json;
  
  // 讀取 JSON
  if (typeof input === 'string') {
    if (!fs.existsSync(input)) {
      return { valid: false, errors: [`檔案不存在: ${input}`], warnings: [] };
    }
    try {
      json = JSON.parse(fs.readFileSync(input, 'utf8'));
    } catch (e) {
      return { valid: false, errors: [`JSON 解析失敗: ${e.message}`], warnings: [] };
    }
  } else {
    json = input;
  }
  
  const errors = [];
  const warnings = [];
  
  // 檢查必填欄位
  for (const field of REQUIRED_FIELDS.root) {
    if (!json[field]) {
      errors.push(`缺少必填欄位: ${field}`);
    }
  }
  
  // 檢查 status 值
  if (json.status && !REQUIRED_FIELDS.status.includes(json.status)) {
    errors.push(`status 值無效: ${json.status}，應為 ${REQUIRED_FIELDS.status.join('/')}`);
  }
  
  // 檢查選填欄位格式
  for (const [field, type] of Object.entries(OPTIONAL_FIELDS)) {
    if (json[field] !== undefined) {
      if (type === 'array' && !Array.isArray(json[field])) {
        warnings.push(`${field} 應為陣列`);
      } else if (type === 'object' && typeof json[field] !== 'object') {
        warnings.push(`${field} 應為物件`);
      } else if (type === 'string' && typeof json[field] !== 'string') {
        warnings.push(`${field} 應為字串`);
      }
    }
  }
  
  // 檢查 completedItems 內容
  if (Array.isArray(json.completedItems) && json.completedItems.length === 0 && json.status === 'Completed') {
    warnings.push(`status 為 Completed 但 completedItems 為空`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 產生 suggestions 骨架
 */
function generateSkeleton(storyId, iteration = 'iter-1') {
  return {
    storyId,
    iteration,
    status: 'Completed',
    completedItems: [],
    suggestions: [],
    technicalDebt: [],
    summary: {
      totalItems: 0,
      completedItems: 0
    }
  };
}

module.exports = { validate, generateSkeleton, REQUIRED_FIELDS };
