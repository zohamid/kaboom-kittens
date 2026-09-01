'use strict';

/**
 * @typedef {Object} EventControllerDeps
 * @property {function} logMsg
 * @property {function} fxPlay
 * @property {function} fxDraw
 * @property {function} fxNope
 * @property {function} fxBoom
 * @property {function} fxConfetti
 * @property {function} flash
 * @property {function} showFuture
 * @property {function} audio
 * @property {function} clearLocal
 * @property {function} showWin
 * @property {function} getSnapshot
 * @property {function} setSelected
 * @property {function} setNudge
 * @property {function} setSpy
 * @property {function} renderAll
 */

/**
 * @param {EventControllerDeps} deps
 * @returns {{
 *   processEvents: (evs: any[]) => void,
 * }}
 */
export function createEventController(deps) {
  const { logMsg, fxPlay, fxDraw, fxNope, fxBoom, fxConfetti, flash, showFuture, audio, clearLocal, showWin, getSnapshot, setSelected, setNudge, setSpy, renderAll } = deps;

  function processEvents(evs) {
    evs.forEach(e => {
      const snap = getSnapshot();
      switch (e.t) {
        case 'log': logMsg(e.msg, e.pid, e.kind); break;
        case 'play': fxPlay(e.pid, e.cards[0]); if (e.pid === snap.VIEW) setNudge(true); break;
        case 'favorAsk': break;
        case 'nope': fxNope(); break;
        case 'fizzle': break;
        case 'draw': fxDraw(e.pid);
          if (e.pid === snap.VIEW && !snap.HIDE_HAND) flash(`You drew a ${snap.CARDS[e.card].name}.`);
          break;
        case 'boomDrawn': audio.sUhoh(); break;
        case 'inserted': audio.sSwish(); break;
        case 'defused': audio.sDefuse(); break;
        case 'left': audio.sSwish(); break;
        case 'newround': deps.announce('NEW ROUND!'); audio.sDeal(); deps.dealAnimation(); break;
        case 'exploded': fxBoom(); if (e.pid === snap.VIEW) setTimeout(audio.sLose, 700); break;
        case 'shuffled': audio.sSwish(); break;
        case 'steal': audio.sSteal();
          if (e.to === snap.VIEW) flash(`😼 You swiped their ${snap.CARDS[e.card].name}!`);
          else if (e.from === snap.VIEW) flash(`😾 They swiped your ${snap.CARDS[e.card].name}!`);
          break;
        case 'give': audio.sPop();
          if (e.to === snap.VIEW) flash(`🎁 You were handed a ${snap.CARDS[e.card].name}.`);
          else if (e.from === snap.VIEW) flash(`You handed over your ${snap.CARDS[e.card].name}.`);
          break;
        case 'dig': audio.sPop(); if (e.pid === snap.VIEW) flash(`You fished out a ${snap.CARDS[e.card].name}!`); break;
        case 'future': if (e.pid === snap.VIEW && (snap.MODE !== 'bots' || e.pid === 0)) showFuture(e.cards); break;
        case 'win': clearLocal(); fxConfetti(); audio.sWin(); setTimeout(() => showWin(e.pid), 900); break;
        case 'turn': setSelected([]); setNudge(false); setSpy(null);
          if (!snap.HIDE_HAND) {
            if (e.pid === snap.VIEW) e.turnsLeft > 1 ? audio.sAttacked() : audio.sYourTurn();
            else audio.sTheirTurn();
          }
          break;
      }
    });
    renderAll();
  }

  return { processEvents };
}