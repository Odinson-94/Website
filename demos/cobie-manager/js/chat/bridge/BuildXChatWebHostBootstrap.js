// ═══════════════════════════════════════════════════════════════════════
// BuildXChatWebHostBootstrap.js
// STATUS: UNLOCKED
// ═══════════════════════════════════════════════════════════════════════
//
// DESIGN:  Runs BEFORE ChatApp.js on non-Revit, non-WebView2 hosts
//          (qa-manager.adelphos.ai/chat/, document-controller.adelphos.ai
//          in a future PR, any other browser-embedded host). It:
//
//            1. Detects the host via the usual `window.chrome?.webview`
//               probe. If that's present we're inside Revit or a WPF
//               WebView2 shell — do nothing; the C# side owns the bridge.
//
//            2. Otherwise fetches /chat/config.json (written by the
//               deploy workflow from GH secrets) to resolve:
//                 - proxyUrl          (Supabase claude-proxy URL)
//                 - appToken          (x-mepbridge-token header)
//                 - supabaseAnonKey   (Authorization: Bearer <anon>)
//                 - agenticBridge     (optional agentic queue config)
//
//            3. Installs a shim at `window.chrome.webview` so the
//               existing WebViewBridge.js → ChatApp.js code path thinks
//               it has a host. Outbound postMessage calls are routed to
//               JS handlers inside this bootstrap:
//
//                 - 'chat'              — POST to Claude proxy via SSE
//                                         and stream tokens back as
//                                         message events to the bridge
//                                         listeners (same shape as C#).
//                 - 'get_mentionables'  — read the last snapshot the
//                                         host app posted to
//                                         window.__BUILDX_MENTIONABLES
//                                         (the QA React app pushes this
//                                         via window.postMessage from
//                                         the parent frame).
//                 - 'clear' / 'stop'    — no-op on web (future: reset).
//                 - everything else     — logged + ignored with a
//                                         helpful console message so
//                                         we know which bridge action
//                                         needs a web implementation.
//
//            4. Renders a visible "web host" banner when config.json is
//               missing so a visitor knows chat is read-only until the
//               deploy workflow writes the file.
//
// ─────────────────────────────────────────────────────────────────────
// CALLS:    fetch, window.chrome.webview shim
// CALLED BY: wwwroot/index.html <head> — loaded unconditionally; the
//            detectHost() check makes it a no-op under Revit/WebView2.
//
// <keywords>buildx chat web host, browser shim, claude proxy bridge,
//           qa-manager chat, document-controller chat, non-revit host</keywords>

(function initBuildXChatWebHost() {
    'use strict';

    // ── 1. Skip entirely when we're already inside a WebView2 host ────
    //    The C# AIChatPanelView provides the real bridge. Leave it
    //    alone so every existing listener / postMessage path keeps
    //    working in Revit and the QA Manager EXE.
    if (typeof window.chrome !== 'undefined' &&
        typeof window.chrome.webview !== 'undefined') {
        window.__BUILDX_HOST__ = window.__BUILDX_HOST__ || 'webview2';
        console.log('[BuildXChat] WebView2 host detected — shim skipped.');
        return;
    }

    window.__BUILDX_HOST__ = 'web';

    // ── 2. Small pub/sub so the shim can fan out messages to listeners
    //    added via addEventListener('message', ...).
    const _listeners = new Set();
    function _dispatch(eventLike) {
        _listeners.forEach((fn) => {
            try { fn(eventLike); }
            catch (err) { console.error('[BuildXChat] listener error', err); }
        });
    }

    // ── 3. Load runtime config (proxy URL + auth). Gracefully degrade
    //    to read-only if missing so the chat UI still renders.
    const configPromise = fetch('config.json', { cache: 'no-store' })
        .then((r) => {
            if (!r.ok) throw new Error('config.json HTTP ' + r.status);
            return r.json();
        })
        .catch((err) => {
            console.warn('[BuildXChat] config.json not available:', err.message);
            _showReadOnlyBanner(
                'BUILD X. Chat is in read-only demo mode — ' +
                '/chat/config.json is not configured on this host.');
            return null;
        });

    // ── 4. Mention snapshot surface. The outer React app posts
    //    `{type:'mentionables-snapshot', items:[…]}` to this iframe;
    //    when the user types `@` the shim replies from this cache.
    window.__BUILDX_MENTIONABLES = [];
    window.addEventListener('message', (event) => {
        try {
            const data = event.data;
            if (!data || typeof data !== 'object') return;
            if (data.type === 'mentionables-snapshot' && Array.isArray(data.items)) {
                window.__BUILDX_MENTIONABLES = data.items;
                console.log('[BuildXChat] mentionables snapshot ← parent: ' + data.items.length + ' items');
            }
        } catch (err) {
            console.error('[BuildXChat] parent message error', err);
        }
    });

    // ── 5. Install the shim. Same surface as window.chrome.webview.
    const _outgoingHandlers = {
        get_mentionables: handleGetMentionables,
        chat: handleChat,
        stop: handleStop,
        clear: handleClear,
    };

    window.chrome = window.chrome || {};
    window.chrome.webview = {
        postMessage(msg) {
            let parsed = msg;
            if (typeof msg === 'string') {
                try { parsed = JSON.parse(msg); } catch { parsed = { raw: msg }; }
            }
            const { type, payload } = parsed || {};
            const handler = _outgoingHandlers[type];
            if (handler) {
                try { handler(payload); }
                catch (err) { _emitError('handler:' + type, err); }
                return;
            }
            console.debug('[BuildXChat] postMessage("' + type + '") → no web-host handler; ignoring.');
        },
        addEventListener(name, fn) {
            if (name !== 'message') return;
            _listeners.add(fn);
        },
        removeEventListener(name, fn) {
            if (name !== 'message') return;
            _listeners.delete(fn);
        },
    };

    // ── 6. Handlers ────────────────────────────────────────────────

    function handleGetMentionables() {
        _emitMessage({ type: 'mentionables', payload: JSON.stringify(window.__BUILDX_MENTIONABLES || []) });
    }

    function handleStop() {
        _emitMessage({ type: 'status', payload: 'Stop is a no-op in web host.' });
    }

    function handleClear() {
        _emitMessage({ type: 'status', payload: 'Conversation cleared.' });
    }

    /**
     * SSE round-trip to the Supabase claude-proxy. Streams the tokens
     * back as `assistant_token` bridge messages; emits `assistant_done`
     * at the end so the ChatApp message flow settles.
     *
     * When config.json is missing we short-circuit with a helpful
     * assistant message instead of silently failing.
     */
    async function handleChat(userText) {
        const cfg = await configPromise;
        if (!cfg || !cfg.proxyUrl || !cfg.appToken || !cfg.supabaseAnonKey) {
            _emitMessage({
                type: 'assistant_token',
                payload: [
                    "I can't reach the Claude proxy from this host yet.",
                    "BUILD X. Chat on the web is still awaiting the",
                    "`BUILDX_CHAT_PROXY_URL`, `BUILDX_CHAT_APP_TOKEN` and",
                    "`BUILDX_CHAT_SUPABASE_ANON_KEY` secrets. Open",
                    "QAManager.Desktop or the MEPBridge Revit add-in and",
                    "you'll get the full tool-aware chat.",
                ].join(' '),
            });
            _emitMessage({ type: 'assistant_done', payload: '' });
            return;
        }

        try {
            const res = await fetch(cfg.proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + cfg.supabaseAnonKey,
                    'x-mepbridge-token': cfg.appToken,
                    'x-user-id': _resolveUserId(cfg),
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-5-20250929',
                    max_tokens: 8000,
                    messages: [{ role: 'user', content: typeof userText === 'string' ? userText : JSON.stringify(userText) }],
                    stream: true,
                }),
            });

            if (!res.ok || !res.body) {
                const body = await _safeRead(res);
                _emitError('proxy:' + res.status, new Error(body || res.statusText));
                _emitMessage({ type: 'assistant_done', payload: '' });
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop() || '';
                for (const block of parts) {
                    for (const line of block.split('\n')) {
                        if (!line.startsWith('data:')) continue;
                        const jsonStr = line.slice(5).trim();
                        if (!jsonStr || jsonStr === '[DONE]') continue;
                        try {
                            const evt = JSON.parse(jsonStr);
                            if (evt.type === 'content_block_delta' &&
                                evt.delta && evt.delta.type === 'text_delta' &&
                                typeof evt.delta.text === 'string') {
                                _emitMessage({ type: 'assistant_token', payload: evt.delta.text });
                            }
                        } catch { /* not every SSE line is JSON */ }
                    }
                }
            }

            _emitMessage({ type: 'assistant_done', payload: '' });
        } catch (err) {
            _emitError('chat', err);
            _emitMessage({ type: 'assistant_done', payload: '' });
        }
    }

    // ── 7. Helpers ────────────────────────────────────────────────

    function _emitMessage(msg) {
        _dispatch({ data: JSON.stringify(msg) });
    }

    function _emitError(where, err) {
        console.error('[BuildXChat] ' + where + ':', err);
        _emitMessage({ type: 'error', payload: String(err && err.message || err) });
    }

    async function _safeRead(res) {
        try { return await res.text(); }
        catch { return ''; }
    }

    function _resolveUserId(cfg) {
        // Stable per-browser id so Supabase rate-limits work.
        try {
            const KEY = 'buildxchat.user-id';
            let id = localStorage.getItem(KEY);
            if (!id) {
                id = 'web-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
                localStorage.setItem(KEY, id);
            }
            return id;
        } catch {
            return 'web-anonymous';
        }
    }

    function _showReadOnlyBanner(message) {
        try {
            if (document.getElementById('buildx-read-only-banner')) return;
            const banner = document.createElement('div');
            banner.id = 'buildx-read-only-banner';
            banner.setAttribute('role', 'status');
            banner.style.cssText = [
                'position:fixed',
                'top:0', 'left:0', 'right:0',
                'z-index:99999',
                'padding:8px 16px',
                'background:linear-gradient(90deg, rgba(245,158,11,0.18), rgba(245,158,11,0.02))',
                'border-bottom:1px solid #3a3a3a',
                'color:#E8E8E8',
                "font-family:'Segoe UI', system-ui, -apple-system, sans-serif",
                'font-size:12px',
                'letter-spacing:0.2px',
            ].join(';');
            banner.textContent = message;
            if (document.body) {
                document.body.insertBefore(banner, document.body.firstChild);
            } else {
                window.addEventListener('DOMContentLoaded', () => {
                    document.body.insertBefore(banner, document.body.firstChild);
                });
            }
        } catch (err) {
            console.error('[BuildXChat] banner failed', err);
        }
    }
})();
