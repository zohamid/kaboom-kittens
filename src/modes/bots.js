'use strict';

const BOT_NAMES = ['Biscuit 🤖', 'Mochi 🤖', 'Floof 🤖', 'Pretzel 🤖'];

/**
 * @typedef {Object} BotDeps
 * @property {function} dispatch
 * @property {function} processEvents
 * @property {function} afterChange
 * @property {function} getSnapshot
 * @property {Object} BOT_PEEK
 * @property {Object} CARDS
 * @property {string[]} CAT_TYPES
 */

/**
 * @param {BotDeps} deps
 * @returns {{
 *   botMove: () => void,
 *   chooseBotAction: (gameSnapshot: any, botMemory: any, random: () => number) => any,
 * }}
 */
export function createBotsModule(deps) {
  const { dispatch, processEvents, afterChange, getSnapshot, BOT_PEEK, CARDS, CAT_TYPES } = deps;

  const BOT_PREF_MAP = Object.fromEntries(
    ['CAT_SAMOSA', 'CAT_DISCO', 'CAT_PICKLE', 'CAT_MELON', 'CAT_TACHE', 'SHUFFLE', 'FAVOR', 'FUTURE', 'SKIP', 'ATTACK', 'NOPE', 'DEFUSE']
      .map((t, i) => [t, i])
  );

  function chooseBotAction(gameSnapshot, botMemory, random) {
    const G = gameSnapshot;
    const pid = G.turn;
    const P = G.players[pid];
    if (!P || !P.alive) return null;

    // Check for NOPE opportunity
    if (G.phase === 'nope' && G.pending && P.hand.includes('NOPE')) {
      const lastActor = G.pending.nopes.length ? G.pending.nopes[G.pending.nopes.length - 1] : G.pending.actor;
      if (pid !== lastActor) {
        let pr = G.pending.target === pid ? 0.5 : (G.pending.nopes.length ? 0.28 : 0.13);
        if (G.pending.kind === 'ATTACK' && G.turn === pid) pr = 0.5;
        if (random() < pr) return { a: 'nope', pid };
      }
    }

    // Check for defuse
    if (G.phase === 'defuse' && G.pendingBoom?.pid === pid) {
      const hasD = P.hand.includes('DEFUSE');
      return { a: 'defuse', pid, use: hasD };
    }

    // Check for insert
    if (G.phase === 'insert' && G.pendingBoom?.pid === pid) {
      const pos = random() < 0.5 ? 0 : Math.floor(random() * (G.deck.length + 1));
      return { a: 'insert', pid, pos };
    }

    // Check for favor give
    if (G.phase === 'favorGive' && G.pendingFavor?.from === pid) {
      if (!P.hand.length) return { a: 'give', pid, idx: 0 };
      // Bot prefers to give its worst card (lowest in BOT_PREF_MAP)
      let bestIdx = 0, bestVal = 99;
      P.hand.forEach((c, i) => {
        const v = BOT_PREF_MAP[c] ?? 99;
        if (v < bestVal) { bestVal = v; bestIdx = i; }
      });
      return { a: 'give', pid, idx: bestIdx };
    }

    // Regular turn - try to play cards, then draw
    if (G.phase === 'turn' && pid === G.turn) {
      // Try to play a card
      const playable = findPlayableCards(P.hand, G, pid);
      if (playable) {
        return { a: 'play', pid, cards: playable.cards, ...playable.extra };
      }
      // Otherwise draw
      return { a: 'draw', pid };
    }

    return null;
  }

  function findPlayableCards(hand, G, pid) {
    // Simplified bot logic - try pairs/triples/five first, then action cards
    const cats = hand.filter(c => CARDS[c]?.cat);
    const nonCats = hand.filter(c => !CARDS[c]?.cat);
    
    // Check for pairs
    for (const cat of CAT_TYPES) {
      const count = cats.filter(c => c === cat).length;
      if (count >= 2) {
        const targets = G.players.filter(p => p.alive && p.id !== pid);
        if (targets.length) return { cards: [cat, cat], extra: { target: targets[Math.floor(Math.random() * targets.length)].id } };
      }
    }
    // Check for triples
    for (const cat of CAT_TYPES) {
      const count = cats.filter(c => c === cat).length;
      if (count >= 3) {
        const targets = G.players.filter(p => p.alive && p.id !== pid);
        if (targets.length) {
          // Demand a card the target has
          const target = targets[Math.floor(Math.random() * targets.length)];
          const targetCards = target.hand.filter(c => CARDS[c]);
          const named = targetCards.length ? targetCards[Math.floor(Math.random() * targetCards.length)] : 'DEFUSE';
          return { cards: [cat, cat, cat], extra: { target: target.id, named } };
        }
      }
    }
    // Check for five different cats
    if (new Set(cats).size >= 5) {
      const uniqueCats = [...new Set(cats)].slice(0, 5);
      const discard = G.discard.filter(c => c !== 'BOOM');
      const avail = [...new Set(discard)];
      if (avail.length) return { cards: uniqueCats, extra: { wish: avail[Math.floor(Math.random() * avail.length)] } };
    }
    // Try action cards
    for (const card of nonCats) {
      if (['ATTACK', 'SKIP', 'FAVOR', 'SHUFFLE', 'FUTURE'].includes(card)) {
        if (card === 'FAVOR') {
          const targets = G.players.filter(p => p.alive && p.id !== pid);
          if (!targets.length) continue;
          return { cards: [card], extra: { target: targets[Math.floor(Math.random() * targets.length)].id } };
        }
        return { cards: [card], extra: {} };
      }
    }
    return null;
  }

  function botMove() {
    const snap = getSnapshot();
    const G = snap.G;
    const pid = G.turn;
    const P = G.players[pid];
    if (!P || !P.bot || !P.alive) return;
    
    const random = Math.random;
    const action = chooseBotAction(G, BOT_PEEK[pid] || {}, random);
    if (action) {
      const events = dispatch(action);
      if (events) {
        processEvents(events);
        afterChange();
      }
    }
  }

  return { botMove, chooseBotAction };
}