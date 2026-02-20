#!/usr/bin/env node
/**
 * Tech Stack Analyzer v1.0
 * 
 * 從 POC/PLAN 產物提取技術棧 metadata，供 BUILD 階段使用。
 * 
 * 資料來源（優先順序）：
 * 1. requirement_spec — 技術棧、Level、範疇聲明
 * 2. requirement_draft — 模組設計藍圖、路由結構、「不做什麼」
 * 3. Contract (.ts) — @GEMS-CONTRACT、@GEMS-TABLE、@GEMS-FUNCTION
 * 4. implementation_plan — 檔案清單、模組資訊
 * 5. package.json — 實際依賴（fallback）
 * 
 * 輸出 TechStackProfile:
 * {
 *   language: 'typescript' | 'javascript' | 'python' | 'gas',
 *   level: 'S' | 'M' | 'L',
 *   projectType: 'backend' | 'frontend' | 'fullstack',
 *   hasUI: boolean,
 *   hasAPI: boolean,
 *   hasDatabase: boolean,
 *   hasFrontendFramework: boolean,
 *   frontendFramework: string | null,  // 'react' | 'vue' | 'svelte' | null
 *   hasRouting: boolean,
 *   hasBundler: boolean,
 *   storage: 'memory' | 'sqlite' | 'postgres' | 'mysql' | 'mongodb' | 'unknown',
 *   modules: string[],
 *   entities: string[],
 *   functionCount: number,
 *   source: string,  // 哪個檔案提供了主要資訊
 * }
 */

const fs = require('fs');
const path = require('path');

/**
 * 分析專案技術棧
 * @param {string} projectRoot - 專案根目錄
 * @param {string} iteration - 迭代名稱 (e.g. 'iter-1')
 * @returns {object} TechStackProfile
 */
function analyzeTechStack(projectRoot, iteration = 'iter-1') {
  const profile = {
    language: 'unknown',
    level: 'M',
    projectType: 'unknown',
    hasUI: false,
    hasAPI: false,
    hasDatabase: false,
    hasFrontendFramework: false,
    frontendFramework: null,
    hasRouting: false,
    hasBundler: false,
    storage: 'unknown',
    modules: [],
    entities: [],
    functionCount: 0,
    source: 'none',
    confidence: 0,  // 0-100, 資訊完整度
  };

  const iterPath = path.join(projectRoot, '.gems', 'iterations', iteration);
  const pocPath = path.join(iterPath, 'poc');
  const planPath = path.join(iterPath, 'plan');

  // 1. 從 requirement_spec 提取
  const specResult = analyzeRequirementSpec(pocPath);
  if (specResult) {
    Object.assign(profile, specResult);
    profile.confidence += 40;
  }

  // 2. 從 requirement_draft 提取
  const draftResult = analyzeRequirementDraft(pocPath);
  if (draftResult) {
    mergeProfile(profile, draftResult);
    profile.confidence += 20;
  }

  // 3. 從 Contract 提取
  const contractResult = analyzeContract(pocPath);
  if (contractResult) {
    mergeProfile(profile, contractResult);
    profile.confidence += 20;
  }

  // 4. 從 implementation_plan 提取
  const planResult = analyzeImplementationPlans(planPath);
  if (planResult) {
    mergeProfile(profile, planResult);
    profile.confidence += 10;
  }

  // 5. Fallback: 從 package.json 推斷
  if (profile.confidence < 50) {
    const pkgResult = analyzePackageJson(projectRoot);
    if (pkgResult) {
      mergeProfile(profile, pkgResult);
      profile.confidence += 10;
    }
  }

  // 推導 projectType
  if (profile.projectType === 'unknown') {
    profile.projectType = deriveProjectType(profile);
  }

  profile.confidence = Math.min(100, profile.confidence);
  return profile;
}

/**
 * 從 requirement_spec 提取技術棧
 */
function analyzeRequirementSpec(pocPath) {
  if (!fs.existsSync(pocPath)) return null;
  const files = fs.readdirSync(pocPath).filter(f => f.startsWith('requirement_spec_'));
  if (files.length === 0) return null;

  const content = fs.readFileSync(path.join(pocPath, files[0]), 'utf8');
  const result = { source: files[0] };

  // Level
  const levelMatch = content.match(/\*\*Level\*\*:\s*(S|M|L)/i);
  if (levelMatch) result.level = levelMatch[1].toUpperCase();

  // 技術棧
  const techMatch = content.match(/技術棧[:\s：]*([^\n]+)/i);
  if (techMatch) {
    const tech = techMatch[1].toLowerCase();
    if (tech.includes('typescript')) result.language = 'typescript';
    else if (tech.includes('javascript')) result.language = 'javascript';
    else if (tech.includes('python')) result.language = 'python';

    if (tech.includes('in-memory') || tech.includes('memory')) result.storage = 'memory';
    else if (tech.includes('sqlite')) result.storage = 'sqlite';
    else if (tech.includes('postgres')) result.storage = 'postgres';
    else if (tech.includes('mongodb') || tech.includes('mongo')) result.storage = 'mongodb';
  }

  // 範疇聲明 — 「不包含」
  const excludeMatch = content.match(/❌\s*不包含[:\s：]*([^\n]+(?:\n[-*]\s*[^\n]+)*)/i);
  if (excludeMatch) {
    const excludes = excludeMatch[1].toLowerCase();
    if (excludes.includes('前端') || excludes.includes('ui') || excludes.includes('frontend')) {
      result.hasUI = false;
    }
    if (excludes.includes('資料庫') || excludes.includes('database') || excludes.includes('db')) {
      result.hasDatabase = false;
    }
  }

  // 範疇聲明 — 「包含」
  const includeMatch = content.match(/✅\s*包含[:\s：]*([^\n]+(?:\n[-*]\s*[^\n]+)*)/i);
  if (includeMatch) {
    const includes = includeMatch[1].toLowerCase();
    if (includes.includes('api') || includes.includes('rest') || includes.includes('graphql')) {
      result.hasAPI = true;
    }
    if (includes.includes('ui') || includes.includes('前端') || includes.includes('frontend')) {
      result.hasUI = true;
    }
  }

  // 「純後端」關鍵字
  if (content.match(/純後端|backend.only|no.?ui|不需要.?ui/i)) {
    result.hasUI = false;
    result.projectType = 'backend';
  }

  // 「全端」關鍵字
  if (content.match(/全端|fullstack|full.?stack|前後端/i)) {
    result.hasUI = true;
    result.hasAPI = true;
    result.projectType = 'fullstack';
  }

  // Story 數量
  const storyMatches = content.match(/### Story \d+\.\d+/g);
  if (storyMatches) result.storyCount = storyMatches.length;

  // 可行性評估
  const riskMatch = content.match(/風險[:\s：]*(低|中|高|low|medium|high)/i);
  if (riskMatch) result.risk = riskMatch[1];

  return result;
}

/**
 * 從 requirement_draft 提取技術棧
 */
function analyzeRequirementDraft(pocPath) {
  if (!fs.existsSync(pocPath)) return null;
  const files = fs.readdirSync(pocPath).filter(f => f.startsWith('requirement_draft_'));
  if (files.length === 0) return null;

  const content = fs.readFileSync(path.join(pocPath, files[0]), 'utf8');
  const result = {};

  // 「不做什麼」區塊
  const notDoMatch = content.match(/不做什麼[^\n]*\n((?:[-*]\s*[^\n]+\n?)+)/i);
  if (notDoMatch) {
    const notDo = notDoMatch[1].toLowerCase();
    if (notDo.includes('前端') || notDo.includes('ui')) result.hasUI = false;
    if (notDo.includes('資料庫') || notDo.includes('database')) result.hasDatabase = false;
    if (notDo.includes('認證') || notDo.includes('auth')) result.hasAuth = false;
  }

  // 模組清單
  const modulePattern = /模組[:\s：]*([\w-]+)/gi;
  const modules = [];
  let match;
  while ((match = modulePattern.exec(content)) !== null) {
    modules.push(match[1]);
  }
  if (modules.length > 0) result.modules = modules;

  // 路由結構
  if (content.match(/路由結構|routes?\//i)) {
    result.hasRouting = true;
  }

  // 前端框架
  const fwMatch = content.match(/(react|vue|svelte|angular|next\.?js|nuxt)/i);
  if (fwMatch) {
    result.hasFrontendFramework = true;
    result.frontendFramework = fwMatch[1].toLowerCase();
    result.hasUI = true;
  }

  // 儲存方式
  if (content.match(/in.?memory|記憶體/i)) result.storage = 'memory';
  else if (content.match(/sqlite/i)) result.storage = 'sqlite';
  else if (content.match(/postgres/i)) result.storage = 'postgres';
  else if (content.match(/mongodb|mongo/i)) result.storage = 'mongodb';

  return result;
}

/**
 * 從 Contract 提取技術棧
 */
function analyzeContract(pocPath) {
  if (!fs.existsSync(pocPath)) return null;
  const files = fs.readdirSync(pocPath).filter(f => 
    f.endsWith('.ts') && (f.includes('Contract') || f.includes('contract'))
  );
  if (files.length === 0) return null;

  const content = fs.readFileSync(path.join(pocPath, files[0]), 'utf8');
  const result = { language: 'typescript' };

  // 提取實體
  const entities = [];
  const entityPattern = /@GEMS-TABLE:\s*(\w+)/g;
  let match;
  while ((match = entityPattern.exec(content)) !== null) {
    entities.push(match[1]);
  }
  // 也從 interface 提取
  const ifPattern = /(?:export\s+)?interface\s+(\w+)/g;
  while ((match = ifPattern.exec(content)) !== null) {
    if (!entities.includes(match[1])) entities.push(match[1]);
  }
  if (entities.length > 0) result.entities = entities;

  // 提取函式數量
  const funcPattern = /@GEMS-FUNCTION:\s*\w+/g;
  const funcs = content.match(funcPattern);
  if (funcs) result.functionCount = funcs.length;

  // 有 @GEMS-TABLE 代表有資料庫概念（但可能是 in-memory）
  if (entities.length > 0) result.hasDatabase = true;

  return result;
}

/**
 * 從 implementation_plan 提取技術棧
 */
function analyzeImplementationPlans(planPath) {
  if (!fs.existsSync(planPath)) return null;
  const files = fs.readdirSync(planPath).filter(f => f.startsWith('implementation_plan_'));
  if (files.length === 0) return null;

  const result = { modules: [] };

  for (const file of files) {
    const content = fs.readFileSync(path.join(planPath, file), 'utf8');

    // 模組名稱
    const moduleMatch = content.match(/模組名稱[:\s：]*([^\n]+)/i);
    if (moduleMatch) {
      const mods = moduleMatch[1].split(/[,，、]/).map(m => m.trim()).filter(Boolean);
      result.modules.push(...mods);
    }

    // 檔案清單 — 看有沒有前端檔案
    if (content.match(/\.tsx|\.jsx|\.vue|\.svelte|components?\//i)) {
      result.hasUI = true;
    }
    if (content.match(/routes?\//i)) {
      result.hasRouting = true;
    }
    if (content.match(/api\//i)) {
      result.hasAPI = true;
    }
  }

  result.modules = [...new Set(result.modules)];
  return result;
}

/**
 * 從 package.json 推斷（fallback）
 */
function analyzePackageJson(projectRoot) {
  const pkgPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const result = {};

    // 語言
    if (allDeps.typescript) result.language = 'typescript';

    // 前端框架
    if (allDeps.react || allDeps['react-dom']) {
      result.hasFrontendFramework = true;
      result.frontendFramework = 'react';
      result.hasUI = true;
    } else if (allDeps.vue) {
      result.hasFrontendFramework = true;
      result.frontendFramework = 'vue';
      result.hasUI = true;
    } else if (allDeps.svelte) {
      result.hasFrontendFramework = true;
      result.frontendFramework = 'svelte';
      result.hasUI = true;
    }

    // Bundler
    if (allDeps.vite || allDeps.webpack || allDeps.esbuild || allDeps.rollup) {
      result.hasBundler = true;
    }

    // 後端框架
    if (allDeps.express || allDeps.koa || allDeps.fastify || allDeps.hono) {
      result.hasAPI = true;
    }

    // 資料庫
    if (allDeps.pg || allDeps['pg-promise']) result.storage = 'postgres';
    else if (allDeps.mysql2 || allDeps.mysql) result.storage = 'mysql';
    else if (allDeps.mongoose || allDeps.mongodb) result.storage = 'mongodb';
    else if (allDeps['better-sqlite3'] || allDeps.sqlite3) result.storage = 'sqlite';

    // 路由
    if (allDeps['react-router'] || allDeps['react-router-dom'] || allDeps['vue-router']) {
      result.hasRouting = true;
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * 推導專案類型
 */
function deriveProjectType(profile) {
  if (profile.hasUI && profile.hasAPI) return 'fullstack';
  if (profile.hasUI) return 'frontend';
  if (profile.hasAPI) return 'backend';
  // 沒有 UI 也沒有 API → 純邏輯/library
  if (!profile.hasUI) return 'backend';
  return 'unknown';
}

/**
 * 合併 profile（不覆蓋已有值）
 */
function mergeProfile(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null) continue;
    // 陣列合併
    if (Array.isArray(value) && Array.isArray(target[key])) {
      target[key] = [...new Set([...target[key], ...value])];
    }
    // 不覆蓋已有的非預設值
    else if (target[key] === 'unknown' || target[key] === 'none' || target[key] === false || target[key] === 0) {
      target[key] = value;
    }
  }
}

/**
 * 格式化輸出
 */
function formatProfile(profile) {
  const lines = [
    '═'.repeat(50),
    `Tech Stack Profile (confidence: ${profile.confidence}%)`,
    '═'.repeat(50),
    `  Language:    ${profile.language}`,
    `  Level:       ${profile.level}`,
    `  Type:        ${profile.projectType}`,
    `  UI:          ${profile.hasUI ? '✓' : '✗'}${profile.frontendFramework ? ` (${profile.frontendFramework})` : ''}`,
    `  API:         ${profile.hasAPI ? '✓' : '✗'}`,
    `  Database:    ${profile.hasDatabase ? '✓' : '✗'} (${profile.storage})`,
    `  Routing:     ${profile.hasRouting ? '✓' : '✗'}`,
    `  Bundler:     ${profile.hasBundler ? '✓' : '✗'}`,
    `  Modules:     ${profile.modules.length > 0 ? profile.modules.join(', ') : '(none)'}`,
    `  Entities:    ${profile.entities.length > 0 ? profile.entities.join(', ') : '(none)'}`,
    `  Functions:   ${profile.functionCount}`,
    `  Source:      ${profile.source}`,
    '═'.repeat(50),
  ];
  return lines.join('\n');
}

module.exports = {
  analyzeTechStack,
  formatProfile,
  // 匯出個別分析函式供測試
  analyzeRequirementSpec,
  analyzeRequirementDraft,
  analyzeContract,
  analyzeImplementationPlans,
  analyzePackageJson,
  deriveProjectType,
};

// CLI
if (require.main === module) {
  const target = process.argv[2] || process.cwd();
  const iteration = process.argv[3] || 'iter-1';
  const profile = analyzeTechStack(target, iteration);
  console.log(formatProfile(profile));
}
