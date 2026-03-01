import { Note } from '../types/note-types';

/**
 * GEMS: LocalStorageHelper | P1 | ○○ | (args)→Result | Story-1.0 | 儲存層封裝
 * GEMS-FLOW: INIT→GET→SET→EXPORT
 * GEMS-DEPS: [Internal.NoteTypes]
 * GEMS-DEPS-RISK: MEDIUM
 * GEMS-TEST: ✓ Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: local-storage-helper.test.ts (內含 describe('LocalStorageHelper'))
 */

// [STEP] INIT
const STORAGE_KEY = 'smart-notebook-data';

// [STEP] GET
export const getNotes = (): Note[] => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Failed to parse notes from storage', error);
        return [];
    }
};

// [STEP] SET
export const saveNotes = (notes: Note[]): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (error) {
        console.error('Failed to save notes to storage', error);
    }
};

// [STEP] EXPORT
export const LocalStorageHelper = {
    getNotes,
    saveNotes
};
