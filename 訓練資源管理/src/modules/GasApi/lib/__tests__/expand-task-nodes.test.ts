// Unit test: expandTaskNodes + parseRocDate
import { expandTaskNodes, parseRocDate } from '../expand-task-nodes';
import type { TrainingClass, NodeParamConfig } from '../../../../config/core-types';

const MOCK_CLASS: TrainingClass = {
  classId: '24004',
  yearPeriod: '115-1',
  classCode: '1K020041',
  className: '資訊安全基礎班',
  organizer: '人事處',
  venue: '台北',
  startDate: '115/04/13',
  endDate: '115/04/15',
  headcount: 30,
  trainingDays: 3,
  deliveryMode: '實體',
};

const MOCK_PARAMS: NodeParamConfig[] = [
  { taskCode: 'N-75', taskName: '場地確認', offsetDays: 75, earlyAlertDays: 7 },
];

describe('parseRocDate', () => {
  it('AC-2.1: 正確解析民國年格式', () => {
    const result = parseRocDate('115/04/13');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('number');
  });

  it('AC-2.1: 無效格式回傳 null', () => {
    expect(parseRocDate('2026-04-13')).toBeNull();
    expect(parseRocDate('')).toBeNull();
    expect(parseRocDate('abc')).toBeNull();
  });

  it('AC-2.1: 計算正確的 Unix timestamp', () => {
    const result = parseRocDate('115/04/13');
    // 115 + 1911 = 2026, 04/13 (UTC)
    const expected = Date.UTC(2026, 3, 13);
    expect(result).toBe(expected);
  });
});

describe('expandTaskNodes', () => {
  it('AC-2.1: 正確展開任務節點', () => {
    const nodes = expandTaskNodes([MOCK_CLASS], MOCK_PARAMS);
    expect(nodes.length).toBe(1);
    expect(nodes[0].taskId).toBe('24004_N-75');
    expect(nodes[0].classId).toBe('24004');
    expect(nodes[0].taskCode).toBe('N-75');
    expect(nodes[0].dueDate).toBeTruthy();
    expect(nodes[0].alertDate).toBeTruthy();
  });

  it('AC-2.1: dueDate = startDate - offsetDays', () => {
    const nodes = expandTaskNodes([MOCK_CLASS], MOCK_PARAMS);
    // startDate = 115/04/13 = 2026-04-13, offsetDays = 75
    // dueDate = 2026-04-13 - 75 days = 2026-01-28
    expect(nodes[0].dueDate).toBe('2026-01-28');
  });

  it('AC-2.1: alertDate = dueDate - earlyAlertDays', () => {
    const nodes = expandTaskNodes([MOCK_CLASS], MOCK_PARAMS);
    // dueDate = 2026-01-28, earlyAlertDays = 7
    // alertDate = 2026-01-21
    expect(nodes[0].alertDate).toBe('2026-01-21');
  });

  it('AC-2.1: 空 params 回傳空陣列', () => {
    const nodes = expandTaskNodes([MOCK_CLASS], []);
    expect(nodes).toEqual([]);
  });

  it('AC-2.1: 無效 startDate 跳過', () => {
    const invalidClass = { ...MOCK_CLASS, startDate: 'invalid' };
    const nodes = expandTaskNodes([invalidClass], MOCK_PARAMS);
    expect(nodes).toEqual([]);
  });
});
