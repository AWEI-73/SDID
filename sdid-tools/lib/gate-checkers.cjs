#!/usr/bin/env node
/**
 * gate-checkers.cjs — Blueprint Gate 驗證器集合
 * 由 blueprint-gate.cjs 拆出，勿直接執行。
 */
'use strict';
const fs = require('fs');
const path = require('path');

function checkFormatCompleteness(draft, rawContent = '') {
  const issues = [];

  if (!draft.goal || draft.goal.length < 10) {
    issues.push({ level: 'BLOCKER', code: 'FMT-001', msg: '缺少「一句話目標」或長度不足 10 字' });
  }
  if (!draft.requirement || draft.requirement.length < 20) {
    issues.push({ level: 'WARN', code: 'FMT-002', msg: '「用戶原始需求」過短或缺失 (建議 50 字以上)' });
  }
  if (!draft.groups || draft.groups.length === 0) {
    issues.push({ level: 'WARN', code: 'FMT-003', msg: '缺少「族群識別」表格' });
  }
  if (Object.keys(draft.entities).length === 0) {
    issues.push({ level: 'WARN', code: 'FMT-004', msg: '缺少「實體定義」(Entity Tables)' });
  }
  if (Object.keys(draft.modules).length === 0) {
    // iter-2+ 的藍圖可能省略模組定義（已在 iter-1 定義過）
    if (draft.iterationPlan.length > 0) {
      issues.push({ level: 'WARN', code: 'FMT-005', msg: '缺少「獨立模組」定義 (iter-2+ 可接受，但建議保留)' });
    } else {
      issues.push({ level: 'BLOCKER', code: 'FMT-005', msg: '缺少「獨立模組」定義' });
    }
  }
  if (draft.iterationPlan.length === 0) {
    issues.push({ level: 'BLOCKER', code: 'FMT-006', msg: '缺少「迭代規劃表」' });
  }
  if (Object.keys(draft.moduleActions).length === 0) {
    issues.push({ level: 'BLOCKER', code: 'FMT-007', msg: '缺少「模組動作清單」' });
  }

  // FMT-008: 樣式策略
  const hasStyleStrategy = /\*\*樣式策略\*\*\s*:\s*\S/.test(rawContent);
  if (!hasStyleStrategy) {
    issues.push({ level: 'BLOCKER', code: 'FMT-008', msg: '缺少「樣式策略」定義 (在共用模組區塊加上 **樣式策略**: CSS Modules / Tailwind / Global CSS / CSS-in-JS)' });
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
  if (!hasRouteStructure) {
    if (hasRouteActions) {
      issues.push({ level: 'BLOCKER', code: 'FMT-012', msg: '有 ROUTE 類型動作但缺少「### 5. 路由結構」定義。請加入 src/ 目錄樹，說明各模組的檔案路徑' });
    } else {
      issues.push({ level: 'WARN', code: 'FMT-012', msg: '缺少「### 5. 路由結構」定義，建議加入 src/ 目錄樹讓 AI 知道檔案放哪' });
    }
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

  // FMT-011: 模組公開 API 必須有型別簽名 (含括號)
  const noSigModules = [];
  for (const [name, mod] of Object.entries(draft.modules)) {
    const apis = mod.publicAPI || [];
    if (apis.length === 0) continue;
    const hasTypedSig = apis.some(a => /\(.*\)/.test(a) && a.length > 5);
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
        issues.push({ level: 'BLOCKER', code: 'TAG-003', msg: `${prefix} 缺少流向 (flow)` });
      }
      if (!item.deps) {
        issues.push({ level: 'WARN', code: 'TAG-004', msg: `${prefix} 缺少依賴欄位 (deps)，將預設為「無」` });
      }
    }
  }

  return issues;
}

/**
 * 4. Flow 步驟數檢查 — 每個 flow 應有 3-7 個步驟
 */
function checkFlowStepCount(draft, targetIter) {
  const issues = [];

  for (const [modName, mod] of Object.entries(draft.moduleActions)) {
    if (mod.iter !== targetIter) continue;
    if (mod.fillLevel === 'stub' || mod.fillLevel === 'done') continue;

    for (const item of (mod.items || [])) {
      if (!item.flow) continue;
      const steps = item.flow.split('→').map(s => s.trim()).filter(Boolean);
      const prefix = `[${modName}/${item.techName}]`;

      if (steps.length < 3) {
        issues.push({ level: 'WARN', code: 'FLOW-001', msg: `${prefix} flow 步驟過少 (${steps.length} 步，建議 3-7)` });
      }
      if (steps.length > 7) {
        issues.push({ level: 'WARN', code: 'FLOW-002', msg: `${prefix} flow 步驟過多 (${steps.length} 步，建議拆分函式)` });
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
 * 7. 基礎設施拆分建議 — shared 動作數過多
 */
function checkInfraSize(draft) {
  const issues = [];

  for (const [modName, mod] of Object.entries(draft.moduleActions)) {
    if (mod.fillLevel === 'stub' || mod.fillLevel === 'done') continue;
    const count = (mod.items || []).length;
    if (count > 8) {
      issues.push({
        level: 'WARN', code: 'SIZE-001',
        msg: `模組 ${modName} 有 ${count} 個動作 (>8)，建議拆分為子模組`
      });
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

    if (!mod.stubDescription || mod.stubDescription.trim() === '') {
      issues.push({ level: 'WARN', code: 'STUB-001', msg: `${prefix} 缺少描述` });
    }
    // 檢查迭代規劃表中是否有對應的 deps
    const planEntry = draft.iterationPlan.find(e => e.module === modName);
    if (!planEntry || (planEntry.deps || []).length === 0) {
      // 不一定是問題，shared 可能沒有 deps
      if (modName !== 'shared') {
        issues.push({ level: 'WARN', code: 'STUB-002', msg: `${prefix} 迭代規劃表中缺少依賴資訊` });
      }
    }

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

  // 動作清單有但規劃表沒有
  for (const mod of actionModules) {
    if (!planModules.has(mod)) {
      issues.push({
        level: 'WARN', code: 'CONS-002',
        msg: `模組 "${mod}" 有動作清單但不在迭代規劃表中`
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

  // 匹配草稿狀態行
  const statusMatch = rawContent.match(/\*\*草稿狀態\*\*:\s*(.+)/);
  if (!statusMatch) {
    issues.push({
      level: 'WARN', code: 'STS-001',
      msg: '找不到「草稿狀態」欄位，建議加入'
    });
    return issues;
  }

  const statusText = statusMatch[1].trim();
  // 先判斷 PENDING（[~]+PENDING 組合，或 ⏳ 符號，或純 PENDING 文字）
  const isPending = (/\[~\]/.test(statusText) && /PENDING/i.test(statusText)) || /⏳/.test(statusText) || /^PENDING$/i.test(statusText);
  // 再判斷 DONE/PASS/ACTIVE（已完成的狀態）
  const isDone = /\[x\]/i.test(statusText) || /✅/.test(statusText) || /DONE/i.test(statusText) || /PASS/i.test(statusText) || /ACTIVE/i.test(statusText);

  if (isPending) {
    issues.push({
      level: 'BLOCKER', code: 'STS-002',
      msg: `草稿狀態為 "${statusText}"，必須完成所有釐清項目後標記為 [x] DONE 才能進入 Gate`
    });
  } else if (!isDone) {
    issues.push({
      level: 'WARN', code: 'STS-003',
      msg: `草稿狀態不明確: "${statusText}"，建議使用 [x] DONE 或 [~] PENDING`
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
        level: 'WARN', code: 'DEPCON-001',
        msg: `[${moduleName}] 模組定義有依賴 [${moduleDeps.join(', ')}]，但迭代規劃表 deps 為「無」，建議同步`
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
          level: 'WARN', code: 'DEPCON-002',
          msg: `[${moduleName}] 模組依賴 [${moduleDeps.join(', ')}]，但動作清單所有 item 的 deps 都是「無」，建議標註具體依賴`
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
        msg: `[${modName}] Story 有 ${count} 個動作，超過上限 ${BLOCK_LIMIT}。請拆成多個 Story（不是多個 iter），每個 Story 建議 4-6 個動作`
      });
    } else if (count > WARN_LIMIT) {
      issues.push({
        level: 'WARN', code: 'BUDGET-002',
        msg: `[${modName}] Story 有 ${count} 個動作 (建議上限 ${WARN_LIMIT})，注意開發品質，必要時可拆為 Story-X.0 + Story-X.1`
      });
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
        if (!actionEvolutionMap[baseName]) {
          issues.push({
            level: 'WARN', code: 'EVO-002',
            msg: `[${modName}/${techName}] Modify 動作但找不到對應的 BASE 動作 "${baseName}"`
          });
        }
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

    for (const item of (actionData.items || [])) {
      const type = (item.type || '').toUpperCase();
      if (!['SVC', 'API', 'ROUTE'].includes(type)) continue;
      const techName = (item.techName || '').trim();
      if (techName && !apiFnNames.has(techName)) {
        issues.push({
          level: 'WARN', code: 'API-002',
          msg: `[${modName}] 動作 "${techName}" (${type}) 不在公開 API 列表中，是否為內部函式？`
        });
      }
    }
  }

  return issues;
}

/**
 * 16. Flow 精確度 — 偵測泛用 flow，要求 step 名稱有業務語意
 */
function checkFlowPrecision(draft, targetIter) {
  const issues = [];

  // 泛用 step 名稱黑名單 (全部都是這些 = 太模糊)
  const GENERIC_STEPS = new Set([
    'INIT', 'PROCESS', 'RETURN', 'START', 'END', 'EXECUTE',
    'INPUT', 'OUTPUT', 'HANDLE', 'RUN', 'DO', 'FINISH',
  ]);

  // 已知合理的型別定義 flow (CONST 類型允許泛用)
  const TYPE_FLOWS = new Set([
    'DEFINE→FREEZE→EXPORT',
    'DEFINE→VALIDATE→FREEZE→EXPORT',
    'DEFINE→VALIDATE→EXPORT',
  ]);

  for (const [modName, mod] of Object.entries(draft.moduleActions)) {
    if (mod.iter !== targetIter) continue;
    if (mod.fillLevel === 'stub' || mod.fillLevel === 'done') continue;

    for (const item of (mod.items || [])) {
      if (!item.flow) continue;
      const type = (item.type || '').toUpperCase();
      const flow = item.flow.trim();

      // CONST/LIB 類型允許已知的型別定義 flow
      if (['CONST', 'LIB'].includes(type) && TYPE_FLOWS.has(flow)) continue;

      const steps = flow.split('→').map(s => s.trim().toUpperCase());
      const genericCount = steps.filter(s => GENERIC_STEPS.has(s)).length;
      const prefix = `[${modName}/${item.techName}]`;

      // 如果所有 step 都是泛用詞彙 → BLOCKER
      if (genericCount === steps.length && steps.length > 0) {
        issues.push({
          level: 'BLOCKER', code: 'FLOW-010',
          msg: `${prefix} flow "${flow}" 全部是泛用步驟，缺乏業務語意。應改為具體步驟如 VALIDATE_INPUT→SERIALIZE_DATA→FORMAT_OUTPUT→RETURN`
        });
      }
      // 如果超過一半是泛用詞彙 → WARN
      else if (genericCount > steps.length / 2) {
        issues.push({
          level: 'WARN', code: 'FLOW-011',
          msg: `${prefix} flow "${flow}" 多數步驟為泛用名稱 (${genericCount}/${steps.length})，建議細化`
        });
      }
    }
  }

  return issues;
}

/**
 * 17. 公開 API 簽名完整性 — 公開 API 應包含參數型別和回傳型別
 */
function checkAPISignatureCompleteness(draft, targetIter) {
  const issues = [];

  for (const [modName, mod] of Object.entries(draft.modules)) {
    const apiList = mod.publicAPI || [];
    if (apiList.length === 0) continue;

    // 只檢查當前 iter 的模組
    const actionData = draft.moduleActions[modName];
    if (!actionData || actionData.iter !== targetIter) continue;
    if (actionData.fillLevel === 'stub' || actionData.fillLevel === 'done') continue;

    for (const apiLine of apiList) {
      const prefix = `[${modName}]`;

      // 檢查是否有參數括號
      if (!apiLine.includes('(')) {
        issues.push({
          level: 'WARN', code: 'SIG-001',
          msg: `${prefix} API "${apiLine}" 缺少參數簽名，建議寫成 functionName(param: Type): ReturnType`
        });
        continue;
      }

      // 檢查是否有回傳型別
      if (!apiLine.match(/\)\s*:\s*\w+/)) {
        issues.push({
          level: 'WARN', code: 'SIG-002',
          msg: `${prefix} API "${apiLine}" 缺少回傳型別，建議加上 ): ReturnType`
        });
      }

      // 檢查參數是否有型別標註
      const paramsMatch = apiLine.match(/\(([^)]*)\)/);
      if (paramsMatch && paramsMatch[1].trim()) {
        const params = paramsMatch[1].split(',').map(p => p.trim());
        for (const param of params) {
          if (param && !param.includes(':')) {
            issues.push({
              level: 'WARN', code: 'SIG-003',
              msg: `${prefix} API "${apiLine}" 參數 "${param}" 缺少型別標註`
            });
          }
        }
      }
    }
  }

  return issues;
}

/**
 * 19. AC 完整性 (v2.2) — P0/P1 動作的 AC 欄位不能空白
 * Gate 規則 ACC-001
 */
function checkACIntegrity(draft, targetIter) {
  const issues = [];

  for (const [modName, mod] of Object.entries(draft.moduleActions)) {
    if (mod.iter !== targetIter) continue;
    if (mod.fillLevel === 'stub' || mod.fillLevel === 'done') continue;

    for (const item of (mod.items || [])) {
      const p = (item.priority || '').toUpperCase();
      if (p !== 'P0' && p !== 'P1') continue;

      const ac = (item.ac || item['AC'] || '').trim();
      if (!ac || ac === '-' || ac === '無') {
        issues.push({
          level: 'BLOCKER',
          code: 'ACC-001',
          msg: `[${modName}/${item.techName}] P0/P1 動作缺少 AC 欄位。請在動作清單加入 AC 編號（如 AC-1.0），並在「驗收條件」區塊定義 Given/When/Then`
        });
      }
    }
  }

  return issues;
}

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

  // ── per-iter 聚合：收集每個 iter 的 type 組成 ──
  const iterTypes = {}; // { iterNum: { backend: bool, frontend: bool, modules: [] } }

  for (const [modName, mod] of Object.entries(draft.moduleActions)) {
    if (mod.fillLevel === 'done') continue;
    if (isFoundationModule(modName)) continue;

    const iterNum = mod.iter;
    if (!iterTypes[iterNum]) iterTypes[iterNum] = { backend: false, frontend: false, modules: [], isStub: false };

    const items = mod.items || [];
    const isStub = mod.fillLevel === 'stub';
    if (isStub) iterTypes[iterNum].isStub = true;
    iterTypes[iterNum].modules.push(modName);

    for (const item of items) {
      const t = (item.type || '').toUpperCase();
      if (BACKEND_TYPES.has(t)) iterTypes[iterNum].backend = true;
      if (FRONTEND_TYPES.has(t)) iterTypes[iterNum].frontend = true;
    }
  }

  // ── CURRENT iter：per-iter 聚合 WARN ──
  const currentIterData = iterTypes[targetIter];
  if (currentIterData && !currentIterData.isStub) {
    const { backend, frontend, modules } = currentIterData;
    const modList = modules.join(', ');

    if (backend && !frontend) {
      issues.push({
        level: 'WARN', code: 'VSC-002',
        msg: `iter-${targetIter} [${modList}] 只有後端 story，沒有前端層 (UI/ROUTE)。如果是刻意的純 API iter 可忽略，否則建議加入前端 story 讓使用者可操作`
      });
    }
    if (frontend && !backend) {
      issues.push({
        level: 'WARN', code: 'VSC-003',
        msg: `iter-${targetIter} [${modList}] 只有前端 story，沒有後端層 (SVC/API)。建議確認後端邏輯是否已在前一個 iter 完成`
      });
    }
  }

  // ── STUB iter：per-iter 聚合 WARN（設計草稿，不強制）──
  for (const [iterNum, data] of Object.entries(iterTypes)) {
    if (parseInt(iterNum) === targetIter) continue;
    if (!data.isStub) continue;
    const { backend, frontend, modules } = data;
    const modList = modules.join(', ');

    if (backend && !frontend) {
      issues.push({
        level: 'WARN', code: 'VSC-004',
        msg: `[Stub] iter-${iterNum} [${modList}] 目前只規劃了後端 story。建議在同一個 iter 加入前端 story，或確認前端會在後續 iter 補上`
      });
    }
    if (frontend && !backend) {
      issues.push({
        level: 'WARN', code: 'VSC-005',
        msg: `[Stub] iter-${iterNum} [${modList}] 目前只規劃了前端 story，缺少後端層。建議補上 SVC/API story`
      });
    }
  }

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
  checkFlowStepCount,
  checkFlowPrecision,
  checkAPIActionConsistency,
  checkAPISignatureCompleteness,
  checkDependencyCycles,
  checkIterationDAG,
  checkInfraSize,
  checkStubMinimum,
  checkPlanActionConsistency,
  checkLevelLimits,
  checkEvolutionLayers,
  checkDepsConsistency,
  checkIterModuleLoad,
  checkIterActionBudget,
  checkVerticalSliceCompleteness,
  checkACIntegrity,
};
