'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

test('game engine exports are available', async () => {
  const { newGame, dispatch, classifyPlay, CARDS, CAT_TYPES } = await import('../src/game-engine.js');
  assert.equal(typeof newGame, 'function');
  assert.equal(typeof dispatch, 'function');
  assert.equal(typeof classifyPlay, 'function');
  assert.ok(CARDS);
  assert.ok(CAT_TYPES);
});

test('art exports are available', async () => {
  const { ART, CARD_BACK_ART, HERO_ART, catHead, svgWrap, star } = await import('../src/art.js');
  assert.ok(ART);
  assert.equal(typeof ART.BOOM, 'function');
  assert.equal(typeof CARD_BACK_ART, 'function');
  assert.equal(typeof HERO_ART, 'function');
  assert.equal(typeof catHead, 'function');
  assert.equal(typeof svgWrap, 'function');
  assert.equal(typeof star, 'function');
});

test('online exports are available', async () => {
  const { createOnlineClient } = await import('../src/online.js');
  assert.equal(typeof createOnlineClient, 'function');
});