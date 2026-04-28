/**
 * ChatStructure — Canonical ordering of one assistant turn in the transcript and
 * holder for the controller that applies bridge events in that order.
 *
 * Use `chatStructure.stream` from ChatApp for all handler methods
 * (`onThinking`, `onThought`, `onToken`, agent events, etc.).
 *
 * @see ChatTurnStreamController — DOM + timing implementation
 */

import { ChatTurnStreamController } from '../controller/ChatTurnStreamController.js';

/**
 * Ordered UI segments for a single model turn (documentation / introspection).
 * Not a runtime state machine — the stream controller interleaves these as events arrive.
 */
export const CHAT_TURN_ORDER = Object.freeze([
  'neural_node_and_thinking_shell',
  'thought_step_queue',
  'tool_progress_rows',
  'assistant_text_stream',
  'sub_agent_batch',
  'thinking_fold_and_finalize'
]);

export class ChatStructure {
  /**
   * @param {ConstructorParameters<typeof ChatTurnStreamController>[0]} deps
   */
  constructor(deps) {
    /** @type {ChatTurnStreamController} */
    this._stream = new ChatTurnStreamController(deps);
  }

  /** @returns {readonly string[]} */
  static get order() {
    return CHAT_TURN_ORDER;
  }

  /**
   * Bridge-driven turn pipeline (thinking, tools, tokens, agents, finalize).
   * @returns {ChatTurnStreamController}
   */
  get stream() {
    return this._stream;
  }
}
