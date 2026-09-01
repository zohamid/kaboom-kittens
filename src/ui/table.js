'use strict';

import { escapeHtml } from '../services/dom.js';

/**
 * @param {Document} document
 * @param {Object} deps
 * @returns {{
 *   renderAll: () => void,
 *   renderOpps: () => void,
 *   renderPiles: () => void,
 *   renderHand: () => void,
 *   renderBanner: (msg?: string) => void,
 *   cardHTML: (type: string, cls?: string) => string,
 *   cardBackHTML: (cls?: string) => string,
 *   handOrder: () => number[],
 *   updateHandButtons: () => void,
 *   isMyTurn: () => boolean,
 * }}
 */
export function createTableModule(document, deps) {
  const {
    G, MODE, VIEW, selected, HIDE_HAND, SORT_HAND, SHOW_KITTENS,
    CARDS, ART, CARD_BACK_ART, CAT_TYPES, CAT_TYPE_INDEX,
    classifyPlay, curP, isCompact, relaxSeats,
    $, $$, logMsg, flash, NUDGE, SPY,
    setNudge, setSpy, setSelected, setHideHand,
    audio
  } = deps;

  const AV_COLORS = ['#ffc53d', '#ff8fb5', '#3fb0d8', '#9b7ede', '#58b368'];
  const pColor = pid => AV_COLORS[pid % AV_COLORS.length];
  const avatarSVG = (pid, dead) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="50" cy="54" rx="28" ry="25" fill="${AV_COLORS[pid % 5]}" stroke="#2a211c" stroke-width="3"/><circle cx="39" cy="50" r="4" fill="#2a211c"/><circle cx="61" cy="50" r="4" fill="#2a211c"/><path d="M50 60 Q46 64 50 68 Q54 64 50 60" stroke="#2a211c" stroke-width="2.5"/></svg>`;

  function cardHTML(t, cls = '') {
    const c = CARDS[t];
    return `<div class="card ${cls}" data-type="${t}" style="--cc:${c.color};--ct:${c.tint}">
      <div class="inner"><div class="cname">${c.name}</div><div class="art">${ART[t]()}</div><div class="cdesc">${c.desc}</div></div></div>`;
  }

  function cardBackHTML(cls = '') {
    return `<div class="card back ${cls}"><div class="inner"><div>${CARD_BACK_ART()}<div class="backpaw">KABOOM<br>KITTENS</div></div></div></div>`;
  }

  const SORT_RANK = { DEFUSE: 0, NOPE: 1, ATTACK: 2, SKIP: 3, FAVOR: 4, SHUFFLE: 5, FUTURE: 6 };
  function handOrder() {
    const h = myHand(), idx = h.map((_, i) => i);
    if (!SORT_HAND) return idx;
    const rank = t => SORT_RANK[t] !== undefined ? SORT_RANK[t] : 10 + (CAT_TYPE_INDEX[t] ?? CAT_TYPES.length);
    return idx.sort((a, b) => rank(h[a]) - rank(h[b]) || h[a].localeCompare(h[b]) || a - b);
  }

  function myHand() {
    return G?.players?.[VIEW]?.hand || [];
  }

  function isMyTurn() {
    if (!G || G.phase === 'over') return false;
    if (MODE === 'online') return G.turn === VIEW && !G.players[VIEW].bot;
    if (MODE === 'bots') return G.turn === 0;
    return G.turn === VIEW;
  }

  function renderAll() {
    renderOpps();
    renderPiles();
    renderHand();
    renderBanner();
    relaxSeats();
    requestAnimationFrame(relaxSeats);
  }

  function renderOpps() {
    const s = $('#seats'); if (!s) return;
    s.innerHTML = '';
    const n = G.players.length;
    const narrow = window.innerWidth < 620;
    const compact = isCompact();
    $('#seats').classList.toggle('compact', compact);
    const rx = narrow ? 46 : 50, ry = narrow ? 51 : 52;
    G.players.forEach(p => {
      const rel = (((p.id - VIEW) % n) + n) % n;
      const deg = 90 + rel * (360 / n), a = deg * Math.PI / 180;
      const me = p.id === VIEW, active = p.id === G.turn && p.alive && G.phase !== 'over';
      const el = document.createElement('div');
      el.className = 'opp seat' + (active ? ' turn' : '') + (p.alive ? '' : ' dead') + (me ? ' mine' : '');
      el.id = 'opp' + p.id;
      el.style.setProperty('--c', pColor(p.id));
      el.dataset.a = a; el.dataset.me = me ? '1' : '0';
      el.dataset.rx = rx; el.dataset.ry = me ? ry * 0.86 : ry;
      el.innerHTML =
        (active ? '<div class="turnpill">' + (me ? 'YOUR TURN' : 'PLAYING') + (G.turnsLeft > 1 ? ' ×' + G.turnsLeft : '') + '</div>' : '') +
        '<div class="avatar">' + avatarSVG(p.id, !p.alive) + '</div>' +
        '<div class="nm">' + (me ? 'You' : escapeHtml(p.name)) + '</div>' +
        '<div class="cards">' + (p.alive ? p.hand.length + ' cards' : 'out') + '</div>' +
        (p.alive ? '' : '<div class="boomtag">💥</div>');
      if (!compact) placeSeat(el);
      s.appendChild(el);
      if (active && !compact) {
        const ptr = document.createElement('div');
        ptr.className = 'turnPointer';
        ptr.style.setProperty('--c', pColor(p.id));
        ptr.style.left = (50 + rx * 0.66 * Math.cos(a)) + '%';
        ptr.style.top = (50 + ry * 0.66 * Math.sin(a)) + '%';
        ptr.style.transform = 'translate(-50%,-50%) rotate(' + (deg + 90) + 'deg)';
        s.appendChild(ptr);
      }
    });
  }

  function placeSeat(el) {
    const a = +el.dataset.a + (+el.dataset.da || 0);
    el.style.left = (50 + (+el.dataset.rx) * Math.cos(a)) + '%';
    el.style.top = (50 + (+el.dataset.ry) * Math.sin(a)) + '%';
  }

  function renderPiles() {
    const dp = $('#deckPile');
    dp.querySelectorAll('.card').forEach(e => e.remove());
    if (G.deck.length) dp.insertAdjacentHTML('beforeend', cardBackHTML());
    const booms = G.deck.filter(c => c === 'BOOM').length;
    $('#deckCount').textContent = G.deck.length + ' left' + (SHOW_KITTENS && booms ? ' · 💣' + booms : '');
    dp.classList.toggle('mydraw', isMyTurn() && G.phase === 'turn');
    const dc = $('#discardPile');
    dc.querySelectorAll('.card').forEach(e => e.remove());
    G.discard.slice(-3).forEach(t => dc.insertAdjacentHTML('beforeend', cardHTML(t)));
    $('#discardCount').textContent = G.discard.length ? G.discard.length : 'empty';
    const ab = $('#attackBadge');
    if (G.turnsLeft > 1 && G.phase !== 'over') { ab.style.display = 'block'; ab.textContent = `${G.players[G.turn].name}: ${G.turnsLeft} TURNS!`; }
    else ab.style.display = 'none';
    const deckTop = dp.querySelector('.card');
    if (deckTop) deckTop.onclick = () => { if (isMyTurn() && G.phase === 'turn') deps.submitAction({ a: 'draw', pid: VIEW }); };
  }

  function renderHand() {
    const h = $('#hand'); h.innerHTML = '';
    const ghost = G && G.players[VIEW] && !G.players[VIEW].alive;
    $('#spyBar').style.display = ghost ? 'flex' : 'none';
    if (ghost && G.phase !== 'over') { renderSpectator(); return; }
    if (HIDE_HAND || !G || !G.players[VIEW] || !G.players[VIEW].alive) {
      $('#btnPlaySel').style.display = 'none'; $('#btnDraw').style.display = 'none';
      return;
    }
    handOrder().forEach(i => {
      const t = myHand()[i];
      h.insertAdjacentHTML('beforeend', cardHTML(t, selected.includes(i) ? 'sel' : ''));
      const el = h.lastElementChild;
      el.onclick = () => toggleSel(i);
    });
    updateHandButtons();
  }

  function renderSpectator() {
    $('#btnPlaySel').style.display = 'none'; $('#btnDraw').style.display = 'none';
    const alive = G.players.filter(p => p.alive);
    if (SPY == null || !G.players[SPY] || !G.players[SPY].alive) SPY = G.turn;
    const bar = $('#spyBar'); bar.innerHTML = '';
    alive.forEach(p => {
      const c = document.createElement('button');
      c.className = 'spyChip' + (p.id === SPY ? ' sel' : '') + (p.id === G.turn ? ' playing' : '');
      c.style.setProperty('--c', pColor(p.id));
      c.textContent = p.name + ' (' + p.hand.length + ')';
      c.onclick = () => { SPY = p.id; setSpy(SPY); audio.sPop(); renderHand(); };
      bar.appendChild(c);
    });
    const h = $('#hand');
    const sp = G.players[SPY];
    $('#handInfo').innerHTML = '👻 <b>Spectating</b> — you can see everyone\'s cards now';
    sp.hand.forEach(t => h.insertAdjacentHTML('beforeend', cardHTML(t, 'spy')));
    if (!sp.hand.length) h.innerHTML = '<div style="color:var(--paper);opacity:.8">empty hand</div>';
  }

  function toggleSel(i) {
    if (!isMyTurn() || G.phase !== 'turn') { setSelected([]); renderHand(); return; }
    const k = selected.indexOf(i);
    if (k >= 0) setSelected(selected.filter((_, idx) => idx !== k));
    else { setSelected([...selected, i]); const c = CARDS[myHand()[i]]; if (c) flash(c.name + ' — ' + c.desc); }
    renderHand();
  }

  function updateHandButtons() {
    const play = $('#btnPlaySel'), draw = $('#btnDraw');
    const mine = isMyTurn() && G.phase === 'turn';
    draw.style.display = mine ? '' : 'none';
    draw.classList.toggle('nudge', mine && NUDGE);
    draw.textContent = mine && NUDGE ? 'Draw to end your turn 👇' : 'Draw & end turn';
    draw.onclick = () => deps.submitAction({ a: 'draw', pid: VIEW });
    const types = selected.map(i => myHand()[i]);
    const cls = types.length ? classifyPlay(types) : null;
    if (mine && cls) {
      play.style.display = '';
      play.textContent = cls.kind === 'PAIR' ? 'Play pair: steal!' : cls.kind === 'TRIPLE' ? 'Play trio: demand!' : cls.kind === 'FIVE' ? 'Play 5: dig!' : 'Play ' + CARDS[types[0]].name;
      play.onclick = () => deps.beginPlay(types, cls);
    } else play.style.display = 'none';
  }

  function renderBanner(msg) {
    const b = $('#banner');
    if (msg) { b.innerHTML = msg; return; }
    if (!G) return;
    if (G.phase === 'over') { b.innerHTML = `<span class="disp">${G.players[G.winner].name} WINS!</span>`; return; }
    const cp = G.players[G.turn];
    if (G.phase === 'nope') { b.innerHTML = `⏳ Waiting for Nopes…`; return; }
    if (G.phase === 'favorGive') { b.innerHTML = `${G.players[G.pendingFavor.from].name} is choosing a card to give…`; return; }
    if (G.phase === 'defuse' || G.phase === 'insert') { b.innerHTML = `💣 <span class="disp">${G.players[G.pendingBoom.pid].name}</span> drew a Kaboom Kitten!`; return; }
    if (isMyTurn()) b.innerHTML = NUDGE
      ? `<span class="disp" style="color:var(--sun)">Now draw a card</span> to finish your turn 👇`
      : `<span class="disp">Your turn${G.turnsLeft > 1 ? ' ×' + G.turnsLeft : ''}!</span> Play cards or draw to end your turn.`;
    else b.innerHTML = `<span class="disp">${cp.name}</span> is ${cp.bot ? 'plotting…' : 'playing…'}`;
  }

  return { renderAll, renderOpps, renderPiles, renderHand, renderBanner, cardHTML, cardBackHTML, handOrder, updateHandButtons, isMyTurn };
}