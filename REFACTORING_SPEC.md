# UI Architecture Refactoring Specification

Status: Proposed

Scope: Refactor the browser application after the initial extraction from
`index.html`

Primary goal: Make `src/index.js` a small application entry point with explicit
module boundaries, without changing gameplay or requiring a build step.

## 1. Background

The first refactoring moved the inline JavaScript from `index.html` into four
source files:

- `src/art.js` contains generated SVG artwork.
- `src/game-engine.js` contains card definitions and transactional game rules.
- `src/index.js` contains the browser UI and local game modes.
- `src/online.js` contains Firebase online play.

This is a useful source extraction, but it is not yet a complete architectural
separation. `src/index.js` is about 1,100 lines and currently owns audio,
rendering, animation, prompts, local persistence, bots, hot-seat play, action
routing, and application startup. `src/online.js` also reaches directly into
state and UI functions declared by `src/index.js`. The files therefore depend
on shared browser globals and their order in `index.html`.

The completed refactoring must replace those implicit relationships with
explicit module APIs and single ownership of mutable state.

## 2. Goals

The refactoring must:

1. Reduce `src/index.js` to application construction and startup.
2. Give each mutable piece of state one clear owner.
3. Keep all game rules in the pure, transactional engine.
4. Make local and online moves use the same controller and event presentation
   path.
5. Prevent the online transport from manipulating DOM elements or UI globals.
6. Preserve the dependency-free, static-site deployment model.
7. Preserve all existing gameplay, visuals, sounds, storage keys, and Firebase
   room compatibility.
8. Make important non-engine behavior testable with `node:test` and injected
   browser dependencies.

## 3. Non-goals

This work must not:

- Change card rules, deck composition, bot difficulty, or NOPE timing.
- Change the page design, animation design, sound design, or player-facing copy
  unless required to fix a regression.
- Add a framework, bundler, transpiler, package dependency, or build output.
- Change Firebase paths, room payloads, action payloads, or persisted storage
  formats without a separate migration specification.
- Rewrite the CSS or split `index.html` markup and CSS. Those may be addressed
  independently after the JavaScript boundaries are stable.
- Treat a target line count as more important than cohesive ownership.

## 4. Architectural decisions

### 4.1 Native ES modules

Browser code will use native ES modules. `index.html` will load one entry point:

```html
<script type="module" src="src/index.js"></script>
```

All runtime dependencies must use explicit named imports and exports. No source
module may depend on another file being evaluated first. The project will still
run from a static HTTP server and will still have no build step.

`package.json` will set `"type": "module"`. Tests will use ESM imports instead
of `require()`. The conditional `module.exports` compatibility block in the
engine will be removed once the tests import the ESM API directly.

Default exports should not be used. Named exports make module contracts visible
at call sites and simplify refactoring.

### 4.2 Dependency direction

Dependencies must point inward toward stable, side-effect-free code:

```text
index.js
  -> app.js
     -> controllers/
        -> modes/
        -> ui/
        -> services/
        -> game-engine.js
     -> online.js

ui/ -> art.js and read-only state
modes/ -> game-engine.js and injected controller ports
online.js -> game-engine.js and injected application callbacks
game-engine.js -> no browser or application modules
```

The following rules are mandatory:

- Nothing imports `src/index.js`.
- `game-engine.js` imports no DOM, audio, timer, storage, or network code.
- UI modules do not call `dispatch()` and do not write authoritative game
  state.
- `online.js` does not query the DOM and does not import UI modules.
- Feature modules do not read or write undeclared globals.
- Timer, randomness, storage, network, and browser objects are injected where
  they affect observable behavior.

### 4.3 State ownership

`GameSession` will be the only owner of application session state:

```js
{
  mode,          // null | 'bots' | 'hot' | 'online'
  game,          // engine GameState | null
  viewPlayerId,
  handHidden,
  selectedCards
}
```

State must be read through `getSnapshot()` and changed through named methods.
Feature modules must not receive the mutable backing object. A state change
notifies the renderer through one subscription owned by the application
controller.

State that belongs to one feature remains private to that feature:

- Audio enabled state and `AudioContext`: audio service.
- Sort and kitten-counter preferences: preferences service.
- Bot peek memory: local mode controller.
- NOPE countdown handles: phase controller.
- Chat unread count: chat presenter.
- Online room, seat, sequence, and connection handles: online client.
- Resize debounce handle: table renderer.

The engine's `GameState` remains authoritative for rules. The session must not
duplicate engine fields such as `turn`, `phase`, `pending`, or `winner`.

## 5. Target source layout

The exact filenames may be adjusted during implementation when ownership is
clearer, but the responsibilities and dependency rules are required.

```text
src/
  index.js                    browser entry point
  app.js                      constructs and coordinates the application
  app-session.js              owns mode, game, view, and UI selection state
  game-engine.js              pure card catalogue and game rules
  art.js                      pure SVG generation
  online.js                   Firebase transport and online protocol
  modes/
    local.js                  local game lifecycle and persistence
    bots.js                   bot decisions and bot-only memory
    hot-seat.js               pass-and-play handoff policy
  services/
    audio.js                  Web Audio synthesis and sound catalogue
    preferences.js            typed access to localStorage preferences
    saved-games.js            local and online resume records
  controllers/
    actions.js                local/online action routing
    phases.js                 NOPE, defuse, insert, and favor progression
    events.js                 presents engine events through UI/audio/effects
  ui/
    dom.js                    DOM lookup and text/HTML escaping helpers
    screens.js                screen, setup, help, curtain, and modal UI
    table.js                  seats, piles, hand, banner, and layout
    effects.js                card flight, flash, explosion, and confetti
    prompts.js                target/card/insert/phase prompt collection
    chat.js                   chat panel and reaction presentation
```

### 5.1 `src/index.js`

`src/index.js` must only:

1. Import `createApp()`.
2. Construct browser adapters from `window` and `document`.
3. Start the application once.
4. Optionally expose the documented debug API in development.

It must not contain rendering, game rules, bot policy, Firebase operations,
audio synthesis, persistence logic, or feature-specific event handlers. As a
review aid, it should normally remain below 100 non-comment lines.

### 5.2 `src/app.js`

`createApp(dependencies)` is the composition root. It constructs the session,
services, presenters, mode controllers, and online client, then wires their
callbacks. It returns an application API with at least:

```js
{
  start(),
  startLocalGame(options),
  startOnlineGame(options),
  submitAction(action),
  leaveGame(),
  getSnapshot()
}
```

Construction must not immediately access the DOM, connect to Firebase, start a
timer, or mutate storage. Those side effects begin in `start()` or in an
explicit user action. Repeated calls to `start()` must not install duplicate
event handlers.

### 5.3 Controllers

The action controller is the only application layer that submits game actions.
Its `submit(action)` method must:

- Route a local action through `dispatchLocal()`.
- Route an online guest action to the host through the online client.
- Route an online host action through the transactional `dispatch()` boundary.
- Send accepted engine events to the same event controller in every mode.
- Ignore rejected actions without partially updating or presenting them.

`dispatchLocal()` remains the named local engine boundary required by the
repository guidelines. It belongs in the local/action controller rather than
the entry point.

The phase controller owns the progression following an accepted state change.
It may request a choice from a prompt module and then submit a new action, but
it must not mutate `GameState` directly. Online and local modes must share phase
presentation where their behavior is the same.

The event controller converts engine events into presentation calls. For
example, a `draw` event may request a card-flight effect, a sound, and a log
message. It must not contain game-rule decisions.

### 5.4 UI modules

UI modules receive the DOM nodes or a scoped `document` adapter they use. They
must not query nodes during module evaluation. Each module exposes an explicit
`mount(handlers)` or constructor API and returns any cleanup function needed by
tests or future remounting.

Rendering functions receive a snapshot and derive the DOM from it. UI event
handlers report player intent through callbacks such as `onDraw`, `onPlay`, or
`onChooseTarget`; they do not import the application controller.

HTML generated from player, room, or chat input must continue to escape
untrusted text. `innerHTML` may be used only for trusted templates and generated
art.

### 5.5 Local modes and bots

The local mode controller owns creation, restoration, saving, and follow-up
scheduling for bot and hot-seat games. It calls the engine only through the
action controller.

Bot decision making should be split into a deterministic function where
practical:

```js
chooseBotAction(gameSnapshot, botMemory, random)
```

The function returns an action or decision description and performs no DOM,
audio, storage, or timer work. The local controller schedules the result and
updates bot-only memory. Tests must inject a predictable `random()`.

Hot-seat policy owns player handoff and visibility rules. The curtain UI only
displays the handoff and reports when the next player is ready.

### 5.6 Online client

`createOnlineClient(options)` owns Firebase transport and room protocol state.
It receives network, clock, storage, engine, and application callbacks through
`options`. Its public API remains conceptually equivalent to the current `OL`
API:

```js
{
  createRoom(),
  joinRoom(),
  rejoin(),
  sendAction(),
  sendChat(),
  sendReaction(),
  restart(),
  leave(),
  quit(),
  openInvite()
}
```

Instead of calling `show()`, `modal()`, `renderAll()`, or changing `G`, `MODE`,
and `VIEW`, it emits typed callbacks:

```js
{
  onLobbyChanged(lobby),
  onGameReceived(game, events, playerId),
  onChatReceived(message),
  onReactionReceived(reaction),
  onConnectionChanged(status),
  onError(error)
}
```

Incoming data is validated before it is installed as session state. Host moves
continue to cross the transactional `dispatch(state, action)` boundary. Existing
sequence-number behavior, inbox draining, reload/rejoin, and host departure
semantics must remain compatible with rooms created by the current release.

## 6. Public and debug contracts

Production modules must not rely on accidental globals such as `G`, `MODE`,
`VIEW`, `OL`, `renderAll`, or `act`.

The console helpers documented in `index.html` will be replaced with one
intentional, read-only namespace:

```js
window.KaboomKittens = {
  getSnapshot,
  submitAction,
  render,
  playCardSound,
  showInsertPicker
};
```

`getSnapshot()` must return a clone or frozen snapshot so console inspection
cannot mutate the live game accidentally. Any deliberately mutating debug
helper must be clearly named and must still route through the normal controller
boundary.

## 7. Migration plan

The implementation should be delivered as small, behavior-preserving steps.
Every step must keep `npm run validate` passing.

### Phase 1: Establish the module foundation

- Convert source and tests to ESM.
- Replace the four ordered classic scripts with the single module entry point.
- Add named exports to the existing art and engine modules.
- Reproduce the current boot behavior before moving feature code.
- Update the browser boot test for module startup and explicit dependencies.

### Phase 2: Extract leaf services

- Extract DOM helpers, preferences, saved-game storage, and audio.
- Inject `document`, `localStorage`, timers, and Web Audio constructors.
- Add unit tests for storage failures, preference defaults, and audio-disabled
  behavior without requiring real browser audio.

### Phase 3: Extract presentation

- Extract table rendering, screens/modals, effects, prompts, and chat.
- Replace direct application calls with handler callbacks.
- Add focused tests for escaped user content, action callbacks, hand privacy,
  legal button states, and stable seat rendering inputs.

### Phase 4: Extract local mode policy

- Move bots, bot memory, hot-seat handoff, local save/resume, and local action
  follow-ups out of `index.js`.
- Add deterministic bot tests and local resume tests.
- Verify that all local moves still pass through `dispatchLocal()`.

### Phase 5: Decouple online play

- Convert `online.js` from the global `OL` singleton into a constructed client.
- Replace all direct UI and shared-global access with callbacks.
- Preserve the Firebase wire format and stale-sequence protection.
- Add mocked-network protocol tests for host actions, guest actions, rejoin,
  restart, leave, and malformed remote state.

### Phase 6: Finalize the composition root

- Move remaining coordination into `app.js` and the controllers.
- Remove accidental global APIs and expose only `window.KaboomKittens`.
- Remove obsolete source-order comments and update the debugging documentation.
- Increment the `BUILD` number because the browser-visible runtime changed.
- Run all automated and manual acceptance checks.

Code moves should not be mixed with gameplay changes. If implementation reveals
a gameplay defect, record it separately and fix it in a focused change with
engine tests.

## 8. Testing requirements

### 8.1 Automated checks

`npm run validate` must continue to syntax-check every JavaScript file,
including nested source directories. The current `src/*.js` shell glob must be
updated accordingly, for example by enumerating files with `find` or an
equivalent dependency-free command.

The automated suite must cover:

- Existing engine rules, rejected actions, and transactional invariants.
- Application startup with injected browser adapters.
- One event presentation path shared by local and online modes.
- Local action routing versus online guest and host routing.
- Bot decisions with deterministic randomness.
- Local snapshot save, expiry, restore, and corrupt-data handling.
- HTML escaping for names, room messages, and chat.
- Online request construction and remote-state validation with mocked `fetch`
  and `EventSource`.
- Cleanup of timers and event listeners when leaving or remounting.

Tests must not call the real Firebase service, depend on wall-clock delays, or
require a graphical browser.

### 8.2 Manual regression matrix

Before completion, manually verify:

- Play vs Bots with one and four bots.
- Pass & Play with two and five players, including every handoff phase.
- Host and guest online sessions in separate browser profiles.
- Online reload/rejoin for both host and guest.
- NOPE chains, timeout, and NOPE of a NOPE in every mode.
- Kaboom draw, Defuse choice, kitten insertion, Favor, pairs, triples, and
  five-card retrieval.
- Round restart and full game completion.
- Player quit, host quit, and stale/invalid guest actions.
- Chat, reactions, mute, audio unlock, hand sorting, and saved preferences.
- Phone portrait, phone landscape, and desktop table layouts.
- Hard refresh with the updated `BUILD` number.

## 9. Completion criteria

The refactoring is complete only when all of the following are true:

- `src/index.js` performs startup and composition only.
- No source file relies on implicit cross-file globals or script load order.
- Each mutable state category has the single owner defined in this document.
- UI, audio, bot, storage, and network code cannot be reached from the engine.
- `online.js` contains no DOM queries and no direct UI calls.
- Local and online accepted actions use the same event presentation pipeline.
- Rejected actions remain transactional and produce no UI effects.
- Firebase and local-storage formats remain backward compatible.
- `npm run validate` and `git diff --check` pass.
- The complete manual regression matrix has been recorded in the pull request.
- `README.md`, the architecture notes, console helpers, and `BUILD` history match
  the delivered structure.

## 10. Pull request expectations

The pull request must describe the new dependency boundaries, call out any
intentional compatibility decision, and list automated and manual results. It
should include a file-level architecture summary and explicitly confirm that no
gameplay or Firebase protocol changes were intended.

If the work is too large for one reviewable pull request, split it according to
the migration phases above. Each intermediate pull request must leave the game
runnable and the validation suite passing.
