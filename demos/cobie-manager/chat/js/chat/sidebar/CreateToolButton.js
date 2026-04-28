/**
 * CreateToolButton — triggers the "Create Your Own" custom tool workflow.
 * When clicked, switches to Build mode and sends a starter prompt that
 * puts the AI into plan mode for tool creation.
 */
export class CreateToolButton {
  constructor(state, bridge) {
    this._state = state;
    this._bridge = bridge;
    this._el = document.querySelector('.create-tool-btn');
    if (this._el) this._attach();
  }

  _attach() {
    this._el.addEventListener('click', (e) => {
      e.preventDefault();
      this._bridge.postMessage('set_mode', 'Build');
      this._bridge.postMessage('chat',
        'I want to create a custom Revit tool. Please enter plan mode and help me describe what I need. Ask me clarifying questions about what the tool should do, what scenarios it handles, and any edge cases.');
    });
  }
}
