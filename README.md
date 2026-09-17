# PDF Editor

A local-only PDF editor. Everything runs in your browser — files are never
uploaded anywhere. The Docker image just serves static files with nginx.

## Features

- Open PDFs and images (JPG, PNG, WebP, HEIC) via drag-and-drop or file picker
- Reorder pages by drag-and-drop (including multi-select group moves)
- Multi-select (click, Shift-click range, Ctrl/Cmd-click toggle), rotate, delete
- Merge: append, prepend, or insert after the selection
- Extract selected pages; split into N-page files
- Signatures: draw or upload, click to place, drag to move, corner handle to
  resize; double-click a page to zoom in for precise placement
- Export preserves page order, rotations, image pages (A4/Letter), and signatures

## Run it

```sh
docker compose up -d --build
```

Open http://127.0.0.1:8080 (bound to loopback only).

## Develop

```sh
npm install
npm run dev      # local dev server
npm test         # vitest
npm run typecheck
npm run lint
npm run build    # production bundle in dist/
```

Requires Node 20.19+ (see `package.json` engines via dependencies).

## Notes

- Built with React + Vite + TypeScript, pdf-lib (editing/export), pdf.js
  (thumbnails, bundled worker + local fonts/CMaps), dnd-kit (reordering),
  zustand (state), heic2any (HEIC conversion, lazy-loaded on demand).
- Thumbnails render with `intent: 'print'` so they complete even in background tabs.
- nginx serves `.mjs` as JavaScript (required for the pdf.js module worker).
