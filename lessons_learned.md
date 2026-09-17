# Lessons learned

What building this local-only PDF editor taught us, in the order the pain arrived.

## 1. Pin dependencies to the local toolchain, not just `latest`

- `npm install` crashed on npm 10.8.2 with `Cannot read properties of null
  (reading 'edgesOut')` while resolving vitest 5's peer graph. Retrying with a
  newer npm worked, but the real fix was pinning versions that match the local
  Node 20.19 runtime: vitest 4, `pdfjs-dist` 5.5.x. The Docker build stage uses
  Node 22, so newer majors would have built fine in CI while breaking every
  local `npm install`, `dev`, and `test` run.
- **Takeaway:** check `engines` against the oldest Node anyone will run locally
  before accepting a major bump, and treat "works in Docker" as necessary but
  not sufficient.

## 2. Audit PDF libraries before wiring them in

- `pdfjs-dist` 5.6.x carried a high-severity advisory (GHSA-hq66-cqwq-w95j):
  arbitrary JavaScript execution on opening a malicious PDF. For an app whose
  entire job is opening strangers' PDFs, that is a ship-blocker, not a warning.
  We pinned 5.5.207 — outside the vulnerable range and still Node-20-compatible
  — and kept `npm audit` at zero findings.
- **Takeaway:** run `npm audit` before the first real feature lands, especially
  on file-format parsers. Also set `isEvalSupported: false` on the pdf.js
  document task as defense in depth.

## 3. pdf.js `render()` silently hangs when `requestAnimationFrame` is throttled

- Symptom: `getDocument`, `getPage`, even `getOperatorList` all resolved, plain
  canvas `toBlob` worked — only `page.render().promise` never settled. Root
  cause, found in the pdf.js source: the render loop schedules continuations
  with `window.requestAnimationFrame`, which background/headless tabs throttle
  to zero. Diagnosis required instrumenting each pipeline stage separately;
  nothing threw, so there was nothing to catch.
- Fix: render thumbnails with `intent: 'print'`, which uses `setTimeout`
  instead. Bonus: thumbnails now complete while the tab is backgrounded, which
  is genuinely better UX for large documents.
- **Takeaway:** when an async call neither resolves nor rejects, suspect the
  scheduler, not the code. And prefer `intent: 'print'` for any offscreen
  thumbnail work.

## 4. Always pass pdf.js a private copy of the file bytes

- pdf.js transfers the input buffer to its worker (detaching it), and pdf-lib
  may do the same on load. The store keeps one canonical `ArrayBuffer` per
  source, so every parse/render call gets `bytes.slice(0)`.
- **Takeaway:** treat loaded file bytes as immutable shared state; copy at every
  library boundary.

## 5. Bundle every pdf.js runtime asset locally — worker, fonts, CMaps

- Offline/local-only means no CDN for the worker, standard fonts, or CMaps.
  The worker resolves via Vite's `?url` import (separate asset in dev and
  prod); `standard_fonts/` and `cmaps/` are copied into `public/pdfjs/` by a
  `predev`/`prebuild` script so plain PDFs with non-embedded fonts and CJK
  text render correctly.
- **Takeaway:** a PDF renderer is three assets, not one library. If any of them
  404s, rendering degrades silently (fallback fonts) or stalls.

## 6. Verify in the real container — dev hides nginx bugs

- The single most valuable catch of the project: nginx served `.mjs` as
  `application/octet-stream`, and browsers refuse module workers with the wrong
  MIME type. Dev (Vite) served it correctly, so this only surfaced in Docker.
  Fixed with an explicit `location ~* \.mjs$` → `text/javascript` block.
- **Takeaway:** the deliverable is the container, so the verification loop must
  run against the container, not just `vite preview`.

## 7. Bake rotation into rendered pixels, not CSS

- Thumbnails render with the rotation folded into the pdf.js viewport
  (`getViewport({ rotation: total })`, keyed in the thumbnail cache), image
  exports re-render rotated bytes via canvas, and signature placement is stored
  in displayed-space fractions mapped back to page points at export. CSS
  transforms would have made every downstream coordinate conversion wrong.
- The rect map (displayed top-left fractions → bottom-left PDF points for all
  four rotations) is the fiddliest math in the codebase, so it is unit-tested
  directly — including full-page identity for 0/90/180/270/360/-90.
- **Takeaway:** keep one canonical coordinate story (fractions of what the user
  sees) and convert once, at the boundary, with tests.

## 8. Keep original image bytes whenever possible

- Unrotated JPEG/PNG pages embed the original file bytes (no decode/re-encode:
  smaller files, zero quality loss). Canvas normalization runs only when a
  rotation forces it, and HEIC/WebP conversion happens once at import.
- The 1.35 MB `heic2any` bundle is dynamically imported on first HEIC use, so
  it ships as a separate lazy chunk instead of taxing every load.
- **Takeaway:** lossy or expensive conversions should be lazy and one-time;
  never re-encode on the happy path.

## 9. Test what each environment can actually run

- Node has no canvas, so DOM-dependent paths (image decode, rotation,
  signature drawing) can't run in vitest. Strategy used here:
  - Pure logic (rect mapping, store ops, `buildPdf` byte output, filename
    rules) → unit tests, including a hand-rolled rectangular PNG fixture
    (base64 constant; `node:` imports are invisible under
    `types: ["vite/client"]`, so the fixture avoids them).
  - DOM-gated paths → `it.runIf` so CI stays honest instead of silently passing.
  - Browser wiring → temporary in-app harnesses (auto-load fixture, exercise
    the real UI/store path, print DOM markers), verified in the container,
    then deleted with a clean rebuild.
- **Takeaway:** decide per test file which runtime it targets, and make skipped
  tests visibly skipped rather than vacuously green.

## 10. Automation has blind spots — name them instead of hand-waving

- The scripted browser can't do real drags, double-clicks (too slow between
  calls to register as `dblclick`), hand-drawing, native file pickers, or
  observe downloaded file bytes. We covered those gaps with unit tests on the
  underlying logic (reorder math, placement math, `buildPdf` output bytes) plus
  explicit manual-test notes — and flagged each one at the time rather than
  claiming full automation.
- Related: overlay interactions must `stopPropagation` or dnd-kit's sortable
  drag and page selection fire underneath; the global Delete shortcut must
  ignore focus inside overlays and inputs.
- **Takeaway:** write down what the harness cannot prove. Unknown unknowns are
  worse than known manual checks.

## 11. Small UX details compound

- `touch-action: none` enables pointer dragging but kills touch scrolling that
  starts on a thumbnail — acceptable for a desktop-first tool, revisit for mobile.
- A signature dialog needs a real Close button, not just Escape/backdrop
  (mobile has neither reliably). Same reason the zoom view got explicit nav buttons.
- Sequential multi-file downloads need a 500 ms stagger and an upfront note
  that the browser may ask permission.
- Uploaded signature photos usually have white backgrounds: a threshold-based
  transparency toggle (default on) makes uploads usable; drawn signatures are
  transparent by construction.
