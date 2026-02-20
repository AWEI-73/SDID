/**
 * GEMS Tag Knowledge Base
 * Code Reviewer 的標籤知識庫
 * 
 * 目的：讓 Code Reviewer 理解 GEMS 標籤系統的邏輯
 * 來源：gems-scanner.cjs, gems-validator.cjs, GEMS Tag System v2.1
 */

// ============================================
// GEMS 標籤規範 (v2.1)
// ============================================

const GEMS_TAG_SPEC = {
    version: '2.1',

    // 基礎標籤格式
    basicTag: {
        pattern: /\*\s*GEMS:\s*(\S+)\s*\|\s*(P[0-3])\s*\|([✓○⚠]+)\s*\|\s*(.+?)\s*\|\s*(Story-[\d.]+)\s*\|\s*(.+)/,
        fields: {
            functionName: { required: true, description: '函式名稱' },
            priority: { required: true, values: ['P0', 'P1', 'P2', 'P3'] },
            status: { required: true, values: ['✓✓', '✓○', '○○', '⚠⚠'] },
            signature: { required: true, description: '函式簽名 (input)→output' },
            storyId: { required: true, pattern: /Story-\d+\.\d+/ },
            description: { required: true, description: '功能描述' }
        }
    },

    // 擴展標籤
    extendedTags: {
        'GEMS-FLOW': {
            required: ['P0', 'P1'],
            pattern: /\*\s*GEMS-FLOW:\s*(.+)/,
            description: '業務流程步驟',
            format: 'Step1→Step2→Step3',
            validation: {
                minSteps: 2,
                maxSteps: 7,
                stepPattern: /\w+/
            }
        },

        'GEMS-DEPS': {
            required: ['P0', 'P1'],
            pattern: /\*\s*GEMS-DEPS:\s*(.+)/,
            description: '依賴項目',
            format: '[Type.Name (說明)]',
            examples: [
                '[Database.tbl_users (查詢)]',
                '[Internal.validateEmail (驗證)]',
                '[External.stripe (付款)]'
            ]
        },

        'GEMS-DEPS-RISK': {
            required: ['P0'],
            pattern: /\*\s*GEMS-DEPS-RISK:\s*(.+)/,
            description: '依賴風險評估',
            values: ['LOW', 'MEDIUM', 'HIGH']
        },

        'GEMS-TEST': {
            required: ['P0', 'P1'],
            pattern: /\*\s*GEMS-TEST:\s*(.+)/,
            description: '測試類型',
            format: '✓ Unit | ✓ Integration | - E2E',
            validation: {
                P0: { E2E: 'required' },
                P1: { Unit: 'required' }
            }
        },

        'GEMS-TEST-FILE': {
            required: ['P0', 'P1'],
            pattern: /\*\s*GEMS-TEST-FILE:\s*(.+)/,
            description: '測試檔案名稱',
            format: 'functionName.test.ts'
        }
    },

    // [STEP] 錨點規範
    stepAnchor: {
        pattern: /\/\/\s*\[STEP(?:-\d+)?\]\s*(\w+)/g,
        description: '流程步驟錨點',
        rules: {
            P0: {
                required: true,
                mustMatchFlow: true,
                description: 'P0 函式必須有 [STEP] 錨點，且數量與 GEMS-FLOW 一致'
            },
            P1: {
                required: true,
                mustMatchFlow: true,
                description: 'P1 函式必須有 [STEP] 錨點，且數量與 GEMS-FLOW 一致'
            },
            P2: {
                required: false,
                description: 'P2 函式可選'
            }
        }
    }
};

// ============================================
// 標籤驗證邏輯（來自 gems-validator.cjs）
// ============================================

const VALIDATION_LOGIC = {
    // 覆蓋率要求
    coverage: {
        minimum: 80,
        description: '標籤覆蓋率必須 >= 80%',
        calculation: '(已標籤函式數 / 總函式數) * 100'
    },

    // P0/P1 合規性
    compliance: {
        P0: {
            required: ['GEMS-FLOW', 'GEMS-DEPS', 'GEMS-DEPS-RISK', 'GEMS-TEST', 'GEMS-TEST-FILE'],
            stepAnchors: 'required',
            E2E: 'required'
        },
        P1: {
            required: ['GEMS-FLOW', 'GEMS-TEST', 'GEMS-TEST-FILE'],
            stepAnchors: 'required',
            Unit: 'required'
        },
        P2: {
            required: [],
            optional: ['GEMS-FLOW', 'GEMS-TEST']
        },
        P3: {
            required: [],
            optional: ['GEMS-TEST']
        }
    },

    // 標籤位置要求
    tagLocation: {
        maxDistance: 2000,
        description: '標籤必須在函式定義正上方（< 2000 字元）',
        reason: 'gems-validator.cjs 的搜索範圍限制'
    },

    // [STEP] 錨點驗證
    stepValidation: {
        countMatch: {
            rule: '[STEP] 錨點數量必須等於 GEMS-FLOW 步驟數',
            example: 'GEMS-FLOW: A→B→C (3步) 需要 3 個 [STEP] 錨點'
        },
        nameMatch: {
            rule: '[STEP] 錨點名稱應與 FLOW 步驟名稱對應',
            level: 'warning',
            example: 'FLOW: Validate→Insert 對應 [STEP] Validate, [STEP] Insert'
        }
    }
};

// ============================================
// 常見錯誤模式與原因
// ============================================

const COMMON_ERRORS = {
    'GEMS 標籤覆蓋率 < 80%': {
        possibleReasons: [
            '函式沒有加 GEMS 標籤',
            '標籤格式錯誤，未被識別',
            '標籤距離函式定義太遠（> 2000 字元）',
            '使用單行註解 // 而非多行註解 /** */'
        ],
        solutions: [
            '為每個函式加上完整的 GEMS 標籤',
            '確保標籤在函式定義正上方',
            '使用 /** */ 格式的多行註解',
            '檢查標籤格式是否符合規範'
        ],
        references: [
            'gems-validator.cjs line 52-54 (註解搜索邏輯)',
            'GEMS Tag System v2.1'
        ]
    },

    'P0/P1 缺少擴展標籤': {
        possibleReasons: [
            '忘記加 GEMS-FLOW',
            '忘記加 GEMS-DEPS',
            '忘記加 GEMS-TEST',
            '忘記加 GEMS-TEST-FILE',
            'P0 忘記加 GEMS-DEPS-RISK'
        ],
        solutions: [
            '參考 implementation_plan 的標籤模板',
            '確保 P0 函式有完整的 6 個標籤',
            '確保 P1 函式有基本的 4 個標籤'
        ],
        references: [
            'gems-validator.cjs line 174-197 (validateP0P1Compliance)',
            'implementation_plan.template.md'
        ]
    },

    '[STEP] 錨點數量不符': {
        possibleReasons: [
            'GEMS-FLOW 有 3 步，但只有 2 個 [STEP] 錨點',
            '忘記在程式碼中加 [STEP] 註解',
            '[STEP] 錨點格式錯誤（如缺少 // 或 []）'
        ],
        solutions: [
            '計算 GEMS-FLOW 的步驟數（數箭頭 + 1）',
            '在每個步驟的程式碼前加 // [STEP] StepName',
            '確保 [STEP] 錨點名稱與 FLOW 步驟對應'
        ],
        references: [
            'gems-scanner.cjs line 645-707 (validateStepAnchors)',
            'GEMS Tag System v2.1 - STEP 錨點規範'
        ]
    },

    '標籤與實作不一致': {
        possibleReasons: [
            'GEMS-FLOW 說有 3 步，但程式碼只有 2 步',
            'GEMS-DEPS 列出的依賴，程式碼中沒用到',
            'GEMS-TEST 說有 E2E，但測試檔案中沒有'
        ],
        solutions: [
            '確保 GEMS-FLOW 與程式碼邏輯一致',
            '移除未使用的 GEMS-DEPS',
            '補充缺失的測試案例'
        ],
        references: [
            'gems-scanner.cjs (假實作偵測)',
            'Code Review 最佳實踐'
        ]
    }
};

// ============================================
// 階段特定的標籤要求
// ============================================

const PHASE_TAG_REQUIREMENTS = {
    'build-4': {
        name: 'BUILD Phase 4 - 標籤驗收',
        focus: '標籤存在性與格式正確性',
        checks: [
            '標籤覆蓋率 >= 80%',
            'P0/P1 擴展標籤完整',
            '[STEP] 錨點數量正確',
            '標籤在函式正上方（< 2000 字元）'
        ],
        notChecked: [
            '測試檔案是否存在（Phase 5 的職責）',
            '程式碼邏輯正確性（Phase 6 的職責）'
        ]
    },

    'build-5': {
        name: 'BUILD Phase 5 - 測試檔案驗證',
        focus: '測試檔案存在性',
        checks: [
            'GEMS-TEST-FILE 指定的檔案存在',
            '測試檔案路徑正確（__tests__/ 或同目錄）'
        ]
    },

    'plan-3': {
        name: 'PLAN Step 3 - 架構審查',
        focus: '架構合理性',
        checks: [
            '模組依賴合理',
            'Constitution Audit 通過',
            '架構符合規範'
        ]
    },

    'plan-4': {
        name: 'PLAN Step 4 - 標籤規格設計',
        focus: '標籤規格完整性',
        checks: [
            'implementation_plan 中有標籤模板',
            '標籤覆蓋率 >= 80%',
            'P0 函式有完整標籤定義'
        ]
    },

    'plan-5': {
        name: 'PLAN Step 5 - 需求規格說明',
        focus: '規格完整性',
        checks: [
            '所有項目已確認',
            '文件格式正確',
            '規格說明完整'
        ]
    }
};

// ============================================
// 導出
// ============================================

module.exports = {
    GEMS_TAG_SPEC,
    VALIDATION_LOGIC,
    COMMON_ERRORS,
    PHASE_TAG_REQUIREMENTS
};
