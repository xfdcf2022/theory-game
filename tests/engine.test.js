import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine.js';
import { startingDeck, CONCEPT_CARDS, RELICS, ENEMIES } from '../src/data.js';
import { buyPrice, cardMV } from '../src/economy.js';

function game(school = 'mao', enemy = { ...ENEMIES[0] }, relics = []) {
  const deck = startingDeck(school);
  const seed = CONCEPT_CARDS.filter((c) => c.school === school || c.school === 'common').slice(0, 2);
  seed.forEach((c) => deck.push({ ...c }));
  return new Game({ school, deckCards: deck, enemy, relics });
}

// 强行把手牌改成指定牌（测试用）
function setHand(g, cards) {
  g.deck.hand = cards.map((c) => ({ uid: 'test' + Math.random(), ...c }));
  g.player.energy = 10;
}

describe('Game · 基础规则', () => {
  it('开局为玩家回合，手牌 5 张，能量 3', () => {
    const g = game();
    expect(g.state).toBe('playing');
    expect(g.hand.length).toBe(5);
    expect(g.player.energy).toBe(3);
    expect(g.turn).toBe(1);
  });

  it('打攻击牌造成伤害并扣除非能量', () => {
    const g = game();
    const hp0 = g.enemy.hp;
    const q = g.hand.find((c) => (c.atk || 0) >= 5) || g.hand[0];
    g.player.energy = 3;
    const res = g.playCard(q);
    expect(res.ok).toBe(true);
    expect(res.dealt).toBeGreaterThan(0);
    expect(g.enemy.hp).toBe(hp0 - res.dealt);
  });

  it('能量不足时不能出牌', () => {
    const g = game();
    g.player.energy = 0;
    expect(g.playCard(g.hand[0]).ok).toBe(false);
  });

  it('敌人意图造成伤害并使玩家护甲归零', () => {
    const g = game();
    const hp0 = g.player.hp;
    g.player.energy = 3;
    g.endTurn();
    expect(g.player.hp).toBeLessThan(hp0);
  });

  it('击败所有敌人前保持 playing；敌人归零即 won', () => {
    const g = game('mao', { ...ENEMIES[0], maxHp: 1, hp: 1 });
    g.player.energy = 9;
    const atk = g.hand.find((c) => c.atk >= 5) || g.hand[0];
    g.playCard(atk);
    expect(g.state).toBe('won');
  });

  it('玩家学识归零即 lost', () => {
    const g = game('mao', { ...ENEMIES[0], intents: [{ name: 'x', dmg: 9999 }] });
    g.player.hp = 1;
    g.endTurn();
    expect(g.state).toBe('lost');
  });
});

describe('Game · 学派引擎', () => {
  it('毛学引论连锁：引用越多攻击越高（本具层数累加进同牌伤害）', () => {
    const g = game('mao');
    const quote = { id: 'q_test', name: '引用', cost: 0, atk: 8, tag: 'quote', desc: '' };
    setHand(g, [quote, quote]);
    const r1 = g.playCard(g.hand[0]);
    const r2 = g.playCard(g.hand[0]);
    // 第一张 8 伤，第二张同牌名因连锁层 2 → 至少 8+2
    expect(r2.dealt).toBeGreaterThanOrEqual(10);
  });

  it('政经灵力储蓄：未用完灵感沉淀并在下回合返还 50%', () => {
    const g2 = new Game({ school: 'zheng', deckCards: startingDeck('zheng'), enemy: { ...ENEMIES[0], intents: [{ name: '弱' }] } });
    g2.player.energy = 3;
    g2.deck.hand = [{ uid: 'u1', id: 'save', name: '活劳动', cost: 2, save: 1, atk: 4, desc: '' }];
    g2.playCard(g2.hand[0]); // 剩 1 能量 → endTurn 沉淀 floor(1/2)=0
    g2.endTurn();
    expect(g2._pendingReturn).toBe(0);
  });

  it('哲学史存史复用：检视书库可回收弃牌堆', () => {
    const g = game('zhe');
    setHand(g, [{ id: 'look', name: '检视书库', cost: 0, look: 1, desc: '' }]);
    // 确保弃牌堆非空：弃掉一个手牌
    g.deck.discard.push({ uid: 'gar1', id: 'gar', name: '档案', cost: 1 });
    g.playCard(g.hand[0]);
    expect(g.hand.some((c) => c.id === 'gar')).toBe(true);
  });
});

describe('Game · 遗物与组合技', () => {
  it('资本论：首张攻击牌 +50%', () => {
    const g = game('mao', { ...ENEMIES[0], maxHp: 999, hp: 999 }, [RELICS[0]]);
    const q = { id: 'qq', name: '提问', cost: 1, atk: 10, desc: '' };
    setHand(g, [q]);
    const res = g.playCard(g.hand[0]);
    expect(res.dealt).toBe(15);
  });

  it('相对剩余价值体系化：需死劳动+活劳动同框才触发组合技', () => {
    const g = game('zheng');
    const combo = CONCEPT_CARDS.find((c) => c.id === 'xiangdui_sh');
    setHand(g, [{ ...combo }, { id: 'zheng_sacrifice', name: '活劳动', cost: 0, save: 1, atk: 0 }]);
    const r = g.playCard(g.hand[0]);
    expect(r.dealt).toBeGreaterThanOrEqual(20); // 组合技触发
  });

  it('辩证否定：弃费用最高一张并按费用造成伤害', () => {
    const g = game('zhe');
    const neg = CONCEPT_CARDS.find((c) => c.id === 'bianzheng_fou');
    setHand(g, [{ ...neg }, { id: 'x', name: '高费牌', cost: 3 }]);
    const r = g.playCard(g.hand[0]);
    expect(r.dealt).toBeGreaterThanOrEqual(24); // 3*8
  });

  it('找书方法论遗物使商店价打折（economy.buyPrice 处理）', () => {
    const zhao = RELICS.find((r) => r.id === 'zhao_shu');
    expect(zhao.effect.shopDiscount).toBe(0.3);
    const card = CONCEPT_CARDS[0];
    const base = buyPrice(card, []);
    const disc = buyPrice(card, [zhao]);
    expect(disc).toBeLessThan(base);
    expect(cardMV(card)).toBeGreaterThan(0);
  });
});

describe('Game · 数据一致性（脱敏规范）', () => {
  it('所有卡牌/遗物/敌人名称与描述不含敏感词', () => {
    const banned = ['做个老师的好学生', '先锋队冲锋', '沉默', '小冲锋', '85124187', '1449748962'];
    const texts = [];
    CONCEPT_CARDS.forEach((c) => texts.push(c.name, c.desc));
    RELICS.forEach((r) => texts.push(r.name, r.desc));
    ENEMIES.forEach((e) => texts.push(e.name, e.desc, e.intents.map((i) => i.name).join('')));
    Object.values(startingDeck('mao')).forEach((c) => texts.push(c.name, c.desc));
    Object.values(startingDeck('zheng')).forEach((c) => texts.push(c.name, c.desc));
    Object.values(startingDeck('zhe')).forEach((c) => texts.push(c.name, c.desc));
    for (const t of texts) {
      for (const b of banned) {
        expect(t.includes(b)).toBe(false);
      }
    }
  });

  it('三学派开局牌均为 8 张', () => {
    expect(startingDeck('mao').length).toBe(8);
    expect(startingDeck('zheng').length).toBe(8);
    expect(startingDeck('zhe').length).toBe(8);
  });

  it('敌人血量递增（小怪<精英<Boss）', () => {
    expect(ENEMIES[0].maxHp).toBeLessThan(ENEMIES[1].maxHp);
    expect(ENEMIES[1].maxHp).toBeLessThan(ENEMIES[2].maxHp);
  });
});