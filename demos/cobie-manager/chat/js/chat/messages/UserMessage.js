/**
 * UserMessage — renders a user chat bubble (`demo-msg-user`).
 *
 * In the monolith, user bubbles are added via C# injected scripts calling
 * `window.addMessageWithAnimation(chatEl, 'demo-msg-user', html)`.
 * This class encapsulates the HTML template so other modules (and C#) get
 * the same markup without reaching into the DOM directly.
 */

const MD_PATTERNS = /(\*\*.+?\*\*|`.+?`|^#{1,3}\s|^\d+\.\s|^[-*]\s|\|.+\|)/m;

export class UserMessage {
  /**
   * @param {import('../state/ChatState.js').ChatState} state
   * @param {import('./MessageParser.js').MessageParser} messageParser
   */
  constructor(state, messageParser) {
    this._state = state;
    this._parser = messageParser;
  }

  /**
   * Produce the inner HTML for a user chat bubble.
   *
   * When the text contains markdown formatting (bold, code, headings, lists,
   * tables), it is rendered through the same markdown pipeline as assistant
   * messages. Plain text is escaped and wrapped in `<p>`.
   *
   * @param {string} text  Raw user input text
   * @returns {string}     Safe HTML string
   */
  render(text) {
    if (MD_PATTERNS.test(text)) {
      return '<div class="user-markdown">' + this._parser.renderMarkdown(text) + '</div>';
    }
    return '<p>' + this._parser.escapeHtml(text) + '</p>';
  }
}
