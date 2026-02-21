import { freezeProfile, UserProfile } from '../core-types';

describe('CoreTypes', () => {
    it('should freeze the profile object', () => {
        const profile: UserProfile = { id: '1', name: 'Test', level: 1, xp: 0 };
        const frozen = freezeProfile(profile);

        expect(frozen).toEqual(profile);
        expect(Object.isFrozen(frozen)).toBe(true);
    });
});
