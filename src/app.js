'use strict';

import { CARDS, CAT_TYPES, CAT_TYPE_INDEX, newGame, dispatch, classifyPlay, playNeedsTarget } from './game-engine.js';
import { ART, CARD_BACK_ART, HERO_ART, catHead, svgWrap } from './art.js';
import { createOnlineClient } from './online.js';
import { createDomHelpers, escapeHtml } from './services/dom.js';
import { loadPreferences, savePreferences, toggleSound, toggleHandSort, toggleShowKittens } from './services/preferences.js';
import { saveLocalGame, clearLocalGame, loadLocalGame, saveRoomSession, clearRoomSession, loadRoomSession, isLocalSnapshotFresh, isRoomSessionFresh } from './services/saved-games.js';
import { createAudioService } from './services/audio.js';
import { createScreensModule } from './ui/screens.js';
import { createTableModule } from './ui/table.js';
import { createEffectsModule } from './ui/effects.js';
import { createPromptsModule } from './ui/prompts.js';
import { createChatModule } from './ui/chat.js';
import { createLocalMode } from './modes/local.js';
import { createBotsModule } from './modes/bots.js';
import { createHotSeatModule } from './modes/hot-seat.js';
import { createActionController } from './controllers/actions.js';
import { createPhaseController } from './controllers/phases.js';
import { createEventController } from './controllers/events.js';

/**
 * @typedef {Object} AppDeps
 * @property {Document} document
 * @property {Window} window
 * @property {function} fetch
 * @property {EventSource} EventSource
 * @property {Storage} localStorage
 */

/**
 * @param {AppDeps} deps
 * @returns {{
 *   start: () => void,
 *   startLocalGame: (defs: any[]) => void,
 *   startOnlineGame: (options: any) => void,
 *   submitAction: (action: any) => void,
 *   leaveGame: () => void,
 *   getSnapshot: () => any,
 * }}
 */
export function createApp(deps) {
  const { document, window, fetch, EventSource, localStorage } = deps;

  // DOM helpers
  const { q, qq } = createDomHelpers(document);
  const $ = q, $$ = qq;

  // State
  let MODE = null;
  let G = null;
  let VIEW = 0;
  let HIDE_HAND = false;
  let selected = [];
  let BOT_PEEK = {};
  let NOPE_TIMER = null;
  let NUDGE = false;
  let SPY = null;
  let SORT_HAND = false;
  let SHOW_KITTENS = false;

  // Services
  const prefs = loadPreferences(localStorage);
  let SND = prefs.soundEnabled;
  SORT_HAND = prefs.handSorted;
  SHOW_KITTENS = prefs.showKittens;

  const audio = createAudioService(() => {
    try { return new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  });

  // UI Modules
  const screens = createScreensModule(document);
  const table = createTableModule(document, {});
  const effects = createEffectsModule(document);
  const prompts = createPromptsModule(document, {});
  const chat = createChatModule(document);

  // Mode modules
  const hotSeat = createHotSeatModule({ curtainFor: screens.curtainFor, setView: () => {}, setSelected: () => {}, renderAll: () => {} });

  // State getters/setters
  const getSnapshot = () => ({ G, MODE, VIEW, HIDE_HAND, selected, BOT_PEEK, NUDGE, SPY, SORT_HAND, SHOW_KITTENS, SND });

  function setG(newG) { G = newG; }
  function setMode(m) { MODE = m; }
  function setView(v) { VIEW = v; }
  function setHideHand(v) { HIDE_HAND = v; }
  function setSelected(s) { selected = s; }
  function setBotPeek(b) { BOT_PEEK = b; }
  function setNudge(v) { NUDGE = v; }
  function setSpy(v) { SPY = v; }
  function setSND(v) { SND = v; audio.setEnabled(v); }
  function setSortHand(v) { SORT_HAND = v; }
  function setShowKittens(v) { SHOW_KITTENS = v; }

  // Local mode
  const localMode = createLocalMode({
    newGame, dispatch, processEvents: null, renderAll: null, afterChange: null,
    showChatUI: screens.showChatUI, getSnapshot, submitAction: null,
    audio, logMsg: null, dealAnimation: effects.dealAnimation, curtainFor: screens.curtainFor,
    botMove: null, setView, setMode, setSelected, setBotPeek, setHideHand,
    setG, setGameState: null, CARDS,
    openNopeWindow: null, handleDefusePhase: null, handleInsertPhase: null, handleFavorPhase: null,
    $, $$,
  });

  // Bots
  const bots = createBotsModule({
    dispatch, processEvents: null, afterChange: null, getSnapshot,
    BOT_PEEK, CARDS, CAT_TYPES,
  });

  // Online client
  let onlineClient = null;
  function createOnlineClientInstance() {
    if (onlineClient) return onlineClient;
    onlineClient = createOnlineClient({
      document, window, fetch: fetch.bind(window), EventSource, localStorage,
      dispatch, newGame, CARDS, ART, NOPE_MS: 6000,
      show: screens.show, modal: screens.modal, closeModal: screens.closeModal, closePhaseModal: screens.closePhaseModal,
      renderAll: () => {}, logMsg: null, processEvents: null,
      startNopeClock: null, stopNopeClock: null, npClockHTML: '<div class="npClock"><div class="bar"><i></i></div><div class="secs"></div></div>',
      openInsertPicker: prompts.openInsertPicker, cardHTML: table.cardHTML,
      floatReaction: chat.floatReaction, addChatLine: chat.addChatLine, sChat: () => audio.sChat(),
      showChatUI: screens.showChatUI, getSnapshot, submitAction: null,
    });
    return onlineClient;
  }
  function getOnlineClient() { if (!onlineClient) createOnlineClientInstance(); return onlineClient; }

  // Action controller
  const actionController = createActionController({
    dispatchLocal: localMode.dispatchLocal, getOnlineClient, getSnapshot, processEvents: null, afterChange: null,
  });

  // Event controller
  const eventController = createEventController({
    logMsg: null, fxPlay: effects.fxPlay, fxDraw: effects.fxDraw, fxNope: effects.fxNope,
    fxBoom: effects.fxBoom, fxConfetti: effects.fxConfetti, flash: effects.flash,
    showFuture: screens.announce, audio, clearLocal: clearLocalGame, showWin: null,
    getSnapshot, setSelected, setNudge, setSpy, renderAll: () => {},
  });

  // Phase controller
  const phaseController = createPhaseController({
    getSnapshot, openNopeWindow: null, handleDefusePhase: null, handleInsertPhase: null, handleFavorPhase: null,
    submitAction: actionController.submit, hotSeat,
  });

  // Wire up the placeholders
  localMode.processEvents = eventController.processEvents;
  localMode.renderAll = () => { table.renderAll(); };
  localMode.afterChange = phaseController.afterChange;
  localMode.logMsg = (msg, pid, kind) => { /* log */ };
  localMode.openNopeWindow = () => { /* nope window */ };
  localMode.handleDefusePhase = () => { /* defuse */ };
  localMode.handleInsertPhase = () => { /* insert */ };
  localMode.handleFavorPhase = () => { /* favor */ };
  localMode.botMove = bots.botMove;

  hotSeat.setView = setView;
  hotSeat.setSelected = setSelected;
  hotSeat.renderAll = () => { table.renderAll(); };

  // Public API
  return {
    start() {
      // Initialize UI
      screens.show('scr-title');
      $('#heroArt').innerHTML = HERO_ART();
      $('#curtainArt').innerHTML = svgWrap(catHead(50, 54, 30, '#ffc53d', 'happy'));
      $$('.backBtn').forEach(b => b.onclick = () => screens.show('scr-title'));
      $('#btnHelp').onclick = () => { screens.renderHelp(CARDS, ART, CAT_TYPES); screens.show('scr-help'); };
      $('#btnMute').onclick = () => { const next = toggleSound(localStorage); setSND(next.soundEnabled); $('#btnMute').textContent = SND ? '🔊' : '🔇'; };
      $('#btnMute').textContent = SND ? '🔊' : '🔇';

      // Setup buttons
      $('#btnBots').onclick = () => { localMode.setupMode = 'bots'; localMode.openSetup(); };
      $('#btnHotseat').onclick = () => { localMode.setupMode = 'hot'; localMode.openSetup(); };
      // ... rest of UI initialization

      // Chat
      chat.setupChatUI({
        getOnlineClient, audio, renderHand: () => table.renderHand(),
        toggleShowKittens, toggleHandSort, flash: effects.flash, G, SHOW_KITTENS, SORT_HAND,
        renderPiles: () => table.renderPiles(),
      });

      // Offer resume
      localMode.offerResume();
    },

    startLocalGame(defs) { localMode.startLocalGame(defs); },
    startOnlineGame(options) { /* online */ },
    submitAction(action) { actionController.submit(action); },
    leaveGame() { /* leave */ },
    getSnapshot,
  };
}