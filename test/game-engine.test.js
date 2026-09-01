'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAT_TYPES,
  classifyPlay,
  dispatch,
  newGame,
} from '../src/game-engine.js';

function gameWithHands(firstHand,secondHand){
  const game=newGame([{name:'Ada'},{name:'Grace'}]);
  game.players[0].hand=[...firstHand];
  game.players[1].hand=[...secondHand];
  game.deck=['FUTURE','SKIP'];
  game.discard=[];
  game.turn=0;
  game.turnsLeft=1;
  game.phase='turn';
  game.pending=null;
  game.pendingBoom=null;
  game.pendingFavor=null;
  game.winner=null;
  game.seq=0;
  game.ev=[];
  return game;
}

test('newGame deals a valid deck for two to five players',()=>{
  for(let count=2;count<=5;count++){
    const players=Array.from({length:count},(_,index)=>({name:`Player ${index}`}));
    const game=newGame(players);

    assert.equal(game.players.length,count);
    assert.equal(game.cats.length,5);
    assert.equal(new Set(game.cats).size,5);
    assert.ok(game.cats.every(type=>CAT_TYPES.includes(type)));
    assert.ok(game.players.every(player=>player.hand.length===8&&player.hand.includes('DEFUSE')));
    assert.equal(game.deck.filter(card=>card==='BOOM').length,count-1);
  }
});

test('newGame rejects unsupported player counts',()=>{
  assert.throws(()=>newGame([{name:'Solo'}]),RangeError);
  assert.throws(()=>newGame(Array.from({length:6},(_,index)=>({name:String(index)}))),RangeError);
});

test('classifyPlay rejects malformed and unknown selections',()=>{
  assert.equal(classifyPlay(),null);
  assert.equal(classifyPlay(['NOT_A_CARD','NOT_A_CARD']),null);
  assert.deepEqual(classifyPlay(['CAT_SAMOSA','CAT_SAMOSA']),{kind:'PAIR'});
});

test('rejected actions leave game state unchanged',()=>{
  const actions=[
    null,
    {a:'draw',pid:99},
    {a:'play',pid:0},
    {a:'unknown',pid:0},
  ];

  for(const action of actions){
    const game=gameWithHands(['SKIP'],['NOPE']);
    const before=structuredClone(game);
    assert.equal(dispatch(game,action),null);
    assert.deepEqual(game,before);
  }
});

test('Favor rejects out-of-range hand indexes without giving a card',()=>{
  for(const index of [-1,1,1.5]){
    const game=gameWithHands(['SKIP'],['NOPE']);
    game.phase='favorGive';
    game.pendingFavor={from:0,to:1};
    const before=structuredClone(game);

    assert.equal(dispatch(game,{a:'give',pid:0,idx:index}),null);
    assert.deepEqual(game,before);
  }
});

test('a played card can be Noped transactionally',()=>{
  const game=gameWithHands(['SKIP'],['NOPE']);

  assert.ok(dispatch(game,{a:'play',pid:0,cards:['SKIP']}));
  assert.equal(game.phase,'nope');
  assert.ok(dispatch(game,{a:'nope',pid:1}));
  assert.ok(dispatch(game,{a:'closeNope'}));

  assert.equal(game.phase,'turn');
  assert.equal(game.turn,0);
  assert.deepEqual(game.discard,['SKIP','NOPE']);
  assert.equal(game.seq,3);
});

test('the same player cannot Nope their own play',()=>{
  const game=gameWithHands(['SKIP','NOPE'],['NOPE']);
  assert.ok(dispatch(game,{a:'play',pid:0,cards:['SKIP']}));
  const before=structuredClone(game);

  assert.equal(dispatch(game,{a:'nope',pid:0}),null);
  assert.deepEqual(game,before);
});

test('accepted actions do not retain caller-owned arrays',()=>{
  const game=gameWithHands(['SKIP'],['NOPE']);
  const cards=['SKIP'];

  assert.ok(dispatch(game,{a:'play',pid:0,cards}));
  cards[0]='BOOM';

  assert.deepEqual(game.pending.cards,['SKIP']);
});

test('drawing a Kaboom and declining Defuse ends a two-player game',()=>{
  const game=gameWithHands(['DEFUSE'],['SKIP']);
  game.deck=['FUTURE','BOOM'];

  assert.ok(dispatch(game,{a:'draw',pid:0}));
  assert.equal(game.phase,'defuse');
  assert.ok(dispatch(game,{a:'defuse',pid:0,use:false}));

  assert.equal(game.phase,'over');
  assert.equal(game.winner,1);
  assert.equal(game.players[0].alive,false);
});
