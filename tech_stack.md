# Tech stack

Client-side-only SPA: all PDF/image processing happens in the browser. The
server (nginx) serves static files and nothing else — that is the entire
privacy model.

## Runtime & build

| Piece | Version | Notes |
|---|---|---|
| Node (local dev) | 20.19+ | Oldest toolchain we support; pins below respect it |
| Node (Docker build) | 22-alpine | Multi-stage `Dockerfile`, `npm ci` + `npm run build` |
| nginx (runtime) | 1.27-alpine | Static hosting, gzip, immutable asset caching, SPA fallback; serves `.mjs` as JavaScript (required for the pdf.js module worker); loopback-only port mapping |
| Vite | 8.x | Dev server + production bundler |
| TypeScript | 6.x (strict) | `tsc -b` runs as part of `npm run build` |

## Frontend

| Piece | Version | Used for |
|---|---|---|
| React + React DOM | 19.x | UI |
| zustand | 5.x | Document store (sources, pages, selection, signatures, export flags) |
| @dnd-kit/core, sortable, utilities | 6.x / 10.x / 3.x | Drag-and-drop page reordering (single + group moves) |
| @fontsource/inter | 5.x | Bundled Inter (400/500/600) — no webfont CDN, keeps the app offline |
| Plain CSS | — | Design tokens in `src/styles/tokens.css` (off-whites, dark greys); no component framework |

## Document processing (all in-browser)

| Piece | Version | Used for |
|---|---|---|
| pdf-lib | 1.17.x | Parsing, page copy/reorder/rotate, image embedding, signature stamping, export |
| pdfjs-dist | **5.5.207 (pinned)** | Page thumbnail rendering. Pinned: 5.6.x carries GHSA-hq66-cqwq-w95j (arbitrary JS on malicious PDFs); 6.x needs Node 22. Rendered with `intent: 'print'` so thumbnails complete in background tabs |
| heic2any | 0.0.4 | HEIC → JPEG conversion, **dynamically imported** on first HEIC use so its ~1.35 MB wasm bundle ships as a separate lazy chunk |

pdf.js runtime assets (worker via `?url` import; `standard_fonts/` + `cmaps/`
copied to `public/pdfjs/` by `scripts/copy-pdfjs-assets.mjs` on `predev` /
`prebuild`) are all self-hosted — no CDN calls at runtime.

## Quality gates

| Piece | Version | Command |
|---|---|---|
| vitest | 4.x (pinned — v5 needs Node 22) | `npm test` |
| oxlint | 1.x | `npm lint` |
| tsc | — | `npm run typecheck` |

See `lessons_learned.md` for why several of these versions are pinned.
