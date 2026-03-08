// Unit test: readSheetClasses + getSheetDataFromGas
import { readSheetClasses, getSheetDataFromGas } from '../read-sheet-classes';

describe('getSheetDataFromGas', () => {
  it('GAS 環境外（SpreadsheetApp 未定義）回傳空陣列', () => {
    const result = getSheetDataFromGas();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });
});

describe('readSheetClasses', () => {
  it('AC-2.0: 空輸入回傳空陣列', () => {
    expect(readSheetClasses([])).toEqual([]);
  });

  it('AC-2.0: 只有 header 列回傳空陣列', () => {
    const result = readSheetClasses([['classId', 'yearPeriod', 'startDate']]);
    expect(result).toEqual([]);
  });

  it('AC-2.0: 正確解析班期資料', () => {
    const data = [
      ['classId', 'yearPeriod', 'classCode', 'className', 'organizer', 'venue', 'startDate', 'endDate', 'useComputerRoom', 'headcount', 'trainingDays', 'deliveryMode', 'canDelegate'],
      ['24004', '115-1', '1K020041', '資訊安全基礎班', '人事處', '台北', '115/04/13', '115/04/15', 'false', '30', '3', '實體', 'false'],
    ];
    const result = readSheetClasses(data);
    expect(result.length).toBe(1);
    expect(result[0].classId).toBe('24004');
    expect(result[0].startDate).toBe('115/04/13');
    expect(result[0].headcount).toBe(30);
  });

  it('AC-2.0: 回傳至少 3 筆班期', () => {
    const data = [
      ['classId', 'yearPeriod', 'classCode', 'className', 'organizer', 'venue', 'startDate', 'endDate', 'useComputerRoom', 'headcount', 'trainingDays', 'deliveryMode', 'canDelegate'],
      ['24004', '115-1', '1K020041', '資訊安全基礎班', '人事處', '台北', '115/04/13', '115/04/15', 'false', '30', '3', '實體', 'false'],
      ['77006', '115-1', '2K030062', '行政管理進階班', '行政處', '台中', '115/05/20', '115/05/22', 'true', '25', '3', '混成', 'true'],
      ['513008', '115-2', '3K040083', '領導力培訓班', '人事處', '高雄', '115/09/10', '115/09/12', 'false', '20', '3', '實體', 'false'],
    ];
    const result = readSheetClasses(data);
    expect(result.length).toBeGreaterThanOrEqual(3);
    result.forEach(cls => {
      expect(typeof cls.classId).toBe('string');
      expect(cls.classId.length).toBeGreaterThan(0);
    });
  });
});
