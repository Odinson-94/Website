/**
 * CodeBlockResult — renders sandbox execution output below a code block.
 * Receives code_result messages with language, output, errors, exit_code, elapsed_ms.
 */

function escapeHtml(str) {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export class CodeBlockResult {
    static render(codeBlockEl, result) {
        const panel = document.createElement('div');
        panel.className = 'code-result-panel';
        panel.innerHTML = `
            <div class="code-result-header">
                <span class="code-result-lang">${result.language}</span>
                <span class="code-result-time">${result.elapsed_ms}ms</span>
                <span class="code-result-status ${result.exit_code === 0 ? 'ok' : 'err'}">
                    ${result.exit_code === 0 ? '✓' : '✗'}
                </span>
            </div>
            ${result.output ? `<pre class="code-result-stdout">${escapeHtml(result.output)}</pre>` : ''}
            ${result.errors ? `<pre class="code-result-stderr">${escapeHtml(result.errors)}</pre>` : ''}
        `;
        codeBlockEl.after(panel);
    }
}
