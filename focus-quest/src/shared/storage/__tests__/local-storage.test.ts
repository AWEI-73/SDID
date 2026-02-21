import { storageWrapper, LocalStorageWrapper } from '../local-storage';

describe('localStorage', () => {
    beforeEach(() => {
        const store: Record<string, string> = {};
        const mockStorage = {
            getItem: jest.fn((key: string) => store[key] || null),
            setItem: jest.fn((key: string, value: string) => {
                store[key] = value;
            }),
            removeItem: jest.fn((key: string) => {
                delete store[key];
            }),
            clear: jest.fn(() => {
                for (const key in store) {
                    delete store[key];
                }
            }),
            length: 0,
            key: jest.fn((index: number) => null),
        };
        global.window = {
            localStorage: mockStorage as unknown as Storage,
        } as any;
    });

    afterEach(() => {
        delete (global as any).window;
    });

    it('should set and get items', () => {
        storageWrapper.setItem('test_key', { foo: 'bar' });
        const item = storageWrapper.getItem<{ foo: string }>('test_key');
        expect(item).toEqual({ foo: 'bar' });
    });

    it('should return null for non-existent items', () => {
        const item = storageWrapper.getItem('non_existent');
        expect(item).toBeNull();
    });

    it('should remove items', () => {
        storageWrapper.setItem('delete_key', 'value');
        storageWrapper.removeItem('delete_key');
        const item = storageWrapper.getItem('delete_key');
        expect(item).toBeNull();
    });
});
