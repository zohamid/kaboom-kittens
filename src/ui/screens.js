'use strict';

import { escapeHtml } from '../services/dom.js';

/**
 * @param {Document} document
 * @returns {{
 *   show: (id: string) => void,
 *   renderHelp: (CARDS: any, ART: any, CAT_TYPES: string[]) => void,
 *   openSetup: (setupMode: string, playerCount: number, show: (id: string) => void) => void,
 *   modal: (html: string, kind?: string) => void,
 *   closePhaseModal: () => void,
 *   closeModal: () => void,
 *   curtainFor: (pid: number, cb: () => void, G: any, HIDE_HAND: boolean, renderHand: () => void) => void,
 *   announce: (text: string, ms?: number) => void,
 * }}
 */
export function createScreensModule(document) {
  const $ = q => document.querySelector(q);
  const $$ = q => [...document.querySelectorAll(q)];

  /** Switch screens. Exactly one .screen carries .on at a time. */
  function show(id) {
    $$('.screen').forEach(s => s.classList.remove('on'));
    $('#' + id).classList.add('on');
    $('#sideRail').style.display = (id === 'scr-table') ? 'flex' : 'none';
  }

  let helpRendered = false;
  function renderHelp(CARDS, ART, CAT_TYPES) {
    const el = $('#ruleCards');
    if (el.dataset.done) return;
    el.dataset.done = '1';
    ['BOOM', 'DEFUSE', 'ATTACK', 'SKIP', 'FAVOR', 'SHUFFLE', 'FUTURE', 'NOPE'].forEach(t => {
      el.insertAdjacentHTML('beforeend', `<div class="rule"><div class="mini">${ART[t]()}</div><div><b style="color:${CARDS[t].color}">${CARDS[t].name}</b><p>${CARDS[t].desc}</p></div></div>`);
    });
    $('#rc-pair').innerHTML = ART.CAT_SAMOSA();
    $('#rc-trip').innerHTML = ART.CAT_DISCO();
    $('#rc-five').innerHTML = ART.CAT_MELON();
    const zoo = $('#catZoo');
    if (zoo) zoo.innerHTML = CAT_TYPES.map(t => `<div style="text-align:center"><div style="width:74px">${ART[t]()}</div>
      <div style="font-family:var(--display);font-size:13px;letter-spacing:.03em">${CARDS[t].name}</div></div>`).join('');
    helpRendered = true;
  }

  let setupMode = 'bots';
  let playerCount = 3;
  function openSetup(mode, count, showFn) {
    setupMode = mode;
    playerCount = count;
    $('#setupTitle').textContent = setupMode === 'bots' ? 'You vs the Bots' : 'Pass & Play';
    $('#cntLabel').textContent = setupMode === 'bots' ? 'How many bots?' : 'How many players?';
    const chips = $('#cntChips');
    chips.innerHTML = '';
    const opts = setupMode === 'bots' ? [1, 2, 3, 4] : [2, 3, 4, 5];
    opts.forEach(n => {
      const c = document.createElement('button');
      c.className = 'chip' + (n === (setupMode === 'bots' ? playerCount - 1 : playerCount) ? ' sel' : '');
      c.textContent = n;
      c.onclick = () => {
        playerCount = setupMode === 'bots' ? n + 1 : n;
        openSetup(setupMode, playerCount, showFn);
      };
      chips.appendChild(c);
    });
    if (playerCount < 2 || playerCount > 5) playerCount = 3;
    const hn = $('#hotNames');
    hn.innerHTML = '';
    if (setupMode === 'hot') {
      for (let i = 1; i < playerCount; i++) {
        hn.insertAdjacentHTML('beforeend', `<div class="field"><label>Player ${i + 1}</label><input type="text" maxlength="14" class="hotName" value="Player ${i + 1}"></div>`);
      }
    }
    showFn('scr-setup');
  }

  function modal(html, kind) {
    $('#modal').innerHTML = html;
    $('#modalBg').dataset.kind = kind || 'phase';
    $('#modalBg').classList.add('on');
  }

  function closePhaseModal() {
    if ($('#modalBg').dataset.kind !== 'info') closeModal();
  }

  function closeModal() {
    $('#modalBg').classList.remove('on');
  }

  let HIDE_HAND = false;
  function curtainFor(pid, cb, G, hideHandRef, renderHand) {
    hideHandRef = true;
    renderHand();
    $('#curtainTitle').textContent = `Pass to ${G.players[pid].name}`;
    $('#curtainText').textContent = 'Paws off — no peeking at other hands! 😾';
    $('#curtain').classList.add('on');
    $('#curtainBtn').onclick = () => {
      $('#curtain').classList.remove('on');
      hideHandRef = false;
      cb && cb();
    };
  }

  function announce(text, ms) {
    const box = $('#announce');
    box.firstElementChild.textContent = text;
    box.classList.remove('on');
    void box.offsetWidth;
    box.classList.add('on');
    setTimeout(() => box.classList.remove('on'), ms || 1900);
  }

  return { show, renderHelp, openSetup, modal, closePhaseModal, closeModal, curtainFor, announce };
}