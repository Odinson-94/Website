/**
 * GrindProgressBar — renders grind status in the chat UI.
 * Receives grind_status messages from C# J3ChunkDispatcher with round, token count, and status.
 */
export class GrindProgressBar {
    constructor(container) {
        this._el = document.createElement('div');
        this._el.className = 'grind-progress-bar';
        this._el.style.display = 'none';
        container.prepend(this._el);
    }

    show(round, tokens, message) {
        this._el.style.display = 'flex';
        this._el.innerHTML = `
            <span class="grind-icon">⚡</span>
            <span class="grind-round">Round ${round}</span>
            <span class="grind-tokens">${(tokens / 1000).toFixed(1)}k tokens</span>
            <span class="grind-msg">${message}</span>
        `;
    }

    hide() {
        this._el.style.display = 'none';
    }
}
