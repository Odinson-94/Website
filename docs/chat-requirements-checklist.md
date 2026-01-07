# Chat UI Requirements Checklist

## Running checklist of all requirements for the chat/thinking steps UI.

---

## ✅ Completed

### Visual Design
- [x] **Nodes aligned vertically** with connecting line (like Claude)
- [x] **Better pencil symbol** — changed from ✏ to ✎
- [x] **Filename styling** — Inter Display Light, smaller (0.65rem), right-aligned
- [x] **Color matching** — chat-persistent-node-wrapper matches chatMessagesIndex4 (#f8f8f8 / #252525)

### Step Type Distinction (per chat-step-strategy.md)
- [x] **Thinking steps** — grey dot, no +/-, no filename
- [x] **Action steps** — pencil icon, +/- in styled box, filename
- [x] **Done steps** — green check

### Conversation Switching
- [x] **History items clickable** — clicking loads different conversation
- [x] **Water Services conversation** — full flow with analysis + design phases
- [x] **"Yes/proceed" uses correct conversation** — not hardcoded to drainage

### Neural Node Animation Workflow
- [x] Node moves LEFT
- [x] Node starts PULSING
- [x] Steps reveal ONE BY ONE
- [x] Steps COLLAPSE after completion
- [x] Final message appears
- [x] Thinking container STAYS (expandable)
- [x] Node moves RIGHT
- [x] Node stops pulsing

### Scroll Behavior
- [x] **Chat messages scroll containment** — mouse wheel doesn't change views
- [x] **History sidebar scroll containment** — mouse wheel doesn't change views

### Animation Polish
- [x] **Smoother final message** — fade-in with translateY animation

### Code Organization
- [x] **Separate view4-chat.js** — dedicated file for View 4 chat functionality
- [x] **Strategy document** — docs/chat-step-strategy.md created

---

## 📋 Pending / Future

- [ ] Other chat contexts (Heating, Ventilation, Controls) need review
- [ ] Consistent step content across all conversations
- [ ] Mobile responsiveness for chat history sidebar

---

## 📚 Reference Files

| File | Purpose |
|------|---------|
| `js/view4-chat.js` | View 4 chat controller with conversations |
| `css/thinking-animation.css` | Thinking step styling |
| `docs/chat-step-strategy.md` | Strategy for thinking vs action steps |
| `docs/chat-requirements-checklist.md` | This checklist |

---

## 🔧 Key Rules (from chat-step-strategy.md)

1. **Forecasting ≠ Action** — Forecasting clashes is thinking, not action
2. **Reading ≠ Action** — Reading files/specs/drawings is always thinking
3. **Only show +/- when elements change** — If nothing added/removed, it's thinking
4. **Filename only on action steps** — Indicates which file was modified
5. **Use past-tense for completed** — "Placed" vs "Placing"

