'use strict';

/**
 * @typedef {Object} ActionControllerDeps
 * @property {function} dispatch
 * @property {function} dispatchLocal
 * @property {function} getOnlineClient
 * @property {function} getSnapshot
 * @property {function} processEvents
 * @property {function} afterChange
 * @property {function} submitAction
 */

/**
 * @param {ActionControllerDeps} deps
 * @returns {{
 *   submit: (action: any) => void,
 * }}
 */
export function createActionController(deps) {
  const { dispatchLocal, getOnlineClient, getSnapshot, processEvents, afterChange } = deps;

  function submit(action) {
    const snap = getSnapshot();
    if (snap.MODE === 'online') {
      getOnlineClient().send(action);
    } else {
      const events = dispatchLocal(action);
      if (events) {
        processEvents(events);
        afterChange();
      }
    }
  }

  return { submit };
}