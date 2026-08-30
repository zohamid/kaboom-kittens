'use strict';

/* ============================================================================
   ONLINE MODE — rooms synced through Firebase Realtime Database.

   Model: the HOST's device is authoritative. It owns the real game state and is
   the only one that calls the engine. Guests send actions to /inbox; the host
   drains that inbox, applies each action, and publishes the resulting state and
   event list back to the room. Everyone else just renders what they receive.
   That's why the host has to keep their window open.

   Room shape in the database:
     /kaboom/rooms/<CODE>
       status    'lobby' | 'playing'
       players   {0:{name}, 1:{name}, …}
       startReq  a guest asking the host to deal
       game      {s: JSON state, seq, ev: JSON events, evSeq}
       inbox     guest actions waiting for the host
       chat      messages and emoji reactions from anyone

   Transport: an EventSource stream for instant updates, plus a slower polling
   backstop in case that stream connects and then silently stalls.
   ============================================================================ */
const OL=(()=>{
  let db=null, code=null, myPid=null, isHost=false, es=null, pollIv=null, tree=null;
  let lastSeq=-1, lastEvSeq=-1, evSeq=0, hostTimer=null, started=false, uiPhaseKey='';
  /* `pub` is a publish counter that NEVER resets, unlike G.seq which starts
     again at 0 every round. Guests compare against this to decide whether a
     payload is newer than what they already have — comparing G.seq meant a
     brand new round (seq 0) looked older than the finished game (seq 30+) and
     was thrown away, which is what broke "Play again". */
  let pub=0, lastPub=-1;
  /* Which room player sits in which game seat. Room ids can have gaps once
     somebody quits, so seat index != room id and we must translate. */
  let seats=[];
  const seatIndex=()=>{const i=seats.indexOf(String(myPid));return i<0?0:i;};

  const base=()=>`${db}/kaboom/rooms/${code}`;
  /* One REST call against this room. Firebase speaks plain JSON over HTTP:
     GET reads, PUT replaces, PATCH merges, DELETE removes. */
  async function req(method,path,body){
    const r=await fetch(`${base()}${path}.json`,{method,body:body===undefined?undefined:JSON.stringify(body)});
    if(!r.ok)throw new Error('Database said no ('+r.status+'). Check the URL & that the database is in test mode.');
    return r.json();
  }
  const rnd=n=>Math.random().toString(36).slice(2,2+n);

  function err(msg){const e=$('#onlineErr');e.style.display='block';e.textContent=msg;}
  /* Turn a network failure into something a player can act on. */
  function friendly(e){return /fetch|network|load/i.test(e.message)?"Couldn't reach the database from this page. Heads-up: on the claude.ai-hosted version, online play is blocked by the page sandbox — use the downloadable game file for online rooms. (Bots and Pass & Play work everywhere!)":e.message;}
  function clearErr(){$('#onlineErr').style.display='none';}
  /* Validate and remember the database URL. */
  function normDb(){
    let v=($('#inpDb').value||'').trim().replace(/\/+$/,'');
    if(!/^https:\/\/.+(firebaseio\.com|firebasedatabase\.app)/.test(v)){err('That doesn\'t look like a Firebase Realtime Database URL — it should start with https:// and end with firebaseio.com or firebasedatabase.app');return null;}
    store.set('kk_db',v);return v;
  }
  /* This player's display name (remembered between visits). */
  function myName(){const v=($('#inpNameOn').value||'').trim()||'Cat '+rnd(3).toUpperCase();store.set('kk_name',v);return v;}

  const seenChat={};
  let chatPrimed=false;
  const BAKED_DB='https://kaboom-kittens-default-rtdb.asia-southeast1.firebasedatabase.app';

  /* ---------- lobby ---------- */
  $('#btnOnline').onclick=()=>{
    $('#inpDb').value=BAKED_DB||store.get('kk_db')||'';
    const pre=new URLSearchParams(location.search).get('room');
    if(pre)$('#inpRoom').value=pre.toUpperCase().slice(0,4);
    if(BAKED_DB)$('#onlineCfg').style.display='none';
    $('#inpNameOn').value=store.get('kk_name')||'';
    $('#onlineSetupPanel').style.display='';$('#lobbyPanel').style.display='none';clearErr();
    show('scr-online');
  };
  $('#btnCreateRoom').onclick=async()=>{
    clearErr();db=normDb();if(!db)return;
    code=Array.from({length:4},()=>'ABCDEFGHJKMNPQRSTUVWXYZ'[Math.floor(Math.random()*23)]).join('');
    try{
      await req('PUT','',{createdAt:Date.now(),status:'lobby',players:{0:{name:myName()}}});
      myPid=0;isHost=true;enterLobby();
    }catch(e){err(friendly(e));}
  };
  $('#btnJoinRoom').onclick=async()=>{
    clearErr();db=normDb();if(!db)return;
    code=($('#inpRoom').value||'').trim().toUpperCase();
    if(code.length!==4){err('Room codes are 4 letters.');return;}
    try{
      const room=await req('GET','');
      if(!room){err('No room with that code. Ask the host to create one first!');return;}
      if(room.status!=='lobby'){err('That game already started. Ask for a new room!');return;}
      const ids=Object.keys(room.players||{}).map(Number);
      if(ids.length>=5){err('Room is full (5 players max).');return;}
      isHost=false;
      const nm=myName();
      let slot=Math.max(...ids)+1, ok=false;
      for(let tries=0;tries<4&&!ok;tries++){
        await req('PATCH','/players',{[slot]:{name:nm}});
        const check=await req('GET','/players');
        if(check&&check[slot]&&check[slot].name===nm)ok=true;
        else slot++;
      }
      if(!ok){err('Couldn\'t grab a seat at the table — try joining again.');return;}
      myPid=slot;
      enterLobby();
    }catch(e){err(friendly(e));}
  };
  /* Show the lobby and start listening to the room. */
  function enterLobby(){
    started=false;lastSeq=-1;lastEvSeq=-1;evSeq=0;
    chatPrimed=false;Object.keys(seenChat).forEach(k=>delete seenChat[k]);$('#chatLog').innerHTML='';
    $('#onlineSetupPanel').style.display='none';
    $('#lobbyPanel').style.display='';
    $('#lobbyCode').textContent=code;
    updateLobbyControls(playerCountIn(tree));
    saveSession();
    listen();
  }
  const playerCountIn=t=>t&&t.players?Object.keys(t.players).filter(k=>t.players[k]).length:0;

  /* No countdown, no hidden state: the host presses Start when they're ready.
     A guest can ask, which just nudges the host's device. */
  $('#btnStartOnline').onclick=async()=>{
    if(!isHost){
      setLobbyMsg('Asked the host to deal — waiting…');
      req('PATCH','',{startReq:Date.now()}).catch(()=>setLobbyMsg("Couldn't reach the room — check your connection.",1));
      return;
    }
    let ps=playerCountIn(tree);
    if(ps<2){try{const fresh=await req('GET','');if(fresh){tree=fresh;onTree();ps=playerCountIn(tree);}}catch(e){}}
    if(ps<2){setLobbyMsg('You need at least one more player before you can deal.',1);return;}
    startGameAsHost();
  };
  function setLobbyMsg(t,warn){
    const w=$('#lobbyWait');w.style.display='';w.style.color=warn?'var(--boom-dk)':'var(--ink-soft)';w.textContent=t;
  }
  function updateLobbyControls(n){
    const b=$('#btnStartOnline');
    b.style.display='';
    b.disabled=n<2;
    if(isHost){
      b.textContent=n<2?'Waiting for players…':'Deal the cards ('+n+' players)';
      setLobbyMsg(n<2?'Share the code above. You choose when to start — nothing happens until you do.'
                     :'Everyone in? Hit the button when you\'re ready.');
    }else{
      b.textContent='Ask the host to start';
      setLobbyMsg(n<2?'Waiting for more players to join…':'Waiting for the host to deal — you can nudge them.');
    }
  }
  /* Host only: deal a fresh game to everyone currently in the room and publish
     it. Used for the first deal AND for every rematch — same code path, so a
     rematch can never drift out of step with a first game. */
  function startGameAsHost(){
    const keys=Object.keys(tree.players).filter(k=>tree.players[k]).sort((a,b)=>a-b);
    seats=keys;                                   // anyone who quit is simply not here
    const defs=keys.map(k=>({name:tree.players[k].name}));
    G=newGame(defs);MODE='online';selected=[];
    VIEW=seatIndex();
    closeModal();                                 // clear the game-over popup
    pushSync([{t:'newround'},
              {t:'log',msg:'Cards dealt — good luck! 🐱'},
              {t:'log',msg:"Today's cats: "+G.cats.map(c=>CARDS[c].name).join(', ')}],
             {status:'playing',startReq:null,rematchReq:null});
    startedNow();
  }
  /* Switch to the table once the game exists. */
  function startedNow(){
    started=true;show('scr-table');showChatUI(true);renderAll();hostPhaseDuties();
    logMsg('Tip: tap 💬 to chat, or use the emoji row to react!');
  }

  /* ---------- realtime tree sync ---------- */
  /* Write a value into our local mirror of the room at a '/a/b/c' path. */
  function setAtPath(obj,path,data){
    if(path==='/'||path===''){return data;}
    const parts=path.replace(/^\//,'').split('/');let o=obj||{};let cur=o;
    for(let i=0;i<parts.length-1;i++){cur[parts[i]]=cur[parts[i]]||{};cur=cur[parts[i]];}
    if(data===null)delete cur[parts[parts.length-1]];else cur[parts[parts.length-1]]=data;
    return o;
  }
  /* Subscribe to the room: live stream first, polling as a safety net. */
  function listen(){
    stopListen();
    try{
      es=new EventSource(`${base()}.json`);
      es.addEventListener('put',ev=>{try{const {path,data}=JSON.parse(ev.data);tree=setAtPath(tree,path,data);onTree();}catch(e){}});
      /* Firebase 'patch' events are a MERGE, not a replace: when a second
         player joins we receive {"1":{name}} for /players and must add that key
         rather than overwrite the whole node. Getting this wrong silently makes
         the host see only the newest player. Note Firebase also returns
         integer-keyed objects as sparse arrays, hence the null skip. */
      es.addEventListener('patch',ev=>{try{const {path,data}=JSON.parse(ev.data);
        if(data&&typeof data==='object'){
          const p=path==='/'?'':path.replace(/\/$/,''), isArr=Array.isArray(data);
          for(const k of Object.keys(data)){if(isArr&&data[k]===null)continue;tree=setAtPath(tree,p+'/'+k,data[k]);}
        }else tree=setAtPath(tree,path,data);
        onTree();}catch(e){}});
      es.onerror=()=>startPolling(1500);
    }catch(e){startPolling(1500);}
    startPolling(3000); // backstop: the stream can connect and still stall
  }
  /* Re-read the whole room on a timer. Cheap insurance against a dead stream. */
  function startPolling(ms){
    if(pollIv)return;
    pollIv=setInterval(async()=>{try{const fresh=await req('GET','');if(fresh){tree=fresh;onTree();}}catch(e){}},ms);
  }
  /* Drop both the stream and the poll. */
  function stopListen(){if(es){es.close();es=null;}if(pollIv){clearInterval(pollIv);pollIv=null;}}

  /* Called every time our copy of the room changes: update the lobby, pick up
     new game state, drain the inbox if we're the host. */
  function onTree(){
    if(!tree){ // room deleted
      if(started){modal('<h2>Room closed</h2><p class="mtext">The host left the game.</p><div class="mrow"><button class="btn" onclick="OL.leave();closeModal()">Menu</button></div>');}
      return;
    }
    if(!started){
      const lp=$('#lobbyPlayers');lp.innerHTML='';
      const ps=tree.players||{};
      Object.keys(ps).filter(k=>ps[k]).sort((a,b)=>a-b).forEach(k=>{
        lp.insertAdjacentHTML('beforeend',`<span class="chip ${+k===myPid?'sel':''}">${ps[k].name}${+k===0?' 👑':''}</span>`);
      });
      if(tree.status==='playing'&&tree.game){applyRemoteGame();if(G){MODE='online';VIEW=myPid;startedNow();}return;}
      drainChat();
      const n=playerCountIn(tree);
      if(isHost&&tree.startReq&&n>=2){startGameAsHost();return;}
      updateLobbyControls(n);
      return;
    }
    drainChat();
    if(isHost){
      drainInbox();
      /* A guest tapped "Play again" while we were sitting on the game-over
         screen — deal the next round for everyone. */
      if(tree.rematchReq&&G&&G.phase==='over')startGameAsHost();
      return;                        // host is source of truth for game state
    }
    applyRemoteGame();
  }
  /* Guest side: adopt newer state from the host and replay its events.
     Anything with seq <= lastSeq is old news and ignored. */
  function applyRemoteGame(){
    const g=tree.game;
    if(!g)return;
    /* Prefer the never-resetting publish counter; fall back to seq only if an
       older client published without one. */
    if(g.pub!=null){ if(g.pub<=lastPub)return; lastPub=g.pub; }
    else if(g.seq==null||g.seq<=lastSeq)return;
    lastSeq=g.seq;
    if(g.seats){try{seats=JSON.parse(g.seats);}catch(e){}}
    VIEW=seatIndex();                              // our chair may have moved
    G=JSON.parse(g.s);
    // arrays survive JSON stringify — restore defaults just in case
    G.players.forEach(p=>{p.hand=p.hand||[]});G.deck=G.deck||[];G.discard=G.discard||[];
    let evs=[];
    if(g.evSeq!=null&&g.evSeq>lastEvSeq){lastEvSeq=g.evSeq;try{evs=JSON.parse(g.ev)||[]}catch(e){}}
    if(started){processEvents(evs);onlinePhaseUI();}
  }

  /* ---------- host duties ---------- */
  /* Host side: publish the current state plus the events it produced. */
  async function pushSync(evs,extra){
    tree=tree||{};tree.status='playing';
    tree.game={s:JSON.stringify(G),seq:G.seq,pub:++pub,seats:JSON.stringify(seats),
               ev:JSON.stringify(evs||[]),evSeq:++evSeq};
    saveSession();
    lastSeq=G.seq;lastEvSeq=evSeq;lastPub=pub;
    try{await req('PATCH','',Object.assign({game:tree.game},extra||{}));}catch(e){logMsg('⚠️ Sync hiccup — retrying…');setTimeout(()=>pushSync([],{}),1200);}
  }
  const seenInbox={};
  /* Host side: apply every guest action waiting in the room, then delete it. */
  async function drainInbox(){
    const ib=tree.inbox||{};
    for(const k of Object.keys(ib)){
      if(seenInbox[k])continue;seenInbox[k]=1;
      const m=ib[k];
      req('DELETE','/inbox/'+k).catch(()=>{});
      if(m&&m.action)hostApply(m.action);
    }
  }
  /* Host only: apply one action to the real game and publish the result. */
  function hostApply(action){
    if(!G)return;
    const ev=dispatch(G,action);
    if(ev===null)return;
    if(G.phase==='nope')G.nopeUntil=Date.now()+NOPE_MS;else delete G.nopeUntil;
    pushSync(ev);
    processEvents(ev);
    onlinePhaseUI();
    hostPhaseDuties();
  }
  function hostPhaseDuties(){
    if(hostTimer){clearTimeout(hostTimer);hostTimer=null;}
    if(!G||G.phase!=='nope')return;
    const last=G.pending.nopes.length?G.pending.nopes[G.pending.nopes.length-1]:G.pending.actor;
    const anyNoper=G.players.some(p=>p.alive&&p.id!==last&&p.hand.includes('NOPE'));
    hostTimer=setTimeout(()=>hostApply({a:'closeNope'}),anyNoper?NOPE_MS:900);
  }

  /* ---------- per-client phase UI ---------- */
  /* Show whatever this device is being asked for right now: nope window,
     defuse choice, where to hide the kitten, which card to give away. */
  function onlinePhaseUI(){
    const key=G?`${G.phase}|${G.seq<0?0:''}${G.phase==='nope'?G.pending.nopes.length:''}`:'';
    if(key!==uiPhaseKey){closePhaseModal();uiPhaseKey=key;}
    if(!G||G.phase==='over'){stopNopeClock();return;}
    if(G.phase!=='nope')stopNopeClock();
    if(G.phase==='nope'){
      const last=G.pending.nopes.length?G.pending.nopes[G.pending.nopes.length-1]:G.pending.actor;
      if(myPid!==last&&G.players[myPid].alive&&G.players[myPid].hand.includes('NOPE')){
        modal(`<h2>Quick — Nope it?</h2><p class="mtext">${G.players[last].name} played ${G.pending.nopes.length?'a Nope':CARDS[G.pending.cards[0]].name}${G.pending.target===myPid?' <b>on YOU</b>':''}.</p>
          ${npClockHTML}
          <div class="mrow"><button class="btn big boom" id="mNope">NOPE! ✋</button><button class="btn" id="mLet">Let it happen</button></div>`);
        startNopeClock(NOPE_MS);
        $('#mNope').onclick=()=>{stopNopeClock();closeModal();send({a:'nope',pid:myPid});};
        $('#mLet').onclick=()=>{stopNopeClock();closeModal();};
      }
      return;
    }
    if(G.phase==='defuse'&&G.pendingBoom.pid===myPid){
      const hasD=G.players[myPid].hand.includes('DEFUSE');
      modal(`<h2>💣 KABOOM KITTEN!</h2><div style="width:130px;margin:0 auto">${ART.BOOM()}</div>
        <p class="mtext">${hasD?'Stay paws-itive — you have a <b>Defuse</b>!':'You have <b>no Defuse</b>… what a cat-astrophe.'}</p>
        <div class="mrow">${hasD?'<button class="btn big sun" id="mDef">✂️ Defuse it!</button>':''}<button class="btn ${hasD?'':'big '}boom" id="mDie">💥 Explode</button></div>`);
      const d=$('#mDef');if(d)d.onclick=()=>{closeModal();send({a:'defuse',pid:myPid,use:true});};
      $('#mDie').onclick=()=>{closeModal();send({a:'defuse',pid:myPid,use:false});};
      return;
    }
    if(G.phase==='insert'&&G.pendingBoom.pid===myPid){
      openInsertPicker(G.deck.length,pos=>send({a:'insert',pid:myPid,pos}));
      return;
    }
    if(G.phase==='favorGive'&&G.pendingFavor&&G.pendingFavor.from===myPid){
      const p=G.players[myPid];
      modal(`<h2>Favor for ${G.players[G.pendingFavor.to].name}</h2><p class="mtext">Choose one of your cards to give away. Sharing is purring.</p>
        <div class="cardpick">${p.hand.map((c,i)=>`<div data-i="${i}">${cardHTML(c,'mini')}</div>`).join('')}</div>`);
      $$('#modal [data-i]').forEach(d=>d.onclick=()=>{closeModal();send({a:'give',pid:myPid,idx:+d.dataset.i});});
    }
  }

  /* Share link: the code in the URL so a friend lands straight in the join box. */
  function inviteLink(){
    const u=new URL(location.href); u.hash=''; u.searchParams.set('room',code);
    return u.toString();
  }
  $('#btnCopyCode').onclick=async()=>{
    const btn=$('#btnCopyCode'), link=inviteLink();
    try{await navigator.clipboard.writeText(link);}
    catch(e){
      const ta=document.createElement('textarea');ta.value=link;document.body.appendChild(ta);
      ta.select();try{document.execCommand('copy');}catch(_){}ta.remove();
    }
    btn.textContent='✅ Copied!';sPop();
    setTimeout(()=>btn.textContent='📋 Copy invite link',1800);
  };

  /* ---------- surviving a reload ---------- */
  function saveSession(){
    try{store.set('kk_room',JSON.stringify({db,code,myPid,isHost,t:Date.now()}));}catch(e){}
  }
  function clearSession(){store.set('kk_room','');}
  /* Rejoin a room we were already in: pull the live state and slot back into our seat. */
  async function rejoin(s){
    db=s.db;code=s.code;myPid=s.myPid;isHost=s.isHost;
    const room=await req('GET','');
    if(!room)throw new Error('gone');
    tree=room;
    MODE='online';VIEW=myPid;
    if(room.status==='playing'&&room.game){
      G=JSON.parse(room.game.s);
      if(room.game.seats){try{seats=JSON.parse(room.game.seats);}catch(e){}}
      VIEW=seatIndex();
      lastSeq=room.game.seq;lastEvSeq=room.game.evSeq||0;evSeq=room.game.evSeq||0;
      pub=room.game.pub||0;lastPub=pub;
      started=true;show('scr-table');showChatUI(true);renderAll();
      logMsg('Reconnected — you\'re back at the table.');
      listen();hostPhaseDuties();onlinePhaseUI();
    }else{
      enterLobby();
    }
  }

  /* ---------- chat & reactions ---------- */
  function pushChat(obj){
    if(!db||!code)return;
    req('PUT','/chat/'+Date.now()+'_'+rnd(4),obj).catch(()=>logMsg('⚠️ Message didn\'t send.'));
  }
  function chat(text){pushChat({n:myName(),m:String(text).slice(0,140),p:myPid});}
  function react(emo){pushChat({n:myName(),r:String(emo).slice(0,4),p:myPid});}
  /* Render chat/reactions we haven't shown yet. On first load we mark existing
     messages as seen so a joiner doesn't get the whole backlog replayed. */
  function drainChat(){
    const c=tree&&tree.chat;
    if(!c){chatPrimed=true;return;}   // nothing yet: we're primed for whatever comes next
    const keys=Object.keys(c).sort();
    keys.forEach(k=>{
      if(seenChat[k])return;   // already rendered
      seenChat[k]=1;
      if(!chatPrimed)return;            // don't replay history on join
      const m=c[k]; if(!m)return;
      if(m.r)floatReaction(m.n||'Someone',m.r,m.p);
      else if(m.m){addChatLine(m.n||'Someone',m.m,m.p===myPid);if(m.p!==myPid)sChat();}
    });
    chatPrimed=true;
    if(isHost&&keys.length>60)keys.slice(0,keys.length-40).forEach(k=>req('DELETE','/chat/'+k).catch(()=>{}));
  }

  /* ---------- public ---------- */
  /* Submit a move: the host applies it directly, a guest posts it to /inbox. */
  function send(action){
    if(isHost)hostApply(action);
    else req('PUT','/inbox/'+Date.now()+'_'+rnd(4),{pid:myPid,action}).catch(()=>logMsg('⚠️ Couldn\'t reach the room — check your internet.'));
  }
  /* Tear down: stop listening, delete the room if we're the host, forget it. */
  function leave(){
    stopListen();
    if(isHost&&db&&code)req('DELETE','').catch(()=>{});
    clearSession();
    if(hostTimer)clearTimeout(hostTimer);
    started=false;tree=null;G=null;MODE=null;chatPrimed=false;
    showChatUI(false);$('#chatLog').innerHTML='';
  }
  /* "Play again". A guest can only ask — the host owns the deck — so we drop a
     rematchReq in the room and the host picks it up in onTree(). */
  function restart(){
    if(!isHost){
      req('PATCH','',{rematchReq:Date.now()})
        .then(()=>logMsg('Asked the host for another round…'))
        .catch(()=>logMsg('⚠️ Couldn\'t reach the room.'));
      return 'asked';
    }
    startGameAsHost();                             // one code path for every deal
    return 'dealt';
  }
  /* Someone opened an invite link (…?room=ABCD). This runs at the very end of
     the file — the click handlers above must already be wired, which is exactly
     why the earlier attempt from the UI layer silently did nothing. */
  function openInvite(){
    const wanted=(new URLSearchParams(location.search).get('room')||'').toUpperCase().slice(0,4);
    if(!wanted)return;
    $('#btnOnline').click();
    $('#inpRoom').value=wanted;
    const saved=(store.get('kk_name')||'').trim();
    if(saved){
      $('#inpNameOn').value=saved;
      setTimeout(()=>{clearErr();$('#btnJoinRoom').click();},250);   // straight into the lobby
    }else{
      $('#inpNameOn').focus();
      err('Pop your name in and hit Join to enter room '+wanted+'.');
      $('#onlineErr').style.borderColor='var(--sky)';
      $('#onlineErr').style.color='var(--ink-soft)';
    }
  }

  /* Quit deliberately: tell the table so the game can carry on without us. */
  function quit(){
    if(!started){                                  // still in the lobby: just free the seat
      if(!isHost&&myPid!=null)req('DELETE','/players/'+myPid).catch(()=>{});
      leave();show('scr-title');return;
    }
    if(isHost){
      pushChat({n:myName(),m:'(the host left — this room is closing)',p:myPid});
      setTimeout(()=>{leave();show('scr-title');},350);
      return;
    }
    send({a:'leave',pid:myPid});                    // host removes us and play continues
    setTimeout(()=>{
      req('DELETE','/players/'+myPid).catch(()=>{});  // and give up the seat for good
      leave();show('scr-title');
    },450);
  }

  return {send,leave,restart,chat,react,saveSession,clearSession,rejoin,quit,openInvite};
})();

/* Kick off an invite link once every handler above is in place. */
OL.openInvite();
