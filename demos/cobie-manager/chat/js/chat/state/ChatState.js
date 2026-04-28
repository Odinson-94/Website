/**
 * ChatState — centralised observable state for the AI chat UI.
 *
 * Wraps every mutable flag / collection that view6-chat.js formerly held as
 * bare `let` variables inside its IIFE.  Mutations go through setter methods
 * so the EventBus can notify any interested component.
 */
import { EventBus } from '../../shared/EventBus.js';

const TIMING = Object.freeze({
  nodeMove: 400,
  pause: 300,
  stepReveal: 350,
  collapse: 400,
});

export class ChatState {
  /** @param {EventBus} eventBus */
  constructor(eventBus) {
    this._eventBus = eventBus;

    // Conversation / UI mode
    this._activeConversation = 'risers';
    this._isAnimating = false;

    // Per-conversation completed-state + cached HTML
    this.conversationStates = {}; // { key: { completed, chatHTML } }

    // Chat sessions
    this._chatSessions = {};
    this._currentSessionId = null;
    this._sessionCounter = 0;

    // Send-guard (mirrors window.isSending from the monolith)
    this._isSending = false;

    // Sub-agents spawned from this chat
    this._agents = {};
  }

  // ------- Timing config -------
  get TIMING() { return TIMING; }

  // ------- Getters -------

  get activeConversation() { return this._activeConversation; }

  /** True while Claude is processing / streaming. */
  get isAnimating() { return this._isAnimating; }

  /** Alias used by higher-level components. */
  get isGenerating() { return this._isAnimating; }

  get currentSessionId() { return this._currentSessionId; }

  /** All chat sessions keyed by id. */
  get sessions() { return this._chatSessions; }

  get isSending() { return this._isSending; }

  /** All tracked sub-agents keyed by agentId. */
  get agents() { return this._agents; }

  // ------- Setters (emit events) -------

  /**
   * Mark whether the assistant is currently generating a response.
   * @param {boolean} value
   */
  setGenerating(value) {
    const prev = this._isAnimating;
    this._isAnimating = !!value;
    if (prev !== this._isAnimating) {
      this._eventBus.emit('state:generating', this._isAnimating);
    }
  }

  /**
   * Switch the active conversation tab (e.g. 'risers', 'corridors').
   * @param {string} key
   */
  setActiveConversation(key) {
    const prev = this._activeConversation;
    this._activeConversation = key;
    if (prev !== key) {
      this._eventBus.emit('state:conversation', key);
    }
  }

  /**
   * Register a new chat session object.
   * @param {{ id: string, title: string, messages: Array, created: Date, lastUpdated: Date }} session
   */
  addSession(session) {
    this._chatSessions[session.id] = session;
    this._eventBus.emit('state:session:added', session);
  }

  /**
   * Remove a chat session by id.
   * @param {string} id
   */
  removeSession(id) {
    delete this._chatSessions[id];
    this._eventBus.emit('state:session:removed', id);
  }

  /**
   * Switch to an existing session by id.
   * @param {string} id
   */
  setCurrentSession(id) {
    const prev = this._currentSessionId;
    this._currentSessionId = id;
    if (prev !== id) {
      this._eventBus.emit('state:session:changed', id);
    }
  }

  /**
   * Update the title of the current session with the user's first message.
   * Only applies when the session still has the default "New Chat" title.
   * Called by SendButton on every send; the guard ensures it's a no-op after the first.
   * @param {string} firstMessage
   */
  updateSessionTitle(firstMessage) {
    const sm = this.chatSessionsStore;
    if (!sm) return;
    const sid = sm.getCurrent();
    if (!sid) return;
    const session = sm.getAll()[sid];
    if (session && session.title === 'New Chat') {
      sm.updateTitle(sid, firstMessage);
    }
  }

  /**
   * Update the sending guard flag.
   * @param {boolean} value
   */
  setSending(value) {
    this._isSending = !!value;
    window.isSending = this._isSending;
    this._eventBus.emit('state:sending', this._isSending);
  }

  /**
   * Generate a unique session id (matches the monolith's `generateSessionId`).
   * @returns {string}
   */
  generateSessionId() {
    this._sessionCounter++;
    return 'chat_' + Date.now() + '_' + this._sessionCounter;
  }

  // ------- Agent state -------

  /**
   * Register a new sub-agent.
   * @param {{ agentId: string, task: string, mode: string, status: string, parentSessionId?: string }} agent
   */
  addAgent(agent) {
    this._agents[agent.agentId] = { ...agent, createdAt: new Date() };
    this._eventBus.emit('state:agent:spawned', agent);
  }

  /**
   * Update a sub-agent's status.
   * @param {string} agentId
   * @param {string} status - 'running' | 'completed' | 'failed' | 'cancelled'
   * @param {string} [result]
   */
  updateAgent(agentId, status, result) {
    if (!this._agents[agentId]) return;
    this._agents[agentId].status = status;
    if (result !== undefined) this._agents[agentId].result = result;
    this._agents[agentId].completedAt = new Date();
    this._eventBus.emit('state:agent:updated', { agentId, status, result });
  }

  /**
   * Get agents spawned from a specific parent session.
   * @param {string} parentSessionId
   * @returns {Array}
   */
  getAgentsByParent(parentSessionId) {
    return Object.values(this._agents)
      .filter(a => a.parentSessionId === parentSessionId);
  }
}
