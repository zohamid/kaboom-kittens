'use strict';

import { escapeHtml } from '../services/dom.js';

/**
 * @param {Document} document
 * @returns {{
 *   setupChatUI: (deps: any) => void,
 *   sendChat: (deps: any) => void,
 *   renderChatBadge: (chatUnread: number) => void,
 *   showChatUI: (on: boolean) => void,
 *   addChatLine: (name: string, text: string, mine: boolean) => void,
 *   floatReaction: (name: string, emo: string, pid: number | null, pColor: (pid: number) => string) => void,
 * }}
 */
export function createChatModule(document) {
  const $ = q => document.querySelector(q);
  const $$ = q => [...document.querySelectorAll(q)];
  let chatUnread = 0;
  const REACTS = ['😹', '😱', '😾', '👏', '🔥', '💣', '🙀', '😼'];

  function setupChatUI(deps) {
    const { getOnlineClient, audio, renderHand } = deps;
    const bar = $('#reactBar');
    bar.innerHTML = REACTS.map(r => `<button data-r="${r}">${r}</button>`).join('');
    $$('#reactBar button').forEach(b => b.onclick = () => {
      getOnlineClient().react(b.dataset.r);
      bar.classList.remove('open');
    });
    $('#reactToggle').onclick = () => { bar.classList.toggle('open'); $('#reactToggle').classList.remove('hintme'); };
    $('#btnKittens').onclick = () => {
      const nextPrefs = deps.toggleShowKittens();
      deps.SHOW_KITTENS = nextPrefs.showKittens;
      $('#btnKittens').classList.toggle('off', !deps.SHOW_KITTENS);
      deps.flash(deps.SHOW_KITTENS ? 'Showing kittens left in the deck' : 'Kitten counter hidden — count them yourself 😼');
      audio.sPop();
      if (deps.G) deps.renderPiles();
    };
    $('#btnKittens').classList.toggle('off', !deps.SHOW_KITTENS);
    $('#btnSort').onclick = () => {
      const nextPrefs = deps.toggleHandSort();
      deps.SORT_HAND = nextPrefs.handSorted;
      $('#btnSort').textContent = deps.SORT_HAND ? '⇅' : '🔀';
      deps.flash(deps.SORT_HAND ? 'Hand sorted by type' : 'Hand in the order you drew it');
      audio.sPop();
      deps.renderHand();
    };
    $('#btnSort').textContent = deps.SORT_HAND ? '⇅' : '🔀';
    $('#btnChat').onclick = () => {
      const p = $('#chatPanel');
      p.classList.toggle('on');
      if (p.classList.contains('on')) {
        chatUnread = 0;
        renderChatBadge(chatUnread);
        $('#chatInput').focus();
        const l = $('#chatLog');
        requestAnimationFrame(() => { l.scrollTop = l.scrollHeight; });
      }
    };
    $('#chatClose').onclick = () => $('#chatPanel').classList.remove('on');
    $('#chatSend').onclick = () => sendChat(deps);
    $('#chatInput').onkeydown = ev => { if (ev.key === 'Enter') sendChat(deps); };
  }

  function sendChat(deps) {
    const i = $('#chatInput');
    const t = i.value.trim();
    if (!t) return;
    i.value = '';
    deps.getOnlineClient().chat(t);
  }

  function renderChatBadge(unread) {
    const b = $('#btnChat');
    if (!b) return;
    b.innerHTML = unread ? `💬<span class="dot">${unread}</span>` : '💬';
  }

  function showChatUI(on) {
    $('#btnChat').style.display = on ? '' : 'none';
    $('#reactWrap').classList.toggle('on', !!on);
    if (on) {
      const t = $('#reactToggle');
      t.classList.remove('hintme');
      void t.offsetWidth;
      t.classList.add('hintme');
    } else {
      $('#chatPanel').classList.remove('on');
      $('#reactBar').classList.remove('open');
    }
  }

  function addChatLine(name, text, mine) {
    const log = $('#chatLog');
    if (!log) return;
    const d = document.createElement('div');
    d.className = 'msg' + (mine ? ' mine' : '');
    const b = document.createElement('b');
    b.textContent = name + ': ';
    d.appendChild(b);
    d.appendChild(document.createTextNode(text));
    log.appendChild(d);
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
    while (log.children.length > 80) log.removeChild(log.firstChild);
    if (!$('#chatPanel').classList.contains('on')) {
      chatUnread++;
      renderChatBadge(chatUnread);
    }
  }

  function floatReaction(name, emo, pid, pColor) {
    const col = pid != null ? pColor(pid) : '#ffc53d';
    const d = document.createElement('div');
    d.className = 'reactFloat';
    d.style.setProperty('--c', col);
    const face = document.createElement('div');
    face.textContent = emo;
    d.appendChild(face);
    const s = document.createElement('span');
    s.textContent = name;
    d.appendChild(s);
    const fromRail = window.innerWidth > 620;
    if (fromRail) d.style.right = '74px';
    else d.style.left = (15 + Math.random() * 55) + 'vw';
    d.style.bottom = (28 + Math.random() * 14) + 'vh';
    document.body.appendChild(d);
    const an = d.animate([{ transform: 'translateY(20px) scale(.4) rotate(-12deg)', opacity: 0 },
    { transform: 'translateY(-16px) scale(1.25) rotate(4deg)', opacity: 1, offset: .2 },
    { transform: 'translateY(-40px) scale(1.05) rotate(-2deg)', opacity: 1, offset: .55 },
    { transform: 'translateY(-170px) scale(.9)', opacity: 0 }],
    { duration: 2400, easing: 'cubic-bezier(.2,.75,.3,1)' });
    an.onfinish = () => d.remove();
    burstAt(d.getBoundingClientRect(), col);
  }

  function burstAt(r, col) {
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div');
      p.style.cssText = 'position:fixed;z-index:92;width:8px;height:10px;pointer-events:none;border-radius:2px;background:' + col;
      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      document.body.appendChild(p);
      const ang = Math.random() * Math.PI * 2, dist = 40 + Math.random() * 70;
      const a = p.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(${Math.cos(ang) * dist - 50}%,${Math.sin(ang) * dist + 60}%) rotate(${Math.random() * 540}deg) scale(.4)`, opacity: 0 }],
      { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.1,.7,.3,1)' });
      a.onfinish = () => p.remove();
    }
  }

  return { setupChatUI, sendChat, renderChatBadge, showChatUI, addChatLine, floatReaction };
}