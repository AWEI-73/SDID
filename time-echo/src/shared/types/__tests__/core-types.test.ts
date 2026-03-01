import type { TimeEntry, WeeklyReport, Category, Mood } from "../core-types";

describe("CoreTypes", () => {
  it("should allow creating a valid TimeEntry", () => {
    const entry: TimeEntry = {
      id: "test-id",
      date: "2026-02-22",
      activity: "Deep Work",
      duration: 90,
      category: "WORK",
      mood: "GOOD",
      createdAt: new Date().toISOString(),
    };
    expect(entry.id).toBe("test-id");
    expect(entry.category).toBe("WORK");
  });

  it("should allow creating a valid WeeklyReport", () => {
    const report: WeeklyReport = {
      weekKey: "2026-W08",
      totalMinutes: 300,
      categoryBreakdown: { WORK: 180, LEARNING: 60, HEALTH: 30, LEISURE: 20, OTHER: 10 },
      moodTrend: ["GOOD", null, "GREAT", "NEUTRAL", "TIRED", null, "GOOD"],
      topActivity: "Deep Work",
      generatedAt: new Date().toISOString(),
    };
    expect(report.weekKey).toBe("2026-W08");
    expect(report.totalMinutes).toBe(300);
  });
});