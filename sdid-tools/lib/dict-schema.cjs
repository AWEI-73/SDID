'use strict';

/**
 * SDID 2026 — GEMS 字典 Schema 定義與 Validator
 *
 * 字典位置: <project>/.gems/specs/*.json
 * 全域索引: <project>/.gems/specs/_index.json
 *
 * 每個 .gems/specs/*.json 管轄一個模組/檔案的函式群。
 * 格式: { "Domain.Action": { ...fields } }
 *
 * 欄位必填規則（依 priority）:
 *
 *   欄位                | P0  | P1  | P2  | P3
 *   ─────────────────────────────────────────
 *   priority            | ✅  | ✅  | ✅  | ✅
 *   targetFile          | ✅  | ✅  | ✅  | ✅
 *   lineRange           | ✅  | ✅  | ✅  | ✅
 *   signature           | ✅  | ✅  | ✅  | ✅
 *   description         | ✅  | ✅  | ✅  | ✅
 *   flow                | ✅  | ✅  | opt | opt
 *   steps               | ✅  | ✅  | opt | -
 *   deps                | ✅  | ✅  | opt | -
 *   depsRisk            | ✅  | ✅  | opt | -
 *   allowedImports      | ✅  | opt | -   | -
 *   test                | ✅  | ✅  | opt | -
 *   testFile            | ✅  | ✅  | opt | -
 *   storyRef            | ✅  | ✅  | ✅  | opt
 *   ac                  | ✅  | ✅  | -   | -
 *   status              | ✅  | ✅  | ✅  | ✅
 *   cynefinDomain       | 由 CYNEFIN-CHECK 寫入，不需手填
 */

// ──────────────────────────────────────────
// 常數
// ──────────────────────────────────────────

const VALID_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
const VALID_DEPS_RISK   = ['LOW', 'MEDIUM', 'HIGH'];
const VALID_CYNEFIN     = ['clear', 'complicated', 'complicated-costly', 'complex'];
const VALID_STATUS      = ['⬜', '🔧', '✓', '✓✓'];

const FLOW_MIN_STEPS = 3;
const FLOW_MAX_STEPS = 7;

// 泛用 step 名稱（不算具體，P0/P1 不能全是這些）
const GENERIC_STEPS = new Set([
  'Start', 'End', 'Return', 'Done', 'Process', 'Handle', 'Execute', 'Run', 'Call'
]);

// ──────────────────────────────────────────
// 主 validator
// ──────────────────────────────────────────

/**
 * 驗證單一字典條目
 * @param {string} gemsId   - 如 "Auth.Login"
 * @param {object} entry    - 字典 JSON 中的單一條目
 * @returns {{ pass: boolean, errors: string[], warnings: string[] }}
 */
function validateEntry(gemsId, entry) {
  const errors   = [];
  const warnings = [];
  const p        = entry.priority;

  // ── priority ──
  if (!p || !VALID_PRIORITIES.includes(p)) {
    errors.push(`[${gemsId}] priority 無效或缺失: "${p}"（需為 P0/P1/P2/P3）`);
    // 後續 priority-based 檢查無法繼續
    return { pass: false, errors, warnings };
  }

  // ── 所有 priority 必填 ──
  const always = ['targetFile', 'lineRange', 'signature', 'description', 'status'];
  for (const f of always) {
    if (!entry[f]) errors.push(`[${gemsId}] 缺少必填欄位: ${f}`);
  }

  if (entry.status && !VALID_STATUS.includes(entry.status)) {
    warnings.push(`[${gemsId}] status 不在建議清單: "${entry.status}"（建議: ⬜/🔧/✓/✓✓）`);
  }

  if (entry.lineRange && !/^L\d+-\d+$/.test(entry.lineRange)) {
    warnings.push(`[${gemsId}] lineRange 格式建議為 L{n}-{m}，現在是: "${entry.lineRange}"`);
  }

  // ── storyRef ──
  if (p === 'P0' || p === 'P1' || p === 'P2') {
    if (!entry.storyRef) errors.push(`[${gemsId}] P0/P1/P2 必須有 storyRef`);
  }

  // ── P0/P1 必填 ──
  if (p === 'P0' || p === 'P1') {
    const p01Required = ['flow', 'steps', 'deps', 'depsRisk', 'test', 'testFile', 'ac'];
    for (const f of p01Required) {
      if (!entry[f]) errors.push(`[${gemsId}] ${p} 必須有: ${f}`);
    }

    // flow 格式: A→B→C
    if (entry.flow) {
      _validateFlow(gemsId, entry.flow, errors, warnings);
    }

    // steps 數量要跟 flow 對得上
    if (entry.flow && entry.steps) {
      const flowSteps  = entry.flow.split('→').map(s => s.trim());
      const stepsKeys  = Object.keys(entry.steps);
      // Return 通常不需要 steps 說明，所以排除後比對
      const meaningful = flowSteps.filter(s => s !== 'Return');
      const missing    = meaningful.filter(s => !entry.steps[s]);
      if (missing.length > 0) {
        warnings.push(`[${gemsId}] steps 缺少 flow 中的步驟說明: ${missing.join(', ')}`);
      }
    }

    // deps
    if (entry.deps) {
      _validateDeps(gemsId, entry.deps, errors, warnings);
    }

    // depsRisk
    if (entry.depsRisk && !VALID_DEPS_RISK.includes(entry.depsRisk)) {
      errors.push(`[${gemsId}] depsRisk 無效: "${entry.depsRisk}"（需為 LOW/MEDIUM/HIGH）`);
    }

    // test
    if (entry.test) {
      const testFields = ['unit', 'integration', 'e2e'];
      for (const tf of testFields) {
        if (typeof entry.test[tf] !== 'boolean') {
          warnings.push(`[${gemsId}] test.${tf} 應為 boolean`);
        }
      }
    }

    // ac
    if (entry.ac) {
      _validateAC(gemsId, entry.ac, errors, warnings);
    }
  }

  // ── P0 額外必填 ──
  if (p === 'P0') {
    if (!Array.isArray(entry.allowedImports)) {
      errors.push(`[${gemsId}] P0 必須有 allowedImports（陣列，空陣列 [] 表示不允許任何外部 import）`);
    }
  }

  // ── cynefinDomain（選填，若有則驗格式）──
  if (entry.cynefinDomain && !VALID_CYNEFIN.includes(entry.cynefinDomain)) {
    warnings.push(`[${gemsId}] cynefinDomain 不在合法值: "${entry.cynefinDomain}"（合法: ${VALID_CYNEFIN.join('/')}）`);
  }

  return {
    pass: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 驗證整個字典檔案（一個 .gems/specs/*.json）
 * @param {object} dictFile - require() 進來的字典 JSON
 * @param {string} filePath - 字典檔案路徑（for 錯誤訊息）
 * @returns {{ pass: boolean, results: Array<{gemsId, pass, errors, warnings}> }}
 */
function validateDictFile(dictFile, filePath) {
  const results = [];

  for (const [gemsId, entry] of Object.entries(dictFile)) {
    if (gemsId === '$meta') continue; // 略過 meta 區塊
    const r = validateEntry(gemsId, entry);
    results.push({ gemsId, ...r });
  }

  const pass = results.every(r => r.pass);
  return { pass, filePath, results };
}

/**
 * 驗證 _index.json 格式
 * @param {object} index - _index.json 的內容
 * @returns {{ pass: boolean, errors: string[] }}
 */
function validateIndex(index) {
  const errors = [];

  for (const [gemsId, specPath] of Object.entries(index)) {
    if (gemsId === '$meta') continue;
    // gemsId 格式: Domain.Action
    if (!/^[A-Z][A-Za-z0-9]*\.[A-Z][A-Za-z0-9]*$/.test(gemsId)) {
      errors.push(`_index: gemsId 格式錯誤 "${gemsId}"（需為 Domain.Action，首字大寫）`);
    }
    // specPath 格式: specs/xxx.json
    if (typeof specPath !== 'string' || !specPath.startsWith('specs/') || !specPath.endsWith('.json')) {
      errors.push(`_index: "${gemsId}" 的 specPath 格式錯誤 "${specPath}"（需為 specs/xxx.json）`);
    }
  }

  return { pass: errors.length === 0, errors };
}

// ──────────────────────────────────────────
// 內部 helpers
// ──────────────────────────────────────────

function _validateFlow(gemsId, flow, errors, warnings) {
  const steps = flow.split('→').map(s => s.trim()).filter(Boolean);

  if (steps.length < FLOW_MIN_STEPS) {
    errors.push(`[${gemsId}] flow 步驟太少（${steps.length} 個，最少 ${FLOW_MIN_STEPS} 個）`);
  }
  if (steps.length > FLOW_MAX_STEPS) {
    errors.push(`[${gemsId}] flow 步驟太多（${steps.length} 個，最多 ${FLOW_MAX_STEPS} 個）`);
  }

  const allGeneric = steps.every(s => GENERIC_STEPS.has(s));
  if (allGeneric) {
    warnings.push(`[${gemsId}] flow 步驟全是泛用詞（${steps.join('→')}），建議改成業務語意`);
  }
}

function _validateDeps(gemsId, deps, errors, warnings) {
  for (const [dep, usage] of Object.entries(deps)) {
    // dep 格式: Category.Name（如 Database.tbl_users, Lib.bcrypt, Internal.mapFn）
    if (!/^[A-Z][A-Za-z0-9]*\./.test(dep)) {
      warnings.push(`[${gemsId}] deps key 建議格式為 Category.Name，現在是: "${dep}"`);
    }
    if (!usage || typeof usage !== 'string' || usage.trim() === '') {
      warnings.push(`[${gemsId}] deps["${dep}"] 缺少用途說明`);
    }
  }
}

function _validateAC(gemsId, ac, errors, warnings) {
  if (!Array.isArray(ac) || ac.length < 2) {
    errors.push(`[${gemsId}] ac 至少需要 2 條 Given/When/Then`);
    return;
  }

  let gwt = 0;
  for (const item of ac) {
    if (typeof item === 'string' && /Given.+When.+Then/i.test(item)) gwt++;
  }
  if (gwt < 2) {
    warnings.push(`[${gemsId}] ac 中符合 Given/When/Then 格式的條目不足 2 條`);
  }
}

// ──────────────────────────────────────────
// 格式文件（供 AI 參考）
// ──────────────────────────────────────────

const SCHEMA_EXAMPLE = {
  "Auth.Login": {
    "priority": "P0",
    "status": "⬜",
    "signature": "(req: Request, res: Response)→Promise<void>",
    "description": "驗證帳密並簽發 JWT",
    "targetFile": "src/modules/auth/services/auth-api.ts",
    "lineRange": "L3-45",
    "flow": "Validate→Query→Hash→Issue",
    "steps": {
      "Validate": "檢查 email 格式與必填欄位",
      "Query": "用 email 查 tbl_users",
      "Hash": "bcrypt compare 密碼",
      "Issue": "簽發 JWT，有效期 24h"
    },
    "deps": {
      "Database.tbl_users": "查詢使用者記錄",
      "Lib.bcrypt": "密碼雜湊比對",
      "Lib.jsonwebtoken": "JWT 簽發"
    },
    "depsRisk": "MEDIUM",
    "allowedImports": ["pg", "bcrypt", "jsonwebtoken"],
    "test": { "unit": true, "integration": true, "e2e": false },
    "testFile": "auth-api.test.ts",
    "storyRef": "Story-1.1",
    "ac": [
      "Given valid credentials, When login, Then return JWT with 24h expiry",
      "Given wrong password, When login, Then throw 401 AuthError"
    ]
  }
};

// ──────────────────────────────────────────
// exports
// ──────────────────────────────────────────

module.exports = {
  validateEntry,
  validateDictFile,
  validateIndex,
  SCHEMA_EXAMPLE,
  VALID_PRIORITIES,
  VALID_DEPS_RISK,
  VALID_CYNEFIN,
  FLOW_MIN_STEPS,
  FLOW_MAX_STEPS,
};
