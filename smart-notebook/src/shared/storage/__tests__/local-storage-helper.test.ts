import { LocalStorageHelper, saveNotes, getNotes } from '../local-storage-helper';
import { NoteFactory } from '../../types/note-types';

describe('LocalStorageHelper', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('saveNotes and getNotes', () => {
        const note = NoteFactory.create('A', 'B');
        LocalStorageHelper.saveNotes([note]);
        const notes = LocalStorageHelper.getNotes();
        expect(notes.length).toBe(1);
        expect(notes[0].title).toBe('A');
    });
});
