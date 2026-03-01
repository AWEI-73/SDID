// @GEMS-FUNCTION: generateId
/**
 * GEMS: generateId | P2 | OO | ()=>string | Story-1.0 | UUID generator
 * GEMS-FLOW: GENERATE → VALIDATE → RETURN
 * GEMS-DEPS: none
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: Unit
 * GEMS-TEST-FILE: generate-id.test.ts (describe("generateId"))
 */

// [STEP] GENERATE
export function generateId(): string {
    let uuid: string;

    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        uuid = crypto.randomUUID();
    } else {
        uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    // [STEP] VALIDATE
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) {
        throw new Error('Invalid UUID generated');
    }

    // [STEP] RETURN
    return uuid;
}

export default generateId;
