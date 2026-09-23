import { describe, it, expect } from 'vitest';
import { Deck } from '../src/deck.js';

const sample = [
  { id: 'a', cost: 1 }, { id: 'a', cost: 1 }, { id: 'b', cost: 2 }, { id: 'c', cost: 3 },
];

describe('Deck', () => {
  it('自动洗牌并抽牌后进手牌', () => {
    const d = new Deck(sample.map((c) => ({ ...c })));
    expect(d.draw.length).toBe(sample.length);
    const got = d.drawN(2);
    expect(got.length).toBe(2);
    expect(d.hand.length).toBe(2);
    expect(d.draw.length).toBe(sample.length - 2);
  });

  it('抽空后从弃牌堆洗回', () => {
    const d = new Deck(sample.map((c) => ({ ...c })));
    d.drawN(4);
    expect(d.draw.length).toBe(0);
    d.hand.forEach((c) => d.discard.push(c));
    d.hand = [];
    const got = d.drawN(4);
    expect(got.length).toBe(4); // 洗回全部
    expect(d.draw.length).toBe(0);
  });

  it('play 只在手牌时生效', () => {
    const d = new Deck(sample.map((c) => ({ ...c })));
    const cards = d.drawN(1);
    const first = cards[0];
    expect(d.play(first)).toBe(true);
    expect(d.hand.length).toBe(0);
    expect(d.discard.length).toBe(1);
    expect(d.play(first)).toBe(false); // 已不在手牌
  });

  it('peekDiscard 返回最近弃置的牌', () => {
    const d = new Deck(sample.map((c) => ({ ...c })));
    d.drawN(1);
    const card = d.hand[0];
    d.play(card);
    expect(d.peekDiscard(1)[0].id).toBe(card.id);
  });

  it('reclaimFromDiscard 回收弃牌堆牌到手牌', () => {
    const d = new Deck(sample.map((c) => ({ ...c })));
    d.drawN(1);
    const card = d.hand[0];
    d.play(card);
    expect(d.reclaimFromDiscard(card)).toBe(true);
    expect(d.hand.length).toBe(1);
  });
});