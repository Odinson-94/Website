/**
 * MessageParser — lightweight Markdown-to-HTML conversion.
 *
 * Extracted from view6-chat.js `renderMarkdown()` (≈line 1373) and
 * `escapeHtml()` (≈line 1367).  No dependencies — pure string transforms.
 */
/**
 * Escape HTML entities so user / assistant text cannot inject markup.
 * Uses the DOM's own textContent → innerHTML round-trip.
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export class MessageParser {
  escapeHtml(text) {
    return escapeHtml(text);
  }

  /**
   * Convert a plain-text message into styled HTML.
   *
   * Supports bold, italic, inline code, numbered / bullet lists,
   * "Note stored" and "Memory updated" callout cards, and line breaks.
   *
   * @param {string} text  Raw plain text (may contain markdown-ish syntax)
   * @returns {string}      HTML string safe to assign to innerHTML
   */
  renderMarkdown(text) {
    if (!text) return '';

    // Preserve assistant/tool-issued session links before escape (Revit internal navigation).
    const linkPlaceholders = [];
    const stripChatSessionSpans = (src) => {
      const patterns = [
        /<span\s+[^>]*class="chat-session-link"[^>]*data-session-id="([^"]+)"[^>]*>([^<]*)<\/span>/gi,
        /<span\s+[^>]*data-session-id="([^"]+)"[^>]*class="chat-session-link"[^>]*>([^<]*)<\/span>/gi,
      ];
      let s = src;
      for (const re of patterns) {
        s = s.replace(re, (_m, id, label) => {
          const safeId = String(id).replace(/[^a-zA-Z0-9_.-]/g, '');
          const safeLabel = escapeHtml(String(label));
          const ph = `<span class="chat-session-link" data-session-id="${safeId}">${safeLabel}</span>`;
          const key = `__CHAT_SESSION_LINK_${linkPlaceholders.length}__`;
          linkPlaceholders.push(ph);
          return key;
        });
      }
      return s;
    };

    let work = stripChatSessionSpans(text);
    let html = this.escapeHtml(work);

    linkPlaceholders.forEach((ph, i) => {
      const key = `__CHAT_SESSION_LINK_${i}__`;
      html = html.split(key).join(ph);
    });

    // Bold: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic: *text* (negative lookahead/behind to avoid matching bold)
    html = html.replace(
      /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,
      '<em>$1</em>',
    );

    // Inline code: `text`
    html = html.replace(
      /`([^`]+)`/g,
      '<code style="background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:3px;font-size:0.9em;font-family:\'Consolas\',monospace;">$1</code>',
    );

    // "Note stored:" callout card
    html = html.replace(
      /(?:<strong>)?Note stored:?(?:<\/strong>)?:?\s*(.+?)(?:<br>|$)/gi,
      '<div style="background:rgba(74,155,184,0.08);border-left:2px solid #4a9bb8;padding:4px 8px;margin:4px 0;border-radius:0 4px 4px 0;font-family:\'Inter\',sans-serif;font-size:0.66rem;line-height:1.6;"><span style="color:#4a9bb8;font-weight:500;">\u{1F516} Noted:</span> $1</div>',
    );

    // "Memory updated:" callout card
    html = html.replace(
      /(?:<strong>)?Memory updated:?(?:<\/strong>)?:?\s*(.+?)(?:<br>|$)/gi,
      '<div style="background:rgba(76,217,100,0.08);border-left:2px solid #4CD964;padding:4px 8px;margin:4px 0;border-radius:0 4px 4px 0;font-family:\'Inter\',sans-serif;font-size:0.66rem;line-height:1.6;"><span style="color:#4CD964;font-weight:500;">\u{1F4BE} Memory:</span> $1</div>',
    );

    // Numbered lists: "1. text"
    html = html.replace(
      /(?:^|<br>)(\d+)\.\s+(.+?)(?=<br>\d+\.|<br>$|$)/g,
      '<div style="display:flex;gap:6px;padding:3px 0;"><span style="color:#4a9bb8;font-weight:500;flex-shrink:0;">$1.</span><span>$2</span></div>',
    );

    // Bullet lists: "- text" or "• text"
    html = html.replace(
      /(?:^|<br>)[-\u2022]\s+(.+?)(?=<br>[-\u2022]|<br>$|$)/g,
      '<div style="display:flex;gap:6px;padding:2px 0;"><span style="color:#666;flex-shrink:0;">\u2022</span><span>$1</span></div>',
    );

    // Markdown tables: | col | col | with | --- | separator
    html = this._renderTables(html);

    // Remaining newlines → <br>
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  _renderTables(html) {
    // Split by lines, find table blocks (consecutive lines starting with |)
    const lines = html.split(/\n|<br>/);
    const result = [];
    let tableLines = [];
    let inTable = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        inTable = true;
        tableLines.push(trimmed);
      } else {
        if (inTable && tableLines.length >= 2) {
          result.push(this._buildTable(tableLines));
          tableLines = [];
          inTable = false;
        } else if (inTable) {
          // Not enough lines for a table, put them back
          result.push(...tableLines);
          tableLines = [];
          inTable = false;
        }
        result.push(line);
      }
    }
    if (inTable && tableLines.length >= 2) {
      result.push(this._buildTable(tableLines));
    } else if (tableLines.length > 0) {
      result.push(...tableLines);
    }

    return result.join('\n');
  }

  _buildTable(lines) {
    let headerRow = lines[0];
    let startIdx = 1;

    // Skip separator row (|---|---|)
    if (lines.length > 1 && /^\|[\s\-:|]+\|$/.test(lines[1].trim())) {
      startIdx = 2;
    }

    const parseRow = (row) =>
      row.split('|').slice(1, -1).map(c => c.trim());

    const headers = parseRow(headerRow);
    let tableHtml = '<div class="table-scroll"><table><thead><tr>';
    for (const h of headers) {
      tableHtml += `<th>${h}</th>`;
    }
    tableHtml += '</tr></thead><tbody>';

    for (let i = startIdx; i < lines.length; i++) {
      const cells = parseRow(lines[i]);
      tableHtml += '<tr>';
      for (const c of cells) {
        tableHtml += `<td>${c}</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table></div>';
    return tableHtml;
  }
}
