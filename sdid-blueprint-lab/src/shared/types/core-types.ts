// @GEMS-FUNCTION: CoreTypes
/**
 * GEMS: CoreTypes | P0 | ⬜ | (args)→Result | Story-1.0 | 核心型別定義
 * GEMS-FLOW: DEFINE→FREEZE→EXPORT
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 */
// @GEMS [P0] Shared.CoreTypes | FLOW: DEFINE→FREEZE→EXPORT | L11-16
export const CoreTypes = Object.freeze({
    TASK_STATUS: {
        TODO: 'todo',
        DONE: 'done'
    }
});

// @GEMS-FUNCTION: AppConfig
/**
 * GEMS: AppConfig | P3 | ⬜ | (args)→Result | Story-1.0 | 全域配置
 * GEMS-FLOW: DEFINE→FREEZE→EXPORT
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 */
// @GEMS [P3] Shared.AppConfig | FLOW: DEFINE→FREEZE→EXPORT | L25-27
export const AppConfig = Object.freeze({
    STORAGE_KEY: 'sdid_tasks'
});
