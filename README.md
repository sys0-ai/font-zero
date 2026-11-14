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

This additionally reads Comic Sans, Papyrus, Times New Roman, Arial, Georgia and Courier New from the system font directory and enables experimental Papyrus Alternates. Those font files are never copied into the project or public build. Their use on a public server requires appropriate rights and separately supplied font files.

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

All editing state is ephemeral and resets on reload. Font compatibility is a structural filter; it does not guarantee attractive results at every blend. Source endpoints remain original curves at neutral effects.
