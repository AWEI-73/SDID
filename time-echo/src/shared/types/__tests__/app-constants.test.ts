import { AppConstants, APP_NAME, CATEGORY_LIST, MOOD_LIST, CATEGORY_LABELS, MOOD_LABELS } from "../app-constants";

describe("AppConstants", () => {
  it("should have a non-empty APP_NAME", () => {
    expect(APP_NAME.length).toBeGreaterThan(0);
  });

  it("should have 5 categories", () => {
    expect(CATEGORY_LIST.length).toBe(5);
  });

  it("should have 5 moods", () => {
    expect(MOOD_LIST.length).toBe(5);
  });

  it("should have labels for all categories", () => {
    CATEGORY_LIST.forEach(cat => {
      expect(CATEGORY_LABELS[cat]).toBeDefined();
    });
  });

  it("should have labels for all moods", () => {
    MOOD_LIST.forEach(mood => {
      expect(MOOD_LABELS[mood]).toBeDefined();
    });
  });

  it("AppConstants() function should return all constants", () => {
    const c = AppConstants();
    expect(c.APP_NAME).toBe(APP_NAME);
    expect(c.CATEGORY_LIST).toEqual(CATEGORY_LIST);
  });
});