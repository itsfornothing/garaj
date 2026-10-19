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

## Why not a live Figma API round-trip (status: Oct 2026)
- Design file is live: https://www.figma.com/design/c62utZVkt7zv8ENe62eJvs/garaj
  — currently the empty canvas; the SVG board above is what to drop into it.
- Token for automation lives in `~/.zshrc` (`FIGMA_ACCESS_TOKEN`) and **works**
  for reading files/comments/metadata (`file_content:read`,
  `file_comments:*`, `file_metadata:read`, `file_versions:read`,
  `file_dev_resources:*`).
- Still impossible today:
  1. REST cannot create/modify design nodes (frames), period — that is
     platform-level, not a token issue.
  2. Creating design-token **variables** needs the `file_variables:write`
     scope, which this token was not issued with. Refresh the token with that
     scope selected to let us push the `--accent` etc. palette straight into
     the file's Variables panel.
- The MCP path (`https://mcp.figma.com/mcp` in `opencode.jsonc`) can author
  designs, but those tools aren't exposed inside this CLI session yet — use
  them from the main opencode UI, or the drag-drop import above.
