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

## Font attractors demo

Open `/fontzero/demos/`, linked from the editor. This replaces the separate cursor and four-corner demos; their URLs redirect here.

Add any number of font attractors. Each has a compatible font and one of four motions: placed anywhere on the page, following the cursor, bouncing within the card, or everywhere. Select an attractor to edit radius and decay; bouncing attractors also have a speed control. Drag poles to place them, use keyboard arrows for fine adjustments, or choose Place on page and click a location. Show / Hide attractors controls every marker and label, including cursor and bouncing attractors, without disabling their effects. Pause motion freezes the balls. Menus contain only the largest mutually compatible construction group. Changing one attractor never replaces another font. Saved fonts outside that group keep rendering unchanged. Menu choices that conflict with another saved attractor are disabled; no fonts are silently substituted.

Attractors have finite support: influence falls smoothly to zero at the radius, which can be set from 0.5 to 1000 pixels with the slider or numeric input. Decay shapes this falloff inside the radius; zero gives uniform influence up to a hard cutoff at the radius. Coincident centers share their weights; other exact centers render purely in that attractor’s font. Everywhere attractors define the background blend (the first source is the background if none are Everywhere). Whole letter samples the field once per glyph. Within letter samples the curve controls and clips repainting to the attraction circles, preserving baseline pixels outside them.

Letter spacing is computed only from the background fonts and stays fixed as placed, cursor, and bouncing attractors move. Their font metrics cannot redistribute positions elsewhere in the line.

The glass text card starts at a phone aspect ratio. Its edges resize it, with handles visible only on hover or keyboard focus. All other controls live outside the card. Text is editable, size (1–4096 px, with direct numeric entry) and line height update live, and Fit chooses a size for the current text and card dimensions. Background font advances are balanced across each line to keep its overall width stable without stretching the curves. Only visible text is painted; contour matching is prepared before animation.

Attractors, text, typography, sampling, visibility and playback settings persist locally under `fontzero.attractors.v1`; card dimensions have their own key. Earlier demo settings remain stored separately.

With installed fonts enabled, Papyrus Universal and Comic Sans Universal each supply 14 drawn alternatives across 11 characters, covering the original nine ordinary font profiles. Unsupported dotted, stencil and other constructions remain blocked. Native glyphs are unchanged when no alternate is needed.

The largest installed-font cohort currently contains Times New Roman, Georgia, Open Sans, Domine, Noto Serif, Papyrus Universal, Comic Sans Universal, Arial · compatible g, and Times New Roman · alternate forms. The Arial variant is an experimental first step toward broader Arial compatibility: it supplies one double-storey g derived from Arial's oval strokes, preserving all other native glyphs. It does not claim universal coverage. The bundled-only build computes its largest group from available fonts.

Times New Roman · alternate forms adds six drawn constructions across five characters: single-storey a/g, dotted/slashed zero, open four, and a broken-bar dollar. These are an experimental start toward broader compatibility, not universal coverage; unsupported ampersand, B, R and @ forms remain excluded. Original Times outlines remain unchanged unless an alternate is selected by the compatible construction set.

Wrap text reflows at word boundaries inside the card, retaining explicit paragraphs and splitting overlong words. Padding adjusts all inner edges from 0 to 120 pixels. Fit accounts for both wrapping and padding. Light/Dark mode changes the page, card, controls and rendered ink. These options are saved with the demo settings. The card uses one continuous gradient rim rather than separate border colors.

Redacted by Christian Naths is bundled under the SIL Open Font License (source: https://github.com/christiannaths/redacted-font; Google Fonts ofl/redacted). It is available in the attractor menus as a masking effect: its solid bar glyphs fade over the existing fixed letter positions. It does not enter contour interpolation or change other attractors' fonts. This is a visual effect, not removal of the underlying text.

## Static attractor font export

Choose Design font to inspect one centered glyph at a time. Placed poles and Everywhere backgrounds define its curves; cursor and bouncing poles are excluded. Font size and card dimensions define the spatial scale used for every glyph. The glyph's background ink bounds are centered before evaluating the field, while exported baselines and advances remain normal font metrics. Font design always samples within the outline. Finite attraction regions are clipped as vector geometry so the outside stays unchanged.

Enter a font name and choose Download OTF. The snapshot contains printable ASCII plus non-control characters from the text and preview glyph. A missing or incompatible glyph stops export with its error. Preview and export use the same generator; changing the design during a download does not alter its captured configuration. The .otf download uses the existing attachment response, retaining source copyright notices and license requirements. The name, preview glyph and mode save with the demo settings.

Mixed Redacted effects use transparency and cannot be represented by this monochrome OTF exporter; Font design asks for outline fonts instead of silently changing the output.
