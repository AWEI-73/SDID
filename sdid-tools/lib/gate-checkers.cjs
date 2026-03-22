#!/usr/bin/env node
/**
 * gate-checkers.cjs — Blueprint Gate 驗證器集合
 * 由 blueprint-gate.cjs 拆出，勿直接執行。
 */
'use strict';
const fs = require('fs');
const path = require('path');

/** GEMS: checkFormatCompleteness | P1 | checkRequired(Pure)→checkTypes(Pure)→checkStyles(Pure)→RETURN:Issues | Story-2.0 */
function checkFormatCompleteness(draft, rawContent = '') {
  const issues = [];

  if (!draft.goal || draft.goal.length < 10) {
    issues.push({ level: 'BLOCKER', code: 'FMT-001', msg: '缺少「一句話目標」或長度不足 10 字' });
  }
  if (Object.keys(draft.entities).length === 0) {
    // 區分「完全沒寫」和「有寫但 parser 解不到（格式錯誤）」
    const hasEntitySection = /#{2,4}\s*(?:2\.2|2\.)\s*實體定義/.test(rawContent);
    if (hasEntitySection) {
      issues.push({ level: 'BLOCKER', code: 'FMT-004', msg: '「實體定義」區塊存在但無法解析 — 請使用標準格式：每個實體用 #### EntityName 開頭，下方接欄位表格；或使用扁平表格（第一欄為「實體名稱」）' });
    } else {
      issues.push({ level: 'BLOCKER', code: 'FMT-004', msg: '缺少「實體定義」(Entity Tables)，請加入 ## 2. 實體定義 區塊' });
    }
  }
  if (Object.keys(draft.modules).length === 0) {
    // iter-2+ 的藍圖可能省略模組定義（已在 iter-1 定義過）
    if (draft.iterationPlan.length > 0) {
      issues.push({ level: 'WARN', code: 'FMT-005', msg: '缺少模組定義 (獨立模組或模組 API 摘要)，iter-2+ 可接受，但建議保留' });
    } else {
      issues.push({ level: 'BLOCKER', code: 'FMT-005', msg: '缺少模組定義 (獨立模組或模組 API 摘要)' });
    }
  }
  if (draft.iterationPlan.length === 0) {
    issues.push({ level: 'BLOCKER', code: 'FMT-006', msg: '缺少「迭代規劃表」(標題需為 ## 📅 迭代規劃表 或 ## N. 迭代規劃表，欄位: | Iter | 範圍 | 目標 | 模組 | 交付 | 依賴 | 狀態 |)' });
  }
  if (Object.keys(draft.moduleActions).length === 0) {
    issues.push({ level: 'BLOCKER', code: 'FMT-007', msg: '缺少「模組動作清單」(標題需為 ## 📋 模組動作清單 或 ## N. 模組動作清單，子區塊: ### Iter N: ModuleName [CURRENT])' });
  }

  // FMT-008: 樣式策略 — 必須是單一值，不能用 / 並列多個
  const styleMatch = rawContent.match(/\*\*樣式策略\*\*\s*:\s*(.+)/);
  if (!styleMatch) {
    issues.push({ level: 'BLOCKER', code: 'FMT-008', msg: '缺少「樣式策略」定義 (在共用模組區塊加上 **樣式策略**: CSS Modules / Tailwind / Global CSS / CSS-in-JS)' });
  } else {
    const styleValue = styleMatch[1].trim();
    // 不能用 / 並列多個選項（代表還沒選）
    if (/\s*\/\s*/.test(styleValue)) {
      issues.push({ level: 'BLOCKER', code: 'FMT-008', msg: `樣式策略必須選定單一值，不能並列多個: "${styleValue}"。請從以下選一個: CSS Modules / Tailwind CSS / Global CSS / CSS-in-JS` });
    }
  }

  // FMT-009: 動作類型必須是合法值
  const VALID_TYPES = new Set(['CONST', 'LIB', 'API', 'SVC', 'HOOK', 'UI', 'ROUTE', 'SCRIPT']);
  const invalidTypeItems = [];
  for (const [modName, mod] of Object.entries(draft.moduleActions)) {
    for (const item of (mod.items || [])) {
      const t = (item.type || '').toUpperCase();
      if (t && !VALID_TYPES.has(t)) {
        invalidTypeItems.push(`[${modName}/${item.techName}] 類型 "${item.type}" 無效`);
      }
    }
  }
  if (invalidTypeItems.length > 0) {
    issues.push({ level: 'BLOCKER', code: 'FMT-009', msg: `動作類型必須是 CONST/LIB/API/SVC/HOOK/UI/ROUTE/SCRIPT，以下項目無效:\n  ${invalidTypeItems.slice(0, 5).join('\n  ')}` });
  }

  // FMT-012: 路由結構 — 有 ROUTE 類型動作時必須定義路由結構
  const hasRouteActions = Object.values(draft.moduleActions).some(mod =>
    (mod.items || []).some(item => (item.type || '').toUpperCase() === 'ROUTE')
  );
  const hasRouteStructure = !!(draft.routes && draft.routes.trim().length > 0);
  if (!hasRouteStructure && hasRouteActions) {
    issues.push({ level: 'BLOCKER', code: 'FMT-012', msg: '有 ROUTE 類型動作但缺少路由結構定義。請加入 src/ 目錄樹，說明各模組的檔案路徑' });
  }

  // FMT-010: 實體欄位數量 — 每個實體至少 3 個欄位
  const thinEntities = [];
  for (const [name, fields] of Object.entries(draft.entities)) {
    const fieldCount = Array.isArray(fields) ? fields.length : 0;
    if (fieldCount < 3) {
      thinEntities.push(`${name} (${fieldCount} 個欄位，至少需要 3 個)`);
    }
  }
  if (thinEntities.length > 0) {
    issues.push({ level: 'BLOCKER', code: 'FMT-010', msg: `實體定義欄位不足，請補齊欄位（型別/約束/說明）:\n  ${thinEntities.join('\n  ')}` });
  }

  // FMT-011: 模組公開 API 必須有型別簽名 (含括號 + 參數型別或回傳型別)
  const noSigModules = [];
  for (const [name, mod] of Object.entries(draft.modules)) {
    const apis = mod.publicAPI || [];
    if (apis.length === 0) continue;
    const hasTypedSig = apis.some(a => {
      if (!/\(.*\)/.test(a)) return false;       // 沒括號
      if (a.length <= 5) return false;            // 太短
      const hasReturnType = /\)\s*:\s*\w+/.test(a);  // 有回傳型別
      const hasParamType = /\(\s*\w+\s*:\s*\w+/.test(a); // 有參數型別
      return hasReturnType || hasParamType;
    });
    if (!hasTypedSig) {
      noSigModules.push(`${name}: ${apis.slice(0, 2).join(', ')}`);
    }
  }
  if (noSigModules.length > 0) {
    issues.push({ level: 'BLOCKER', code: 'FMT-011', msg: `模組公開 API 缺少型別簽名，應寫成 functionName(param: Type): ReturnType:\n  ${noSigModules.join('\n  ')}` });
  }

  return issues;
}

/**
 * 2. 佔位符偵測 — 檢查是否有未替換的 {placeholder}
 */
function checkPlaceholders(rawContent, draftPath = '') {
  const issues = [];

  // Template 檔案豁免佔位符檢查
  if (draftPath && /\.template\./i.test(path.basename(draftPath))) {
    return issues;
  }
  const placeholderPattern = /\{[a-zA-Z_\u4e00-\u9fff]+\}/g;
  const lines = rawContent.split('\n');

  // 排除 HTML 註解和 code block 中的佔位符
  let inCodeBlock = false;
  let inComment = false;
  const foundPlaceholders = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) { inCodeBlock = !inCodeBlock; continue; }
    if (line.includes('<!--')) inComment = true;
    if (line.includes('-->')) { inComment = false; continue; }
    if (inCodeBlock || inComment) continue;

    const matches = line.match(placeholderPattern);
    if (matches) {
      for (const m of matches) {
        // 排除常見的非佔位符模式
        if (['{x}', '{i}', '{n}'].includes(m.toLowerCase())) continue;
        foundPlaceholders.add(`L${i + 1}: ${m}`);
      }
    }
  }

  if (foundPlaceholders.size > 0) {
    issues.push({
      level: 'BLOCKER', code: 'PH-001',
      msg: `發現 ${foundPlaceholders.size} 個未替換佔位符: ${[...foundPlaceholders].slice(0, 5).join(', ')}${foundPlaceholders.size > 5 ? '...' : ''}`
    });
  }

  return issues;
}

/**
 * 3. 標籤完整性 — iter-N 的動作必須有 techName + priority + flow + deps
 */
function checkTagIntegrity(draft, targetIter) {
  const issues = [];

  for (const [modName, mod] of Object.entries(draft.moduleActions)) {
    if (mod.iter !== targetIter) continue;
    if (mod.fillLevel === 'stub' || mod.fillLevel === 'done') continue;

    for (const item of (mod.items || [])) {
      const prefix = `[${modName}/${item.techName || '?'}]`;

      if (!item.techName || item.techName.trim() === '') {
        issues.push({ level: 'BLOCKER', code: 'TAG-001', msg: `${prefix} 缺少技術名稱 (techName)` });
      }
      if (!item.priority || !/^P[0-3]$/.test(item.priority)) {
        issues.push({ level: 'BLOCKER', code: 'TAG-002', msg: `${prefix} 優先級格式錯誤: "${item.priority}" (應為 P0-P3)` });
      }
      if (!item.flow || item.flow.trim() === '') {
        const p = (item.priority || '').toUpperCase();
        if (p === 'P0' || p === 'P1') {
          issues.push({ level: 'BLOCKER', code: 'TAG-003', msg: `${prefix} P0/P1 動作缺少流向 (flow)，必須填入執行步驟（如 VALIDATE→PROCESS→RETURN）` });
        }
        // P2/P3 不報錯，略過
      }
      if (!item.deps) {
        // auto-patch: 靜默補「無」，不加 issue
        item.deps = '無';
      }
    }
  }

  return issues;
}


/**
 * 5. 依賴無循環 — 模組間 deps 不能形成環
 */
function checkDependencyCycles(draft) {
  const issues = [];

  // 建立模組依賴圖
  const graph = {};
  for (const entry of draft.iterationPlan) {
    graph[entry.module] = entry.deps || [];
  }
  // 補充 modules 定義中的 deps
  for (const [name, mod] of Object.entries(draft.modules)) {
    if (!graph[name]) graph[name] = mod.deps || [];
  }

  // DFS 偵測環
  const visited = new Set();
  const inStack = new Set();
  const cyclePaths = [];

  function dfs(node, pathSoFar) {
    if (inStack.has(node)) {
      const cycleStart = pathSoFar.indexOf(node);
      cyclePaths.push(pathSoFar.slice(cycleStart).concat(node));
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);

    for (const dep of (graph[node] || [])) {
      // 正規化 dep 名稱 (可能是 "shared/types" → "shared")
      const depModule = dep.split('/')[0].trim();
      if (depModule && graph[depModule] !== undefined) {
        dfs(depModule, [...pathSoFar, node]);
      }
    }

    inStack.delete(node);
  }

  for (const node of Object.keys(graph)) {
    dfs(node, []);
  }

  for (const cycle of cyclePaths) {
    issues.push({
      level: 'BLOCKER', code: 'DEP-001',
      msg: `模組依賴循環: ${cycle.join(' → ')}`
    });
  }

  return issues;
}

/**
 * 6. 迭代依賴 DAG — 不能依賴更晚 iter 的模組 (同 iter 內允許，循環由 checkDependencyCycles 把關)
 */
function checkIterationDAG(draft) {
  const issues = [];

  // 建立 module → iter 映射
  const moduleIter = {};
  for (const entry of draft.iterationPlan) {
    moduleIter[entry.module] = entry.iter;
  }

  for (const entry of draft.iterationPlan) {
    for (const dep of (entry.deps || [])) {
      const depModule = dep.split('/')[0].trim();
      const depIter = moduleIter[depModule];
      if (depIter !== undefined && depIter > entry.iter) {
        issues.push({
          level: 'BLOCKER', code: 'DAG-001',
          msg: `迭代依賴違規: iter-${entry.iter}/${entry.module} 依賴 iter-${depIter}/${depModule} (依賴必須在同期或更早的 iter)`
        });
      }
    }
  }

  return issues;
}


/**
 * 8. Stub 最低資訊檢查 — iter-2+ 的 Stub 必須有描述 + 依賴 + 函式 flow 清單
 * v2.3: 新增 STUB-003 — Stub 必須有函式 flow 清單（expand 工具只做搬運，不做推導）
 */
function checkStubMinimum(draft, targetIter) {
  const issues = [];

  for (const [modName, mod] of Object.entries(draft.moduleActions)) {
    if (mod.fillLevel !== 'stub') continue;
    // 只檢查非當前 iter 的 Stub
    if (mod.iter === targetIter) continue;

    const prefix = `[Stub: ${modName}]`;

    // STUB-003: Stub 必須有函式 flow 清單（至少一個 item 有 flow 欄位）
    // expand v2.0 只做格式搬運，沒有 flow 清單就無法展開
    const items = mod.items || [];
    const hasFlowItems = items.some(item => item.flow && item.flow.trim() !== '');
    if (!hasFlowItems) {
      issues.push({
        level: 'BLOCKER', code: 'STUB-003',
        msg: `${prefix} 缺少函式 flow 清單。Stub iter 必須在藍圖設計階段就填入函式 flow 清單（每個公開 API 函式有 flow + AC 骨架），expand 工具只做格式搬運，不做內容推導`
      });
    }
  }

  return issues;
}

/**
 * 9. 迭代規劃表 vs 動作清單一致性
 */
function checkPlanActionConsistency(draft) {
  const issues = [];

  // iterationPlan 為空時是 FMT-006 的連帶效應，不重複報 CONS-002
  if (draft.iterationPlan.length === 0) return issues;

  const planModules = new Set(draft.iterationPlan.map(e => e.module));
  const actionModules = new Set(Object.keys(draft.moduleActions));

  // 規劃表有但動作清單沒有
  for (const mod of planModules) {
    if (!actionModules.has(mod)) {
      issues.push({
        level: 'BLOCKER', code: 'CONS-001',
        msg: `模組 "${mod}" 在迭代規劃表中但缺少動作清單`
      });
    }
  }

  return issues;
}

/**
 * 10. Level 限制檢查 — 僅作為 WARN，不再 BLOCKER
 * v1.3: 移除硬限制，讓藍圖可以容納正常開發量
 */
/**
 * 10. Level 限制檢查 — v1.4 完全移除
 * 藍圖可以自由規劃任意數量的 iter 和模組，不受 Level 約束。
 * 縮拆由 Shrink 階段處理，不在 Gate 限制。
 */
function checkLevelLimits(draft) {
  return [];
}

/**
 * 12. 草稿狀態檢查 — 草稿狀態必須是 [x] DONE 或 ✅，不能是 [~] PENDING
 */
function checkDraftStatus(rawContent) {
  const issues = [];

  // 匹配草稿狀態行 (v3: 藍圖狀態; v2: 草稿狀態)
  const statusMatch = rawContent.match(/\*\*(?:草稿|藍圖)狀態\*\*:\s*(.+)/);
  if (!statusMatch) return issues;

  const statusText = statusMatch[1].trim();
  // 先判斷 PENDING（[~]+PENDING 組合，或 ⏳ 符號，或純 PENDING 文字）
  // v3 uses [~] ACTIVE which is a valid "in progress" state, not PENDING
  const isPending = (/\[~\]/.test(statusText) && /PENDING/i.test(statusText)) || /⏳/.test(statusText) || /^PENDING$/i.test(statusText);
  // 再判斷 DONE/PASS/ACTIVE（已完成或進行中的狀態）
  const isDone = /\[x\]/i.test(statusText) || /✅/.test(statusText) || /DONE/i.test(statusText) || /PASS/i.test(statusText) || /ACTIVE/i.test(statusText);

  if (isPending) {
    issues.push({
      level: 'BLOCKER', code: 'STS-002',
      msg: `草稿狀態為 "${statusText}"，必須完成所有釐清項目後標記為 [x] DONE 才能進入 Gate`
    });
  }

  return issues;
}

/**
 * 13. 依賴一致性檢查 — iterationPlan deps vs modules deps vs moduleActions item deps
 */
function checkDepsConsistency(draft, targetIter) {
  const issues = [];

  for (const entry of draft.iterationPlan) {
    if (entry.iter !== targetIter) continue;
    const moduleName = entry.module;
    const moduleDef = draft.modules[moduleName];
    const actionData = draft.moduleActions[moduleName];

    if (!moduleDef || !actionData) continue;

    // 1. 模組定義有 deps，但迭代規劃表 deps 為空
    const moduleDeps = (moduleDef.deps || []).filter(d => d && d !== '無');
    const planDeps = entry.deps || [];

    if (moduleDeps.length > 0 && planDeps.length === 0) {
      issues.push({
        level: 'BLOCKER', code: 'DEPCON-001',
        msg: `[${moduleName}] 模組定義有依賴 [${moduleDeps.join(', ')}]，但迭代規劃表 deps 為「無」。請同步迭代規劃表的依賴欄位，否則 Task-Pipe 排程將出錯`
      });
    }

    // 2. 動作清單所有 item deps 都是「無」，但模組定義有 deps
    if (actionData.items && actionData.items.length > 0 && moduleDeps.length > 0) {
      const allItemDepsEmpty = actionData.items.every(item => {
        const d = (item.deps || '').trim();
        return !d || d === '無' || d === '-';
      });
      if (allItemDepsEmpty) {
        issues.push({
          level: 'BLOCKER', code: 'DEPCON-002',
          msg: `[${moduleName}] 模組依賴 [${moduleDeps.join(', ')}]，但動作清單所有 item 的 deps 都是「無」。請在動作清單的 deps 欄標註具體依賴，否則 Phase-3 掃描器無法建立正確依賴圖`
        });
      }
    }
  }

  return issues;
}

/**
 * 14. 單一迭代模組負載檢查 — v1.4 移除 Level 限制
 * iter 大小由業務範圍決定，不受 Level 約束。
 * Story 小步才是控制複雜度的粒度。
 */
function checkIterModuleLoad(draft) {
  return []; // 不再限制每個 iter 的模組數
}

/**
 * 20. 迭代動作預算檢查 (v1.3) — 改為 per-Story WARN，移除 per-iter 硬限制
 * 
 * 每個 Story（模組）最多 6 個動作 → WARN
 * 超過 10 個動作 → BLOCKER（明顯過大，需要拆 Story）
 * 
 * 移除 Level S/M/L 的差異化限制，統一標準。
 * Foundation iter (全 CONST/LIB/SCRIPT/ROUTE) 豁免。
 */
function checkIterActionBudget(draft) {
  const issues = [];

  // per-Story 上限
  const WARN_LIMIT = 6;   // 超過 6 個動作 → WARN
  const BLOCK_LIMIT = 10; // 超過 10 個動作 → BLOCKER（明顯過大）

  for (const [modName, mod] of Object.entries(draft.moduleActions)) {
    if (mod.fillLevel === 'stub' || mod.fillLevel === 'done') continue;
    const iter = mod.iter;
    if (!iter) continue;

    const items = mod.items || [];
    const count = items.length;
    if (count === 0) continue;

    // Foundation iter 豁免：全部是 CONST/LIB/SCRIPT/ROUTE 類型
    const allInfra = items.every(item => {
      const type = (item.type || '').toUpperCase();
      return ['CONST', 'LIB', 'SCRIPT', 'ROUTE'].includes(type);
    });
    if (allInfra) continue;

    if (count > BLOCK_LIMIT) {
      issues.push({
        level: 'BLOCKER', code: 'BUDGET-001',
        msg: `[${modName}] Story 有 ${count} 個動作，超過硬限制 ${BLOCK_LIMIT}。請拆成多個 Story（不是多個 iter），每個 Story 建議 4-6 個動作。拆法：依前後端分開，或依資料流 read/write 分開`
      });
    }
  }

  return issues;
}

/**
 * 20. MODIFY 函式存在性驗證 — evolution=MODIFY 的動作必須在 functions.json 中存在
 * 防止 AI 在 draft-to-plan 時修改一個根本不存在的函式
 */
function checkModifyFunctionExists(draft, targetIter, projectRoot) {
  const issues = [];
  if (!projectRoot) return issues;

  // 讀 functions.json
  const functionsPath = require('path').join(projectRoot, '.gems', 'docs', 'functions.json');
  if (!require('fs').existsSync(functionsPath)) return issues; // 第一個 iter 還沒有 functions.json，跳過

  let existingFns;
  try {
    const fj = JSON.parse(require('fs').readFileSync(functionsPath, 'utf8'));
    existingFns = new Set((fj.functions || []).map(f => f.name));
  } catch { return issues; }

  for (const [modName, mod] of Object.entries(draft.moduleActions)) {
    if (mod.iter !== targetIter) continue;
    if (mod.fillLevel === 'stub' || mod.fillLevel === 'done') continue;

    for (const item of (mod.items || [])) {
      const isModify = (item.operation === 'MOD') ||
        (item.evolution || '').toUpperCase() === 'MODIFY' ||
        (item.techName || '').includes('[Modify]');
      if (!isModify) continue;

      const cleanName = (item.techName || '').replace(/\s*\[Modify\]/i, '').trim();
      if (cleanName && !existingFns.has(cleanName)) {
        issues.push({
          level: 'BLOCKER',
          code: 'MOD-001',
          msg: `[${modName}/${cleanName}] evolution=MODIFY 但 functions.json 中找不到此函式。請確認函式名稱正確，或改為 NEW（新增）`
        });
      }
    }
  }

  return issues;
}

/**
 * 11. 演化層依賴驗證 (v2.1) — 確保 L(N) 的動作不依賴 L(N+1) 的動作
 */
function checkEvolutionLayers(draft) {
  const issues = [];

  // 收集所有有演化標記的動作
  const actionsByEvolution = {};  // { 'BASE': [...], 'L1': [...] }
  const actionEvolutionMap = {};  // { techName: 'BASE' }

  for (const [modName, mod] of Object.entries(draft.moduleActions)) {
    if (mod.fillLevel === 'stub' || mod.fillLevel === 'done') continue;
    for (const item of (mod.items || [])) {
      const evo = item.evolution || item['演化'] || 'BASE';
      if (!actionsByEvolution[evo]) actionsByEvolution[evo] = [];
      actionsByEvolution[evo].push({ ...item, module: modName });
      actionEvolutionMap[item.techName] = evo;
    }
  }

  // 如果沒有演化標記，跳過
  const layers = Object.keys(actionsByEvolution);
  if (layers.length <= 1 && layers[0] === 'BASE') return issues;

  // 解析層級順序: BASE=0, L1=1, L2=2, ...
  function layerOrder(evo) {
    if (!evo || evo === 'BASE') return 0;
    const m = evo.match(/^L(\d+)$/i);
    return m ? parseInt(m[1]) : 0;
  }

  // 檢查: L(N) 的動作不能依賴 L(N+1) 的動作
  for (const [modName, mod] of Object.entries(draft.moduleActions)) {
    if (mod.fillLevel === 'stub' || mod.fillLevel === 'done') continue;
    for (const item of (mod.items || [])) {
      const myLayer = layerOrder(item.evolution || item['演化'] || 'BASE');
      const depsStr = item.deps || '';
      // 解析 deps 中的 [Internal.xxx] 引用
      const depRefs = depsStr.match(/\[(?:Internal|Module)\.(\w+)\]/gi) || [];
      for (const ref of depRefs) {
        const depName = ref.match(/\.(\w+)\]/)?.[1];
        if (depName && actionEvolutionMap[depName]) {
          const depLayer = layerOrder(actionEvolutionMap[depName]);
          if (depLayer > myLayer) {
            issues.push({
              level: 'BLOCKER', code: 'EVO-001',
              msg: `[${modName}/${item.techName}] 演化層 ${item.evolution || 'BASE'} 依賴了更高層 ${actionEvolutionMap[depName]} 的 ${depName}`
            });
          }
        }
      }
    }
  }

  // 檢查: Modify 動作必須有對應的 BASE 動作
  for (const [modName, mod] of Object.entries(draft.moduleActions)) {
    if (mod.fillLevel === 'stub' || mod.fillLevel === 'done') continue;
    for (const item of (mod.items || [])) {
      const techName = item.techName || '';
      if (techName.includes('[Modify]') || techName.includes('[modify]')) {
        const baseName = techName.replace(/\s*\[Modify\]/i, '').trim();
        // EVO-002 已移除（Modify 找不到 BASE 不擋，交由 MOD-001 把關）
      }
    }
  }

  return issues;
}

/**
 * 15. 公開 API ↔ 動作清單一致性 — 模組公開 API 的函式名必須在動作清單中有對應 techName
 */
function checkAPIActionConsistency(draft, targetIter) {
  const issues = [];

  for (const [modName, mod] of Object.entries(draft.modules)) {
    const apiList = mod.publicAPI || [];
    if (apiList.length === 0) continue;

    const actionData = draft.moduleActions[modName];
    if (!actionData || actionData.fillLevel === 'stub' || actionData.fillLevel === 'done') continue;
    if (actionData.iter !== targetIter) continue;

    const techNames = new Set((actionData.items || []).map(i => (i.techName || '').trim()));

    for (const apiLine of apiList) {
      // 從 API 簽名提取函式名: "createBookmark(input: BookmarkInput): Bookmark" → "createBookmark"
      const fnMatch = apiLine.match(/^(\w+)\s*\(/);
      if (!fnMatch) continue;
      const fnName = fnMatch[1];

      if (!techNames.has(fnName)) {
        issues.push({
          level: 'BLOCKER', code: 'API-001',
          msg: `[${modName}] 公開 API "${fnName}" 在動作清單中找不到對應的 techName`
        });
      }
    }

    // 反向: 動作清單的 SVC/API 類型 techName 應在公開 API 中
    const apiFnNames = new Set(apiList.map(a => {
      const m = a.match(/^(\w+)\s*\(/);
      return m ? m[1] : a.trim();
    }));

    // API-002 已移除（內部函式不需強制列入公開 API）
  }

  return issues;
}

/**
 * 解析 draft rawContent 的 AC 定義，回傳所有已定義的 AC 編號 Set
 * 支援格式：
 *   v2/v3: **AC-1.0**: ... (在獨立「驗收條件」區塊)
 *   v4:    - AC-1.0 [CALC] — funcName: Given ... (在動作清單的 AC 骨架行)
 *   通用:  ### AC-1.0: ... / **AC-1.0** — ...
 */
function parseDefinedACs(rawContent) {
  const defined = new Set();
  if (!rawContent) return defined;
  const lines = rawContent.split('\n');

  // 策略 1: 掃描獨立「驗收條件」區塊 (v2/v3)
  let inACSection = false;
  for (const line of lines) {
    if (/^#+\s*.*驗收(條件|標準)/i.test(line)) { inACSection = true; continue; }
    if (inACSection && /^#{1,2}\s/.test(line) && !/驗收|AC/i.test(line) && !/^###/.test(line)) break;
    if (inACSection) {
      const m = line.match(/AC[-_]?(\d+[\.\-]\d+)/i);
      if (m) defined.add(`AC-${m[1].replace('-', '.')}`);
    }
  }

  // 策略 2: 掃描 AC 骨架行 (v4 inline format)
  // 格式: - AC-1.0 [CALC] — funcName: Given ... / When ... / Then ...
  // 或:   - AC-1.0 — funcName: Given ... / When ... / Then ...
  for (const line of lines) {
    if (/^\s*-\s*AC[-_]?(\d+[\.\-]\d+)\b/.test(line)) {
      const m = line.match(/AC[-_]?(\d+[\.\-]\d+)/i);
      if (m) defined.add(`AC-${m[1].replace('-', '.')}`);
    }
  }

  return defined;
}

/**
 * 19. AC 完整性 (v2.3) — 雙向驗證
 *   ACC-001: P0/P1 動作缺少 AC 欄位（動作清單 → 驗收條件）
 *   ACC-002: 動作清單的 AC 編號在「驗收條件」區塊找不到定義（防止空殼 AC）
 */
function checkACIntegrity(draft, targetIter, rawContent) {
  // ACC-001/002 已移除（WARN 無效，不改行為）
  // AC 覆蓋率由 blueprint-score 計算，不在 gate 擋
  return [];
}

/**
 * 22. AC 品質檢查 — 已移除 (ACC-003 WARN 無效)
 */
function checkACQuality() { return []; }

/**
 * 18. 垂直切片完整性 (VSC) v2.0
 *
 * 改為 per-iter 聚合檢查，不再 per-story 強制。
 * 單一 story 可以純後端或純前端（合法拆法）。
 * 整個 iter 的所有 story 合起來才做前後端覆蓋判斷。
 *
 * BLOCKER: Foundation 缺 ROUTE 殼 (VSC-001) — 維持，因為 npm run dev 會白屏
 * WARN:    iter 聚合只有後端或只有前端 (VSC-002/003) — 引導但不擋
 * WARN:    STUB iter 前後端分離 (VSC-004/005) — 設計草稿不強制
 */
function checkVerticalSliceCompleteness(draft, targetIter) {
  const issues = [];

  const BACKEND_TYPES = new Set(['SVC', 'API', 'DATA', 'REPO', 'DB']);
  const FRONTEND_TYPES = new Set(['UI', 'HOOK', 'ROUTE', 'PAGE', 'COMPONENT']);
  const NEUTRAL_TYPES = new Set(['CONST', 'LIB', 'SCRIPT']);

  const isFoundationModule = (name) => {
    const lower = name.toLowerCase();
    return lower === 'shared' || lower.includes('foundation') || lower.includes('infra') || lower.includes('config');
  };

  // 純後端模組豁免 VSC-002（GAS/API/Backend 模組本來就沒有前端）
  const isApiOnlyModule = (name) => {
    const lower = name.toLowerCase();
    return lower.includes('gas') || lower.includes('gasapi') || lower.includes('backend') ||
      lower.includes('api-only') || lower.includes('server') || lower.includes('worker');
  };

  // ── Foundation：只檢查 ROUTE 殼（BLOCKER 維持）──
  for (const [modName, mod] of Object.entries(draft.moduleActions)) {
    if (mod.iter !== targetIter) continue;
    if (mod.fillLevel === 'stub' || mod.fillLevel === 'done') continue;
    if (!isFoundationModule(modName)) continue;

    const items = mod.items || [];
    const types = new Set(items.map(i => (i.type || '').toUpperCase()));
    if (!types.has('ROUTE') && !types.has('APP') && items.length > 0) {
      issues.push({
        level: 'BLOCKER', code: 'VSC-001',
        msg: `[${modName}] Foundation 模組必須包含 ROUTE 類型的前端主入口殼 (AppRouter/Layout)，確保 npm run dev 可看到首頁框架。請在動作清單加入: | 前端主入口殼 | ROUTE | AppRouter | P1 | CHECK_AUTH→LOAD_LAYOUT→RENDER_ROUTES | ... |`
      });
    }
  }

  // VSC-002/003/004/005 已移除（WARN 不改行為，前後端平衡由 blueprint-score 記分）

  return issues;
}

/**
 * 21. Blueprint Score — 藍圖健康評分 (不擋，純輸出)
 *
 * 5 個維度，100 分：
 *   垂直切片覆蓋  25 分 — 有前後端的 iter 數 / 非 Foundation iter 總數
 *   Story 密度    20 分 — 非 Foundation iter 平均 story 數（目標 ≥2）
 *   Flow 品質     20 分 — 有業務語意 flow 的動作 / 總動作數
 *   AC 覆蓋率     20 分 — 有 AC 的 P0/P1 動作 / P0/P1 總數
 *   基礎建設完整度 15 分 — Foundation iter 必要元素覆蓋
 *
 * 分級: 90+ EXCELLENT / 75-89 GOOD / 60-74 FAIR / 0-59 WEAK
 */

module.exports = {
  checkFormatCompleteness,
  checkPlaceholders,
  checkDraftStatus,
  checkTagIntegrity,
  checkAPIActionConsistency,
  checkDependencyCycles,
  checkIterationDAG,
  checkStubMinimum,
  checkPlanActionConsistency,
  checkLevelLimits,
  checkEvolutionLayers,
  checkDepsConsistency,
  checkIterModuleLoad,
  checkIterActionBudget,
  checkVerticalSliceCompleteness,
  checkACIntegrity,
  checkACQuality,
  checkModifyFunctionExists,
  parseDefinedACs,
};
