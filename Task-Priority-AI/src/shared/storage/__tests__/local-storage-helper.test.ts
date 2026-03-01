import { localStorageHelper } from '../local-storage-helper.js';

describe('localStorageHelper', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should save and retrieve data', () => {
        const data = { foo: 'bar' };
        localStorageHelper.set('test', data);
        expect(localStorageHelper.get('test')).toEqual(data);
    });

    it('should return null if key does not exist', () => {
        expect(localStorageHelper.get('nonexistent')).toBeNull();
    });
});
