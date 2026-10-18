# GarAj design → Figma

## What this is
`garaj-design-board.svg` — a single-board spec of the shipped GarAj visual system:
- Foundations: color tokens, type scale (with Amharic leading note), motion/press specs
- Web workspace (board columns + invoices + audit tabs, glass header)
- 3 mobile frames: operator board, bottom-sheet menu, invoice (Chapa demo + QR), customer estimate

Token values match the code exactly:
- Web: `app/web/app/globals.css` (`.press`, `.enter`, `.modal-in`, `.glass`, `.lift`)
- Mobile: dark styles used across `app/mobile/src/app/*`

## Getting it into Figma
1. Create a Figma file → `File > Place image / drag-and-drop` the SVG onto the canvas
   (or paste: open the SVG in a browser, Cmd/Ctrl+C, then Cmd/Ctrl+V into Figma —
   this imports as **layer groups with real text and rectangles**, which is what you want).
2. After dropping, run *Selection → Outline stroke* once if strokes look merged.
3. Figma tip: the board uses `Noto Sans Ethiopic` for Amharic — install it
   (Google Fonts, free) before opening so አማርኛ text renders, not boxes.

## Why not a live Figma API round-trip
- The REST API cannot create designs (read-only for files) — that is a platform limit.
- The local `FIGMA_ACCESS_TOKEN` in `~/.zshrc` is expired (401 Invalid token) anyway.
To restore real Figma access, refresh that token (account settings → personal
access tokens) — needed for any future API automation, not for this import.
