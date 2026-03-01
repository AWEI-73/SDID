import { getWeekKey, getWeekRange } from "../get-week-key";

describe("getWeekKey", () => {
  it("should return format YYYY-WNN", () => {
    const key = getWeekKey("2026-02-22");
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("should return W08 for 2026-02-22", () => {
    // 2026-02-22 is a Sunday in week 8
    const key = getWeekKey("2026-02-22");
    expect(key).toBe("2026-W08");
  });

  it("should throw on invalid date", () => {
    expect(() => getWeekKey("invalid")).toThrow();
  });
});

describe("getWeekRange", () => {
  it("should return Monday as start and Sunday as end", () => {
    const range = getWeekRange("2026-W08");
    expect(range.start).toBe("2026-02-16");
    expect(range.end).toBe("2026-02-22");
  });
});