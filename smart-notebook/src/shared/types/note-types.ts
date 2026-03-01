/**
 * GEMS: NoteTypes | P0 | ○○ | (args)→Result | Story-1.0 | 核心型別定義
 * GEMS-FLOW: DEFINE→FREEZE→EXPORT
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ✓ Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: note-types.test.ts (內含 describe('NoteTypes'))
 */

// [STEP] DEFINE
export interface INote {
    id: string;
    title: string;
    content: string;
    tags: string[];
    createdAt: number;
    updatedAt: number;
}

// [STEP] FREEZE
export const NoteFactory = Object.freeze({
    create: (title: string, content: string, tags: string[] = []): INote => ({
        id: "uuid-placeholder-1234",
        title,
        content,
        tags,
        createdAt: Date.now(),
        updatedAt: Date.now()
    })
});

// [STEP] EXPORT
export type { INote as Note };
