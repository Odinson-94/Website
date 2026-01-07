# Running Checklist - Chat Demo Requirements

This checklist tracks all requirements from user feedback to prevent regression.

## Step Display & Animation
- [x] Nodes aligned and connected in a single vertical line (like Claude)
- [x] Only show +/- indicators for **action steps** (steps that add/remove elements)
- [x] Thinking steps (reading, gathering, calculating) have simple dot icons
- [x] Action steps (writing, editing) have pencil icon ✎
- [x] Completed steps have green dot
- [x] Error steps have red ✗ icon
- [x] **Static containers start COLLAPSED** - only show "X steps" header, not the steps themselves
- [x] **During animation**, show only **3 steps**: first, previous, current
- [x] **Steps use `display: none` initially** - don't reserve space until revealed
- [x] Middle steps hidden during preview with `preview-hidden` class
- [x] **After animation completes, collapse back** to just showing "X steps"
- [x] Click header to expand and show all steps (`fully-expanded` class)
- [x] No scrollbar in steps list - grows naturally without max-height limit
- [x] Light rounded corner box around thinking container

## Chat Messages & Fonts
- [x] All chat messages (user, bot, prompt): `font-family: 'Inter'; font-weight: 300; font-size: 0.75rem; line-height: 1.5;`
- [x] Steps text: Inter Display Light, smaller than chat
- [x] Steps count: Inter Display Light, 20% smaller than chat, no bold
- [x] "Type yes/proceed" prompt: same font as chat messages
- [x] Filename in changes box: Inter Display Light, smaller, right-justified

## Titlebar & Panel Styling
- [x] Flat solid color titlebar (light grey #e8e8e8, not gradient)
- [x] GIF player content background matches chat window (#f8f8f8)
- [x] Chat input: rectangular (border-radius: 8px), not pill-shaped
- [x] Box shadows visible on entry (not just when pulled out)
- [x] Disabled styling on red close buttons and chat window min/max buttons

## Revit Panel Expand/Minimize/Drag
- [x] Green button triggers when GIF starts playing
- [x] Green button disabled when panel is expanded or free-floating
- [x] Yellow button snaps panel back to wrapper with smooth animation
- [x] Yellow button works even if panel was dragged out of place
- [x] Entire header bar is draggable (except actual buttons)
- [x] No "hand" grab cursor - use default cursor
- [x] FLIP animation technique for smooth transitions
- [x] No duplicate pointer logic - single mousemove/mouseup handlers
- [x] No jumps during drag or resize operations

## Resize Handles
- [x] Resize handles as invisible overlay divs for reliable event capture
- [x] Right-side (east) handle starts at 36px from top (below titlebar buttons)
- [x] Right-side handle ends 20px from bottom (doesn't overlap corner resizer)
- [x] Resize grips don't cause panel to jump

## Scroll Behavior
- [x] Chat history sidebar scrollable with mouse wheel
- [x] Scroll on chat history doesn't bubble to main view (`overscroll-behavior: contain`)
- [x] Custom scrollbar styling for chat messages and history list
- [x] Scrollbar doesn't block resize functionality

## Conversation Contexts
- [x] Drainage - SVP positions determined
- [x] Water Services - Outlets positioned
- [x] Heating & Cooling - FCUs & VRF designed (no TM59, just TM52; sizing separate from placing; ducted units only; Daikin VRF; no LTHW)
- [x] Ventilation - Grilles positioned (fresh air to rear of FCUs)
- [x] Controls & Plant - BMS points listed
- [x] Containment - Tray routes designed
- [x] Power - Distribution designed
- [x] Lighting - Luminaires placed
- [x] Fire Alarms - Devices positioned
- [x] Security & Access Control - Readers positioned

## Chat History Sidebar
- [x] Header text: "Chat History" (not "Systems")
- [x] Clicking history items loads correct conversation
- [x] "Yes/proceed" animation uses active conversation, not default

---

*Last updated: January 2026*

