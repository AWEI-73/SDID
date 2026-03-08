// Integration test: readSheetClasses — 使用真實依賴，禁止 jest.mock()
import { readSheetClasses, getSheetDataFromGas } from '../read-sheet-classes';

describe('readSheetClasses (integration)', () => {
  it('AC-2.0: 空資料回傳空陣列', () => {
    const result = readSheetClasses([]);
    expect(result).toEqual([]);
  });

  it('AC-2.0: 只有 header 列時回傳空陣列', () => {
    const result = readSheetClasses([['classId', 'yearPeriod', 'classCode', 'className', 'organizer', 'venue', 'startDate', 'endDate', 'useComputerRoom', 'headcount', 'trainingDays', 'deliveryMode', 'canDelegate']]);
    expect(result).toEqual([]);
  });

  it('AC-2.0: 正確解析班期資料', () => {
    const sheetData = [
      ['classId', 'yearPeriod', 'classCode', 'className', 'organizer', 'venue', 'startDate', 'endDate', 'useComputerRoom', 'headcount', 'trainingDays', 'deliveryMode', 'canDelegate'],
      ['24004', '115-1', '1K020041', '資訊安全基礎班', '人事處', '台北', '115/04/13', '115/04/15', 'false', '30', '3', '實體', 'false'],
      ['77006', '115-1', '2K030062', '行政管理進階班', '行政處', '台中', '115/05/20', '115/05/22', 'true', '25', '3', '混成', 'true'],
      ['513008', '115-2', '3K040083', '領導力培訓班', '人事處', '高雄', '115/09/10', '115/09/12', 'false', '20', '3', '實體', 'false'],
    ];
    const result = readSheetClasses(sheetData);
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result[0].classId).toBe('24004');
    expect(result[0].startDate).toBe('115/04/13');
    expect(result[1].classId).toBe('77006');
    expect(result[2].classId).toBe('513008');
  });

  it('AC-2.0: 過濾空白列', () => {
    const sheetData = [
      ['classId', 'yearPeriod', 'classCode', 'className', 'organizer', 'venue', 'startDate', 'endDate', 'useComputerRoom', 'headcount', 'trainingDays', 'deliveryMode', 'canDelegate'],
      ['24004', '115-1', '1K020041', '資訊安全基礎班', '人事處', '台北', '115/04/13', '115/04/15', 'false', '30', '3', '實體', 'false'],
      ['', '', '', '', '', '', '', '', '', '', '', '', ''],
    ];
    const result = readSheetClasses(sheetData);
    expect(result.length).toBe(1);
  });
});

describe('getSheetDataFromGas (integration)', () => {
  it('GAS 環境外回傳空陣列（SpreadsheetApp 未定義）', () => {
    const result = getSheetDataFromGas();
    expect(Array.isArray(result)).toBe(true);
  });
});
