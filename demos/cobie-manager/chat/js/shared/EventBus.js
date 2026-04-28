/**
 * Shared EventBus — pub/sub for decoupled component communication.
 * Used by both AI Chat UI and QA Manager UI.
 */
export class EventBus {
  constructor() {
    this._listeners = {};
  }

  on(event, fn) {
    (this._listeners[event] ??= []).push(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    this._listeners[event] = this._listeners[event]?.filter(f => f !== fn);
  }

  emit(event, data) {
    this._listeners[event]?.forEach(fn => fn(data));
  }
}
