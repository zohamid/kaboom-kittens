'use strict';

import { newGame, dispatch } from '../game-engine.js';

const LOCAL_KEY = 'kk_local';
const ROOM_KEY = 'kk_room';
const MAX_AGE_MS = 12 * 3600e3; // 12 hours

/**
 * @typedef {Object} LocalSnapshot
 * @property {string} MODE
 * @property {number} VIEW
 * @property {import('../game-engine.js').GameState} G
 * @property {number} t
 */

/**
 * @typedef {Object} RoomSnapshot
 * @property {string} db
 * @property {string} code
 * @property {number} myPid
 * @property {boolean} isHost
 * @property {number} t
 */

/**
 * @param {Storage} storage
 * @param {string} mode
 * @property {number} viewPlayerId
 * @property {import('../game-engine.js').GameState} game
 */
export function saveLocalGame(storage, mode, viewPlayerId, game) {
  if (mode !== 'bots' && mode !== 'hot') return;
  try {
    storage.setItem(LOCAL_KEY, JSON.stringify({ MODE: mode, VIEW: viewPlayerId, G: game, t: Date.now() }));
  } catch (e) {}
}

/**
 * @param {Storage} storage
 */
export function clearLocalGame(storage) {
  try { storage.setItem(LOCAL_KEY, ''); } catch (e) {}
}

/**
 * @param {Storage} storage
 * @returns {LocalSnapshot | null}
 */
export function loadLocalGame(storage) {
  try {
    const raw = storage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (!snap || !snap.G || !snap.MODE || typeof snap.VIEW !== 'number') return null;
    if (Date.now() - snap.t > MAX_AGE_MS) return null;
    return snap;
  } catch (e) {
    return null;
  }
}

/**
 * @param {Storage} storage
 * @param {RoomSnapshot} session
 */
export function saveRoomSession(storage, session) {
  try { storage.setItem(ROOM_KEY, JSON.stringify(session)); } catch (e) {}
}

/**
 * @param {Storage} storage
 * @returns {RoomSnapshot | null}
 */
export function loadRoomSession(storage) {
  try {
    const raw = storage.getItem(ROOM_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session || !session.db || !session.code || typeof session.myPid !== 'number' || typeof session.isHost !== 'boolean') return null;
    if (Date.now() - session.t > MAX_AGE_MS) return null;
    return session;
  } catch (e) {
    return null;
  }
}

/**
 * @param {Storage} storage
 */
export function clearRoomSession(storage) {
  try { storage.setItem(ROOM_KEY, ''); } catch (e) {}
}

/**
 * Check if a local snapshot is fresh and playable
 * @param {LocalSnapshot | null} snap
 * @returns {boolean}
 */
export function isLocalSnapshotFresh(snap) {
  return !!(snap && snap.G && snap.G.phase !== 'over' && Date.now() - snap.t < MAX_AGE_MS);
}

/**
 * Check if a room session is fresh
 * @param {RoomSnapshot | null} session
 * @returns {boolean}
 */
export function isRoomSessionFresh(session) {
  return !!(session && Date.now() - session.t < MAX_AGE_MS);
}