# SPECBUILDER CHAT PANEL CHECKLIST

## Features Status
| # | Item | Status |
|---|------|--------|
| 1 | Window resize (8 edges) | ✓ |
| 2 | Titlebar drag | ✓ |
| 3 | Snap-back zone (top 1/3) | ✓ |
| 4 | Green btn (+30%w/+10%h) | ✓ |
| 5 | Yellow btn (snap back) | ✓ |
| 6 | Inner resizer (chat|history) | ✓ |
| 7 | Center|right resizer (chat only) | ✓ |
| 8 | Dropdowns on hover | ✓ |
| 9 | Tooltips on hover | ✓ |
| 10 | Steps show 3 (first + last 2) | ✓ |
| 11 | Steps fold/unfold correctly | ✓ |
| 12 | All conversations use same template | ✓ |
| 13 | Animation works | ✓ |
| 14 | Div balance (132/132) | ✓ |

## CONSOLIDATION COMPLETED

### What was done:
1. **Removed static HTML** from chat-panel.html (63 lines of hardcoded thinking containers)
2. **Updated conversations.drainage** in view4-chat.js with EXACT content from static HTML
3. **Changed init()** to call `loadConversation('drainage')` on page load

### Architecture now:
- ONE `createThinkingContainer()` function builds ALL static containers
- ONE `runNeuralNodeWorkflow()` function handles ALL animations
- ONLY the step content/data changes per conversation
- All behavior is consistent across drainage, water, heating, etc.

### Key files changed:
- `chat-panel.html`: Removed lines 968-1030 (static thinking containers)
- `view4-chat.js`: Updated conversations.drainage data, init() calls loadConversation()
