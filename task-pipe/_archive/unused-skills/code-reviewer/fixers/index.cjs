/**
 * Auto Fixer Factory
 * 根據階段自動選擇對應的 Fixer
 */

const { BuildPhase4Fixer } = require('./build-phase4-fixer.cjs');
const { BuildPhase5Fixer } = require('./build-phase5-fixer.cjs');
const { PocStep0Fixer } = require('./poc-step0-fixer.cjs');

class AutoFixerFactory {
    /**
     * 建立對應階段的 Fixer
     * @param {string} phase - 階段名稱 (POC, PLAN, BUILD)
     * @param {string} step - 步驟編號
     * @param {Object} options - 選項
     * @returns {BaseAutoFixer} Fixer 實例
     */
    static create(phase, step, options) {
        const key = `${phase.toLowerCase()}-${step}`;

        const fixerMap = {
            // POC 階段
            'poc-1': PocStep0Fixer,  // 模糊消除
            'poc-2': null,  // TODO: 實作 POC Step 2 Fixer (規模評估)
            'poc-3': null,  // TODO: 實作 POC Step 3 Fixer (契約設計)
            'poc-4': null,  // TODO: 實作 POC Step 4 Fixer (UI 原型)
            'poc-5': null,  // TODO: 實作 POC Step 5 Fixer (需求規格)

            // PLAN 階段
            'plan-1': null,  // TODO: 實作 PLAN Step 1 Fixer
            'plan-2': null,  // TODO: 實作 PLAN Step 2 Fixer
            'plan-3': null,  // TODO: 實作 PLAN Step 3 Fixer (架構審查)
            'plan-4': null,  // TODO: 實作 PLAN Step 4 Fixer (標籤規格設計)
            'plan-5': null,  // TODO: 實作 PLAN Step 5 Fixer (需求規格說明)

            // BUILD 階段 (新編號: 1→2→3→4→5→6→7→8)
            'build-1': null,  // Phase 1: 開發腳本
            'build-2': BuildPhase4Fixer,  // Phase 2: 標籤驗收 (原 phase-4) ✅
            'build-3': null,  // Phase 3: 測試腳本
            'build-4': BuildPhase5Fixer,  // Phase 4: Test Gate (原 phase-5) ✅
            'build-5': null,  // Phase 5: TDD 測試執行
            'build-6': null,  // Phase 6: 修改檔案測試
            'build-7': null,  // Phase 7: 整合檢查
            'build-8': null   // Phase 8: Fillback
        };

        const FixerClass = fixerMap[key];

        if (!FixerClass) {
            console.warn(`⚠️ ${phase} Step ${step} 尚未實作 Auto Fixer`);
            return null;
        }

        return new FixerClass(options);
    }

    /**
     * 取得所有支援的階段
     */
    static getSupportedPhases() {
        return {
            'POC': {
                '1': { name: 'POC Step 1 - 模糊消除', supported: true },
                '2': { name: 'POC Step 2 - 規模評估', supported: false },
                '3': { name: 'POC Step 3 - 契約設計', supported: false },
                '4': { name: 'POC Step 4 - UI 原型', supported: false },
                '5': { name: 'POC Step 5 - 需求規格', supported: false }
            },
            'PLAN': {
                '1': { name: 'PLAN Step 1 - 需求確認', supported: false },
                '2': { name: 'PLAN Step 2 - 規格注入', supported: false },
                '3': { name: 'PLAN Step 3 - 架構審查', supported: false },
                '4': { name: 'PLAN Step 4 - 標籤規格設計', supported: false },
                '5': { name: 'PLAN Step 5 - 需求規格說明', supported: false }
            },
            'BUILD': {
                '1': { name: 'BUILD Phase 1 - 開發腳本', supported: false },
                '2': { name: 'BUILD Phase 2 - 標籤驗收', supported: true },
                '3': { name: 'BUILD Phase 3 - 測試腳本', supported: false },
                '4': { name: 'BUILD Phase 4 - Test Gate', supported: true },
                '5': { name: 'BUILD Phase 5 - TDD 測試執行', supported: false },
                '6': { name: 'BUILD Phase 6 - 修改檔案測試', supported: false },
                '7': { name: 'BUILD Phase 7 - 整合檢查', supported: false },
                '8': { name: 'BUILD Phase 8 - Fillback', supported: false }
            }
        };
    }

    /**
     * 檢查階段是否支援 Auto Fix
     */
    static isSupported(phase, step) {
        const supported = this.getSupportedPhases();
        return supported[phase]?.[step]?.supported || false;
    }
}

module.exports = { AutoFixerFactory };
