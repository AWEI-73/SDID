/**
 * Retry Tracker - 追蹤 Phase 失敗次數
 * 當失敗 3 次時觸發 Code Review
 */

const fs = require('fs');
const path = require('path');

class RetryTracker {
    constructor(target, iteration, story, phase) {
        this.target = target;
        this.iteration = iteration;
        this.story = story;
        this.phase = phase;

        // 狀態檔案路徑
        const buildDir = path.join(target, `.gems/iterations/${iteration}/build`);
        if (!fs.existsSync(buildDir)) {
            fs.mkdirSync(buildDir, { recursive: true });
        }

        this.stateFile = path.join(buildDir, `.retry_state_${story}_${phase}.json`);
    }

    /**
     * 載入狀態
     */
    load() {
        if (!fs.existsSync(this.stateFile)) {
            return {
                story: this.story,
                phase: this.phase,
                retries: 0,
                errors: [],
                firstFailure: null,
                lastFailure: null
            };
        }

        try {
            const content = fs.readFileSync(this.stateFile, 'utf8');
            return JSON.parse(content);
        } catch (e) {
            return {
                story: this.story,
                phase: this.phase,
                retries: 0,
                errors: [],
                firstFailure: null,
                lastFailure: null
            };
        }
    }

    /**
     * 儲存狀態
     */
    save(state) {
        fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    }

    /**
     * 增加失敗次數
     * @param {Array} errors - 錯誤列表
     * @returns {Object} { shouldReview: boolean, context: Object }
     */
    increment(errors = []) {
        const state = this.load();

        state.retries++;
        state.errors.push({
            timestamp: new Date().toISOString(),
            count: state.retries,
            errors: errors
        });

        if (!state.firstFailure) {
            state.firstFailure = new Date().toISOString();
        }
        state.lastFailure = new Date().toISOString();

        this.save(state);

        // 3 次失敗 → 觸發 Code Review
        if (state.retries >= 3) {
            return {
                shouldReview: true,
                context: state
            };
        }

        return {
            shouldReview: false,
            context: state
        };
    }

    /**
     * 重置狀態（當 Phase 通過時）
     */
    reset() {
        if (fs.existsSync(this.stateFile)) {
            fs.unlinkSync(this.stateFile);
        }
    }

    /**
     * 取得當前狀態
     */
    getStatus() {
        return this.load();
    }
}

module.exports = { RetryTracker };
