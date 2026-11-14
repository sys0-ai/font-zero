# Fontzero

A standalone TypeScript font-blending playground, extracted from the Type Space prototype at sys0 commit 4fafba12. It runs without the sys0 kernel, database, vault, or services. All current controls remain while the smaller feature set is being chosen.

## Run

Requires Bun. From this directory:

```sh
bun install --frozen-lockfile
bun run dev
```

Open http://localhost:4418/fontzero/. The root redirects there. Every reload rebuilds the page. The default library uses the 103 bundled open font families; the initial blend is Crimson Pro / Libre Caslon Text.

For private development on a Mac with the original classic fonts installed:

```sh
FONTZERO_LOCAL_FONTS=1 bun run dev
```

This additionally reads Comic Sans, Papyrus, Times New Roman, Arial, Georgia and Courier New from the system font directory and enables experimental Papyrus Universal. Those font files are never copied into the project or public build. Their use on a public server requires appropriate rights and separately supplied font files.

## Production

```sh
bun run build
NODE_ENV=production PORT=4521 HOST=127.0.0.1 bun run start
```

Route `https://sys0.ai/fontzero` and `/fontzero/*` to this standalone service, preserving the path. The rest of sys0.ai is unaffected. The server serves the page and fonts, the semantic worker, and a stateless font-download POST endpoint. Generated font bytes are returned as an `.otf` attachment and are not stored. `dist/` contains the compiled page, worker, and bundled font/license assets; the download endpoint still requires the server.

The public build includes only bundled OFL font assets and starts without macOS fonts. Source licenses are retained under `font-assets/` and included in `dist/licenses/`. Proprietary local font files are not redistributable artifacts of this project. Project code licensing has not yet been selected.

No hosting credentials or domain configuration are included. An existing reverse proxy/tunnel must route the path to the service.

## Checks

`bun run test:y` checks the repaired y junction on a Mac with the source classics installed. Existing inherited tests cover the geometry and UI; tests using the old prototype URL are retained as migration work, not claimed as standalone integration coverage.

Settings are saved in this browser’s local storage and restored on reload; font geometry is recomputed. Font compatibility is a structural filter; it does not guarantee attractive results at every blend. Source endpoints remain original curves at neutral effects.

## Stable preview size

The Letters preview keeps each line’s ink height steady across font and blend changes. Each glyph scales uniformly; spacing absorbs differences in line width. If the natural letter widths exhaust all spacing, the line can grow rather than overlap or shrink the letters. Text, size, width, tracking and leading changes establish new dimensions. SVG export captures this layout; OTF exports keep the font’s actual outlines and metrics. The reference dimensions are saved with the settings so reload preserves the same layout.

## Saved settings

Text, selected fonts, percentages, locks, style attributes, effects, text stops, variation seed, active preview and sidebar foldouts save automatically in local storage on this browser and origin. Reload restores them without replaying actions. Playback does not auto-start. No font files, credentials or generated geometry are stored. Clearing site data removes saved settings. Storage or restore errors are shown in the status area.

## Four corners demo

Open `/fontzero/demos/four-corners/`, also linked from the editor header. Four font selectors anchor the corners of the **visible viewport**. The text container is centered horizontally when it fits and initially scrolled to its horizontal center when wider than the viewport. Both demos hold the overall line width to a Libre Baskerville reference. Individual letters use the active fonts’ native advances, with the remaining difference distributed across the line, so a narrow W no longer inherits another font’s wide W slot. Letter positions can adjust within that fixed line width; the curves are not stretched.

Each visible glyph samples its current horizontal origin and vertical visual center relative to the viewport, subtracting both scroll offsets. Bilinear weights are `[(1-x)(1-y), x(1-y), (1-x)y, xy]`, clamped outside the viewport and combined when corners use the same font. The viewport corners are pure source fonts. Scrolling in either direction changes the curves of text that remains visible. Font blending does not insert tracking or stretch the lines. The demo uses the matched source curves without an additional smoothing pass during scrolling.

The default four fonts are Inter, Raleway, Libre Baskerville and Zilla Slab. Construction set switches the whole group; each corner picker contains only compatible fonts, without unrelated disabled choices. ASCII-only Monaspace subsets are omitted here because the supplied poem uses em dashes. Full open font files and locally available classics supply native Unicode glyphs; missing glyphs fail visibly. Lines stay intact, with horizontal and vertical scrolling at large sizes. Only nearby rows and horizontally visible glyphs are rendered, and obsolete font render jobs are cancelled. Size, editable text, corner selections and scroll position are saved locally, separately from the editor. `bun test four-corners.test.ts four-corners.browser.test.ts` checks exact corner weights, natural advances, viewport-relative morphing on both scroll axes, centering and reload restoration.

## Cursor blend demo

Open `/fontzero/demos/cursor/`. The supplied Edna St. Vincent Millay poem uses the base font outside the pointer radius and blends to the cursor font at its center. The smooth radial falloff is `(1 - smoothstep(distance / radius)) ** decay`: higher decay concentrates the second font near the center. Native glyph advances plus line-wide spacing adjustment keep the overall width steady as outlines morph or fonts change. Scrolling updates the field relative to the stationary pointer; leaving the viewing area restores the base font. Choose any base font to change construction groups; the cursor font list contains compatible choices only. Font selections, size, text, sampling mode, radius and decay persist separately from the editor and four-corner settings.

Both demos use centered glass text cards with a narrow 9:19.5 phone aspect ratio on a black stage, with cool and warm underlighting. All navigation, font selectors and other controls sit outside the cards. Four Corners precompiles curve correspondence and paints visible letters directly on a device-pixel-scaled canvas each animation frame. Scrolling uses the latest viewport coordinates, with no queued partial SVG frames. Tangent blending and counter protection use the same geometry as the SVG renderer.

Resize handles appear only on edge hover or keyboard focus. Drag the left/right card edges to resize its width, or the bottom edge to change height; keyboard arrows on each handle also work. Card dimensions are saved per demo. Both demos offer live size sliders, Edit text (also available by double-clicking the card), and Whole letter / Within letter sampling.

With installed fonts enabled, Papyrus Universal and Comic Sans Universal each provide 14 purpose-drawn alternate constructions across 11 characters. They preserve native glyphs by default and cover the original nine ordinary font profiles. “Universal” is the product name, not a claim that dotted, stencil, or every construction in the library is supported; incompatible profiles remain blocked.
