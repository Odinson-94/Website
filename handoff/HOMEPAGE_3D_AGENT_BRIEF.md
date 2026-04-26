# Homepage 3D — Agent Brief

> Self-contained spec for the next agent. Two jobs:
>
> 1. **Remove the "click to expand" modal feature** (visible badge + click handlers + the modal mount + the OrbitControls codepath).
> 2. **Replace the three placeholder Three.js scenes** on the homepage with proper, recognisable, polished MEP previews.
>
> **Do not strip or restructure anything else on the homepage.** Just the two jobs above.

---

## 1. The file you'll be editing

**Single file:** `templates/home.html`

Everything you need is in this one file:

- The HTML markup (the inner-card slots that host the 3D viewports).
- The CSS (a `<style>` block at the top of the file).
- The Three.js scene factories + viewer/modal code (a `<script type="module">` block at the bottom of the file).

After you edit `templates/home.html`, regenerate the live page with:

```powershell
cd "g:\My Drive\JPA Projects\00 Master\12 Marketing\Website\Website"
node scripts/adelphos_CLI.mjs auto-all
```

Output URL to verify: <http://localhost:8765/dist/index.html>

---

## 2. JOB 1 — Remove "click to expand"

The current homepage embeds three small 3D previews inside the **Revit Copilot bundle banner** (the big blue cinematic card at the top). Each preview lives inside an `<a class="inner-card">` linking to the feature's own page (`/dist/features/<slug>/`).

Right now the previews **also** open a fullscreen modal on click, with OrbitControls. Remove that interaction entirely. Keep the inline preview, keep the parent `<a>` link to the feature page (so a click navigates), but lose the modal.

### What to remove

In `templates/home.html`, remove (or comment out) every reference listed below. **Do not touch anything else in the file.**

#### CSS block — remove the entire `.scene-modal` rule set

Find the comment header:

```css
  /* ── 3D MODAL — fullscreen expansion when a scene is clicked ────────── */
```

Remove everything from that comment line down to the closing `}` of `.scene-modal .modal-stage canvas { ... }` (about 40 lines).

#### CSS block — remove the "click to expand" hint badge

In the `.bundle-banner .inner-card .scene-3d` rule set, remove the `cursor: zoom-in;` declaration and remove the entire `.bundle-banner .inner-card .scene-3d::after { ... }` rule (the one that injects the `'⤢ click to expand'` pseudo-element badge).

#### HTML body — remove the modal mount

Find:

```html
<!-- Modal mount for the expanded 3D view -->
<div class="scene-modal" id="sceneModal" aria-hidden="true">
  ...
</div>
```

(four lines including its children). Remove the whole block.

#### Module script — remove the modal codepath

In the `<script type="module">` block at the bottom of the file, remove:

- The `OrbitControls` import (`import { OrbitControls } from 'three/addons/controls/OrbitControls.js';`).
- The `TITLES` constant.
- The `controls` parameter handling inside `makeViewer()` (the entire `if (opts.controls) { ... }` block) plus its `controls.update()` call inside `tick()`.
- The "Modal expansion on click" section: `modal`, `modalStage`, `modalTitle`, `modalClose`, `modalViewer`, `openModal()`, `closeModal()` and all three event listeners (`.scene-3d` click, `modalClose` click, `modal` click, `Escape` keydown).

After this, the only thing left in the script block should be:

- The module imports (just `import * as THREE from 'three';`).
- The shared materials.
- The three scene factories (`buildAutoroute`, `buildPlantroom`, `buildClashSolver`).
- The `SCENES` map.
- The `makeViewer()` function (without controls support).
- The "Mount inline previews" loop at the bottom that walks every `.scene-3d` and calls `makeViewer(host, key, { controls: false })`.

The `cursor: zoom-in` and `click to expand` badge being gone means the previews stop *advertising* themselves as expandable. Because the inner-card is wrapped in an `<a href="/dist/features/...">`, clicking now navigates to the feature's full page (which is the intended behaviour without a modal).

### Acceptance criteria for Job 1

1. Hard-refresh `http://localhost:8765/dist/index.html` — no expand badge anywhere on the three previews.
2. Click any preview — the page navigates to the feature page (e.g. `/dist/features/autoroute/index.html`); **no modal opens**.
3. The three inline previews still render and auto-rotate.
4. `Esc` key does nothing on the homepage now (it had only been wired to close the modal).
5. The `<div class="scene-modal">` element is gone from the DOM.
6. Page console: zero errors.

---

## 3. JOB 2 — Better 3D scenes

Replace the three placeholder scenes with polished, recognisable MEP previews. Each scene should:

- Read clearly at the small inline size (~280–340px wide, 16:9).
- Feel like an actual MEP element, not a primitives-puzzle.
- Use the brand-tinted PBR materials already declared at the top of the script block (`matSlab`, `matRoom`, `matPipeA` (teal), `matPipeB` (red), `matDuct` (amber), `matBoiler` (purple), `matPump` (brand teal), `matAHU` (grey)). Add new materials as needed.
- Cast/receive shadows if it doesn't tank performance (3 viewers on one page).
- Auto-rotate gently around the model centre. Rotation speed should match the existing scenes (~0.00018 rad/ms), but you're welcome to refine.

### Where to edit

The three factory functions inside the `<script type="module">` block:

```js
function buildAutoroute(scene)        { ... return { camera: { pos: [...], lookAt: [...] } }; }
function buildPlantroom(scene)        { ... return { camera: { pos: [...], lookAt: [...] } }; }
function buildClashSolver(scene)      { ... return { camera: { pos: [...], lookAt: [...] } }; }
```

Each must:
- Accept `scene` (a `THREE.Scene`) and add its meshes to it.
- Return `{ camera: { pos: [x,y,z], lookAt: [x,y,z] } }` so `makeViewer()` can position the camera.

The lights are added by `makeViewer()` itself (one ambient, two directionals). You can add additional lights inside the factory if needed for a particular scene.

### Scene-by-scene direction

#### Scene 1 — `buildAutoroute(scene)`

**Inspiration:** the MEP Bridge **AutoRoute** command — pipework auto-routed across a building floor, working around walls and other services.

**Replace with:**

- A real-feeling **floor plate** with a few partition walls (low boxes, ~0.5–1m high) carving up rooms — at least three distinct zones.
- Above the floor, a **structural slab** (thin wide slab) at ceiling height (~3m) so the routing has a real "ceiling void" envelope.
- A **routed pipe network**: one source on one side of the floor, three or four destinations across the floor. The pipes should:
  - Use **bends** (`THREE.TorusGeometry` segments or short cylinder elbows) at corners — not 90° corners with no fillet.
  - Avoid passing through walls — route around them.
  - Use the teal pipe material (`matPipeA`) for one service, optionally a second route in red (`matPipeB`) crossing it.
  - Be sized at ~100–150mm diameter equivalent.
- A small **legend** is unnecessary; readability comes from the geometry.
- Suggested camera: isometric-ish (~6, 5, 7), look at floor centre.

**Bonus polish:** subtle bevelled edges on the walls (`RoundedBoxGeometry` from `three/addons/geometries/RoundedBoxGeometry.js`) for production feel.

#### Scene 2 — `buildPlantroom(scene)`

**Inspiration:** the MEP Bridge **3D Plantroom Designer** — a coordinated mechanical plantroom layout.

**Replace with:**

- A bounded **plantroom footprint** (slab + four short walls forming an L or U shape, ~7m × 5m at scale).
- A **boiler** with realistic proportions (slim, tall vertical cylinder ~0.7m diameter × 2.5m tall) plus a small flue pipe rising from the top.
- **Two pumps** sitting on a small concrete plinth, each with a motor block on top and a flexible-connector segment on the inlet.
- An **AHU** (rectangular box) with **labelled supply + return ductwork** — a wide rectangular duct rising from the AHU and turning to exit horizontally.
- **Pipework headers** running along one wall, with branches dropping to each plant item.
- **Maintenance clearance markers** — faint cyan transparent boxes around each plant item (~0.6m clearance) to suggest the access envelope is being respected. Use a transparent material with `opacity: 0.12`.
- Suggested camera: hero angle (~5.5, 4, 6), look at the boiler.

**Bonus polish:** add a small **isolation valve** mesh (a flattened cylinder + handle) on one of the pipework branches.

#### Scene 3 — `buildClashSolver(scene)`

**Inspiration:** the MEP Bridge **break-and-riser** command — a pipe rerouting around an obstructing duct.

**Replace with:**

- A **structural slab** above (thin wide slab, ~3m above the floor) so the ceiling void is bounded.
- A **horizontal duct** running through the void (rectangular box, ~600mm × 400mm cross section).
- A **pipe approaching from one side at duct height**, then **bending down**, **running underneath the duct**, and **bending back up** on the other side at the original height. The bends should use **proper torus segments** for elbow geometry, not bare drops.
- Add a **second crossing service** the pipe must also avoid — e.g. an electrical containment tray (small grey box) running below the duct. The reroute should clear both.
- Two **red highlight spheres** at the elbow points labelled implicitly as "fix points" (keep the existing pattern).
- A **ghosted "before" pipe** (semi-transparent, in red) showing the original straight path that would have clashed — opacity 0.18 — so the viewer reads "this is the fix".
- Suggested camera: side-on angle (~5, 3.2, 5.5), look at the duct centre.

**Bonus polish:** subtle dashed line connecting the elbow points to a small floating annotation pill that reads `Auto-resolved` (use a `THREE.Sprite` with a canvas-rendered text texture).

### What you may add to support this

- The `RoundedBoxGeometry` addon: `import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';`
- Sprite labels: standard `THREE.Sprite` + a 2D canvas texture.
- Extra materials: declare them at the top of the script block, next to the existing `matSlab` / `matRoom` / etc.
- Shadows: enable `renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;` inside `makeViewer()` and toggle `castShadow` / `receiveShadow` on the relevant meshes.

### What you must NOT do

- **Do not** import any third-party model loaders (no GLTF, no OBJ).
- **Do not** add any heavy CDN dependency beyond `three` itself + addons under `three/addons/...`. The existing `<script type="importmap">` already declares the resolution.
- **Do not** change the function signatures: `buildAutoroute(scene)` / `buildPlantroom(scene)` / `buildClashSolver(scene)` must each return `{ camera: { pos, lookAt } }`.
- **Do not** change the `SCENES` map keys — they correspond to feature slugs in `sandbox/data/features.json` (`autoroute`, `plantroom-designer-3d`, `clash-solver`). The build script in `scripts/build-home.mjs` writes `data-scene="<slug>"` per inner-card based on those slugs.
- **Do not** edit any other file — `home.html` is the only one in scope. (If you find you genuinely need to extend the build script, raise it before changing.)

### Acceptance criteria for Job 2

1. Each of the three previews is **immediately recognisable** as MEP (a non-engineer should be able to identify "pipework on a floor" / "plantroom" / "clash fix" within 2 seconds).
2. All three render at 60fps on a modern laptop with all three on screen at once.
3. No console errors, no broken imports.
4. The auto-rotate speed and camera framing produces a flattering view at all rotation angles (no off-screen bits, no clipping into the camera).
5. Geometry uses bends / fillets, not bare 90° intersections.
6. The colour palette stays in-brand — use the existing `matPipeA` (teal), `matPipeB` (red), `matDuct` (amber), `matBoiler` (purple), `matPump` (brand teal) materials.

---

## 4. Reference: how the homepage wires up the previews today

You don't need to touch this — included so you understand the flow:

```
sandbox/data/features.json
  → scripts/build-home.mjs           (combinedBanner() helper)
    → templates/home.html            (renders bundle-banner with inner-cards)
      → each .inner-card has:
          <div class="scene-3d" data-scene="<slug>"></div>
          <div class="ic-body">…</div>
        and is wrapped in <a href="/dist/features/<slug>/index.html">

The <script type="module"> at the bottom of home.html walks every
.scene-3d, reads data-scene, and calls makeViewer(host, key, {controls:false}).
```

So your scene factories receive a `THREE.Scene`, populate it, return their preferred camera setup. That's it.

---

## 5. Testing checklist (run before you hand back)

```powershell
cd "g:\My Drive\JPA Projects\00 Master\12 Marketing\Website\Website"
# Rebuild
node scripts/adelphos_CLI.mjs auto-all

# Smoke-test the home renders
$body = (curl.exe -s "http://localhost:8765/dist/index.html") -join "`n"
"three.js importmap:    $([bool]($body -match 'esm.sh/three@'))"
"3 scene-3d slots:      $((($body | Select-String -Pattern 'class=.scene-3d.' -AllMatches).Matches.Count))"
"OrbitControls GONE:    $(![bool]($body -match 'OrbitControls'))"
"scene-modal GONE:      $(![bool]($body -match 'class=.scene-modal'))"
"click-to-expand GONE:  $(![bool]($body -match 'click to expand'))"
```

All five lines should report `True` after Job 1 + Job 2 are complete.

Open <http://localhost:8765/dist/index.html>, scroll to the Revit Copilot banner, watch the three previews rotate. Click each — you should land on the corresponding feature detail page. No modal at any point.

---

## 6. If anything is unclear

- The brand tone palette is defined as CSS custom properties at the top of `home.html` (`--tone-blue`, `--tone-red`, `--tone-purple`, etc.). Match scene colours to those tones.
- Existing reference shots: `sandbox/feature-assets/<slug>/` (placeholder folders — empty for now).
- The MEP Bridge command this is paying homage to (for Clash Solver) is the **break-and-riser** command — search the MEP Bridge repo for `BreakAndRiser` if you have access; the geometry should mirror that operation.
- Any deviation from the spec — write it in a comment header at the top of your changed function so the next reviewer can see what you decided and why.
