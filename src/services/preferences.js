'use strict';

/**
 * @typedef {Object} Preferences
 * @property {boolean} soundEnabled
 * @property {boolean} handSorted
 * @property {boolean} showKittens
 */

/** @type {Preferences} */
const DEFAULTS = { soundEnabled: true, handSorted: true, showKittens: false };

/**
 * @param {Storage} storage
 * @returns {Preferences}
 */
export function loadPreferences(storage) {
  try {
    return {
      soundEnabled: storage.getItem('kk_snd') !== '0',
      handSorted: storage.getItem('kk_sort') !== '0',
      showKittens: storage.getItem('kk_bombs') === '1',
    };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

/**
 * @param {Storage} storage
 * @param {Partial<Preferences>} updates
 * @returns {Preferences}
 */
export function savePreferences(storage, updates) {
  const current = loadPreferences(storage);
  const next = { ...current, ...updates };
  try {
    if (next.soundEnabled !== undefined) storage.setItem('kk_snd', next.soundEnabled ? '1' : '0');
    if (next.handSorted !== undefined) storage.setItem('kk_sort', next.handSorted ? '1' : '0');
    if (next.showKittens !== undefined) storage.setItem('kk_bombs', next.showKittens ? '1' : '0');
  } catch (e) {}
  return next;
}

/**
 * @param {Storage} storage
 * @returns {Preferences}
 */
export function toggleSound(storage) {
  const next = loadPreferences(storage);
  next.soundEnabled = !next.soundEnabled;
  return savePreferences(storage, { soundEnabled: next.soundEnabled });
}

/**
 * @param {Storage} storage
 * @returns {Preferences}
 */
export function toggleHandSort(storage) {
  const next = loadPreferences(storage);
  next.handSorted = !next.handSorted;
  return savePreferences(storage, { handSorted: next.handSorted });
}

/**
 * @param {Storage} storage
 * @returns {Preferences}
 */
export function toggleShowKittens(storage) {
  const next = loadPreferences(storage);
  next.showKittens = !next.showKittens;
  return savePreferences(storage, { showKittens: next.showKittens });
}