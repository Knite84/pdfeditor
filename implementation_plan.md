Redaction dropped. Here's the plan based on your choices: client-side-only React/Vite/TS, containerized with nginx.

### Architecture
A static SPA — no backend, no uploads. `nginx` serves the built bundle; all PDF/image work happens in the browser via WebAssembly/JS.

### Processing libraries

- `pdf-lib` — write/merge/rotate/split/export, embed images & signatures
- `pdfjs-dist` — render page thumbnails to canvas
- `heic2any` (libheif wasm) — HEIC → PNG/JPEG in-browser
- `@dnd-kit/core + sortable` — drag-and-drop page reordering
- Custom <canvas> signature pad + file upload → PNG
- `zustand` — small state store
- `@fontsource/inter` bundled locally (no CDN, keeps it offline)

### Core data model (the key to every feature)

```
Document = PageRef[]            // ordered
PageRef  = { id, sourceId, sourcePageIndex, rotation }
Source   = { type: 'pdf'|'image', bytes, pageCount? }   // cached
```

Every feature becomes an operation on this list:

- **Reorder** → `dnd-kit` moves `PageRef`s
- **Remove** → delete selected refs
- **Rotate** → `rotation += 90`
- **Slice/extract** → export a subset of refs as a new PDF
- **Merge** → import another PDF's pages as new refs (append or insert at cursor)
- **Images→PDF** → each image becomes a source with one page-ref
- **Signatures** → annotations attached to a `PageRef`, stamped at export

### Export pipeline
Build a fresh `PDFDocument`; for each `PageRef`, `copyPages` from the cached source and `.setRotation(existing + ref.rotation)`. Signature annotations are embedded and drawn after copy. **Watch the coordinate flip**: pdf-lib origin is bottom-left, canvas is top-left — y must be inverted when stamping. Save → `Blob` → download.

### Phases
### Phase 0 — Scaffold 
Vite React-TS, deps above, design tokens (off-white #F7F6F3-ish, dark grey #2B2B2B, Inter), Docker multi-stage (`node:20-alpine` build → `nginx:alpine`), `docker-compose.yml` on `localhost:8080`, nginx SPA fallback + gzip.

### Phase 1 — Load + preview 
File drop/picker → parse with pdf-lib, register `Source`, render lazily to canvas thumbnails (cache, revoke object URLs). Configure the pdf.js worker via Vite `?url` import.

### Phase 2 — Grid editing 
Thumbnail grid, multi-select, drag-reorder, remove, rotate. All pure store mutations.

### Phase 3 — Export 
Save-as with correct page order + rotations. First end-to-end milestone.

### Phase 4 — Merge / slice 
"Add PDF" (append or insert at position) and page-range extract (export subset) + split-into-chunks.

### Phase 5 — Images → PDF 
JPG/PNG/WebP direct; HEIC via `heic2any`. Fit to A4/Letter or image-native size, centered, aspect preserved.

### Phase 6 — Signatures 
Draw-or-upload → PNG asset. Click a page to place, drag/resize an overlay; store per-page refs; stamp on export.

### Phase 7 — Polish + verify 
Vitest around pure model logic (reorder/remove/rotate/export ordering), dark-mode-style pass, `docker compose up` smoke test.

### Assumptions (flag if wrong)
- "Slice" = extract a selected page range to a new PDF; "remove pages" = delete refs. I'll also add split-every-N.
- Preview-only rotations until export (no re-baking source pages).
- Large PDFs handled via lazy thumbnails; browser memory is the practical ceiling.

### Risks
- HEIC wasm is ~1–2 MB and has spotty edge-case support; fallback to libheif-js if needed.
- pdf.js worker must be bundled, not CDN, for offline/local-only.
- No true text redaction (per your call), so extraction-security isn't a concern here.