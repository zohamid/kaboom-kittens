'use strict';

/**
 * @typedef {Object} HotSeatDeps
 * @property {function} curtainFor
 * @property {function} setView
 * @property {function} setSelected
 * @property {function} renderAll
 */

/**
 * @param {HotSeatDeps} deps
 * @returns {{
 *   handleTurnHandoff: (G: any, VIEW: number) => void,
 * }}
 */
export function createHotSeatModule(deps) {
  const { curtainFor, setView, setSelected, renderAll } = deps;

  /**
   * Handle the pass-and-play handoff when turn changes
   * @param {any} G - Game state
   * @param {number} VIEW - Current view player ID
   */
  function handleTurnHandoff(G, VIEW) {
    const cp = G.players[G.turn];
    if (!cp.bot && VIEW !== cp.id) {
      curtainFor(cp.id, () => { setView(cp.id); setSelected([]); renderAll(); });
    }
  }

  return { handleTurnHandoff };
}