/**
 * GEMS: CalculatorPage | P1 | ✓✓ | ()→void | Story-1.1 | 計算機頁面入口
 * GEMS-FLOW: ROUTE → UI → display
 * GEMS-DEPS: [test-loop-calc-core.calculate], [test-loop-calc-core.pressKey]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: - Unit | - Integration | - E2E
 * GEMS-TEST-FILE: calculator-page.test.ts
 */
// [STEP] ROUTE
// [STEP] UI
// [STEP] display

// 計算機頁面入口點（純邏輯，UI 渲染由 testPOC.html 負責）
export const CalculatorPage = {
  route: '/',
  title: 'Calculator',
};
