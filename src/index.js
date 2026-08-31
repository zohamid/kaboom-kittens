'use strict';

import { CARDS, CAT_TYPES, CAT_TYPE_INDEX, newGame, dispatch, classifyPlay, playNeedsTarget } from './game-engine.js';
import { ART, CARD_BACK_ART, HERO_ART, catHead, svgWrap } from './art.js';
import { createOnlineClient } from './online.js';

/**
 * @typedef {'bots'|'hot'|'online'} GameMode
 * @typedef {import('./game-engine.js').GameState} GameState
 * @typedef {import('./game-engine.js').GameAction} GameAction
 * @typedef {import('./game-engine.js').GameEvent} GameEvent
 * @typedef {import('./game-engine.js').CardType} CardType
 * @typedef {import('./game-engine.js').Player} Player
 * @typedef {import('./game-engine.js').CardDef} CardDef
 * @typedef {Record<CardType, CardDef>} CardsRecord
 */

/* ============================================================================
   UI LAYER — everything the player sees, hears and clicks.

   Owns: screen switching, the oval table, the card fan, modals, the synthesised
   sound kit, animations, the bot brain, and the pass-and-play hot seat.

   Key globals:
     MODE   'bots' | 'hot' | 'online'
     G      the current game state (from the engine)
     VIEW   which player this screen belongs to. In pass-and-play it changes as
            the device is handed over; online it is fixed to your own seat. The
            table is always drawn with VIEW seated at the bottom.

   act() is the single entry point for a move: locally it calls the engine
   directly, online it hands the action to OL to route through the host.
   ============================================================================ */
/**
 * @type {GameMode|null}
 */
let MODE=null;
/**
 * @type {GameState|null}
 */
let G=null;
/**
 * @type {number}
 */
let VIEW=0;
/**
 * @type {boolean}
 */
let HIDE_HAND=false;
/**
 * @type {number[]}
 */
let selected=[];
/**
 * @type {boolean}
 */
let SND=true;
/**
 * @type {Record<number, {cards: CardType[], deckAt: number}>}
 */
let BOT_PEEK={};
/**
 * @type {number|null}
 */
let NOPE_TIMER=null;
/**
 * @type {boolean}
 */
let NUDGE=false;
const $=q=>document.querySelector(q), $$=q=>[...document.querySelectorAll(q)];
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
SND = store.get('kk_snd')!=='0';

/* ---------- online client ---------- */
let onlineClient = null;

function createOnlineClientInstance() {
  if (onlineClient) return onlineClient;

  const deps = {
    document,
    window,
    fetch: window.fetch.bind(window),
    EventSource: window.EventSource,
    localStorage,
    dispatch,
    newGame,
    CARDS,
    ART,
    NOPE_MS: 6000,
    show,
    modal,
    closeModal,
    closePhaseModal,
    renderAll,
    logMsg,
    processEvents,
    startNopeClock,
    stopNopeClock,
    npClockHTML: '<div class="npClock"><div class="bar"><i></i></div><div class="secs"></div></div>',
    openInsertPicker,
    cardHTML,
    floatReaction,
    addChatLine,
    sChat: () => { tone(1320,.06,'sine',.1); tone(1760,.08,'sine',.08,.06); },
    showChatUI,
    getSnapshot: () => ({ G, MODE, VIEW }),
    submitAction: (action) => {
      if (MODE === 'online') {
        onlineClient.send(action);
      } else {
        const ev = dispatchLocal(action);
        if (ev) processEvents(ev);
        afterChange();
      }
    },
  };

  onlineClient = createOnlineClient(deps);
  return onlineClient;
}

/* Initialize online client after DOM is ready */
function initOnlineClient() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createOnlineClientInstance);
  } else {
    createOnlineClientInstance();
  }
}
initOnlineClient();

/* Helper to get online client, initializing if needed */
function getOnlineClient() {
  if (!onlineClient) createOnlineClientInstance();
  return onlineClient;
}

/* ---------- tiny synth ---------- */
/* Browsers create the AudioContext in a SUSPENDED state and only allow it to
   start inside a real user gesture. Without this unlock, every sound silently
   does nothing — which is exactly what happened before. We resume on the first
   pointer/key/touch event and keep trying until it takes. */
let AC=null;
function ac(){
  if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}
  if(AC&&AC.state==='suspended')AC.resume().catch(()=>{});
  return AC;
}
function unlockAudio(){
  const c=ac();
  if(c&&c.state!=='running')return;                 // try again on the next gesture
  ['pointerdown','keydown','touchstart'].forEach(ev=>document.removeEventListener(ev,unlockAudio,true));
}
['pointerdown','keydown','touchstart'].forEach(ev=>document.addEventListener(ev,unlockAudio,true));
/* One oscillator beep. f=Hz, slide bends the pitch over the note's life.
   Everything you hear in this game is built from tone() and noise(). */
function tone(f,dur,type='square',vol=.16,when=0,slide=0){
  if(!SND)return; const c=ac(); if(!c)return;
  const t=c.currentTime+when, o=c.createOscillator(), g=c.createGain();
  o.type=type; o.frequency.setValueAtTime(f,t);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),t+dur);
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+dur+.02);
}
const sPop=()=>tone(520,.09,'square',.14,0,220);
const sSwish=()=>tone(880,.12,'sine',.1,0,-500);
const sNope=()=>{tone(300,.1,'sawtooth',.16);tone(180,.16,'sawtooth',.16,.09);};
const sUhoh=()=>{tone(392,.14,'triangle',.18);tone(311,.24,'triangle',.18,.16);};
const sBoom=()=>{if(!SND)return;const c=ac();if(!c)return;const t=c.currentTime,b=c.createBuffer(1,c.sampleRate*.6,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);const s=c.createBufferSource(),g=c.createGain();s.buffer=b;g.gain.setValueAtTime(.5,t);g.gain.exponentialRampToValueAtTime(.001,t+.6);s.connect(g);g.connect(c.destination);s.start(t);tone(70,.5,'sine',.3,0,-40);};
const sWin=()=>{[523,659,784,1047].forEach((f,i)=>tone(f,.18,'triangle',.16,i*.13));};
const sDefuse=()=>{tone(700,.06,'square',.14);tone(1000,.09,'square',.14,.07);};
/* noise burst with a filter — crunches, sizzles, whooshes, growls */
function noise(dur,vol,type,freq,when=0,q=1){
  if(!SND)return; const c=ac(); if(!c)return;
  const t=c.currentTime+when, n=Math.max(1,Math.floor(c.sampleRate*dur));
  const buf=c.createBuffer(1,n,c.sampleRate), d=buf.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,1.4);
  const src=c.createBufferSource(); src.buffer=buf;
  const f=c.createBiquadFilter(); f.type=type; f.frequency.value=freq; f.Q.value=q;
  const g=c.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
  src.connect(f); f.connect(g); g.connect(c.destination); src.start(t); src.stop(t+dur);
}
const melody=(notes,step=.11,type='triangle',vol=.15,dur=.13)=>notes.forEach((f,i)=>{if(f)tone(f,dur,type,vol,i*step);});
const N={C:523,D:587,E:659,F:698,G:784,A:880,B:988,C2:1047,G_:392,E_:330,A_:440};

/* every card gets its own silly voice */
const CARD_SOUND={
  ATTACK: ()=>{tone(90,.16,'sawtooth',.3,0,-40); noise(.14,.34,'lowpass',900,.02); tone(660,.08,'square',.16,.13);},
  SKIP:   ()=>{noise(.3,.18,'highpass',1400,0); tone(1200,.22,'sine',.12,0,-800);},
  FAVOR:  ()=>{tone(430,.3,'sine',.16,0,260); tone(560,.22,'sine',.12,.16,180);},
  SHUFFLE:()=>{for(let i=0;i<11;i++)noise(.035,.16,'bandpass',1500+i*130,i*.032,3);},
  FUTURE: ()=>{melody([N.C,N.E,N.G,N.C2,N.B],.075,'sine',.13,.16); tone(1760,.5,'sine',.05,.2);},
  NOPE:   ()=>{tone(300,.1,'sawtooth',.18);tone(180,.18,'sawtooth',.18,.09);},
  DEFUSE: ()=>{tone(760,.05,'square',.15);tone(1080,.07,'square',.15,.06);noise(.12,.1,'highpass',3000,.02);},
  /* --- the cats --- */
  CAT_SAMOSA: ()=>{noise(.09,.4,'bandpass',2600,0,1.6);noise(.07,.3,'bandpass',3400,.09,1.6);noise(.06,.22,'bandpass',2100,.16,1.6);},
  CAT_DISCO:  ()=>{melody([N.A_,N.C,N.E,N.A],.085,'sawtooth',.11,.1);
                   [0,.085,.17,.255].forEach(t=>noise(.03,.13,'highpass',7000,t));
                   tone(110,.1,'sine',.24,0);tone(110,.1,'sine',.24,.17);},
  CAT_PICKLE: ()=>{tone(180,.16,'sine',.2,0,520);tone(700,.14,'sine',.16,.14,-480);noise(.06,.12,'bandpass',900,.26,2);},
  CAT_MELON:  ()=>{melody([N.G,N.G,N.A,N.G,N.C2,N.B],.115,'triangle',.15,.14);},   /* nursery-rhyme sing-song */
  CAT_TACHE:  ()=>{tone(70,.34,'sawtooth',.26,0,26); noise(.3,.16,'lowpass',420,0,.7);   /* grrrr */
                   tone(520,.14,'sine',.13,.3,420);},                                    /* …and a twirl */
  CAT_JALEBI: ()=>{noise(.26,.2,'highpass',5200,0);                                      /* sizzle */
                   melody([N.E,N.G,N.C2,N.E*2],.07,'sine',.12,.12);},
  CAT_LUNGI:  ()=>{noise(.22,.2,'bandpass',700,0,.8);                                    /* fabric flap */
                   tone(120,.13,'sine',.28,.06);tone(95,.16,'sine',.26,.2);tone(150,.1,'sine',.2,.34);}, /* dhol */
  CAT_CHAI:  ()=>{noise(.34,.17,'bandpass',1100,0,.9);          /* pour */
                  tone(1500,.05,'sine',.1,.3);tone(2100,.06,'sine',.09,.36);   /* spoon clink */
                  noise(.16,.13,'lowpass',600,.44);},                           /* slurp */
  CAT_RICKSHAW:()=>{[0,.16].forEach(t=>{tone(1980,.13,'sine',.13,t);tone(2640,.11,'sine',.1,t+.02);}); /* tring tring */
                    noise(.2,.09,'bandpass',2800,.3,4);},                        /* wheel squeak */
  CAT_UNCLE: ()=>{tone(392,.15,'square',.2,0);tone(330,.19,'square',.2,.15);     /* pom-pom horn */
                  for(let i=0;i<6;i++)noise(.05,.13,'lowpass',260,.34+i*.055);}, /* engine putter */
};
/* --- action & moment sounds --- */
const sDeal=()=>{for(let i=0;i<7;i++)noise(.05,.16,'bandpass',1200+i*90,i*.07,3);};
const sYourTurn=()=>{tone(660,.1,'sine',.13);tone(880,.15,'sine',.13,.1);tone(1180,.18,'sine',.1,.22);};
const sTheirTurn=()=>tone(430,.09,'sine',.06);
const sAttacked=()=>{tone(160,.14,'sawtooth',.26,0,-60);tone(120,.2,'sawtooth',.24,.13,-40);noise(.22,.2,'lowpass',700,.02);};
const sJoin=()=>{tone(523,.1,'triangle',.13);tone(784,.14,'triangle',.13,.1);};
const sChat=()=>{tone(1320,.06,'sine',.1);tone(1760,.08,'sine',.08,.06);};
const sLose=()=>{[440,392,330,262].forEach((f,i)=>tone(f,.22,'triangle',.16,i*.16));};
const sSteal=()=>{tone(880,.07,'triangle',.13,0,-260);tone(1180,.06,'triangle',.11,.07);noise(.08,.1,'highpass',4000,.02);};
function playCardSound(t){const f=CARD_SOUND[t];if(f)f();else sPop();}

/* ---------- screens ---------- */
/* Switch screens. Exactly one .screen carries .on at a time. */
function show(id){
  $$('.screen').forEach(s=>s.classList.remove('on'));$('#'+id).classList.add('on');
  $('#sideRail').style.display=(id==='scr-table')?'flex':'none';   // rail only at the table
}
$('#heroArt').innerHTML=HERO_ART();
$('#curtainArt').innerHTML=svgWrap(catHead(50,54,30,'#ffc53d','happy'));
$$('.backBtn').forEach(b=>b.onclick=()=>{show('scr-title')});
$('#btnHelp').onclick=()=>{renderHelp();show('scr-help')};
$('#btnMute').onclick=()=>{SND=!SND;store.set('kk_snd',SND?'1':'0');$('#btnMute').textContent=SND?'🔊':'🔇';
};
$('#btnMute').textContent=SND?'🔊':'🔇';

/* Fill the rules screen with generated card art (runs once). */
function renderHelp(){
  const el=$('#ruleCards'); if(el.dataset.done)return; el.dataset.done=1;
  ['BOOM','DEFUSE','ATTACK','SKIP','FAVOR','SHUFFLE','FUTURE','NOPE'].forEach(t=>{
    el.insertAdjacentHTML('beforeend',`<div class="rule"><div class="mini">${ART[t]()}</div><div><b style="color:${CARDS[t].color}">${CARDS[t].name}</b><p>${CARDS[t].desc}</p></div></div>`);
  });
  $('#rc-pair').innerHTML=ART.CAT_SAMOSA(); $('#rc-trip').innerHTML=ART.CAT_DISCO(); $('#rc-five').innerHTML=ART.CAT_MELON();
  const zoo=$('#catZoo');
  if(zoo)zoo.innerHTML=CAT_TYPES.map(t=>`<div style="text-align:center"><div style="width:74px">${ART[t]()}</div>
    <div style="font-family:var(--display);font-size:13px;letter-spacing:.03em">${CARDS[t].name}</div></div>`).join('');
}

/* ---------- setup screens ---------- */
let setupMode='bots', playerCount=3;
$('#btnBots').onclick=()=>{setupMode='bots';openSetup()};
$('#btnHotseat').onclick=()=>{setupMode='hot';openSetup()};
/* The bots / pass-and-play setup screen. */
function openSetup(){
  $('#setupTitle').textContent=setupMode==='bots'?'You vs the Bots':'Pass & Play';
  $('#cntLabel').textContent=setupMode==='bots'?'How many bots?':'How many players?';
  const chips=$('#cntChips'); chips.innerHTML='';
  const opts=setupMode==='bots'?[1,2,3,4]:[2,3,4,5];
  opts.forEach(n=>{
    const c=document.createElement('button');c.className='chip'+(n===playerCountFor()?' sel':'');c.textContent=n;
    c.onclick=()=>{playerCount=setupMode==='bots'?n+1:n;openSetup();};
    chips.appendChild(c);
  });
  function playerCountFor(){return setupMode==='bots'?playerCount-1:playerCount;}
  if(playerCount<2||playerCount>5)playerCount=3;
  const hn=$('#hotNames'); hn.innerHTML='';
  if(setupMode==='hot'){
    for(let i=1;i<playerCount;i++)
      hn.insertAdjacentHTML('beforeend',`<div class="field"><label>Player ${i+1}</label><input type="text" maxlength="14" class="hotName" value="Player ${i+1}"></div>`);
  }
  show('scr-setup');
}
const BOT_NAMES=['Biscuit 🤖','Mochi 🤖','Floof 🤖','Pretzel 🤖'];
$('#btnStartLocal').onclick=()=>{
  const me=($('#inpName').value.trim()||'You');
  let defs;
  if(setupMode==='bots'){
    defs=[{name:me}].concat(BOT_NAMES.slice(0,playerCount-1).map(n=>({name:n,bot:true})));
    MODE='bots'; VIEW=0;
  }else{
    defs=[{name:me}].concat($$('.hotName').map(i=>({name:i.value.trim()||'Player'})));
    defs=defs.slice(0,playerCount);
    MODE='hot'; VIEW=0;
  }
  startLocalGame(defs);
};
/* Deal a local game (bots or hot seat) and show the table. */
function startLocalGame(defs){
  G=newGame(defs); BOT_PEEK={}; selected=[]; HIDE_HAND=false;
  showChatUI(false);
  show('scr-table');
  announce('NEW ROUND!');sDeal();
  dealAnimation(()=>logMsg('Cards dealt. Good luck! 🐱'));
  setTimeout(()=>logMsg('Today\'s cats: '+G.cats.map(c=>CARDS[c].name).join(', ')),2200);
  renderAll();
  if(MODE==='hot')curtainFor(G.turn,()=>{VIEW=G.turn;renderAll();});
  afterChange();
}

/* ---------- generic modal ---------- */
/* Show a popup. kind='phase' popups are auto-closed when the game moves on;
   kind='info' ones stay until the player dismisses them. */
function modal(html,kind){$('#modal').innerHTML=html;$('#modalBg').dataset.kind=kind||'phase';$('#modalBg').classList.add('on');}
/* only auto-dismiss prompts the game itself opened — never an info popup the player is still reading */
function closePhaseModal(){if($('#modalBg').dataset.kind!=='info')closeModal();}
function closeModal(){$('#modalBg').classList.remove('on');}
/* Pass-and-play privacy screen: hide the hand until the next player is ready. */
function curtainFor(pid,cb){
  HIDE_HAND=true;renderHand();
  $('#curtainTitle').textContent=`Pass to ${G.players[pid].name}`;
  $('#curtainText').textContent='Paws off — no peeking at other hands! 😾';
  $('#curtain').classList.add('on');
  $('#curtainBtn').onclick=()=>{$('#curtain').classList.remove('on');HIDE_HAND=false;cb&&cb();};
}

/* ---------- rendering ---------- */
/* One card face: name, art, description, coloured to its type. */
function cardHTML(t,cls=''){
  const c=CARDS[t];
  return `<div class="card ${cls}" data-type="${t}" style="--cc:${c.color};--ct:${c.tint}">
    <div class="inner"><div class="cname">${c.name}</div><div class="art">${ART[t]()}</div><div class="cdesc">${c.desc}</div></div></div>`;
}
function cardBackHTML(cls=''){return `<div class="card back ${cls}"><div class="inner"><div>${CARD_BACK_ART()}<div class="backpaw">KABOOM<br>KITTENS</div></div></div></div>`;}
/* One colour per seat, reused everywhere that player appears: their chair, the
   dot on their log lines, their reactions and their chat messages. */
const AV_COLORS=['#ffc53d','#ff8fb5','#3fb0d8','#9b7ede','#58b368'];
const pColor=pid=>AV_COLORS[pid%AV_COLORS.length];
/* The little cat portrait on a player's chair, in that player's colour. */
function avatarSVG(pid,dead){return svgWrap(catHead(50,54,30,AV_COLORS[pid%5],dead?'zen':'happy'));}

/* Redraw everything: seats, piles, hand, banner. */
function renderAll(){
  renderOpps();renderPiles();renderHand();renderBanner();
  /* The collision pass has to run LAST: the hand and the piles change the
     height of the table, which moves every chair. Measuring before they are
     drawn solves yesterday's layout. */
  relaxSeats();
  requestAnimationFrame(relaxSeats);          // again once the browser has settled
}
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* Everyone gets a chair around the oval — you always sit at the bottom. */
function renderOpps(){
  const s=$('#seats'); if(!s)return;
  s.innerHTML='';
  const n=G.players.length;
  const narrow=window.innerWidth<620;
  /* Some viewports simply cannot hold a round table — a handset in landscape is
     only ~380px tall, and a 320px phone is narrower than five chairs. There we
     drop to a compact row of players above the piles: same information, no
     collisions, no shrinking things into illegibility. */
  const compact=isCompact();
  $('#seats').classList.toggle('compact',compact);
  const rx=narrow?46:50, ry=narrow?51:52;          // % of the oval — 50 sits on the rim
  G.players.forEach(p=>{
    const rel=(((p.id-VIEW)%n)+n)%n;               // 0 = me, then clockwise
    const deg=90+rel*(360/n), a=deg*Math.PI/180;   // 90deg = bottom of the table
    const me=p.id===VIEW, active=p.id===G.turn&&p.alive&&G.phase!=='over';
    const el=document.createElement('div');
    el.className='opp seat'+(active?' turn':'')+(p.alive?'':' dead')+(me?' mine':'');
    el.id='opp'+p.id;
    el.style.setProperty('--c',pColor(p.id));
    /* Remember the maths on the element so the collision pass below can move
       this chair along its own spoke without recomputing the whole table. */
    el.dataset.a=a; el.dataset.me=me?'1':'0';
    el.dataset.rx=rx; el.dataset.ry=me?ry*0.86:ry;
    el.innerHTML=
      (active?'<div class="turnpill">'+(me?'YOUR TURN':'PLAYING')+(G.turnsLeft>1?' ×'+G.turnsLeft:'')+'</div>':'')+
      '<div class="avatar">'+avatarSVG(p.id,!p.alive)+'</div>'+
      '<div class="nm">'+(me?'You':esc(p.name))+'</div>'+
      '<div class="cards">'+(p.alive?p.hand.length+' cards':'out')+'</div>'+
      (p.alive?'':'<div class="boomtag">💥</div>');
    if(!compact)placeSeat(el);                     // compact mode lets flexbox lay them out
    s.appendChild(el);
    if(active&&!compact){                           // an arrow on the felt pointing at them
      const ptr=document.createElement('div');
      ptr.className='turnPointer';
      ptr.style.setProperty('--c',pColor(p.id));
      ptr.style.left=(50+rx*0.66*Math.cos(a))+'%';
      ptr.style.top=(50+ry*0.66*Math.sin(a))+'%';
      ptr.style.transform='translate(-50%,-50%) rotate('+(deg+90)+'deg)';
      s.appendChild(ptr);
    }
  });
}
/* Position one chair from the angle + radii stored on it (dA nudges it around
   the ring, which buys the solver room on cramped screens). */
function placeSeat(el){
  const a=+el.dataset.a+(+el.dataset.da||0);
  el.style.left=(50+(+el.dataset.rx)*Math.cos(a))+'%';
  el.style.top =(50+(+el.dataset.ry)*Math.sin(a))+'%';
}
/* ---------- collision pass ----------
   Trigonometry alone can't promise a clean table: the oval's proportions, the
   player count, the phone's width and the length of a name all interact. So we
   place the chairs, then MEASURE. Any chair (including its turn pill) that
   lands on the piles, the banner, the log or the hand is slid along its own
   spoke until it finds clear air. Deterministic, and it holds for 2-5 players
   at any screen size. */
const isCompact=()=>window.innerHeight<520||window.innerWidth<340;
function relaxSeats(){
  if(isCompact())return;                           // flexbox already guarantees no overlap
  const hit=(a,b)=>!(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom);
  const area=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*
                    Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  const zones=['#centerPiles','.plabel','#topbar','#logbar','#handWrap']
    .flatMap(sel=>[...document.querySelectorAll(sel)])
    .map(e=>e.getBoundingClientRect())
    .filter(r=>r.width&&r.height);
  const W=window.innerWidth;
  /* a chair's true footprint includes the pill floating above it */
  const box=el=>{
    const r=el.getBoundingClientRect(), p=el.querySelector('.turnpill');
    if(!p)return r;
    const q=p.getBoundingClientRect();
    return {left:Math.min(r.left,q.left),right:Math.max(r.right,q.right),
            top:Math.min(r.top,q.top),bottom:Math.max(r.bottom,q.bottom)};
  };
  const cost=el=>{
    const r=box(el);
    let c=zones.reduce((s,z)=>s+area(r,z),0);
    if(r.left<2)c+=(2-r.left)*400;                 // never let a chair leave the screen
    if(r.right>W-2)c+=(r.right-(W-2))*400;
    return c;
  };
  const RAD=[0,3,6,9,12,15,18,-3,-6,-9];         // slide along the spoke
  const ANG=[0,.14,-.14,.28,-.28,.42,-.42];       // …and shuffle round the ring
  [...document.querySelectorAll('#seats .seat')].forEach(el=>{
    const rx0=+el.dataset.rx, ry0=+el.dataset.ry;
    const mine=el.dataset.me==='1';
    /* Two passes: normal size first, then a smaller chair as a last resort for
       genuinely cramped screens (a 320px phone, or landscape on a handset). */
    const search=()=>{
      let best={d:0,da:0}, bestCost=Infinity;
      outer:
      for(const da of (mine?[0,.1,-.1]:ANG)){      // your own chair stays put-ish
        for(const d of RAD){
          el.dataset.rx=rx0+d; el.dataset.ry=ry0+d; el.dataset.da=da;
          placeSeat(el);
          const c=cost(el);
          if(c<bestCost){bestCost=c;best={d,da};}
          if(c===0)break outer;                    // clear air: stop looking
        }
      }
      el.dataset.rx=rx0+best.d; el.dataset.ry=ry0+best.d; el.dataset.da=best.da;
      placeSeat(el);
      return bestCost;
    };
    el.classList.remove('tight');
    if(search()>0){ el.classList.add('tight'); if(search()>0)el.classList.remove('tight'); }
  });
}
/* Draw and discard piles, plus the deck counter and attack badge. */
function renderPiles(){
  const dp=$('#deckPile');
  dp.querySelectorAll('.card').forEach(e=>e.remove());
  if(G.deck.length)dp.insertAdjacentHTML('beforeend',cardBackHTML());
  const booms=G.deck.filter(c=>c==='BOOM').length;
  $('#deckCount').textContent=G.deck.length+' left'+(SHOW_KITTENS&&booms?' · 💣'+booms:'');
  dp.classList.toggle('mydraw',isMyTurn()&&G.phase==='turn');
  const dc=$('#discardPile');
  dc.querySelectorAll('.card').forEach(e=>e.remove());
  G.discard.slice(-3).forEach(t=>dc.insertAdjacentHTML('beforeend',cardHTML(t)));
  $('#discardCount').textContent=G.discard.length?G.discard.length:'empty';
  const ab=$('#attackBadge');
  if(G.turnsLeft>1&&G.phase!=='over'){ab.style.display='block';ab.textContent=`${G.players[G.turn].name}: ${G.turnsLeft} TURNS!`;}
  else ab.style.display='none';
  const deckTop=dp.querySelector('.card');
  if(deckTop)deckTop.onclick=()=>{if(isMyTurn()&&G.phase==='turn')act({a:'draw',pid:VIEW});};
}
/* Is the person looking at this screen allowed to act right now? */
function isMyTurn(){
  if(!G||G.phase==='over')return false;
  if(MODE==='online')return G.turn===VIEW&&!G.players[VIEW].bot;
  if(MODE==='bots')return G.turn===0;
  return G.turn===VIEW; // hot
}
function myHand(){return G.players[VIEW]?G.players[VIEW].hand:[];}

/* Cards are grouped so matching ones sit together and the important stuff is on
   the left. We only reorder the DISPLAY: the engine still addresses cards by
   their real index in the hand, so `selected` always stores real indices. */
const SORT_RANK={DEFUSE:0,NOPE:1,ATTACK:2,SKIP:3,FAVOR:4,SHUFFLE:5,FUTURE:6};
/** @type {Record<CardType, number>} */
const BOT_PREF_MAP=Object.fromEntries(
  ['CAT_SAMOSA','CAT_DISCO','CAT_PICKLE','CAT_MELON','CAT_TACHE','SHUFFLE','FAVOR','FUTURE','SKIP','ATTACK','NOPE','DEFUSE']
    .map((t,i)=>[t,i])
);
let SORT_HAND=store.get('kk_sort')!=='0';
/* Off by default: counting kittens is part of the game. The 💣 button on the
   side rail turns it on for anyone who'd rather see it. */
let SHOW_KITTENS=store.get('kk_bombs')==='1';
function handOrder(){
  const h=myHand(), idx=h.map((_,i)=>i);
  if(!SORT_HAND)return idx;
  const rank=t=>SORT_RANK[t]!==undefined?SORT_RANK[t]:10+(CAT_TYPE_INDEX[t]??CAT_TYPES.length);
  return idx.sort((a,b)=>rank(h[a])-rank(h[b])||h[a].localeCompare(h[b])||a-b);
}
let SPY=null;   // which player a ghost is currently peeking at
function renderHand(){
  const h=$('#hand'); h.innerHTML='';
  const ghost=G&&G.players[VIEW]&&!G.players[VIEW].alive;
  $('#spyBar').style.display=ghost?'flex':'none';
  if(ghost&&G.phase!=='over'){renderSpectator();return;}
  if(HIDE_HAND||!G||!G.players[VIEW]||!G.players[VIEW].alive){
    $('#btnPlaySel').style.display='none';$('#btnDraw').style.display='none';
    return;
  }
  handOrder().forEach(i=>{
    const t=myHand()[i];
    h.insertAdjacentHTML('beforeend',cardHTML(t,selected.includes(i)?'sel':''));
    const el=h.lastElementChild;
    el.onclick=()=>{toggleSel(i)};
  });
  updateHandButtons();
}
/* Once you've exploded you get the run of the table: pick any player and see
   their hand face-up. Defaults to whoever is currently playing. */
function renderSpectator(){
  $('#btnPlaySel').style.display='none';$('#btnDraw').style.display='none';
  const alive=G.players.filter(p=>p.alive);
  if(SPY==null||!G.players[SPY]||!G.players[SPY].alive)SPY=G.turn;
  const bar=$('#spyBar'); bar.innerHTML='';
  alive.forEach(p=>{
    const c=document.createElement('button');
    c.className='spyChip'+(p.id===SPY?' sel':'')+(p.id===G.turn?' playing':'');
    c.style.setProperty('--c',pColor(p.id));
    c.textContent=p.name+' ('+p.hand.length+')';
    c.onclick=()=>{SPY=p.id;sPop();renderHand();};
    bar.appendChild(c);
  });
  const h=$('#hand');
  const sp=G.players[SPY];
  $('#handInfo').innerHTML='👻 <b>Spectating</b> — you can see everyone\'s cards now';
  sp.hand.forEach(t=>h.insertAdjacentHTML('beforeend',cardHTML(t,'spy')));
  if(!sp.hand.length)h.innerHTML='<div style="color:var(--paper);opacity:.8">empty hand</div>';
}
function toggleSel(i){
  if(!isMyTurn()||G.phase!=='turn'){selected=[];renderHand();return;}
  const k=selected.indexOf(i);
  if(k>=0)selected.splice(k,1);
  else{
    selected.push(i);
    const c=CARDS[myHand()[i]];                    // spell the card out in full —
    if(c)flash(c.name+' — '+c.desc);               // guarantees legibility on a phone
  }
  renderHand();
}
/* Enable/label the Play and Draw buttons for the current selection. */
function updateHandButtons(){
  const play=$('#btnPlaySel'), draw=$('#btnDraw');
  const mine=isMyTurn()&&G.phase==='turn';
  draw.style.display=mine?'':'none';
  draw.classList.toggle('nudge',mine&&NUDGE);
  draw.textContent=mine&&NUDGE?'Draw to end your turn 👇':'Draw & end turn';
  draw.onclick=()=>act({a:'draw',pid:VIEW});
  const types=selected.map(i=>myHand()[i]);
  const cls=types.length?classifyPlay(types):null;
  if(mine&&cls){
    play.style.display='';
    play.textContent=cls.kind==='PAIR'?'Play pair: steal!':cls.kind==='TRIPLE'?'Play trio: demand!':cls.kind==='FIVE'?'Play 5: dig!':'Play '+CARDS[types[0]].name;
    play.onclick=()=>beginPlay(types,cls);
  }else play.style.display='none';
}
/* The status line at the top: whose turn, what the game is waiting for. */
function renderBanner(msg){
  const b=$('#banner');
  if(msg){b.innerHTML=msg;return;}
  if(!G)return;
  if(G.phase==='over'){b.innerHTML=`<span class="disp">${G.players[G.winner].name} WINS!</span>`;return;}
  const cp=G.players[G.turn];
  if(G.phase==='nope'){b.innerHTML=`⏳ Waiting for Nopes…`;return;}
  if(G.phase==='favorGive'){b.innerHTML=`${G.players[G.pendingFavor.from].name} is choosing a card to give…`;return;}
  if(G.phase==='defuse'||G.phase==='insert'){b.innerHTML=`💣 <span class="disp">${G.players[G.pendingBoom.pid].name}</span> drew a Kaboom Kitten!`;return;}
  if(isMyTurn())b.innerHTML=NUDGE
    ? `<span class="disp" style="color:var(--sun)">Now draw a card</span> to finish your turn 👇`
    : `<span class="disp">Your turn${G.turnsLeft>1?' ×'+G.turnsLeft:''}!</span> Play cards or draw to end your turn.`;
  else b.innerHTML=`<span class="disp">${cp.name}</span> is ${cp.bot?'plotting…':'playing…'}`;
}
/* Messages queue up and take turns — several events often land in the same
   instant. Each line is tagged with its player's colour so you can tell at a
   glance who it's about; turn changes render as a divider instead of a line. */
const logQ=[]; let logBusy=false;
function logMsg(msg,pid,kind){logQ.push({msg,pid,kind}); if(!logBusy){logBusy=true; pumpLog();}}
function pumpLog(){
  if(!logQ.length){logBusy=false;return;}
  const bar=$('#logbar');
  bar.querySelectorAll('.entry').forEach(old=>{
    old.style.opacity=0; old.style.transform='translateY(-16px)';
    setTimeout(()=>old.remove(),280);
  });
  const {msg,pid,kind}=logQ.shift();
  const e=document.createElement('div');
  e.className='entry'+(kind==='turn'?' turnline':'');
  const c=(pid!=null&&G&&G.players[pid])?pColor(pid):null;
  if(kind==='turn'&&c){
    e.style.setProperty('--c',c);
    e.innerHTML='<span class="tl"></span>';
    e.firstChild.textContent=(pid===VIEW?'Your turn':msg);
  }else{
    if(c){const d=document.createElement('span');d.className='dot';d.style.background=c;e.appendChild(d);}
    e.appendChild(document.createTextNode(msg));
    if(pid===VIEW)e.classList.add('mine');
  }
  e.style.transform='translateY(16px)'; e.style.opacity=0;
  bar.appendChild(e);
  requestAnimationFrame(()=>{e.style.transform='translateY(0)'; e.style.opacity=1;});
  setTimeout(pumpLog, logQ.length>3?460:kind==='turn'?900:1000);
}

/* ---------- fx ---------- */
/* A big centred shout for moments that deserve one ("NEW ROUND!"). */
function announce(text,ms){
  const box=$('#announce'); box.firstElementChild.textContent=text;
  box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
  setTimeout(()=>box.classList.remove('on'),ms||1900);
}
/* Cards visibly fly from the deck to every chair before a round begins. */
function dealAnimation(done){
  const dp=$('#deckPile'); if(!dp||!G){done&&done();return;}
  const from=rectOf(dp); let n=0;
  G.players.forEach(p=>{
    const seat=$('#opp'+p.id); if(!seat)return;
    const to=rectOf(seat);
    for(let k=0;k<3;k++){
      const d=(n++)*85;
      setTimeout(()=>{flyCard(cardBackHTML(),from,to,430);tone(760+Math.random()*260,.05,'sine',.07);},d);
    }
  });
  setTimeout(()=>done&&done(),n*85+460);
}
/* Screen position of an element, used to animate cards between places. */
function rectOf(el){const r=el.getBoundingClientRect();return r;}
/* Animate a card from one screen position to another. */
function flyCard(html,from,to,dur=500){
  const f=document.createElement('div');f.className='fly';f.innerHTML=html;
  const c=f.firstElementChild;
  Object.assign(f.style,{left:from.left+'px',top:from.top+'px',width:from.width+'px',height:from.height+'px'});
  if(c){c.style.width='100%';c.style.height='100%';}
  document.body.appendChild(f);
  requestAnimationFrame(()=>Object.assign(f.style,{left:to.left+'px',top:to.top+'px',width:to.width+'px',height:to.height+'px',transitionDuration:dur+'ms'}));
  setTimeout(()=>f.remove(),dur+80);
}
/* A card flies to the discard pile and plays its own sound. */
function fxPlay(pid,type){
  const from=pid===VIEW?rectOf($('#hand'))||rectOf($('#discardPile')):($('#opp'+pid)?rectOf($('#opp'+pid)):rectOf($('#deckPile')));
  flyCard(cardHTML(type),from,rectOf($('#discardPile')));playCardSound(type);
}
/* A face-down card flies from the deck to a player. */
function fxDraw(pid){
  const to=pid===VIEW?rectOf($('#hand')):($('#opp'+pid)?rectOf($('#opp'+pid)):rectOf($('#hand')));
  flyCard(cardBackHTML(),rectOf($('#deckPile')),to);sSwish();
}
function fxNope(){const s=document.createElement('div');s.className='nopeStamp';s.textContent='NOPE!';document.body.appendChild(s);setTimeout(()=>s.remove(),850);sNope();}
let flashT=null;
function flash(msg){
  const el=$('#handInfo'); if(!el)return;
  el.textContent=msg; el.style.color='var(--sun)';
  clearTimeout(flashT); flashT=setTimeout(()=>{el.style.color='';renderHand();},3200);
}
/* Full-screen flash, screen shake and a bang. */
function fxBoom(){
  const f=document.createElement('div');f.className='boomFlash';document.body.appendChild(f);setTimeout(()=>f.remove(),950);
  document.body.classList.add('shake');setTimeout(()=>document.body.classList.remove('shake'),550);sBoom();
}
/* Victory confetti. */
function fxConfetti(){
  const cols=['#ffc53d','#ff5233','#3fb0d8','#ff8fb5','#58b368','#fff6e8'];
  for(let i=0;i<70;i++){
    const c=document.createElement('div');c.className='confetti';
    c.style.left=Math.random()*100+'vw';c.style.background=cols[i%6];
    c.style.transform=`rotate(${Math.random()*360}deg)`;
    document.body.appendChild(c);
    const fall=c.animate([{transform:c.style.transform,top:'-20px'},{transform:`rotate(${Math.random()*720}deg)`,top:'105vh'}],{duration:1800+Math.random()*2200,delay:Math.random()*700,easing:'ease-in'});
    fall.onfinish=()=>c.remove();
  }
}

/* ---------- the Nope window ----------
   Nopes are the one place the game puts you under time pressure, so make that
   pressure visible: a draining bar and a ticking number, both in the popup and
   in the banner for everyone who's just watching. */
const NOPE_MS=6000;
let npEnds=0, npTick=null;
function startNopeClock(ms){
  npEnds=Date.now()+ms;
  clearInterval(npTick);
  npTick=setInterval(()=>{
    const left=Math.max(0,npEnds-Date.now());
    const bar=$('#modal .npClock .bar i'), secs=$('#modal .npClock .secs');
    if(bar)bar.style.width=(left/ms*100)+'%';
    if(secs)secs.textContent=left>0?(left/1000).toFixed(1)+'s to decide':'too late!';
    if(G&&G.phase==='nope'&&!$('#modalBg').classList.contains('on'))
      renderBanner('⏳ <span class="disp">Nope window</span> — '+(left/1000).toFixed(1)+'s');
    if(left<=0)stopNopeClock();
  },100);
}
function stopNopeClock(){clearInterval(npTick);npTick=null;}
const npClockHTML='<div class="npClock"><div class="bar"><i></i></div><div class="secs"></div></div>';

/* ---------- play flows (collect params, then dispatch) ---------- */
/* Collect anything a play still needs (a victim, a named card, a wish) and
   then submit it. */
function beginPlay(types,cls){
  const done=(params={})=>{selected=[];act(Object.assign({a:'play',pid:VIEW,cards:types},params));};
  if(cls.kind==='FAVOR'||cls.kind==='PAIR')pickTarget(t=>done({target:t}));
  else if(cls.kind==='TRIPLE')pickTarget(t=>pickCardType('Demand which card?',Object.keys(CARDS).filter(k=>k!=='BOOM'),n=>done({target:t,named:n})));
  else if(cls.kind==='FIVE'){
    const avail=[...new Set(G.discard)].filter(k=>k!=='BOOM');
    if(!avail.length){renderBanner('Discard pile is empty!');return;}
    pickCardType('Take which card from the discard pile?',avail,w=>done({wish:w}));
  }
  else done();
}
/* 'Pick a victim' chooser. */
function pickTarget(cb){
  const opts=G.players.filter(p=>p.alive&&p.id!==VIEW);
  modal(`<h2>Pick a victim</h2><p class="mtext" style="margin-top:-6px">(nothing purr-sonal)</p><div class="mrow">${opts.map(p=>`
    <button class="btn sun" data-t="${p.id}">${p.name}<br><span style="font-family:var(--hand);font-size:14px">${p.hand.length} cards</span></button>`).join('')}
    </div><div class="mrow"><button class="btn small ghost2" id="mCancel">Cancel</button></div>`);
  $$('#modal [data-t]').forEach(b=>b.onclick=()=>{closeModal();cb(+b.dataset.t)});
  $('#mCancel').onclick=closeModal;
}
/* Card-type chooser, used for triples and for digging in the discard. */
function pickCardType(title,keys,cb){
  modal(`<h2>${title}</h2><div class="cardpick">${keys.map(k=>`<div data-k="${k}">${cardHTML(k,'mini')}</div>`).join('')}</div>
  <div class="mrow"><button class="btn small" id="mCancel">Cancel</button></div>`);
  $$('#modal [data-k]').forEach(d=>d.onclick=()=>{closeModal();cb(d.dataset.k)});
  $('#mCancel').onclick=closeModal;
}

/* Replay one batch of engine events as sound, animation and commentary.
   Private lines (what you drew, what was stolen from you) are shown only to the
   player they belong to by checking against VIEW. */
function processEvents(evs){
  evs.forEach(e=>{
    switch(e.t){
      case 'log':logMsg(e.msg,e.pid,e.kind);break;
      case 'play':fxPlay(e.pid,e.cards[0]);if(e.pid===VIEW)NUDGE=true;break;
      case 'favorAsk':break;
      case 'nope':fxNope();break;
      case 'fizzle':break;
      case 'draw':fxDraw(e.pid);
        if(e.pid===VIEW&&!HIDE_HAND)flash(`You drew a ${CARDS[e.card].name}.`);
        break;
      case 'boomDrawn':sUhoh();break;
      case 'inserted':sSwish();break;
      case 'defused':sDefuse();break;
      case 'left':sSwish();break;
      case 'newround':announce('NEW ROUND!');sDeal();dealAnimation();break;
      case 'exploded':fxBoom();if(e.pid===VIEW)setTimeout(sLose,700);break;
      case 'shuffled':sSwish();break;
      case 'steal':sSteal();
        if(e.to===VIEW)flash(`😼 You swiped their ${CARDS[e.card].name}!`);
        else if(e.from===VIEW)flash(`😾 They swiped your ${CARDS[e.card].name}!`);
        break;
      case 'give':sPop();
        if(e.to===VIEW)flash(`🎁 You were handed a ${CARDS[e.card].name}.`);
        else if(e.from===VIEW)flash(`You handed over your ${CARDS[e.card].name}.`);
        break;
      case 'dig':sPop();if(e.pid===VIEW)flash(`You fished out a ${CARDS[e.card].name}!`);break;
      case 'future':if(e.pid===VIEW&&(MODE!=='bots'||e.pid===0))showFuture(e.cards);break;
      case 'win':clearLocal();fxConfetti();sWin();setTimeout(()=>showWin(e.pid),900);break;
      case 'turn':selected=[];NUDGE=false;SPY=null;
        if(!HIDE_HAND){
          if(e.pid===VIEW)e.turnsLeft>1?sAttacked():sYourTurn();
          else sTheirTurn();
        }
        break;
    }
  });
  renderAll();
}
/* See the Future: the top three cards, for your eyes only. */
function showFuture(cards){
  modal(`<h2>The Future…</h2><p class="mtext">Top of the deck, in draw order:</p>
    <div class="futureFan">${cards.map((c,i)=>`<div class="slot">${cardHTML(c,'mini')}<div class="lab">${['NEXT','2nd','3rd'][i]||''}</div></div>`).join('')}</div>
    <div class="mrow"><button class="btn sun" id="mOk">Got it 🤫</button></div>`,'info');
  $('#mOk').onclick=closeModal;
}
/* End-of-game screen with a rematch button. */
function showWin(pid){
  const p=G.players[pid];
  modal(`<h2>🏆 ${p.name} WINS!</h2>
    <div style="width:130px;margin:6px auto">${avatarSVG(pid,false)}</div>
    <p class="mtext">All the other kittens went kaboom. Purr-fection!</p>
    <div class="mrow"><button class="btn big boom" id="mAgain">Play again</button><button class="btn" id="mHome">Menu</button></div>`);
  $('#mAgain').onclick=()=>{
    if(MODE==='online'){
      const r=getOnlineClient().restart();
      if(r==='asked'){                              // guests wait for the host
        const b=$('#mAgain');b.disabled=true;b.textContent='Asked the host…';
      }else closeModal();
      return;
    }
    closeModal();
    startLocalGame(G.players.map(p=>({name:p.name.replace(' 🤖','')+(p.bot?' 🤖':''),bot:p.bot})));};
  $('#mHome').onclick=()=>{closeModal();if(MODE==='online')getOnlineClient().leave();show('scr-title')};
}
$('#btnQuit').onclick=()=>{
  const online=MODE==='online';
  modal(`<h2>Leave the game?</h2>
    <p class="mtext">Quitting already? How claw-ful.</p>
    ${online?'<p class="mtext" style="font-size:16px">The others will be told, and their game carries on without you.</p>':''}
    <div class="mrow"><button class="btn boom" id="mYes">I'm feline done</button><button class="btn" id="mNo">Keep playing</button></div>`);
  $('#mYes').onclick=()=>{closeModal();clearLocal();if(online){getOnlineClient().quit();}else{show('scr-title');}};
  $('#mNo').onclick=closeModal;
};

/* ---------- chat & reactions ---------- */
const REACTS=['😹','😱','😾','👏','🔥','💣','🙀','😼'];
let chatUnread=0;
/* Wire the chat panel, the reaction rail and the hand-sort toggle. */
function setupChatUI(){
  const bar=$('#reactBar');
  bar.innerHTML=REACTS.map(r=>`<button data-r="${r}">${r}</button>`).join('');
  $$('#reactBar button').forEach(b=>b.onclick=()=>{getOnlineClient().react(b.dataset.r);bar.classList.remove('open');});
  $('#reactToggle').onclick=()=>{bar.classList.toggle('open');$('#reactToggle').classList.remove('hintme');};
  $('#btnKittens').onclick=()=>{
    SHOW_KITTENS=!SHOW_KITTENS;store.set('kk_bombs',SHOW_KITTENS?'1':'0');
    $('#btnKittens').classList.toggle('off',!SHOW_KITTENS);
    flash(SHOW_KITTENS?'Showing kittens left in the deck':'Kitten counter hidden — count them yourself 😼');
    sPop();if(G)renderPiles();
  };
  $('#btnKittens').classList.toggle('off',!SHOW_KITTENS);
  $('#btnSort').onclick=()=>{
    SORT_HAND=!SORT_HAND;store.set('kk_sort',SORT_HAND?'1':'0');
    $('#btnSort').textContent=SORT_HAND?'⇅':'🔀';
    flash(SORT_HAND?'Hand sorted by type':'Hand in the order you drew it');
    sPop();renderHand();
  };
  $('#btnSort').textContent=SORT_HAND?'⇅':'🔀';
  $('#btnChat').onclick=()=>{
    const p=$('#chatPanel');p.classList.toggle('on');
    if(p.classList.contains('on')){
      chatUnread=0;renderChatBadge();$('#chatInput').focus();
      const l=$('#chatLog');requestAnimationFrame(()=>{l.scrollTop=l.scrollHeight;});
    }
  };
  $('#chatClose').onclick=()=>$('#chatPanel').classList.remove('on');
  $('#chatSend').onclick=sendChat;
  $('#chatInput').onkeydown=ev=>{if(ev.key==='Enter')sendChat();};
}
function sendChat(){
  const i=$('#chatInput'), t=i.value.trim();
  if(!t)return; i.value=''; getOnlineClient().chat(t);
}
function renderChatBadge(){
  const b=$('#btnChat'); if(!b)return;
  b.innerHTML=chatUnread?`💬<span class="dot">${chatUnread}</span>`:'💬';
}
function showChatUI(on){
  $('#btnChat').style.display=on?'':'none';
  $('#reactWrap').classList.toggle('on',!!on);
  if(on){                                   // wiggle once so people spot the panel
    const t=$('#reactToggle');t.classList.remove('hintme');void t.offsetWidth;t.classList.add('hintme');
  }else{$('#chatPanel').classList.remove('on');$('#reactBar').classList.remove('open');}
}
/* Append one chat message (text is inserted safely, never as HTML). */
function addChatLine(name,text,mine){
  const log=$('#chatLog'); if(!log)return;
  const d=document.createElement('div'); d.className='msg'+(mine?' mine':'');
  const b=document.createElement('b'); b.textContent=name+': ';
  d.appendChild(b); d.appendChild(document.createTextNode(text));
  log.appendChild(d);
  requestAnimationFrame(()=>{log.scrollTop=log.scrollHeight;});   // stick to the newest line
  while(log.children.length>80)log.removeChild(log.firstChild);
  if(!$('#chatPanel').classList.contains('on')){chatUnread++;renderChatBadge();}
}
/* Each emoji has its own voice, so you can hear who reacted with what. */
const REACT_SOUND={
  '\u{1F639}':()=>melody([N.E,N.G,N.E,N.C2],.07,'square',.12,.08),
  '\u{1F631}':()=>{tone(880,.35,'sine',.16,0,-560);noise(.2,.12,'highpass',2200,.05);},
  '\u{1F63E}':()=>{tone(150,.26,'sawtooth',.2,0,-50);noise(.22,.13,'lowpass',500,0);},
  '\u{1F44F}':()=>[0,.11,.22].forEach(t=>noise(.06,.3,'bandpass',1900,t,1.4)),
  '\u{1F525}':()=>noise(.45,.22,'highpass',3400,0),
  '\u{1F4A3}':()=>{tone(700,.5,'sine',.1,0,-620);noise(.12,.3,'lowpass',300,.5);},
  '\u{1F640}':()=>{tone(520,.14,'triangle',.16);tone(760,.2,'triangle',.16,.12);},
  '\u{1F63C}':()=>{tone(330,.12,'sine',.13,0,180);tone(500,.16,'sine',.11,.12,120);},
};
function floatReaction(name,emo,pid){
  const col=pid!=null?pColor(pid):'#ffc53d';
  const d=document.createElement('div'); d.className='reactFloat';
  d.style.setProperty('--c',col);
  const face=document.createElement('div'); face.textContent=emo; d.appendChild(face);
  const s=document.createElement('span'); s.textContent=name; d.appendChild(s);
  const fromRail=window.innerWidth>620;
  if(fromRail)d.style.right='74px'; else d.style.left=(15+Math.random()*55)+'vw';
  d.style.bottom=(28+Math.random()*14)+'vh';
  document.body.appendChild(d);
  const an=d.animate([{transform:'translateY(20px) scale(.4) rotate(-12deg)',opacity:0},
                      {transform:'translateY(-16px) scale(1.25) rotate(4deg)',opacity:1,offset:.2},
                      {transform:'translateY(-40px) scale(1.05) rotate(-2deg)',opacity:1,offset:.55},
                      {transform:'translateY(-170px) scale(.9)',opacity:0}],
                     {duration:2400,easing:'cubic-bezier(.2,.75,.3,1)'});
  an.onfinish=()=>d.remove();
  burstAt(d.getBoundingClientRect(),col);
  (REACT_SOUND[emo]||(()=>tone(880,.1,'sine',.1,0,200)))();
}
/* a small colour-matched confetti pop where the reaction appears */
function burstAt(r,col){
  const cx=r.left+r.width/2, cy=r.top+r.height/2;
  for(let i=0;i<12;i++){
    const p=document.createElement('div');
    p.style.cssText='position:fixed;z-index:92;width:8px;height:10px;pointer-events:none;border-radius:2px;background:'+col;
    p.style.left=cx+'px'; p.style.top=cy+'px';
    document.body.appendChild(p);
    const ang=Math.random()*Math.PI*2, dist=40+Math.random()*70;
    const a=p.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:1},
      {transform:`translate(${Math.cos(ang)*dist-50}%,${Math.sin(ang)*dist+60}%) rotate(${Math.random()*540}deg) scale(.4)`,opacity:0}],
      {duration:900+Math.random()*500,easing:'cubic-bezier(.1,.7,.3,1)'});
    a.onfinish=()=>p.remove();
  }
}

/* ---------- local action routing ---------- */
function act(action){
  if(MODE==='online'){getOnlineClient().send(action);return;}
  const ev=dispatchLocal(action);
  if(ev===null){renderHand();return;}
  processEvents(ev);
  saveLocal();
  afterChange();
}

/* ---------- follow-ups for local modes ---------- */
/* Drive whatever has to happen next in a LOCAL game: open the nope window, ask
   the exploding player to defuse, hand the device on, or let a bot think.
   Online games are driven by OL instead. */
function afterChange(){
  if(!G||MODE==='online')return;
  if(G.phase==='over')return;
  if(G.phase==='nope'){openNopeWindow();return;}
  if(G.phase==='defuse'){handleDefusePhase();return;}
  if(G.phase==='insert'){handleInsertPhase();return;}
  if(G.phase==='favorGive'){handleFavorPhase();return;}
  // phase 'turn'
  const cp=curP(G);
  if(MODE==='hot'&&!cp.bot){
    if(VIEW!==cp.id){curtainFor(cp.id,()=>{VIEW=cp.id;selected=[];renderAll();});}
    return;
  }
  if(cp.bot)setTimeout(botMove,1000+Math.random()*700);
}

/* ---------- nope window ---------- */
function chainLastActor(){const n=G.pending.nopes;return n.length?n[n.length-1]:G.pending.actor;}
/* Give everyone a chance to Nope the card that was just played. */
function openNopeWindow(){
  const last=chainLastActor();
  if(MODE==='hot'){
    HIDE_HAND=true;renderAll();
    const others=G.players.filter(p=>p.alive&&p.id!==last);
    modal(`<h2>${G.pending.nopes.length%2?'Nope the Nope?':'Anyone want to NOPE?'}</h2>
      <p class="mtext">${G.players[last].name} just played${G.pending.nopes.length?' a Nope':''}. Anyone holding a Nope card can slam it now.</p>
      <div class="mrow">${others.map(p=>`<button class="btn sun" data-n="${p.id}">${p.name}: NOPE!</button>`).join('')}</div>
      <div class="mrow"><button class="btn big" id="mCont">Nobody nopes — continue</button></div>
      <p class="mtext" id="nopeErr" style="color:var(--boom-dk)"></p>`);
    $$('#modal [data-n]').forEach(b=>b.onclick=()=>{
      const pid=+b.dataset.n;
      const ev=dispatchLocal({a:'nope',pid});
      if(ev===null){$('#nopeErr').textContent=`${G.players[pid].name} has no Nope card! Nice try. 😹`;return;}
      closeModal();processEvents(ev);afterChange();
    });
    $('#mCont').onclick=()=>{closeModal();HIDE_HAND=false;const ev=dispatchLocal({a:'closeNope'});processEvents(ev);afterChange();};
    return;
  }
  // bots mode
  const bots=G.players.filter(p=>p.bot&&p.alive&&p.id!==last&&p.hand.includes('NOPE'));
  const pd=G.pending;
  const willNope=bots.filter(b=>{
    let pr = pd.target===b.id?.5:(pd.nopes.length?0.28:0.13);
    if(pd.kind==='ATTACK'&&G.turn===b.id)pr=.5;
    return Math.random()<pr;
  });
  const humanCan=G.players[0].alive&&last!==0&&G.players[0].hand.includes('NOPE');
  if(willNope.length){
    setTimeout(()=>{const ev=dispatchLocal({a:'nope',pid:willNope[0].id});processEvents(ev);afterChange();},800);
    return;
  }
  if(humanCan){
    renderBanner(`<span class="disp" style="color:var(--boom)">NOPE?</span> You can cancel this!`);
    modal(`<h2>Quick — Nope it?</h2><p class="mtext">${G.players[last].name} played ${pd.nopes.length?'a Nope':CARDS[pd.cards[0]].name}${pd.target===0?' <b>on YOU</b>':''}.</p>
      ${npClockHTML}
      <div class="mrow"><button class="btn big boom" id="mNope">NOPE! ✋</button><button class="btn" id="mLet">Let it happen</button></div>`);
    startNopeClock(NOPE_MS);
    const fin=did=>{clearTimeout(NOPE_TIMER);stopNopeClock();closeModal();
      const ev=dispatchLocal(did?{a:'nope',pid:0}:{a:'closeNope'});processEvents(ev);afterChange();};
    NOPE_TIMER=setTimeout(()=>fin(false),NOPE_MS);
    $('#mNope').onclick=()=>fin(true);
    $('#mLet').onclick=()=>fin(false);
    return;
  }
  setTimeout(()=>{const ev=dispatchLocal({a:'closeNope'});processEvents(ev);afterChange();},600);
}

/* ---------- defuse / insert / favor phases ---------- */
/* Someone drew a kitten: offer the Defuse (or let them explode). */
function handleDefusePhase(){
  const pid=G.pendingBoom.pid, p=G.players[pid];
  const hasD=p.hand.includes('DEFUSE');
  const go=(use)=>{const ev=dispatchLocal({a:'defuse',pid,use});processEvents(ev);afterChange();};
  if(MODE==='bots'&&p.bot){setTimeout(()=>go(hasD),1200);return;}
  const showIt=()=>{
    modal(`<h2>💣 KABOOM KITTEN!</h2>
    <div style="width:130px;margin:0 auto">${ART.BOOM()}</div>
    <p class="mtext">${hasD?'Stay paws-itive — you have a <b>Defuse</b>!':'You have <b>no Defuse</b>… what a cat-astrophe.'}</p>
    <div class="mrow">${hasD?'<button class="btn big sun" id="mDef">✂️ Defuse it!</button>':''}
    <button class="btn ${hasD?'':'big '}boom" id="mDie">💥 Explode</button></div>`);
    const d=$('#mDef');if(d)d.onclick=()=>{closeModal();go(true)};
    $('#mDie').onclick=()=>{closeModal();go(false)};
  };
  if(MODE==='hot'&&VIEW!==pid){curtainFor(pid,()=>{VIEW=pid;renderAll();showIt();});}else showIt();
}
/* Slide the kitten anywhere in the real deck — click the gap you want. */
function openInsertPicker(n,cb){
  let strip='<div class="stripEnd">TOP</div>';
  for(let i=0;i<=n;i++){
    strip+=`<button class="slot" data-pos="${i}" aria-label="Insert at position ${i+1}"></button>`;
    if(i<n)strip+='<div class="dcard"></div>';
  }
  strip+='<div class="stripEnd">BOTTOM</div>';
  modal(`<h2>Hide the kitten 😼</h2>
    <p class="mtext" style="margin-top:-4px">Slip it anywhere among the ${n} cards — click a gap. Nobody sees where it goes.</p>
    <div class="deckStrip" id="deckStrip">${strip}</div>
    <div class="mtext" id="slotLabel">Hover a gap to see where it lands…</div>
    <div class="mrow">
      <button class="btn small sun" data-quick="0">Right on top 😈</button>
      <button class="btn small" data-quick="${Math.floor(n/2)}">Middle</button>
      <button class="btn small" data-quick="${n}">Bottom</button>
      <button class="btn small sky" data-quick="rnd">Surprise me 🎲</button>
    </div>`);
  const lab=$('#slotLabel');
  const describe=p=>p===0?'Right on top — the very next card drawn. Evil. 😈'
    :p===n?`Dead last — ${n} cards above it. They'll forget it exists.`
    :`Position ${p+1} from the top — ${p} card${p>1?'s':''} above, ${n-p} below.`;
  $$('#modal .slot').forEach(b=>{
    const p=+b.dataset.pos;
    b.onmouseenter=b.onfocus=()=>{lab.textContent=describe(p);};
    b.onclick=()=>{closeModal();cb(p);};
  });
  $$('#modal [data-quick]').forEach(b=>b.onclick=()=>{
    closeModal();const q=b.dataset.quick;
    cb(q==='rnd'?null:+q);
  });
}
function handleInsertPhase(){
  const pid=G.pendingBoom.pid, p=G.players[pid];
  const go=(pos)=>{const ev=dispatchLocal({a:'insert',pid,pos});processEvents(ev);afterChange();};
  if(MODE==='bots'&&p.bot){setTimeout(()=>go(Math.random()<.5?0:Math.floor(Math.random()*(G.deck.length+1))),900);return;}
  openInsertPicker(G.deck.length,go);
}
/* The Favor target chooses which card to hand over. */
function handleFavorPhase(){
  const {from,to}=G.pendingFavor, p=G.players[from];
  if(MODE==='bots'&&p.bot){
    setTimeout(()=>{
      let idx=0,best=99;
      p.hand.forEach((c,i)=>{const r=BOT_PREF_MAP[c]??99;if(r<best){best=r;idx=i;}});
      const ev=dispatchLocal({a:'give',pid:from,idx});processEvents(ev);afterChange();
    },1100);return;
  }
  const showIt=()=>{
    modal(`<h2>Favor for ${G.players[to].name}</h2><p class="mtext">Choose one of your cards to give away. Sharing is purring.</p>
      <div class="cardpick">${p.hand.map((c,i)=>`<div data-i="${i}">${cardHTML(c,'mini')}</div>`).join('')}</div>`);
    $$('#modal [data-i]').forEach(d=>d.onclick=()=>{closeModal();
      const ev=dispatchLocal({a:'give',pid:from,idx:+d.dataset.i});processEvents(ev);
      if(MODE==='hot'){VIEW=G.turn;curtainFor(G.turn,()=>{renderAll();afterChange();});}
      else afterChange();
    });
  };
  if(MODE==='hot'&&VIEW!==from)curtainFor(from,()=>{VIEW=from;renderAll();showIt();});
  else showIt();
}

/* ---------- bot brain ---------- */
/* Bot brain: peek-aware and mildly self-preserving. It plays around a known
   Kaboom Kitten (Skip/Attack/Shuffle), uses See the Future, farms cat pairs and
   otherwise draws. Deliberately imperfect — it should lose sometimes. */
function botMove(){
  if(!G||G.phase!=='turn'||!curP(G).bot)return;
  const b=curP(G), pid=b.id;
  const risk=G.deck.length?(G.deck.filter(c=>c==='BOOM').length/G.deck.length):1;
  const peek=BOT_PEEK[pid];
  const topIsBoom=peek&&peek.deckAt===G.deck.length&&peek.cards[0]==='BOOM';
  const has=t=>b.hand.includes(t);
  const playIt=(cards,extra={})=>{const ev=dispatchLocal(Object.assign({a:'play',pid,cards},extra));processEvents(ev);afterChange();};
  const targets=G.players.filter(p=>p.alive&&p.id!==pid);
  const rndT=()=>targets[Math.floor(Math.random()*targets.length)].id;
  const bestT=()=>targets.reduce((a,p)=>p.hand.length>a.hand.length?p:a,targets[0]).id;
  if(topIsBoom&&has('SKIP')){delete BOT_PEEK[pid];playIt(['SKIP']);return;}
  if(topIsBoom&&has('ATTACK')){delete BOT_PEEK[pid];playIt(['ATTACK']);return;}
  if(topIsBoom&&has('SHUFFLE')){delete BOT_PEEK[pid];playIt(['SHUFFLE']);return;}
  if(has('FUTURE')&&!peek&&Math.random()<.55){playIt(['FUTURE']);return;}
  if(has('ATTACK')&&(G.turnsLeft>1||risk>.22)&&Math.random()<.75){playIt(['ATTACK']);return;}
  if(has('SKIP')&&risk>.3&&Math.random()<.6){playIt(['SKIP']);return;}
  for(const ct of CAT_TYPES){
    if(b.hand.filter(c=>c===ct).length>=2&&Math.random()<.45){playIt([ct,ct],{target:bestT()});return;}
  }
  if(has('FAVOR')&&Math.random()<.3){playIt(['FAVOR'],{target:bestT()});return;}
  const ev=dispatchLocal({a:'draw',pid});processEvents(ev);afterChange();
}

/* Keep bot-only memory in the UI layer instead of monkey-patching the engine. */
function dispatchLocal(action){
  const events=dispatch(G,action);
  if(events)events.forEach(event=>{
    if(event.t==='future'&&G.players[event.pid].bot){
      BOT_PEEK[event.pid]={cards:event.cards,deckAt:G.deck.length};
    }
    if(event.t==='shuffled')Object.keys(BOT_PEEK).forEach(key=>delete BOT_PEEK[key]);
  });
  return events;
}

/* ---------- surviving a reload ----------
   Local games are snapshotted after every change; online games are restored
   from the room itself (the state lives in the database). Either way a stray
   refresh no longer ends your evening. */
function saveLocal(){
  if(MODE!=='bots'&&MODE!=='hot')return;
  try{store.set('kk_local',JSON.stringify({MODE,VIEW,G,t:Date.now()}));}catch(e){}
}
function clearLocal(){store.set('kk_local','');}
function offerResume(){
  const btn=$('#btnResume');
  let room=null,loc=null;
  try{room=JSON.parse(store.get('kk_room')||'null');}catch(e){}
  try{loc=JSON.parse(store.get('kk_local')||'null');}catch(e){}
  const fresh=x=>x&&x.t&&(Date.now()-x.t)<12*3600e3;
  if(fresh(room)){
    btn.style.display='';btn.textContent='Rejoin room '+room.code;
    btn.onclick=async()=>{
      btn.disabled=true;btn.textContent='Reconnecting…';
      try{await getOnlineClient().rejoin(room);}
      catch(e){btn.disabled=false;btn.textContent='That room is gone';getOnlineClient().clearSession();
        setTimeout(()=>{btn.style.display='none';},1800);}
    };
    return;
  }
  if(fresh(loc)&&loc.G&&loc.G.phase!=='over'){
    btn.style.display='';btn.textContent='Resume your game';
    btn.onclick=()=>{
      G=loc.G;MODE=loc.MODE;VIEW=loc.VIEW;selected=[];HIDE_HAND=false;BOT_PEEK={};
      showChatUI(false);show('scr-table');renderAll();
      logMsg('Picked up right where you left off.');
      afterChange();
    };
    return;
  }
  btn.style.display='none';
}

let rzT=null;
window.addEventListener('resize',()=>{clearTimeout(rzT);rzT=setTimeout(()=>{if(G)renderOpps();},180);});

/* boot the chat / reaction controls once the DOM is in place */
setupChatUI();
offerResume();
/* Invite links are handled by the online layer, which loads after this file —
   see getOnlineClient().openInvite(). */
