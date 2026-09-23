// 玩法方向：见习研究者学群主的牌、驳旧敌、超越他
// 本文件是唯一的内容源（脱敏：无群名/无昵称/无QQ号）
// 所有分配均按 3 学派 * 每学派标签比例 组织

export const SCHOOLS = {
  mao: {
    id: 'mao',
    name: '毛学（实践派）',
    phase: 'Phase 1–2',
    rule: '引论连锁：每次打出「引用」，本局同牌名攻击 +1',
    growth: '高频攻击，热打铁',
    color: '#c0392b',
  },
  zheng: {
    id: 'zheng',
    name: '政经（剩余价值派）',
    phase: 'Phase 3–4',
    rule: '灵力储蓄：未用完灵感沉淀，下回合按 50% 返还；组合技多发',
    growth: '蓄力/爆发型',
    color: '#c98a1b',
  },
  zhe: {
    id: 'zhe',
    name: '哲学史（认识论派）',
    phase: 'Phase 2–5',
    rule: '存史复用：弃牌堆可窥探/回收为手牌；弃牌触发效果',
    growth: '循环/控制流',
    color: '#3a7ca5',
  },
};

// ---- 基础牌组（8 张开局，学派变体）----
// 4 类骨架：攻击/防守/引擎/能力
export const BASE_CARDS = [
  { id: 'question', name: '提问', school: 'common', type: 'attack', cost: 1, desc: '5 点思辨', atk: 5 },
  { id: 'quote', name: '引用', school: 'common', type: 'attack', cost: 1, desc: '8 点 + 学派附加', atk: 8, tag: 'quote' },
  { id: 'doubt', name: '质疑', school: 'common', type: 'attack', cost: 1, desc: '弃 1 张，弃置数×4', atk: 4, discard: 1, tag: 'doubt' },
  { id: 'excerpt', name: '摘录', school: 'common', type: 'guard', cost: 1, desc: '5 护甲', guard: 5 },
  { id: 'reading', name: '读史', school: 'common', type: 'draw', cost: 1, desc: '抽 1–2 张', draw: 1 },
];

// 学派专属开局牌（2 张，替换读史的位置补齐 8 张）
export const SCHOOL_STARTERS = {
  mao: [
    { id: 'mao_three', name: '老三篇', school: 'mao', type: 'draw', cost: 1, desc: '抽 1；本局「引用」免费', draw: 1, quoteFree: true, tag: 'quote' },
    { id: 'mao_mobilize', name: '军事动员', school: 'mao', type: 'attack', cost: 1, desc: '8 点；若本局已连锁 2 层则 +6', atk: 8, chainReq: 2, chainBonus: 6, tag: 'quote' },
  ],
  zheng: [
    { id: 'zheng_sacrifice', name: '活劳动', school: 'zheng', type: 'draw', cost: 1, desc: '抽 2；沉淀 +1 灵感', draw: 2, save: 1 },
    { id: 'zheng_accum', name: '积累', school: 'zheng', type: 'attack', cost: 2, desc: '14 点；若本回合耗光灵感则 +6', atk: 14, exhaustBonus: 6 },
  ],
  zhe: [
    { id: 'zhe_archive', name: '检视书库', school: 'zhe', type: 'draw', cost: 1, desc: '看弃牌堆顶 3 张，将其中 1 张回收', look: 3 },
    { id: 'zhe_contradiction', name: '矛盾分析', school: 'zhe', type: 'attack', cost: 1, desc: '6 点；每从弃牌堆回收过 1 张则 +2', atk: 6, history: true },
  ],
};

// 每学派 8 张开局（5 基础 + 2 专属 + 第 2 张专属补齐组合）
export function startingDeck(school) {
  const base = [
    { ...BASE_CARDS[0] },
    { ...BASE_CARDS[0] },
    { ...BASE_CARDS[1] },
    { ...BASE_CARDS[1] },
    { ...BASE_CARDS[2] },
    { ...BASE_CARDS[3] },
    ...SCHOOL_STARTERS[school].map((c) => ({ ...c })),
  ];
  return base;
}

// ---- 概念牌（v0.10 数据：各学派专属 + 共享，全部脱敏）----
export const CONCEPT_CARDS = [
  { id: 'bianzheng_fou', name: '辩证否定', school: 'common', type: 'attack', cost: 1, desc: '弃费用最高 1 张，造成其费用×8', discardHighest: true, atkScale: 8 },
  { id: 'juti_fenxi', name: '具体分析', school: 'mao', type: 'attack', cost: 1, desc: '5×当前连锁层', atkScaleChain: 5, tag: 'quote' },
  { id: 'guanshu', name: '灌输战士', school: 'mao', type: 'attack', cost: 2, desc: '14 点；本回过「质疑」翻倍', atk: 14, metaIfDoubt: 2 },
  { id: 'lishi_weiwu', name: '在场历史唯物', school: 'zhe', type: 'power', cost: 2, desc: '每次弃牌对随机敌 4 点', power: { onDiscard: 4 } },
  { id: 'xiangdui_sh', name: '相对剩余价值体系化', school: 'zheng', type: 'combo', cost: 2, desc: '组合技：死劳动+活劳动→+20 点', combo: ['zheng_sacrifice', 'mao_three'], atk: 20 },
  { id: 'baiqu_hongqu', name: '白区×红区', school: 'common', type: 'combo', cost: 1, desc: '合并互斥牌→方法论升级', merge: true },
];

// ---- 遗物（3 选 1 入库；切片阶段先出 3 个精作品）----
export const RELICS = [
  { id: 'zibenlun', name: '《资本论》', rarity: '传说', desc: '首张攻击牌 +50%', effect: { firstAttackBoost: 1.5 } },
  { id: 'mao_pi_zhu', name: '《毛泽东哲学批注集》', rarity: '精良', desc: '开战抽 1 概念牌', effect: { drawOnStart: 1 } },
  { id: 'zhao_shu', name: '找书方法论', rarity: '精良', desc: '合题档案点 -30%', effect: { synthDiscount: 0.3 } },
  { id: 'keji', name: '《搁置思考》', rarity: '普通', desc: '每 3 回合回 4 学识', effect: { regenEvery: 3, regen: 4 } },
];

// ---- 敌人：垂直切片的 3 战 ----
// 小怪（入库战）/ 精英 / Boss（理论劝退怪）
export const ENEMIES = [
  {
    id: 'erjiguan',
    name: '二极管',
    kind: '小怪',
    color: '#8a5f3a',
    maxHp: 12,
    intents: [
      { name: '单向放电', dmg: 6 },
      { name: '阻隔', guard: 4, blockHeal: 0 },
      { name: '杂音', dmg: 3, guard: 3 },
    ],
    desc: '只会单向论证，被引用驳倒。',
  },
  {
    id: 'fuduji',
    name: '复读机',
    kind: '精英',
    color: '#7a5a9a',
    maxHp: 28,
    intents: [
      { name: '泡水', dmg: 10 },
      { name: '复读·争辩', dmg: 7, repeat: true },
    ],
    desc: '把旧词反复抛出，直到你接不住。',
  },
  {
    id: 'bos_appeal',
    name: '理论劝退怪',
    kind: 'Boss',
    color: '#b04a4a',
    maxHp: 48,
    intents: [
      { name: '劝退', dmg: 12 },
      { name: '终极劝退', dmg: 7, guard: 6 },
      { name: '引用者陷阱', dmg: 5, weaken: 1 },
    ],
    desc: '用劝退语劝你放弃研究——驳倒它，你才配写你自己的总结。',
  },
];