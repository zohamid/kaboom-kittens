# Repository Guidelines

## Project Structure & Module Organization

Kaboom Kittens is a dependency-free browser game. `index.html` contains markup and CSS. Runtime code is layered by responsibility: `src/art.js` generates SVG artwork, `src/game-engine.js` owns card definitions and rules, `src/index.js` handles UI and local modes, and `src/online.js` integrates Firebase. Keep rules free of DOM, audio, timers, and network access. Engine tests live in `test/game-engine.test.js`; `README.md` documents gameplay and Firebase setup.

## Build, Test, and Development Commands

No installation or build step is required. Node.js 18+ is used only for validation:

```sh
npm run serve     # serve at http://localhost:8000
npm test          # run engine tests
npm run check     # syntax-check source and tests
npm run validate  # run every automated check
```

Use `git diff --check` before committing. If a browser runs stale code, hard-refresh and verify the `BUILD` number near the top of `index.html`; increment it for user-visible releases.

## Coding Style & Naming Conventions

Use two-space indentation, semicolons in JavaScript, compact CSS declarations, and no framework syntax. Use `camelCase` for functions and variables, uppercase names for shared constants such as `CARDS`, and nearby DOM-ID patterns (for example, `scr-help`). Preserve source load order in `index.html`. Route local moves through `dispatchLocal()` and online host moves through the transactional `dispatch(state, action)` engine boundary. Comment only non-obvious state, protocol, or layout constraints.

## Testing Guidelines

Add `node:test` cases for every rules change, including rejected actions and state invariants. Name files `*.test.js`. Manual checks remain required for Play vs Bots and Pass & Play. For online changes, test host and guest sessions in separate browser profiles against the same Firebase URL, including reload/rejoin. Check phone and desktop layouts, audio unlock, NOPE timing, round reset, and game completion. Console helpers are documented in `index.html`.

## Commit & Pull Request Guidelines

History uses short imperative subjects such as `Update index.html`; prefer a more specific equivalent, for example `Fix guest round reset`. Keep each commit focused. Pull requests should explain gameplay impact, list tested modes and browsers, link relevant issues, and include screenshots or a short recording for visible changes. Never commit Firebase credentials or private deployment configuration.
