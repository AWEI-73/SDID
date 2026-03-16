#!/usr/bin/env node
// [LEGACY] Task-Pipe route — 保留供有明確需求但無 POC 場景使用，非主推路線
/**
 * POC Step 5: 需求規格產出 (v2.0 - 防膨脹版)
 * 輸入: draft + Contract + POC | 產物: requirement_spec_iter-X.md
 */
const fs = require('fs');
const path = require('path');
const { getSimpleHeader } = require('../../lib/shared/output-header.cjs');
const { checkContentQuality } = require('../../tools/quality-check/content-quality-checker.cjs');
const { createErrorHandler, MAX_ATTEMPTS } = require('../../lib/shared/error-handler.cjs');
const { anchorOutput, anchorPass, anchorError, anchorErrorSpec, anchorTemplatePending, emitPass, emitFix, emitBlock } = require('../../lib/shared/log-output.cjs');
// v3.0: 引入欄位覆蓋解析
const { extractFieldCoverage } = require('../../tools/quality-check/poc-quality-checker.cjs');

// 等級限制配置
const LEVEL_CONSTRAINTS = {
    S: {
        description: 'Prototype - 能跑通 UI 原型即可',
        allowedPatterns: ['types', 'mock', 'basic-component'],
        forbiddenPatterns: ['axios-interceptor', 'shared-utils', 'complex-state', 'middleware'],
        story0Scope: '必要的資料型別與 Mock 資料',
        maxStories: 3,
    },
    M: {
        description: 'Standard - 專案骨架與基礎配置',
        allowedPatterns: ['types', 'config', 'api', 'service', 'hook'],
        forbiddenPatterns: ['complex-middleware', 'advanced-caching'],
        story0Scope: '專案骨架與基礎配置',
        maxStories: 6,
    },
    L: {
        description: 'Strict - 完整架構規範',
        allowedPatterns: ['*'],
        forbiddenPatterns: [],
        story0Scope: '完整基礎建設（types, config, shared, lib）',
        maxStories: 10,
    }
};

function run(options) {

    console.log(getSimpleHeader('POC', 'Step 5'));

    const { target, iteration = 'iter-1', level = 'S' } = options;
    const pocPath = `.gems/iterations/${iteration}/poc`;
    const specPath = `${pocPath}/requirement_spec_${iteration}.md`;
    const draftPath = path.join(target, pocPath, `requirement_draft_${iteration}.md`);

    // 初始化錯誤處理器
    const errorHandler = createErrorHandler('POC', 'step-5', null);

    // 取得等級限制
    const levelConfig = LEVEL_CONSTRAINTS[level.toUpperCase()] || LEVEL_CONSTRAINTS.S;

    // 檢查前置
    const has = {
        contract: hasFile(target, iteration, 'Contract.ts'),
        poc: hasFile(target, iteration, 'POC'),
        draft: fs.existsSync(draftPath),
    };

    // 找 Spec
    const specFile = findFile(target, [specPath, `.gems/iterations/${iteration}/requirement_spec_${iteration}.md`]);

    if (specFile) {
        const content = fs.readFileSync(specFile, 'utf8');
        const errors = validateSpec(content, levelConfig);
        const gateSpec = getGateSpec(content, levelConfig);

        if (errors.length) {
            // TACTICAL_FIX 機制
            const attempt = errorHandler.recordError('E2', errors.join('; '));

            if (errorHandler.shouldBlock()) {
                anchorErrorSpec({
                    targetFile: specFile,
                    missing: errors,
                    example: `## 1. 用戶故事
### Story 1.0: 基礎建設 [已驗證]
作為 開發者，我想要 建立專案基礎架構，以便於 後續功能開發。

## 3. 驗收標準
### AC-1.0
Given 開發者已完成專案初始化
When 執行專案建置命令
Then 建置過程應無任何錯誤訊息

## 4. 獨立可測性
- ✅ 驗證: 基礎建設
- ❌ 不驗證: 進階功能
- DEFERRED: 無

## 0. 範疇聲明 (Scope Declaration)
### 已驗證功能 (POC Verified)
- 列表顯示
### 延期功能 (DEFERRED)
- 無`,
                    nextCmd: `node task-pipe/runner.cjs --phase=POC --step=5`,
                    attempt: MAX_ATTEMPTS,
                    maxAttempts: MAX_ATTEMPTS,
                    gateSpec: gateSpec
                }, {
                    projectRoot: target,
                    iteration: parseInt(iteration.replace('iter-', '')),
                    phase: 'poc',
                    step: 'step-5'
                });
                return { verdict: 'BLOCKER', reason: 'tactical_fix_limit', attempts: MAX_ATTEMPTS };
            }

            anchorErrorSpec({
                targetFile: specFile,
                missing: errors,
                example: errors.includes('缺用戶故事')
                    ? `## 1. 用戶故事
### Story 1.0: 基礎建設 [已驗證]
作為 開發者，我想要 建立專案基礎架構，以便於 後續功能開發。`
                    : errors.includes('缺驗收標準')
                        ? `## 3. 驗收標準
### AC-1.0
Given 開發者已完成專案初始化
When 執行專案建置命令
Then 建置過程應無任何錯誤訊息`
                        : errors.includes('缺驗證狀態標註')
                            ? `### Story 1.0: 基礎建設 [已驗證]
> 驗證狀態: [已驗證] - POC 已實作

### Story 1.1: 新增功能 [計畫開發]
> 驗證狀態: [計畫開發] - 待本迭代實作`
                            : `## 0. 範疇聲明 (Scope Declaration)
### 已驗證功能 (POC Verified)
- 列表顯示
### 延期功能 (DEFERRED)
- 無`,
                nextCmd: `node task-pipe/runner.cjs --phase=POC --step=5`,
                attempt,
                maxAttempts: MAX_ATTEMPTS,
                gateSpec: gateSpec
            }, {
                projectRoot: target,
                iteration: parseInt(iteration.replace('iter-', '')),
                phase: 'poc',
                step: 'step-5'
            });

            return { verdict: 'BLOCKER', attempt };
        }

        // [NEW] 內容質量檢查 v2.0
        const qualityResult = checkContentQuality(content, specFile);

        if (qualityResult.quality === 'SKELETON') {
            const issuesContent = qualityResult.fixInstructions || qualityResult.issues.map((issue, idx) => {
                return `${idx + 1}. ${issue.message} ${issue.lineNumber ? `(Line ${issue.lineNumber})` : ''}`;
            }).join('\n');

            anchorError('ARCHITECTURE_REVIEW',
                `Spec 內容待加強 (質量評分: ${qualityResult.score})`,
                '建議：補充實質內容',
                {
                    details: `### 需要改進
${issuesContent}

✅ 改進建議:
- 每個 Story 必須有具體的角色名稱
- 每個 AC 必須有完整的 Given/When/Then
- 禁止保留 [角色]、[功能] 等佔位符

[!] 只允許修改: ${specFile}`,
                    projectRoot: target,
                    iteration: parseInt(iteration.replace('iter-', '')),
                    phase: 'poc',
                    step: 'step-5'
                });

            return { verdict: 'BLOCKER', qualityScore: qualityResult.score };
        }

        if (qualityResult.quality === 'POOR') {
            anchorOutput({
                context: `POC Step 5 | 質量警告`,
                warning: [`Spec 內容質量可改進 (評分: ${qualityResult.score}/100)`, '建議先改善內容質量'],
                guide: {
                    title: '改進建議',
                    content: qualityResult.issues.slice(0, 3).map((issue, idx) => `${idx + 1}. ${issue.message}`).join('\n')
                },
                output: `NEXT: 可繼續進入 PLAN，但建議先改善`
            }, {
                projectRoot: target,
                iteration: parseInt(iteration.replace('iter-', '')),
                phase: 'poc',
                step: 'step-5'
            });
        }

        // 成功時重置計數
        errorHandler.resetAttempts();

        // 直接跑 plan-generator（機械轉換，跳過 PLAN 5步驟）
        const nextCmd = `node task-pipe/tools/spec-to-plan.cjs --target=${target} --iteration=${iteration}`;

        anchorPass('POC', 'Step 5',
            `需求規格驗證通過 (評分: ${qualityResult.score}) — 5.5 函式規格表已就緒，直接轉換為 implementation_plan`,
            nextCmd,
            {
                projectRoot: target,
                iteration: parseInt(iteration.replace('iter-', '')),
                phase: 'poc',
                step: 'step-5',
                info: {
                  'File': specFile,
                  'Next': '機械轉換 spec → plan + ac.ts 骨架，跳過 PLAN 步驟',
                  'AC 提示': 'spec-to-plan 會自動產出 ac.ts 骨架（純計算函式），請填入 INPUT/EXPECT 後 Phase 2 才能機械驗收'
                }
            });

        return { verdict: 'PASS', qualityScore: qualityResult.score };
    }

    // 從 draft 提取功能模組
    let modules = [];
    if (has.draft) {
        const draft = fs.readFileSync(draftPath, 'utf8');
        modules = extractModules(draft);
    }

    // [A] 範疇剪枝: 分析 POC 實際驗證了什麼
    const pocAnalysis = analyzePocCoverage(target, iteration);

    // [B] 等級限制: 過濾不允許的模組
    const { allowed, deferred } = filterModulesByLevel(modules, levelConfig, pocAnalysis);

    // [C] 限制 Story 數量
    const finalModules = allowed.slice(0, levelConfig.maxStories - 1); // -1 for Story X.0
    const overflowModules = allowed.slice(levelConfig.maxStories - 1);

    // 轉換為字串陣列用於顯示
    const deferredNames = deferred.map(d => typeof d === 'string' ? d : d.name);
    const overflowNames = overflowModules.map(m => typeof m === 'string' ? m : m.name);

    const iterNum = iteration.replace('iter-', '');

    const templateContent = generateTemplate(target, iterNum, level, levelConfig, pocAnalysis, finalModules, deferredNames, overflowModules, deferred);

    // 黃金範例路徑
    const goldSpecPath = path.join(__dirname, '../../templates/examples/spec/requirement_spec_GOLD.md');
    const hasGoldExample = fs.existsSync(goldSpecPath);

    anchorOutput({
        context: `POC Step 5 | 需求規格產出 (Level: ${level.toUpperCase()})`,
        task: [
            '分析並產出需求規格書',
            '進行範疇剪枝與等級限制',
            '定義 User Stories 與驗收標準',
            '填寫具體內容 (禁止佔位符)'
        ],
        info: {
            'Pre-check': `POC ${has.poc ? 'OK' : 'WARN'} | Draft ${has.draft ? 'OK' : 'WARN'}`,
            'Level': `${levelConfig.description}`,
            'Story X.0 Scope': levelConfig.story0Scope,
            'Modules': finalModules.map(m => typeof m === 'string' ? m : `${m.name} ${m.verified ? '[已驗證]' : ''}`).join(', ')
        },
        guide: {
            title: hasGoldExample ? '品質要求 (請參考黃金範例)' : 'SCOPE_PRUNING',
            content: hasGoldExample ? `🏆 黃金範例: ${goldSpecPath}

品質要求:
- 禁止保留 {角色}、{功能}、{目標} 等佔位符
- 每個 Story 必須有具體的角色名稱
- 每個 AC 必須有至少 2 個 Gherkin 場景
- Given/When/Then 必須使用真實情境描述

POC Verified: ${formatList(pocAnalysis.verified)}
Deferred: ${deferredNames.join(', ') || '無'}` : `POC Verified: ${formatList(pocAnalysis.verified)}
Deferred: ${deferredNames.join(', ') || '無'}
Overflow: ${overflowNames.join(', ') || '無'}`
        },
        template: {
            title: 'requirement_spec 結構',
            content: templateContent
        },
        output: `NEXT: ${specPath}`
    }, {
        projectRoot: target,
        iteration: parseInt(iteration.replace('iter-', '')),
        phase: 'poc',
        step: 'step-5'
    });

    return { verdict: 'PENDING', modules: finalModules, deferred: [...deferred, ...overflowModules] };
}

function generateTemplate(target, iterNum, level, levelConfig, pocAnalysis, finalModules, deferredNames, overflowModules, deferred) {
    return `# 📦 ${path.basename(target)} - 需求規格書

**版本**: v1.0  
**日期**: ${new Date().toISOString().split('T')[0]}  
**Level**: ${level.toUpperCase()}  
**一句話願景**: [請根據專案目標填寫一句話描述]

> Status: READY FOR PLAN

---

## ⚠️ 重要提醒 - 請完整填寫以下內容

**禁止事項**:
- ❌ 禁止保留 [角色]、[功能]、[目標] 等佔位符
- ❌ 禁止只寫一行描述
- ❌ 禁止複製貼上模板而不修改

**必須要求**:
- ✅ 每個用戶故事必須有 **具體的角色名稱**
- ✅ 每個用戶故事必須描述 **具體的功能**
- ✅ 每個用戶故事必須說明 **明確的目標**
- ✅ 每個驗收標準的 Given/When/Then 必須有 **完整的情境描述**

---

## 0. 範疇聲明 (Scope Declaration)

### 已驗證功能 (POC Verified)
${pocAnalysis.verified.length > 0 ? pocAnalysis.verified.map(v => `- ${v}`).join('\n') : '- [請列出 POC 中已驗證的功能]'}

### 延期功能 (DEFERRED to iter-2)
${[...deferred, ...overflowModules].length > 0 ? [...deferred, ...overflowModules].map(d => `- ${typeof d === 'string' ? d : d.name}`).join('\n') : '- 無'}

---

## 1. 用戶故事

### Story ${iterNum}.0: 基礎建設 [已驗證]

作為 軟體開發團隊成員，我想要 建立完整的專案基礎架構（包含${levelConfig.story0Scope}），以便於 確保後續功能開發有穩定的技術基礎。

> 驗證狀態: [已驗證] - POC 基礎結構已實作

**驗收條件**:
- 專案結構符合 GEMS 規範
- 資料型別定義完整
- 基礎配置可正常運作

${finalModules.map((m, i) => `### Story ${iterNum}.${i + 1}: ${m.name} ${m.verified ? '[已驗證]' : '[計畫開發]'}

作為 [請填寫具體角色，例如：系統管理員]，我想要 [請填寫具體功能，例如：新增 ${m.name}]，以便於 [請填寫具體目標]。

> 驗證狀態: ${m.verified ? '[已驗證] - POC 已實作相關功能' : '[計畫開發] - 待本迭代實作'}

**功能細節**:
- [請列出此 Story 包含的具體功能點]`).join('\n\n')}

---

## 2. 資料契約

**核心資料實體**:
${pocAnalysis.contracts.length > 0 ? pocAnalysis.contracts.map(c => `- ${c}Contract.ts`).join('\n') : '- [請參照 POC 中定義的 Contract 檔案]'}

**欄位摘要**:
| 欄位名稱 | 型別 | 說明 |
|---------|------|------|
| id | string (UUID) | 唯一識別碼 |
| [請補充] | [型別] | [說明] |

---

## 2.5 欄位覆蓋規格 (v3.0)

\> 此區塊整合自 POC 的 @GEMS-FIELD-COVERAGE 標籤

| Module | Contract Fields | POC Fields (前端) | API-Only (後端) |
|--------|-----------------|-------------------|-----------------|
${pocAnalysis.fieldCoverage && pocAnalysis.fieldCoverage.length > 0
            ? pocAnalysis.fieldCoverage.map(fc => `| ${fc.module} | ${fc.contractFields.join(',')} | ${fc.pocFields.join(',')} | ${fc.apiOnly.join(',') || '-'} |`).join('\n')
            : '| [Module] | [Contract Fields] | [POC Fields] | [API-Only] |'}

**說明**:
- **POC Fields**: 前端 UI 會實作的欄位
- **API-Only**: 僅在後端 API 處理，前端不顯示的欄位

---

## 2.6 UI/UX 規範 (從 POC 繼承)

> 以下規範來自 POC 的 @GEMS-UI-BIND, @GEMS-CSS-LOCK 等標籤，**BUILD 階段必須嚴格遵守**。

### UI 狀態綁定 (@GEMS-UI-BIND)
${pocAnalysis.uiBindings && pocAnalysis.uiBindings.length > 0 ? pocAnalysis.uiBindings.map(b => `- ${b}`).join('\n') : '- 無'}

### CSS 樣式鎖定 (@GEMS-CSS-LOCK)
${pocAnalysis.cssLocks && pocAnalysis.cssLocks.length > 0 ? pocAnalysis.cssLocks.map(c => `- ${c}`).join('\n') : '- 無'}

### 動畫效果 (@GEMS-ANIMATION)
${pocAnalysis.animations && pocAnalysis.animations.length > 0 ? pocAnalysis.animations.map(a => `- ${a}`).join('\n') : '- 無'}

### 表單欄位規範 (@GEMS-FORM-SPEC)
${pocAnalysis.formSpecs && pocAnalysis.formSpecs.length > 0 ? pocAnalysis.formSpecs.join('\n\n') : '無'}

---

## 3. 驗收標準 (BDD 格式)

### AC-${iterNum}.0: 基礎建設

**獨立可測性**: 可在本地環境獨立驗證

\`\`\`gherkin
Given 開發者已完成專案初始化
When 執行專案建置命令
Then 建置過程應無任何錯誤訊息
\`\`\`

${finalModules.map((m, i) => `### AC-${iterNum}.${i + 1}: ${m.name}

**獨立可測性**: [請說明如何獨立驗證]

\`\`\`gherkin
Given [情境]
When [動作]
Then [預期結果]
\`\`\``).join('\n\n')}

---

## 4. 獨立可測性

- ✅ 驗證: ${pocAnalysis.verified.length > 0 ? pocAnalysis.verified.join(', ') : '[請列出本迭代要驗證的功能]'}
- ❌ 不驗證: [請列出明確排除的功能範圍]
- DEFERRED: ${deferredNames.join(', ') || '無'}

---

## 5. Story 拆分建議

| Story | 優先級 | 依賴 | 驗證狀態 |
|-------|--------|------|----------|
| ${iterNum}.0 基礎建設 | P0 | 無 | [已驗證] |
${finalModules.map((m, i) => `| ${iterNum}.${i + 1} ${m.name} | P${i === 0 ? 0 : 1} | Story ${iterNum}.0 | ${m.verified ? '[已驗證]' : '[計畫開發]'} |`).join('\n')}

---

## 5.5 函式規格表 (供 PLAN 直接讀取，勿刪)

> ⚠️ 此區塊由 AI 填寫後，spec-parser 直接讀取，不再推導。
> 格式：每行一個函式，欄位用 | 分隔。Type: SVC/ROUTE/UI/LIB/HOOK/CONST。Priority: P0/P1/P2。
> GEMS-FLOW 格式：來源 → 處理 → 目標（例：UI → SVC → storage）

| Story | 函式名稱 | Type | Priority | GEMS-FLOW | 說明 |
|-------|---------|------|---------|-----------|------|
| ${iterNum}.0 | CoreTypes | CONST | P0 | types → shared | 核心型別定義 |
| ${iterNum}.0 | MemoryStore | LIB | P0 | storage → local | 記憶體儲存層 |
${finalModules.map((m, i) => `| ${iterNum}.${i + 1} | [函式名稱] | [Type] | P0 | [來源 → 處理 → 目標] | [說明] |
| ${iterNum}.${i + 1} | [函式名稱] | [Type] | P1 | [來源 → 處理 → 目標] | [說明] |`).join('\n')}

---

## 6. 可行性評估 (Level ${level.toUpperCase()})

${finalModules.filter(m => !m.verified).length > 0 ? `### 計畫開發項目風險評估\n${finalModules.filter(m => !m.verified).map(m => `**${m.name}**: 技術風險與時程影響評估...`).join('\n')}` : '✅ 所有功能已在 POC 驗證，可直接進入開發階段。'}

---

**文件版本**: v1.0 | **產出日期**: ${new Date().toISOString().split('T')[0]}`;
}

function extractModules(draft) {
    const moduleSection = draft.match(/## 功能模組[\s\S]*?(?=##|$)/)?.[0] || '';
    const modules = [];
    const lines = moduleSection.split('\n');

    for (const line of lines) {
        // 匹配已勾選的項目: - [x] 模組名稱
        const match = line.match(/- \[x\]\s*(.+)/i);
        if (match) {
            const moduleName = match[1].trim();
            // 排除「基礎建設」，因為會自動加 Story X.0
            if (!/基礎建設|types|config/i.test(moduleName)) {
                modules.push(moduleName);
            }
        }
    }

    return modules;
}

/**
 * [A] 範疇剪枝: 分析 POC 實際驗證了什麼
 * 直接解析 POC HTML/TSX 中的 GEMS 標籤
 */
function analyzePocCoverage(target, iteration) {
    const result = {
        verified: [],      // 已驗證的功能
        unverified: [],    // 未驗證的功能 (從 @GEMS-VERIFIED 的 [ ] 項目)
        rawFeatures: [],   // 原始功能列表
        stories: [],       // @GEMS-STORY 標籤
        contracts: [],     // @GEMS-CONTRACT 標籤
        functions: [],     // @GEMS-FUNCTION 標籤
        zones: [],         // @GEMS-ZONE 標籤
        designBrief: [],   // @GEMS-DESIGN-BRIEF 內容
        fieldCoverage: [], // v3.0: @GEMS-FIELD-COVERAGE 欄位覆蓋
        uiBindings: [],    // [NEW] UI 綁定規範
        cssLocks: [],      // [NEW] CSS 鎖定規範
        formSpecs: [],     // [NEW] 表單規範
        animations: [],    // [NEW] 動畫規範
    };

    // 找 POC 檔案 (HTML, TSX, JSX)
    const pocDir = path.join(target, `.gems/iterations/${iteration}/poc`);
    if (!fs.existsSync(pocDir)) return result;

    const pocFiles = fs.readdirSync(pocDir).filter(f =>
        f.endsWith('POC.html') || f.endsWith('POC.tsx') || f.endsWith('POC.jsx')
    );

    for (const pocFile of pocFiles) {
        const content = fs.readFileSync(path.join(pocDir, pocFile), 'utf8');

        // 1. 解析 @GEMS-VERIFIED (最重要！)
        const verifiedMatch = content.match(/@GEMS-VERIFIED:[\s\S]*?(?=-->|@GEMS-|$)/);
        if (verifiedMatch) {
            const lines = verifiedMatch[0].split('\n');
            for (const line of lines) {
                // [x] 已驗證
                const checkedMatch = line.match(/- \[x\]\s*(.+)/i);
                if (checkedMatch) {
                    result.verified.push(checkedMatch[1].trim());
                }
                // [ ] 未驗證
                const uncheckedMatch = line.match(/- \[ \]\s*(.+)/i);
                if (uncheckedMatch) {
                    result.unverified.push(uncheckedMatch[1].trim());
                }
            }
        }

        // 2. 解析 @GEMS-STORY
        const storyMatches = content.matchAll(/@GEMS-STORY:\s*([^\n]+)/g);
        for (const match of storyMatches) {
            result.stories.push(match[1].trim());
        }

        // 3. 解析 @GEMS-CONTRACT
        const contractMatches = content.matchAll(/@GEMS-CONTRACT:\s*(\w+)/g);
        for (const match of contractMatches) {
            result.contracts.push(match[1].trim());
        }

        // 4. 解析 @GEMS-FUNCTION (格式: name | P[0-3] | Story-X.X)
        const funcMatches = content.matchAll(/@GEMS-FUNCTION:\s*([^\n|]+)/g);
        for (const match of funcMatches) {
            result.functions.push(match[1].trim());
        }

        // 5. 解析 @GEMS-ZONE
        const zoneMatches = content.matchAll(/@GEMS-ZONE:\s*\[?([^\]\n]+)\]?/g);
        for (const match of zoneMatches) {
            result.zones.push(match[1].trim());
        }

        // 6. 解析 @GEMS-DESIGN-BRIEF
        const briefMatch = content.match(/@GEMS-DESIGN-BRIEF:[\s\S]*?(?=@GEMS-|-->|$)/);
        if (briefMatch) {
            const features = briefMatch[0].match(/- .+/g) || [];
            result.designBrief.push(...features.map(f => f.replace(/^- /, '').trim()));
        }

        // 7. 解析 @GEMS-DESC
        const descMatches = content.matchAll(/@GEMS-DESC:\s*([^\n]+)/g);
        for (const match of descMatches) {
            result.rawFeatures.push(match[1].trim());
        }

        // 8. v3.0: 解析 @GEMS-FIELD-COVERAGE
        const fieldCoverage = extractFieldCoverage(content);
        if (fieldCoverage) {
            result.fieldCoverage.push(...fieldCoverage);
        }

        // 9. [NEW] 解析 UI/UX 規範
        // @GEMS-UI-BIND
        const uiBindMatch = content.match(/@GEMS-UI-BIND:[\s\S]*?(?=@GEMS-|-->|$)/);
        if (uiBindMatch) {
            result.uiBindings.push(...(uiBindMatch[0].match(/- .+/g) || []).map(s => s.replace(/^- /, '').trim()));
        }

        // @GEMS-CSS-LOCK
        const cssLockMatch = content.match(/@GEMS-CSS-LOCK:[\s\S]*?(?=@GEMS-|-->|$)/);
        if (cssLockMatch) {
            result.cssLocks.push(...(cssLockMatch[0].match(/- .+/g) || []).map(s => s.replace(/^- /, '').trim()));
        }

        // @GEMS-FORM-SPEC
        const formSpecMatch = content.match(/@GEMS-FORM-SPEC:[\s\S]*?(?=@GEMS-|-->|$)/);
        if (formSpecMatch) {
            result.formSpecs.push(formSpecMatch[0].split('\n').slice(1).join('\n').trim());
        }

        // @GEMS-ANIMATION
        const animMatch = content.match(/@GEMS-ANIMATION:[\s\S]*?(?=@GEMS-|-->|$)/);
        if (animMatch) {
            result.animations.push(...(animMatch[0].match(/- .+/g) || []).map(s => s.replace(/^- /, '').trim()));
        }
    }

    // 同時檢查 Contract 檔案
    const contractFiles = fs.readdirSync(pocDir).filter(f => f.endsWith('Contract.ts'));
    for (const contractFile of contractFiles) {
        const content = fs.readFileSync(path.join(pocDir, contractFile), 'utf8');
        const contractMatches = content.matchAll(/@GEMS-CONTRACT:\s*(\w+)/g);
        for (const match of contractMatches) {
            if (!result.contracts.includes(match[1].trim())) {
                result.contracts.push(match[1].trim());
            }
        }
    }

    // 如果沒有 @GEMS-VERIFIED，fallback 到舊邏輯
    if (result.verified.length === 0) {
        // 如果有 @GEMS-STORY，表示該 Story 已驗證
        result.verified.push(...result.stories);

        // 如果有 @GEMS-FUNCTION，表示該功能已驗證
        result.verified.push(...result.functions);

        // 如果有 @GEMS-ZONE，表示該 UI 區塊已驗證
        result.verified.push(...result.zones);

        // 如果有 @GEMS-CONTRACT，表示資料結構已驗證
        if (result.contracts.length > 0) {
            result.verified.push('資料契約');
        }

        // 基本互動檢測 (fallback)
        for (const pocFile of pocFiles) {
            const content = fs.readFileSync(path.join(pocDir, pocFile), 'utf8');

            if (/onclick|onchange|onsubmit|addEventListener/i.test(content)) {
                if (!result.verified.includes('UI 互動邏輯')) {
                    result.verified.push('UI 互動邏輯');
                }
            }

            if (/MOCK_DATA|mockData|sampleData/i.test(content)) {
                if (!result.verified.includes('Mock 資料結構')) {
                    result.verified.push('Mock 資料結構');
                }
            }
        }
    }

    // 去重
    result.verified = [...new Set(result.verified)];
    result.unverified = [...new Set(result.unverified)];
    result.contracts = [...new Set(result.contracts)];

    return result;
}

/**
 * [B] 等級限制: 根據 Level 過濾模組
 * 
 * 驗證邏輯（優先順序）：
 * 1. 如果有 @GEMS-VERIFIED，直接使用（最可靠）
 * 2. 如果模組名稱出現在 @GEMS-STORY 標籤中 → 已驗證
 * 3. 如果模組名稱與 @GEMS-FUNCTION 有關聯 → 已驗證
 * 4. 關鍵詞重疊檢查
 * 5. 其他 → 未驗證，Level S 下會被 DEFERRED
 */
function filterModulesByLevel(modules, levelConfig, pocAnalysis) {
    const allowed = [];
    const deferred = [];

    // 所有 POC 驗證內容的關鍵詞
    const verifiedKeywords = pocAnalysis.verified.flatMap(v => extractKeywords(v));

    for (let i = 0; i < modules.length; i++) {
        const moduleName = modules[i];
        const moduleObj = { name: moduleName, verified: false };
        const moduleNameLower = moduleName.toLowerCase();
        const moduleKeywords = extractKeywords(moduleName);

        // 1. 檢查是否在 @GEMS-VERIFIED 的 [x] 中（最可靠）
        const inVerified = pocAnalysis.verified.some(v => {
            const vKeywords = extractKeywords(v);
            return moduleKeywords.some(mk =>
                vKeywords.some(vk => mk.includes(vk) || vk.includes(mk))
            );
        });

        // 2. 檢查是否在 @GEMS-VERIFIED 的 [ ] 中（明確未驗證）
        const inUnverified = pocAnalysis.unverified.some(v => {
            const vKeywords = extractKeywords(v);
            return moduleKeywords.some(mk =>
                vKeywords.some(vk => mk.includes(vk) || vk.includes(mk))
            );
        });

        // 3. 檢查是否在 @GEMS-STORY 中
        const inStory = pocAnalysis.stories.some(story =>
            moduleKeywords.some(mk => story.toLowerCase().includes(mk))
        );

        // 4. 檢查是否與 @GEMS-FUNCTION 有關聯
        const inFunction = pocAnalysis.functions.some(func =>
            moduleKeywords.some(mk => func.toLowerCase().includes(mk))
        );

        // 5. 關鍵詞重疊檢查
        const hasKeywordOverlap = moduleKeywords.some(mk =>
            verifiedKeywords.some(vk =>
                mk.includes(vk) || vk.includes(mk) ||
                levenshteinSimilarity(mk, vk) > 0.7
            )
        );

        // 綜合判斷
        if (inUnverified) {
            // 明確標註為未驗證
            moduleObj.verified = false;
        } else if (inVerified || inStory || inFunction || hasKeywordOverlap) {
            moduleObj.verified = true;
        }

        // 檢查是否包含禁用模式
        const hasForbidden = levelConfig.forbiddenPatterns.some(pattern =>
            moduleNameLower.includes(pattern.toLowerCase())
        );

        if (hasForbidden) {
            deferred.push(moduleObj);
            continue;
        }

        // Level S: 未驗證的功能延期
        if (levelConfig === LEVEL_CONSTRAINTS.S && !moduleObj.verified) {
            deferred.push(moduleObj);
            continue;
        }

        allowed.push(moduleObj);
    }

    return { allowed, deferred };
}

/**
 * 提取關鍵詞（通用）
 */
function extractKeywords(text) {
    // 移除括號內容，分割成詞
    const cleaned = text
        .replace(/[（(][^）)]*[）)]/g, '') // 移除括號內容
        .toLowerCase();

    // 分割中英文
    const words = cleaned
        .split(/[\s,，、]+/)
        .filter(w => w.length > 1);

    // 額外提取中文詞彙
    const chineseWords = cleaned.match(/[\u4e00-\u9fa5]{2,}/g) || [];

    return [...new Set([...words, ...chineseWords])];
}

/**
 * 簡單的相似度計算 (Levenshtein-based)
 */
function levenshteinSimilarity(a, b) {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;

    // 如果短字串是長字串的子串，給高分
    if (longer.includes(shorter)) return 0.8;

    // 簡單的字元重疊率
    const overlap = [...shorter].filter(c => longer.includes(c)).length;
    return overlap / longer.length;
}

function findFile(target, paths) {
    for (const p of paths) {
        const full = path.join(target, p);
        if (fs.existsSync(full)) return full;
    }
    return null;
}

function hasFile(target, iteration, pattern) {
    const dirs = [
        path.join(target, `.gems/iterations/${iteration}/poc`),
        path.join(target, `.gems/iterations/${iteration}`)
    ];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        if (fs.readdirSync(dir).some(f => f.includes(pattern))) return true;
    }
    return false;
}

function validateSpec(content, levelConfig) {
    const errors = [];
    if (!/用戶故事|User Story/i.test(content)) errors.push('缺用戶故事');
    if (!/驗收標準|Given.*When.*Then/i.test(content)) errors.push('缺驗收標準');
    if (!/獨立可測|Testability/i.test(content)) errors.push('缺獨立可測性');
    // 檢查是否有 Story 定義
    if (!/Story[\s\-]\d+\.\d+/i.test(content)) errors.push('缺 Story 定義');

    // [防膨脹] 檢查是否有驗證狀態標註
    if (!/\[已驗證\]|\[計畫開發\]|驗證狀態/i.test(content)) {
        errors.push('缺驗證狀態標註 (需標註 [已驗證] 或 [計畫開發])');
    }

    // [防膨脹] 檢查是否有範疇聲明
    if (!/範疇聲明|Scope Declaration|DEFERRED/i.test(content)) {
        errors.push('缺範疇聲明 (需列出 DEFERRED 項目)');
    }

    // [等級限制] 檢查禁用模式
    if (levelConfig && levelConfig.forbiddenPatterns.length > 0) {
        for (const pattern of levelConfig.forbiddenPatterns) {
            if (content.toLowerCase().includes(pattern.toLowerCase())) {
                errors.push(`包含禁用模式: ${pattern} (Level 限制)`);
            }
        }
    }

    // [5.5 函式規格表] 必須存在且無佔位符
    errors.push(...validate55Table(content));

    return errors;
}

/**
 * 驗證 5.5 函式規格表是否填寫完整
 * - 必須有 ## 5.5 區塊
 * - 至少有一行實際函式（非佔位符、非表頭）
 * - 不得有 [函式名稱]、[Type]、[來源 → 處理 → 目標] 等佔位符殘留
 */
function validate55Table(content) {
    const errors = [];
    if (!/##\s+5\.5\s+函式規格表/i.test(content)) {
        errors.push('缺 5.5 函式規格表 (plan-generator 需要此區塊直接轉換，無需 PLAN 步驟)');
        return errors;
    }

    // 找到 5.5 區塊
    const section = content.match(/##\s+5\.5\s+函式規格表[\s\S]*?(?=\n##\s+[^#]|$)/)?.[0] || '';

    // 檢查佔位符殘留
    if (/\[函式名稱\]|\[Type\]|\[來源.*?目標\]|\[說明\]/i.test(section)) {
        errors.push('5.5 函式規格表有未填寫的佔位符 ([函式名稱]/[Type] 等)，請填入實際函式資訊');
        return errors;
    }

    // 計算實際函式行數（排除表頭、分隔線、空行、說明行）
    const dataRows = section.split('\n').filter(line => {
        if (!line.trim().startsWith('|')) return false;
        if (/^\|\s*[-:]+\s*\|/.test(line)) return false; // 分隔線
        if (/Story.*函式名稱.*Type/i.test(line)) return false; // 表頭
        const cells = line.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length < 3) return false;
        // 第一欄必須是 N.N 格式的 story 編號
        return /^\d+\.\d+$/.test(cells[0]);
    });

    if (dataRows.length === 0) {
        errors.push('5.5 函式規格表沒有實際函式行，請填入至少一個函式');
    }

    return errors;
}

function formatList(list, limit = 10) {
    if (!list || list.length === 0) return '無';
    if (list.length <= limit) return list.join(', ');

    // 智能選擇：優先顯示包含關鍵詞的項目
    const priorityKeywords = ['核心', '業務', '邏輯', '驗證', '權限', 'API', '資料', '登入', '註冊', '支付'];
    const priority = list.filter(item =>
        priorityKeywords.some(kw => item.toLowerCase().includes(kw.toLowerCase()))
    );
    const others = list.filter(item => !priority.includes(item));

    // 優先項目最多顯示 5 個，其餘項目填滿到 limit
    const priorityCount = Math.min(priority.length, 5);
    const othersCount = Math.min(others.length, limit - priorityCount);
    const display = [...priority.slice(0, priorityCount), ...others.slice(0, othersCount)];

    return `${display.join(', ')} ... (+${list.length - display.length} more)`;
}

/**
 * 取得 POC Step 5 的門控規格
 */
function getGateSpec(content, levelConfig) {
    return {
        checks: [
            { name: '用戶故事', pattern: '/用戶故事|User Story/i', pass: /用戶故事|User Story/i.test(content), desc: '用戶故事區塊' },
            { name: '驗收標準', pattern: '/驗收標準|Given.*When.*Then/i', pass: /驗收標準|Given.*When.*Then/i.test(content), desc: 'BDD 驗收標準' },
            { name: '獨立可測性', pattern: '/獨立可測|Testability/i', pass: /獨立可測|Testability/i.test(content), desc: '獨立可測性說明' },
            { name: 'Story 定義', pattern: '/Story[\\s\\-]\\d+\\.\\d+/i', pass: /Story[\s\-]\d+\.\d+/i.test(content), desc: 'Story 編號定義' },
            { name: '驗證狀態標註', pattern: '/\\[已驗證\\]|\\[計畫開發\\]/i', pass: /\[已驗證\]|\[計畫開發\]|驗證狀態/i.test(content), desc: '[已驗證] 或 [計畫開發]' },
            { name: '範疇聲明', pattern: '/範疇聲明|DEFERRED/i', pass: /範疇聲明|Scope Declaration|DEFERRED/i.test(content), desc: 'DEFERRED 項目列表' }
        ]
    };
}

// 自我執行判斷
if (require.main === module) {
    const args = process.argv.slice(2);
    let target = process.cwd();
    let iteration = 'iter-1';

    // 簡單參數解析
    args.forEach(arg => {
        if (arg.startsWith('--target=')) target = arg.split('=')[1];
        if (arg.startsWith('--project-path=')) target = arg.split('=')[1];
        if (arg.startsWith('--iteration=')) iteration = arg.split('=')[1];
    });

    // 確保 target 是絕對路徑
    if (!path.isAbsolute(target)) {
        target = path.resolve(process.cwd(), target);
    }

    run({ target, iteration });
}

module.exports = { run };
