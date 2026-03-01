import { calcWeeklyStats } from "../calc-weekly-stats";
import type { TimeEntry } from "../../types/core-types";

const mockEntries: TimeEntry[] = [
  { id: "1", date: "2026-02-16", activity: "Deep Work", duration: 120, category: "WORK", mood: "GOOD", createdAt: "2026-02-16T09:00:00Z" },
  { id: "2", date: "2026-02-17", activity: "Exercise", duration: 60, category: "HEALTH", mood: "GREAT", createdAt: "2026-02-17T07:00:00Z" },
  { id: "3", date: "2026-02-18", activity: "Deep Work", duration: 180, category: "WORK", mood: "NEUTRAL", createdAt: "2026-02-18T10:00:00Z" },
];

describe("calcWeeklyStats", () => {
  it("should filter entries by week", () => {
    const report = calcWeeklyStats(mockEntries, "2026-W08");
    expect(report.weekKey).toBe("2026-W08");
    expect(report.totalMinutes).toBe(360);
  });

  it("should compute categoryBreakdown", () => {
    const report = calcWeeklyStats(mockEntries, "2026-W08");
    expect(report.categoryBreakdown.WORK).toBe(300);
    expect(report.categoryBreakdown.HEALTH).toBe(60);
    expect(report.categoryBreakdown.LEARNING).toBe(0);
  });

  it("should identify topActivity", () => {
    const report = calcWeeklyStats(mockEntries, "2026-W08");
    expect(report.topActivity).toBe("Deep Work");
  });

  it("should return empty report for weeks with no entries", () => {
    const report = calcWeeklyStats(mockEntries, "2026-W01");
    expect(report.totalMinutes).toBe(0);
    expect(report.topActivity).toBe("");
  });
});