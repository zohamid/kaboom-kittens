'use strict';

/* ================= CARD DEFINITIONS ================= */
/* The card catalogue. `cat:1` marks a cat card (combo fodder, no power of its
   own). color/tint drive the card frame; desc is shown on the card and in the
   rules screen. Adding a cat here automatically adds it to the game. */
const CARDS={
  BOOM:   {name:'Kaboom Kitten', color:'#d63a1f', tint:'#ffd9cf', desc:'BOOM. You explode — unless you defuse it.'},
  DEFUSE: {name:'Defuse',        color:'#2f7d3f', tint:'#d9f0dd', desc:'Snip! Survive a Kaboom Kitten & hide it back in the deck.'},
  ATTACK: {name:'Attack',        color:'#6b4fb3', tint:'#e8e0f8', desc:'End your turn without drawing. Next player takes 2 turns.'},
  SKIP:   {name:'Skip',          color:'#1f7fa8', tint:'#d7eef8', desc:'End your turn without drawing a card.'},
  FAVOR:  {name:'Favor',         color:'#c94f79', tint:'#fbdde8', desc:'One player must give you a card of their choice.'},
  SHUFFLE:{name:'Shuffle',       color:'#b8860b', tint:'#faeecb', desc:'Shuffle the draw pile.'},
  FUTURE: {name:'See the Future',color:'#7b5fc0', tint:'#e9e2fa', desc:'Secretly peek at the top 3 cards of the deck.'},
  NOPE:   {name:'Nope',          color:'#c1272d', tint:'#ffe3c2', desc:'Cancel any card (except a Kaboom or Defuse). Play it anytime!'},
  CAT_SAMOSA:{name:'Samosa Cat', cat:1, color:'#b06a10', tint:'#fdeed2', desc:'Just a crispy cat. Play matching cats as combos!'},
  CAT_DISCO: {name:'Disco Cat',  cat:1, color:'#b06a10', tint:'#fdeed2', desc:'Born to boogie. Play matching cats as combos!'},
  CAT_PICKLE:{name:'Pickle Cat', cat:1, color:'#b06a10', tint:'#fdeed2', desc:'In a bit of a pickle. Play matching cats as combos!'},
  CAT_MELON: {name:'Melon Cat',  cat:1, color:'#b06a10', tint:'#fdeed2', desc:'One in a melon. Play matching cats as combos!'},
  CAT_TACHE: {name:'Mustache Cat',cat:1,color:'#b06a10', tint:'#fdeed2', desc:'A cat of distinction. Play matching cats as combos!'},
  CAT_JALEBI:{name:'Jalebi Cat', cat:1, color:'#b06a10', tint:'#fdeed2', desc:'Sweet, sticky and going in circles. Play matching cats as combos!'},
  CAT_LUNGI: {name:'Lungi Cat',  cat:1, color:'#b06a10', tint:'#fdeed2', desc:'Comfort over everything. Play matching cats as combos!'},
  CAT_CHAI:  {name:'Chai Cat',   cat:1, color:'#b06a10', tint:'#fdeed2', desc:'One cutting, extra kadak. Play matching cats as combos!'},
  CAT_RICKSHAW:{name:'Rickshaw Cat',cat:1,color:'#b06a10', tint:'#fdeed2', desc:'Tring tring! Play matching cats as combos!'},
  CAT_UNCLE: {name:'Auto-Uncle Cat',cat:1,color:'#b06a10', tint:'#fdeed2', desc:'Meter down? Nahi jaayenge. Play matching cats as combos!'},
};
/* Every cat family that exists. Each game deals a random 5 of these. */
const CAT_TYPES=Object.keys(CARDS).filter(k=>CARDS[k].cat);
const MIN_PLAYERS=2;
const MAX_PLAYERS=5;
const ACTION_CARD_TYPES=new Set(['ATTACK','SKIP','FAVOR','SHUFFLE','FUTURE']);
const TARGETED_PLAY_TYPES=new Set(['FAVOR','PAIR','TRIPLE']);
const SUPPORTED_ACTIONS=new Set(['play','nope','closeNope','draw','defuse','insert','give','leave']);
/* ============================================================================
   GAME ENGINE — pure rules. No DOM, no timers, no network.

   newGame(playerDefs)      -> a fresh game state
   dispatch(state, action)  -> array of events, or null if the action is illegal

   State shape:
     players[]  {id, name, bot, alive, hand[]}
     cats[]     the 5 cat families dealt into this game (of the 10 that exist)
     deck[]     face-down draw pile; the TOP of the deck is the END of the array
     discard[]  played cards, most recent last
     turn       whose turn it is; turnsLeft counts Attack stacking
     phase      'turn' | 'nope' | 'defuse' | 'insert' | 'favorGive' | 'over'
     seq        increments on every applied action (online clients use it to
                ignore state they have already seen)

   Callers must treat a null return as "that move wasn't allowed" and change
   nothing — this is what stops a desynced or malicious client corrupting a game.
   ============================================================================ */
/* Fisher-Yates in place. Used for the deck and for picking cat families. */
function shuffleArr(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

/* Build a fresh game. Deck maths mirrors the real game: everyone gets 7 cards
   plus a guaranteed Defuse, then the remaining Defuses and exactly
   (players - 1) Kaboom Kittens go in, so exactly one player survives. */
function newGame(playerDefs){
  if(!Array.isArray(playerDefs)||playerDefs.length<MIN_PLAYERS||playerDefs.length>MAX_PLAYERS){
    throw new RangeError(`A game requires between ${MIN_PLAYERS} and ${MAX_PLAYERS} players.`);
  }
  const N=playerDefs.length;
  let pool=[];
  ['ATTACK','SKIP','FAVOR','SHUFFLE'].forEach(t=>{for(let i=0;i<4;i++)pool.push(t);});
  for(let i=0;i<5;i++)pool.push('FUTURE');
  for(let i=0;i<6;i++)pool.push('NOPE');
  const cats=shuffleArr([...CAT_TYPES]).slice(0,5);   // 5 families per game, drawn from the whole zoo
  cats.forEach(t=>{for(let i=0;i<4;i++)pool.push(t);});
  shuffleArr(pool);
  const players=playerDefs.map((p,i)=>({id:i,name:p.name,bot:!!p.bot,alive:true,hand:['DEFUSE']}));
  players.forEach(p=>{for(let i=0;i<7;i++)p.hand.push(pool.pop());});
  const extraDefuse=N<=3?2:6-N;
  for(let i=0;i<extraDefuse;i++)pool.push('DEFUSE');
  for(let i=0;i<N-1;i++)pool.push('BOOM');
  shuffleArr(pool);
  return {players,cats,deck:pool,discard:[],turn:0,turnsLeft:1,phase:'turn',pending:null,pendingBoom:null,pendingFavor:null,winner:null,seq:0,ev:[]};
}
/* Players still in the game. */
const alivePlayers=G=>G.players.filter(p=>p.alive);
/* Whoever's turn it is. */
const curP=G=>G.players[G.turn];
/* Queue an event for the UI to replay. */
function emit(G,e){G.ev.push(e);}
/* Every log line carries the player it concerns, so the UI can colour-code it.
   kind:'turn' marks a turn change, which renders as a divider rather than a line. */
function log(G,msg,pid,kind){emit(G,{t:'log',msg,pid:(pid==null?null:pid),kind:kind||null});}

/* The next living player clockwise, skipping the dead. */
function nextAliveIdx(G,from){
  let i=from;
  for(let k=0;k<G.players.length;k++){i=(i+1)%G.players.length; if(G.players[i].alive)return i;}
  return from;
}
/* Move to the next player. forcedTurns is how Attack hands over 2+ turns. */
function advance(G,forcedTurns){
  G.turn=nextAliveIdx(G,G.turn);
  G.turnsLeft=forcedTurns||1;
  G.phase='turn';
  emit(G,{t:'turn',pid:G.turn,turnsLeft:G.turnsLeft});
  log(G,`${G.players[G.turn].name}'s turn`,G.turn,'turn');
}
/* One turn is done: either take another (Attack stack) or pass the baton. */
function endOneTurn(G){ // after a draw / skip / defuse-insert
  G.turnsLeft--;
  if(G.turnsLeft>0){G.phase='turn'; emit(G,{t:'turn',pid:G.turn,turnsLeft:G.turnsLeft});}
  else advance(G);
}
/* One player left = game over. Returns true if it ended. */
function checkWin(G){
  const al=alivePlayers(G);
  if(al.length===1){G.phase='over'; G.winner=al[0].id; emit(G,{t:'win',pid:al[0].id}); log(G,`🏆 ${al[0].name} wins!`,al[0].id); return true;}
  return false;
}
/* Remove one of each listed card. Returns false and changes NOTHING if the
   player doesn't actually hold them — this is the anti-cheat check. */
function removeFromHand(p,types){ // remove one instance of each listed type; return false if missing
  const copy=[...p.hand];
  for(const t of types){const i=copy.indexOf(t); if(i<0)return false; copy[i]=null;}
  p.hand=copy.filter(c=>c!==null);
  return true;
}

/* classify a selection of card types into a legal play */
/* Work out what a selection of cards means: a single action card, a cat pair,
   a cat triple, or five distinct cats. null = not a legal play. */
function classifyPlay(types){
  if(!Array.isArray(types))return null;
  if(types.length===1){
    const t=types[0];
    if(ACTION_CARD_TYPES.has(t))return {kind:t};
    return null;
  }
  if(types.every(t=>CARDS[t]&&CARDS[t].cat)){
    if(types.length===2&&types[0]===types[1])return {kind:'PAIR'};
    if(types.length===3&&types.every(t=>t===types[0]))return {kind:'TRIPLE'};
    if(types.length===5&&new Set(types).size===5)return {kind:'FIVE'};
  }
  return null;
}
/* These plays need a victim chosen before they can be submitted. */
function playNeedsTarget(kind){return TARGETED_PLAY_TYPES.has(kind);}

/* THE heart of the game. Applies one action and returns the events it caused.
   Actions: play, nope, closeNope, draw, defuse, insert, give.
   Returns null if the action is illegal — callers must then change nothing. */
function applyAction(G,a){
  G.ev=[];
  const P=G.players[a.pid];
  switch(a.a){
    case 'play':{
      if(G.phase!=='turn'||a.pid!==G.turn||!P.alive)return null;
      const cls=classifyPlay(a.cards);
      if(!cls)return null;
      if(playNeedsTarget(cls.kind)){
        const T=G.players[a.target];
        if(!T||!T.alive||a.target===a.pid)return null;
      }
      if(cls.kind==='TRIPLE'&&!CARDS[a.named])return null;
      if(!removeFromHand(P,a.cards))return null;
      G.discard.push(...a.cards);
      G.pending={kind:cls.kind,actor:a.pid,cards:a.cards,target:a.target,named:a.named,wish:a.wish,nopes:[]};
      G.phase='nope';
      emit(G,{t:'play',pid:a.pid,cards:a.cards,kind:cls.kind,target:a.target});
      const tn=a.target!=null?` on ${G.players[a.target].name}`:'';
      const label=cls.kind==='PAIR'?`a pair of ${CARDS[a.cards[0]].name}s`:cls.kind==='TRIPLE'?`three ${CARDS[a.cards[0]].name}s`:cls.kind==='FIVE'?'five different cats':CARDS[a.cards[0]].name;
      log(G,`${P.name} plays ${label}${tn}!`,a.pid);
      break;
    }
    case 'nope':{
      if(G.phase!=='nope'||!G.pending||!Array.isArray(G.pending.nopes)||!P.alive)return null;
      const lastActor=G.pending.nopes.length?G.pending.nopes[G.pending.nopes.length-1]:G.pending.actor;
      if(a.pid===lastActor)return null;
      if(!removeFromHand(P,['NOPE']))return null;
      G.discard.push('NOPE');
      G.pending.nopes.push(a.pid);
      emit(G,{t:'nope',pid:a.pid,count:G.pending.nopes.length});
      log(G,G.pending.nopes.length%2?`${P.name} yells NOPE!`:`${P.name} nopes the Nope — it's back on!`,a.pid);
      break;
    }
    case 'closeNope':{
      if(G.phase!=='nope'||!G.pending||!Array.isArray(G.pending.nopes))return null;
      const pd=G.pending; G.pending=null;
      const actor=G.players[pd.actor];
      /* Nope parity: 1 nope cancels, 2 make a "Yup" and it happens after all,
         3 cancel again… so an odd number of nopes means the card fizzles. */
      if(pd.nopes.length%2===1){
        G.phase='turn';
        emit(G,{t:'fizzle',kind:pd.kind});
        log(G,`…so nothing happens. Cards wasted!`);
        break;
      }
      switch(pd.kind){
        case 'ATTACK':{
          const nt=G.turnsLeft>=2?G.turnsLeft+2:2;
          G.turnsLeft=0;
          advance(G,nt);
          log(G,`${curP(G).name} is under attack — ${nt} turns!`,G.turn);
          break;
        }
        case 'SKIP': log(G,`${actor.name} skips away on quiet little paws…`,pd.actor); endOneTurn(G); break;
        case 'SHUFFLE': shuffleArr(G.deck); G.phase='turn'; emit(G,{t:'shuffled'}); log(G,`${actor.name} shuffles the deck.`,pd.actor); break;
        case 'FUTURE':{
          G.phase='turn';
          emit(G,{t:'future',pid:pd.actor,cards:G.deck.slice(-3).reverse()});
          log(G,`${actor.name} peeks at the future… 👀`,pd.actor);
          break;
        }
        case 'FAVOR':{
          const T=G.players[pd.target];
          if(!T.alive||T.hand.length===0){G.phase='turn'; log(G,`${T.name} has nothing to give!`,pd.target);}
          else{G.phase='favorGive'; G.pendingFavor={from:pd.target,to:pd.actor}; emit(G,{t:'favorAsk',from:pd.target,to:pd.actor}); log(G,`${T.name} must hand ${actor.name} a card…`,pd.target);}
          break;
        }
        case 'PAIR':{
          const T=G.players[pd.target];
          G.phase='turn';
          if(T.alive&&T.hand.length){
            const i=Math.floor(Math.random()*T.hand.length);
            const c=T.hand.splice(i,1)[0];
            actor.hand.push(c);
            emit(G,{t:'steal',from:pd.target,to:pd.actor,card:c});
            log(G,`🐾 ${actor.name} swipes a random card from ${T.name}!`,pd.actor);
          }else log(G,`${T.name} had nothing to steal!`,pd.target);
          break;
        }
        case 'TRIPLE':{
          const T=G.players[pd.target];
          G.phase='turn';
          const i=T.alive?T.hand.indexOf(pd.named):-1;
          if(i>=0){
            T.hand.splice(i,1); actor.hand.push(pd.named);
            emit(G,{t:'steal',from:pd.target,to:pd.actor,card:pd.named});
            log(G,`${T.name} had a ${CARDS[pd.named].name} — handed over!`,pd.actor);
          }else log(G,`${T.name} doesn't have a ${CARDS[pd.named].name}. Tough luck!`,pd.actor);
          break;
        }
        case 'FIVE':{
          G.phase='turn';
          const i=G.discard.slice(0,-5).lastIndexOf(pd.wish);
          if(pd.wish&&i>=0){
            G.discard.splice(i,1); actor.hand.push(pd.wish);
            emit(G,{t:'dig',pid:pd.actor,card:pd.wish});
            log(G,`${actor.name} digs a ${CARDS[pd.wish].name} out of the discard pile!`,pd.actor);
          }else log(G,'The discard pile gave up nothing.');
          break;
        }
      }
      break;
    }
    case 'draw':{
      if(G.phase!=='turn'||a.pid!==G.turn||!P.alive||G.deck.length===0)return null;
      const c=G.deck.pop();
      if(c==='BOOM'){
        G.phase='defuse'; G.pendingBoom={pid:a.pid};
        emit(G,{t:'boomDrawn',pid:a.pid});
        log(G,`💣 ${P.name} drew a KABOOM KITTEN!`,a.pid);
      }else{
        P.hand.push(c);
        emit(G,{t:'draw',pid:a.pid,card:c});
        log(G,`${P.name} draws a card. (${G.deck.length} left in the deck)`,a.pid);
        endOneTurn(G);
      }
      break;
    }
    case 'defuse':{
      if(G.phase!=='defuse'||!G.pendingBoom||a.pid!==G.pendingBoom.pid)return null;
      if(a.use&&removeFromHand(P,['DEFUSE'])){
        G.discard.push('DEFUSE');
        G.phase='insert';
        emit(G,{t:'defused',pid:a.pid});
        log(G,`✂️ ${P.name} defuses it! Now hiding it back in the deck…`,a.pid);
      }else{
        P.alive=false;
        G.discard.push(...P.hand,'BOOM'); P.hand=[];
        G.pendingBoom=null;
        emit(G,{t:'exploded',pid:a.pid});
        log(G,`💥 ${P.name} EXPLODED! ${alivePlayers(G).length} left.`,a.pid);
        if(!checkWin(G)){G.turnsLeft=0; advance(G);}
      }
      break;
    }
    case 'insert':{
      if(G.phase!=='insert'||!G.pendingBoom||a.pid!==G.pendingBoom.pid)return null;
      /* pos counts from the TOP of the deck (0 = next card drawn). The deck
         array stores the top at the end, so we splice from the far side. */
      let pos=a.pos;
      if(pos==null||pos<0||pos>G.deck.length)pos=Math.floor(Math.random()*(G.deck.length+1));
      G.deck.splice(G.deck.length-pos,0,'BOOM');
      G.pendingBoom=null;
      emit(G,{t:'inserted',pid:a.pid});
      log(G,`${P.name} slips the kitten back… somewhere. 😼`,a.pid);
      endOneTurn(G);
      break;
    }
    case 'give':{
      if(G.phase!=='favorGive'||!G.pendingFavor||a.pid!==G.pendingFavor.from)return null;
      if(!Number.isInteger(a.idx)||a.idx<0||a.idx>=P.hand.length)return null;
      const to=G.players[G.pendingFavor.to];
      if(!to||!to.alive)return null;
      const c=P.hand.splice(a.idx,1)[0];
      to.hand.push(c);
      emit(G,{t:'give',from:a.pid,to:to.id,card:c});
      log(G,`${P.name} hands a card to ${to.name}.`,a.pid);
      G.pendingFavor=null; G.phase='turn';
      break;
    }
    /* Someone walked away. Take them out of the game cleanly: their cards go to
       the discard pile (so the card count stays honest), anything the table was
       waiting on them for is released, and play carries on with whoever's left.
       If that leaves one player standing, they win. */
    case 'leave':{
      if(!P||!P.alive)return null;
      P.alive=false;
      G.discard.push(...P.hand); P.hand=[];
      emit(G,{t:'left',pid:a.pid});
      log(G,`🚪 ${P.name} left the table.`,a.pid);
      if(G.pendingBoom&&G.pendingBoom.pid===a.pid){G.discard.push('BOOM');G.pendingBoom=null;G.phase='turn';}
      if(G.pendingFavor&&(G.pendingFavor.from===a.pid||G.pendingFavor.to===a.pid)){G.pendingFavor=null;G.phase='turn';}
      if(G.pending&&(G.pending.actor===a.pid||G.pending.target===a.pid)){G.pending=null;G.phase='turn';}
      if(!checkWin(G)){
        if(!G.players[G.turn].alive){G.turnsLeft=0;advance(G);}
        else if(G.phase==='nope'&&!G.pending)G.phase='turn';
      }
      break;
    }
    default:return null;
  }
  G.seq++;
  return G.ev;
}

/* Apply actions transactionally. Rejected input must not partially alter the
   authoritative state, especially when it originated from an online guest. */
function dispatch(G,a){
  if(!G||!Array.isArray(G.players)||!Array.isArray(G.deck)||!Array.isArray(G.discard)||!a||typeof a.a!=='string')return null;
  if(!SUPPORTED_ACTIONS.has(a.a))return null;
  if(a.a!=='closeNope'&&(!Number.isInteger(a.pid)||!G.players[a.pid]))return null;
  if(a.a==='closeNope'&&(!G.pending||!G.players[G.pending.actor]))return null;

  let next,safeAction;
  try{
    next=JSON.parse(JSON.stringify(G));
    safeAction=JSON.parse(JSON.stringify(a));
  }catch(error){
    return null;
  }
  const events=applyAction(next,safeAction);
  if(events===null)return null;
  Object.keys(G).forEach(key=>delete G[key]);
  Object.assign(G,next);
  return G.ev;
}

if(typeof module!=='undefined'&&module.exports){
  module.exports={CARDS,CAT_TYPES,MIN_PLAYERS,MAX_PLAYERS,newGame,dispatch,classifyPlay,playNeedsTarget,shuffleArr};
}
