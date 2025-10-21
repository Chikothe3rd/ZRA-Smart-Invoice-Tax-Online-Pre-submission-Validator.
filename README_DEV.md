ZRA Fixer — Developer Guide

This small guide is written for a junior developer to get up to speed quickly.

Repository layout (key files)
- index.html — app HTML entry (favicon is in `public/`)
- src/main.tsx — React app bootstrap
- src/pages/Index.tsx — Main page, wires `FileUpload` -> `processFile` -> `ValidationResults`
- src/components/
  - FileUpload.tsx — UI for uploading files
  - ValidationResults.tsx — Shows issues & actions (Compare, Download)
  - FileComparisonModal.tsx — Modal that shows original vs corrected data (added Diff tab)
- src/lib/fileProcessing.ts — Core processing pipeline: parse XML/CSV/JSON, call `validateAndFix`
  - exports `processFile` and `generateDownloadZip`
- src/lib/validation.ts — Validation rules and `validateAndFix` implementation
- src/utils/exportReport.ts — CSV/Markdown export helpers
- public/samples/ — sample files you can use for manual testing

How data flows
1. User uploads files via `FileUpload` (client-side File API)
2. `Index.tsx` calls `processFile(file)` for each file
3. `processFile` parses file content and calls `validateAndFix(data, fileType)` to get `ValidationResult`
4. UI stores `ProcessedFile[]` and shows `ValidationResults`
5. User can open `FileComparisonModal` to compare original vs corrected JSON
6. `generateDownloadZip` creates a ZIP with corrected files and a text report

Run locally
- Install dependencies:

```pwsh
cd 'c:\Users\impac\Music\Web App (ZRA)\zra-fixer'
npm install (depedencies)
```

- Run dev server:

```pwsh
npm run dev
# Visit the URL printed by Vite, typically http://localhost:8080 or another port 8081
```

- Build production bundle:

```pwsh
npm run build
```

Testing
- Unit tests are run with Vitest. To run tests once (non-watch):

```pwsh
npm test
```

Notes for debugging
- Most processing uses browser APIs (DOMParser, File, URL.createObjectURL). Tests use `jsdom` so some Web APIs are mocked.
- If you need to run headless tests that rely heavily on DOM behavior, prefer Playwright or a headful browser test.

Where to look to change the comparison UI
- `src/components/FileComparisonModal.tsx` — this file now includes:
  - "Original" tab: raw original JSON
  - "Corrected" tab: fixed JSON
  - "Diff" tab: side-by-side top-level key comparison (simple highlighting)

Common issues and fixes
- Large bundles: Vite warns about chunks > 500KB — consider code-splitting in `vite.config.ts`
- CSV parsing: `papaparse` is used; ensure header rows are correct
- JSON parsing: `fileProcessing` attempts to auto-fix common syntax issues — for complex malformed JSON, open and fix manually

If something's failing
- Re-run `npm install` to ensure dev deps (vitest, jsdom) are installed
- Run `npm test` and inspect failing test traces in the terminal
- For runtime errors in the browser, open DevTools Console


