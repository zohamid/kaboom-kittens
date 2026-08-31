'use strict';

/**
 * @typedef {'lobby'|'playing'} RoomStatus
 * @typedef {{name: string}} RoomPlayer
 * @typedef {Record<string, RoomPlayer>} RoomPlayers
 * @typedef {{pid: number, action: import('./game-engine.js').GameAction}} InboxMessage
 * @typedef {Record<string, InboxMessage>} Inbox
 * @typedef {{n: string, m?: string, r?: string, p: number}} ChatMessage
 * @typedef {Record<string, ChatMessage>} ChatLog
 * @typedef {{
 *   status: RoomStatus,
 *   players: RoomPlayers,
 *   startReq?: number,
 *   rematchReq?: number,
 *   game?: RoomGame,
 *   inbox?: Inbox,
 *   chat?: ChatLog
 * }} RoomTree
 * @typedef {{
 *   s: string,
 *   seq: number,
 *   pub: number,
 *   seats: string,
 *   ev: string,
 *   evSeq: number
 * }} RoomGame
 */

export function createOnlineClient(deps) {
  const {
    document,
    window,
    fetch,
    EventSource,
    localStorage,
    dispatch,
    newGame,
    CARDS,
    ART,
    NOPE_MS,
    show,
    modal,
    closeModal,
    closePhaseModal,
    renderAll,
    logMsg,
    processEvents,
    startNopeClock,
    stopNopeClock,
    npClockHTML,
    openInsertPicker,
    cardHTML,
    floatReaction,
    addChatLine,
    sChat,
    showChatUI,
    getSnapshot,
    submitAction,
  } = deps;

  const $ = q => document.querySelector(q);
  const $$ = q => [...document.querySelectorAll(q)];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  let db = null;
  let code = null;
  let myPid = null;
  let isHost = false;
  let es = null;
  let pollIv = null;
  let tree = null;
  let lastSeq = -1;
  let lastEvSeq = -1;
  let evSeq = 0;
  let hostTimer = null;
  let started = false;
  let uiPhaseKey = '';
  let pub = 0;
  let lastPub = -1;
  let seats = [];
  let seatIndexMap = {};

  function rebuildSeatIndexMap() { seatIndexMap = Object.fromEntries(seats.map((pid, i) => [String(pid), i])); }
  const seatIndex = () => seatIndexMap[String(myPid)] ?? 0;

  const base = () => `${db}/kaboom/rooms/${code}`;

  async function req(method, path, body) {
    const r = await fetch(`${base()}${path}.json`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) throw new Error('Database said no (' + r.status + '). Check the URL & that the database is in test mode.');
    return r.json();
  }
  const rnd = n => Math.random().toString(36).slice(2, 2 + n);

  function err(msg) { const e = $('#onlineErr'); e.style.display = 'block'; e.textContent = msg; }
  function friendly(e) { return /fetch|network|load/i.test(e.message) ? "Couldn't reach the database from this page. Heads-up: on the claude.ai-hosted version, online play is blocked by the page sandbox — use the downloadable game file for online rooms. (Bots and Pass & Play work everywhere!)" : e.message; }
  function clearErr() { $('#onlineErr').style.display = 'none'; }
  function normDb() {
    let v = ($('#inpDb').value || '').trim().replace(/\/+$/, '');
    if (!/^https:\/\/.+(firebaseio\.com|firebasedatabase\.app)/.test(v)) { err('That doesn\'t look like a Firebase Realtime Database URL — it should start with https:// and end with firebaseio.com or firebasedatabase.app'); return null; }
    store.set('kk_db', v); return v;
  }
  function myName() { const v = ($('#inpNameOn').value || '').trim() || 'Cat ' + rnd(3).toUpperCase(); store.set('kk_name', v); return v; }

  const seenChat = {};
  let chatPrimed = false;
  const BAKED_DB = 'https://kaboom-kittens-default-rtdb.asia-southeast1.firebasedatabase.app';

  function enterLobby() {
    started = false; lastSeq = -1; lastEvSeq = -1; evSeq = 0;
    chatPrimed = false; Object.keys(seenChat).forEach(k => delete seenChat[k]); $('#chatLog').innerHTML = '';
    $('#onlineSetupPanel').style.display = 'none';
    $('#lobbyPanel').style.display = '';
    $('#lobbyCode').textContent = code;
    updateLobbyControls(playerCountIn(tree));
    saveSession();
    listen();
  }
  const playerCountIn = t => t && t.players ? Object.keys(t.players).filter(k => t.players[k]).length : 0;

  async function startGameAsHost() {
    const keys = Object.keys(tree.players).filter(k => tree.players[k]).sort((a, b) => a - b);
    seats = keys; rebuildSeatIndexMap();
    const defs = keys.map(k => ({ name: tree.players[k].name }));
    const G = newGame(defs);
    submitAction({ type: 'startLocal', G, viewPlayerId: seatIndex() });
    pushSync([{ t: 'newround' }, { t: 'log', msg: 'Cards dealt — good luck! 🐱' }, { t: 'log', msg: "Today's cats: " + G.cats.map(c => CARDS[c].name).join(', ') }], { status: 'playing', startReq: null, rematchReq: null });
    startedNow();
  }
  function startedNow() {
    started = true; show('scr-table'); showChatUI(true); renderAll(); hostPhaseDuties();
    logMsg('Tip: tap 💬 to chat, or use the emoji row to react!');
  }

  function setAtPath(obj, path, data) {
    if (path === '/' || path === '') return data;
    const parts = path.replace(/^\//, '').split('/'); let o = obj || {}; let cur = o;
    for (let i = 0; i < parts.length - 1; i++) { cur[parts[i]] = cur[parts[i]] || {}; cur = cur[parts[i]]; }
    if (data === null) delete cur[parts[parts.length - 1]]; else cur[parts[parts.length - 1]] = data;
    return o;
  }

  function listen() {
    stopListen();
    try {
      es = new EventSource(`${base()}.json`);
      es.addEventListener('put', ev => { try { const { path, data } = JSON.parse(ev.data); tree = setAtPath(tree, path, data); onTree(); } catch (e) {} });
      es.addEventListener('patch', ev => { try { const { path, data } = JSON.parse(ev.data);
        if (data && typeof data === 'object') {
          const p = path === '/' ? '' : path.replace(/\/$/, ''), isArr = Array.isArray(data);
          for (const k of Object.keys(data)) { if (isArr && data[k] === null) continue; tree = setAtPath(tree, p + '/' + k, data[k]); }
        } else tree = setAtPath(tree, path, data);
        onTree(); } catch (e) {} });
      es.onerror = () => startPolling(1500);
    } catch (e) { startPolling(1500); }
    startPolling(3000);
  }

  function startPolling(ms) {
    if (pollIv) return;
    pollIv = setInterval(async () => { try { const fresh = await req('GET', ''); if (fresh) { tree = fresh; onTree(); } } catch (e) { } }, ms);
  }
  function stopListen() { if (es) { es.close(); es = null; } if (pollIv) { clearInterval(pollIv); pollIv = null; } }

  function onTree() {
    if (!tree) {
      if (started) { modal('<h2>Room closed</h2><p class="mtext">The host left the game.</p><div class="mrow"><button class="btn" onclick="window.KaboomKittens.online.leave();closeModal()">Menu</button></div>'); }
      return;
    }
    if (!started) {
      const lp = $('#lobbyPlayers'); lp.innerHTML = '';
      const ps = tree.players || {};
      Object.keys(ps).filter(k => ps[k]).sort((a, b) => a - b).forEach(k => {
        lp.insertAdjacentHTML('beforeend', `<span class="chip ${+k === myPid ? 'sel' : ''}">${ps[k].name}${+k === 0 ? ' 👑' : ''}</span>`);
      });
      if (tree.status === 'playing' && tree.game) { applyRemoteGame(); const snap = getSnapshot(); if (snap.G) { submitAction({ type: 'startOnline', G: snap.G, viewPlayerId: myPid }); startedNow(); } return; }
      drainChat();
      const n = playerCountIn(tree);
      if (isHost && tree.startReq && n >= 2) { startGameAsHost(); return; }
      updateLobbyControls(n);
      return;
    }
    drainChat();
    if (isHost) {
      drainInbox();
      if (tree.rematchReq && getSnapshot().G?.phase === 'over') startGameAsHost();
      return;
    }
    applyRemoteGame();
  }

  function applyRemoteGame() {
    const g = tree.game;
    if (!g) return;
    if (g.pub != null) { if (g.pub <= lastPub) return; lastPub = g.pub; }
    else if (g.seq == null || g.seq <= lastSeq) return;
    lastSeq = g.seq;
    if (g.seats) { try { seats = JSON.parse(g.seats); rebuildSeatIndexMap(); } catch (e) {} }
    const viewPlayerId = seatIndex();
    const G = JSON.parse(g.s);
    G.players.forEach(p => { p.hand = p.hand || []; }); G.deck = G.deck || []; G.discard = G.discard || [];
    let evs = [];
    if (g.evSeq != null && g.evSeq > lastEvSeq) { lastEvSeq = g.evSeq; try { evs = JSON.parse(g.ev) || [] } catch (e) {} }
    if (started) { processEvents(evs); onlinePhaseUI(); }
  }

  async function pushSync(evs, extra) {
    const snap = getSnapshot();
    if (!snap.G) return;
    tree = tree || {}; tree.status = 'playing';
    tree.game = { s: JSON.stringify(snap.G), seq: snap.G.seq, pub: ++pub, seats: JSON.stringify(seats), ev: JSON.stringify(evs || []), evSeq: ++evSeq };
    saveSession();
    lastSeq = snap.G.seq; lastEvSeq = evSeq; lastPub = pub;
    try { await req('PATCH', '', Object.assign({ game: tree.game }, extra || {})); } catch (e) { logMsg('⚠️ Sync hiccup — retrying…'); setTimeout(() => pushSync([], {}), 1200); }
  }

  const seenInbox = {};
  async function drainInbox() {
    const ib = tree.inbox || {};
    for (const k of Object.keys(ib)) {
      if (seenInbox[k]) continue; seenInbox[k] = 1;
      const m = ib[k];
      req('DELETE', '/inbox/' + k).catch(() => {});
      if (m && m.action) hostApply(m.action);
    }
  }

  function hostApply(action) {
    const snap = getSnapshot();
    if (!snap.G) return;
    const ev = dispatch(snap.G, action);
    if (ev === null) return;
    if (snap.G.phase === 'nope') snap.G.nopeUntil = Date.now() + NOPE_MS; else delete snap.G.nopeUntil;
    pushSync(ev);
    processEvents(ev);
    onlinePhaseUI();
    hostPhaseDuties();
  }

  function hostPhaseDuties() {
    if (hostTimer) { clearTimeout(hostTimer); hostTimer = null; }
    const snap = getSnapshot();
    if (!snap.G || snap.G.phase !== 'nope') return;
    const last = snap.G.pending.nopes.length ? snap.G.pending.nopes[snap.G.pending.nopes.length - 1] : snap.G.pending.actor;
    const anyNoper = snap.G.players.some(p => p.alive && p.id !== last && p.hand.includes('NOPE'));
    hostTimer = setTimeout(() => hostApply({ a: 'closeNope' }), anyNoper ? NOPE_MS : 900);
  }

  function onlinePhaseUI() {
    const snap = getSnapshot();
    const G = snap.G;
    if (!G) return;
    const key = `${G.phase}|${G.seq < 0 ? 0 : ''}${G.phase === 'nope' ? G.pending.nopes.length : ''}`;
    if (key !== uiPhaseKey) { closePhaseModal(); uiPhaseKey = key; }
    if (G.phase === 'over') { stopNopeClock(); return; }
    if (G.phase !== 'nope') stopNopeClock();
    if (G.phase === 'nope') {
      const last = G.pending.nopes.length ? G.pending.nopes[G.pending.nopes.length - 1] : G.pending.actor;
      if (myPid !== last && G.players[myPid].alive && G.players[myPid].hand.includes('NOPE')) {
        modal(`<h2>Quick — Nope it?</h2><p class="mtext">${G.players[last].name} played ${G.pending.nopes.length ? 'a Nope' : CARDS[G.pending.cards[0]].name}${G.pending.target === myPid ? ' <b>on YOU</b>' : ''}.</p>
          ${npClockHTML}
          <div class="mrow"><button class="btn big boom" id="mNope">NOPE! ✋</button><button class="btn" id="mLet">Let it happen</button></div>`);
        startNopeClock(NOPE_MS);
        $('#mNope').onclick = () => { stopNopeClock(); closeModal(); send({ a: 'nope', pid: myPid }); };
        $('#mLet').onclick = () => { stopNopeClock(); closeModal(); };
      }
      return;
    }
    if (G.phase === 'defuse' && G.pendingBoom.pid === myPid) {
      const hasD = G.players[myPid].hand.includes('DEFUSE');
      modal(`<h2>💣 KABOOM KITTEN!</h2><div style="width:130px;margin:0 auto">${ART.BOOM()}</div>
        <p class="mtext">${hasD ? 'Stay paws-itive — you have a <b>Defuse</b>!' : 'You have <b>no Defuse</b>… what a cat-astrophe.'}</p>
        <div class="mrow">${hasD ? '<button class="btn big sun" id="mDef">✂️ Defuse it!</button>' : ''}<button class="btn ${hasD ? '' : 'big '}boom" id="mDie">💥 Explode</button></div>`);
      const d = $('#mDef'); if (d) d.onclick = () => { closeModal(); send({ a: 'defuse', pid: myPid, use: true }); };
      $('#mDie').onclick = () => { closeModal(); send({ a: 'defuse', pid: myPid, use: false }); };
      return;
    }
    if (G.phase === 'insert' && G.pendingBoom.pid === myPid) {
      openInsertPicker(G.deck.length, pos => send({ a: 'insert', pid: myPid, pos }));
      return;
    }
    if (G.phase === 'favorGive' && G.pendingFavor && G.pendingFavor.from === myPid) {
      const p = G.players[myPid];
      modal(`<h2>Favor for ${G.players[G.pendingFavor.to].name}</h2><p class="mtext">Choose one of your cards to give away. Sharing is purring.</p>
        <div class="cardpick">${p.hand.map((c, i) => `<div data-i="${i}">${cardHTML(c, 'mini')}</div>`).join('')}</div>`);
      $$('#modal [data-i]').forEach(d => d.onclick = () => { closeModal(); send({ a: 'give', pid: myPid, idx: +d.dataset.i }); });
    }
  }

  function inviteLink() {
    const u = new URL(window.location.href); u.hash = ''; u.searchParams.set('room', code);
    return u.toString();
  }

  function saveSession() {
    try { store.set('kk_room', JSON.stringify({ db, code, myPid, isHost, t: Date.now() })); } catch (e) {}
  }
  function clearSession() { store.set('kk_room', ''); }

  async function rejoin(s) {
    db = s.db; code = s.code; myPid = s.myPid; isHost = s.isHost;
    const room = await req('GET', '');
    if (!room) throw new Error('gone');
    tree = room;
    if (room.status === 'playing' && room.game) {
      const G = JSON.parse(room.game.s);
      if (room.game.seats) { try { seats = JSON.parse(room.game.seats); rebuildSeatIndexMap(); } catch (e) {} }
      lastSeq = room.game.seq; lastEvSeq = room.game.evSeq || 0; evSeq = room.game.evSeq || 0;
      pub = room.game.pub || 0; lastPub = pub;
      started = true; show('scr-table'); showChatUI(true); renderAll();
      logMsg('Reconnected — you\'re back at the table.');
      listen(); hostPhaseDuties(); onlinePhaseUI();
    } else {
      enterLobby();
    }
  }

  function pushChat(obj) {
    if (!db || !code) return;
    req('PUT', '/chat/' + Date.now() + '_' + rnd(4), obj).catch(() => logMsg('⚠️ Message didn\'t send.'));
  }
  function chat(text) { pushChat({ n: myName(), m: String(text).slice(0, 140), p: myPid }); }
  function react(emo) { pushChat({ n: myName(), r: String(emo).slice(0, 4), p: myPid }); }

  function drainChat() {
    const c = tree && tree.chat;
    if (!c) { chatPrimed = true; return; }
    const keys = Object.keys(c).sort();
    keys.forEach(k => {
      if (seenChat[k]) return;
      seenChat[k] = 1;
      if (!chatPrimed) return;
      const m = c[k]; if (!m) return;
      if (m.r) floatReaction(m.n || 'Someone', m.r, m.p);
      else if (m.m) { addChatLine(m.n || 'Someone', m.m, m.p === myPid); if (m.p !== myPid) sChat(); }
    });
    chatPrimed = true;
    if (isHost && keys.length > 60) keys.slice(0, keys.length - 40).forEach(k => req('DELETE', '/chat/' + k).catch(() => {}));
  }

  function send(action) {
    if (isHost) hostApply(action);
    else req('PUT', '/inbox/' + Date.now() + '_' + rnd(4), { pid: myPid, action }).catch(() => logMsg('⚠️ Couldn\'t reach the room — check your internet.'));
  }

  function leave() {
    stopListen();
    if (isHost && db && code) req('DELETE', '').catch(() => {});
    clearSession();
    if (hostTimer) clearTimeout(hostTimer);
    started = false; tree = null; chatPrimed = false;
    showChatUI(false); $('#chatLog').innerHTML = '';
  }

  function restart() {
    if (!isHost) {
      req('PATCH', '', { rematchReq: Date.now() })
        .then(() => logMsg('Asked the host for another round…'))
        .catch(() => logMsg('⚠️ Couldn\'t reach the room.'));
      return 'asked';
    }
    startGameAsHost();
    return 'dealt';
  }

  function openInvite() {
    const wanted = (new URLSearchParams(window.location.search).get('room') || '').toUpperCase().slice(0, 4);
    if (!wanted) return;
    $('#btnOnline').click();
    $('#inpRoom').value = wanted;
    const saved = (store.get('kk_name') || '').trim();
    if (saved) {
      $('#inpNameOn').value = saved;
      setTimeout(() => { clearErr(); $('#btnJoinRoom').click(); }, 250);
    } else {
      $('#inpNameOn').focus();
      err('Pop your name in and hit Join to enter room ' + wanted + '.');
      $('#onlineErr').style.borderColor = 'var(--sky)';
      $('#onlineErr').style.color = 'var(--ink-soft)';
    }
  }

  function quit() {
    if (!started) {
      if (!isHost && myPid != null) req('DELETE', '/players/' + myPid).catch(() => {});
      leave(); show('scr-title'); return;
    }
    if (isHost) {
      pushChat({ n: myName(), m: '(the host left — this room is closing)', p: myPid });
      setTimeout(() => { leave(); show('scr-title'); }, 350);
      return;
    }
    send({ a: 'leave', pid: myPid });
    setTimeout(() => {
      req('DELETE', '/players/' + myPid).catch(() => {});
      leave(); show('scr-title');
    }, 450);
  }

  function setDb(v) { db = v; }
  function setCode(v) { code = v; }
  function setMyPid(v) { myPid = v; }
  function setIsHost(v) { isHost = v; }
  function setTree(v) { tree = v; }
  function setStarted(v) { started = v; }

  return { send, leave, restart, chat, react, saveSession, clearSession, rejoin, quit, openInvite, setDb, setCode, setMyPid, setIsHost, setTree, setStarted };
}