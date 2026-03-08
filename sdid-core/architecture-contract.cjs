'use strict';

/**
 * Architecture Contract v1.0
 * 
 * 單一真相源：定義 SDID 框架的分層架構規則。
 * draft-to-plan.cjs 和 phase-1.cjs 都從這裡讀取，確保一致性。
 * 
 * 解決問題：draft-to-plan 把 CONST 放 src/shared/types/，
 * 但 phase-1 強制要求 src/config/ 存在 → 死循環。
 */

const layers = {
  config: {
    required: true,
    path: 'src/config/',
    desc: '全域配置、常數、型別定義（無依賴）',
  },
  shared: {
    required: true,
    path: 'src/shared/',
    desc: '跨模組共用邏輯（storage、utils、hooks 等）',
  },
  modules: {
    required: true,
    path: 'src/modules/',
    desc: '業務模組容器',
  },
  assets: {
    required: false,
    path: 'src/assets/',
    desc: '靜態資源（前端專案）',
  },
  lib: {
    required: false,
    path: 'src/lib/',
    desc: '第三方庫封裝',
  },
  routes: {
    required: false,
    path: 'src/routes/',
    desc: '路由定義',
  },
};

/**
 * draft-to-plan 的 inferFilePath() 用這個表決定 type → 路徑。
 * 
 * 關鍵修正：CONST + shared 模組 → src/config/（而非 src/shared/types/）
 * 因為 CONST 是「全域常數/型別定義」，屬於 config layer，不屬於 shared layer。
 * 
 * @param {string} type - GEMS 類型（CONST/LIB/API/SVC/HOOK/UI/ROUTE）
 * @param {string} moduleName - 模組名稱
 * @param {string} kebab - kebab-case 的技術名稱
 * @param {string} [layer] - 模組層級（feature | adapter | shared，預設 feature）
 * @returns {string} 相對於專案根目錄的檔案路徑
 */
function inferFilePath(type, moduleName, kebab, layer = 'feature') {
  const isShared = moduleName === 'shared' || layer === 'shared';
  const isAdapter = layer === 'adapter';

  const base = isShared ? 'src/shared'
    : isAdapter ? `src/lib/${moduleName}`
    : `src/modules/${moduleName}`;

  switch (type) {
    case 'CONST':
      // 修正：shared 模組的 CONST → config layer（全域型別/常數）
      return isShared
        ? `src/config/${kebab}.ts`
        : `${base}/types/${kebab}.ts`;
    case 'LIB':
      return `${base}/${isShared ? 'storage/' : 'lib/'}${kebab}.ts`;
    case 'API':
      return `${base}/api/${kebab}.ts`;
    case 'SVC':
      return `${base}/services/${kebab}.ts`;
    case 'HOOK':
      return `${base}/hooks/${kebab}.ts`;
    case 'UI':
      return `${base}/components/${kebab}.tsx`;
    case 'ROUTE':
      return `${base}/pages/${kebab}.tsx`;
    default:
      return `${base}/${kebab}.ts`;
  }
}

/**
 * phase-1 的 detectExtraFiles() 用這個函式判斷「合法的基礎建設檔案」。
 * 即使 Plan manifest 沒有明列，這些路徑也不應被標為「多餘」。
 * 
 * @param {string} relPath - 相對於專案根目錄的路徑（正規化，使用 /）
 * @returns {boolean} true = 是基礎建設檔案，跳過多餘檢查
 */
function isInfraFile(relPath) {
  // src/config/ 下的所有檔案 = config layer，即使 Plan 沒明列也合法
  if (relPath.startsWith('src/config/')) return true;
  return false;
}

/**
 * phase-1 的 validateModule0Structure() 用這個函式取得必要 layers。
 * 
 * @returns {{ name: string, layerKey: string, required: boolean }[]}
 */
function getRequiredLayers() {
  return Object.entries(layers)
    .filter(([, v]) => v.required)
    .map(([key, v]) => ({ name: key, path: v.path, desc: v.desc }));
}

module.exports = { layers, inferFilePath, isInfraFile, getRequiredLayers };
