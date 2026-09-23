// 一轮完整游戏（Run）状态机：五幕地图 + 节点推进 + 实验状态
// 由 Save 提供跨局持久（洞察/删牌次数/Prestige），本类只管单局

import { SCHOOLS, startingDeck, CONCEPT_CARDS, RELICS, ACTS, ENEMIES, actEnemies, BOOKS, EVENTS, NODE_KINDS } from './data.js';
import { cardMV, deletePrice } from './economy.js';
import { registerTrigger } from './internalize.js';

// 每幕地图：5 列 × 若干可选节点 → 分支决策
// 列类型模板（v0.10：战斗轨 + 内化轨交替）
const COL_TEMPLATE = ['combat', 'split1', 'elite', 'split1', 'boss'];

export class Run {
  constructor({ school, mode = 'formal', saveData = {} }) {
    this.school = school;
    this.mode = mode; // formal / guide / short / endless
    this.save = saveData;
    this.act = 1;
    this.maxHp = 60;
    this.hp = 60;
    this.archivePoints = 0;
    this.insight = 0;
    this.relics = [];
    this.acquired = [];      // 本局获得的（开出局的额外）牌
    this.playedConceptIds = []; // 打出过的概念牌 id（史料纵贯线·触发语义）
    this.eventsSettled = [];  // 结算过的事件 id
    this.internalDone = [];   // 完成的内化 id（精读/合题/总结）
    this.triggeredNodes = []; // 去重触发节点（纵贯线分子）
    this.deletedThisRun = 0;
    this.boughtThisRun = 0;
    this.prestigePicked = null;
    this.schoolsUnlocked = {}; // 每学派首解锁学习
    this.map = [];
    this.col = 0;
    this.lastNodeLabel = '主城';
  }

  get schoolName() { return SCHOOLS[this.school].name; }

  // ---- 全程牌堆 = 开局牌 + 本局获得 ----
  buildDeck() {
    const d = startingDeck(this.school);
    this.acquired.forEach((c) => d.push({ ...c }));
    return d;
  }

  // ---- 生成一幕地图 ----
  genMap(act) {
    const mod = ACTS[act - 1].mod;
    const map = [];
    for (let c = 0; c < COL_TEMPLATE.length; c++) {
      const kind = COL_TEMPLATE[c];
      const nodes = [];
      const make = (k) => ({
        kind: k,
        act,
        label: NODE_KINDS[k]?.label || k,
        color: NODE_KINDS[k]?.color || '#888',
        desc: NODE_KINDS[k]?.desc || '',
        mod,
      });
      if (kind === 'combat') {
        nodes.push(make('combat'));
        nodes.push(make('combat'));
      } else if (kind === 'split1') {
        // 事件 + （休息|商店|内化）三选一
        nodes.push(make('event'));
        const pick = ['rest', 'rest', 'shop', 'internal'][Math.floor(Math.random() * 4)];
        nodes.push(make(pick));
        if (Math.random() < 0.5) nodes.push(make('event'));
        shuffle(nodes);
      } else if (kind === 'elite') {
        nodes.push(make('elite'), make('elite'));
      } else if (kind === 'boss') {
        nodes.push(make('boss'));
      }
      map.push(nodes);
    }
    return map;
  }

  // ---- 推到下一列（返回正在进入的节点组或 boss）----
  advance() {
    if (this.col >= this.map.length - 1) {
      // 本幕末：打完 boss 后进入下一幕
      this.col = -1;
      return null;
    }
    this.col += 1;
    return this.map[this.col];
  }

  // ---- 节点结算入口 ----
  enterNode(node) {
    this.col = node ? node._col : this.col;
    return node;
  }

  syncHp(hp, maxHp = 60) {
    this.hp = Math.max(0, hp);
    this.maxHp = Math.max(hp, maxHp);
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}