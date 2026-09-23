// 玩法方向：见习研究者学群主的牌、驳旧敌、超越他
// 本文件是唯一的内容源（脱敏：无群名/无昵称/无QQ号）
// v0.10 对齐：学派3×概念牌32(19专属+13共享)/遗物~60/事件~120/五幕+幕修正器/书目

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
export const BASE_CARDS = [
  { id: 'question', name: '提问', school: 'common', type: 'attack', cost: 1, desc: '5 点思辨', atk: 5 },
  { id: 'quote', name: '引用', school: 'common', type: 'attack', cost: 1, desc: '8 点 + 学派附加', atk: 8, tag: 'quote' },
  { id: 'doubt', name: '质疑', school: 'common', type: 'attack', cost: 1, desc: '弃 1 张，弃置数×4', atk: 4, discard: 1, tag: 'doubt' },
  { id: 'excerpt', name: '摘录', school: 'common', type: 'guard', cost: 1, desc: '5 护甲', guard: 5 },
  { id: 'reading', name: '读史', school: 'common', type: 'draw', cost: 1, desc: '抽 1–2 张', draw: 1 },
];

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

// ---- 概念牌（v0.10：共享承担引擎骨架、专属承担核心输出；全部脱敏）----
// 当前为 M3 主循环首批（22 张）；M4 补全至 32 张 = 19 专属 + 13 共享
export const CONCEPT_CARDS = [
  // 共享（引擎骨架）
  { id: 'bianzheng_fou', name: '辩证否定', school: 'common', type: 'attack', cost: 1, desc: '弃费用最高 1 张，造成其费用×8', discardHighest: true, atkScale: 8 },
  { id: 'baiqu_hongqu', name: '白区×红区', school: 'common', type: 'combo', cost: 1, desc: '合并互斥牌→方法论升级', merge: true },
  { id: 'fanli', name: '反例', school: 'common', type: 'attack', cost: 1, desc: '9 点；本回合弃过牌则 +4', atk: 9, metaIfDiscard: 4 },
  { id: 'fanchou', name: '范畴表', school: 'common', type: 'power', cost: 2, desc: '能力：每回合末 +1 灵感沉淀', power: { endTurnSave: 1 } },
  { id: 'ziwo_piping', name: '自我批评', school: 'common', type: 'guard', cost: 1, desc: '8 护甲；抽 1 张', guard: 8, draw: 1 },
  { id: 'geming_leguan', name: '革命乐观主义', school: 'common', type: 'guard', cost: 1, desc: '回 6 学识（不叠加护甲）', heal: 6 },
  // 毛学（实践派）
  { id: 'juti_fenxi', name: '具体分析', school: 'mao', type: 'attack', cost: 1, desc: '5×当前连锁层', atkScaleChain: 5, tag: 'quote' },
  { id: 'guanshu', name: '灌输战士', school: 'mao', type: 'attack', cost: 2, desc: '14 点；本回过「质疑」翻倍', atk: 14, metaIfDoubt: 2 },
  { id: 'diaocha_quan', name: '调查权', school: 'mao', type: 'attack', cost: 1, desc: '12 点；连锁层 ≥3 则 +6', atk: 12, chainReq: 3, chainBonus: 6, tag: 'quote' },
  { id: 'qunzhong_luxian', name: '群众路线', school: 'mao', type: 'power', cost: 2, desc: '能力：每 2 回合开始抽 1 张', power: { drawEveryTurn: 2 } },
  { id: 'zhuli_jun', name: '主力军', school: 'mao', type: 'combo', cost: 2, desc: '组合：引用+军事动员同框 +10 点', combo: ['question', 'mao_mobilize'], atk: 10 },
  // 政经（剩余价值派）
  { id: 'xiangdui_sh', name: '相对剩余价值体系化', school: 'zheng', type: 'combo', cost: 2, desc: '组合技：死劳动+活劳动→+20 点', combo: ['zheng_sacrifice', 'mao_three'], atk: 20 },
  { id: 'silao_dong', name: '死劳动', school: 'zheng', type: 'attack', cost: 1, desc: '12 点；本回合打过「活劳动」则 +8', atk: 12, comboLike: ['zheng_sacrifice'], comboBonus: 8 },
  { id: 'shengyu_lv', name: '剩余价值率', school: 'zheng', type: 'power', cost: 2, desc: '能力：灵力储蓄返还 50%→75%', power: { saveBonus: 0.25 } },
  { id: 'ziben_jilei', name: '资本积累', school: 'zheng', type: 'attack', cost: 2, desc: '16 点；本回合耗光灵感则 +8', atk: 16, exhaustBonus: 8 },
  { id: 'shengyu', name: '剩余', school: 'zheng', type: 'guard', cost: 1, desc: '6 护甲；沉淀 +2 灵感', guard: 6, save: 2 },
  // 哲学史（认识论派）
  { id: 'lishi_weiwu', name: '在场历史唯物', school: 'zhe', type: 'power', cost: 2, desc: '每弃 1 张牌对敌方 4 点', power: { onDiscard: 4 } },
  { id: 'bentilun', name: '本体论转向', school: 'zhe', type: 'attack', cost: 1, desc: '8 点；本局每回收 1 张则 +2', atk: 8, history: true },
  { id: 'xipu_xue', name: '系谱学', school: 'zhe', type: 'draw', cost: 1, desc: '抽 1；看弃牌堆顶 2 张回收 1 张', draw: 1, look: 2 },
  { id: 'duanceng', name: '断层', school: 'zhe', type: 'guard', cost: 1, desc: '5 护甲；弃牌时 +2 护甲', guard: 5, discardGuard: 2 },
  { id: 'xiaoying', name: '效应', school: 'zhe', type: 'power', cost: 2, desc: '能力：本局弃过 5 张后抽牌 +1', power: { drawBonus: 1 } },
];

// ---- 遗物（3 选 1 入库；专武 3 件）----
export const RELICS = [
  { id: 'zibenlun', name: '《资本论》', rarity: '传说', desc: '首张攻击牌 +50%', effect: { firstAttackBoost: 1.5 } },
  { id: 'mao_pi_zhu', name: '《毛泽东哲学批注集》', rarity: '精良', desc: '开战抽 1 概念牌', effect: { drawOnStart: 1 } },
  { id: 'zhao_shu', name: '找书方法论', rarity: '精良', desc: '商店价 -30%', effect: { shopDiscount: 0.3 } },
  { id: 'keji', name: '《搁置思考》', rarity: '普通', desc: '每 3 回合回 4 学识', effect: { regenEvery: 3, regen: 4 } },
  { id: 'maodun_lun', name: '《矛盾论》', rarity: '精良', desc: '每回合首张牌附带抽 1', effect: { drawOnFirstPlay: 1 } },
  { id: 'shijian_lun', name: '《实践论》', rarity: '精良', desc: '每场战斗首回合能量 +1', effect: { energyFirst: 1 } },
  { id: 'chi_jiu_zhan', name: '《论持久战》', rarity: '传说', desc: 'Boss 战首回合能量 +2', effect: { energyFirstBoss: 2 } },
  { id: 'sheng_yu_gongye', name: '《剩余价值工业》', rarity: '普通', desc: 'Boss 战 +20 伤害上限（本局最大学识 +10）', effect: { maxHpUp: 10 } },
  // 专武（精英 25% 概率掉，学派专属）
  { id: 'sw_mao', name: '五二零宣言刃', rarity: '专武·毛', desc: '战斗开始连锁层 +1', effect: { chainStart: 1 }, school: 'mao' },
  { id: 'sw_zheng', name: '剩余册', rarity: '专武·政', desc: '灵力储蓄返还比例 +25%', effect: { saveBonus: 0.25 }, school: 'zheng' },
  { id: 'sw_zhe', name: '镜像匣', rarity: '专武·哲', desc: '开战抽 1 张', effect: { drawOnStart: 1 }, school: 'zhe' },
];

// ---- 敌人基础模板（血量按幕缩放，见 actEnemies）----
export const ENEMIES = [
  {
    id: 'erjiguan', name: '二极管', kind: '小怪', color: '#8a5f3a', maxHp: 12,
    intents: [
      { name: '单向放电', dmg: 6 },
      { name: '阻隔', guard: 4 },
      { name: '杂音', dmg: 3, guard: 3 },
    ],
    desc: '只会单向论证，被引用驳倒。',
  },
  {
    id: 'fuduji', name: '复读机', kind: '精英', color: '#7a5a9a', maxHp: 28,
    intents: [
      { name: '泡水', dmg: 10 },
      { name: '复读·争辩', dmg: 7, repeat: true },
    ],
    desc: '把旧词反复抛出，直到你接不住。',
  },
  {
    id: 'bos_appeal', name: '理论劝退怪', kind: 'Boss', color: '#b04a4a', maxHp: 48,
    intents: [
      { name: '劝退', dmg: 12 },
      { name: '终极劝退', dmg: 7, guard: 6 },
      { name: '引用者陷阱', dmg: 5, weaken: 1 },
    ],
    desc: '用劝退语劝你放弃研究——驳倒它，才配写你自己的总结。',
  },
];

// ---- 五幕 + 幕修正器（v0.10：同时影响战斗与内化轨）----
export const ACTS = [
  { n: 1, name: '观星 · 引教', color: '#3a7ca5',
    mod: { id: 'none', battle: '引教基础：教学战斗，无修正器', internal: '无' },
    bossId: 'bos_appeal' },
  { n: 2, name: '卷宗 · 旧名词之雾', color: '#8a5f3a',
    mod: { misread: 0.3 },
    bossId: 'bos_ff_wing' },
  { n: 3, name: '高墙 · 删减', color: '#7a5a9a',
    mod: { sweepBack: 3 },
    bossId: 'bos_wall' },
  { n: 4, name: '悖论 · 回环', color: '#c98a1b',
    mod: { synthThree: true },
    bossId: 'bos_paradox' },
  { n: 5, name: '镜像 · 收敛', color: '#c0392b',
    mod: { mirror: true, synthDeep: 1 },
    bossId: 'bos_mirror' },
];

// ---- 每幕 Boss 模板（独有机制 + 意图）----
export const BOSS_TEMPLATES = [
  { id: 'bos_appeal',  name: '理论劝退怪',  color: '#b04a4a', maxHp: 48, mechanic: '用劝退语逼你放弃研究',
    intents: [{ name: '劝退', dmg: 12 }, { name: '终极劝退', dmg: 7, guard: 6 }, { name: '引用者陷阱', dmg: 5 }] },
  { id: 'bos_ff_wing', name: '旧名词之翼',  color: '#8a5f3a', maxHp: 62, mechanic: '被「误读」的旧名词回击——引用牌 30% 费用+1',
    intents: [{ name: '名词俯冲', dmg: 14 }, { name: '误读扩散', dmg: 8, guard: 5 }, { name: '旧词加固', guard: 9 }] },
  { id: 'bos_wall',    name: '自我审查高墙', color: '#7a5a9a', maxHp: 76, mechanic: '每 3 回把 1 张手牌塞回牌库',
    intents: [{ name: '高墙压顶', dmg: 16 }, { name: '删减一节', dmg: 9, guard: 4 }, { name: '沉默壁垒', guard: 12 }] },
  { id: 'bos_paradox', name: '权力的悖论',  color: '#c98a1b', maxHp: 88, mechanic: '首回合行动递增翻倍',
    intents: [{ name: '悖论回环', dmg: 18 }, { name: '双输', dmg: 10, guard: 6 }, { name: '垄断话术', guard: 14 }] },
  { id: 'bos_mirror',  name: '镜像闭合',    color: '#c0392b', maxHp: 96, mechanic: '复制你上一张打出牌',
    intents: [{ name: '镜像反打', dmg: 20 }, { name: '闭环', dmg: 11, guard: 7 }, { name: '自反', guard: 15 }] },
];

// 按幕生成敌人实例（血量/伤害缩放，Boss=幕模板）
export function actEnemies(act, kind) {
  const scale = [1, 1.18, 1.36, 1.54, 1.7][Math.min(4, act - 1)];
  const dmgScale = 1 + 0.25 * (act - 1);
  if (kind === 'boss') {
    const t = BOSS_TEMPLATES[act - 1];
    return {
      ...t,
      kind: 'Boss',
      maxHp: Math.round(t.maxHp * scale),
      dmgScale,
      mod: ACTS[act - 1].mod,
      desc: ACTS[act - 1].mod.battle || t.mechanic,
    };
  }
  if (kind === 'elite') {
    return {
      ...ENEMIES[1],
      id: `elite_a${act}_1`,
      name: basenameElite(act),
      color: '#7a5a9a',
      maxHp: Math.round(28 * scale * 1.15),
      dmgScale,
      desc: '精英守关：驳倒它可能掉出派系专武。',
    };
  }
  return {
    ...ENEMIES[0],
    id: `small_a${act}_1`,
    name: basenameMinion(act),
    maxHp: Math.round(12 * scale),
    dmgScale,
    desc: '小怪：旧论点的残响。',
  };
}

function basenameMinion(act) {
  return ['二极管', '二极管', '复读机', '数据噪声', '数据噪声'][Math.min(4, act - 1)];
}
function basenameElite(act) {
  return ['复读机', '复读机', '口号收集者', '论战守卫', '论战守卫'][Math.min(4, act - 1)];
}

// ---- 书目（精读源，来源=遗物类书目 + 图鉴书目）----
export const BOOKS = [
  { id: 'b_capital', title: '《资本论》', era: '1867', note: '剩余价值在商品形态中显现。' },
  { id: 'b_maopizhu', title: '《毛泽东哲学批注集》', era: '1937', note: '读不懂，先动手；实践出真知。' },
  { id: 'b_ms', title: '《马克思恩格斯选集》', era: '19世纪', note: '从现实的人出发。' },
  { id: 'b_zhengzhi', title: '《政治经济学批判》', era: '1859', note: '生产关系的总结构。' },
  { id: 'b_lys', title: '《列宁选集》', era: '20世纪初', note: '革命实践的理论化。' },
  { id: 'b_shir', title: '《师哲回忆录》', era: '当代', note: '亲历者的证词。' },
  { id: 'b_gongye', title: '《剩余价值工业》', era: '当代', note: '把话术变成工业。' },
  { id: 'b_makexue', title: '《马克思主义哲学读本》', era: '当代', note: '入门框架。' },
];

// ---- 事件池（v0.10：有界后悔 ≤2 档案点 或 ≤10% 学识；全部脱敏）----
// 结构：{ id, act, title, text, options:[{ text, cost?, hpCost?, require?, reward?, fail? }] }
export const EVENTS = [
  {
    id: 'ev_welcome', act: 1, title: '遇到的第一个劝退语',
    text: '旧论点在群里被反复抛出：「你学这个有什么用？」',
    options: [
      { text: '用「引用」把它驳回去', reward: { archive: 10 }, note: '你赢了这场小辩论。' },
      { text: '记录它，留作引文素材', reward: { book: true }, note: '它进了你的档案。' },
      { text: '沉默避战', hpCost: 4, reward: { archive: 2 }, note: '你损失了一点热情。' },
    ],
  },
  {
    id: 'ev_insult', act: 1, title: '被扣帽子的时刻',
    text: '有人把你的认真说成「书呆子」。',
    options: [
      { text: '自嘲化解（维护研究氛围）', reward: { concept: true }, note: '你把反讽变成了概念。' },
      { text: '当场辩论', reward: { archive: 8 }, hpCost: 3, note: '赢是赢了，吵得有点累。' },
    ],
  },
  {
    id: 'ev_book', act: 1, title: '一本难啃的书',
    text: '你翻开一本旧书，满页黑话。',
    options: [
      { text: '硬啃三页（可读性代价）', hpCost: 5, reward: { book: true }, note: '你开始理解它的结构。' },
      { text: '先查二手介绍', cost: { archive: 1 }, reward: { concept: true }, note: '绕了点路，但走通了。' },
    ],
  },
  {
    id: 'ev_contract', act: 2, title: '要不要接这个「合作」',
    text: '有人要你给他的论点「站台」。',
    options: [
      { text: '拒绝（代价是后来的孤立）', hpCost: 4, reward: { archive: 12 }, note: '一时难受，问心无愧。' },
      { text: '接下并改造它', reward: { concept: true }, cost: { archive: 2 }, note: '你把站台变成了挪用。' },
    ],
  },
  {
    id: 'ev_doubt0', act: 2, title: '自我怀疑',
    text: '深夜总结时，你怀疑走到现在全是巧合。',
    options: [
      { text: '写下怀疑本身', reward: { insight: 3, archive: 6 }, note: '怀疑成了方法论。' },
      { text: '睡一觉再说', reward: { heal: 6 }, note: '醒来后思路清醒。' },
      { text: '反复否定自己（损耗）', hpCost: 4, reward: { archive: 4 }, note: '否定之否定，没白折腾。' },
    ],
  },
  {
    id: 'ev_fashion', act: 2, title: '流行术语撤场',
    text: '一个流行词几个月就没人用了，你借它写了一半总结。',
    options: [
      { text: '重写（内容更新）', cost: { archive: 2 }, reward: { concept: true }, note: '术语死了，思路活了。' },
      { text: '引用原话并做注', reward: { archive: 8 }, note: '你的注暴露了它的空壳。' },
    ],
  },
  {
    id: 'ev_corner', act: 2, title: '被逼到墙角',
    text: '辩论中对方抓住你一个口误不放。',
    options: [
      { text: '承认口误，主张整体（诚实）', reward: { insight: 2, heal: 5 }, note: '诚实赢得了理解。' },
      { text: '转移战场（代价被记住）', hpCost: 4, reward: { archive: 6 }, note: '你赢了这一句，输了表情。' },
    ],
  },
  {
    id: 'ev_ban', act: 3, title: '被删掉的那条消息',
    text: '你写的一条长消息被撤回了，理由是「不合适」。',
    options: [
      { text: '存档重写新版本', reward: { concept: true }, cost: { archive: 1 }, note: '删不掉的想法最结实。' },
      { text: '记下被删的逻辑（暗线）', reward: { book: true }, note: '聪明的做法是看不出来被删过。' },
      { text: '公开对峙（被孤立）', hpCost: 5, reward: { archive: 10 }, note: '你成了一座孤岛。' },
    ],
  },
  {
    id: 'ev_shadow', act: 3, title: '旧号的影子',
    text: '有人把你三年前的发言截图甩到群里。',
    options: [
      { text: '认领并标注「彼时立场」', reward: { insight: 3 }, note: '承认历史本身也是理论。' },
      { text: '删号重来（丢失部分积累）', hpCost: 6, reward: { archive: 8 }, note: '你换了张皮，旧账还在。' },
    ],
  },
  {
    id: 'ev_follow', act: 3, title: '被「读懂」反而被孤立',
    text: '你把他的核心框架理顺了，讲给他听，他沉默了。',
    options: [
      { text: '写下四方争论（独立判断）', reward: { concept: true, archive: 4 }, note: '你不再依附他的答案。' },
      { text: '继续跟随（稳定但停滞）', reward: { archive: 6 }, note: '熟悉感让人安心。' },
    ],
  },
  {
    id: 'ev_wage', act: 4, title: '价值与价格',
    text: '一件具象的"劳动成果"被标了高得离谱的价格。',
    options: [
      { text: '拆解它的价值构成', reward: { concept: true }, cost: { archive: 1 }, note: '你把价格还原成了时间。' },
      { text: '趁低买下（投入）', cost: { archive: 2 }, reward: { heal: 0, archive: 0 }, note: '赔本了，但学会标价。' },
    ],
  },
  {
    id: 'ev_circle', act: 4, title: '怎么证明你学懂了',
    text: '他让你"用这套理论分析当下"——而你还在啃原著。',
    options: [
      { text: '硬着头皮写一篇', reward: { concept: true, archive: 4 }, note: '没写完，但开了个口子。' },
      { text: '承认没学透，回去精读', reward: { book: true }, note: '诚实反而赢得信任。' },
    ],
  },
  {
    id: 'ev_emptimm', act: 4, title: '永恒在场的概念',
    text: '有人宣称一个概念"永远正确"，无需历史检验。',
    options: [
      { text: '把它放回历史语境', reward: { insight: 3 }, cost: { archive: 1 }, note: '你让它从神坛回到人间。' },
      { text: '沉默，避免冲突', reward: { heal: 4 }, note: '你保全了自己，也留着疑问。' },
    ],
  },
  {
    id: 'ev_end0', act: 5, title: '临时总结',
    text: '局面杂乱，需要一句"到此为止"的结论。',
    options: [
      { text: '写下诚实的临时结论', reward: { insight: 4, archive: 8 }, note: '结得漂亮，不怕日后推翻。' },
      { text: '把结论留作开放问题', reward: { concept: true }, note: '你把省略号当成了武器。' },
    ],
  },
];

// ---- 节点类型说明（地图用）----
export const NODE_KINDS = {
  combat: { label: '入库战', color: '#c0392b', desc: '驳倒旧论点（3 选 1 遗物）' },
  elite: { label: '精英战', color: '#7a5a9a', desc: '精英守关（可掉派系专武）' },
  boss: { label: 'Boss 思辨对决', color: '#b04a4a', desc: '驳倒幕主论点' },
  event: { label: '事件', color: '#3a7ca5', desc: '真实发生过的抉择' },
  rest: { label: '休息', color: '#2e8a5a', desc: '休整或梳理' },
  shop: { label: '白区红区 · 商店', color: '#c98a1b', desc: '买概念牌 / 删牌' },
  internal: { label: '内化', color: '#5a6a9a', desc: '精读 / 合题 / 总结' },
};