/**
 * Jupiter Content Blocks — Inline rendering for Jupiter tool results.
 *
 * Each block is self-contained. Deleting any block file does NOT break the tools —
 * tool results simply render as raw JSON in the assistant message instead.
 *
 * Convention: tools that return {"__content_block__": "block_type", ...} trigger
 * these blocks. The dispatcher (JupiterBlockDispatcher.js) checks for that key
 * in tool results and calls the matching block renderer.
 *
 * To disable all content blocks: delete this folder. Tools keep working.
 * To disable one block: delete that .js file. That tool's results render as text.
 */

import { SearchResultsBlock } from './SearchResultsBlock.js';
import { PagePreviewBlock } from './PagePreviewBlock.js';
import { InlineImageBlock } from './InlineImageBlock.js';
import { ImageGalleryBlock } from './ImageGalleryBlock.js';
import { PlanModeBlock } from './PlanModeBlock.js';
import { UserInputBlock } from './UserInputBlock.js';
import { MessageVariantBlock } from './MessageVariantBlock.js';
import { VisualizeBlock } from './VisualizeBlock.js';

const _BLOCKS = {};

function _register(name, renderer) {
  _BLOCKS[name] = renderer;
}

// Register all blocks — each is optional
try { _register('search_results', SearchResultsBlock); } catch(e) { /* block not available */ }
try { _register('page_preview', PagePreviewBlock); } catch(e) { /* block not available */ }
try { _register('inline_image', InlineImageBlock); } catch(e) { /* block not available */ }
try { _register('image_gallery', ImageGalleryBlock); } catch(e) { /* block not available */ }
try { _register('plan_mode', PlanModeBlock); } catch(e) { /* block not available */ }
try { _register('user_input_form', UserInputBlock); } catch(e) { /* block not available */ }
try { _register('message_variants', MessageVariantBlock); } catch(e) { /* block not available */ }
try { _register('visualize_widget', VisualizeBlock); } catch(e) { /* block not available */ }

/**
 * Try to render a tool result as a content block.
 * @param {object} toolResult - parsed JSON tool result
 * @param {HTMLElement} container - chat message container to append into
 * @param {object} bridge - WebViewBridge instance for sending messages back
 * @returns {boolean} true if a block was rendered, false if no __content_block__ match
 */
export function tryRenderContentBlock(toolResult, container, bridge) {
  if (!toolResult || typeof toolResult !== 'object') return false;
  const blockType = toolResult.__content_block__;
  if (!blockType || !_BLOCKS[blockType]) return false;

  try {
    const el = _BLOCKS[blockType].render(toolResult, bridge);
    if (el) {
      container.appendChild(el);
      return true;
    }
  } catch (e) {
    console.warn(`[JupiterBlock] Failed to render ${blockType}:`, e);
  }
  return false;
}
