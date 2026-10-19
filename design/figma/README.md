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

## Live status (Oct 2026 — token `figd_3EpW…`, scope set incl. comments write)
- Design file: https://www.figma.com/design/c62utZVkt7zv8ENe62eJvs/garaj
- ✅ **Working**: file read, comments posted (design-spec comment is on the file).
- ❌ **Authoring frames via REST** — platform-impossible regardless of token.
- ❌ **Variables write** — token lacks `file_variables:write`; reissue with that
  scope checked to let us push the `--accent` palette into the Variables panel.
- ❌ **Dev resources** — POST 404s on this plan (needs a Dev Mode seat).
- ❌ **Remote MCP authoring** (`mcp.figma.com`) — rejects personal access
  tokens entirely (needs the OAuth bearer login flow; note the
  `opencode.jsonc` `Authorization: Bearer` header is NOT accepted there).

So the practical flow stays: open `garaj` in Figma → drag-drop
`garaj-design-board.svg` → it imports as editable layers; ask for a
`file_variables:write`-scoped token if you want automated token sync later.
