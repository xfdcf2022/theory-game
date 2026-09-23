// 内化轨 + 史料纵贯线（v0.10 语义）
// 内化式：精读（1 档案点→概念牌）/ 合题（2 旧牌 + 1 档案点→进阶牌）/ 总结（需"已读"）
// 史料纵贯线：覆盖度 = 去重触发原创节点 ÷ 期望暴露数
//   触发语义（定死）：= 打出过的概念牌 + 完成的精读/合题/总结 + 结算过的事件；抓到未打不计

import { CONCEPT_CARDS, BOOKS } from './data.js';

// 精读：花费档案点，抽 1 概念牌（v0.10：概念池学派加权 60/40）
export function internalizeRead(ctx) {
  // ctx: { archivePoints, school, ownedIds, conceptPool, mod }
  const { archivePoints, school, ownedIds, conceptPool, mod } = ctx;
  const cost = readCost(mod);
  if (archivePoints < cost) return { ok: false, reason: '档案点不足' };

  const pool = conceptPool.filter((c) => !ownedIds.includes(c.id));
  if (!pool.length) return { ok: false, reason: '概念牌已读完' };

  // 学派加权：学派牌(含共享?) —— 共享承担骨架、专属承担输出 → 专属优先
  const own = pool.filter((c) => c.school === school);
  const other = pool.filter((c) => c.school !== school);
  const poolPart = own.length && Math.random() < 0.6 ? own : other.length ? other : own;
  const card = poolPart[Math.floor(Math.random() * poolPart.length)];

  return { ok: true, cost, card, note: `精读完成，抽得概念牌「${card.name}」` };
}

export function readCost(mod = {}) {
  let c = 1;
  if (mod.misread) c += 1; // 旧名词之雾：精读引文需"复核"
  if (mod.internalCostup) c = Math.ceil(c * 1.3); // 高墙删减：精读费用 +30%
  return c;
}

// 合题：2 互斥牌 + 档案点 → 进阶牌（v0.10：悖论回环需 3 张）
export function internalizeSynthesis(ctx, pair) {
  const { archivePoints, acquired, mod, relic } = ctx;
  const need = mod.synthThree ? 3 : 2;
  if (!pair || pair.length !== need) return { ok: false, reason: `合题需 ${need} 张互斥牌` };
  const ids = pair.map((c) => c.id);
  const have = ids.every((id) => acquired.some((a) => a.id === id));
  if (!have) return { ok: false, reason: '所选牌不在收藏中' };

  let cost = 1;
  if (relic?.effect?.synthDiscount) cost = Math.max(1, Math.ceil(cost * 0.7));
  if (archivePoints < cost) return { ok: false, reason: '档案点不足' };

  // 白区×红区 → 方法论升级
  if (ids.includes('baiqu_hongqu')) {
    return {
      ok: true, cost, merged: {
        id: 'methodology_upgrade', name: '方法论升级', school: 'common', type: 'power',
        cost: 2, desc: '本局内化费用 -1；史料纵贯线 +1 节点', power: { internalDiscount: 1 },
        mergedFrom: pair.map((p) => p.name),
      },
    };
  }
  // 一般合题：两张牌合成进阶牌（伤害合并、费用取低 -1）
  const atk = pair.reduce((s, c) => s + (c.atk || 0), 0) + 4;
  const merged = {
    id: 'synth_' + pair.map((c) => c.id).join('_'),
    name: pair.map((p) => p.name).join('×'),
    school: pair[0].school, type: 'attack', cost: Math.max(1, Math.min(...pair.map((c) => c.cost || 1)) - 1),
    desc: `合题产物：${atk} 点思辨`, atk,
    mergedFrom: pair.map((p) => p.name), merged: true,
  };
  return { ok: true, cost, merged };
}

// 总结：需"已读"前置，产出洞察/强化
export function internalizeSummary(ctx) {
  const { readCount, mod, archive } = ctx;
  const need = mod.synthDeep ? 2 : 1; // 镜像收敛：需深度 +1 档
  if (readCount < need) return { ok: false, reason: `尚未精读 ${need} 本（镜像后需 ${need} 档）` };
  const insight = 10;
  return { ok: true, insight, note: `总结完成：洞察 +${insight}（归档：${archive + 1} 篇）` };
}

// 史料纵贯线：分母 = 期望暴露数（幕数 × 每幕节点数 × 单局暴露率 × 事件抽取）；分子 = 去重触发原创节点
export function coverageRatio(ctx) {
  // ctx: { acts, triggeredNodes, schoolCoeff }
  const { acts, triggeredNodes, schoolCoeff = 1 } = ctx;
  const expected = Math.round(acts * 5 * 0.6 * schoolCoeff); // 每幕约 5 节点、暴露率 0.6
  const numerator = triggeredNodes.filter(Boolean).length;
  return { numerator, denominator: expected, ratio: expected ? Math.min(1.2, numerator / expected) : 0 };
}

// 触发节点登记（打出概念牌/完成内化/结算事件都算；抓到未打不计）
export function registerTrigger(run, node) {
  if (node && node.id && !run.triggeredNodes.includes(node.id)) {
    run.triggeredNodes.push(node.id);
  }
}

// 期望暴露数定参（M2 起可测）：按学派 × 幕数校准
export function expectedExposure(acts, school) {
  const coeff = { mao: 1.0, zheng: 1.1, zhe: 1.05 }[school] || 1.0;
  return Math.round(acts * 5 * 0.6 * coeff);
}

// 书目（精读源）
export const BOOK_CATALOG = BOOKS;