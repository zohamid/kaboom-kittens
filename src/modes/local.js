'use strict';

import { loadLocalGame, clearLocalGame, saveLocalGame, isLocalSnapshotFresh } from '../services/saved-games.js';

/**
 * @typedef {Object} LocalModeDeps
 * @property {function} newGame
 * @property {function} dispatch
 * @property {function} processEvents
 * @property {function} renderAll
 * @property {function} afterChange
 * @property {function} showChatUI
 * @property {function} getSnapshot
 * @property {function} submitAction
 * @property {function} audio.sDeal
 * @property {function} logMsg
 * @property {function} dealAnimation
 * @property {function} curtainFor
 * @property {function} botMove
 * @property {function} setView
 * @property {function} setMode
 * @property {function} setSelected
 * @property {function} setBotPeek
 * @property {function} setHideHand
 */

/**
 * @param {LocalModeDeps} deps
 * @returns {{
 *   startLocalGame: (defs: any[]) => void,
 *   afterChange: () => void,
 *   offerResume: () => void,
 *   dispatchLocal: (action: any) => any,
 * }}
 */
export function createLocalMode(deps) {
  const { 
    newGame, dispatch, processEvents, renderAll, afterChange, showChatUI,
    getSnapshot, submitAction, audio, logMsg, dealAnimation, curtainFor,
    botMove, setView, setMode, setSelected, setBotPeek, setHideHand,
    setG, setGameState
  } = deps;

  let BOT_PEEK = {};

  function dispatchLocal(action) {
    const events = dispatch(setG ? getSnapshot().G : setGameState, action);
    if (events) events.forEach(event => {
      if (event.t === 'future' && getSnapshot().G?.players?.[event.pid]?.bot) {
        BOT_PEEK[event.pid] = { cards: event.cards, deckAt: getSnapshot().G.deck.length };
      }
      if (event.t === 'shuffled') Object.keys(BOT_PEEK).forEach(key => delete BOT_PEEK[key]);
    });
    return events;
  }

  function startLocalGame(defs) {
    const G = newGame(defs);
    if (setG) setG(G);
    else setGameState(G);
    BOT_PEEK = {};
    setSelected([]);
    setHideHand(false);
    showChatUI(false);
    deps.show('scr-table');
    audio.sDeal();
    deps.announce('NEW ROUND!');
    dealAnimation(() => logMsg('Cards dealt. Good luck! 🐱'));
    setTimeout(() => logMsg("Today's cats: " + G.cats.map(c => deps.CARDS[c].name).join(', ')), 2200);
    renderAll();
    if (getSnapshot().MODE === 'hot') curtainFor(G.turn, () => { setView(G.turn); renderAll(); });
    afterChange();
  }

  function afterChangeLocal() {
    const snap = getSnapshot();
    const G = snap.G;
    if (!G || snap.MODE === 'online') return;
    if (G.phase === 'over') return;
    if (G.phase === 'nope') { deps.openNopeWindow(); return; }
    if (G.phase === 'defuse') { deps.handleDefusePhase(); return; }
    if (G.phase === 'insert') { deps.handleInsertPhase(); return; }
    if (G.phase === 'favorGive') { deps.handleFavorPhase(); return; }
    // phase 'turn'
    const cp = G.players[G.turn];
    if (snap.MODE === 'hot' && !cp.bot) {
      if (snap.VIEW !== cp.id) { curtainFor(cp.id, () => { setView(cp.id); setSelected([]); renderAll(); }); }
      return;
    }
    if (cp.bot) setTimeout(botMove, 1000 + Math.random() * 700);
  }

  function offerResume() {
    const btn = deps.$('#btnResume');
    const local = loadLocalGame(localStorage);
    if (isLocalSnapshotFresh(local)) {
      btn.style.display = '';
      btn.textContent = 'Resume your game';
      btn.onclick = () => {
        const snap = local;
        if (setG) setG(snap.G);
        else setGameState(snap.G);
        setMode(snap.MODE);
        setView(snap.VIEW);
        setSelected([]);
        setHideHand(false);
        setBotPeek({});
        showChatUI(false);
        deps.show('scr-table');
        renderAll();
        logMsg('Picked up right where you left off.');
        afterChangeLocal();
      };
      return;
    }
    btn.style.display = 'none';
  }

  return { startLocalGame, afterChange: afterChangeLocal, offerResume, dispatchLocal };
}