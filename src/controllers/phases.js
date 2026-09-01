'use strict';

/**
 * @typedef {Object} PhaseControllerDeps
 * @property {function} getSnapshot
 * @property {function} openNopeWindow
 * @property {function} handleDefusePhase
 * @property {function} handleInsertPhase
 * @property {function} handleFavorPhase
 * @property {function} submitAction
 * @property {Object} hotSeat
 */

/**
 * @param {PhaseControllerDeps} deps
 * @returns {{
 *   afterChange: () => void,
 * }}
 */
export function createPhaseController(deps) {
  const { getSnapshot, openNopeWindow, handleDefusePhase, handleInsertPhase, handleFavorPhase, submitAction, hotSeat } = deps;

  function afterChange() {
    const snap = getSnapshot();
    const G = snap.G;
    if (!G || snap.MODE === 'online') return;
    if (G.phase === 'over') return;
    if (G.phase === 'nope') { openNopeWindow(); return; }
    if (G.phase === 'defuse') { handleDefusePhase(); return; }
    if (G.phase === 'insert') { handleInsertPhase(); return; }
    if (G.phase === 'favorGive') { handleFavorPhase(); return; }
    // phase 'turn'
    const cp = G.players[G.turn];
    if (snap.MODE === 'hot' && !cp.bot) {
      hotSeat.handleTurnHandoff(G, snap.VIEW);
      return;
    }
    if (cp.bot) setTimeout(snap.botMove, 1000 + Math.random() * 700);
  }

  return { afterChange };
}