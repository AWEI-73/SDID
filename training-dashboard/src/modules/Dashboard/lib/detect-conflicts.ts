import type { TrainingClass, ConflictFlag } from '../../../shared/types/training-class-schema';

/**
 * GEMS: detectConflicts | P1 | ✓✓ | (classes: TrainingClass[])→ConflictFlag[] | Story-1.1 | 偵測教室衝突與時程重疊
 * GEMS-FLOW: CLASSES→GROUPBYROOM→CONFLICTS
 * GEMS-DEPS: [TrainingClassSchema]
 * GEMS-DEPS-RISK: MEDIUM
 */
// AC-1.2
// [STEP] CLASSES — 接收班別陣列
// [STEP] GROUPBYROOM — 依教室分組
// [STEP] CONFLICTS — 比對日期重疊，產出衝突旗標

function datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function detectConflicts(classes: TrainingClass[]): ConflictFlag[] {
  // [STEP] GROUPBYROOM
  const byRoom = new Map<string, TrainingClass[]>();
  for (const cls of classes) {
    if (!cls.assignedRoom) continue;
    const group = byRoom.get(cls.assignedRoom) ?? [];
    group.push(cls);
    byRoom.set(cls.assignedRoom, group);
  }

  // [STEP] CONFLICTS
  const flags: ConflictFlag[] = [];
  for (const [, group] of byRoom) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (datesOverlap(a.startDate, a.endDate, b.startDate, b.endDate)) {
          flags.push({
            classId: a.id,
            type: 'room_conflict',
            conflictWith: b.id,
            description: `${a.className} 與 ${b.className} 在 ${a.assignedRoom} 時間重疊`,
          });
        }
      }
    }
  }
  return flags;
}
