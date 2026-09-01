'use strict';

/**
 * @param {Document} document
 * @returns {{
 *   dealAnimation: (done: () => void, G: any) => void,
 *   rectOf: (el: Element) => DOMRect,
 *   flyCard: (html: string, from: DOMRect, to: DOMRect, dur?: number) => void,
 *   fxPlay: (pid: number, type: string, G: any, VIEW: number, rectOf: (el: Element) => DOMRect, flyCard: (html: string, from: DOMRect, to: DOMRect, dur?: number) => void, audio: any) => void,
 *   fxDraw: (pid: number, G: any, VIEW: number, rectOf: (el: Element) => DOMRect, flyCard: (html: string, from: DOMRect, to: DOMRect, dur?: number) => void, audio: any) => void,
 *   fxNope: (audio: any) => void,
 *   fxBoom: (audio: any) => void,
 *   fxConfetti: () => void,
 *   flash: (msg: string) => void,
 * }}
 */
export function createEffectsModule(document) {
  let flashT = null;

  function rectOf(el) {
    const r = el.getBoundingClientRect();
    return r;
  }

  function flyCard(html, from, to, dur = 500) {
    const f = document.createElement('div');
    f.className = 'fly';
    f.innerHTML = html;
    const c = f.firstElementChild;
    Object.assign(f.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
    if (c) { c.style.width = '100%'; c.style.height = '100%'; }
    document.body.appendChild(f);
    requestAnimationFrame(() => Object.assign(f.style, { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px', transitionDuration: dur + 'ms' }));
    setTimeout(() => f.remove(), dur + 80);
  }

  function dealAnimation(done, G) {
    const dp = document.querySelector('#deckPile');
    if (!dp || !G) { done && done(); return; }
    const from = rectOf(dp);
    let n = 0;
    G.players.forEach(p => {
      const seat = document.querySelector('#opp' + p.id);
      if (!seat) return;
      const to = rectOf(seat);
      for (let k = 0; k < 3; k++) {
        const d = (n++) * 85;
        setTimeout(() => {
          const cardBackHtml = `<div class="card back"><div class="inner"><div><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="56" r="17" fill="#ffc53d"/><ellipse cx="32" cy="34" rx="7" ry="9" fill="#ffc53d" transform="rotate(-16 32 34)"/><ellipse cx="50" cy="28" rx="7" ry="9" fill="#ffc53d"/><ellipse cx="68" cy="34" rx="7" ry="9" fill="#ffc53d" transform="rotate(16 68 34)"/></svg><div class="backpaw">KABOOM<br>KITTENS</div></div></div></div>`;
          flyCard(cardBackHtml, from, to, 430);
          // tone is called via audio service in actual usage
        }, d);
      }
    });
    setTimeout(() => done && done(), n * 85 + 460);
  }

  function fxPlay(pid, type, G, VIEW, rectOf, flyCard, audio) {
    const from = pid === VIEW ? (rectOf(document.querySelector('#hand')) || rectOf(document.querySelector('#discardPile'))) : (document.querySelector('#opp' + pid) ? rectOf(document.querySelector('#opp' + pid)) : rectOf(document.querySelector('#deckPile')));
    const cardHtml = `<div class="card" data-type="${type}" style="--cc:#ffc53d;--ct:#ffd9cf"><div class="inner"><div class="cname">${type}</div><div class="art"></div><div class="cdesc"></div></div></div>`;
    flyCard(cardHtml, from, rectOf(document.querySelector('#discardPile')), 500);
    audio.playCardSound(type);
  }

  function fxDraw(pid, G, VIEW, rectOf, flyCard, audio) {
    const to = pid === VIEW ? rectOf(document.querySelector('#hand')) : (document.querySelector('#opp' + pid) ? rectOf(document.querySelector('#opp' + pid)) : rectOf(document.querySelector('#hand')));
    const cardBackHtml = `<div class="card back"><div class="inner"><div><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="56" r="17" fill="#ffc53d"/><ellipse cx="32" cy="34" rx="7" ry="9" fill="#ffc53d" transform="rotate(-16 32 34)"/><ellipse cx="50" cy="28" rx="7" ry="9" fill="#ffc53d"/><ellipse cx="68" cy="34" rx="7" ry="9" fill="#ffc53d" transform="rotate(16 68 34)"/></svg><div class="backpaw">KABOOM<br>KITTENS</div></div></div></div>`;
    flyCard(cardBackHtml, rectOf(document.querySelector('#deckPile')), to);
    audio.sSwish();
  }

  function fxNope(audio) {
    const s = document.createElement('div');
    s.className = 'nopeStamp';
    s.textContent = 'NOPE!';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 850);
    audio.sNope();
  }

  function fxBoom(audio) {
    const f = document.createElement('div');
    f.className = 'boomFlash';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 950);
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 550);
    audio.sBoom();
  }

  function fxConfetti() {
    const cols = ['#ffc53d', '#ff5233', '#3fb0d8', '#ff8fb5', '#58b368', '#fff6e8'];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = cols[i % 6];
      c.style.transform = `rotate(${Math.random() * 360}deg)`;
      document.body.appendChild(c);
      const fall = c.animate([{ transform: c.style.transform, top: '-20px' }, { transform: `rotate(${Math.random() * 720}deg)`, top: '105vh' }], { duration: 1800 + Math.random() * 2200, delay: Math.random() * 700, easing: 'ease-in' });
      fall.onfinish = () => c.remove();
    }
  }

  function flash(msg) {
    const el = document.querySelector('#handInfo');
    if (!el) return;
    el.textContent = msg;
    el.style.color = 'var(--sun)';
    clearTimeout(flashT);
    flashT = setTimeout(() => { el.style.color = ''; }, 3200);
  }

  return { dealAnimation, rectOf, flyCard, fxPlay, fxDraw, fxNope, fxBoom, fxConfetti, flash };
}