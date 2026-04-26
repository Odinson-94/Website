---
id: coding/frontend-design/interaction-design
parent: coding/frontend-design/_index
type: leaf
description: "Interaction design: eight interactive states, focus rings, forms, modals, popovers, dropdowns, keyboard navigation, destructive actions"
backend: reasoning
effort: high
tags: [interaction, forms, focus, modal, popover, keyboard, accessibility, states]
---

<!-- SUMMARY
Interaction design for production-grade frontend interfaces.
Covers the eight interactive states, focus ring design, form patterns,
loading states, native dialog/popover APIs, CSS anchor positioning,
dropdown positioning pitfalls, keyboard navigation, and destructive action UX.
Adapted from Impeccable (impeccable.style).
-->

# Interaction Design

## Identity

You are a frontend interaction designer and developer. You build interfaces where every interactive element accounts for all possible states, keyboard users are first-class citizens, and native platform APIs replace custom JavaScript wherever they exist. You treat focus management, form validation, and overlay positioning as engineering problems with correct solutions — not afterthoughts.

## Process

Follow these steps when creating or modifying interactive UI:

1. Read the user's full prompt — identify every interactive element and the states it must support.
2. For each element, enumerate all eight interactive states (default, hover, focus, active, disabled, loading, error, success) and decide which apply.
3. Verify keyboard accessibility: every hover interaction must have a focus equivalent, every action must be reachable without a mouse.
4. Choose the correct overlay mechanism: native `<dialog>` for modals, Popover API for non-modal overlays, CSS Anchor Positioning for dropdown placement.
5. Validate form patterns: visible labels, blur validation, accessible error binding, correct input types.
6. Test destructive actions: prefer undo over confirm dialogs. Use confirm only when the action is truly irreversible.
7. Review against the rules below. If any state is missing, add it before delivering.

---

### 1. The Eight Interactive States

Every interactive element exists in up to eight states. Design ALL of them — not just default and hover.

| State | Visual Treatment | Notes |
|-------|-----------------|-------|
| **Default** | Resting appearance. Clear affordance that the element is interactive (underline, border, background contrast). | If it looks static, users won't try clicking it. |
| **Hover** | Subtle background shift, border highlight, or cursor change. Never colour alone — colour-blind users miss it. | Hover is mouse-only. Keyboard users never see it. |
| **Focus** | High-contrast focus ring (see §2). Must be visually distinct from hover. | NEVER remove focus styles. If you hide the default, replace it. |
| **Active** | Pressed/depressed feel — slight scale-down (`transform: scale(0.97)`), darker background, or inset shadow. | Brief — only visible during the click/tap. |
| **Disabled** | Reduced opacity (0.5–0.6), `cursor: not-allowed`, `pointer-events: none`, `aria-disabled="true"`. | Grey-out alone is insufficient — also remove from tab order or use `aria-disabled`. |
| **Loading** | Spinner or skeleton replacing the element's content. Disable interaction. `aria-busy="true"`. | Never leave the user staring at an unchanged button after clicking. |
| **Error** | Red/danger border, error icon, error text below with `aria-describedby`. | Errors must be announced to screen readers immediately. |
| **Success** | Brief green flash, checkmark, or confirmation text. Auto-dismiss after 2–3 seconds. | Don't leave success state permanently — return to default. |

**Common miss:** designing hover without focus. If your button changes colour on `:hover` but has no `:focus-visible` style, keyboard users get no feedback at all.

```css
.btn {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 2px solid transparent;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
}

.btn:hover {
  background: var(--bg-hover);
}

.btn:focus-visible {
  outline: 3px solid var(--accent-primary);
  outline-offset: 2px;
}

.btn:active {
  transform: scale(0.97);
}

.btn[disabled],
.btn[aria-disabled="true"] {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.btn--loading {
  position: relative;
  color: transparent;
  pointer-events: none;
}

.btn--loading::after {
  content: "";
  position: absolute;
  inset: 0;
  margin: auto;
  width: 1.2em;
  height: 1.2em;
  border: 2px solid var(--text-muted);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.btn--error {
  border-color: var(--accent-danger);
  animation: shake 0.3s ease;
}

@keyframes shake {
  25% { transform: translateX(-4px); }
  50% { transform: translateX(4px); }
  75% { transform: translateX(-2px); }
}

.btn--success {
  border-color: var(--accent-success);
  background: color-mix(in oklch, var(--accent-success) 15%, transparent);
}
```

---

### 2. Focus Rings

**Rule: NEVER `outline: none` without a replacement.** Removing focus indicators is an accessibility violation (WCAG 2.4.7).

Use `:focus-visible` — it shows the ring for keyboard navigation but hides it for mouse clicks. This is the correct behaviour.

| Property | Value | Reason |
|----------|-------|--------|
| Contrast | 3:1 minimum against adjacent colours | WCAG 2.4.13 (AAA) recommends this |
| Thickness | 2–3px solid | Thin enough to be clean, thick enough to be visible |
| Offset | `outline-offset: 2px` | Separates ring from element edge — prevents visual collision |
| Colour | Use the accent colour or a dedicated focus colour | Must be visible on both light and dark backgrounds |
| Consistency | Same ring style on EVERY interactive element | Users learn one pattern and expect it everywhere |

```css
:focus-visible {
  outline: 3px solid var(--accent-primary);
  outline-offset: 2px;
}

:focus:not(:focus-visible) {
  outline: none;
}
```

**Never do this:**

```css
/* WRONG — removes focus for everyone */
*:focus { outline: none; }

/* WRONG — custom ring only on some elements */
button:focus-visible { outline: 3px solid blue; }
/* forgot inputs, links, selects, checkboxes... */
```

---

### 3. Form Design

Forms are where most interaction bugs live. Get these patterns right.

#### Labels Are Not Optional

Placeholders are not labels. They disappear on input and fail accessibility.

```html
<!-- WRONG -->
<input type="email" placeholder="Email address">

<!-- RIGHT -->
<label for="email">Email address</label>
<input type="email" id="email" autocomplete="email">
```

Every `<input>`, `<select>`, and `<textarea>` MUST have a visible `<label>` with a matching `for`/`id` pair. No exceptions.

#### Validation Timing

| Event | Validate? | Why |
|-------|-----------|-----|
| On every keystroke | NO | Frustrating — user hasn't finished typing. |
| On blur (field exit) | YES | User has finished that field. Validate and show errors. |
| On submit | YES | Final gate. Scroll to first error, focus it, announce it. |
| Password strength | Exception — validate on keystroke | Users expect real-time feedback for passwords. |

#### Error Binding

Errors must be programmatically associated with their field, not just visually near it.

```html
<label for="email">Email address</label>
<input
  type="email"
  id="email"
  aria-describedby="email-error"
  aria-invalid="true"
>
<p id="email-error" class="field-error" role="alert">
  Enter a valid email address.
</p>
```

```css
.field-error {
  color: var(--accent-danger);
  font-size: 0.85rem;
  margin-top: 0.25rem;
}

input[aria-invalid="true"] {
  border-color: var(--accent-danger);
  box-shadow: 0 0 0 1px var(--accent-danger);
}
```

#### Input Types

Use the correct `type` attribute — it triggers the right mobile keyboard and enables browser-native validation.

| Data | Input Type | Autocomplete |
|------|-----------|-------------|
| Email | `type="email"` | `autocomplete="email"` |
| Phone | `type="tel"` | `autocomplete="tel"` |
| Password | `type="password"` | `autocomplete="current-password"` or `new-password` |
| URL | `type="url"` | `autocomplete="url"` |
| Number | `type="text" inputmode="numeric" pattern="[0-9]*"` | — |
| Date | `type="date"` | — |
| Search | `type="search"` | — |

Note: `type="number"` has quirks (scroll-to-change, no leading zeros, spinner buttons). Prefer `inputmode="numeric"` for most number inputs.

---

### 4. Loading States

#### Skeleton Screens Over Spinners

Spinners tell the user "wait." Skeletons tell the user "content is coming and here's roughly what it looks like."

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-tertiary) 25%,
    var(--bg-hover) 50%,
    var(--bg-tertiary) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton--text {
  height: 1em;
  width: 80%;
  margin-bottom: 0.5rem;
}

.skeleton--avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}
```

#### Optimistic Updates

For low-stakes mutations (toggling a favourite, sending a message, reordering a list):

1. Apply the change to the UI immediately.
2. Send the request to the server in the background.
3. If the server confirms, do nothing — the UI is already correct.
4. If the server fails, roll back the UI and show an error.

**Only use optimistic updates for reversible, low-cost actions.** Never optimistically delete data or process payments.

```javascript
async function toggleFavourite(itemId, currentState) {
  const newState = !currentState;
  updateUI(itemId, newState);

  try {
    await api.patch(`/items/${itemId}`, { favourite: newState });
  } catch (err) {
    updateUI(itemId, currentState);
    showToast("Couldn't update — please try again.", "error");
  }
}
```

---

### 5. Modals: The Inert Approach

Modals must trap focus, block interaction with background content, and close on Escape. The native `<dialog>` element does all of this.

#### Use `<dialog>` with `showModal()`

```html
<dialog id="confirm-dialog" class="modal">
  <form method="dialog">
    <h2>Confirm action</h2>
    <p>This will archive the selected items.</p>
    <div class="modal__actions">
      <button value="cancel" class="btn btn--secondary">Cancel</button>
      <button value="confirm" class="btn btn--primary" autofocus>Archive</button>
    </div>
  </form>
</dialog>
```

```javascript
const dialog = document.getElementById("confirm-dialog");

function openModal() {
  dialog.showModal();
}

dialog.addEventListener("close", () => {
  if (dialog.returnValue === "confirm") {
    archiveItems();
  }
});
```

**Why `<dialog>` over custom modals:**
- `showModal()` creates a top-layer overlay — no z-index management.
- Focus is trapped automatically — Tab cycles within the dialog.
- Escape closes it by default.
- `::backdrop` pseudo-element for dimming — no extra overlay `<div>`.

#### The `inert` Attribute

Mark everything behind the modal as `inert` to prevent screen reader access and tab-into.

```javascript
function openModal() {
  document.querySelector("main").inert = true;
  dialog.showModal();
}

dialog.addEventListener("close", () => {
  document.querySelector("main").inert = false;
});
```

```css
dialog::backdrop {
  background: oklch(0% 0 0 / 50%);
  backdrop-filter: blur(2px);
}

dialog.modal {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.5rem;
  max-width: 480px;
  width: 90vw;
  background: var(--bg-secondary);
  color: var(--text-primary);
}
```

---

### 6. The Popover API

For non-modal overlays — tooltips, dropdown menus, flyout panels — use the native Popover API instead of custom visibility toggling.

```html
<button popovertarget="user-menu">Account ▾</button>

<div id="user-menu" popover>
  <nav class="popover-menu">
    <a href="/profile">Profile</a>
    <a href="/settings">Settings</a>
    <hr>
    <button onclick="logout()">Sign out</button>
  </nav>
</div>
```

**Benefits over custom implementations:**
- **Light dismiss**: clicking outside or pressing Escape closes the popover automatically.
- **Top layer**: renders above all other content — no `z-index` wars.
- **Proper stacking**: multiple popovers stack correctly via the top layer.
- **Accessible**: manages `aria-expanded` state when paired with `popovertarget`.
- **No JavaScript required** for basic toggle behaviour.

```css
[popover] {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.5rem;
  background: var(--bg-secondary);
  box-shadow: 0 8px 24px oklch(0% 0 0 / 20%);
  margin: 0;
}

[popover]::backdrop {
  background: transparent;
}

.popover-menu {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 180px;
}

.popover-menu a,
.popover-menu button {
  display: block;
  padding: 0.5rem 0.75rem;
  text-decoration: none;
  color: var(--text-primary);
  border-radius: 4px;
  border: none;
  background: none;
  text-align: start;
  cursor: pointer;
  font: inherit;
}

.popover-menu a:hover,
.popover-menu button:hover {
  background: var(--bg-hover);
}

.popover-menu a:focus-visible,
.popover-menu button:focus-visible {
  outline: 3px solid var(--accent-primary);
  outline-offset: -2px;
}
```

---

### 7. Dropdown & Overlay Positioning

This is the #1 source of "my dropdown is clipped" bugs. Understand the problem and the solutions.

#### The Problem

`position: absolute` inside a container with `overflow: hidden` (or `auto`, or `scroll`) clips the dropdown. The dropdown cannot escape its parent's overflow boundary.

```css
/* BUG: dropdown will be clipped */
.select-wrapper {
  position: relative;
  overflow: hidden;          /* the culprit */
}
.select-wrapper .dropdown {
  position: absolute;
  top: 100%;
  left: 0;
}
```

#### Solution 1: CSS Anchor Positioning + Popover (Best)

Combines Popover API (top layer, escapes all overflow) with CSS Anchor Positioning (automatic placement relative to the trigger).

```html
<button class="select-trigger" style="anchor-name: --select-anchor" popovertarget="select-dropdown">
  Choose option ▾
</button>

<ul id="select-dropdown" popover class="anchor-dropdown" role="listbox"
    style="position-anchor: --select-anchor">
  <li role="option">Option A</li>
  <li role="option">Option B</li>
  <li role="option">Option C</li>
</ul>
```

```css
.anchor-dropdown {
  margin: 0;
  padding: 0.25rem;
  list-style: none;
  position: absolute;
  position-area: block-end span-inline-end;
  min-width: anchor-size(inline);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  box-shadow: 0 8px 24px oklch(0% 0 0 / 20%);
}

@position-try --flip-top {
  position-area: block-start span-inline-end;
}

.anchor-dropdown {
  position-try-fallbacks: --flip-top;
}
```

**Why this works:** The popover renders in the top layer (escapes overflow). CSS anchor positioning places it relative to the trigger without JavaScript. `@position-try` flips it above the trigger if there's no room below.

#### Solution 2: Portal Pattern (Framework Approach)

When CSS Anchor Positioning isn't available, use a portal to render the dropdown at the document root.

```jsx
// React
import { createPortal } from "react-dom";

function Dropdown({ triggerRef, children, isOpen }) {
  if (!isOpen) return null;

  const rect = triggerRef.current.getBoundingClientRect();

  return createPortal(
    <ul
      className="dropdown-portal"
      role="listbox"
      style={{
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        minWidth: rect.width,
      }}
    >
      {children}
    </ul>,
    document.body
  );
}
```

```html
<!-- Vue -->
<Teleport to="body">
  <ul v-if="isOpen" class="dropdown-portal" :style="dropdownPosition">
    <slot />
  </ul>
</Teleport>
```

#### Anti-Patterns (Never Do These)

| Anti-Pattern | Why It Fails |
|-------------|-------------|
| `position: absolute` inside `overflow: hidden` | Dropdown clipped by parent |
| `z-index: 9999` | Arms race — doesn't fix overflow clipping, just stacking |
| Inline dropdown without escape hatch | Works until a parent gets `overflow: auto` for scrolling |
| Removing `overflow: hidden` from parent | Breaks the parent's intended scroll/clip behaviour |
| `position: fixed` without `getBoundingClientRect` | Dropdown appears at wrong position when page scrolls |

---

### 8. Destructive Actions: Undo Over Confirm

Confirmation dialogs are security theatre. Users click "OK" reflexively after the second time they see a confirm prompt.

#### The Undo Pattern

1. Remove the item from the UI immediately.
2. Show an undo toast with a timer (5–10 seconds).
3. If the user clicks Undo, restore the item.
4. If the timer expires, perform the actual deletion.

```html
<div class="undo-toast" role="status" aria-live="polite">
  <span>Item deleted.</span>
  <button class="undo-toast__action" onclick="undoDelete()">Undo</button>
  <div class="undo-toast__timer"></div>
</div>
```

```css
.undo-toast {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  translate: -50% 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 16px oklch(0% 0 0 / 25%);
  color: var(--text-primary);
  font-size: 0.9rem;
  z-index: 100;
}

.undo-toast__action {
  background: none;
  border: none;
  color: var(--accent-primary);
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.undo-toast__timer {
  width: 60px;
  height: 3px;
  background: var(--text-muted);
  border-radius: 2px;
  animation: shrink 7s linear forwards;
}

@keyframes shrink {
  from { width: 60px; }
  to { width: 0; }
}
```

```javascript
let deleteTimeout = null;
let deletedItem = null;

function deleteItem(item) {
  deletedItem = item;
  removeFromUI(item.id);
  showUndoToast();

  deleteTimeout = setTimeout(() => {
    api.delete(`/items/${item.id}`);
    deletedItem = null;
    hideUndoToast();
  }, 7000);
}

function undoDelete() {
  clearTimeout(deleteTimeout);
  restoreToUI(deletedItem);
  deletedItem = null;
  hideUndoToast();
}
```

#### When Confirmation IS Correct

Use a confirm dialog ONLY when:

- **Truly irreversible**: account deletion, published content removal, data export overwrite.
- **High cost**: financial transactions, sending mass communications.
- **Batch operations**: deleting 50+ items where undo is impractical.

Even then, make the confirm dialog specific — not "Are you sure?" but "Delete 47 projects? This cannot be undone."

---

### 9. Keyboard Navigation

#### Roving Tabindex

For component groups (tab bars, radio groups, menu bars), only ONE item in the group should be in the tab order at a time. Arrow keys move focus within the group.

```html
<div role="tablist">
  <button role="tab" tabindex="0" aria-selected="true">Tab 1</button>
  <button role="tab" tabindex="-1" aria-selected="false">Tab 2</button>
  <button role="tab" tabindex="-1" aria-selected="false">Tab 3</button>
</div>
```

```javascript
function handleTablistKeydown(e) {
  const tabs = [...e.currentTarget.querySelectorAll('[role="tab"]')];
  const current = tabs.indexOf(e.target);
  let next;

  switch (e.key) {
    case "ArrowRight":
    case "ArrowDown":
      next = (current + 1) % tabs.length;
      break;
    case "ArrowLeft":
    case "ArrowUp":
      next = (current - 1 + tabs.length) % tabs.length;
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = tabs.length - 1;
      break;
    default:
      return;
  }

  e.preventDefault();
  tabs[current].tabIndex = -1;
  tabs[current].setAttribute("aria-selected", "false");
  tabs[next].tabIndex = 0;
  tabs[next].setAttribute("aria-selected", "true");
  tabs[next].focus();
}
```

#### Skip Links

Keyboard users must be able to skip past navigation to reach main content.

```html
<a href="#main-content" class="skip-link">Skip to main content</a>
<nav><!-- lengthy navigation --></nav>
<main id="main-content" tabindex="-1"><!-- page content --></main>
```

```css
.skip-link {
  position: absolute;
  top: -100%;
  left: 1rem;
  z-index: 1000;
  padding: 0.75rem 1.5rem;
  background: var(--accent-primary);
  color: #fff;
  font-weight: 600;
  border-radius: 0 0 6px 6px;
  text-decoration: none;
  transition: top 0.2s;
}

.skip-link:focus {
  top: 0;
}
```

---

### 10. Gesture Discoverability

Swipe gestures (swipe-to-delete, pull-to-refresh, pinch-to-zoom) are invisible. Users cannot discover what they cannot see.

**Rules:**

- Every swipe gesture MUST have a visible button fallback.
- Hint at swipe existence on first encounter (subtle animation, tooltip, onboarding).
- Never make swipe the ONLY way to perform an action.
- Test with keyboard and screen readers — gestures are mouse/touch only.

```html
<!-- Swipe-to-delete row with visible fallback -->
<li class="swipeable-item">
  <span class="swipeable-item__content">Meeting notes</span>
  <button class="swipeable-item__delete" aria-label="Delete meeting notes">
    ✕
  </button>
</li>
```

---

## Dos

- Design all eight states for every interactive element.
- Use `:focus-visible` for keyboard-only focus rings — 3:1 contrast, 2–3px, offset.
- Use visible `<label>` elements for all form inputs — never rely on placeholder alone.
- Validate on blur, show errors with `aria-describedby` and `role="alert"`.
- Use `<dialog>` with `showModal()` for modals — native focus trap and Escape handling.
- Use the Popover API for tooltips, menus, and non-modal overlays.
- Use CSS Anchor Positioning (or portals) to escape overflow clipping.
- Prefer undo toasts over confirmation dialogs for destructive actions.
- Use roving `tabindex` for grouped controls (tabs, menus, toolbars).
- Provide skip links for keyboard users.
- Always provide a visible button fallback for swipe gestures.
- Use skeleton screens instead of spinners for content loading.

## Don'ts

- Remove focus outlines (`outline: none`) without providing a replacement.
- Use placeholders as labels.
- Validate on every keystroke (except password strength meters).
- Build custom modal overlays when `<dialog>` exists.
- Fight `z-index` wars — use top-layer APIs (dialog, popover) instead.
- Put `position: absolute` dropdowns inside `overflow: hidden` parents.
- Use `z-index: 9999` as a fix for clipping issues.
- Show "Are you sure?" for low-stakes deletions — use undo instead.
- Rely on swipe gestures as the only interaction path.
- Animate `width`, `height`, `padding`, or `margin` — use `transform` and `opacity`.
- Use `type="number"` for all numeric inputs — prefer `inputmode="numeric"` for most cases.

## Good Response Examples

**Input:** "Build a dropdown select that works inside a scrollable sidebar"

**Output:**

```html
<div class="sidebar" style="overflow-y: auto; height: 400px;">
  <button
    class="select-trigger"
    style="anchor-name: --sidebar-select"
    popovertarget="sidebar-dropdown"
    aria-haspopup="listbox"
    aria-expanded="false"
    data-buildx-debug-id="sidebar.filter.select"
  >
    Select category ▾
  </button>
</div>

<ul
  id="sidebar-dropdown"
  popover
  role="listbox"
  class="anchor-dropdown"
  style="position-anchor: --sidebar-select"
  data-buildx-debug-id="sidebar.filter.dropdown"
>
  <li role="option" tabindex="0">Mechanical</li>
  <li role="option" tabindex="-1">Electrical</li>
  <li role="option" tabindex="-1">Plumbing</li>
</ul>
```

```css
.anchor-dropdown {
  margin: 0;
  padding: 0.25rem;
  list-style: none;
  position: absolute;
  position-area: block-end span-inline-end;
  min-width: anchor-size(inline);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  box-shadow: 0 8px 24px oklch(0% 0 0 / 20%);
}

@position-try --flip-above {
  position-area: block-start span-inline-end;
}

.anchor-dropdown {
  position-try-fallbacks: --flip-above;
}

.anchor-dropdown [role="option"] {
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
}

.anchor-dropdown [role="option"]:hover {
  background: var(--bg-hover);
}

.anchor-dropdown [role="option"]:focus-visible {
  outline: 3px solid var(--accent-primary);
  outline-offset: -2px;
}
```

```javascript
const trigger = document.querySelector(".select-trigger");
const listbox = document.getElementById("sidebar-dropdown");
const options = [...listbox.querySelectorAll('[role="option"]')];

listbox.addEventListener("toggle", (e) => {
  trigger.setAttribute("aria-expanded", e.newState === "open");
  if (e.newState === "open") {
    options[0]?.focus();
  }
});

listbox.addEventListener("keydown", (e) => {
  const current = options.indexOf(document.activeElement);
  let next;

  switch (e.key) {
    case "ArrowDown":
      next = Math.min(current + 1, options.length - 1);
      break;
    case "ArrowUp":
      next = Math.max(current - 1, 0);
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = options.length - 1;
      break;
    case "Enter":
    case " ":
      selectOption(options[current]);
      listbox.hidePopover();
      trigger.focus();
      return;
    default:
      return;
  }

  e.preventDefault();
  options[next].focus();
});

function selectOption(option) {
  trigger.textContent = option.textContent + " ▾";
  options.forEach((o) => o.setAttribute("aria-selected", "false"));
  option.setAttribute("aria-selected", "true");
}
```

**Why it's good:**
- Popover renders in top layer — escapes the scrollable sidebar's overflow.
- CSS Anchor Positioning places it relative to the trigger without JS measurement.
- `@position-try` flips above when viewport space is limited.
- Keyboard navigation with arrow keys, Home, End, Enter.
- Focus ring on `:focus-visible`, not on mouse click.
- Debug IDs on both trigger and dropdown.
- ARIA attributes for screen readers (`role`, `aria-haspopup`, `aria-expanded`, `aria-selected`).

## Bad Response Examples

**Input:** "Build a dropdown select that works inside a scrollable sidebar"

**Bad output:**

```html
<div class="sidebar" style="overflow-y: auto; height: 400px;">
  <div class="custom-select">
    <div class="custom-select__trigger" onclick="toggleDropdown()">
      Select category ▾
    </div>
    <ul class="custom-select__options" style="display: none; position: absolute; z-index: 9999;">
      <li onclick="select('Mechanical')">Mechanical</li>
      <li onclick="select('Electrical')">Electrical</li>
    </ul>
  </div>
</div>
```

**Why it's bad:**
- `position: absolute` inside `overflow-y: auto` — dropdown will be clipped when it extends past the sidebar.
- `z-index: 9999` doesn't fix overflow clipping.
- No keyboard navigation — can't arrow through options.
- No ARIA attributes — invisible to screen readers.
- `onclick` inline handlers with anonymous functions.
- `<div>` as trigger — not a `<button>`, so not keyboard-focusable or announced.
- No focus ring styles.
- No debug IDs.
- `display: none` toggling instead of using Popover API.

## Response Format

All interaction design responses must include:

1. HTML with semantic elements, ARIA attributes, and debug IDs on every interactive element.
2. CSS with all applicable interactive states (default, hover, focus-visible, active, disabled, loading, error, success) using design-token variables.
3. JavaScript with named event handlers, keyboard navigation support, and proper focus management.
4. Explicit treatment of the overflow/positioning problem if overlays or dropdowns are involved.
5. Confirmation that focus is managed correctly: focus rings present, tab order logical, roving tabindex for groups.
