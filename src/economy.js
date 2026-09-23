// 经济模型（v0.10 闭环）：MV 静态锚定 + 删牌全局累进
// 锚定：提问（5 伤/1 费）= 1 MV；牌价 = 1 MV × 倍数
// 删牌 3 级定价 40/60/90 按全局账户次数累进、不可重置（首删 25 折）

let _globalDeleteCount = 0;

export function setGlobalDeleteCount(n) {
  _globalDeleteCount = n;
}

export function getGlobalDeleteCount() {
  return _globalDeleteCount;
}

// 单卡 MV：攻击/护甲/抽牌 折算等效输出，费用作为系数
export function cardMV(card) {
  if (!card) return 1;
  let atk = card.atk || 0;
  if (card.combo) atk += card.atk || 0;
  if (card.atkScaleChain) atk += card.atkScaleChain * 3; // 按 3 层连锁估算
  const strength = atk;
  const guardV = (card.guard || 0) * 0.7;
  const drawV = (card.draw || 0) * 1.5;
  const powerV = card.power ? 1.5 : 0;
  const raw = strength + guardV + drawV + powerV;
  const costFactor = [1, 1.4, 1.9][Math.max(0, (card.cost || 1) - 1)] || 2.2;
  return Math.max(1, Math.round((raw / 5) * costFactor));
}

// 商店买牌价 = MV；找书方法论 -30%
export function buyPrice(card, relics = []) {
  let p = cardMV(card) * 10; // 放大到档案点刻度（10 倍）
  const disc = relics.find((r) => r.effect && r.effect.shopDiscount);
  if (disc) p = Math.round(p * (1 - disc.effect.shopDiscount));
  return p;
}

// 删牌定价：全局次数 0→40（首删 25 折=30）、1→60、2+→90；全局累进不可重置
export function deletePrice() {
  const n = _globalDeleteCount;
  if (n === 0) return { cost: 30, next: 60 };
  if (n === 1) return { cost: 60, next: 90 };
  return { cost: 90, next: 90 };
}

// 一局期望收支（v0.10：120–200 档案点）——供遥测与平衡对照
export function economyBudget() {
  return { income: [120, 200], spend: [60, 120] };
}

// 事件有界后悔校验：最大代价 ≤2 档案点 或 ≤10% 学识
export function boundedRegret(option, maxHp = 60) {
  const a = option.cost && option.cost.archive;
  const h = option.hpCost || 0;
  const archiveOk = !a || a <= 2;
  const hpOk = h <= Math.ceil(maxHp * 0.1);
  return archiveOk && hpOk;
}