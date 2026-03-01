// @GEMS-FUNCTION: AppConstants
/**
 * GEMS: AppConstants | P0 | ○○ | ()=>Constants | Story-1.0 | App constants (category/mood lists)
 * GEMS-FLOW: DEFINE → FREEZE → EXPORT
 * GEMS-DEPS: none
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: Unit | Integration | E2E
 * GEMS-TEST-FILE: app-constants.test.ts (describe("AppConstants"))
 */

import type { Category, Mood } from "./core-types";

// [STEP] DEFINE
export type CategoryLabel = typeof CATEGORY_LABELS_DEF;
 
const CATEGORY_LABELS_DEF = {
  WORK: "Work",
  LEARNING: "Learning",
  HEALTH: "Health",
  LEISURE: "Leisure",
  OTHER: "Other",
} as const;

// [STEP] FREEZE
export const APP_NAME = "Time Echo";
export const STORAGE_KEY_ENTRIES = "time-echo:entries";
export const CATEGORY_LIST: Category[] = ["WORK", "LEARNING", "HEALTH", "LEISURE", "OTHER"];
export const CATEGORY_LABELS: Record<Category, string> = CATEGORY_LABELS_DEF;
export const CATEGORY_COLORS: Record<Category, string> = {WORK:"#6366F1",LEARNING:"#8B5CF6",HEALTH:"#10B981",LEISURE:"#F59E0B",OTHER:"#6B7280"};
export const MOOD_LIST: Mood[] = ["GREAT", "GOOD", "NEUTRAL", "TIRED", "STRESSED"];
export const MOOD_LABELS: Record<Mood, string> = {GREAT:"Great",GOOD:"Good",NEUTRAL:"Neutral",TIRED:"Tired",STRESSED:"Stressed"};
export const MOOD_EMOJI: Record<Mood, string> = {GREAT:"star",GOOD:"smile",NEUTRAL:"neutral",TIRED:"sleepy",STRESSED:"sweat"};

// [STEP] EXPORT
export function AppConstants() {
  return {APP_NAME,STORAGE_KEY_ENTRIES,CATEGORY_LIST,CATEGORY_LABELS,CATEGORY_COLORS,MOOD_LIST,MOOD_LABELS,MOOD_EMOJI};
}

export default AppConstants;