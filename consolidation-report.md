# CSS Consolidation Report

## Per-file rule counts

| File | Rules | KB |
|------|-------|----|
| `chat-panel/css/chat-panel.css` | 664 | 92.9 |
| `chat-panel/css/thinking-animation.css` | 110 | 14.2 |
| `css/chat-panel.css` | 674 | 95.8 |
| `css/clash-manager.css` | 212 | 26.1 |
| `css/index-styles.css` | 1055 | 158.0 |
| `css/shared-styles.css` | 229 | 32.9 |
| `css/thinking-animation.css` | 110 | 14.2 |
| `sandbox/sandbox.css` | 263 | 49.4 |

## Bucket classification

| Bucket | Rules in source | Rules after dedup | Merged | % saved |
|--------|-----------------|-------------------|--------|---------|
| `chat` | 1547 | 644 | 903 | 58% |
| `sandbox` | 85 | 79 | 6 | 7% |
| `shared` | 646 | 362 | 284 | 44% |
| `page` | 1016 | 588 | 428 | 42% |
| `generic` | 23 | 13 | 10 | 43% |

## Stale-copy candidates (pairwise overlap ≥ 30%)

### `css/thinking-animation.css`  ⇄  `chat-panel/css/thinking-animation.css`
- Identical rules:           **110**
- Same selector, drifted:    0
- Only in `css/thinking-animation.css`:    0
- Only in `chat-panel/css/thinking-animation.css`:    0
- A is **100%** identical to B  ·  B is **100%** identical to A

### `css/chat-panel.css`  ⇄  `chat-panel/css/chat-panel.css`
- Identical rules:           **634**
- Same selector, drifted:    29
- Only in `css/chat-panel.css`:    40
- Only in `chat-panel/css/chat-panel.css`:    30
- A is **94%** identical to B  ·  B is **95%** identical to A

### `css/index-styles.css`  ⇄  `css/chat-panel.css`
- Identical rules:           **204**
- Same selector, drifted:    82
- Only in `css/index-styles.css`:    850
- Only in `css/chat-panel.css`:    470
- A is **19%** identical to B  ·  B is **30%** identical to A

## Top body-dedup wins (rules merged into one selector list)

### chat
- **37 rules** → 1 (selectors: `.chat-thinking-header.done`, `.demo-chat-input-row.cursor-style .chat-meeting-btn:hover`, `.demo-chat-input-row.cursor-style .chat-share-btn:hover`, `html.dark-mode .chat-node-status`…)
- **28 rules** → 1 (selectors: `.demo-history-item .buffering-indicator`, `.demo-history-item.agent-item.hidden`, `.demo-history-item.complete .agent-progress-ring`, `.demo-outputs-section.project-structure .tree-folder:not(.expanded) > .tree-folder-content`…)
- **21 rules** → 1 (selectors: `.demo-view-overlay .design-tab.active .tab-label`, `html.dark-mode #schedulesOverlay .qa-ribbon .ribbon-tab`, `html.dark-mode .chat-model-dropdown .menu-icon`, `html.dark-mode .demo-chat-input-row.cursor-style .mode-icon`…)
- **18 rules** → 1 (selectors: `html.dark-mode #schedulesOverlay .qa-ribbon .ribbon-btn`, `html.dark-mode #schedulesOverlay .qa-ribbon .ribbon-tab:hover`, `html.dark-mode .demo-chat-input-row.cursor-style .chat-model-label .brand-build`, `html.dark-mode .demo-chat-input-row.cursor-style .chat-model-label .brand-dot`…)
- **18 rules** → 1 (selectors: `.demo-view-overlay .history-search-input::placeholder`, `html.dark-mode .chat-steps-list`, `html.dark-mode .demo-chat-input-row.cursor-style .chat-agent-badge`, `html.dark-mode .demo-chat-input-row.cursor-style .chat-meeting-btn:hover`…)
- **17 rules** → 1 (selectors: `html.dark-mode .demo-chat-input-row.cursor-style .chat-meeting-btn[title]:hover::after`, `html.dark-mode .demo-chat-input-row.cursor-style .chat-share-btn[title]:hover::after`, `html.dark-mode .demo-chat-input-row.cursor-style .llm-toggle-row[title]:hover::after`, `html.dark-mode .demo-chat-input-row.cursor-style .mode-tooltip`…)
- **17 rules** → 1 (selectors: `.chat-model-dropdown .menu-icon:hover + .chat-model-label + .chat-dropdown-menu`, `.chat-model-dropdown:has(.menu-icon:hover) .chat-dropdown-menu`, `.chat-settings-wrapper .color-palette-dropdown.chat-palette:hover`, `.chat-settings-wrapper:hover .color-palette-dropdown`…)
- **15 rules** → 1 (selectors: `html.dark-mode #schedulesOverlay .v8-text-column .demo-text-heading`, `html.dark-mode #specWritingOverlay .v8-text-column .demo-text-heading`, `html.dark-mode .demo-chat-container .demo-chat-titlebar-text`, `html.dark-mode .demo-chat-input-row.cursor-style .chat-input-placeholder`…)
- **15 rules** → 1 (selectors: `html.dark-mode .demo-chat-input-row.cursor-style .brand-variant`, `html.dark-mode .demo-chat-input-row.cursor-style .chat-meeting-btn.active`, `html.dark-mode .demo-chat-input-row.cursor-style .chat-model-label .brand-variant`, `html.dark-mode .demo-chat-input-row.cursor-style .model-option.active .model-tick`…)
- **14 rules** → 1 (selectors: `.demo-chat-input-row.cursor-style .llm-toggle input:checked + .toggle-slider`, `.demo-chat-input-row.cursor-style .mode-toggle input:checked + .toggle-slider`, `.steps-list li .step-icon.dot`, `html.dark-mode .demo-chat-send`…)

### sandbox
- **2 rules** → 1 (selectors: `html.dark-mode .hero-text-container .hero-heading`, `html.dark-mode .hero-text-container .hero-subheading`)
- **2 rules** → 1 (selectors: `.docs-left`, `.docs-right`)
- **2 rules** → 1 (selectors: `.docs-left`, `.docs-right`)
- **2 rules** → 1 (selectors: `.docs-content > h1`, `main.sandbox-main h1`)
- **2 rules** → 1 (selectors: `.docs-content > h2`, `main.sandbox-main h2`)
- **2 rules** → 1 (selectors: `.sandbox-tile`, `.sandbox-tile::after`)

### shared
- **24 rules** → 1 (selectors: `.buildx-package-btn .teal`, `.buildx-site-footer .footer-links-list a:hover`, `.buildx-title .teal`, `html.dark-mode .brand-variant`…)
- **12 rules** → 1 (selectors: `html.dark-mode .brand-build`, `html.dark-mode .brand-dot`, `html.dark-mode .footer-logo-adelphos`, `html.dark-mode .menu-link`…)
- **12 rules** → 1 (selectors: `#buildXOverlay.visible .buildx-content`, `#buildXOverlay.visible .buildx-package-btn`, `#buildXOverlay.visible .buildx-ribbon-panel`, `#buildXOverlay.visible .buildx-signup-btn`…)
- **11 rules** → 1 (selectors: `#buildXOverlay .buildx-ribbon-panel`, `#schedulesOverlay .v7-center-panel`, `#schedulesOverlay .v8-center-panel`, `#schedulesOverlay .v8-text-right`…)
- **11 rules** → 1 (selectors: `html.dark-mode .menu-item`, `html.dark-mode .ribbon-btn`, `html.dark-mode .ribbon-content`, `html.dark-mode .ribbon-style-btn::before`…)
- **10 rules** → 1 (selectors: `.brand-variant`, `.build-release-logo .logo-ai`, `.footer-links-list a:hover`, `.logo .ai`…)
- **10 rules** → 1 (selectors: `#buildXOverlay.visible .buildx-footer`, `#buildXOverlay.visible .buildx-site-footer`, `.build-release-overlay.visible`, `.buildx-ribbon-panel.has-content .buildx-ribbon-content`…)
- **10 rules** → 1 (selectors: `.color-palette-btn:hover .palette-icon`, `html.dark-mode .color-palette-btn .palette-icon`, `html.dark-mode .dark-toggle-label`, `html.dark-mode .footer-copyright`…)
- **9 rules** → 1 (selectors: `html.dark-mode .build-release-text .release-line`, `html.dark-mode .build-release-text .release-product`, `html.dark-mode .footer-links-list a`, `html.dark-mode .footer-tagline`…)
- **7 rules** → 1 (selectors: `.menu-dropdown`, `.ribbon-btn.icon.highlight`, `.ribbon-btn.smart`, `.smart-menu .menu-item[title]`)

### page
- **18 rules** → 1 (selectors: `html.dark-mode .coming-soon-dropdown li`, `html.dark-mode .files-action-btn`, `html.dark-mode .files-changed-count`, `html.dark-mode .thought-trail-content p`…)
- **17 rules** → 1 (selectors: `.demo-option-btn.active`, `.inner-resizer.active`, `.inner-resizer:hover`, `.resizer.active`…)
- **14 rules** → 1 (selectors: `.back-to-top:hover .back-to-top-text`, `.scroll-indicator:hover .scroll-indicator-text`, `html.dark-mode .back-to-top-text`, `html.dark-mode .carousel-label`…)
- **14 rules** → 1 (selectors: `html.dark-mode .files-action-btn.primary`, `html.dark-mode .inner-resizer.active`, `html.dark-mode .inner-resizer:hover`, `html.dark-mode .resizer.active`…)
- **13 rules** → 1 (selectors: `.signup-message.success`, `html.dark-mode .editor-paper h1`, `html.dark-mode .editor-paper h2`, `html.dark-mode .project-label`…)
- **12 rules** → 1 (selectors: `.editor-status-bar .status-divider`, `html.dark-mode .editor-paper h3`, `html.dark-mode .file-name`, `html.dark-mode .file-tree`…)
- **10 rules** → 1 (selectors: `html.dark-mode .about-us-text`, `html.dark-mode .coming-soon-dropdown .blurb`, `html.dark-mode .demo-btn-dropdown .blurb`, `html.dark-mode .riba-desc-left`…)
- **9 rules** → 1 (selectors: `.editor-status-bar .structure-status`, `html.dark-mode .carousel-item span`, `html.dark-mode .palette-header`, `html.dark-mode .progress-percent`…)
- **9 rules** → 1 (selectors: `.back-to-top:hover`, `.overlay-node.loaded .loading-ring`, `.overlay-node.loading .loading-ring`, `.riba-clone-expanded.show-content > *`…)
- **9 rules** → 1 (selectors: `html.dark-mode #schedulesOverlay .inner-resizer`, `html.dark-mode .editor-paper.title-page`, `html.dark-mode .inner-resizer`, `html.dark-mode .resizer`…)

### generic
- **4 rules** → 1 (selectors: `body`, `html`)
- **3 rules** → 1 (selectors: `*`)
- **3 rules** → 1 (selectors: `:root`)
- **2 rules** → 1 (selectors: `h1`, `h2`)
- **2 rules** → 1 (selectors: `body`, `html`)
- **2 rules** → 1 (selectors: `body`, `html`)
