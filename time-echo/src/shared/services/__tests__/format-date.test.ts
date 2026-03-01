import { formatDate, formatDuration } from "../format-date";

describe("formatDate", () => {
  it("should format a Date object to YYYY-MM-DD", () => {
    const result = formatDate(new Date("2026-02-22T00:00:00Z"));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should format a date string to YYYY-MM-DD", () => {
    expect(formatDate("2026-02-22")).toBe("2026-02-22");
  });

  it("should throw on invalid date string", () => {
    expect(() => formatDate("not-a-date")).toThrow();
  });
});

describe("formatDuration", () => {
  it("should format minutes less than 60", () => {
    expect(formatDuration(30)).toBe("30 分");
  });

  it("should format exactly 60 minutes", () => {
    expect(formatDuration(60)).toBe("1 小時");
  });

  it("should format hours and minutes", () => {
    expect(formatDuration(90)).toBe("1 小時 30 分");
  });
});