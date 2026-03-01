import { NoteFactory } from '../note-types';

describe('NoteTypes', () => {
    it('should create a valid note', () => {
        const note = NoteFactory.create('Title', 'Content', ['tag']);
        expect(note.title).toBe('Title');
        expect(note.content).toBe('Content');
        expect(note.tags).toEqual(['tag']);
    });
});
