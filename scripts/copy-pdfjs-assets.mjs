import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'node_modules/pdfjs-dist')
const target = resolve(root, 'public/pdfjs')

if (!existsSync(resolve(source, 'build/pdf.worker.min.mjs'))) {
  console.error('[pdfjs-assets] pdfjs-dist is not installed; run npm install first.')
  process.exit(1)
}

mkdirSync(target, { recursive: true })
for (const dir of ['standard_fonts', 'cmaps']) {
  cpSync(resolve(source, dir), resolve(target, dir), { recursive: true })
}

console.log('[pdfjs-assets] copied standard_fonts and cmaps into public/pdfjs/')
