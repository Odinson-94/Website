/**
 * TokenStatusBar — displays token usage stats from C# after a response completes.
 * Receives token_stats messages with prompt_tokens, completion_tokens, cache_hit, and route.
 */
export class TokenStatusBar {
    constructor(container) {
        this._el = document.createElement('div');
        this._el.className = 'token-status-bar';
        this._el.style.display = 'none';
        container.appendChild(this._el);
    }

    update(data) {
        const prompt = data.prompt_tokens ?? 0;
        const completion = data.completion_tokens ?? 0;
        const cacheHit = data.cache_hit != null
            ? `${(data.cache_hit * 100).toFixed(0)}%`
            : '—';
        const route = data.route || '';

        this._el.style.display = 'flex';
        this._el.innerHTML = `
            <span class="token-stat"><span class="token-stat-label">Prompt</span> ${prompt.toLocaleString()}</span>
            <span class="token-stat"><span class="token-stat-label">Completion</span> ${completion.toLocaleString()}</span>
            <span class="token-stat"><span class="token-stat-label">Cache</span> ${cacheHit}</span>
            ${route ? `<span class="token-stat token-stat-route">${route}</span>` : ''}
        `;
    }

    hide() {
        this._el.style.display = 'none';
    }
}
