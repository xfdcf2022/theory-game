import { Deck } from './deck.js';

// 战斗引擎：纯逻辑、无 DOM 依赖，供 vitest 与 UI 共用
// 三学派引擎钩子 + 遗物 + 意图系统
export class Game {
  constructor({ school, deckCards, enemy, relics = [], mod = {} }) {
    this.school = school;
    this.deck = new Deck(deckCards);
    this.enemy = { ...enemy, hp: enemy.maxHp, guard: 0 };
    this.relics = relics;
    this.mod = mod;
    this.player = { maxHp: 60, hp: 60, guard: 0, energy: 3 };
    this.state = 'playing';
    this.turn = 0;
    this.logs = [];
    this._intentIdx = 0;
    this._lastEnemyDmg = 0;
    this._doubtInTurn = false;
    this._firstAttackInTurn = true;
    this._playedSinceSweep = 0;
    this._lastPlayedAtk = 0;
    this._enemyMirror = 0;
    this._discardPower = 0;
    this._lastDiscards = 0;
    this.schoolStats = { chain: 0, saved: 0, discards: 0 };
    this._pendingReturn = 0;
    this._turnsSinceRegen = 0;
    this.start();
  }

  get hand() { return this.deck.hand; }

  intent() {
    const list = this.enemy.intents || [];
    return list[this._intentIdx % Math.max(1, list.length)];
  }

  start() {
    this.turn = 1;
    this.deck.resetHand(5);
    this.player.energy = 3;
    // 学派首回合能量 +1（实践论）
    const ef = this.relics.find((r) => r.effect && r.effect.energyFirst);
    if (ef) { this.player.energy += 1; this.log(`【${ef.name}】首回合能量+1`); }
    const efb = this.relics.find((r) => r.effect && r.effect.energyFirstBoss);
    if (efb && this.enemy.kind === 'Boss') { this.player.energy += efb.effect.energyFirstBoss; this.log(`【${efb.name}】Boss首回合能量+${efb.effect.energyFirstBoss}`); }
    // 五二零宣言刃：开局连锁 +1
    const cs = this.relics.find((r) => r.effect && r.effect.chainStart);
    if (cs && this.school === 'mao') { this.schoolStats.chain += cs.effect.chainStart; this.log(`【五二零宣言刃】连锁层 +${cs.effect.chainStart}`); }
    const drawRelic = this.relics.find((r) => r.effect && r.effect.drawOnStart);
    if (drawRelic) {
      const got = this.deck.drawN(drawRelic.effect.drawOnStart);
      this.log(`【${drawRelic.name}】开战抽 ${got.length} 张`);
    }
    this.log(`【开始】驳倒「${this.enemy.name}」（剩余 ${this.enemy.hp}/${this.enemy.maxHp}）`);
    this.announce();
  }

  announce() {
    const a = this.intent();
    if (!a) { this.log(`【意图】${this.enemy.name}做好了准备。`, 'enemy'); return; }
    this.log(`【意图】${this.enemy.name}正准备「${a.name}」${a.dmg ? `（${a.dmg} 伤）` : ''}`, 'enemy');
  }

  // 打出一张手牌
  playCard(card) {
    if (this.state !== 'playing') return { ok: false, reason: '战斗已结束' };
    const inHand = this.deck.hand.find((c) => c.uid === card.uid);
    if (!inHand) return { ok: false, reason: '不在手牌' };

    // 误读（旧名词之雾）：引文牌 30% 费用 +1
    let cost = card.cost;
    if (card.tag === 'quote' && this.mod.misread && Math.random() < this.mod.misread) {
      cost += 1;
      this.log('【误读】这张引文被误读了，费用 +1', 'enemy');
    }
    if (cost > this.player.energy) return { ok: false, reason: '灵感不足' };

    this.player.energy -= cost;
    this.deck.discardFromHand(card);

    let atk = 0, guard = 0;
    const notes = [];

    // 学派：毛学「引论连锁」——每次打出引用牌，本局同牌名攻击+1
    if (this.school === 'mao' && card.tag === 'quote') {
      this.schoolStats.chain += 1;
      atk += this.schoolStats.chain;
    }

    // 基础攻击 + 连锁/历史加成
    let base = card.atk || 0;
    if (card.atkScaleChain) base = card.atkScaleChain * this.schoolStats.chain;
    if (card.chainReq && this.schoolStats.chain >= card.chainReq) base += card.chainBonus || 0;
    if (card.history) base += 2 * Math.min(this.schoolStats.discards, 3);
    atk += base;

    if (card.tag === 'doubt') this._doubtInTurn = true;
    if (card.metaIfDoubt && this._doubtInTurn) atk *= card.metaIfDoubt;
    if (guard === undefined) guard = card.guard || 0;
    guard = card.guard || 0;

    // 抽牌 / 存史复用（回收弃牌堆最近弃置的非本牌）
    if (card.draw) { const got = this.deck.drawN(card.draw); notes.push(`抽${got.length}`); }
    if (card.look) {
      const top = [...this.deck.discard].reverse().find((c) => c.uid !== card.uid);
      if (top) { this.deck.reclaimFromDiscard(top); notes.push(`回收「${top.name}」`); }
    }

    // 辩证否定：弃费用最高一张
    if (card.discardHighest) {
      const cand = this.deck.hand.filter((c) => c.uid !== card.uid);
      if (cand.length) {
        const top = cand.reduce((a, b) => (b.cost > a.cost ? b : a));
        this.deck.discardFromHand(top);
        this.schoolStats.discards += 1;
        this._lastDiscards += 1;
        atk += (top.cost || 1) * card.atkScale;
        notes.push(`弃「${top.name}」`);
      }
    }

    // 政经灵力储蓄
    if (card.save) this.schoolStats.saved += card.save;

    // 组合技：需要两张概念牌在收藏（本局获得过）
    if (card.combo) {
      const have = card.combo.every((id) => this.deck.cards.some((c) => c.id === id));
      if (have) { atk += card.atk; notes.push(`组合技+${card.atk}`); }
    }

    // 在场历史唯物：弃牌反击
    if (card.power && card.power.onDiscard) this._discardPower += card.power.onDiscard;
    if (this._discardPower && this._lastDiscards > 0) {
      atk += this._discardPower * this._lastDiscards;
      notes.push(`弃牌反击+${this._discardPower * this._lastDiscards}`);
    }
    this._lastDiscards = 0;

    // 资本论：首张攻击牌 +50%
    if (atk > 0 && this._firstAttackInTurn) {
      const ziben = this.relics.find((r) => r.effect.firstAttackBoost);
      if (ziben) { atk = Math.round(atk * ziben.effect.firstAttackBoost); notes.push(`资本论+50%`); }
      this._firstAttackInTurn = false;
    }

    // 镜像收敛（Act 5）：敌人复制你上一张打出的攻击
    if (atk > 0) this._lastPlayedAtk = atk;

    // 高墙删减（Act 3）：每 3 回把手牌塞回牌库 1 张
    if (this.mod.sweepBack) {
      this._playedSinceSweep += 1;
      if (this._playedSinceSweep >= this.mod.sweepBack) {
        this._playedSinceSweep = 0;
        if (this.deck.hand.length > 1) {
          const swept = this.deck.hand.pop();
          this.deck.draw.unshift(swept);
          this.log('【高墙删减】一张手牌被塞回牌库', 'enemy');
        }
      }
    }

    // 结算伤害 / 玩家护甲
    let dealt = 0, enemyGuardAbsorb = 0;
    if (atk > 0) {
      if (this.enemy.guard > 0) { enemyGuardAbsorb = Math.min(this.enemy.guard, atk); this.enemy.guard -= enemyGuardAbsorb; }
      dealt = Math.max(0, atk - enemyGuardAbsorb);
      this.enemy.hp = Math.max(0, this.enemy.hp - dealt);
    }
    this.player.guard += guard;

    const desc = notes.length ? notes.join('，') + '，' : '';
    this.log(`【${card.name}】${desc}${dealt ? `${dealt} 伤` : '无伤'}${guard ? `，护甲+${guard}` : ''}`);

    if (this.enemy.hp <= 0) { this.state = 'won'; this.log(`【胜利】驳倒了「${this.enemy.name}」`, 'good'); }

    return { ok: true, dealt, guard, enemyHp: this.enemy.hp };
  }

  // 结束回合 → 敌人行动 → 玩家新回合
  endTurn() {
    if (this.state !== 'playing') return;
    // 政经：未用完灵感沉淀（剩余册 +25% 返还）
    if (this.school === 'zheng' && this.player.energy > 0) {
      const sw = this.relics.find((r) => r.effect.saveBonus);
      const ratio = sw && this.school === 'zheng' ? 0.5 + sw.effect.saveBonus : 0.5;
      const save = Math.floor(this.player.energy * ratio);
      this._pendingReturn += save;
      this.log(`【灵力储蓄】沉淀 ${save} 灵感`);
    }
    // 搁置思考：每 3 回合回血
    const reg = this.relics.find((r) => r.effect.regenEvery);
    if (reg) {
      this._turnsSinceRegen += 1;
      if (this._turnsSinceRegen >= reg.effect.regenEvery) {
        this._turnsSinceRegen = 0;
        const heal = Math.min(reg.effect.regen, this.player.maxHp - this.player.hp);
        if (heal > 0) { this.player.hp += heal; this.log(`【搁置思考】回 ${heal} 学识`); }
      }
    }
    // 弃置手牌
    [...this.deck.hand].forEach((c) => { this.deck.discardFromHand(c); this.schoolStats.discards++; });
    if (this.state !== 'playing') return;

    const a = this.intent();
    let dmg = a.dmg || 0;
    if (a.repeat && this._lastEnemyDmg) dmg += this._lastEnemyDmg;
    // 镜像收敛（Act 5）：敌人复制你上一张打出牌
    if (this.mod.mirror && this._lastPlayedAtk > 0 && this.enemy.kind === 'Boss') {
      const copied = Math.floor(this._lastPlayedAtk * 0.5);
      dmg += copied;
      this._enemyMirror += copied;
    }
    // 敌人伤害按幕缩放
    if (this.enemy.dmgScale && dmg > 0) dmg = Math.round(dmg * this.enemy.dmgScale);
    if (dmg > 0) this._lastEnemyDmg = dmg;
    const guard = a.guard || 0;
    if (guard) this.enemy.guard += guard;

    let recv = dmg;
    if (this.player.guard > 0) { const ab = Math.min(this.player.guard, recv); this.player.guard -= ab; recv -= ab; }
    this.player.hp = Math.max(0, this.player.hp - recv);

    this.log(`【${this.enemy.name}】「${a.name}」→ 你受 ${recv} 伤${guard ? `，敌方护甲+${guard}` : ''}`, 'enemy');
    if (this.player.hp <= 0) { this.state = 'lost'; return; }

    // 新回合
    this.turn += 1;
    this._intentIdx += 1;
    this.state = 'playing';
    this.player.energy = 3;
    if (this.school === 'zheng' && this._pendingReturn > 0) {
      const back = this._pendingReturn;
      this._pendingReturn = 0;
      this.player.energy += back;
      this.log(`【灵力储蓄返还】灵感 +${back}`);
    }
    this.player.guard = 0;
    this._doubtInTurn = false;
    this._firstAttackInTurn = true;
    this.deck.drawN(Math.max(0, 5 - this.deck.hand.length));
    this.announce();
  }

  log(text, kind = 'me') {
    this.logs.push({ text, kind });
    if (this.onLog) this.onLog(text, kind);
  }
}