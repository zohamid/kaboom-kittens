'use strict';

/**
 * @param {Document} document
 * @returns {{ q: (sel: string) => Element | null, qq: (sel: string) => Element[] }}
 */
export function createDomHelpers(document) {
  const q = (sel) => document.querySelector(sel);
  const qq = (sel) => [...document.querySelectorAll(sel)];
  return { q, qq };
}

/**
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, c => ({ '&': '&', '<': '<', '>': '>', '"': '"' }[c]));
}

/**
 * @param {Document} document
 * @param {Record<string, Element>} elementCache
 * @returns {{ q: (sel: string) => Element | null, qq: (sel: string) => Element[], get: (sel: string) => Element }}
 */
export function createCachedDomHelpers(document, elementCache = {}) {
  const q = (sel) => document.querySelector(sel);
  const qq = (sel) => [...document.querySelectorAll(sel)];
  const get = (sel) => {
    if (!elementCache[sel]) elementCache[sel] = document.querySelector(sel);
    return elementCache[sel];
  };
  return { q, qq, get };
}