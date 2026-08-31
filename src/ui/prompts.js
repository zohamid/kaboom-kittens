'use strict';

import { escapeHtml } from '../services/dom.js';

/**
 * @param {Document} document
 * @param {Object} deps
 * @returns {{
 *   beginPlay: (types: string[], cls: any, deps: any) => void,
 *   pickTarget: (cb: (pid: number) => void, G: any, VIEW: number, modal: (html: string, kind?: string) => void, closeModal: () => void, $: (sel: string) => Element, $$: (sel: string) => Element[], submitAction: (action: any) => void, processEvents: (evs: any[]) => void, afterChange: () => void) => void,
 *   pickCardType: (title: string, keys: string[], cb: (cardType: string) => void, CARDS: any, ART: any, cardHTML: (type: string, cls?: string) => string, modal: (html: string, kind?: string) => void, closeModal: () => void, $: (sel: string) => Element, $$: (sel: string) => Element[], submitAction: (action: any) => void, processEvents: (evs: any[]) => void, afterChange: () => void) => void,
 *   openInsertPicker: (n: number, cb: (pos: number | null) => void, modal: (html: string, kind?: string) => void, closeModal: () => void, $: (sel: string) => Element, $$: (sel: string) => Element[], submitAction: (action: any) => void, processEvents: (evs: any[]) => void, afterChange: () => void) => void,
 * }}
 */
export function createPromptsModule(document, deps) {
  const $ = q => document.querySelector(q);
  const $$ = q => [...document.querySelectorAll(q)];

  function beginPlay(types, cls, deps) {
    const { VIEW, submitAction, selected, setSelected } = deps;
    const done = (params = {}) => {
      setSelected([]);
      submitAction(Object.assign({ a: 'play', pid: VIEW, cards: types }, params));
    };
    if (cls.kind === 'FAVOR' || cls.kind === 'PAIR') pickTarget(t => done({ target: t }), deps);
    else if (cls.kind === 'TRIPLE') pickTarget(t => pickCardType('Demand which card?', Object.keys(deps.CARDS).filter(k => k !== 'BOOM'), n => done({ target: t, named: n }), deps), deps);
    else if (cls.kind === 'FIVE') {
      const avail = [...new Set(deps.G.discard)].filter(k => k !== 'BOOM');
      if (!avail.length) { deps.renderBanner('Discard pile is empty!'); return; }
      pickCardType('Take which card from the discard pile?', avail, w => done({ wish: w }), deps);
    }
    else done();
  }

  function pickTarget(cb, deps) {
    const { G, VIEW, modal, closeModal, submitAction, processEvents, afterChange } = deps;
    const opts = G.players.filter(p => p.alive && p.id !== VIEW);
    modal(`<h2>Pick a victim</h2><p class="mtext" style="margin-top:-6px">(nothing purr-sonal)</p><div class="mrow">${opts.map(p => `
      <button class="btn sun" data-t="${p.id}">${escapeHtml(p.name)}<br><span style="font-family:var(--hand);font-size:14px">${p.hand.length} cards</span></button>`).join('')}
      </div><div class="mrow"><button class="btn small ghost2" id="mCancel">Cancel</button></div>`);
    $$('#modal [data-t]').forEach(b => b.onclick = () => {
      closeModal();
      cb(+b.dataset.t);
    });
    $('#mCancel').onclick = closeModal;
  }

  function pickCardType(title, keys, cb, deps) {
    const { CARDS, ART, cardHTML, modal, closeModal, submitAction, processEvents, afterChange } = deps;
    modal(`<h2>${title}</h2><div class="cardpick">${keys.map(k => `<div data-k="${k}">${cardHTML(k, 'mini')}</div>`).join('')}</div>
      <div class="mrow"><button class="btn small" id="mCancel">Cancel</button></div>`);
    $$('#modal [data-k]').forEach(d => d.onclick = () => {
      closeModal();
      cb(d.dataset.k);
    });
    $('#mCancel').onclick = closeModal;
  }

  function openInsertPicker(n, cb, deps) {
    const { modal, closeModal, submitAction, processEvents, afterChange } = deps;
    let strip = '<div class="stripEnd">TOP</div>';
    for (let i = 0; i <= n; i++) {
      strip += `<button class="slot" data-pos="${i}" aria-label="Insert at position ${i + 1}"></button>`;
      if (i < n) strip += '<div class="dcard"></div>';
    }
    strip += '<div class="stripEnd">BOTTOM</div>';
    modal(`<h2>Hide the kitten 😼</h2>
      <p class="mtext" style="margin-top:-4px">Slip it anywhere among the ${n} cards — click a gap. Nobody sees where it goes.</p>
      <div class="deckStrip" id="deckStrip">${strip}</div>
      <div class="mtext" id="slotLabel">Hover a gap to see where it lands…</div>
      <div class="mrow">
        <button class="btn small sun" data-quick="0">Right on top 😈</button>
        <button class="btn small" data-quick="${Math.floor(n / 2)}">Middle</button>
        <button class="btn small" data-quick="${n}">Bottom</button>
        <button class="btn small sky" data-quick="rnd">Surprise me 🎲</button>
      </div>`);
    const lab = $('#slotLabel');
    const describe = p => p === 0 ? 'Right on top — the very next card drawn. Evil. 😈'
      : p === n ? `Dead last — ${n} cards above it. They'll forget it exists.`
      : `Position ${p + 1} from the top — ${p} card${p > 1 ? 's' : ''} above, ${n - p} below.`;
    $$('#modal .slot').forEach(b => {
      const p = +b.dataset.pos;
      b.onmouseenter = b.onfocus = () => { lab.textContent = describe(p); };
      b.onclick = () => { closeModal(); cb(p); };
    });
    $$('#modal [data-quick]').forEach(b => b.onclick = () => {
      closeModal();
      const q = b.dataset.quick;
      cb(q === 'rnd' ? null : +q);
    });
  }

  return { beginPlay, pickTarget, pickCardType, openInsertPicker };
}