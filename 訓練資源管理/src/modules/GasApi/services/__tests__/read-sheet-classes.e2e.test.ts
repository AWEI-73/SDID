// E2E test: readSheetClasses — 完整流程測試，跨模組整合
import { readSheetClasses, getSheetDataFromGas } from '../read-sheet-classes';
import { expandTaskNodes } from '../../lib/expand-task-nodes';
import type { NodeParamConfig } from '../../../../config/core-types';

const MOCK_SHEET_DATA = [
  ['classId', 'yearPeriod', 'classCode', 'className', 'organizer', 'venue', 'startDate', 'endDate', 'useComputerRoom', 'headcount', 'trainingDays', 'deliveryMode', 'canDelegate'],
  ['24004', '115-1', '1K020041', '資訊安全基礎班', '人事處', '台北', '115/04/13', '115/04/15', 'false', '30', '3', '實體', 'false'],
  ['77006', '115-1', '2K030062', '行政管理進階班', '行政處', '台中', '115/05/20', '115/05/22', 'true', '25', '3', '混成', 'true'],
  ['513008', '115-2', '3K040083', '領導力培訓班', '人事處', '高雄', '115/09/10', '115/09/12', 'false', '20', '3', '實體', 'false'],
];

const MOCK_PARAMS: NodeParamConfig[] = [
  { taskCode: 'N-75', taskName: '場地確認', offsetDays: 75, earlyAlertDays: 7 },
  { taskCode: 'N-14', taskName: '通知學員', offsetDays: 14, earlyAlertDays: 3 },
];

describe('readSheetClasses + expandTaskNodes (e2e)', () => {
  it('AC-2.0: 完整流程 — 讀取班期並展開任務節點', () => {
    // 讀取班期
    const classes = readSheetClasses(MOCK_SHEET_DATA);
    expect(classes.length).toBeGreaterThanOrEqual(3);
    expect(classes[0].classId).toBe('24004');

    // 展開任務節點（跨模組整合）
    const nodes = expandTaskNodes(classes, MOCK_PARAMS);
    expect(nodes.length).toBe(classes.length * MOCK_PARAMS.length);
    expect(nodes[0].taskId).toContain('24004');
    expect(nodes[0].dueDate).toBeTruthy();
    expect(nodes[0].alertDate).toBeTruthy();
  });

  it('AC-2.0: GAS 環境外 getSheetDataFromGas 回傳空陣列', () => {
    const result = getSheetDataFromGas();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });
});
