/**
 * GEMS: App | P2 | ✓✓ | ()→void | Story-1.1 | 應用程式根組件
 * GEMS-FLOW: entry → render
 * GEMS-DEPS: [test-loop-calc-core.pressKey], [test-loop-calc-core.clearDisplay], [test-loop-calc-core.deleteLastChar]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: - Unit | - Integration | - E2E
 * GEMS-TEST-FILE: -
 */
import { pressKey } from './modules/test-loop-calc-core/components/press-key';
import { clearDisplay } from './modules/test-loop-calc-core/components/clear-display';
import { deleteLastChar } from './modules/test-loop-calc-core/components/delete-last-char';
import { CalculatorPage } from './modules/test-loop-calc-core/pages/calculator-page';

export { pressKey, clearDisplay, deleteLastChar, CalculatorPage };
