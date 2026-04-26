# Demo asset folder — drop-in convention

One folder per demo slug. Filenames are fixed. Drop your real assets in
at the listed dimensions and the sandbox HTML picks them up — no edits.

## Folder layout

```
sandbox/demo-assets/
├── _placeholder/                 ← shared default. Used by any demo with no folder.
│     ├── screenshot.svg          1920 × 1080  (replace with screenshot.jpg)
│     └── thumbnail.svg           640  × 360   (replace with thumbnail.jpg)
│
└── <slug>/                        ← one per demo (matches the YAML slug)
      ├── screenshot.jpg           1920 × 1080  · jpg, < 250 KB · hero on the detail page
      ├── thumbnail.jpg            640  × 360   · jpg, < 60  KB · gallery card
      ├── video.mp4                1920 × 1080  · h.264, 30–90 s · < 25 MB
      ├── poster.jpg               1920 × 1080  · video poster (can be a copy of screenshot.jpg)
      └── caption.vtt              optional WebVTT subtitles
```

## Rules

1. **Folder name == slug** (e.g. `place-svp`, `fire-alarm-design`).
2. **Filenames are fixed** — no version suffixes, no spaces, all lowercase.
3. **Resolution is fixed** — anything else gets letterboxed or cropped.
4. **No code change required** to swap a placeholder for a real asset — just overwrite the file.
5. **Once a demo has real assets**, delete the matching SVG placeholders in that folder so it's obvious which demos are still pending.

## Current placeholder slugs (already created)

- `place-svp` ← real asset wired into the sandbox detail page
- `extend-connectors`
- `fire-alarm-design`
- `qa-manager-clash-detection`
- `smart-tagging`

## How to add a new demo

1. `mkdir sandbox/demo-assets/<new-slug>/`
2. Copy the placeholder SVGs in (or drop real `screenshot.jpg` / `thumbnail.jpg` / `video.mp4` straight away).
3. Add a row to the gallery (`sandbox/demos/index.html`) using the existing card markup.
4. Optionally create a detail page at `sandbox/demos/<new-slug>.html` from the `place-svp.html` template.

## What the production build will do later

When the generator (`build-demo-pages.mjs`, TODO) takes over:

- `data/demos/<slug>.yaml` becomes the source of truth.
- Assets move from `sandbox/demo-assets/<slug>/` to `dist/demos/<slug>/`.
- Videos > 5 MB move to **Cloudflare Stream**; the YAML's `video.src` swaps to the HLS URL automatically.
- Thumbnails and screenshots stay local and get fingerprinted for cache-busting.
- The HTML template is the same one we approved in this sandbox — no divergence.

## Production target sizes

| Asset | Sandbox | Production target | Why |
|-------|---------|-------------------|-----|
| Screenshot | < 250 KB | 80–150 KB jpg @ q=82, 1920×1080 | LCP under 1.5s on 3G |
| Thumbnail | < 60 KB | 25–40 KB jpg @ q=78, 640×360 | 24 thumbs in the gallery, total < 1 MB |
| Video | < 25 MB local | HLS via Cloudflare Stream, no download | Bandwidth + adaptive bitrate |
| Poster | same as screenshot | same | shown before play |
