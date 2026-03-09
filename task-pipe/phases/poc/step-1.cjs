#!/usr/bin/env node
// [LEGACY] Task-Pipe route — 保留供有明確需求但無 POC 場景使用，非主推路線
/**
 * POC Step 1: 模糊消除 + 邏輯預檢
 * 輸入: requirement_draft_iter-X.md | 產物: 驗證過的 draft
 */
const fs = require('fs');
const path = require('path');
const { getOutputHeader } = require('../../lib/shared/output-header.cjs');
const { createErrorHandler, MAX_ATTEMPTS } = require('../../lib/shared/error-handler.cjs');
const { anchorOutput, anchorPass, anchorError, emitPass, emitBlock } = require('../../lib/shared/log-output.cjs');
const { getNextCmd, getRetryCmd, getPassCmd } = require('../../lib/shared/next-command-helper.cjs');

function run(options) {
  const { target, iteration = 'iter-1', fromDraft } = options;

  // 計算相對路徑（用於輸出指令，避免絕對路徑問題）
  const relativeTarget = path.relative(process.cwd(), target) || '.';

  // 初始化錯誤處理器
  const errorHandler = createErrorHandler('POC', 'step-1', null);
  const pocPath = path.join(target, `.gems/iterations/${iteration}/poc`);
  const draftPath = `${pocPath}/requirement_draft_${iteration}.md`;
  const relativeDraftPath = `.gems/iterations/${iteration}/poc/requirement_draft_${iteration}.md`;

  // 確保目錄存在
  if (!fs.existsSync(pocPath)) {
    fs.mkdirSync(pocPath, { recursive: true });
    // Bug fix: carry forward functions.json so blueprint-verify finds real function data
    const docsPath = path.join(target, '.gems/docs/functions.json');
    const pocFunctionsPath = path.join(pocPath, 'functions.json');
    if (fs.existsSync(docsPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(docsPath, 'utf8'));
        const fns = raw.functions || raw;
        if (Array.isArray(fns) && fns.length > 0) {
          fs.copyFileSync(docsPath, pocFunctionsPath);
        }
      } catch { /* skip if unreadable */ }
    }
  }

  // ============================================
  // 自動偵測：前一迭代的 iteration_suggestions
  // ============================================
  function detectPreviousSuggestions(targetDir, currentIteration) {
    const iterNum = parseInt(currentIteration.replace('iter-', ''));
    let suggestionFiles = [];
    let prevBuildPath = '';
    let prevIterNum = 0;

    // 1. 嘗試尋找標準的迭代建議 (Standard Suggestions)
    if (!isNaN(iterNum) && iterNum > 1) {
      prevIterNum = iterNum - 1;
      prevBuildPath = path.resolve(targetDir, `.gems/iterations/iter-${prevIterNum}/build`);

      if (fs.existsSync(prevBuildPath)) {
        const files = fs.readdirSync(prevBuildPath);
        suggestionFiles = files.filter(f => f.startsWith('iteration_suggestions_') && f.endsWith('.json'));
      }
    }

    // 2. 如果沒有標準建議 (可能是 iter-1 或 紀錄遺失)，嘗試 SCAN Fallback
    if (suggestionFiles.length === 0) {
      // Fallback: 嘗試讀取 SCAN Phase 的產出 (functions.json)
      // 這適用於沒有歷史迭代紀錄，但已有代碼庫的情況 (Cold Start / Lost Context)
      const scanDocsPath = path.join(targetDir, '.gems/docs/functions.json');
      if (fs.existsSync(scanDocsPath)) {
        try {
          const scanData = JSON.parse(fs.readFileSync(scanDocsPath, 'utf8'));
          if (scanData.functions && Array.isArray(scanData.functions)) {
            if (scanData.functions.length === 0) {
              // 如果掃描結果為空 (Greenfield Project)，則不視為 existing-codebase
              // 讓流程繼續往下走，去檢查是否有 requirement.md
              return null;
            }

            // 從 functions 提取模組名稱作為已完成項目
            const modules = new Set();
            scanData.functions.forEach(f => {
              // 嘗試解析檔名取得模組 (e.g., src/modules/auth/...)
              // 支援 Windows (\\) 與 POSIX (/) 路徑分隔符
              const moduleMatch = f.file && f.file.match(/modules[\\/]([^\\/]+)/);
              if (moduleMatch) {
                modules.add(`Module: ${moduleMatch[1]}`);
              } else {
                // 若無法識別模組，使用檔名
                const fileName = path.basename(f.file || 'unknown');
                modules.add(`File: ${fileName}`);
              }
            });

            return {
              prevIteration: 'existing-codebase',
              data: {
                completedItems: Array.from(modules).map(m => `[Detected] ${m}`),
                technicalHighlights: [`Detected ${scanData.totalCount} functions from scan report`],
                technicalDebt: [],
                suggestions: ['建議執行完整測試以建立基準'],
                nextIteration: {
                  suggestedGoal: '基於現有代碼庫進行迭代',
                  suggestedItems: []
                }
              }
            };
          }
        } catch (e) {
          console.warn('[WARN] 無法讀取 SCAN 報告:', e.message);
        }
      }
      return null;
    }

    // 讀取所有 suggestions 並合併
    const allSuggestions = {
      completedItems: [],
      technicalHighlights: [],
      technicalDebt: [],
      suggestions: [],
      nextIteration: null
    };

    for (const file of suggestionFiles) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(prevBuildPath, file), 'utf8'));
        if (content.completedItems) allSuggestions.completedItems.push(...content.completedItems);
        if (content.technicalHighlights) allSuggestions.technicalHighlights.push(...content.technicalHighlights);
        if (content.technicalDebt) allSuggestions.technicalDebt.push(...content.technicalDebt);
        if (content.suggestions) allSuggestions.suggestions.push(...content.suggestions);
        if (content.nextIteration && !allSuggestions.nextIteration) {
          allSuggestions.nextIteration = content.nextIteration;
        }
      } catch (e) {
        console.warn(`[WARN] 無法解析 ${file}:`, e.message);
      }
    }

    return {
      prevIteration: `iter-${prevIterNum}`,
      files: suggestionFiles,
      data: allSuggestions
    };
  }

  // ============================================
  // 雙軌偵測：是否有藍圖執行器的狀態 (Blueprint Runner State)
  // ============================================
  function detectBlueprintState(targetDir) {
    const statePath = path.join(targetDir, '.gems/blueprint_state.json');
    if (fs.existsSync(statePath)) {
      try {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        if (state.currentModule) {
          return {
            mode: 'BLUEPRINT',
            module: state.currentModule,
            iter: state.currentIter,
            phase: state.currentPhase
          };
        }
      } catch (e) {
        console.warn('[WARN] 無法讀取藍圖狀態:', e.message);
      }
    }
    return { mode: 'ITERATION' };
  }

  // ============================================
  // 自動偵測：專案根目錄是否有原始需求 .md 檔
  // ============================================
  function detectProjectRequest(targetDir) {
    if (!fs.existsSync(targetDir)) return null;

    const files = fs.readdirSync(targetDir);
    const mdFiles = files.filter(f => f.endsWith('.md') &&
      !f.startsWith('requirement_draft_') &&
      !f.toLowerCase().startsWith('readme') &&
      !f.toLowerCase().includes('instruction')
    );

    if (mdFiles.length > 0) {
      // 優先取符合條件的第一個 MD
      const fileName = mdFiles[0];
      return {
        fileName,
        content: fs.readFileSync(path.join(targetDir, fileName), 'utf8')
      };
    }
    return null;
  }

  // ============================================
  // 自動偵測：前一迭代的 iteration_suggestionsSCAN 結果產生 requirement_draft (支持反向藍圖)
  function generateDraftFromSuggestions(suggestions, projectName, iteration) {
    const today = new Date().toISOString().split('T')[0];
    const prevIter = suggestions.prevIteration;
    const data = suggestions.data;
    const isReverseFromScan = prevIter === 'existing-codebase';

    // 從 nextIteration 取得建議目標
    const suggestedGoal = data.nextIteration?.suggestedGoal || (isReverseFromScan ? '基於現有代碼繼續迭代' : '延續上次迭代的開發工作');
    const completionList = data.completedItems || [];

    // 嘗試從完成清單中推導模組
    const detectedModules = completionList
      .map(item => typeof item === 'string' ? item : (item.name || item.description || ''))
      .filter(item => typeof item === 'string' && item.startsWith('[Detected] Module:'))
      .map(item => item.replace('[Detected] Module: ', '').trim());

    return `# 📋 ${projectName} - 需求草稿 (${isReverseFromScan ? '反向還原藍圖' : '迭代傳承'})

**迭代**: ${iteration}  
**日期**: ${today}  
**狀態**: 🔄 待驗證
**前次來源**: ${prevIter}

---

${isReverseFromScan ? `## 🛡️ 竣工圖：現有系統工法分析
> [!] 偵測到已有代碼庫，AI 已自動還原目前的建築結構。` : `## 🚀 ${prevIter} 迭代傳承`}

### 🏗️ 模組化設計藍圖 (反向還原)

### 1. 族群識別 (推測)
| 族群名稱 | 描述 | 現有代碼關聯 |
|---------|------|---------|
| 預設使用者 | 系統主體功能 | 已實作於 ${detectedModules.length > 0 ? detectedModules[0] : '核心模組'} |
| {待識別族群} | 請根據業務邏輯手動修正 | {待對應} |

### 2. 已實作共用模組 (Shared)
- [x] 基礎建設 (types, config, utils)
${detectedModules.includes('shared') ? '- [x] Shared 核心工具' : '- [ ] 待提取共用組件'}
- [x] 現有功能：${completionList.slice(0, 3).join(', ')}

### 3. 現有模組分佈
${detectedModules.length > 0
        ? detectedModules.map(m => `#### 模組：${m}\n- 狀態: 已存在\n- 獨立功能:\n  - [x] 已實作相關邏輯`).join('\n')
        : '#### 模組：核心單體模組\n- 狀態: 待拆解'}

### 4. 路由結構 (推測)
\`\`\`
main.ts
└── router.ts
${detectedModules.map(m => `    └── /${m}/* (已偵測)`).join('\n')}
\`\`\`

---

## 本次迭代目標

> ${suggestedGoal}

---

## 釐清後需求 (基於現狀)

### 功能模組
- [x] 基礎建設 (延續 ${prevIter})
${data.nextIteration?.suggestedItems ? data.nextIteration.suggestedItems.map(item => `- [ ] ${item}`).join('\n') : '- [ ] 待定義新功能'}

### 技術債/改進建議
${data.suggestions.length > 0
        ? data.suggestions.map(s => `- [ ] ${typeof s === 'string' ? s : s.description}`).join('\n')
        : '- 無特別建議'}

---

## POC 驗證模式

**Level**: M

---

**草稿狀態**: [~] PENDING
<!-- 
此 Draft 由反向工程還原。
請確認「竣工圖」是否正確描述了現有系統架構。
確認後請將狀態改為 [OK] PASS 
-->
`;
  }


  // 從原始需求 MD 產生 requirement_draft (建築藍圖式)
  function generateDraftFromRequest(requestContent, requestFileName, iteration, blueprintState = {}) {
    const today = new Date().toISOString().split('T')[0];
    const projectName = requestFileName.replace('.md', '');
    const isBlueprint = blueprintState.mode === 'BLUEPRINT';
    const currentModule = blueprintState.module || '';

    // 解析原始需求內容
    const titleMatch = requestContent.match(/^# (.+)/m);
    const title = titleMatch ? titleMatch[1] : projectName;

    const objectiveMatch = requestContent.match(/(## 專案目標|## 需求描述)\s*\n+([\s\S]*?)(?=\n##|$)/);
    const objective = objectiveMatch ? objectiveMatch[2].trim() : requestContent.slice(0, 200).trim();

    const featuresMatch = requestContent.match(/## 功能需求\s*\n+([\s\S]*?)(?=\n##|$)/);
    const featuresText = featuresMatch ? featuresMatch[1].trim() : '';
    const features = featuresText.split('\n')
      .filter(l => l.trim().length > 0)
      .map(l => l.replace(/^[\d\-\*\.]\s*/, '').trim());

    return `# 📋 ${title}${isBlueprint ? ` [模組: ${currentModule}]` : ''} - 需求草稿 (建築藍圖提案)

**迭代**: ${iteration}  
**日期**: ${today}  
**狀態**: 🔄 待驗證 (AI 已根據${isBlueprint ? `藍圖模組: ${currentModule}` : '原始需求'}完成初步工法規劃)
${isBlueprint ? `**執行模式**: 📐 Blueprint Mode (${currentModule})\n` : ''}
---

## 🏗️ 模組化設計藍圖 (AI 提案)

> [!] 本藍圖由 AI 輔助設計，請確認「工法規格」是否符合預期。
${isBlueprint ? `> [!] 當前模組鎖定為: **${currentModule}**` : ''}

### 1. 族群識別
| 族群名稱 | 描述 | 特殊需求 |
|---------|------|---------|
| 主要使用者 | 核心功能使用者 | 需要穩定的資料存取與流暢 UI |
| {次要族群} | {例如：管理員或特定角色} | {描述其特殊業務邏輯} |

### 2. 共用模組 (Shared)
- [x] 基礎建設 (types, config, utils)
- [ ] 核心資料管理 (基於 LocalStorage 的 CRUD 模型)
- [ ] UI 組件庫 (符合現代審美與微動畫)

### 3. 獨立模組 (Isolated)

#### 模組：核心業務模組
- 依賴: 引入共用 CRUD
- 獨立功能:
${features.map(f => `  - [ ] ${f}`).join('\n')}

#### 模組：{特殊邏輯模組}
- 依賴: {描述依賴}
- 獨立功能:
  - [ ] {定義特定族群才需要的邏輯}

### 4. 路由結構規劃
\`\`\`
main.ts (入口)
└── router.ts (主路由)
    ├── /shared/* → 共用組件與邏輯
    └── /app/* → 核心業務模組路由
\`\`\`

---

## 釐清後需求 (傳統清單)

### 一句話目標
${title}：${objective.slice(0, 50)}...

### 功能模組清單
- [x] 基礎建設 (types, config)
- [x] 核心業務模組實作
- [ ] {特殊邏輯模組實作}

### 不做什麼
- 本迭代不做使用者登入功能
- 本迭代不做雲端同步功能
- 本迭代不做多語言支援

---

## 釐清項目

### 使用者角色
- [ ] 主要使用者：{填寫}

### 核心目標
- [x] 解決問題：提供高品質的 ${title} 方案
- [x] 預期效益：達成用戶原始需求描述之功能

### 資料結構
- [ ] 核心實體：{例：Note (id, content)}

---

## POC 驗證模式

**Level**: M

---

**草稿狀態**: [~] PENDING
<!-- 
AI 觀察：此 Draft 已根據原始需求自動填充藍圖。
請人類/高級 AI 檢視「🏗️ 模組化設計藍圖」是否正確。
確認無誤後請將狀態改為 [OK] PASS 
-->
`;
  }

  // ============================================
  // P2: --from-draft 匯入 Enhanced Draft → requirement_draft
  // 打通 Blueprint Flow → Task-Pipe Flow 的切換路徑
  // ============================================
  if (fromDraft) {
    const draftSourcePath = path.isAbsolute(fromDraft) ? fromDraft : path.resolve(process.cwd(), fromDraft);
    if (!fs.existsSync(draftSourcePath)) {
      console.log(getOutputHeader('POC', 'Step 1'));
      anchorOutput({
        context: `POC Step 1 | --from-draft 檔案不存在`,
        error: {
          type: 'BLOCKER',
          summary: `找不到 Enhanced Draft: ${fromDraft}`
        },
        output: `NEXT: 確認路徑後重新執行 --from-draft=<正確路徑>`
      }, {
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'poc',
        step: 'step-1'
      });
      return { verdict: 'BLOCKER', reason: 'from_draft_not_found' };
    }

    // 用 draft-parser 解析 Enhanced Draft
    try {
      const parser = require('../../../sdid-tools/lib/draft-parser-standalone.cjs');
      const parsed = parser.load(draftSourcePath);
      const stats = parser.calculateStats(parsed);
      const isEnhanced = parser.isEnhancedDraft(parsed);

      if (!isEnhanced) {
        console.log(getOutputHeader('POC', 'Step 1'));
        anchorOutput({
          context: `POC Step 1 | --from-draft 不是 Enhanced Draft`,
          error: {
            type: 'BLOCKER',
            summary: `檔案不是 Enhanced Draft 格式 (缺少迭代規劃表或模組動作清單)`
          },
          output: `NEXT: 確認檔案是 Enhanced Draft (活藍圖) 格式`
        }, {
          projectRoot: target,
          iteration: parseInt(iteration.replace('iter-', '')),
          phase: 'poc',
          step: 'step-1'
        });
        return { verdict: 'BLOCKER', reason: 'not_enhanced_draft' };
      }

      // 生成 requirement_draft
      const draftContent = convertEnhancedDraftToRequirementDraft(parsed, stats, iteration);
      fs.mkdirSync(pocPath, { recursive: true });
      fs.writeFileSync(draftPath, draftContent, 'utf8');

      console.log(getOutputHeader('POC', 'Step 1'));
      console.log(`@CONTEXT
[FROM-DRAFT] 已從 Enhanced Draft 匯入需求
來源: ${path.basename(draftSourcePath)}
Level: ${stats.level || 'M'} | 模組: ${stats.totalModules} | 動作: ${stats.totalActions}
產出: ${relativeDraftPath}
`);
      // 不 return，繼續往下走正常的 step-1 驗證流程
    } catch (err) {
      console.log(getOutputHeader('POC', 'Step 1'));
      anchorOutput({
        context: `POC Step 1 | --from-draft 解析失敗`,
        error: {
          type: 'BLOCKER',
          summary: `Enhanced Draft 解析錯誤: ${err.message}`
        },
        output: `NEXT: 先通過 Gate: node sdid-tools/blueprint/gate.cjs --draft=${fromDraft} --target=${relativeTarget}`
      }, {
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'poc',
        step: 'step-1'
      });
      return { verdict: 'BLOCKER', reason: 'from_draft_parse_error' };
    }
  }

  // 偵測藍圖狀態
  const blueprintState = detectBlueprintState(target);
  const isBlueprintMode = blueprintState.mode === 'BLUEPRINT';

  // 檢查 draft 是否存在
  if (!fs.existsSync(draftPath)) {
    // ===== 優先檢查：是否有前一迭代的 iteration_suggestions =====
    const prevSuggestions = detectPreviousSuggestions(target, iteration);

    if (prevSuggestions) {
      // 從 suggestions 產生 draft（迭代接力模式）
      const projectName = path.basename(target);
      const draftContent = generateDraftFromSuggestions(prevSuggestions, projectName, iteration, blueprintState);
      fs.writeFileSync(draftPath, draftContent);

      console.log(getOutputHeader('POC', 'Step 1'));
      anchorPass('POC', 'Step 1',
        `已從 ${prevSuggestions.prevIteration} 建議自動產生: ${relativeDraftPath}${isBlueprintMode ? ` (藍圖模式: ${blueprintState.module})` : ''}`,
        `node task-pipe/runner.cjs --phase=POC --step=1 --target=${relativeTarget} (再次執行以驗證)`, {
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'poc',
        step: 'step-1',
        info: {
          'Source': `iteration_suggestions from ${prevSuggestions.prevIteration}`,
          'Files': (prevSuggestions.files || []).join(', '),
          'Mode': blueprintState.mode,
          'Current Module': blueprintState.module || 'N/A'
        }
      });
      return { verdict: 'PENDING', autoGenerated: true, source: 'suggestions' };
    }

    // ===== 其次檢查：專案根目錄是否有原始需求 .md 檔 =====
    const projectRequest = detectProjectRequest(target);

    if (projectRequest) {
      // 找到原始需求，自動產生 requirement_draft
      const draftContent = generateDraftFromRequest(projectRequest.content, projectRequest.fileName, iteration, blueprintState);
      fs.writeFileSync(draftPath, draftContent);

      console.log(getOutputHeader('POC', 'Step 1'));
      anchorPass('POC', 'Step 1', `已自動產生: ${relativeDraftPath}${isBlueprintMode ? ` (針對模組: ${blueprintState.module})` : ''}`,
        `node task-pipe/runner.cjs --phase=POC --step=1 --target=${relativeTarget} (再次執行以驗證)`, {
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'poc',
        step: 'step-1',
        info: {
          'Mode': blueprintState.mode,
          'Module': blueprintState.module || 'N/A'
        }
      });
      return { verdict: 'PENDING', autoGenerated: true, source: 'request' };
    }

    // 沒有找到原始需求，輸出 BLOCKER + 模板存檔（建築藍圖式模組化設計模板）
    const templateContent = `# 📋 {專案名稱} - 需求草稿

**迭代**: ${iteration}  
**日期**: ${new Date().toISOString().split('T')[0]}  
**狀態**: 🔄 釐清中

---

## 用戶原始需求

> {貼上用戶原始需求，至少 50 字描述專案目標}
> 例如：建立一個用餐管理系統，讓養成、在職、代訓三種學員能夠管理用餐，包含新增、退伙、計費等功能。

---

## 釐清後需求

### 一句話目標
{用一句話描述這個專案要達成什麼，例如：讓不同族群的學員能高效管理各自的用餐需求}

---

## 🏗️ 模組化設計藍圖

<!-- 
[施工指南] 按照以下順序拆解需求：
1. 識別族群 → 誰會使用這個系統？有幾種角色？
2. 識別共用機制 → 哪些功能是所有族群都需要的？(通常是基礎 CRUD)
3. 識別獨立模組 → 哪些功能只有特定族群需要？(特殊業務邏輯)
4. 定義路由結構 → 模組如何透過 router 整合到 main？
-->

### 1. 族群識別
<!-- [!] 列出所有會使用此系統的角色/族群 -->
| 族群名稱 | 描述 | 特殊需求 |
|---------|------|---------|
| {族群 A} | {例如：養成班學員} | {例如：有退伙食費機制} |
| {族群 B} | {例如：在職班學員} | {例如：按月計費} |
| {臨時族群} | {例如：臨時搭伙人員} | {例如：按人頭計費，非訓期} |

### 2. 共用模組 (Shared)
<!-- [!] 所有族群都會使用的基礎功能 -->
- [x] 基礎建設 (types, config, utils)
- [ ] {共用功能，例如：用餐 CRUD（新增/查詢/修改/刪除）}
- [ ] {共用功能，例如：計價模式（基礎餐費計算）}

### 3. 獨立模組 (Isolated)
<!-- [!] 特定族群專屬的功能模組 -->

#### 模組：{族群A 模組}
- 依賴: {引入共用 CRUD}
- 獨立功能:
  - [ ] {例如：退伙食費機制}
  - [ ] {例如：訓期綁定計費}

#### 模組：{族群B 模組}  
- 依賴: {引入共用 CRUD}
- 獨立功能:
  - [ ] {例如：月結計費}

#### 模組：{臨時人員模組}
- 依賴: {獨立 CRUD，不共用}
- 獨立功能:
  - [ ] {例如：人頭計費（非訓期）}
  - [ ] {例如：臨時人員管理}

### 4. 路由結構規劃
<!-- [!] 描述模組如何整合到主路由 -->
\`\`\`
main.ts (入口)
└── router.ts (主路由)
    ├── /shared/* → 共用模組路由
    ├── /{族群A}/* → 族群A 模組路由  
    ├── /{族群B}/* → 族群B 模組路由
    └── /temp/* → 臨時人員模組路由
\`\`\`

---

## 功能模組清單
<!-- [!] 基於上方藍圖，列出本次迭代要實作的模組 -->
<!-- [!] 至少勾選 2 個（含基礎建設） -->
- [x] 基礎建設 (types, config)
- [ ] {具體模組名稱}
- [ ] {具體模組名稱}

### 不做什麼
- {明確排除項目，例如：本迭代不做使用者登入功能}
- {明確排除項目，例如：本迭代不做雲端同步功能}

---

## 釐清項目

### 使用者角色
- [ ] 主要使用者：{基於族群識別填寫}
- [ ] 次要使用者：{如有}

### 核心目標
- [ ] 解決問題：{具體描述}
- [ ] 預期效益：{具體描述}

### 資料結構
- [ ] 核心實體：{例如：Meal (id, userId, date, type, price)}
- [ ] 關聯實體：{例如：User (id, name, type, termId)}

### 邊界條件
- [ ] 資料量限制：{例如：單訓期最多 500 筆用餐紀錄}
- [ ] 同時操作：{例如：僅支援單人操作}

---

## POC 驗證模式

**Level**: {S/M/L}

---

**草稿狀態**: [~] PENDING
<!-- 完成所有釐清項目後，將上方狀態改為 [OK] PASS -->`;

    console.log(getOutputHeader('POC', 'Step 1'));
    anchorOutput({
      context: `🚀 建築藍圖已動土：啟動規畫\n產出: ${relativeDraftPath}`,
      task: [
        '✨ 歡迎來到新專案！AI 已為你準備好「建築藍圖模板」。',
        '',
        '📐 請執行以下啟動步驟：',
        '1. 閱讀 Draft 模板中的「施工指南」',
        '2. 識別族群、共用機制與獨立模組',
        '3. 定義初步路由結構',
        '',
        '✅ 填寫完成後重新執行此步驟，腳本會自動升級狀態為 PASS。'
      ],
      template: {
        content: templateContent,
        description: '建築藍圖式啟動模板'
      },
      output: `NEXT: node task-pipe/runner.cjs --phase=POC --step=1 --target=${relativeTarget}`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'poc',
      step: 'step-1'
    });
    return { verdict: 'PENDING', reason: 'initial_startup' };
  }

  // 讀取並檢查 draft
  let draft = fs.readFileSync(draftPath, 'utf8');

  // ============================================
  // 自動填充：如果 draft 是空骨架且專案根目錄有 .md 檔
  // ============================================
  const isEmptyScaffold = draft.includes('{專案名稱}') ||
    draft.includes('{貼上用戶原始需求}') ||
    draft.includes('{模組 1}') ||
    draft.includes('{填寫核心目標}');

  if (isEmptyScaffold) {
    // 優先檢查是否有前一迭代的建議
    const prevSuggestions = detectPreviousSuggestions(target, iteration);

    if (prevSuggestions) {
      console.log(getOutputHeader('POC', 'Step 1'));
      console.log(`@CONTEXT
[AUTO-DETECT] 偵測到前次迭代建議 (${prevSuggestions.prevIteration})
Draft 為空骨架，正在自動填充...
`);

      const projectName = path.basename(target);
      const draftContent = generateDraftFromSuggestions(prevSuggestions, projectName, iteration);
      fs.writeFileSync(draftPath, draftContent);
      draft = draftContent; // 更新 draft 變數繼續驗證

      console.log(`[OK] 已依據建議填充: ${relativeDraftPath}\n`);
    } else {
      const projectRequest = detectProjectRequest(target);
      if (projectRequest) {
        console.log(getOutputHeader('POC', 'Step 1'));
        console.log(`@CONTEXT
[AUTO-DETECT] 偵測到專案需求檔: ${projectRequest.fileName}
Draft 為空骨架，正在自動填充...
`);

        const draftContent = generateDraftFromRequest(projectRequest.content, projectRequest.fileName, iteration);
        fs.writeFileSync(draftPath, draftContent);
        draft = draftContent; // 更新 draft 變數繼續驗證

        console.log(`[OK] 已自動填充: ${relativeDraftPath}
`);
      }
    }
  }

  // ============================================
  // 強制注入：如果 Draft 存在但缺少前次建議（使用者手動建立或舊版）
  // ============================================
  const prevSuggestions = detectPreviousSuggestions(target, iteration);
  if (prevSuggestions) {
    const hasSuggestions = draft.includes('迭代傳承') || draft.includes('改進建議');
    if (!hasSuggestions) {
      console.log(getOutputHeader('POC', 'Step 1'));
      console.log(`@CONTEXT
[AUTO-FIX] 偵測到 Draft 缺少前次迭代建議 (${prevSuggestions.prevIteration})
正在強制寫入建議 (Hard Insert)...
`);

      const renderItem = (item) => {
        if (typeof item === 'string') return item;
        return item.description || item.name || JSON.stringify(item);
      };

      const suggestionBlock = `
---
## 🚀 ${prevSuggestions.prevIteration} 迭代傳承 (補)

### ✅ 已完成
${prevSuggestions.data.completedItems.length > 0
          ? prevSuggestions.data.completedItems.map(item => `- ${item.name || item}`).join('\n')
          : '- 無記錄'}

### 💡 改進建議
${prevSuggestions.data.suggestions.length > 0
          ? prevSuggestions.data.suggestions.map(s => `- [ ] ${renderItem(s)}`).join('\n')
          : '- 無特別建議'}

### 🔧 技術債
${prevSuggestions.data.technicalDebt.length > 0
          ? prevSuggestions.data.technicalDebt.map(d => `- [ ] ${renderItem(d)}`).join('\n')
          : '- 無技術債'}
`;
      // 插入到 "狀態: ... PASS" 之前，或者文件末尾
      if (draft.includes('**草稿狀態**')) {
        draft = draft.replace('**草稿狀態**', suggestionBlock + '\n**草稿狀態**');
      } else {
        draft += suggestionBlock;
      }
      fs.writeFileSync(draftPath, draft);

      console.log(`[OK] 已強制寫入建議至: ${relativeDraftPath}\n`);
    }
  }

  // 已通過則跳過（精確匹配狀態行，避免匹配到註釋）
  const passPattern = /\*\*狀態\*\*:\s*(\[OK\]|✅)?\s*PASS/i;
  const statusPassPattern = /\*\*草稿狀態\*\*:\s*(\[OK\]|✅)?\s*PASS/i;
  if (passPattern.test(draft) && statusPassPattern.test(draft)) {
    // 成功時重置 TACTICAL_FIX 計數
    errorHandler.resetAttempts();

    console.log(getOutputHeader('POC', 'Step 1'));
    anchorPass('POC', 'Step 1', `已完成: ${relativeDraftPath}`,
      `node task-pipe/runner.cjs --phase=POC --step=2 --target=${relativeTarget}`, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'poc',
      step: 'step-1'
    });
    return { verdict: 'PASS' };
  }

  // 檢查模糊消除是否完成
  const issues = checkDraft(draft);

  console.log(getOutputHeader('POC', 'Step 1'));
  console.log(`@CONTEXT
Step 1: 模糊消除
Draft: ${relativeDraftPath}
檢查: ${issues.length ? '[NEEDS CLARIFICATION] 需求不夠清晰' : 'OK 通過'}

@RULES
- 禁止腦補：模糊就問，不要猜
- 必須釐清：使用者角色、核心目標、資料結構
- 邏輯預檢：生命週期、邊界條件、依賴方向`);

  // ============================================
  // 蘇格拉底邏輯預檢（如果基本檢查通過）
  // ============================================
  if (issues.length === 0) {
    try {
      const { generateQuestions, formatQuestionsForCLI } = require('../../lib/bluemouse-adapter-v2.cjs');

      // 提取需求內容
      const requirementMatch = draft.match(/## 用戶原始需求[\s\S]*?(?=---)/);
      const goalMatch = draft.match(/##+ 一句話目標\s*\n+([^\n#]+)/);

      let requirement = '';
      if (requirementMatch) {
        requirement = requirementMatch[0].replace(/## 用戶原始需求\s*\n*>\s*/g, '').trim();
      }
      if (goalMatch) {
        requirement += ' ' + goalMatch[1].trim();
      }

      if (requirement.length > 20) {
        console.log('\n[蘇格拉底邏輯預檢] 正在生成關鍵決策問題...\n');

        const result = generateQuestions(requirement, 'zh-TW');

        if (result.questions && result.questions.length > 0) {
          console.log(formatQuestionsForCLI(result));
          console.log('請將答案補充到 requirement_draft 中，然後重新執行此步驟。\n');
        }
      }
    } catch (err) {
      // 蘇格拉底問題生成失敗不影響主流程
      console.log(`[蘇格拉底邏輯預檢] 跳過: ${err.message}\n`);
    }
  }

  if (issues.length) {
    // TACTICAL_FIX 機制：追蹤失敗次數
    const attempt = errorHandler.recordError('E1', issues.join('; '));

    // 檢查是否達到重試上限
    if (errorHandler.shouldBlock()) {
      anchorError('ARCHITECTURE_REVIEW',
        `建築深思：當前規畫需要人工架構師介入審閱 (${MAX_ATTEMPTS}/${MAX_ATTEMPTS})`,
        '引導建議: 進行 Code Review 並手動調整 Draft 結構',
        {
          details: `### POC Step 1 進入深度審閱模式
背景: 經過多次迭代，部分設計細節仍需人類智慧對齊。
待確認點: ${issues.join(', ')}`,
          projectRoot: target,
          iteration: parseInt(iteration.replace('iter-', '')),
          phase: 'poc',
          step: 'step-1'
        });
      return { verdict: 'BLOCKER', reason: 'tactical_fix_limit', attempts: MAX_ATTEMPTS, issues };
    }

    // 還有重試機會
    const recoveryLevel = errorHandler.getRecoveryLevel();

    // 根據 issues 生成具體的修復指引
    const fixHints = [];
    if (issues.some(i => i.includes('族群'))) {
      fixHints.push('✨ 精確化族群：為每個角色定義具體職責，有助於後續權限設計');
    }
    if (issues.some(i => i.includes('共用模組'))) {
      fixHints.push('✨ 抽象化共用：提取 Cross-cutting Concerns（如日誌、權限），增強系統複用性');
    }
    if (issues.some(i => i.includes('獨立模組'))) {
      fixHints.push('✨ 模組邊界：明確定義獨立模組的「職責邊界」，避免開發時產生高度耦合');
    }
    if (issues.some(i => i.includes('路由'))) {
      fixHints.push('✨ 路由映射：對接現實業務流程到 URL 結構，建立系統地圖');
    }
    if (issues.some(i => i.includes('佔位符'))) {
      fixHints.push('✨ 命名實例化：將模板佔位符轉化為真實的業務對象名稱');
    }
    if (issues.some(i => i.includes('使用者角色'))) {
      fixHints.push('→ 勾選並填寫「主要使用者」的具體描述');
    }
    if (issues.some(i => i.includes('核心目標'))) {
      fixHints.push('→ 勾選並填寫「解決問題」和「預期效益」');
    }

    anchorOutput({
      context: `📐 POC Step 1 | 建築規劃完善中`,
      error: {
        type: 'TACTICAL_FIX',
        summary: `待精確化點: ${issues.join(', ')}`,
        attempt,
        maxAttempts: MAX_ATTEMPTS
      },
      task: [
        `🎨 請在 ${relativeDraftPath} 中完善以上設計細節`,
        '',
        '🏛️ 架構師升級指引：',
        ...fixHints,
        '',
        '✅ 調整完成後重新執行此步驟，腳本會自動升級狀態為 PASS'
      ],
      output: `NEXT: node task-pipe/runner.cjs --phase=POC --step=1 --target=${relativeTarget}`
    }, {
      projectRoot: target,
      iteration: parseInt(iteration.replace('iter-', '')),
      phase: 'poc',
      step: 'step-1'
    });
    return { verdict: 'PENDING', attempt, issues };
  }

  // ============================================
  // 自動升級狀態：checkDraft 通過 → 腳本直接改 PASS
  // 避免 AI 手動改格式出錯的問題
  // ============================================
  draft = autoPromoteDraftStatus(draft);
  fs.writeFileSync(draftPath, draft, 'utf8');

  // 成功時重置 TACTICAL_FIX 計數
  errorHandler.resetAttempts();

  console.log(getOutputHeader('POC', 'Step 1'));
  anchorPass('POC', 'Step 1', `已完成: ${relativeDraftPath} (狀態已自動升級為 PASS)`,
    `node task-pipe/runner.cjs --phase=POC --step=2 --target=${relativeTarget}`, {
    projectRoot: target,
    iteration: parseInt(iteration.replace('iter-', '')),
    phase: 'poc',
    step: 'step-1'
  });
  return { verdict: 'PASS' };
}

/**
 * 自動升級 Draft 狀態為 PASS
 * 處理所有已知的狀態格式，避免 AI 手動改錯
 */
function autoPromoteDraftStatus(draft) {
  // 1. 草稿狀態行: **草稿狀態**: [~] PENDING → **草稿狀態**: [OK] PASS
  draft = draft.replace(
    /\*\*草稿狀態\*\*:\s*\[.*?\]\s*(PENDING|待驗證|釐清中)/gi,
    '**草稿狀態**: [OK] PASS'
  );

  // 2. 狀態行: **狀態**: 🔄 待驗證 → **狀態**: ✅ PASS
  draft = draft.replace(
    /\*\*狀態\*\*:\s*(🔄\s*)?(待驗證|PENDING|釐清中)(\s*\(.*?\))?/gi,
    '**狀態**: ✅ PASS'
  );

  return draft;
}

/**
 * P2: Enhanced Draft → requirement_draft 格式轉換
 * 從 Blueprint 的活藍圖提取需求，生成 Task-Pipe 的 requirement_draft
 */
function convertEnhancedDraftToRequirementDraft(parsed, stats, iteration) {
  const today = new Date().toISOString().split('T')[0];
  const title = parsed.title || '未命名專案';
  const level = stats.level || 'M';

  // 族群表格
  const groupRows = (parsed.groups || []).map(g => {
    const name = g['族群名稱'] || g['name'] || '';
    const desc = g['描述'] || g['description'] || '';
    const needs = g['特殊需求'] || g['needs'] || '';
    return `| ${name} | ${desc} | ${needs} |`;
  }).join('\n');

  // 共用模組
  const sharedItems = (parsed.sharedModules || []).map(s =>
    `- [${s.checked ? 'x' : ' '}] ${s.text}`
  ).join('\n') || '- [x] 基礎建設 (types, config, utils)';

  // 獨立模組
  const moduleBlocks = Object.entries(parsed.modules || {}).map(([name, mod]) => {
    const deps = (mod.deps || []).join(', ') || '無';
    const features = (mod.features || []).map(f =>
      `  - [${f.checked ? 'x' : ' '}] ${f.text}`
    ).join('\n') || '  - [ ] 待定義';
    return `#### 模組：${name}
- 依賴: [${deps}]
- 獨立功能:
${features}`;
  }).join('\n\n');

  // 路由結構
  const routes = parsed.routes || 'main.ts → router.ts → modules/*';

  // 功能清單
  const featureItems = (parsed.features || []).map(f =>
    `- [${f.checked ? 'x' : ' '}] ${f.text}`
  ).join('\n') || '- [x] 基礎建設\n- [ ] 核心功能';

  // 不做什麼
  const exclusions = (parsed.exclusions || []).map(e => `- ${e}`).join('\n') || '- 無特別排除';

  // 釐清項目
  const clarItems = Object.entries(parsed.clarifications || {}).map(([section, items]) => {
    const lines = items.map(i => `- [${i.checked ? 'x' : ' '}] ${i.text}`).join('\n');
    return `### ${section}\n${lines}`;
  }).join('\n\n');

  // 實體定義
  const entityBlocks = Object.entries(parsed.entities || {}).map(([name, fields]) => {
    const fieldLines = fields.map(f => {
      const fname = f['欄位'] || f['field'] || f['name'] || '';
      const ftype = f['型別'] || f['type'] || '';
      const fdesc = f['說明'] || f['description'] || '';
      return `  ${fname}: ${ftype}; // ${fdesc}`;
    }).join('\n');
    return `// @GEMS-CONTRACT: ${name}\ninterface ${name} {\n${fieldLines}\n}`;
  }).join('\n\n');

  return `# 📋 ${title} - 需求草稿 (從活藍圖匯入)

**迭代**: ${iteration}  
**日期**: ${today}  
**狀態**: 🔄 待驗證 (從 Enhanced Draft 自動匯入)
**來源**: Enhanced Draft (--from-draft)

---

## 用戶原始需求

> ${parsed.requirement || parsed.goal || '(從活藍圖匯入，請確認需求描述)'}

---

## 一句話目標

${parsed.goal || '(請從活藍圖確認目標)'}

---

## 🏗️ 模組化設計藍圖

### 1. 族群識別
| 族群名稱 | 描述 | 特殊需求 |
|---------|------|---------|
${groupRows || '| 主要使用者 | 核心功能使用者 | - |'}

### 2. 共用模組 (Shared)
${sharedItems}

### 3. 獨立模組 (Isolated)
${moduleBlocks || '#### 模組：核心模組\n- 依賴: [shared]\n- 獨立功能:\n  - [ ] 待定義'}

### 4. 路由結構規劃
\`\`\`
${routes}
\`\`\`

---

## 釐清後需求

### 功能模組清單
${featureItems}

### 不做什麼
${exclusions}

---

${entityBlocks ? `## 資料契約 (從活藍圖實體定義匯入)

\`\`\`typescript
${entityBlocks}
\`\`\`

---

` : ''}## 釐清項目

${clarItems || `### 使用者角色
- [x] 主要使用者：(從活藍圖族群識別匯入)

### 核心目標
- [x] 解決問題：${parsed.goal || '(待確認)'}
- [x] 預期效益：(待確認)

### 資料結構
- [${Object.keys(parsed.entities || {}).length > 0 ? 'x' : ' '}] 核心實體：${Object.keys(parsed.entities || {}).join(', ') || '(待定義)'}

### 邊界條件
- [ ] 資料量限制：(待定義)
- [ ] 同時操作：(待定義)`}

---

## POC 驗證模式

**Level**: ${level}

---

**草稿狀態**: [~] PENDING
<!-- 
此 Draft 從 Enhanced Draft (活藍圖) 自動匯入。
請確認內容是否正確，確認後腳本會自動升級狀態為 PASS。
-->
`;
}

function checkDraft(draft) {
  const issues = [];

  // ============================================
  // 1. 檢查是否有佔位符（未填寫的內容）
  // ============================================
  const placeholders = [
    '{專案名稱}', '{貼上用戶原始需求}', '{填寫核心目標}',
    '{模組 1}', '{模組 2}', '{具體功能名稱',
    '{具體描述', '{明確排除項目}', '{例如：',
    '{族群 A}', '{族群 B}', '{臨時族群}',
    '{族群A 模組}', '{族群B 模組}', '{臨時人員模組}',
    '{共用功能', '{引入共用', '{獨立 CRUD'
  ];
  const foundPlaceholders = placeholders.filter(p => draft.includes(p));
  if (foundPlaceholders.length > 0) {
    issues.push(`存在未填寫的佔位符: ${foundPlaceholders.join(', ')}`);
  }

  // ============================================
  // 2. 檢查模組化設計藍圖（如果存在）
  // ============================================
  if (draft.includes('## 🏗️ 模組化設計藍圖') || draft.includes('## 模組化設計藍圖')) {
    // 檢查族群識別表格是否有內容
    const groupTableMatch = draft.match(/### 1\. 族群識別[\s\S]*?(?=### 2\.|\n---)/);
    if (groupTableMatch) {
      const tableContent = groupTableMatch[0];
      // 檢查表格是否只有標題行和佔位符行
      const hasRealContent = tableContent.split('\n')
        .filter(line => line.includes('|') && !line.includes('---') && !line.includes('族群名稱'))
        .some(line => !line.includes('{族群') && line.replace(/\|/g, '').trim().length > 10);

      if (!hasRealContent) {
        issues.push('族群識別表格未填寫實際內容');
      }
    }

    // 檢查共用模組是否有勾選
    const sharedModuleMatch = draft.match(/### 2\. 共用模組[\s\S]*?(?=### 3\.|\n---)/);
    if (sharedModuleMatch) {
      const sharedContent = sharedModuleMatch[0];
      const checkedShared = (sharedContent.match(/- \[x\]/gi) || []).length;
      if (checkedShared < 1) {
        issues.push('共用模組至少需勾選 1 個');
      }
    }

    // 檢查獨立模組是否有定義
    const isolatedModuleMatch = draft.match(/### 3\. 獨立模組[\s\S]*?(?=### 4\.|\n---)/);
    if (isolatedModuleMatch) {
      const isolatedContent = isolatedModuleMatch[0];
      // 檢查是否有 "#### 模組：" 且內容不是佔位符
      const moduleDefMatch = isolatedContent.match(/#### 模組：([^\n]+)/g);
      if (!moduleDefMatch || moduleDefMatch.every(m => m.includes('{') && m.includes('}'))) {
        issues.push('獨立模組未定義實際模組名稱');
      }
    }

    // 檢查路由結構是否有規劃
    const routerMatch = draft.match(/### 4\. 路由結構規劃[\s\S]*?(?=\n---)/);
    if (routerMatch) {
      const routerContent = routerMatch[0];
      if (!routerContent.includes('main') && !routerContent.includes('router')) {
        issues.push('路由結構規劃未定義入口及路由');
      }
    }
  }

  // ============================================
  // 3. 檢查功能模組是否存在且有勾選
  // ============================================
  if (!/## (功能模組|Feature Modules|釐清後需求|功能模組清單)/.test(draft)) {
    issues.push('缺功能模組區塊');
  } else {
    const moduleSection = draft.match(/### (功能模組|Feature Modules)[\s\S]*?(?=###|---)/)?.[0] ||
      draft.match(/## (功能模組|Feature Modules|功能模組清單)[\s\S]*?(?=##|$)/)?.[0] || '';
    const checkedModules = (moduleSection.match(/- \[x\]/gi) || []).length;
    if (checkedModules < 2) issues.push('功能模組至少需勾選 2 個（含基礎建設）');

    // 檢查功能模組是否有實際內容（不是只有 [x]）
    // 注意：中文字元資訊密度高，4 個中文字 = 有意義的描述
    // 使用 cjkAwareLength 計算：CJK 字元算 2，ASCII 算 1
    const cjkAwareLength = (str) => {
      let len = 0;
      for (const ch of str) {
        len += /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(ch) ? 2 : 1;
      }
      return len;
    };
    const moduleLines = moduleSection.split('\n').filter(l => l.match(/- \[x\]/i));
    if (moduleLines.length > 0) {
      const shortModules = moduleLines.filter(l => cjkAwareLength(l.replace(/- \[x\]\s*/i, '').trim()) < 5);
      if (shortModules.length > 0) {
        issues.push('功能模組描述過於簡短');
      }
    }
  }

  // ============================================
  // 4. 檢查釐清項目是否完成（checkbox 是否勾選）
  // ============================================
  if (/- \[ \] (使用者角色|User Role|主要使用者)/.test(draft)) issues.push('缺使用者角色');
  if (/- \[ \] (核心目標|Core Goal|解決問題)/.test(draft)) issues.push('缺核心目標');
  if (/- \[ \] (資料結構|Data Structure|核心實體)/.test(draft)) issues.push('缺資料結構');
  if (/- \[ \] (邊界條件|Edge Cases|資料量限制)/.test(draft)) issues.push('缺邊界條件');

  // ============================================
  // 5. 檢查原始需求是否有實際內容
  // ============================================
  const requirementMatch = draft.match(/## 用戶原始需求[\s\S]*?(?=---)/);
  if (requirementMatch) {
    const requirementText = requirementMatch[0].replace(/## 用戶原始需求\s*\n*>\s*/g, '').trim();
    if (requirementText.length < 20) {
      issues.push('原始需求描述過短（至少 20 字）');
    }
  }

  // ============================================
  // 6. 檢查一句話目標是否有內容
  // ============================================
  // 支援 ## 或 ### 開頭的一句話目標
  const goalMatch = draft.match(/##+ 一句話目標\s*\n+([^\n#]+)/);
  if (goalMatch) {
    const goal = goalMatch[1].trim();
    if (goal.length < 10 || goal.includes('{')) {
      issues.push('一句話目標未填寫或過短');
    }
  } else {
    issues.push('缺少一句話目標');
  }

  // ============================================
  // 7. 檢查模糊用詞
  // ============================================
  if ((draft.match(/等等|之類|可能|大概|應該/g) || []).length > 2) {
    issues.push('用詞過於模糊');
  }

  // ============================================
  // 8. 檢查 Level 是否有效
  // ============================================
  // 支援 **Level**: 和 **POC Level**: 兩種格式
  const levelMatch = draft.match(/\*\*(POC )?Level\*\*:\s*([SML])/i);
  if (!levelMatch) {
    issues.push('POC 驗證模式 Level 未設定 (S/M/L)');
  }

  return issues;
}

// 自我執行判斷
if (require.main === module) {
  const args = process.argv.slice(2);
  let target = process.cwd();
  let iteration = 'iter-1';
  let fromDraft = null;

  // 簡單參數解析
  args.forEach(arg => {
    if (arg.startsWith('--target=')) target = arg.split('=')[1];
    if (arg.startsWith('--project-path=')) target = arg.split('=')[1];
    if (arg.startsWith('--iteration=')) iteration = arg.split('=')[1];
    if (arg.startsWith('--from-draft=')) fromDraft = arg.split('=').slice(1).join('=');
  });

  // 確保 target 是絕對路徑
  if (!path.isAbsolute(target)) {
    target = path.resolve(process.cwd(), target);
  }

  run({ target, iteration, fromDraft });
}

module.exports = { run };
