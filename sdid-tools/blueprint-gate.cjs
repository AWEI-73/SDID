#!/usr/bin/env node
/**
 * Blueprint Gate v1.3 - 活藍圖品質門控
 * 
 * 驗證活藍圖 (Enhanced Draft v2) 的格式完整性、標籤完整性、
 * 依賴無循環、迭代 DAG、佔位符偵測、Stub 最低資訊檢查。
 * v1.1: 新增草稿狀態檢查、依賴一致性檢查、迭代負載檢查、Level 限制升級為 BLOCKER
 * v1.2: 新增公開 API↔動作清單一致性、Flow 精確度偵測、API 簽名完整性
 * v1.3: Budget 改為 per-Story (每 Story 最多 6 動作 WARN)，移除 per-iter 硬限制
 *       Level 限制改為 WARN（不再 BLOCKER），Foundation 必含 AppRouter 升為 BLOCKER
 *       動作清單新增 操作(NEW/MOD) 欄位支援
 * 
 * 獨立工具，不 import task-pipe。
 * 
 * 用法:
 *   node sdid-tools/blueprint-gate.cjs --draft=<path> [--iter=1] [--level=M]
 *   node sdid-tools/blueprint-gate.cjs --draft=<path> --strict
 * 
 * 輸出:
 *   @PASS — 藍圖品質合格，可進入 draft-to-plan
 *   @BLOCKER — 有結構性問題，必須修復
 *   @WARN — 有建議改善項目，但不阻擋
 */

const fs = require('fs');
const path = require('path');
const parser = require('./lib/draft-parser-standalone.cjs');
const logOutput = require('../task-pipe/lib/shared/log-output.cjs');

// ============================================
// 參數解析
// ============================================
function parseArgs() {
  const args = { draft: null, iter: null, level: 'M', strict: false, help: false, target: null };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--draft=')) args.draft = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg.startsWith('--iter=')) args.iter = parseInt(arg.split('=')[1]);
    else if (arg.startsWith('--level=')) args.level = arg.split('=')[1].toUpperCase();
    else if (arg.startsWith('--target=')) args.target = path.resolve(arg.split('=').slice(1).join('='));
    else if (arg === '--strict') args.strict = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

// ============================================
// 驗證器
// ============================================

/**
 * 1. 格式完整性 — 必要區塊是否存在
 */
function checkFormatCompleteness(draft) {
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

  return issues;
}

/**
 * 2. 佔位符偵測 — 檢查是否有未替換的 {placeholder}
 */
function checkPlaceholders(rawContent) {
  const issues = [];
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
 * 8. Stub 最低資訊檢查 — iter-2+ 的 Stub 必須有描述 + 依賴 + 預估
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
function checkLevelLimits(draft) {
  const issues = [];
  const level = draft.level || 'M';
  // 參考值，僅供提示
  const refStories = { S: 3, M: 8, L: 15 };
  const ref = refStories[level] || 8;

  const planModules = new Set(draft.iterationPlan.map(e => e.module));
  const actionModules = new Set(Object.keys(draft.moduleActions));
  const allModules = new Set([...planModules, ...actionModules]);
  const totalModules = allModules.size || parser.calculateStats(draft).totalModules;

  if (totalModules > ref * 1.5) {
    issues.push({
      level: 'WARN', code: 'LVL-001',
      msg: `Level ${level} 參考上限約 ${ref} 個模組，目前有 ${totalModules} 個，建議確認範圍是否合理`
    });
  }

  return issues;
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
 * 14. 單一迭代模組負載檢查 — 單一 iter 的模組數不應超過 Level 限制
 */
function checkIterModuleLoad(draft) {
  const issues = [];
  const level = draft.level || 'M';

  // 每個 iter 的建議模組上限
  const maxPerIter = { S: 2, M: 3, L: 4 };
  const limit = maxPerIter[level] || 3;

  // 統計每個 iter 的模組數
  const iterModules = {};
  for (const entry of draft.iterationPlan) {
    if (!iterModules[entry.iter]) iterModules[entry.iter] = [];
    iterModules[entry.iter].push(entry.module);
  }

  for (const [iter, modules] of Object.entries(iterModules)) {
    if (modules.length > limit) {
      issues.push({
        level: 'WARN', code: 'LOAD-001',
        msg: `iter-${iter} 有 ${modules.length} 個模組 [${modules.join(', ')}]，Level ${level} 建議每個 iter 最多 ${limit} 個，注意範圍蔓延`
      });
    }
  }

  return issues;
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
 * 18. 垂直切片完整性 (VSC) v1.0
 * 
 * 每個非 Foundation 的模組 (Story X.1+) 必須同時包含完整的垂直層次。
 * 不能只有技術零件卻沒有路由 — 否則 MVP 跑完使用者看不到東西。
 * 
 * Foundation (X.0) 規則：建議有 ROUTE (App 骨架路由殼)
 * Feature (X.1+) 規則：
 *   - 必須有 ROUTE (使用者如何進入)
 *   - 必須有 SVC 或 API (業務邏輯)
 *   - 如果有 HOOK/UI，必須有 UI (前端展示)
 */
function checkVerticalSliceCompleteness(draft, targetIter) {
  const issues = [];

  const isFoundationModule = (name) => {
    const lower = name.toLowerCase();
    return lower === 'shared' || lower.includes('foundation') || lower.includes('infra') || lower.includes('config');
  };

  for (const [modName, mod] of Object.entries(draft.moduleActions)) {
    if (mod.fillLevel === 'stub' || mod.fillLevel === 'done') continue;
    if (mod.iter !== targetIter) continue;

    const items = mod.items || [];
    const types = new Set(items.map(i => (i.type || '').toUpperCase()));
    const prefix = `[${modName}]`;

    if (isFoundationModule(modName)) {
      // Foundation 模組：必須有 App 骨架路由殼 (v1.3: 升為 BLOCKER)
      if (!types.has('ROUTE') && !types.has('APP') && items.length > 0) {
        issues.push({
          level: 'BLOCKER', code: 'VSC-001',
          msg: `${prefix} Foundation 模組必須包含 ROUTE 類型的前端主入口殼 (AppRouter/Layout)，確保 npm run dev 可看到首頁框架。請在動作清單加入: | 前端主入口殼 | ROUTE | AppRouter | P1 | CHECK_AUTH→LOAD_LAYOUT→RENDER_ROUTES | ... |`
        });
      }
    } else {
      // 功能模組 (X.1+)：必須有完整垂直切片層
      const missingLayers = [];

      if (!types.has('ROUTE')) {
        missingLayers.push('ROUTE (使用者進入點，如 /timer 路徑或 AppRoute)');
      }
      if (!types.has('SVC') && !types.has('API')) {
        missingLayers.push('SVC 或 API (業務邏輯層)');
      }
      const hasFrontend = types.has('HOOK') || types.has('UI') || types.has('ROUTE');
      if (hasFrontend && !types.has('UI')) {
        missingLayers.push('UI (前端展示層)');
      }

      if (missingLayers.length > 0) {
        issues.push({
          level: 'BLOCKER', code: 'VSC-002',
          msg: `${prefix} 功能模組缺少垂直切片層次: ${missingLayers.join(' | ')} — 每個 Story 必須可被使用者實際使用`
        });
      }

      // VSC-003: 交付類型必須為 FULL（前後端一套）
      const planEntry = draft.iterationPlan.find(
        e => e.module === modName && e.iter === mod.iter
      );
      if (planEntry) {
        const delivery = (planEntry.delivery || 'FULL').toUpperCase();
        if (delivery === 'BACKEND' || delivery === 'FRONTEND') {
          issues.push({
            level: 'BLOCKER', code: 'VSC-003',
            msg: `${prefix} 功能模組交付類型為 "${delivery}"，必須為 "FULL"（前後端一套）。不可將前後端拆到不同 iter`
          });
        }
      }
    }
  }

  return issues;
}

// ============================================
// 報告生成
// ============================================
function generateReport(draft, allIssues, args) {
  const stats = parser.calculateStats(draft);
  const blockers = allIssues.filter(i => i.level === 'BLOCKER');
  const warns = allIssues.filter(i => i.level === 'WARN');
  const passed = blockers.length === 0;

  // 嚴格模式：WARN 也算 FAIL
  const finalPass = args.strict ? (allIssues.length === 0) : passed;

  // 推導 projectRoot (從 --target 或從 draft 路徑推導)
  const projectRoot = args.target || inferProjectRoot(args.draft);
  const logOptions = projectRoot ? {
    projectRoot,
    iteration: args.iter || 1,
    phase: 'gate',
    step: 'check',
  } : {};

  // 用迭代規劃表 + 動作清單的聯集計算真實模組數
  const planModules = new Set(draft.iterationPlan.map(e => e.module));
  const actionModules = new Set(Object.keys(draft.moduleActions));
  const allModules = new Set([...planModules, ...actionModules]);
  const realModuleCount = allModules.size || stats.totalModules;

  // 組合詳情內容 (存檔用)
  const detailLines = [
    `📐 Blueprint Gate v1.1`,
    `藍圖: ${path.basename(args.draft)}`,
    `Level: ${stats.level || '?'} | 模組: ${realModuleCount} | 動作: ${stats.totalActions} | 迭代: ${stats.totalIterations}`,
    `目標 iter: ${args.iter || 'auto'}`,
    `嚴格模式: ${args.strict ? '是' : '否'}`,
    '',
  ];

  if (blockers.length > 0) {
    detailLines.push(`❌ BLOCKER (${blockers.length}):`);
    for (const b of blockers) {
      detailLines.push(`  [${b.code}] ${b.msg}`);
      detailLines.push(`    修復: ${getFixGuidance(b.code)}`);
    }
    detailLines.push('');
  }
  if (warns.length > 0) {
    detailLines.push(`⚠️ WARN (${warns.length}):`);
    for (const w of warns) {
      detailLines.push(`  [${w.code}] ${w.msg}`);
    }
    detailLines.push('');
  }
  if (allIssues.length === 0) {
    detailLines.push('✅ 零問題，藍圖品質優秀');
  }

  const details = detailLines.join('\n');

  if (finalPass) {
    const nextCmd = `node sdid-tools/draft-to-plan.cjs --draft=${args.draft} --iter=${args.iter || 1} --target=<project>`;
    const summary = `Blueprint Gate 通過 (${blockers.length} blocker, ${warns.length} warn)`;

    if (projectRoot) {
      logOutput.anchorPass('gate', 'check', summary, nextCmd, logOptions);
    } else {
      logOutput.outputPass(nextCmd, summary);
    }
  } else {
    const nextCmd = `修復藍圖後重跑: node sdid-tools/blueprint-gate.cjs --draft=${args.draft}${args.iter ? ' --iter=' + args.iter : ''}`;
    const summary = `Blueprint Gate 失敗 — ${blockers.length} 個結構性問題必須修復`;

    if (projectRoot) {
      logOutput.anchorError('BLOCKER', summary, nextCmd, {
        ...logOptions,
        details,
      });
    } else {
      logOutput.outputError({
        type: 'BLOCKER',
        summary,
        nextCommand: nextCmd,
        details,
      });
    }
  }

  return { passed: finalPass, blockers: blockers.length, warns: warns.length, issues: allIssues };
}

/**
 * 從 draft 路徑推導 projectRoot
 * 例: /project/.gems/iterations/iter-1/poc/requirement_draft_iter-1.md → /project
 */
function inferProjectRoot(draftPath) {
  if (!draftPath) return null;
  const normalized = path.resolve(draftPath);
  const gemsIdx = normalized.indexOf(path.join('.gems', 'iterations'));
  if (gemsIdx > 0) {
    return normalized.substring(0, gemsIdx).replace(/[/\\]$/, '');
  }
  return null;
}

/**
 * 修復指引
 */
function getFixGuidance(code) {
  const guidance = {
    'FMT-001': '在藍圖中加入「## 一句話目標」區塊，至少 10 字描述 MVP 目標',
    'FMT-005': '加入「### 4. 獨立模組」區塊，定義至少一個模組',
    'FMT-006': '加入「## 📅 迭代規劃表」表格，定義 iter/範圍/目標/模組/交付/依賴/狀態',
    'FMT-007': '加入「## 📋 模組動作清單」區塊，定義每個 iter 的動作表格',
    'TAG-001': '動作清單中每一行都必須有「技術名稱」欄位 (函式名或型別名)',
    'TAG-002': '優先級必須是 P0/P1/P2/P3 其中之一',
    'TAG-003': '流向欄位必須有 3-7 個步驟，用 → 分隔 (例: INIT→PROCESS→RETURN)',
    'PH-001': '替換所有 {placeholder} 為實際內容',
    'DEP-001': '重新安排模組依賴，消除循環引用',
    'DAG-001': '確保每個 iter 只依賴更早 iter 的模組',
    'CONS-001': '為迭代規劃表中的每個模組加入對應的動作清單',
    'EVO-001': '演化層依賴違規: 低層動作不能依賴高層動作，調整依賴方向或演化層標記',
    'EVO-002': 'Modify 動作需要對應的 BASE 動作存在，確認基礎函式已定義',
    'STS-002': '完成所有釐清項目後，將「草稿狀態」從 [~] PENDING 改為 [x] DONE',
    'LVL-001': '模組數超過參考值，確認範圍是否合理，或升級 Level (S→M 或 M→L)',
    'DEPCON-001': '同步迭代規劃表的「依賴」欄位，與模組定義的 deps 保持一致',
    'DEPCON-002': '在動作清單的 deps 欄位標註具體依賴 (例: [Shared.CoreTypes])',
    'LOAD-001': '將部分模組移到下一個 iter，或升級 Level 以容納更多模組',
    'API-001': '確保公開 API 列出的每個函式在動作清單中都有對應的 techName 行',
    'API-002': '如果是內部函式，從公開 API 移除；如果是公開函式，加入公開 API 列表',
    'FLOW-010': 'flow 步驟必須有業務語意，例如 VALIDATE_INPUT→SERIALIZE→FORMAT→RETURN，不能全部是 INIT→PROCESS→RETURN',
    'FLOW-011': '建議將泛用步驟替換為具體業務步驟，例如 INIT→PARSE_JSON→VALIDATE_SCHEMA→BUILD_OBJECTS→RETURN',
    'SIG-001': '公開 API 應寫成完整簽名: functionName(param: Type): ReturnType',
    'SIG-002': '公開 API 簽名應包含回傳型別，例如 ): Bookmark[] 或 ): ImportResult',
    'SIG-003': '公開 API 參數應標註型別，例如 (data: string, format: string)',
    'ACC-001': 'P0/P1 動作必須有 AC 欄位。在動作清單的 AC 欄填入編號（如 AC-1.0），並在「## ✅ 驗收條件」區塊定義 Given/When/Then',
    'BUDGET-001': 'Story 動作數超過上限 10。請拆成多個 Story（不是多個 iter），每個 Story 建議 4-6 個動作',
    'BUDGET-002': 'Story 動作數超過建議值 6，注意開發品質，必要時拆為 Story-X.0 + Story-X.1',
    'VSC-001': 'Foundation 模組必須加入 ROUTE 類型的前端主入口殼。在動作清單加入: | 前端主入口殼 | ROUTE | AppRouter | P1 | CHECK_AUTH→LOAD_LAYOUT→RENDER_ROUTES | [Internal.CoreTypes] | NEW | ○○ | BASE | AC-0.x |',
    'VSC-003': '功能模組的交付類型必須是 FULL（前後端一套）。將前後端合併到同一個 iter，確保每個 iter 都能展示完整功能',
  };
  return guidance[code] || '參考 enhanced-draft-golden.template.v2.md 修正格式';
}

// ============================================
// 主程式
// ============================================
function main() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
Blueprint Gate v1.1 - 活藍圖品質門控

用法:
  node sdid-tools/blueprint-gate.cjs --draft=<path> [--iter=1] [--level=M] [--target=<project>]

選項:
  --draft=<path>    活藍圖路徑 (必填)
  --iter=<N>        目標迭代 (預設: 自動偵測 [CURRENT])
  --level=<S|M|L>   檢查深度 (預設: M)
  --target=<path>   專案根目錄 (用於 log 存檔，可省略會自動推導)
  --strict          嚴格模式 (WARN 也算 FAIL)
  --help            顯示此訊息

驗證規則 (17 項):
  FMT-001~007  格式完整性
  PH-001       佔位符偵測
  STS-001~003  草稿狀態檢查 (v1.1)
  TAG-001~004  標籤完整性
  FLOW-001~002 Flow 步驟數
  FLOW-010~011 Flow 精確度 (v1.2 泛用 flow 偵測)
  API-001~002  公開 API ↔ 動作清單一致性 (v1.2)
  SIG-001~003  API 簽名完整性 (v1.2)
  DEP-001      依賴無循環
  DAG-001      迭代依賴 DAG
  SIZE-001     基礎設施拆分
  STUB-001~002 Stub 最低資訊
  CONS-001~002 規劃表↔動作清單一致性
  LVL-001      Level 限制 (v1.1 升級為 BLOCKER)
  EVO-001~002  演化層依賴
  DEPCON-001~002 依賴一致性 (v1.1)
  LOAD-001     迭代模組負載 (v1.1)
  BUDGET-001~002 迭代動作預算 (v1.3, per-Story: WARN>6/BLOCKER>10)
  VSC-001      Foundation 必含前端主入口殼 ROUTE (v1.3: 升為 BLOCKER)
  VSC-003      功能模組交付類型必須 FULL (v1.3)
  ACC-001      AC 驗收條件完整性 (v2.2, P0/P1 必填)

輸出:
  @PASS     — 品質合格 (log 存檔到 .gems/iterations/iter-X/logs/)
  @BLOCKER  — 結構性問題，必須修復
`);
    process.exit(0);
  }

  if (!args.draft) {
    console.error('❌ 請指定 --draft=<path>');
    process.exit(1);
  }

  // 讀取原始內容 (佔位符檢查用)
  const rawContent = fs.readFileSync(args.draft, 'utf8');

  // 解析藍圖
  const draft = parser.parse(rawContent);

  // 自動偵測目標 iter
  if (!args.iter) {
    args.iter = parser.getCurrentIter(draft);
  }

  // 執行所有驗證
  const allIssues = [
    ...checkFormatCompleteness(draft),
    ...checkPlaceholders(rawContent),
    ...checkDraftStatus(rawContent),
    ...checkTagIntegrity(draft, args.iter),
    ...checkFlowStepCount(draft, args.iter),
    ...checkFlowPrecision(draft, args.iter),
    ...checkAPIActionConsistency(draft, args.iter),
    ...checkAPISignatureCompleteness(draft, args.iter),
    ...checkDependencyCycles(draft),
    ...checkIterationDAG(draft),
    ...checkInfraSize(draft),
    ...checkStubMinimum(draft, args.iter),
    ...checkPlanActionConsistency(draft),
    ...checkLevelLimits(draft),
    ...checkEvolutionLayers(draft),
    ...checkDepsConsistency(draft, args.iter),
    ...checkIterModuleLoad(draft),
    ...checkIterActionBudget(draft),
    ...checkVerticalSliceCompleteness(draft, args.iter),
    ...checkACIntegrity(draft, args.iter),
  ];

  // 生成報告
  const result = generateReport(draft, allIssues, args);
  process.exit(result.passed ? 0 : 1);
}

// ============================================
// 導出 (供其他工具使用)
// ============================================
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
  getFixGuidance,
};

if (require.main === module) {
  main();
}
