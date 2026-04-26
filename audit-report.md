# CSS Audit Report

- CSS files scanned: **11**
- HTML files scanned: **133**
- Total rules parsed: **6989**
- Duplicate selectors: **1818**
- !important wars: **86**
- Orphaned selectors: **53**

## 🔁 Duplicate selectors (same selector, multiple rule blocks)

_Showing top 50 of 1818_

### `.demo-detail .lead` × 27
_Properties touched: `color`, `font-size`, `line-height`, `margin-bottom`, `max-width`_
- `sandbox/sandbox.css:703`  →  5 props
- `dist/agentic-services/document-controller/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/email-cobie/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/email-schematics/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/email-specifications/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/finances/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/project-management/index.html<style#0>:4`  →  1 props
- `dist/apps/adelphos-chat/index.html<style#0>:5`  →  1 props
- `dist/apps/autocad-copilot/index.html<style#0>:5`  →  1 props
- `dist/apps/cobie-manager/index.html<style#0>:5`  →  1 props
- `dist/apps/document-controller/index.html<style#0>:5`  →  1 props
- `dist/apps/excel-add-in/index.html<style#0>:5`  →  1 props
- `dist/apps/qa-manager/index.html<style#0>:5`  →  1 props
- `dist/apps/report-builder/index.html<style#0>:5`  →  1 props
- `dist/apps/revit-copilot/index.html<style#0>:5`  →  1 props
- `dist/apps/schedule-builder/index.html<style#0>:5`  →  1 props
- `dist/apps/specbuilder/index.html<style#0>:5`  →  1 props
- `dist/apps/word-add-in/index.html<style#0>:5`  →  1 props
- `dist/features/autoroute/index.html<style#0>:5`  →  1 props
- `dist/features/clash-solver/index.html<style#0>:5`  →  1 props
- `dist/features/pdf-to-3d/index.html<style#0>:5`  →  1 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:5`  →  1 props
- `dist/workflows/schedules/index.html<style#0>:5`  →  1 props
- `templates/agentic-service-page.html<style#0>:4`  →  1 props
- `templates/app-page.html<style#0>:5`  →  1 props
- `templates/workflow-page.html<style#0>:5`  →  1 props

### `.demo-detail > p` × 26
_Properties touched: `max-width`_
- `dist/agentic-services/document-controller/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/email-cobie/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/email-schematics/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/email-specifications/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/finances/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/project-management/index.html<style#0>:4`  →  1 props
- `dist/apps/adelphos-chat/index.html<style#0>:5`  →  1 props
- `dist/apps/autocad-copilot/index.html<style#0>:5`  →  1 props
- `dist/apps/cobie-manager/index.html<style#0>:5`  →  1 props
- `dist/apps/document-controller/index.html<style#0>:5`  →  1 props
- `dist/apps/excel-add-in/index.html<style#0>:5`  →  1 props
- `dist/apps/qa-manager/index.html<style#0>:5`  →  1 props
- `dist/apps/report-builder/index.html<style#0>:5`  →  1 props
- `dist/apps/revit-copilot/index.html<style#0>:5`  →  1 props
- `dist/apps/schedule-builder/index.html<style#0>:5`  →  1 props
- `dist/apps/specbuilder/index.html<style#0>:5`  →  1 props
- `dist/apps/word-add-in/index.html<style#0>:5`  →  1 props
- `dist/features/autoroute/index.html<style#0>:5`  →  1 props
- `dist/features/clash-solver/index.html<style#0>:5`  →  1 props
- `dist/features/pdf-to-3d/index.html<style#0>:5`  →  1 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:5`  →  1 props
- `dist/workflows/schedules/index.html<style#0>:5`  →  1 props
- `templates/agentic-service-page.html<style#0>:4`  →  1 props
- `templates/app-page.html<style#0>:5`  →  1 props
- `templates/workflow-page.html<style#0>:5`  →  1 props

### `.demo-detail > ul` × 26
_Properties touched: `max-width`_
- `dist/agentic-services/document-controller/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/email-cobie/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/email-schematics/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/email-specifications/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/finances/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/project-management/index.html<style#0>:4`  →  1 props
- `dist/apps/adelphos-chat/index.html<style#0>:5`  →  1 props
- `dist/apps/autocad-copilot/index.html<style#0>:5`  →  1 props
- `dist/apps/cobie-manager/index.html<style#0>:5`  →  1 props
- `dist/apps/document-controller/index.html<style#0>:5`  →  1 props
- `dist/apps/excel-add-in/index.html<style#0>:5`  →  1 props
- `dist/apps/qa-manager/index.html<style#0>:5`  →  1 props
- `dist/apps/report-builder/index.html<style#0>:5`  →  1 props
- `dist/apps/revit-copilot/index.html<style#0>:5`  →  1 props
- `dist/apps/schedule-builder/index.html<style#0>:5`  →  1 props
- `dist/apps/specbuilder/index.html<style#0>:5`  →  1 props
- `dist/apps/word-add-in/index.html<style#0>:5`  →  1 props
- `dist/features/autoroute/index.html<style#0>:5`  →  1 props
- `dist/features/clash-solver/index.html<style#0>:5`  →  1 props
- `dist/features/pdf-to-3d/index.html<style#0>:5`  →  1 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:5`  →  1 props
- `dist/workflows/schedules/index.html<style#0>:5`  →  1 props
- `templates/agentic-service-page.html<style#0>:4`  →  1 props
- `templates/app-page.html<style#0>:5`  →  1 props
- `templates/workflow-page.html<style#0>:5`  →  1 props

### `.demo-detail > ol` × 26
_Properties touched: `max-width`_
- `dist/agentic-services/document-controller/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/email-cobie/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/email-schematics/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/email-specifications/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/finances/index.html<style#0>:4`  →  1 props
- `dist/agentic-services/project-management/index.html<style#0>:4`  →  1 props
- `dist/apps/adelphos-chat/index.html<style#0>:5`  →  1 props
- `dist/apps/autocad-copilot/index.html<style#0>:5`  →  1 props
- `dist/apps/cobie-manager/index.html<style#0>:5`  →  1 props
- `dist/apps/document-controller/index.html<style#0>:5`  →  1 props
- `dist/apps/excel-add-in/index.html<style#0>:5`  →  1 props
- `dist/apps/qa-manager/index.html<style#0>:5`  →  1 props
- `dist/apps/report-builder/index.html<style#0>:5`  →  1 props
- `dist/apps/revit-copilot/index.html<style#0>:5`  →  1 props
- `dist/apps/schedule-builder/index.html<style#0>:5`  →  1 props
- `dist/apps/specbuilder/index.html<style#0>:5`  →  1 props
- `dist/apps/word-add-in/index.html<style#0>:5`  →  1 props
- `dist/features/autoroute/index.html<style#0>:5`  →  1 props
- `dist/features/clash-solver/index.html<style#0>:5`  →  1 props
- `dist/features/pdf-to-3d/index.html<style#0>:5`  →  1 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:5`  →  1 props
- `dist/workflows/schedules/index.html<style#0>:5`  →  1 props
- `templates/agentic-service-page.html<style#0>:4`  →  1 props
- `templates/app-page.html<style#0>:5`  →  1 props
- `templates/workflow-page.html<style#0>:5`  →  1 props

### `html.dark-mode .end-cta` × 26
_Properties touched: `background`_
- `dist/agentic-services/document-controller/index.html<style#0>:196`  →  1 props
- `dist/agentic-services/email-cobie/index.html<style#0>:196`  →  1 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:196`  →  1 props
- `dist/agentic-services/email-schematics/index.html<style#0>:196`  →  1 props
- `dist/agentic-services/email-specifications/index.html<style#0>:196`  →  1 props
- `dist/agentic-services/finances/index.html<style#0>:196`  →  1 props
- `dist/agentic-services/project-management/index.html<style#0>:196`  →  1 props
- `dist/apps/adelphos-chat/index.html<style#0>:255`  →  1 props
- `dist/apps/autocad-copilot/index.html<style#0>:255`  →  1 props
- `dist/apps/cobie-manager/index.html<style#0>:255`  →  1 props
- `dist/apps/document-controller/index.html<style#0>:255`  →  1 props
- `dist/apps/excel-add-in/index.html<style#0>:255`  →  1 props
- `dist/apps/qa-manager/index.html<style#0>:255`  →  1 props
- `dist/apps/report-builder/index.html<style#0>:255`  →  1 props
- `dist/apps/revit-copilot/index.html<style#0>:255`  →  1 props
- `dist/apps/schedule-builder/index.html<style#0>:255`  →  1 props
- `dist/apps/specbuilder/index.html<style#0>:255`  →  1 props
- `dist/apps/word-add-in/index.html<style#0>:255`  →  1 props
- `dist/features/autoroute/index.html<style#0>:255`  →  1 props
- `dist/features/clash-solver/index.html<style#0>:255`  →  1 props
- `dist/features/pdf-to-3d/index.html<style#0>:255`  →  1 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:255`  →  1 props
- `dist/index.html<style#1>:668`  →  1 props
- `templates/agentic-service-page.html<style#0>:196`  →  1 props
- `templates/app-page.html<style#0>:255`  →  1 props
- `templates/home.html<style#0>:487`  →  1 props

### `.end-cta` × 26
_Properties touched: `background`, `border-radius`, `color`, `margin`, `margin-top`, `padding`, `text-align`_
- `dist/agentic-services/document-controller/index.html<style#0>:199`  →  6 props
- `dist/agentic-services/email-cobie/index.html<style#0>:199`  →  6 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:199`  →  6 props
- `dist/agentic-services/email-schematics/index.html<style#0>:199`  →  6 props
- `dist/agentic-services/email-specifications/index.html<style#0>:199`  →  6 props
- `dist/agentic-services/finances/index.html<style#0>:199`  →  6 props
- `dist/agentic-services/project-management/index.html<style#0>:199`  →  6 props
- `dist/apps/adelphos-chat/index.html<style#0>:250`  →  6 props
- `dist/apps/autocad-copilot/index.html<style#0>:250`  →  6 props
- `dist/apps/cobie-manager/index.html<style#0>:250`  →  6 props
- `dist/apps/document-controller/index.html<style#0>:250`  →  6 props
- `dist/apps/excel-add-in/index.html<style#0>:250`  →  6 props
- `dist/apps/qa-manager/index.html<style#0>:250`  →  6 props
- `dist/apps/report-builder/index.html<style#0>:250`  →  6 props
- `dist/apps/revit-copilot/index.html<style#0>:250`  →  6 props
- `dist/apps/schedule-builder/index.html<style#0>:250`  →  6 props
- `dist/apps/specbuilder/index.html<style#0>:250`  →  6 props
- `dist/apps/word-add-in/index.html<style#0>:250`  →  6 props
- `dist/features/autoroute/index.html<style#0>:250`  →  6 props
- `dist/features/clash-solver/index.html<style#0>:250`  →  6 props
- `dist/features/pdf-to-3d/index.html<style#0>:250`  →  6 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:250`  →  6 props
- `dist/index.html<style#1>:662`  →  6 props
- `templates/agentic-service-page.html<style#0>:199`  →  6 props
- `templates/app-page.html<style#0>:250`  →  6 props
- `templates/home.html<style#0>:481`  →  6 props

### `.end-cta h3` × 26
_Properties touched: `color`, `font-size`, `font-weight`, `letter-spacing`, `margin`_
- `dist/agentic-services/document-controller/index.html<style#0>:204`  →  4 props
- `dist/agentic-services/email-cobie/index.html<style#0>:204`  →  4 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:204`  →  4 props
- `dist/agentic-services/email-schematics/index.html<style#0>:204`  →  4 props
- `dist/agentic-services/email-specifications/index.html<style#0>:204`  →  4 props
- `dist/agentic-services/finances/index.html<style#0>:204`  →  4 props
- `dist/agentic-services/project-management/index.html<style#0>:204`  →  4 props
- `dist/apps/adelphos-chat/index.html<style#0>:258`  →  4 props
- `dist/apps/autocad-copilot/index.html<style#0>:258`  →  4 props
- `dist/apps/cobie-manager/index.html<style#0>:258`  →  4 props
- `dist/apps/document-controller/index.html<style#0>:258`  →  4 props
- `dist/apps/excel-add-in/index.html<style#0>:258`  →  4 props
- `dist/apps/qa-manager/index.html<style#0>:258`  →  4 props
- `dist/apps/report-builder/index.html<style#0>:258`  →  4 props
- `dist/apps/revit-copilot/index.html<style#0>:258`  →  4 props
- `dist/apps/schedule-builder/index.html<style#0>:258`  →  4 props
- `dist/apps/specbuilder/index.html<style#0>:258`  →  4 props
- `dist/apps/word-add-in/index.html<style#0>:258`  →  4 props
- `dist/features/autoroute/index.html<style#0>:258`  →  4 props
- `dist/features/clash-solver/index.html<style#0>:258`  →  4 props
- `dist/features/pdf-to-3d/index.html<style#0>:258`  →  4 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:258`  →  4 props
- `dist/index.html<style#1>:669`  →  5 props
- `templates/agentic-service-page.html<style#0>:204`  →  4 props
- `templates/app-page.html<style#0>:258`  →  4 props
- `templates/home.html<style#0>:488`  →  5 props

### `.end-cta p` × 26
_Properties touched: `color`, `font-size`, `margin`_
- `dist/agentic-services/document-controller/index.html<style#0>:205`  →  3 props
- `dist/agentic-services/email-cobie/index.html<style#0>:205`  →  3 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:205`  →  3 props
- `dist/agentic-services/email-schematics/index.html<style#0>:205`  →  3 props
- `dist/agentic-services/email-specifications/index.html<style#0>:205`  →  3 props
- `dist/agentic-services/finances/index.html<style#0>:205`  →  3 props
- `dist/agentic-services/project-management/index.html<style#0>:205`  →  3 props
- `dist/apps/adelphos-chat/index.html<style#0>:259`  →  3 props
- `dist/apps/autocad-copilot/index.html<style#0>:259`  →  3 props
- `dist/apps/cobie-manager/index.html<style#0>:259`  →  3 props
- `dist/apps/document-controller/index.html<style#0>:259`  →  3 props
- `dist/apps/excel-add-in/index.html<style#0>:259`  →  3 props
- `dist/apps/qa-manager/index.html<style#0>:259`  →  3 props
- `dist/apps/report-builder/index.html<style#0>:259`  →  3 props
- `dist/apps/revit-copilot/index.html<style#0>:259`  →  3 props
- `dist/apps/schedule-builder/index.html<style#0>:259`  →  3 props
- `dist/apps/specbuilder/index.html<style#0>:259`  →  3 props
- `dist/apps/word-add-in/index.html<style#0>:259`  →  3 props
- `dist/features/autoroute/index.html<style#0>:259`  →  3 props
- `dist/features/clash-solver/index.html<style#0>:259`  →  3 props
- `dist/features/pdf-to-3d/index.html<style#0>:259`  →  3 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:259`  →  3 props
- `dist/index.html<style#1>:670`  →  3 props
- `templates/agentic-service-page.html<style#0>:205`  →  3 props
- `templates/app-page.html<style#0>:259`  →  3 props
- `templates/home.html<style#0>:489`  →  3 props

### `.end-cta a` × 26
_Properties touched: `background`, `border-radius`, `color`, `display`, `font-weight`, `margin`, `padding`, `text-decoration`, `transition`_
- `dist/agentic-services/document-controller/index.html<style#0>:206`  →  8 props
- `dist/agentic-services/email-cobie/index.html<style#0>:206`  →  8 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:206`  →  8 props
- `dist/agentic-services/email-schematics/index.html<style#0>:206`  →  8 props
- `dist/agentic-services/email-specifications/index.html<style#0>:206`  →  8 props
- `dist/agentic-services/finances/index.html<style#0>:206`  →  8 props
- `dist/agentic-services/project-management/index.html<style#0>:206`  →  8 props
- `dist/apps/adelphos-chat/index.html<style#0>:260`  →  8 props
- `dist/apps/autocad-copilot/index.html<style#0>:260`  →  8 props
- `dist/apps/cobie-manager/index.html<style#0>:260`  →  8 props
- `dist/apps/document-controller/index.html<style#0>:260`  →  8 props
- `dist/apps/excel-add-in/index.html<style#0>:260`  →  8 props
- `dist/apps/qa-manager/index.html<style#0>:260`  →  8 props
- `dist/apps/report-builder/index.html<style#0>:260`  →  8 props
- `dist/apps/revit-copilot/index.html<style#0>:260`  →  8 props
- `dist/apps/schedule-builder/index.html<style#0>:260`  →  8 props
- `dist/apps/specbuilder/index.html<style#0>:260`  →  8 props
- `dist/apps/word-add-in/index.html<style#0>:260`  →  8 props
- `dist/features/autoroute/index.html<style#0>:260`  →  8 props
- `dist/features/clash-solver/index.html<style#0>:260`  →  8 props
- `dist/features/pdf-to-3d/index.html<style#0>:260`  →  8 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:260`  →  8 props
- `dist/index.html<style#1>:671`  →  9 props
- `templates/agentic-service-page.html<style#0>:206`  →  8 props
- `templates/app-page.html<style#0>:260`  →  8 props
- `templates/home.html<style#0>:490`  →  9 props

### `.end-cta a:hover` × 26
_Properties touched: `transform`_
- `dist/agentic-services/document-controller/index.html<style#0>:211`  →  1 props
- `dist/agentic-services/email-cobie/index.html<style#0>:211`  →  1 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:211`  →  1 props
- `dist/agentic-services/email-schematics/index.html<style#0>:211`  →  1 props
- `dist/agentic-services/email-specifications/index.html<style#0>:211`  →  1 props
- `dist/agentic-services/finances/index.html<style#0>:211`  →  1 props
- `dist/agentic-services/project-management/index.html<style#0>:211`  →  1 props
- `dist/apps/adelphos-chat/index.html<style#0>:265`  →  1 props
- `dist/apps/autocad-copilot/index.html<style#0>:265`  →  1 props
- `dist/apps/cobie-manager/index.html<style#0>:265`  →  1 props
- `dist/apps/document-controller/index.html<style#0>:265`  →  1 props
- `dist/apps/excel-add-in/index.html<style#0>:265`  →  1 props
- `dist/apps/qa-manager/index.html<style#0>:265`  →  1 props
- `dist/apps/report-builder/index.html<style#0>:265`  →  1 props
- `dist/apps/revit-copilot/index.html<style#0>:265`  →  1 props
- `dist/apps/schedule-builder/index.html<style#0>:265`  →  1 props
- `dist/apps/specbuilder/index.html<style#0>:265`  →  1 props
- `dist/apps/word-add-in/index.html<style#0>:265`  →  1 props
- `dist/features/autoroute/index.html<style#0>:265`  →  1 props
- `dist/features/clash-solver/index.html<style#0>:265`  →  1 props
- `dist/features/pdf-to-3d/index.html<style#0>:265`  →  1 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:265`  →  1 props
- `dist/index.html<style#1>:677`  →  1 props
- `templates/agentic-service-page.html<style#0>:211`  →  1 props
- `templates/app-page.html<style#0>:265`  →  1 props
- `templates/home.html<style#0>:496`  →  1 props

### `.outcomes-strip` × 24
_Properties touched: `background`, `border`, `border-radius`, `box-shadow`, `display`, `gap`, `grid-template-columns`, `margin`, `overflow`, `position`, `z-index`_
- `dist/agentic-services/document-controller/index.html<style#0>:91`  →  11 props
- `dist/agentic-services/email-cobie/index.html<style#0>:91`  →  11 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:91`  →  11 props
- `dist/agentic-services/email-schematics/index.html<style#0>:91`  →  11 props
- `dist/agentic-services/email-specifications/index.html<style#0>:91`  →  11 props
- `dist/agentic-services/finances/index.html<style#0>:91`  →  11 props
- `dist/agentic-services/project-management/index.html<style#0>:91`  →  11 props
- `dist/apps/adelphos-chat/index.html<style#0>:79`  →  11 props
- `dist/apps/autocad-copilot/index.html<style#0>:79`  →  11 props
- `dist/apps/cobie-manager/index.html<style#0>:79`  →  11 props
- `dist/apps/document-controller/index.html<style#0>:79`  →  11 props
- `dist/apps/excel-add-in/index.html<style#0>:79`  →  11 props
- `dist/apps/qa-manager/index.html<style#0>:79`  →  11 props
- `dist/apps/report-builder/index.html<style#0>:79`  →  11 props
- `dist/apps/revit-copilot/index.html<style#0>:79`  →  11 props
- `dist/apps/schedule-builder/index.html<style#0>:79`  →  11 props
- `dist/apps/specbuilder/index.html<style#0>:79`  →  11 props
- `dist/apps/word-add-in/index.html<style#0>:79`  →  11 props
- `dist/features/autoroute/index.html<style#0>:79`  →  11 props
- `dist/features/clash-solver/index.html<style#0>:79`  →  11 props
- `dist/features/pdf-to-3d/index.html<style#0>:79`  →  11 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:79`  →  11 props
- `templates/agentic-service-page.html<style#0>:91`  →  11 props
- `templates/app-page.html<style#0>:79`  →  11 props

### `.outcomes-strip .ostat` × 24
_Properties touched: `border-right`, `padding`_
- `dist/agentic-services/document-controller/index.html<style#0>:98`  →  2 props
- `dist/agentic-services/email-cobie/index.html<style#0>:98`  →  2 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:98`  →  2 props
- `dist/agentic-services/email-schematics/index.html<style#0>:98`  →  2 props
- `dist/agentic-services/email-specifications/index.html<style#0>:98`  →  2 props
- `dist/agentic-services/finances/index.html<style#0>:98`  →  2 props
- `dist/agentic-services/project-management/index.html<style#0>:98`  →  2 props
- `dist/apps/adelphos-chat/index.html<style#0>:86`  →  2 props
- `dist/apps/autocad-copilot/index.html<style#0>:86`  →  2 props
- `dist/apps/cobie-manager/index.html<style#0>:86`  →  2 props
- `dist/apps/document-controller/index.html<style#0>:86`  →  2 props
- `dist/apps/excel-add-in/index.html<style#0>:86`  →  2 props
- `dist/apps/qa-manager/index.html<style#0>:86`  →  2 props
- `dist/apps/report-builder/index.html<style#0>:86`  →  2 props
- `dist/apps/revit-copilot/index.html<style#0>:86`  →  2 props
- `dist/apps/schedule-builder/index.html<style#0>:86`  →  2 props
- `dist/apps/specbuilder/index.html<style#0>:86`  →  2 props
- `dist/apps/word-add-in/index.html<style#0>:86`  →  2 props
- `dist/features/autoroute/index.html<style#0>:86`  →  2 props
- `dist/features/clash-solver/index.html<style#0>:86`  →  2 props
- `dist/features/pdf-to-3d/index.html<style#0>:86`  →  2 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:86`  →  2 props
- `templates/agentic-service-page.html<style#0>:98`  →  2 props
- `templates/app-page.html<style#0>:86`  →  2 props

### `.outcomes-strip .ostat:last-child` × 24
_Properties touched: `border-right`_
- `dist/agentic-services/document-controller/index.html<style#0>:99`  →  1 props
- `dist/agentic-services/email-cobie/index.html<style#0>:99`  →  1 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:99`  →  1 props
- `dist/agentic-services/email-schematics/index.html<style#0>:99`  →  1 props
- `dist/agentic-services/email-specifications/index.html<style#0>:99`  →  1 props
- `dist/agentic-services/finances/index.html<style#0>:99`  →  1 props
- `dist/agentic-services/project-management/index.html<style#0>:99`  →  1 props
- `dist/apps/adelphos-chat/index.html<style#0>:87`  →  1 props
- `dist/apps/autocad-copilot/index.html<style#0>:87`  →  1 props
- `dist/apps/cobie-manager/index.html<style#0>:87`  →  1 props
- `dist/apps/document-controller/index.html<style#0>:87`  →  1 props
- `dist/apps/excel-add-in/index.html<style#0>:87`  →  1 props
- `dist/apps/qa-manager/index.html<style#0>:87`  →  1 props
- `dist/apps/report-builder/index.html<style#0>:87`  →  1 props
- `dist/apps/revit-copilot/index.html<style#0>:87`  →  1 props
- `dist/apps/schedule-builder/index.html<style#0>:87`  →  1 props
- `dist/apps/specbuilder/index.html<style#0>:87`  →  1 props
- `dist/apps/word-add-in/index.html<style#0>:87`  →  1 props
- `dist/features/autoroute/index.html<style#0>:87`  →  1 props
- `dist/features/clash-solver/index.html<style#0>:87`  →  1 props
- `dist/features/pdf-to-3d/index.html<style#0>:87`  →  1 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:87`  →  1 props
- `templates/agentic-service-page.html<style#0>:99`  →  1 props
- `templates/app-page.html<style#0>:87`  →  1 props

### `.outcomes-strip .ostat .num` × 24
_Properties touched: `color`, `display`, `font-size`, `font-weight`, `letter-spacing`, `line-height`_
- `dist/agentic-services/document-controller/index.html<style#0>:100`  →  6 props
- `dist/agentic-services/email-cobie/index.html<style#0>:100`  →  6 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:100`  →  6 props
- `dist/agentic-services/email-schematics/index.html<style#0>:100`  →  6 props
- `dist/agentic-services/email-specifications/index.html<style#0>:100`  →  6 props
- `dist/agentic-services/finances/index.html<style#0>:100`  →  6 props
- `dist/agentic-services/project-management/index.html<style#0>:100`  →  6 props
- `dist/apps/adelphos-chat/index.html<style#0>:88`  →  6 props
- `dist/apps/autocad-copilot/index.html<style#0>:88`  →  6 props
- `dist/apps/cobie-manager/index.html<style#0>:88`  →  6 props
- `dist/apps/document-controller/index.html<style#0>:88`  →  6 props
- `dist/apps/excel-add-in/index.html<style#0>:88`  →  6 props
- `dist/apps/qa-manager/index.html<style#0>:88`  →  6 props
- `dist/apps/report-builder/index.html<style#0>:88`  →  6 props
- `dist/apps/revit-copilot/index.html<style#0>:88`  →  6 props
- `dist/apps/schedule-builder/index.html<style#0>:88`  →  6 props
- `dist/apps/specbuilder/index.html<style#0>:88`  →  6 props
- `dist/apps/word-add-in/index.html<style#0>:88`  →  6 props
- `dist/features/autoroute/index.html<style#0>:88`  →  6 props
- `dist/features/clash-solver/index.html<style#0>:88`  →  6 props
- `dist/features/pdf-to-3d/index.html<style#0>:88`  →  6 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:88`  →  6 props
- `templates/agentic-service-page.html<style#0>:100`  →  6 props
- `templates/app-page.html<style#0>:88`  →  6 props

### `.outcomes-strip .ostat .lbl` × 24
_Properties touched: `color`, `display`, `font-size`, `line-height`, `margin-top`_
- `dist/agentic-services/document-controller/index.html<style#0>:104`  →  5 props
- `dist/agentic-services/email-cobie/index.html<style#0>:104`  →  5 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:104`  →  5 props
- `dist/agentic-services/email-schematics/index.html<style#0>:104`  →  5 props
- `dist/agentic-services/email-specifications/index.html<style#0>:104`  →  5 props
- `dist/agentic-services/finances/index.html<style#0>:104`  →  5 props
- `dist/agentic-services/project-management/index.html<style#0>:104`  →  5 props
- `dist/apps/adelphos-chat/index.html<style#0>:92`  →  5 props
- `dist/apps/autocad-copilot/index.html<style#0>:92`  →  5 props
- `dist/apps/cobie-manager/index.html<style#0>:92`  →  5 props
- `dist/apps/document-controller/index.html<style#0>:92`  →  5 props
- `dist/apps/excel-add-in/index.html<style#0>:92`  →  5 props
- `dist/apps/qa-manager/index.html<style#0>:92`  →  5 props
- `dist/apps/report-builder/index.html<style#0>:92`  →  5 props
- `dist/apps/revit-copilot/index.html<style#0>:92`  →  5 props
- `dist/apps/schedule-builder/index.html<style#0>:92`  →  5 props
- `dist/apps/specbuilder/index.html<style#0>:92`  →  5 props
- `dist/apps/word-add-in/index.html<style#0>:92`  →  5 props
- `dist/features/autoroute/index.html<style#0>:92`  →  5 props
- `dist/features/clash-solver/index.html<style#0>:92`  →  5 props
- `dist/features/pdf-to-3d/index.html<style#0>:92`  →  5 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:92`  →  5 props
- `templates/agentic-service-page.html<style#0>:104`  →  5 props
- `templates/app-page.html<style#0>:92`  →  5 props

### `.shift-grid` × 24
_Properties touched: `display`, `gap`, `grid-template-columns`, `margin`_
- `dist/agentic-services/document-controller/index.html<style#0>:109`  →  4 props
- `dist/agentic-services/email-cobie/index.html<style#0>:109`  →  4 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:109`  →  4 props
- `dist/agentic-services/email-schematics/index.html<style#0>:109`  →  4 props
- `dist/agentic-services/email-specifications/index.html<style#0>:109`  →  4 props
- `dist/agentic-services/finances/index.html<style#0>:109`  →  4 props
- `dist/agentic-services/project-management/index.html<style#0>:109`  →  4 props
- `dist/apps/adelphos-chat/index.html<style#0>:100`  →  4 props
- `dist/apps/autocad-copilot/index.html<style#0>:100`  →  4 props
- `dist/apps/cobie-manager/index.html<style#0>:100`  →  4 props
- `dist/apps/document-controller/index.html<style#0>:100`  →  4 props
- `dist/apps/excel-add-in/index.html<style#0>:100`  →  4 props
- `dist/apps/qa-manager/index.html<style#0>:100`  →  4 props
- `dist/apps/report-builder/index.html<style#0>:100`  →  4 props
- `dist/apps/revit-copilot/index.html<style#0>:100`  →  4 props
- `dist/apps/schedule-builder/index.html<style#0>:100`  →  4 props
- `dist/apps/specbuilder/index.html<style#0>:100`  →  4 props
- `dist/apps/word-add-in/index.html<style#0>:100`  →  4 props
- `dist/features/autoroute/index.html<style#0>:100`  →  4 props
- `dist/features/clash-solver/index.html<style#0>:100`  →  4 props
- `dist/features/pdf-to-3d/index.html<style#0>:100`  →  4 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:100`  →  4 props
- `templates/agentic-service-page.html<style#0>:109`  →  4 props
- `templates/app-page.html<style#0>:100`  →  4 props

### `.shift` × 24
_Properties touched: `border`, `border-radius`, `padding`_
- `dist/agentic-services/document-controller/index.html<style#0>:110`  →  3 props
- `dist/agentic-services/email-cobie/index.html<style#0>:110`  →  3 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:110`  →  3 props
- `dist/agentic-services/email-schematics/index.html<style#0>:110`  →  3 props
- `dist/agentic-services/email-specifications/index.html<style#0>:110`  →  3 props
- `dist/agentic-services/finances/index.html<style#0>:110`  →  3 props
- `dist/agentic-services/project-management/index.html<style#0>:110`  →  3 props
- `dist/apps/adelphos-chat/index.html<style#0>:101`  →  3 props
- `dist/apps/autocad-copilot/index.html<style#0>:101`  →  3 props
- `dist/apps/cobie-manager/index.html<style#0>:101`  →  3 props
- `dist/apps/document-controller/index.html<style#0>:101`  →  3 props
- `dist/apps/excel-add-in/index.html<style#0>:101`  →  3 props
- `dist/apps/qa-manager/index.html<style#0>:101`  →  3 props
- `dist/apps/report-builder/index.html<style#0>:101`  →  3 props
- `dist/apps/revit-copilot/index.html<style#0>:101`  →  3 props
- `dist/apps/schedule-builder/index.html<style#0>:101`  →  3 props
- `dist/apps/specbuilder/index.html<style#0>:101`  →  3 props
- `dist/apps/word-add-in/index.html<style#0>:101`  →  3 props
- `dist/features/autoroute/index.html<style#0>:101`  →  3 props
- `dist/features/clash-solver/index.html<style#0>:101`  →  3 props
- `dist/features/pdf-to-3d/index.html<style#0>:101`  →  3 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:101`  →  3 props
- `templates/agentic-service-page.html<style#0>:110`  →  3 props
- `templates/app-page.html<style#0>:101`  →  3 props

### `.shift .lab` × 24
_Properties touched: `font-size`, `font-weight`, `letter-spacing`, `margin`, `text-transform`_
- `dist/agentic-services/document-controller/index.html<style#0>:111`  →  5 props
- `dist/agentic-services/email-cobie/index.html<style#0>:111`  →  5 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:111`  →  5 props
- `dist/agentic-services/email-schematics/index.html<style#0>:111`  →  5 props
- `dist/agentic-services/email-specifications/index.html<style#0>:111`  →  5 props
- `dist/agentic-services/finances/index.html<style#0>:111`  →  5 props
- `dist/agentic-services/project-management/index.html<style#0>:111`  →  5 props
- `dist/apps/adelphos-chat/index.html<style#0>:102`  →  5 props
- `dist/apps/autocad-copilot/index.html<style#0>:102`  →  5 props
- `dist/apps/cobie-manager/index.html<style#0>:102`  →  5 props
- `dist/apps/document-controller/index.html<style#0>:102`  →  5 props
- `dist/apps/excel-add-in/index.html<style#0>:102`  →  5 props
- `dist/apps/qa-manager/index.html<style#0>:102`  →  5 props
- `dist/apps/report-builder/index.html<style#0>:102`  →  5 props
- `dist/apps/revit-copilot/index.html<style#0>:102`  →  5 props
- `dist/apps/schedule-builder/index.html<style#0>:102`  →  5 props
- `dist/apps/specbuilder/index.html<style#0>:102`  →  5 props
- `dist/apps/word-add-in/index.html<style#0>:102`  →  5 props
- `dist/features/autoroute/index.html<style#0>:102`  →  5 props
- `dist/features/clash-solver/index.html<style#0>:102`  →  5 props
- `dist/features/pdf-to-3d/index.html<style#0>:102`  →  5 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:102`  →  5 props
- `templates/agentic-service-page.html<style#0>:111`  →  5 props
- `templates/app-page.html<style#0>:102`  →  5 props

### `.shift p` × 24
_Properties touched: `color`, `font-size`, `line-height`, `margin`_
- `dist/agentic-services/document-controller/index.html<style#0>:112`  →  4 props
- `dist/agentic-services/email-cobie/index.html<style#0>:112`  →  4 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:112`  →  4 props
- `dist/agentic-services/email-schematics/index.html<style#0>:112`  →  4 props
- `dist/agentic-services/email-specifications/index.html<style#0>:112`  →  4 props
- `dist/agentic-services/finances/index.html<style#0>:112`  →  4 props
- `dist/agentic-services/project-management/index.html<style#0>:112`  →  4 props
- `dist/apps/adelphos-chat/index.html<style#0>:106`  →  4 props
- `dist/apps/autocad-copilot/index.html<style#0>:106`  →  4 props
- `dist/apps/cobie-manager/index.html<style#0>:106`  →  4 props
- `dist/apps/document-controller/index.html<style#0>:106`  →  4 props
- `dist/apps/excel-add-in/index.html<style#0>:106`  →  4 props
- `dist/apps/qa-manager/index.html<style#0>:106`  →  4 props
- `dist/apps/report-builder/index.html<style#0>:106`  →  4 props
- `dist/apps/revit-copilot/index.html<style#0>:106`  →  4 props
- `dist/apps/schedule-builder/index.html<style#0>:106`  →  4 props
- `dist/apps/specbuilder/index.html<style#0>:106`  →  4 props
- `dist/apps/word-add-in/index.html<style#0>:106`  →  4 props
- `dist/features/autoroute/index.html<style#0>:106`  →  4 props
- `dist/features/clash-solver/index.html<style#0>:106`  →  4 props
- `dist/features/pdf-to-3d/index.html<style#0>:106`  →  4 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:106`  →  4 props
- `templates/agentic-service-page.html<style#0>:112`  →  4 props
- `templates/app-page.html<style#0>:106`  →  4 props

### `.shift.before` × 24
_Properties touched: `background`, `border-color`_
- `dist/agentic-services/document-controller/index.html<style#0>:113`  →  2 props
- `dist/agentic-services/email-cobie/index.html<style#0>:113`  →  2 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:113`  →  2 props
- `dist/agentic-services/email-schematics/index.html<style#0>:113`  →  2 props
- `dist/agentic-services/email-specifications/index.html<style#0>:113`  →  2 props
- `dist/agentic-services/finances/index.html<style#0>:113`  →  2 props
- `dist/agentic-services/project-management/index.html<style#0>:113`  →  2 props
- `dist/apps/adelphos-chat/index.html<style#0>:107`  →  2 props
- `dist/apps/autocad-copilot/index.html<style#0>:107`  →  2 props
- `dist/apps/cobie-manager/index.html<style#0>:107`  →  2 props
- `dist/apps/document-controller/index.html<style#0>:107`  →  2 props
- `dist/apps/excel-add-in/index.html<style#0>:107`  →  2 props
- `dist/apps/qa-manager/index.html<style#0>:107`  →  2 props
- `dist/apps/report-builder/index.html<style#0>:107`  →  2 props
- `dist/apps/revit-copilot/index.html<style#0>:107`  →  2 props
- `dist/apps/schedule-builder/index.html<style#0>:107`  →  2 props
- `dist/apps/specbuilder/index.html<style#0>:107`  →  2 props
- `dist/apps/word-add-in/index.html<style#0>:107`  →  2 props
- `dist/features/autoroute/index.html<style#0>:107`  →  2 props
- `dist/features/clash-solver/index.html<style#0>:107`  →  2 props
- `dist/features/pdf-to-3d/index.html<style#0>:107`  →  2 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:107`  →  2 props
- `templates/agentic-service-page.html<style#0>:113`  →  2 props
- `templates/app-page.html<style#0>:107`  →  2 props

### `.shift.before .lab` × 24
_Properties touched: `color`_
- `dist/agentic-services/document-controller/index.html<style#0>:114`  →  1 props
- `dist/agentic-services/email-cobie/index.html<style#0>:114`  →  1 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:114`  →  1 props
- `dist/agentic-services/email-schematics/index.html<style#0>:114`  →  1 props
- `dist/agentic-services/email-specifications/index.html<style#0>:114`  →  1 props
- `dist/agentic-services/finances/index.html<style#0>:114`  →  1 props
- `dist/agentic-services/project-management/index.html<style#0>:114`  →  1 props
- `dist/apps/adelphos-chat/index.html<style#0>:108`  →  1 props
- `dist/apps/autocad-copilot/index.html<style#0>:108`  →  1 props
- `dist/apps/cobie-manager/index.html<style#0>:108`  →  1 props
- `dist/apps/document-controller/index.html<style#0>:108`  →  1 props
- `dist/apps/excel-add-in/index.html<style#0>:108`  →  1 props
- `dist/apps/qa-manager/index.html<style#0>:108`  →  1 props
- `dist/apps/report-builder/index.html<style#0>:108`  →  1 props
- `dist/apps/revit-copilot/index.html<style#0>:108`  →  1 props
- `dist/apps/schedule-builder/index.html<style#0>:108`  →  1 props
- `dist/apps/specbuilder/index.html<style#0>:108`  →  1 props
- `dist/apps/word-add-in/index.html<style#0>:108`  →  1 props
- `dist/features/autoroute/index.html<style#0>:108`  →  1 props
- `dist/features/clash-solver/index.html<style#0>:108`  →  1 props
- `dist/features/pdf-to-3d/index.html<style#0>:108`  →  1 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:108`  →  1 props
- `templates/agentic-service-page.html<style#0>:114`  →  1 props
- `templates/app-page.html<style#0>:108`  →  1 props

### `.shift.after` × 24
_Properties touched: `background`, `border-color`_
- `dist/agentic-services/document-controller/index.html<style#0>:115`  →  2 props
- `dist/agentic-services/email-cobie/index.html<style#0>:115`  →  2 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:115`  →  2 props
- `dist/agentic-services/email-schematics/index.html<style#0>:115`  →  2 props
- `dist/agentic-services/email-specifications/index.html<style#0>:115`  →  2 props
- `dist/agentic-services/finances/index.html<style#0>:115`  →  2 props
- `dist/agentic-services/project-management/index.html<style#0>:115`  →  2 props
- `dist/apps/adelphos-chat/index.html<style#0>:109`  →  2 props
- `dist/apps/autocad-copilot/index.html<style#0>:109`  →  2 props
- `dist/apps/cobie-manager/index.html<style#0>:109`  →  2 props
- `dist/apps/document-controller/index.html<style#0>:109`  →  2 props
- `dist/apps/excel-add-in/index.html<style#0>:109`  →  2 props
- `dist/apps/qa-manager/index.html<style#0>:109`  →  2 props
- `dist/apps/report-builder/index.html<style#0>:109`  →  2 props
- `dist/apps/revit-copilot/index.html<style#0>:109`  →  2 props
- `dist/apps/schedule-builder/index.html<style#0>:109`  →  2 props
- `dist/apps/specbuilder/index.html<style#0>:109`  →  2 props
- `dist/apps/word-add-in/index.html<style#0>:109`  →  2 props
- `dist/features/autoroute/index.html<style#0>:109`  →  2 props
- `dist/features/clash-solver/index.html<style#0>:109`  →  2 props
- `dist/features/pdf-to-3d/index.html<style#0>:109`  →  2 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:109`  →  2 props
- `templates/agentic-service-page.html<style#0>:115`  →  2 props
- `templates/app-page.html<style#0>:109`  →  2 props

### `.shift.after  .lab` × 24
_Properties touched: `color`_
- `dist/agentic-services/document-controller/index.html<style#0>:116`  →  1 props
- `dist/agentic-services/email-cobie/index.html<style#0>:116`  →  1 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:116`  →  1 props
- `dist/agentic-services/email-schematics/index.html<style#0>:116`  →  1 props
- `dist/agentic-services/email-specifications/index.html<style#0>:116`  →  1 props
- `dist/agentic-services/finances/index.html<style#0>:116`  →  1 props
- `dist/agentic-services/project-management/index.html<style#0>:116`  →  1 props
- `dist/apps/adelphos-chat/index.html<style#0>:110`  →  1 props
- `dist/apps/autocad-copilot/index.html<style#0>:110`  →  1 props
- `dist/apps/cobie-manager/index.html<style#0>:110`  →  1 props
- `dist/apps/document-controller/index.html<style#0>:110`  →  1 props
- `dist/apps/excel-add-in/index.html<style#0>:110`  →  1 props
- `dist/apps/qa-manager/index.html<style#0>:110`  →  1 props
- `dist/apps/report-builder/index.html<style#0>:110`  →  1 props
- `dist/apps/revit-copilot/index.html<style#0>:110`  →  1 props
- `dist/apps/schedule-builder/index.html<style#0>:110`  →  1 props
- `dist/apps/specbuilder/index.html<style#0>:110`  →  1 props
- `dist/apps/word-add-in/index.html<style#0>:110`  →  1 props
- `dist/features/autoroute/index.html<style#0>:110`  →  1 props
- `dist/features/clash-solver/index.html<style#0>:110`  →  1 props
- `dist/features/pdf-to-3d/index.html<style#0>:110`  →  1 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:110`  →  1 props
- `templates/agentic-service-page.html<style#0>:116`  →  1 props
- `templates/app-page.html<style#0>:110`  →  1 props

### `.shift-grid` @media(@media (max-width: 720px)) × 24
_Properties touched: `grid-template-columns`_
- `dist/agentic-services/document-controller/index.html<style#0>:1`  →  1 props
- `dist/agentic-services/email-cobie/index.html<style#0>:1`  →  1 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:1`  →  1 props
- `dist/agentic-services/email-schematics/index.html<style#0>:1`  →  1 props
- `dist/agentic-services/email-specifications/index.html<style#0>:1`  →  1 props
- `dist/agentic-services/finances/index.html<style#0>:1`  →  1 props
- `dist/agentic-services/project-management/index.html<style#0>:1`  →  1 props
- `dist/apps/adelphos-chat/index.html<style#0>:1`  →  1 props
- `dist/apps/autocad-copilot/index.html<style#0>:1`  →  1 props
- `dist/apps/cobie-manager/index.html<style#0>:1`  →  1 props
- `dist/apps/document-controller/index.html<style#0>:1`  →  1 props
- `dist/apps/excel-add-in/index.html<style#0>:1`  →  1 props
- `dist/apps/qa-manager/index.html<style#0>:1`  →  1 props
- `dist/apps/report-builder/index.html<style#0>:1`  →  1 props
- `dist/apps/revit-copilot/index.html<style#0>:1`  →  1 props
- `dist/apps/schedule-builder/index.html<style#0>:1`  →  1 props
- `dist/apps/specbuilder/index.html<style#0>:1`  →  1 props
- `dist/apps/word-add-in/index.html<style#0>:1`  →  1 props
- `dist/features/autoroute/index.html<style#0>:1`  →  1 props
- `dist/features/clash-solver/index.html<style#0>:1`  →  1 props
- `dist/features/pdf-to-3d/index.html<style#0>:1`  →  1 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:1`  →  1 props
- `templates/agentic-service-page.html<style#0>:1`  →  1 props
- `templates/app-page.html<style#0>:1`  →  1 props

### `.why-grid` × 24
_Properties touched: `align-items`, `display`, `gap`, `grid-template-columns`, `margin`_
- `dist/agentic-services/document-controller/index.html<style#0>:152`  →  5 props
- `dist/agentic-services/email-cobie/index.html<style#0>:152`  →  5 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:152`  →  5 props
- `dist/agentic-services/email-schematics/index.html<style#0>:152`  →  5 props
- `dist/agentic-services/email-specifications/index.html<style#0>:152`  →  5 props
- `dist/agentic-services/finances/index.html<style#0>:152`  →  5 props
- `dist/agentic-services/project-management/index.html<style#0>:152`  →  5 props
- `dist/apps/adelphos-chat/index.html<style#0>:121`  →  5 props
- `dist/apps/autocad-copilot/index.html<style#0>:121`  →  5 props
- `dist/apps/cobie-manager/index.html<style#0>:121`  →  5 props
- `dist/apps/document-controller/index.html<style#0>:121`  →  5 props
- `dist/apps/excel-add-in/index.html<style#0>:121`  →  5 props
- `dist/apps/qa-manager/index.html<style#0>:121`  →  5 props
- `dist/apps/report-builder/index.html<style#0>:121`  →  5 props
- `dist/apps/revit-copilot/index.html<style#0>:121`  →  5 props
- `dist/apps/schedule-builder/index.html<style#0>:121`  →  5 props
- `dist/apps/specbuilder/index.html<style#0>:121`  →  5 props
- `dist/apps/word-add-in/index.html<style#0>:121`  →  5 props
- `dist/features/autoroute/index.html<style#0>:121`  →  5 props
- `dist/features/clash-solver/index.html<style#0>:121`  →  5 props
- `dist/features/pdf-to-3d/index.html<style#0>:121`  →  5 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:121`  →  5 props
- `templates/agentic-service-page.html<style#0>:152`  →  5 props
- `templates/app-page.html<style#0>:121`  →  5 props

### `.why-grid .why-detail` × 24
_Properties touched: `min-width`_
- `dist/agentic-services/document-controller/index.html<style#0>:157`  →  1 props
- `dist/agentic-services/email-cobie/index.html<style#0>:157`  →  1 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:157`  →  1 props
- `dist/agentic-services/email-schematics/index.html<style#0>:157`  →  1 props
- `dist/agentic-services/email-specifications/index.html<style#0>:157`  →  1 props
- `dist/agentic-services/finances/index.html<style#0>:157`  →  1 props
- `dist/agentic-services/project-management/index.html<style#0>:157`  →  1 props
- `dist/apps/adelphos-chat/index.html<style#0>:128`  →  1 props
- `dist/apps/autocad-copilot/index.html<style#0>:128`  →  1 props
- `dist/apps/cobie-manager/index.html<style#0>:128`  →  1 props
- `dist/apps/document-controller/index.html<style#0>:128`  →  1 props
- `dist/apps/excel-add-in/index.html<style#0>:128`  →  1 props
- `dist/apps/qa-manager/index.html<style#0>:128`  →  1 props
- `dist/apps/report-builder/index.html<style#0>:128`  →  1 props
- `dist/apps/revit-copilot/index.html<style#0>:128`  →  1 props
- `dist/apps/schedule-builder/index.html<style#0>:128`  →  1 props
- `dist/apps/specbuilder/index.html<style#0>:128`  →  1 props
- `dist/apps/word-add-in/index.html<style#0>:128`  →  1 props
- `dist/features/autoroute/index.html<style#0>:128`  →  1 props
- `dist/features/clash-solver/index.html<style#0>:128`  →  1 props
- `dist/features/pdf-to-3d/index.html<style#0>:128`  →  1 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:128`  →  1 props
- `templates/agentic-service-page.html<style#0>:157`  →  1 props
- `templates/app-page.html<style#0>:128`  →  1 props

### `.why-grid .why-detail p` × 24
_Properties touched: `color`, `font-size`, `line-height`, `margin`_
- `dist/agentic-services/document-controller/index.html<style#0>:158`  →  4 props
- `dist/agentic-services/email-cobie/index.html<style#0>:158`  →  4 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:158`  →  4 props
- `dist/agentic-services/email-schematics/index.html<style#0>:158`  →  4 props
- `dist/agentic-services/email-specifications/index.html<style#0>:158`  →  4 props
- `dist/agentic-services/finances/index.html<style#0>:158`  →  4 props
- `dist/agentic-services/project-management/index.html<style#0>:158`  →  4 props
- `dist/apps/adelphos-chat/index.html<style#0>:129`  →  4 props
- `dist/apps/autocad-copilot/index.html<style#0>:129`  →  4 props
- `dist/apps/cobie-manager/index.html<style#0>:129`  →  4 props
- `dist/apps/document-controller/index.html<style#0>:129`  →  4 props
- `dist/apps/excel-add-in/index.html<style#0>:129`  →  4 props
- `dist/apps/qa-manager/index.html<style#0>:129`  →  4 props
- `dist/apps/report-builder/index.html<style#0>:129`  →  4 props
- `dist/apps/revit-copilot/index.html<style#0>:129`  →  4 props
- `dist/apps/schedule-builder/index.html<style#0>:129`  →  4 props
- `dist/apps/specbuilder/index.html<style#0>:129`  →  4 props
- `dist/apps/word-add-in/index.html<style#0>:129`  →  4 props
- `dist/features/autoroute/index.html<style#0>:129`  →  4 props
- `dist/features/clash-solver/index.html<style#0>:129`  →  4 props
- `dist/features/pdf-to-3d/index.html<style#0>:129`  →  4 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:129`  →  4 props
- `templates/agentic-service-page.html<style#0>:158`  →  4 props
- `templates/app-page.html<style#0>:129`  →  4 props

### `.why-grid .why-detail p:last-child` × 24
_Properties touched: `margin-bottom`_
- `dist/agentic-services/document-controller/index.html<style#0>:159`  →  1 props
- `dist/agentic-services/email-cobie/index.html<style#0>:159`  →  1 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:159`  →  1 props
- `dist/agentic-services/email-schematics/index.html<style#0>:159`  →  1 props
- `dist/agentic-services/email-specifications/index.html<style#0>:159`  →  1 props
- `dist/agentic-services/finances/index.html<style#0>:159`  →  1 props
- `dist/agentic-services/project-management/index.html<style#0>:159`  →  1 props
- `dist/apps/adelphos-chat/index.html<style#0>:133`  →  1 props
- `dist/apps/autocad-copilot/index.html<style#0>:133`  →  1 props
- `dist/apps/cobie-manager/index.html<style#0>:133`  →  1 props
- `dist/apps/document-controller/index.html<style#0>:133`  →  1 props
- `dist/apps/excel-add-in/index.html<style#0>:133`  →  1 props
- `dist/apps/qa-manager/index.html<style#0>:133`  →  1 props
- `dist/apps/report-builder/index.html<style#0>:133`  →  1 props
- `dist/apps/revit-copilot/index.html<style#0>:133`  →  1 props
- `dist/apps/schedule-builder/index.html<style#0>:133`  →  1 props
- `dist/apps/specbuilder/index.html<style#0>:133`  →  1 props
- `dist/apps/word-add-in/index.html<style#0>:133`  →  1 props
- `dist/features/autoroute/index.html<style#0>:133`  →  1 props
- `dist/features/clash-solver/index.html<style#0>:133`  →  1 props
- `dist/features/pdf-to-3d/index.html<style#0>:133`  →  1 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:133`  →  1 props
- `templates/agentic-service-page.html<style#0>:159`  →  1 props
- `templates/app-page.html<style#0>:133`  →  1 props

### `.why-grid .why-quote` × 24
_Properties touched: _
- `dist/agentic-services/document-controller/index.html<style#0>:160`  →  0 props
- `dist/agentic-services/email-cobie/index.html<style#0>:160`  →  0 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:160`  →  0 props
- `dist/agentic-services/email-schematics/index.html<style#0>:160`  →  0 props
- `dist/agentic-services/email-specifications/index.html<style#0>:160`  →  0 props
- `dist/agentic-services/finances/index.html<style#0>:160`  →  0 props
- `dist/agentic-services/project-management/index.html<style#0>:160`  →  0 props
- `dist/apps/adelphos-chat/index.html<style#0>:134`  →  0 props
- `dist/apps/autocad-copilot/index.html<style#0>:134`  →  0 props
- `dist/apps/cobie-manager/index.html<style#0>:134`  →  0 props
- `dist/apps/document-controller/index.html<style#0>:134`  →  0 props
- `dist/apps/excel-add-in/index.html<style#0>:134`  →  0 props
- `dist/apps/qa-manager/index.html<style#0>:134`  →  0 props
- `dist/apps/report-builder/index.html<style#0>:134`  →  0 props
- `dist/apps/revit-copilot/index.html<style#0>:134`  →  0 props
- `dist/apps/schedule-builder/index.html<style#0>:134`  →  0 props
- `dist/apps/specbuilder/index.html<style#0>:134`  →  0 props
- `dist/apps/word-add-in/index.html<style#0>:134`  →  0 props
- `dist/features/autoroute/index.html<style#0>:134`  →  0 props
- `dist/features/clash-solver/index.html<style#0>:134`  →  0 props
- `dist/features/pdf-to-3d/index.html<style#0>:134`  →  0 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:134`  →  0 props
- `templates/agentic-service-page.html<style#0>:160`  →  0 props
- `templates/app-page.html<style#0>:134`  →  0 props

### `.why-grid .why-quote blockquote` × 24
_Properties touched: `color`, `font-size`, `font-weight`, `letter-spacing`, `line-height`, `margin`_
- `dist/agentic-services/document-controller/index.html<style#0>:161`  →  6 props
- `dist/agentic-services/email-cobie/index.html<style#0>:161`  →  6 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:161`  →  6 props
- `dist/agentic-services/email-schematics/index.html<style#0>:161`  →  6 props
- `dist/agentic-services/email-specifications/index.html<style#0>:161`  →  6 props
- `dist/agentic-services/finances/index.html<style#0>:161`  →  6 props
- `dist/agentic-services/project-management/index.html<style#0>:161`  →  6 props
- `dist/apps/adelphos-chat/index.html<style#0>:135`  →  6 props
- `dist/apps/autocad-copilot/index.html<style#0>:135`  →  6 props
- `dist/apps/cobie-manager/index.html<style#0>:135`  →  6 props
- `dist/apps/document-controller/index.html<style#0>:135`  →  6 props
- `dist/apps/excel-add-in/index.html<style#0>:135`  →  6 props
- `dist/apps/qa-manager/index.html<style#0>:135`  →  6 props
- `dist/apps/report-builder/index.html<style#0>:135`  →  6 props
- `dist/apps/revit-copilot/index.html<style#0>:135`  →  6 props
- `dist/apps/schedule-builder/index.html<style#0>:135`  →  6 props
- `dist/apps/specbuilder/index.html<style#0>:135`  →  6 props
- `dist/apps/word-add-in/index.html<style#0>:135`  →  6 props
- `dist/features/autoroute/index.html<style#0>:135`  →  6 props
- `dist/features/clash-solver/index.html<style#0>:135`  →  6 props
- `dist/features/pdf-to-3d/index.html<style#0>:135`  →  6 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:135`  →  6 props
- `templates/agentic-service-page.html<style#0>:161`  →  6 props
- `templates/app-page.html<style#0>:135`  →  6 props

### `.why-grid` @media(@media (max-width: 1100px)) × 24
_Properties touched: `gap`, `grid-template-columns`_
- `dist/agentic-services/document-controller/index.html<style#0>:2`  →  2 props
- `dist/agentic-services/email-cobie/index.html<style#0>:2`  →  2 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:2`  →  2 props
- `dist/agentic-services/email-schematics/index.html<style#0>:2`  →  2 props
- `dist/agentic-services/email-specifications/index.html<style#0>:2`  →  2 props
- `dist/agentic-services/finances/index.html<style#0>:2`  →  2 props
- `dist/agentic-services/project-management/index.html<style#0>:2`  →  2 props
- `dist/apps/adelphos-chat/index.html<style#0>:2`  →  2 props
- `dist/apps/autocad-copilot/index.html<style#0>:2`  →  2 props
- `dist/apps/cobie-manager/index.html<style#0>:2`  →  2 props
- `dist/apps/document-controller/index.html<style#0>:2`  →  2 props
- `dist/apps/excel-add-in/index.html<style#0>:2`  →  2 props
- `dist/apps/qa-manager/index.html<style#0>:2`  →  2 props
- `dist/apps/report-builder/index.html<style#0>:2`  →  2 props
- `dist/apps/revit-copilot/index.html<style#0>:2`  →  2 props
- `dist/apps/schedule-builder/index.html<style#0>:2`  →  2 props
- `dist/apps/specbuilder/index.html<style#0>:2`  →  2 props
- `dist/apps/word-add-in/index.html<style#0>:2`  →  2 props
- `dist/features/autoroute/index.html<style#0>:2`  →  2 props
- `dist/features/clash-solver/index.html<style#0>:2`  →  2 props
- `dist/features/pdf-to-3d/index.html<style#0>:2`  →  2 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:2`  →  2 props
- `templates/agentic-service-page.html<style#0>:2`  →  2 props
- `templates/app-page.html<style#0>:2`  →  2 props

### `.why-grid .why-quote blockquote` @media(@media (max-width: 1100px)) × 24
_Properties touched: `font-size`_
- `dist/agentic-services/document-controller/index.html<style#0>:3`  →  1 props
- `dist/agentic-services/email-cobie/index.html<style#0>:3`  →  1 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:3`  →  1 props
- `dist/agentic-services/email-schematics/index.html<style#0>:3`  →  1 props
- `dist/agentic-services/email-specifications/index.html<style#0>:3`  →  1 props
- `dist/agentic-services/finances/index.html<style#0>:3`  →  1 props
- `dist/agentic-services/project-management/index.html<style#0>:3`  →  1 props
- `dist/apps/adelphos-chat/index.html<style#0>:3`  →  1 props
- `dist/apps/autocad-copilot/index.html<style#0>:3`  →  1 props
- `dist/apps/cobie-manager/index.html<style#0>:3`  →  1 props
- `dist/apps/document-controller/index.html<style#0>:3`  →  1 props
- `dist/apps/excel-add-in/index.html<style#0>:3`  →  1 props
- `dist/apps/qa-manager/index.html<style#0>:3`  →  1 props
- `dist/apps/report-builder/index.html<style#0>:3`  →  1 props
- `dist/apps/revit-copilot/index.html<style#0>:3`  →  1 props
- `dist/apps/schedule-builder/index.html<style#0>:3`  →  1 props
- `dist/apps/specbuilder/index.html<style#0>:3`  →  1 props
- `dist/apps/word-add-in/index.html<style#0>:3`  →  1 props
- `dist/features/autoroute/index.html<style#0>:3`  →  1 props
- `dist/features/clash-solver/index.html<style#0>:3`  →  1 props
- `dist/features/pdf-to-3d/index.html<style#0>:3`  →  1 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:3`  →  1 props
- `templates/agentic-service-page.html<style#0>:3`  →  1 props
- `templates/app-page.html<style#0>:3`  →  1 props

### `.feat-list` × 24
_Properties touched: `display`, `gap`, `grid-template-columns`, `list-style`, `margin`, `padding`_
- `dist/agentic-services/document-controller/index.html<style#0>:173`  →  6 props
- `dist/agentic-services/email-cobie/index.html<style#0>:173`  →  6 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:173`  →  6 props
- `dist/agentic-services/email-schematics/index.html<style#0>:173`  →  6 props
- `dist/agentic-services/email-specifications/index.html<style#0>:173`  →  6 props
- `dist/agentic-services/finances/index.html<style#0>:173`  →  6 props
- `dist/agentic-services/project-management/index.html<style#0>:173`  →  6 props
- `dist/apps/adelphos-chat/index.html<style#0>:147`  →  6 props
- `dist/apps/autocad-copilot/index.html<style#0>:147`  →  6 props
- `dist/apps/cobie-manager/index.html<style#0>:147`  →  6 props
- `dist/apps/document-controller/index.html<style#0>:147`  →  6 props
- `dist/apps/excel-add-in/index.html<style#0>:147`  →  6 props
- `dist/apps/qa-manager/index.html<style#0>:147`  →  6 props
- `dist/apps/report-builder/index.html<style#0>:147`  →  6 props
- `dist/apps/revit-copilot/index.html<style#0>:147`  →  6 props
- `dist/apps/schedule-builder/index.html<style#0>:147`  →  6 props
- `dist/apps/specbuilder/index.html<style#0>:147`  →  6 props
- `dist/apps/word-add-in/index.html<style#0>:147`  →  6 props
- `dist/features/autoroute/index.html<style#0>:147`  →  6 props
- `dist/features/clash-solver/index.html<style#0>:147`  →  6 props
- `dist/features/pdf-to-3d/index.html<style#0>:147`  →  6 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:147`  →  6 props
- `templates/agentic-service-page.html<style#0>:173`  →  6 props
- `templates/app-page.html<style#0>:147`  →  6 props

### `.feat-list` @media(@media (max-width: 800px)) × 24
_Properties touched: `gap`, `grid-template-columns`_
- `dist/agentic-services/document-controller/index.html<style#0>:1`  →  2 props
- `dist/agentic-services/email-cobie/index.html<style#0>:1`  →  2 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:1`  →  2 props
- `dist/agentic-services/email-schematics/index.html<style#0>:1`  →  2 props
- `dist/agentic-services/email-specifications/index.html<style#0>:1`  →  2 props
- `dist/agentic-services/finances/index.html<style#0>:1`  →  2 props
- `dist/agentic-services/project-management/index.html<style#0>:1`  →  2 props
- `dist/apps/adelphos-chat/index.html<style#0>:1`  →  2 props
- `dist/apps/autocad-copilot/index.html<style#0>:1`  →  2 props
- `dist/apps/cobie-manager/index.html<style#0>:1`  →  2 props
- `dist/apps/document-controller/index.html<style#0>:1`  →  2 props
- `dist/apps/excel-add-in/index.html<style#0>:1`  →  2 props
- `dist/apps/qa-manager/index.html<style#0>:1`  →  2 props
- `dist/apps/report-builder/index.html<style#0>:1`  →  2 props
- `dist/apps/revit-copilot/index.html<style#0>:1`  →  2 props
- `dist/apps/schedule-builder/index.html<style#0>:1`  →  2 props
- `dist/apps/specbuilder/index.html<style#0>:1`  →  2 props
- `dist/apps/word-add-in/index.html<style#0>:1`  →  2 props
- `dist/features/autoroute/index.html<style#0>:1`  →  2 props
- `dist/features/clash-solver/index.html<style#0>:1`  →  2 props
- `dist/features/pdf-to-3d/index.html<style#0>:1`  →  2 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:1`  →  2 props
- `templates/agentic-service-page.html<style#0>:1`  →  2 props
- `templates/app-page.html<style#0>:1`  →  2 props

### `.feat-list li .name` × 24
_Properties touched: `color`, `display`, `font-size`, `font-weight`, `letter-spacing`, `margin`, `padding-left`, `position`_
- `dist/agentic-services/document-controller/index.html<style#0>:179`  →  8 props
- `dist/agentic-services/email-cobie/index.html<style#0>:179`  →  8 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:179`  →  8 props
- `dist/agentic-services/email-schematics/index.html<style#0>:179`  →  8 props
- `dist/agentic-services/email-specifications/index.html<style#0>:179`  →  8 props
- `dist/agentic-services/finances/index.html<style#0>:179`  →  8 props
- `dist/agentic-services/project-management/index.html<style#0>:179`  →  8 props
- `dist/apps/adelphos-chat/index.html<style#0>:155`  →  8 props
- `dist/apps/autocad-copilot/index.html<style#0>:155`  →  8 props
- `dist/apps/cobie-manager/index.html<style#0>:155`  →  8 props
- `dist/apps/document-controller/index.html<style#0>:155`  →  8 props
- `dist/apps/excel-add-in/index.html<style#0>:155`  →  8 props
- `dist/apps/qa-manager/index.html<style#0>:155`  →  8 props
- `dist/apps/report-builder/index.html<style#0>:155`  →  8 props
- `dist/apps/revit-copilot/index.html<style#0>:155`  →  8 props
- `dist/apps/schedule-builder/index.html<style#0>:155`  →  8 props
- `dist/apps/specbuilder/index.html<style#0>:155`  →  8 props
- `dist/apps/word-add-in/index.html<style#0>:155`  →  8 props
- `dist/features/autoroute/index.html<style#0>:155`  →  8 props
- `dist/features/clash-solver/index.html<style#0>:155`  →  8 props
- `dist/features/pdf-to-3d/index.html<style#0>:155`  →  8 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:155`  →  8 props
- `templates/agentic-service-page.html<style#0>:179`  →  8 props
- `templates/app-page.html<style#0>:155`  →  8 props

### `.feat-list li .name::before` × 24
_Properties touched: `background`, `border-radius`, `content`, `height`, `left`, `position`, `top`, `width`_
- `dist/agentic-services/document-controller/index.html<style#0>:184`  →  8 props
- `dist/agentic-services/email-cobie/index.html<style#0>:184`  →  8 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:184`  →  8 props
- `dist/agentic-services/email-schematics/index.html<style#0>:184`  →  8 props
- `dist/agentic-services/email-specifications/index.html<style#0>:184`  →  8 props
- `dist/agentic-services/finances/index.html<style#0>:184`  →  8 props
- `dist/agentic-services/project-management/index.html<style#0>:184`  →  8 props
- `dist/apps/adelphos-chat/index.html<style#0>:161`  →  8 props
- `dist/apps/autocad-copilot/index.html<style#0>:161`  →  8 props
- `dist/apps/cobie-manager/index.html<style#0>:161`  →  8 props
- `dist/apps/document-controller/index.html<style#0>:161`  →  8 props
- `dist/apps/excel-add-in/index.html<style#0>:161`  →  8 props
- `dist/apps/qa-manager/index.html<style#0>:161`  →  8 props
- `dist/apps/report-builder/index.html<style#0>:161`  →  8 props
- `dist/apps/revit-copilot/index.html<style#0>:161`  →  8 props
- `dist/apps/schedule-builder/index.html<style#0>:161`  →  8 props
- `dist/apps/specbuilder/index.html<style#0>:161`  →  8 props
- `dist/apps/word-add-in/index.html<style#0>:161`  →  8 props
- `dist/features/autoroute/index.html<style#0>:161`  →  8 props
- `dist/features/clash-solver/index.html<style#0>:161`  →  8 props
- `dist/features/pdf-to-3d/index.html<style#0>:161`  →  8 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:161`  →  8 props
- `templates/agentic-service-page.html<style#0>:184`  →  8 props
- `templates/app-page.html<style#0>:161`  →  8 props

### `.feat-list li .desc` × 24
_Properties touched: `color`, `display`, `font-size`, `line-height`, `margin`, `padding-left`_
- `dist/agentic-services/document-controller/index.html<style#0>:188`  →  6 props
- `dist/agentic-services/email-cobie/index.html<style#0>:188`  →  6 props
- `dist/agentic-services/email-revit-modelling/index.html<style#0>:188`  →  6 props
- `dist/agentic-services/email-schematics/index.html<style#0>:188`  →  6 props
- `dist/agentic-services/email-specifications/index.html<style#0>:188`  →  6 props
- `dist/agentic-services/finances/index.html<style#0>:188`  →  6 props
- `dist/agentic-services/project-management/index.html<style#0>:188`  →  6 props
- `dist/apps/adelphos-chat/index.html<style#0>:166`  →  6 props
- `dist/apps/autocad-copilot/index.html<style#0>:166`  →  6 props
- `dist/apps/cobie-manager/index.html<style#0>:166`  →  6 props
- `dist/apps/document-controller/index.html<style#0>:166`  →  6 props
- `dist/apps/excel-add-in/index.html<style#0>:166`  →  6 props
- `dist/apps/qa-manager/index.html<style#0>:166`  →  6 props
- `dist/apps/report-builder/index.html<style#0>:166`  →  6 props
- `dist/apps/revit-copilot/index.html<style#0>:166`  →  6 props
- `dist/apps/schedule-builder/index.html<style#0>:166`  →  6 props
- `dist/apps/specbuilder/index.html<style#0>:166`  →  6 props
- `dist/apps/word-add-in/index.html<style#0>:166`  →  6 props
- `dist/features/autoroute/index.html<style#0>:166`  →  6 props
- `dist/features/clash-solver/index.html<style#0>:166`  →  6 props
- `dist/features/pdf-to-3d/index.html<style#0>:166`  →  6 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:166`  →  6 props
- `templates/agentic-service-page.html<style#0>:188`  →  6 props
- `templates/app-page.html<style#0>:166`  →  6 props

### `.demo-detail .hero-video` × 19
_Properties touched: `aspect-ratio`, `background`, `border-radius`, `box-shadow`, `margin-bottom`, `max-width`, `overflow`, `width`_
- `sandbox/sandbox.css:710`  →  8 props
- `dist/apps/adelphos-chat/index.html<style#0>:97`  →  3 props
- `dist/apps/autocad-copilot/index.html<style#0>:97`  →  3 props
- `dist/apps/cobie-manager/index.html<style#0>:97`  →  3 props
- `dist/apps/document-controller/index.html<style#0>:97`  →  3 props
- `dist/apps/excel-add-in/index.html<style#0>:97`  →  3 props
- `dist/apps/qa-manager/index.html<style#0>:97`  →  3 props
- `dist/apps/report-builder/index.html<style#0>:97`  →  3 props
- `dist/apps/revit-copilot/index.html<style#0>:97`  →  3 props
- `dist/apps/schedule-builder/index.html<style#0>:97`  →  3 props
- `dist/apps/specbuilder/index.html<style#0>:97`  →  3 props
- `dist/apps/word-add-in/index.html<style#0>:97`  →  3 props
- `dist/features/autoroute/index.html<style#0>:97`  →  3 props
- `dist/features/clash-solver/index.html<style#0>:97`  →  3 props
- `dist/features/pdf-to-3d/index.html<style#0>:97`  →  3 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:97`  →  3 props
- `dist/workflows/schedules/index.html<style#0>:11`  →  3 props
- `templates/app-page.html<style#0>:97`  →  3 props
- `templates/workflow-page.html<style#0>:11`  →  3 props

### `.app-hero-card` × 16
_Properties touched: `background`, `border-radius`, `box-shadow`, `margin`, `overflow`, `position`_
- `dist/apps/adelphos-chat/index.html<style#0>:8`  →  6 props
- `dist/apps/autocad-copilot/index.html<style#0>:8`  →  6 props
- `dist/apps/cobie-manager/index.html<style#0>:8`  →  6 props
- `dist/apps/document-controller/index.html<style#0>:8`  →  6 props
- `dist/apps/excel-add-in/index.html<style#0>:8`  →  6 props
- `dist/apps/qa-manager/index.html<style#0>:8`  →  6 props
- `dist/apps/report-builder/index.html<style#0>:8`  →  6 props
- `dist/apps/revit-copilot/index.html<style#0>:8`  →  6 props
- `dist/apps/schedule-builder/index.html<style#0>:8`  →  6 props
- `dist/apps/specbuilder/index.html<style#0>:8`  →  6 props
- `dist/apps/word-add-in/index.html<style#0>:8`  →  6 props
- `dist/features/autoroute/index.html<style#0>:8`  →  6 props
- `dist/features/clash-solver/index.html<style#0>:8`  →  6 props
- `dist/features/pdf-to-3d/index.html<style#0>:8`  →  6 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:8`  →  6 props
- `templates/app-page.html<style#0>:8`  →  6 props

### `html.dark-mode .app-hero-card` × 16
_Properties touched: `background`_
- `dist/apps/adelphos-chat/index.html<style#0>:15`  →  1 props
- `dist/apps/autocad-copilot/index.html<style#0>:15`  →  1 props
- `dist/apps/cobie-manager/index.html<style#0>:15`  →  1 props
- `dist/apps/document-controller/index.html<style#0>:15`  →  1 props
- `dist/apps/excel-add-in/index.html<style#0>:15`  →  1 props
- `dist/apps/qa-manager/index.html<style#0>:15`  →  1 props
- `dist/apps/report-builder/index.html<style#0>:15`  →  1 props
- `dist/apps/revit-copilot/index.html<style#0>:15`  →  1 props
- `dist/apps/schedule-builder/index.html<style#0>:15`  →  1 props
- `dist/apps/specbuilder/index.html<style#0>:15`  →  1 props
- `dist/apps/word-add-in/index.html<style#0>:15`  →  1 props
- `dist/features/autoroute/index.html<style#0>:15`  →  1 props
- `dist/features/clash-solver/index.html<style#0>:15`  →  1 props
- `dist/features/pdf-to-3d/index.html<style#0>:15`  →  1 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:15`  →  1 props
- `templates/app-page.html<style#0>:15`  →  1 props

### `.app-hero-card::before` × 16
_Properties touched: `background`, `content`, `inset`, `pointer-events`, `position`_
- `dist/apps/adelphos-chat/index.html<style#0>:18`  →  5 props
- `dist/apps/autocad-copilot/index.html<style#0>:18`  →  5 props
- `dist/apps/cobie-manager/index.html<style#0>:18`  →  5 props
- `dist/apps/document-controller/index.html<style#0>:18`  →  5 props
- `dist/apps/excel-add-in/index.html<style#0>:18`  →  5 props
- `dist/apps/qa-manager/index.html<style#0>:18`  →  5 props
- `dist/apps/report-builder/index.html<style#0>:18`  →  5 props
- `dist/apps/revit-copilot/index.html<style#0>:18`  →  5 props
- `dist/apps/schedule-builder/index.html<style#0>:18`  →  5 props
- `dist/apps/specbuilder/index.html<style#0>:18`  →  5 props
- `dist/apps/word-add-in/index.html<style#0>:18`  →  5 props
- `dist/features/autoroute/index.html<style#0>:18`  →  5 props
- `dist/features/clash-solver/index.html<style#0>:18`  →  5 props
- `dist/features/pdf-to-3d/index.html<style#0>:18`  →  5 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:18`  →  5 props
- `templates/app-page.html<style#0>:18`  →  5 props

### `.app-hero-card .inner` × 16
_Properties touched: `color`, `padding`, `position`_
- `dist/apps/adelphos-chat/index.html<style#0>:25`  →  3 props
- `dist/apps/autocad-copilot/index.html<style#0>:25`  →  3 props
- `dist/apps/cobie-manager/index.html<style#0>:25`  →  3 props
- `dist/apps/document-controller/index.html<style#0>:25`  →  3 props
- `dist/apps/excel-add-in/index.html<style#0>:25`  →  3 props
- `dist/apps/qa-manager/index.html<style#0>:25`  →  3 props
- `dist/apps/report-builder/index.html<style#0>:25`  →  3 props
- `dist/apps/revit-copilot/index.html<style#0>:25`  →  3 props
- `dist/apps/schedule-builder/index.html<style#0>:25`  →  3 props
- `dist/apps/specbuilder/index.html<style#0>:25`  →  3 props
- `dist/apps/word-add-in/index.html<style#0>:25`  →  3 props
- `dist/features/autoroute/index.html<style#0>:25`  →  3 props
- `dist/features/clash-solver/index.html<style#0>:25`  →  3 props
- `dist/features/pdf-to-3d/index.html<style#0>:25`  →  3 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:25`  →  3 props
- `templates/app-page.html<style#0>:25`  →  3 props

### `.app-hero-card .crumb` × 16
_Properties touched: `color`, `font-size`, `letter-spacing`, `margin-bottom`, `text-transform`_
- `dist/apps/adelphos-chat/index.html<style#0>:26`  →  5 props
- `dist/apps/autocad-copilot/index.html<style#0>:26`  →  5 props
- `dist/apps/cobie-manager/index.html<style#0>:26`  →  5 props
- `dist/apps/document-controller/index.html<style#0>:26`  →  5 props
- `dist/apps/excel-add-in/index.html<style#0>:26`  →  5 props
- `dist/apps/qa-manager/index.html<style#0>:26`  →  5 props
- `dist/apps/report-builder/index.html<style#0>:26`  →  5 props
- `dist/apps/revit-copilot/index.html<style#0>:26`  →  5 props
- `dist/apps/schedule-builder/index.html<style#0>:26`  →  5 props
- `dist/apps/specbuilder/index.html<style#0>:26`  →  5 props
- `dist/apps/word-add-in/index.html<style#0>:26`  →  5 props
- `dist/features/autoroute/index.html<style#0>:26`  →  5 props
- `dist/features/clash-solver/index.html<style#0>:26`  →  5 props
- `dist/features/pdf-to-3d/index.html<style#0>:26`  →  5 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:26`  →  5 props
- `templates/app-page.html<style#0>:26`  →  5 props

### `.app-hero-card .crumb a` × 16
_Properties touched: `color`, `text-decoration`_
- `dist/apps/adelphos-chat/index.html<style#0>:30`  →  2 props
- `dist/apps/autocad-copilot/index.html<style#0>:30`  →  2 props
- `dist/apps/cobie-manager/index.html<style#0>:30`  →  2 props
- `dist/apps/document-controller/index.html<style#0>:30`  →  2 props
- `dist/apps/excel-add-in/index.html<style#0>:30`  →  2 props
- `dist/apps/qa-manager/index.html<style#0>:30`  →  2 props
- `dist/apps/report-builder/index.html<style#0>:30`  →  2 props
- `dist/apps/revit-copilot/index.html<style#0>:30`  →  2 props
- `dist/apps/schedule-builder/index.html<style#0>:30`  →  2 props
- `dist/apps/specbuilder/index.html<style#0>:30`  →  2 props
- `dist/apps/word-add-in/index.html<style#0>:30`  →  2 props
- `dist/features/autoroute/index.html<style#0>:30`  →  2 props
- `dist/features/clash-solver/index.html<style#0>:30`  →  2 props
- `dist/features/pdf-to-3d/index.html<style#0>:30`  →  2 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:30`  →  2 props
- `templates/app-page.html<style#0>:30`  →  2 props

### `.app-hero-card .crumb a:hover` × 16
_Properties touched: `color`, `text-decoration`_
- `dist/apps/adelphos-chat/index.html<style#0>:31`  →  2 props
- `dist/apps/autocad-copilot/index.html<style#0>:31`  →  2 props
- `dist/apps/cobie-manager/index.html<style#0>:31`  →  2 props
- `dist/apps/document-controller/index.html<style#0>:31`  →  2 props
- `dist/apps/excel-add-in/index.html<style#0>:31`  →  2 props
- `dist/apps/qa-manager/index.html<style#0>:31`  →  2 props
- `dist/apps/report-builder/index.html<style#0>:31`  →  2 props
- `dist/apps/revit-copilot/index.html<style#0>:31`  →  2 props
- `dist/apps/schedule-builder/index.html<style#0>:31`  →  2 props
- `dist/apps/specbuilder/index.html<style#0>:31`  →  2 props
- `dist/apps/word-add-in/index.html<style#0>:31`  →  2 props
- `dist/features/autoroute/index.html<style#0>:31`  →  2 props
- `dist/features/clash-solver/index.html<style#0>:31`  →  2 props
- `dist/features/pdf-to-3d/index.html<style#0>:31`  →  2 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:31`  →  2 props
- `templates/app-page.html<style#0>:31`  →  2 props

### `.app-hero-card .head` × 16
_Properties touched: `align-items`, `display`, `gap`, `grid-template-columns`, `margin-bottom`_
- `dist/apps/adelphos-chat/index.html<style#0>:33`  →  5 props
- `dist/apps/autocad-copilot/index.html<style#0>:33`  →  5 props
- `dist/apps/cobie-manager/index.html<style#0>:33`  →  5 props
- `dist/apps/document-controller/index.html<style#0>:33`  →  5 props
- `dist/apps/excel-add-in/index.html<style#0>:33`  →  5 props
- `dist/apps/qa-manager/index.html<style#0>:33`  →  5 props
- `dist/apps/report-builder/index.html<style#0>:33`  →  5 props
- `dist/apps/revit-copilot/index.html<style#0>:33`  →  5 props
- `dist/apps/schedule-builder/index.html<style#0>:33`  →  5 props
- `dist/apps/specbuilder/index.html<style#0>:33`  →  5 props
- `dist/apps/word-add-in/index.html<style#0>:33`  →  5 props
- `dist/features/autoroute/index.html<style#0>:33`  →  5 props
- `dist/features/clash-solver/index.html<style#0>:33`  →  5 props
- `dist/features/pdf-to-3d/index.html<style#0>:33`  →  5 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:33`  →  5 props
- `templates/app-page.html<style#0>:33`  →  5 props

### `.app-hero-card .head img` × 16
_Properties touched: `border-radius`, `box-shadow`, `height`, `object-fit`, `width`_
- `dist/apps/adelphos-chat/index.html<style#0>:37`  →  5 props
- `dist/apps/autocad-copilot/index.html<style#0>:37`  →  5 props
- `dist/apps/cobie-manager/index.html<style#0>:37`  →  5 props
- `dist/apps/document-controller/index.html<style#0>:37`  →  5 props
- `dist/apps/excel-add-in/index.html<style#0>:37`  →  5 props
- `dist/apps/qa-manager/index.html<style#0>:37`  →  5 props
- `dist/apps/report-builder/index.html<style#0>:37`  →  5 props
- `dist/apps/revit-copilot/index.html<style#0>:37`  →  5 props
- `dist/apps/schedule-builder/index.html<style#0>:37`  →  5 props
- `dist/apps/specbuilder/index.html<style#0>:37`  →  5 props
- `dist/apps/word-add-in/index.html<style#0>:37`  →  5 props
- `dist/features/autoroute/index.html<style#0>:37`  →  5 props
- `dist/features/clash-solver/index.html<style#0>:37`  →  5 props
- `dist/features/pdf-to-3d/index.html<style#0>:37`  →  5 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:37`  →  5 props
- `templates/app-page.html<style#0>:37`  →  5 props

### `.app-hero-card h1` × 16
_Properties touched: `color`, `font-size`, `font-weight`, `letter-spacing`, `line-height`, `margin`_
- `dist/apps/adelphos-chat/index.html<style#0>:41`  →  6 props
- `dist/apps/autocad-copilot/index.html<style#0>:41`  →  6 props
- `dist/apps/cobie-manager/index.html<style#0>:41`  →  6 props
- `dist/apps/document-controller/index.html<style#0>:41`  →  6 props
- `dist/apps/excel-add-in/index.html<style#0>:41`  →  6 props
- `dist/apps/qa-manager/index.html<style#0>:41`  →  6 props
- `dist/apps/report-builder/index.html<style#0>:41`  →  6 props
- `dist/apps/revit-copilot/index.html<style#0>:41`  →  6 props
- `dist/apps/schedule-builder/index.html<style#0>:41`  →  6 props
- `dist/apps/specbuilder/index.html<style#0>:41`  →  6 props
- `dist/apps/word-add-in/index.html<style#0>:41`  →  6 props
- `dist/features/autoroute/index.html<style#0>:41`  →  6 props
- `dist/features/clash-solver/index.html<style#0>:41`  →  6 props
- `dist/features/pdf-to-3d/index.html<style#0>:41`  →  6 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:41`  →  6 props
- `templates/app-page.html<style#0>:41`  →  6 props

### `.app-hero-card .surf` × 16
_Properties touched: `color`, `display`, `font-size`, `letter-spacing`, `margin-top`, `text-transform`_
- `dist/apps/adelphos-chat/index.html<style#0>:45`  →  6 props
- `dist/apps/autocad-copilot/index.html<style#0>:45`  →  6 props
- `dist/apps/cobie-manager/index.html<style#0>:45`  →  6 props
- `dist/apps/document-controller/index.html<style#0>:45`  →  6 props
- `dist/apps/excel-add-in/index.html<style#0>:45`  →  6 props
- `dist/apps/qa-manager/index.html<style#0>:45`  →  6 props
- `dist/apps/report-builder/index.html<style#0>:45`  →  6 props
- `dist/apps/revit-copilot/index.html<style#0>:45`  →  6 props
- `dist/apps/schedule-builder/index.html<style#0>:45`  →  6 props
- `dist/apps/specbuilder/index.html<style#0>:45`  →  6 props
- `dist/apps/word-add-in/index.html<style#0>:45`  →  6 props
- `dist/features/autoroute/index.html<style#0>:45`  →  6 props
- `dist/features/clash-solver/index.html<style#0>:45`  →  6 props
- `dist/features/pdf-to-3d/index.html<style#0>:45`  →  6 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:45`  →  6 props
- `templates/app-page.html<style#0>:45`  →  6 props

### `.app-hero-card .claim` × 16
_Properties touched: `color`, `font-size`, `font-weight`, `letter-spacing`, `line-height`, `margin`, `max-width`_
- `dist/apps/adelphos-chat/index.html<style#0>:49`  →  7 props
- `dist/apps/autocad-copilot/index.html<style#0>:49`  →  7 props
- `dist/apps/cobie-manager/index.html<style#0>:49`  →  7 props
- `dist/apps/document-controller/index.html<style#0>:49`  →  7 props
- `dist/apps/excel-add-in/index.html<style#0>:49`  →  7 props
- `dist/apps/qa-manager/index.html<style#0>:49`  →  7 props
- `dist/apps/report-builder/index.html<style#0>:49`  →  7 props
- `dist/apps/revit-copilot/index.html<style#0>:49`  →  7 props
- `dist/apps/schedule-builder/index.html<style#0>:49`  →  7 props
- `dist/apps/specbuilder/index.html<style#0>:49`  →  7 props
- `dist/apps/word-add-in/index.html<style#0>:49`  →  7 props
- `dist/features/autoroute/index.html<style#0>:49`  →  7 props
- `dist/features/clash-solver/index.html<style#0>:49`  →  7 props
- `dist/features/pdf-to-3d/index.html<style#0>:49`  →  7 props
- `dist/features/plantroom-designer-3d/index.html<style#0>:49`  →  7 props
- `templates/app-page.html<style#0>:49`  →  7 props

## ⚠ !important wars

_Showing top 30 of 86_

### `.features-group > h3` · `font-size` × 16 `!important`
- `dist/apps/adelphos-chat/index.html<style#0>:175` → `12px`
- `dist/apps/autocad-copilot/index.html<style#0>:175` → `12px`
- `dist/apps/cobie-manager/index.html<style#0>:175` → `12px`
- `dist/apps/document-controller/index.html<style#0>:175` → `12px`
- `dist/apps/excel-add-in/index.html<style#0>:175` → `12px`
- `dist/apps/qa-manager/index.html<style#0>:175` → `12px`
- `dist/apps/report-builder/index.html<style#0>:175` → `12px`
- `dist/apps/revit-copilot/index.html<style#0>:175` → `12px`
- `dist/apps/schedule-builder/index.html<style#0>:175` → `12px`
- `dist/apps/specbuilder/index.html<style#0>:175` → `12px`
- `dist/apps/word-add-in/index.html<style#0>:175` → `12px`
- `dist/features/autoroute/index.html<style#0>:175` → `12px`
- `dist/features/clash-solver/index.html<style#0>:175` → `12px`
- `dist/features/pdf-to-3d/index.html<style#0>:175` → `12px`
- `dist/features/plantroom-designer-3d/index.html<style#0>:175` → `12px`
- `templates/app-page.html<style#0>:175` → `12px`

### `.features-group > h3` · `font-weight` × 16 `!important`
- `dist/apps/adelphos-chat/index.html<style#0>:175` → `700`
- `dist/apps/autocad-copilot/index.html<style#0>:175` → `700`
- `dist/apps/cobie-manager/index.html<style#0>:175` → `700`
- `dist/apps/document-controller/index.html<style#0>:175` → `700`
- `dist/apps/excel-add-in/index.html<style#0>:175` → `700`
- `dist/apps/qa-manager/index.html<style#0>:175` → `700`
- `dist/apps/report-builder/index.html<style#0>:175` → `700`
- `dist/apps/revit-copilot/index.html<style#0>:175` → `700`
- `dist/apps/schedule-builder/index.html<style#0>:175` → `700`
- `dist/apps/specbuilder/index.html<style#0>:175` → `700`
- `dist/apps/word-add-in/index.html<style#0>:175` → `700`
- `dist/features/autoroute/index.html<style#0>:175` → `700`
- `dist/features/clash-solver/index.html<style#0>:175` → `700`
- `dist/features/pdf-to-3d/index.html<style#0>:175` → `700`
- `dist/features/plantroom-designer-3d/index.html<style#0>:175` → `700`
- `templates/app-page.html<style#0>:175` → `700`

### `.features-group > h3` · `color` × 16 `!important`
- `dist/apps/adelphos-chat/index.html<style#0>:175` → `var(--brand-teal)`
- `dist/apps/autocad-copilot/index.html<style#0>:175` → `var(--brand-teal)`
- `dist/apps/cobie-manager/index.html<style#0>:175` → `var(--brand-teal)`
- `dist/apps/document-controller/index.html<style#0>:175` → `var(--brand-teal)`
- `dist/apps/excel-add-in/index.html<style#0>:175` → `var(--brand-teal)`
- `dist/apps/qa-manager/index.html<style#0>:175` → `var(--brand-teal)`
- `dist/apps/report-builder/index.html<style#0>:175` → `var(--brand-teal)`
- `dist/apps/revit-copilot/index.html<style#0>:175` → `var(--brand-teal)`
- `dist/apps/schedule-builder/index.html<style#0>:175` → `var(--brand-teal)`
- `dist/apps/specbuilder/index.html<style#0>:175` → `var(--brand-teal)`
- `dist/apps/word-add-in/index.html<style#0>:175` → `var(--brand-teal)`
- `dist/features/autoroute/index.html<style#0>:175` → `var(--brand-teal)`
- `dist/features/clash-solver/index.html<style#0>:175` → `var(--brand-teal)`
- `dist/features/pdf-to-3d/index.html<style#0>:175` → `var(--brand-teal)`
- `dist/features/plantroom-designer-3d/index.html<style#0>:175` → `var(--brand-teal)`
- `templates/app-page.html<style#0>:175` → `var(--brand-teal)`

### `.features-group > h3` · `margin` × 16 `!important`
- `dist/apps/adelphos-chat/index.html<style#0>:175` → `0 0 var(--space-sm)`
- `dist/apps/autocad-copilot/index.html<style#0>:175` → `0 0 var(--space-sm)`
- `dist/apps/cobie-manager/index.html<style#0>:175` → `0 0 var(--space-sm)`
- `dist/apps/document-controller/index.html<style#0>:175` → `0 0 var(--space-sm)`
- `dist/apps/excel-add-in/index.html<style#0>:175` → `0 0 var(--space-sm)`
- `dist/apps/qa-manager/index.html<style#0>:175` → `0 0 var(--space-sm)`
- `dist/apps/report-builder/index.html<style#0>:175` → `0 0 var(--space-sm)`
- `dist/apps/revit-copilot/index.html<style#0>:175` → `0 0 var(--space-sm)`
- `dist/apps/schedule-builder/index.html<style#0>:175` → `0 0 var(--space-sm)`
- `dist/apps/specbuilder/index.html<style#0>:175` → `0 0 var(--space-sm)`
- `dist/apps/word-add-in/index.html<style#0>:175` → `0 0 var(--space-sm)`
- `dist/features/autoroute/index.html<style#0>:175` → `0 0 var(--space-sm)`
- `dist/features/clash-solver/index.html<style#0>:175` → `0 0 var(--space-sm)`
- `dist/features/pdf-to-3d/index.html<style#0>:175` → `0 0 var(--space-sm)`
- `dist/features/plantroom-designer-3d/index.html<style#0>:175` → `0 0 var(--space-sm)`
- `templates/app-page.html<style#0>:175` → `0 0 var(--space-sm)`

### `.features-group > h3` · `padding` × 16 `!important`
- `dist/apps/adelphos-chat/index.html<style#0>:175` → `0`
- `dist/apps/autocad-copilot/index.html<style#0>:175` → `0`
- `dist/apps/cobie-manager/index.html<style#0>:175` → `0`
- `dist/apps/document-controller/index.html<style#0>:175` → `0`
- `dist/apps/excel-add-in/index.html<style#0>:175` → `0`
- `dist/apps/qa-manager/index.html<style#0>:175` → `0`
- `dist/apps/report-builder/index.html<style#0>:175` → `0`
- `dist/apps/revit-copilot/index.html<style#0>:175` → `0`
- `dist/apps/schedule-builder/index.html<style#0>:175` → `0`
- `dist/apps/specbuilder/index.html<style#0>:175` → `0`
- `dist/apps/word-add-in/index.html<style#0>:175` → `0`
- `dist/features/autoroute/index.html<style#0>:175` → `0`
- `dist/features/clash-solver/index.html<style#0>:175` → `0`
- `dist/features/pdf-to-3d/index.html<style#0>:175` → `0`
- `dist/features/plantroom-designer-3d/index.html<style#0>:175` → `0`
- `templates/app-page.html<style#0>:175` → `0`

### `.demo-chat-box.dragging` · `transition` × 4 `!important`
- `chat-panel/css/chat-panel.css:338` → `none`
- `chat-panel/index-styles.css:2469` → `none`
- `css/chat-panel.css:339` → `none`
- `css/index-styles.css:2750` → `none`

### `.demo-chat-box.free-floating` · `position` × 3 `!important`
- `chat-panel/css/chat-panel.css:331` → `fixed`
- `css/chat-panel.css:328` → `fixed`
- `css/index-styles.css:2744` → `fixed`

### `html` · `height` × 3 `!important`
- `css/index-styles.css:4` → `auto`
- `about.html<style#2>:3` → `auto`
- `dist/index.html<style#0>:3` → `auto`

### `body` · `height` × 3 `!important`
- `css/index-styles.css:4` → `auto`
- `about.html<style#2>:3` → `auto`
- `dist/index.html<style#0>:3` → `auto`

### `html.dark-mode` · `background` × 3 `!important`
- `about.html<style#0>:2` → `#1a1a1a`
- `index.html<style#0>:5` → `#1a1a1a`
- `sandbox/roadmap/index.html<style#0>:5` → `#1a1a1a`

### `html.dark-mode body` · `background` × 3 `!important`
- `about.html<style#0>:2` → `#1a1a1a`
- `index.html<style#0>:5` → `#1a1a1a`
- `sandbox/roadmap/index.html<style#0>:5` → `#1a1a1a`

### `html.dark-mode canvas` · `background` × 3 `!important`
- `about.html<style#0>:3` → `radial-gradient(ellipse at center, #2a2a2a 0%, #1a1a1a 70%)`
- `index.html<style#0>:6` → `radial-gradient(ellipse at center, #2a2a2a 0%, #1a1a1a 70%)`
- `sandbox/roadmap/index.html<style#0>:6` → `radial-gradient(ellipse at center, #2a2a2a 0%, #1a1a1a 70%)`

### `.demo-view-overlay` · `opacity` × 2 `!important`
- `chat-panel/css/chat-panel.css:112` → `1`
- `css/index-styles.css:108` → `1`

### `.demo-view-overlay` · `visibility` × 2 `!important`
- `chat-panel/css/chat-panel.css:112` → `visible`
- `css/index-styles.css:108` → `visible`

### `.demo-view-overlay` · `pointer-events` × 2 `!important`
- `chat-panel/css/chat-panel.css:112` → `auto`
- `css/index-styles.css:108` → `auto`

### `.demo-view-overlay .demo-text-panel` · `display` × 2 `!important`
- `chat-panel/css/chat-panel.css:150` → `flex`
- `css/chat-panel.css:139` → `flex`

### `.demo-view-overlay .demo-image-container` · `height` × 2 `!important`
- `chat-panel/css/chat-panel.css:227` → `60vh`
- `css/chat-panel.css:216` → `60vh`

### `.demo-view-overlay .demo-image-container` · `width` × 2 `!important`
- `chat-panel/css/chat-panel.css:227` → `100%`
- `css/chat-panel.css:216` → `100%`

### `.demo-view-overlay .demo-containers-stack` · `width` × 2 `!important`
- `chat-panel/css/chat-panel.css:241` → `100%`
- `css/chat-panel.css:230` → `100%`

### `.demo-chat-box.snapping-back` · `transition` × 2 `!important`
- `chat-panel/css/chat-panel.css:349` → `left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease`
- `css/chat-panel.css:350` → `left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease`

### `.demo-view-overlay .demo-chat-body` · `display` × 2 `!important`
- `chat-panel/css/chat-panel.css:363` → `flex`
- `css/chat-panel.css:364` → `flex`

### `.demo-view-overlay .demo-chat-body` · `flex-direction` × 2 `!important`
- `chat-panel/css/chat-panel.css:363` → `row`
- `css/chat-panel.css:364` → `row`

### `.editor-area` · `padding` × 2 `!important`
- `chat-panel/css/chat-panel.css:1366` → `30px 20px`
- `css/chat-panel.css:1368` → `30px 20px`

### `.editor-area` · `align-items` × 2 `!important`
- `chat-panel/css/chat-panel.css:1366` → `flex-start`
- `css/chat-panel.css:1368` → `flex-start`

### `.right-column .demo-chat-history-sidebar` · `position` × 2 `!important`
- `chat-panel/css/chat-panel.css:1871` → `relative`
- `css/chat-panel.css:1977` → `relative`

### `.right-column .demo-chat-history-sidebar` · `min-width` × 2 `!important`
- `chat-panel/css/chat-panel.css:1871` → `100px`
- `css/chat-panel.css:1977` → `100px`

### `.right-column .demo-chat-history-sidebar` · `max-width` × 2 `!important`
- `chat-panel/css/chat-panel.css:1871` → `none`
- `css/chat-panel.css:1977` → `none`

### `.right-column .demo-chat-history-sidebar` · `height` × 2 `!important`
- `chat-panel/css/chat-panel.css:1871` → `100%`
- `css/chat-panel.css:1977` → `100%`

### `.right-column .demo-chat-history-sidebar` · `border-right` × 2 `!important`
- `chat-panel/css/chat-panel.css:1871` → `none`
- `css/chat-panel.css:1977` → `none`

### `.demo-view-overlay .demo-chat-box .demo-titlebar-btn.min` · `opacity` × 2 `!important`
- `chat-panel/css/chat-panel.css:2340` → `1`
- `css/chat-panel.css:2446` → `1`

## 🔥 Property pressure (most-fought-over properties)

| property | rules touching it |
|----------|-------------------|
| `color` | 2497 |
| `background` | 2169 |
| `font-size` | 1665 |
| `display` | 1315 |
| `padding` | 1011 |
| `font-weight` | 954 |
| `margin` | 830 |
| `border-radius` | 823 |
| `gap` | 700 |
| `position` | 671 |
| `width` | 620 |
| `height` | 561 |
| `transition` | 559 |
| `line-height` | 510 |
| `letter-spacing` | 505 |
| `font-family` | 493 |
| `align-items` | 472 |
| `opacity` | 445 |
| `transform` | 421 |
| `box-shadow` | 372 |
| `grid-template-columns` | 368 |
| `border` | 358 |
| `max-width` | 322 |
| `cursor` | 322 |
| `overflow` | 311 |
| `margin-bottom` | 310 |
| `pointer-events` | 298 |
| `left` | 272 |
| `border-color` | 270 |
| `text-transform` | 252 |

## 👻 Orphaned selectors (no matching DOM hook found)

_Conservative — only flagged when every `.class` and `#id` in the selector is missing from every HTML file scanned. Tag-only / html / body / pseudo-element rules are intentionally not flagged._

_Total orphans: 53; in 12 files_

### `about.html<style#1>` — 1 orphans
- `html.fonts-loaded`  (3)

### `chat-panel/css/chat-panel.css` — 5 orphans
- `.demo-view-overlay .demo-containers-panel .demo-intro-image`  (220)
- `.ribbon-row-inner .ribbon-btn`  (1158)
- `.chat-text`  (3098)
- `.demo-chat-input-row.cursor-style .chat-build-dropdown`  (3452)
- `.demo-chat-input-row.cursor-style .chat-build-dropdown:hover .chat-dropdown-menu`  (3505)

### `chat-panel/index-styles.css` — 7 orphans
- `.demo-view-overlay .demo-containers-panel .demo-intro-image`  (1954)
- `.demo-chat-input-row.cursor-style .chat-build-dropdown`  (3258)
- `.demo-chat-input-row.cursor-style .chat-build-dropdown:hover .chat-dropdown-menu`  (3303)
- `.demo-history-preview`  (4630)
- `.view-buildx .buildx-panel-text`  (5275)
- `.view-buildx .buildx-panel-list`  (5275)
- `.buildx-site-footer .footer-legal a`  (5673)

### `chat-panel/shared-styles.css` — 2 orphans
- `.chat-text`  (349)
- `html.dark-mode .footer-legal a`  (1001)

### `css/chat-panel.css` — 5 orphans
- `.demo-view-overlay .demo-containers-panel .demo-intro-image`  (209)
- `.ribbon-row-inner .ribbon-btn`  (1160)
- `.chat-text`  (3204)
- `.demo-chat-input-row.cursor-style .chat-build-dropdown`  (3558)
- `.demo-chat-input-row.cursor-style .chat-build-dropdown:hover .chat-dropdown-menu`  (3611)

### `css/index-styles.css` — 10 orphans
- `.demo-view-overlay .demo-containers-panel .demo-intro-image`  (2080)
- `body.view-7-active .qa-manager`  (2124)
- `.demo-chat-input-row.cursor-style .chat-build-dropdown`  (3558)
- `.demo-chat-input-row.cursor-style .chat-build-dropdown:hover .chat-dropdown-menu`  (3603)
- `.demo-history-preview`  (4998)
- `.view-buildx .buildx-panel-text`  (5647)
- `.view-buildx .buildx-panel-list`  (5647)
- `.buildx-site-footer .footer-legal a`  (6045)
- `.riba-card-left .riba-stage-number` @media(@media (max-width: 767px))  (99)
- `.riba-card-left .riba-stage-name` @media(@media (max-width: 767px))  (103)

### `css/shared-styles.css` — 2 orphans
- `.chat-text`  (356)
- `html.dark-mode .footer-legal a`  (1008)

### `dist/index.html<style#1>` — 8 orphans
- `.banner-card.hero-banner`  (309)
- `.banner-card.hero-banner .copy`  (314)
- `.banner-card.hero-banner h2`  (327)
- `.banner-card.hero-banner .claim`  (334)
- `.home-section-head a.see-all`  (396)
- `.home-section-head a.see-all:hover`  (400)
- `.scene-modal.open`  (538)
- `.row-1up`  (580)

### `index.html<style#0>` — 1 orphans
- `html.fonts-loaded`  (4)

### `sandbox/roadmap/index.html<style#0>` — 1 orphans
- `html.fonts-loaded`  (4)

### `sandbox/sandbox.css` — 2 orphans
- `main.sandbox-main h1`  (356)
- `main.sandbox-main h2`  (362)

### `templates/home.html<style#0>` — 9 orphans
- `.home-hero .hero-video .fallback`  (102)
- `.banner-card.hero-banner`  (128)
- `.banner-card.hero-banner .copy`  (133)
- `.banner-card.hero-banner h2`  (146)
- `.banner-card.hero-banner .claim`  (153)
- `.home-section-head a.see-all`  (215)
- `.home-section-head a.see-all:hover`  (219)
- `.scene-modal.open`  (357)
- `.row-1up`  (399)
