// 牌堆管理：抽/弃/洗/回看
export class Deck {
  constructor(cards = []) {
    this.draw = [];
    this.hand = [];
    this.discard = [];
    this.exhaust = [];
    this.cards = cards; // 总收藏（本局所有牌）
    cards.forEach((c) => this.draw.push({ uid: nextUid(), ...c }));
    this.shuffle();
  }

  shuffle(rng = Math.random) {
    for (let i = this.draw.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [this.draw[i], this.draw[j]] = [this.draw[j], this.draw[i]];
    }
  }

  drawN(n) {
    const got = [];
    for (let i = 0; i < n; i++) {
      if (this.draw.length === 0) {
        this.draw = this.discard;
        this.discard = [];
        this.shuffle();
      }
      if (this.draw.length === 0) break;
      got.push(this.draw.pop());
    }
    this.hand.push(...got);
    return got;
  }

  play(card) {
    const i = this.hand.findIndex((c) => c.uid === card.uid);
    if (i === -1) return false;
    this.discard.push(card);
    this.hand.splice(i, 1);
    return true;
  }

  discardFromHand(card) {
    const i = this.hand.findIndex((c) => c.uid === card.uid);
    if (i === -1) return false;
    this.discard.push(card);
    this.hand.splice(i, 1);
    return true;
  }

  peekDiscard(n) {
    return this.discard.slice(-n).reverse();
  }

  reclaimFromDiscard(card) {
    const i = this.discard.findIndex((c) => c.uid === card.uid);
    if (i === -1) return false;
    this.hand.push(this.discard.splice(i, 1)[0]);
    return true;
  }

  resetHand(startingCount = 5) {
    this.hand = [];
    this.discard = [];
    this.drawN(startingCount);
  }
}

let _uid = 0;
function nextUid() {
  _uid += 1;
  return 'c' + _uid;
}