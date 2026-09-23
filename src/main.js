import { SCHOOLS, CONCEPT_CARDS, RELICS, ACTS, BOOKS, EVENTS, ENEMIES, actEnemies, NODE_KINDS } from './data.js';
import { Game } from './engine.js';
import { Run } from './run.js';
import { Save } from './save.js';
import { telemetry, telemetryDump } from './telemetry.js';
import { cardMV, buyPrice, deletePrice, setGlobalDeleteCount, getGlobalDeleteCount, boundedRegret } from './economy.js';
import { internalizeRead, internalizeSynthesis, internalizeSummary, coverageRatio, expectedExposure } from './internalize.js';

const screen = () => document.getElementById('screen');

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  });
  children.flat().forEach((c) => {
    if (c) node.append(c.nodeType ? c : document.createTextNode(String(c)));
  });
  return node;
}

// ---- 全局状态：单局 ----
const state = {
  run: null,
  game: null,
  node: null,
  logList: [],
};

const LOG = [];
function pushLog(text, kind = 'me') { LOG.push({ text, kind }); }

const MODE_META = {
  formal: { title: '正式局 · 五幕', desc: '难度 g 单径；首 Boss 胜率靶心 60–75% 只认正式局' },
  guide: { title: '引导局', desc: '固定毛学 · 固定事件链 · 无幕修正器（首次游玩）' },
  short: { title: '短局 · 2 幕', desc: '通关率目标 30%；洞察 ×0.5 计入' },
  endless: { title: '无尽散射', desc: 'g=1+层数×5%（p 不参与）；奖励续图鉴/徽章' },
};

// ========= 屏幕 1：主城 =========
export function showSchoolSelect() {
  const s = Save.load();
  setGlobalDeleteCount(s.deletedCount || 0);
  const guideEverWin = s.guideWon;
  const hasFormalWin = s.formalWins > 0;

  const modeRows = [
    ['guide', MODE_META.guide.title, MODE_META.guide.desc, guideEverWin ? '已完成' : '推荐首玩'],
    ['formal', MODE_META.formal.title, MODE_META.formal.desc, hasFormalWin ? '' : '通关引导局后推荐'],
    ['short', MODE_META.short.title, MODE_META.short.desc, hasFormalWin ? '' : '通关引导局后解锁'],
    ['endless', MODE_META.endless.title, MODE_META.endless.desc, hasFormalWin ? '' : '首通后解锁'],
  ];

  screen().replaceChildren(
    el('div', { class: 'screen-title' },
      el('h1', { text: '理论牌组' }),
      el('p', { class: 'info', text: '研究驱动 思辨牌局 · 见习研究者 | v0.10 主循环' }),
      el('p', { class: 'info', text: `终身洞察 ${s.insight} · 正式通关 ${s.formalWins || 0} · 全局删牌 ${s.deletedCount || 0} 次` }),
    ),
    el('h2', { text: '选择你的研究模式' }),
    el('div', { class: 'reward-list' }, modeRows.map(([id, title, desc, tag]) =>
      el('div', {
        class: 'relic-item' + (id === 'guide' && !guideEverWin ? ' hl' : ''),
        onclick: () => modeClick(id),
      },
        el('strong', { text: title }),
        el('p', { class: 'info', text: desc + (tag ? ` · ${tag}` : '') }),
        el('div', { class: 'r', text: tag || '可用' }),
      )
    )),
    el('div', { class: 'tab', style: 'margin-top:18px' },
      el('button', { onclick: showArchive }, '结业档案'),
      el('button', { onclick: showAbout }, '关于'),
      el('button', { onclick: showTelemetry }, '遥测'),
    ),
  );
}

function modeClick(id) {
  const s = Save.load();
  if (id === 'guide') { startRun('mao', 'guide', true); return; }
  const unlocked = s.formalWins > 0;
  if ((id === 'formal' || id === 'short' || id === 'endless') && !unlocked) {
    pushLog('请先通关引导局，开放自由五幕。', 'enemy');
    return;
  }
  // 选学派
  renderSchoolPick(id);
}

function renderSchoolPick(mode) {
  screen().replaceChildren(
    el('h2', { text: `选择学派 · ${MODE_META[mode].title}` }),
    el('div', { class: 'row' }, Object.values(SCHOOLS).map((sc) =>
      el('div', { class: 'school-card', onclick: () => {
        telemetry('run_start', { mode, school: sc.id });
        startRun(sc.id, mode);
      } },
        el('h3', { text: sc.name, style: `color:${sc.color}` }),
        el('p', { class: 'info', text: `${sc.phase} · ${sc.growth}` }),
        el('p', { class: 'e', text: sc.rule }),
      )
    )),
    el('button', { onclick: showSchoolSelect }, '返回'),
  );
}

// ========= 屏幕 2：跑一局 =========
function startRun(school, mode, isGuide = false) {
  const save = Save.load();
  const run = new Run({ school, mode: isGuide ? 'guide' : mode, saveData: save });
  run.isGuide = isGuide;
  if (isGuide) {
    run.acquired.push({ ...CONCEPT_CARDS.find((c) => c.id === 'zhenxiang_cai'), });
  }
  state.run = run;
  state.colIndex = 0;
  state.run.act = 1;
  state.run.map = state.run.genMap(1);
  renderMap();
}

function renderMap() {
  const r = state.run;
  const a = ACTS[r.act - 1];
  state.colIndex = state.colIndex ?? 0;
  const cur = Math.max(0, state.colIndex);

  // 整幕俯视（只读）
  const overview = r.map.map((col, ci) => {
    const ep = col.map((n) => n.label).join(' · ');
    return el('div', {
      class: 'map-row' + (ci === cur ? ' act' : ci < cur ? ' done' : ''),
      style: `--accent:${a.color}`,
    },
      el('div', { class: 'r', text: `列${ci + 1}${ci === cur ? ' ← 当前' : ''}` }),
      el('div', { class: 'info', text: ep }),
    );
  });

  screen().replaceChildren(
    el('h2', { text: `${a.name} · 第 ${r.act} 幕 · 列 ${cur + 1}/5` }),
    el('p', { class: 'info', text: `学识 ${r.hp}/${r.maxHp} · 档案点 ${r.archivePoints} · ${r.schoolName} · ${r.isGuide ? '引导局' : MODE_META[r.mode]?.title}` }),
    el('div', { class: 'map' }, overview),
    el('h3', { text: '选择本列节点' }),
    renderPickGroup(),
  );
}

function renderPickGroup() {
  const r = state.run;
  const cur = Math.max(0, state.colIndex ?? 0);
  const col = r.map[cur];
  const nodes = col.map((n) => {
    n._col = cur;
    return el('div', { class: 'relic-item', style: `border-left:4px solid ${n.color}`, onclick: () => chooseNode(n) },
      el('strong', { text: n.label }),
      el('p', { class: 'info', text: n.desc }),
    );
  });
  if (nodes.length === 1 && nodes[0].__boss) {
    // Boss 列
    nodes[0].replaceChildren(
      el('strong', { text: ACTS[r.act - 1].bossId }),
    );
  }
  return el('div', { class: 'reward-list' }, nodes);
}

function chooseNode(node) {
  const r = state.run;
  r.lastNodeLabel = node.label;
  if (node.kind === 'boss') {
    renderBossIntro(node);
  } else {
    state.node = node;
    renderNodeScreen(node);
  }
}

// ---- 节点分发 ----
function renderNodeScreen(node) {
  switch (node.kind) {
    case 'combat': return launchBattle('combat');
    case 'elite': return launchBattle('elite');
    case 'event': return renderEvent(node);
    case 'rest': return renderRest();
    case 'shop': return renderShop();
    case 'internal': return renderInternal();
    default: return renderMap();
  }
}

// ========= 战斗 =========
function launchBattle(kind) {
  const r = state.run;
  const enemy = kind === 'elite' ? actEnemies(r.act, 'elite')
    : kind === 'boss' ? actEnemies(r.act, 'boss')
    : actEnemies(r.act, 'combat');
  const mod = ACTS[r.act - 1].mod;
  const g = new Game({ school: r.school, deckCards: r.buildDeck(), enemy, relics: r.relics, mod });
  g.onLog = (t, k) => pushLog(t, k);
  state.game = g;
  renderBattle(enemy, kind);
}

function renderBattle(enemy, kind) {
  const g = state.game;
  const r = state.run;
  const r2 = el('div', { class: 'arena' },
    el('div', { class: 'opponent', style: `border-left:4px solid ${enemy.color}` },
      el('div', {},
        el('div', { class: 'badge', text: `${enemy.kind} · A${r.act}` }),
        el('h2', { text: enemy.name }),
        el('p', { class: 'info', text: enemy.desc || enemy.mechanic }),
        el('p', { class: 'info', style: 'color:##888', text: `${kind} 战斗 · 意图序列轮转` }),
      ),
      el('div', { class: 'col', style: 'align-items:flex-end' },
        el('div', { class: 'hp-bar' },
          el('div', { class: 'fill', style: `width:${(g.enemy.hp / g.enemy.maxHp) * 100}%;` }),
        ),
        el('div', { class: 'intent', id: 'opponent-intent' }),
      ),
    ),
    el('div', { class: 'player' },
      el('div', {},
        el('strong', { text: `${r.schoolName} · 见习研究者` }),
        el('div', { class: 'meter' },
          el('span', { id: 'hp', text: `学识 ${g.player.hp}/${g.player.maxHp}` }),
          el('span', { id: 'guard', text: `护甲 ${g.player.guard}` }),
          el('span', { id: 'arch', text: `档案点 ${r.archivePoints}` }),
        ),
        el('div', { class: 'info', id: 'school-line', text: schoolLine(g) }),
        el('div', { class: 'info', style: 'color:#999', text: `修正器：${describeMod(enemy)}` }),
      ),
      el('div', { class: 'meter' },
        el('span', { id: 'energy', class: 'pips' }),
      ),
    ),
    el('h3', { text: '手牌' }),
    el('div', { class: 'hand', id: 'hand' }),
    el('div', { class: 'row' },
      el('button', { class: 'btn-primary', onclick: () => onEndTurn() }, '结束回合'),
      el('button', { onclick: () => onSurrender() }, '放弃'),
    ),
    el('div', { class: 'logs', id: 'logs' }),
  );
  screen().replaceChildren(r2);
  renderHand();
  refreshStage();
}

function describeMod(enemy) {
  const m = enemy.mod || ACTS[state.run.act - 1].mod;
  if (m.misread) return `旧名词之雾 · 引文 ${Math.round(m.misread * 100)}% 被误读`;
  if (m.sweepBack) return '高墙删减 · 每 3 回塞回 1 手牌';
  if (m.synthThree) return '悖论回环 · 合题需 3 张';
  if (m.mirror && enemy.kind === 'Boss') return '镜像收敛 · Boss 复制你上一张牌';
  return '引教基础 · 无修正器';
}

function schoolLine(g) {
  const map = {
    mao: `引论连锁 · 连锁层 ${g.schoolStats.chain}`,
    zheng: `灵力储蓄 · 沉淀待还 ${g._pendingReturn}`,
    zhe: `存史复用 · 本局弃牌 ${g.schoolStats.discards}`,
  };
  return map[g.school] || '';
}

function renderHand() {
  const g = state.game;
  const box = document.getElementById('hand');
  if (!box) return;
  box.replaceChildren(...g.hand.map((c) => {
    const afford = c.cost <= g.player.energy;
    const node = el('div', {
      class: 'hand-card' + (afford ? '' : ' disabled'),
      onclick: () => { if (afford) onPlay(c); },
    },
      el('div', { class: 'name', text: c.name }),
      el('div', { class: 'desc', text: c.desc }),
      el('div', { class: 'cost', text: c.cost }),
    );
    return node;
  }));
}

function refreshStage() {
  const g = state.game;
  const e = g.enemy;
  const hpFill = document.querySelector('.fill');
  if (hpFill) hpFill.style.width = `${(e.hp / e.maxHp) * 100}%`;
  const hp = document.getElementById('hp');
  if (hp) hp.textContent = `学识 ${g.player.hp}/${g.player.maxHp}`;
  const guard = document.getElementById('guard');
  if (guard) guard.textContent = `护甲 ${g.player.guard}`;
  const intent = document.getElementById('opponent-intent');
  if (intent) {
    const a = e.intents[g._intentIdx % e.intents.length];
    intent.textContent = `预备：「${a.name}」${a.dmg ? `（${a.dmg} 伤）` : ''}`;
  }
  const energy = document.getElementById('energy');
  if (energy) energy.textContent = '✦'.repeat(g.player.energy) + '·'.repeat(Math.max(0, 3 - g.player.energy));
  const sline = document.getElementById('school-line');
  if (sline) sline.textContent = schoolLine(g);
}

function onPlay(c) {
  if (c.id && c.school && c.school !== 'common') {
    if (!state.run.playedConceptIds.includes(c.id)) state.run.playedConceptIds.push(c.id);
  }
  const res = state.game.playCard(c);
  if (!res.ok) return;
  renderHand();
  refreshStage();
  if (state.game.state === 'won') onBattleWon();
  else if (state.game.state === 'lost') onBattleLost();
}

function onEndTurn() {
  const g = state.game;
  g.endTurn();
  renderHand();
  refreshStage();
  if (g.state === 'lost') onBattleLost();
}

function onSurrender() {
  pushLog('你放弃了这场思辨对决。', 'enemy');
  state.game.state = 'lost';
  onBattleLost();
}

function onBattleWon() {
  const g = state.game;
  const r = state.run;
  telemetry('battle_won', { act: r.act, enemy: g.enemy.id ?? '', school: r.school });
  r.syncHp(g.player.hp, g.player.maxHp);

  const kills = r.kills || (r.kills = 0);
  r.kills = kills + 1;
  const rank = g.enemy.kind || '小怪';
  const gain = rank === 'Boss' ? 50 : rank === '精英' ? 25 : 10;
  r.archivePoints += gain;
  r.insight += gain;

  // 打出过的概念牌触发纵贯线登记
  g.deck.cards.forEach((c) => {
    if (c.school && c.school !== 'common' && g.schoolStats && c.tag) { /* noop */ }
  });

  const w = el('div', { class: 'end-screen' },
    el('h2', { text: `驳倒了「${g.enemy.name}」` }),
    el('p', { class: 'info', text: `档案点 +${gain} · 洞察 +${gain}` }),
  );
  screen().replaceChildren(w);

  if (rank === 'Boss') {
    // 每幕 Boss：过幕 + 触发
    r.triggeredNodes.push(`act${r.act}_boss`);
    setTimeout(() => actTransition(), 900);
    return;
  }
  if (state.node?.kind === 'elite') {
    // 精英 25% 掉专武
    if (Math.random() < 0.25) {
      const sw = RELICS.find((x) => x.school === r.school);
      if (sw && !r.relics.some((x) => x.id === sw.id)) {
        r.relics.push(sw);
        pushLog(`精英掉专武：「${sw.name}」`, 'good');
      }
    }
    setTimeout(renderReward, 900);
    return;
  }
  // 入库战：3 选 1
  setTimeout(renderRelicChoice, 900);
}

function actTransition() {
  const r = state.run;
  if (r.act >= 5) { finishRun(true); return; }
  r.act += 1;
  r.map = r.genMap(r.act);
  state.colIndex = 0;
  renderActIntro();
}

function renderActIntro() {
  const r = state.run;
  const a = ACTS[r.act - 1];
  screen().replaceChildren(
    el('div', { class: 'end-screen' },
      el('h2', { text: `${a.name}` }),
      el('p', { class: 'info', text: r.isGuide ? '引导局：无幕修正器，教学事件链推进。' : describeMod({ mod: a.mod }) }),
      el('div', { class: 'row', style: 'margin-top:14px' },
        el('button', { class: 'btn-primary', onclick: renderMap }, '进入地图'),
      ),
    ),
  );
}

function renderReward() {
  // 精英战胜利：奖励处理完，沿地图推进一列
  advanceAfterNode();
}

// 3 选 1 遗物
function renderRelicChoice() {
  const r = state.run;
  const candidates = RELICS
    .filter((rl) => !r.relics.some((x) => x.id === rl.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  const view = el('div', { class: 'arena' },
    el('h2', { text: '入库 · 3 选 1 遗物' }),
    el('p', { class: 'info', text: '从书目中入库一件，研究方法升级。' }),
    el('div', { class: 'reward-list' }, candidates.map((rc) =>
      el('div', { class: 'relic-item', onclick: () => pickRelic(rc) },
        el('strong', { text: rc.name }),
        el('p', { class: 'info', text: rc.desc }),
        el('div', { class: 'r', text: rc.rarity }),
      )
    )),
  );
  screen().replaceChildren(view);
}

function pickRelic(rc) {
  const r = state.run;
  r.relics.push(rc);
  pushLog(`入库：${rc.name}`, 'good');
  telemetry('relic_pick', { relic: rc.id });
  advanceAfterNode();
}

function advanceAfterNode() {
  const r = state.run;
  if (state.colIndex >= r.map.length - 1) {
    // 已到 Boss 列前 → 本幕 Boss 待打（列 4）
    renderMap();
    return;
  }
  state.colIndex = (state.colIndex ?? 0) + 1;
  renderMap();
}

function renderBossIntro(node) {
  const r = state.run;
  const enemy = actEnemies(r.act, 'boss');
  screen().replaceChildren(
    el('div', { class: 'end-screen' },
      el('h2', { text: `第 ${r.act} 幕 Boss · ${enemy.name}`, style: 'color:#b04a4a' }),
      el('p', { class: 'info', text: enemy.mechanic }),
      el('p', { class: 'info', text: enemy.desc }),
      el('p', { class: 'info', text: `学识 ${r.hp}/${r.maxHp} · 档案点 ${r.archivePoints}` }),
      el('div', { class: 'row', style: 'margin-top:14px' },
        el('button', { class: 'btn-primary', onclick: () => { state.node = node; launchBattle('boss'); } }, '开打'),
        el('button', { onclick: renderMap }, '返回'),
      ),
    ),
  );
}

function onBattleLost() {
  const r = state.run;
  const g = state.game;
  telemetry('battle_lost', { act: r.act, school: r.school });
  r.syncHp(g ? g.player.hp : r.hp);
  // 洞察 40%
  const insight = Math.round((r.insight || 0) * 0.4);
  finishRunConcede(insight);
}

function finishRunConcede(insight) {
  const r = state.run;
  const s = Save.load();
  // 首次失败保护：归档中断（无黑化/劝退）
  const isFirstFail = !s.guideWon && !s.formalWins && !(s.fails || 0);
  const newInsight = s.insight + insight;
  const wiped = s.formalWins || 0;
  Save.save({
    insight: newInsight,
    fails: (s.fails || 0) + 1,
    guideWon: s.guideWon || (r.isGuide && (s.guideDone || false)) || false,
    deletedCount: s.deletedCount || 0,
    formalWins: wiped,
  });
  telemetry('run_end', { mode: r.mode, outcome: 'concede', insight });

  screen().replaceChildren(
    el('div', { class: 'end-screen' },
      el('h2', { text: isFirstFail ? '归档中断' : '被劝退' }),
      el('p', { text: isFirstFail
        ? '你把未完成的档案暂存起来，改日再战——这是研究里常见的一步，不是失败。'
        : '你被驳倒了——但批评与自我批评本就是研究的一部分。' }),
      el('p', { class: 'info', text: `获得洞察 +${insight}（终身 ${newInsight}）。` }),
      el('div', { class: 'row', style: 'margin-top:14px' },
        el('button', { class: 'btn-primary', onclick: showSchoolSelect }, '回主城'),
      ),
    ),
  );
}

// ========= 屏幕：事件 =========
function renderEvent(node) {
  const r = state.run;
  const pool = EVENTS.filter((ev) => !r.eventsSettled.includes(ev.id) && (ev.act ?? 99) >= r.act);
  const ev = pool.length ? pool[Math.floor(Math.random() * pool.length)] : EVENTS[0];
  if (ev) r.eventsSettled.push(ev.id);
  state._ev = ev;

  const bannedRegret = ev.options.filter((o) => !boundedRegret(o, r.maxHp));
  const options = ev.options.filter((o) => !bannedRegret.includes(o));
  const view = el('div', { class: 'arena' },
    el('div', { class: 'badge', text: `事件 · ${ev.act ?? 1}` }),
    el('h2', { text: ev.title }),
    el('p', { class: 'info', text: ev.text }),
    el('div', { class: 'reward-list' }, options.map((o) =>
      el('div', { class: 'relic-item', onclick: () => resolveEvent(o, ev) },
        el('strong', { text: o.text }),
        el('p', { class: 'info', text: describeChoice(o) }),
      )
    )),
  );
  screen().replaceChildren(view);
}

function describeChoice(o) {
  const parts = [];
  if (o.cost?.archive) parts.push(`代价 ${o.cost.archive} 档案点`);
  if (o.hpCost) parts.push(`代价 ${o.hpCost} 学识`);
  const r = [];
  if (o.reward?.archive) r.push(`+${o.reward.archive} 档案点`);
  if (o.reward?.concept) r.push('+概念牌');
  if (o.reward?.book) r.push('+精读书目');
  if (o.reward?.insight) r.push(`+${o.reward.insight} 洞察`);
  if (o.reward?.heal) r.push(`+${o.reward.heal} 学识`);
  return [...parts, ...r].join(' · ') || o.note || '';
}

function resolveEvent(o, ev) {
  const r = state.run;
  if (o.cost?.archive) {
    if (r.archivePoints < o.cost.archive) { pushLog('档案点不足。', 'enemy'); return; }
    r.archivePoints -= o.cost.archive;
  }
  if (o.hpCost) {
    r.hp = Math.max(0, r.hp - o.hpCost);
    if (r.hp <= 0) { finishRunConcede(0); return; }
  }
  if (o.reward?.archive) r.archivePoints += o.reward.archive;
  if (o.reward?.insight) r.insight += o.reward.insight;
  if (o.reward?.heal) r.hp = Math.min(r.maxHp, r.hp + o.reward.heal);
  if (o.reward?.book) {
    const book = BOOKS[Math.floor(Math.random() * BOOKS.length)];
    r.archivePoints += 0; // 书目记为纵贯线节点
    r.triggeredNodes.push(`book_${book.id}`);
    r.lastBook = book;
  }
  if (o.reward?.concept) {
    const pool = CONCEPT_CARDS.filter((c) => !r.acquired.some((a) => a.id === c.id));
    if (pool.length) {
      const card = pool[Math.floor(Math.random() * pool.length)];
      r.acquired.push(card);
      r.triggeredNodes.push(`concept_${card.id}`);
      pushLog(`获得概念牌「${card.name}」`, 'good');
    }
  }
  r.triggeredNodes.push(`ev_${ev.id}`);
  pushLog(`结算事件：「${ev.title}」，你选择：${o.text}`, 'me');
  advanceAfterNode();
}

// ========= 屏幕：休息 =========
function renderRest() {
  const r = state.run;
  const heal = Math.round(r.maxHp * 0.3);
  screen().replaceChildren(
    el('div', { class: 'arena' },
      el('h2', { text: '休息 · 梳理' }),
      el('p', { class: 'info', text: `选择一段时间如何处理 (学识 ${r.hp}/${r.maxHp})` }),
      el('div', { class: 'reward-list' },
        el('div', { class: 'relic-item', onclick: () => { r.hp = Math.min(r.maxHp, r.hp + heal); pushLog(`休整：恢复 ${heal} 学识`, 'good'); advanceAfterNode(); } },
          el('strong', { text: '休整' }), el('p', { class: 'info', text: `恢复 ${heal} 学识` })),
        el('div', { class: 'relic-item', onclick: () => { r.archivePoints += 8; r.insight += 2; pushLog('梳理：档案点 +8，洞察 +2', 'good'); advanceAfterNode(); } },
          el('strong', { text: '梳理' }), el('p', { class: 'info', text: '档案点 +8，洞察 +2（不恢复学识）' })),
        el('div', { class: 'relic-item', onclick: () => { const book = BOOKS[Math.floor(Math.random() * BOOKS.length)]; r.triggeredNodes.push(`book_${book.id}`); pushLog(`翻书：《${book.title}》`, 'me'); advanceAfterNode(); } },
          el('strong', { text: '翻书' }), el('p', { class: 'info', text: '精读 1 本 → 纵贯线节点' })),
      ),
    ),
  );
}

// ========= 屏幕：商店 =========
function renderShop() {
  const r = state.run;
  const stock = CONCEPT_CARDS
    .filter((c) => !r.acquired.some((a) => a.id === c.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);
  const dPrice = deletePrice();
  const view = el('div', { class: 'arena' },
    el('h2', { text: '白区红区 · 商店' }),
    el('p', { class: 'info', text: `档案点 ${r.archivePoints} · 买牌价=MV | 删牌全局第 ${getGlobalDeleteCount()} 次` }),
    el('h3', { text: '买概念牌' }),
    el('div', { class: 'reward-list' }, stock.map((c) => {
      const p = buyPrice(c, r.relics);
      return el('div', { class: 'relic-item' + (r.archivePoints >= p ? '' : ' disabled'), onclick: () => buyCard(c, p) },
        el('div', {}, el('strong', { text: c.name }), el('span', { class: 'cost', text: String(p) })),
        el('p', { class: 'info', text: `${c.desc} (MV≈${cardMV(c)})` }),
      );
    })),
    el('h3', { text: '删牌（全局累进 ${dPrice.cost} → ${dPrice.next}）' }),
    el('div', { class: 'row' },
      el('button', {
        class: r.archivePoints >= dPrice.cost && r.acquired.length ? 'btn-primary' : '',
        onclick: () => removeCard(),
      }, `删 1 张 (${dPrice.cost} 档案点)`),
      el('button', { onclick: advanceAfterNode }, '离开商店'),
    ),
  );
  screen().replaceChildren(view);
}

function buyCard(c, p) {
  const r = state.run;
  if (r.archivePoints < p) return;
  if (r.acquired.some((a) => a.id === c.id)) return;
  r.archivePoints -= p;
  r.acquired.push(c);
  r.boughtThisRun += 1;
  pushLog(`买入「${c.name}」（-${p} 档案点）`, 'good');
  renderShop();
}

function removeCard() {
  const r = state.run;
  const dPrice = deletePrice();
  if (r.archivePoints < dPrice.cost) { pushLog('档案点不足。', 'enemy'); return; }
  if (!r.acquired.length) { pushLog('没有可删的额外牌。', 'enemy'); return; }
  r.archivePoints -= dPrice.cost;
  const removed = r.acquired.splice(0, 1)[0];
  r.deletedThisRun += 1;
  r.save.deletedCount = (r.save.deletedCount || 0) + 1;
  setGlobalDeleteCount(r.save.deletedCount);
  Save.save({ deletedCount: r.save.deletedCount });
  pushLog(`删牌「${removed.name}」（本次 ${dPrice.cost}，下次 ${dPrice.next}）`, 'good');
  renderShop();
}

// ========= 屏幕：内化 =========
function renderInternal() {
  const r = state.run;
  const m = ACTS[r.act - 1].mod;
  const view = el('div', { class: 'arena' },
    el('h2', { text: '内化 · 精读/合题/总结' }),
    el('p', { class: 'info', text: `档案点 ${r.archivePoints} · 已精读 ${r.internalDone.filter((x) => x.startsWith('read_')).length}` }),
    el('h3', { text: '精读（1 档案点 → 概念牌）' }),
    el('div', { class: 'reward-list' },
      el('div', { class: 'relic-item', onclick: () => doRead() },
        el('strong', { text: '翻书精读' }), el('p', { class: 'info', text: `花费 1 档案点，抽 1 概念牌 ${m.misread ? '（误读需复核+1）' : m.internalCostup ? '（费用+30%）' : ''}` })),
    ),
    el('h3', { text: '合题（2 互斥牌 + 1 档案点 → 进阶牌）' }),
    el('div', { class: 'reward-list' },
      el('div', { class: 'relic-item', onclick: () => doSynthesis() },
        el('strong', { text: '合题' }), el('p', { class: 'info', text: `选 ${m.synthThree ? 3 : 2} 张互斥/旧牌合并` })),
    ),
    el('h3', { text: '总结（需"已读"前置）' }),
    el('div', { class: 'reward-list' },
      el('div', { class: 'relic-item', onclick: () => doSummary() },
        el('strong', { text: '写总结' }), el('p', { class: 'info', text: '已精读数≥1（镜像收敛需 2）→ +洞察' })),
    ),
    el('button', { onclick: advanceAfterNode }, '离开'),
  );
  screen().replaceChildren(view);
}

function doRead() {
  const r = state.run;
  const res = internalizeRead({
    archivePoints: r.archivePoints,
    school: r.school,
    ownedIds: r.acquired.map((c) => c.id),
    conceptPool: CONCEPT_CARDS,
    mod: ACTS[r.act - 1].mod,
  });
  if (!res.ok) { pushLog(res.reason, 'enemy'); return; }
  r.archivePoints -= res.cost;
  r.acquired.push(res.card);
  r.internalDone.push('read_' + res.card.id);
  r.triggeredNodes.push('read_' + res.card.id);
  pushLog(res.note, 'good');
  renderInternal();
}

function doSynthesis() {
  const r = state.run;
  const pool = r.acquired;
  if (pool.length < 2) { pushLog('没有足够的旧牌合题。', 'enemy'); return; }
  const m = ACTS[r.act - 1].mod;
  const need = m.synthThree ? 3 : 2;
  const list = pool.slice(0, Math.max(need, pool.length)).sort(() => Math.random() - 0.5).slice(0, need);
  const res = internalizeSynthesis({ archivePoints: r.archivePoints, acquired: pool, mod: m, relic: r.relics.find((x) => x.effect?.synthDiscount) }, list);
  if (!res.ok) { pushLog(res.reason, 'enemy'); return; }
  r.archivePoints -= res.cost;
  // 从收藏移除被合体的旧牌
  const oldIds = new Set(list.map((x) => x.id));
  r.acquired = r.acquired.filter((c) => !oldIds.has(c.id));
  r.acquired.push(res.merged);
  r.internalDone.push('synth_' + res.merged.id);
  r.triggeredNodes.push('synth_' + res.merged.id);
  pushLog(`合题成功：「${res.merged.name}」`, 'good');
  renderInternal();
}

function doSummary() {
  const r = state.run;
  const res = internalizeSummary({ readCount: r.internalDone.filter((x) => x.startsWith('read_')).length, mod: ACTS[r.act - 1].mod, archive: r.internalDone.filter((x) => x.startsWith('sum_')).length });
  if (!res.ok) { pushLog(res.reason, 'enemy'); return; }
  r.insight += res.insight;
  r.internalDone.push('sum_1');
  r.triggeredNodes.push('sum_1');
  pushLog(res.note, 'good');
  renderInternal();
}

// ========= 通关结算 =========
function finishRun(won) {
  const r = state.run;
  const cov = coverageRatio({ acts: r.act, triggeredNodes: r.triggeredNodes, schoolCoeff: { mao: 1.0, zheng: 1.1, zhe: 1.05 }[r.school] });
  const s = Save.load();
  let addInsight = Math.round((r.insight || 0) * (won ? 1 : 0.4));
  if (r.mode === 'short') addInsight = Math.round(addInsight * 0.5);

  const newInsight = s.insight + addInsight;
  const guideDone = s.guideWon || (r.isGuide && won);
  const formalWins = (s.formalWins || 0) + (won && r.mode === 'formal' ? 1 : 0);

  Save.save({ insight: newInsight, guideWon: guideDone, formalWins, deletedCount: s.deletedCount || 0, fails: s.fails || 0 });
  telemetry('run_finish', { mode: r.mode, won, insight: addInsight, archive: r.archivePoints, act: r.act, school: r.school });

  const ratio = (cov.ratio * 100).toFixed(0) + '%';
  screen().replaceChildren(
    el('div', { class: 'end-screen' },
      el('h2', { text: won ? '镜像闭合 · 通关' : '归档' }),
      el('p', { class: 'info', text: won
        ? `你走完了五幕，写下了自己的总结。别急着超越他——先证明你读懂了。`
        : '本局落幕。洞察永不清零。' }),
      el('div', { style: 'margin:14px 0' },
        el('div', { class: 'stat' }, el('span', { text: '本局洞察' }), el('strong', { text: `+${addInsight}` })),
        el('div', { class: 'stat' }, el('span', { text: '终身洞察' }), el('strong', { text: String(newInsight) })),
        el('div', { class: 'stat' }, el('span', { text: '档案点' }), el('strong', { text: String(r.archivePoints) })),
        el('div', { class: 'stat' }, el('span', { text: '史料纵贯线' }), el('strong', { text: `${cov.numerator}/${cov.denominator} = ${ratio}` })),
        el('div', { class: 'stat' }, el('span', { text: '加入牌/内化' }), el('strong', { text: `${r.acquired.length} 牌 / ${r.internalDone.length} 次` })),
        el('div', { class: 'stat' }, el('span', { text: '删牌/买牌' }), el('strong', { text: `${r.deletedThisRun} / ${r.boughtThisRun}` })),
      ),
      el('div', { class: 'row' },
        el('button', { class: 'btn-primary', onclick: showSchoolSelect }, '再来一局'),
        el('button', { onclick: showArchive }, '查看档案'),
      ),
    ),
  );
}

// ========= 档案/遥测/关于 =========
function showArchive() {
  const s = Save.load();
  screen().replaceChildren(
    el('div', { class: 'end-screen' },
      el('h2', { text: '结业档案' }),
      el('div', { style: 'margin:14px 0' },
        el('div', { class: 'stat' }, el('span', { text: '终身洞察' }), el('strong', { text: String(s.insight) })),
        el('div', { class: 'stat' }, el('span', { text: '引导局完成' }), el('strong', { text: s.guideWon ? '是' : '否' })),
        el('div', { class: 'stat' }, el('span', { text: '正式通关' }), el('strong', { text: String(s.formalWins || 0) })),
        el('div', { class: 'stat' }, el('span', { text: '全局删牌' }), el('strong', { text: String(s.deletedCount || 0) })),
        el('div', { class: 'stat' }, el('span', { text: '失败次数' }), el('strong', { text: String(s.fails || 0) })),
      ),
      el('button', { onclick: showSchoolSelect }, '返回'),
    ),
  );
}

function showTelemetry() {
  const dump = telemetryDump();
  const rows = [...dump].reverse().slice(0, 12);
  screen().replaceChildren(
    el('div', { class: 'end-screen' },
      el('h2', { text: '遥测（本机 · 仅看）' }),
      el('p', { class: 'info', text: `共 ${dump.length} 条埋点（cap 2000/池）` }),
      el('div', { style: 'margin:10px 0' }, rows.map((t) => {
        const meta = { a: t.act ?? t.idx ?? '', m: t.mode || '', s: t.school || '' };
        return el('div', { class: 'log', text: `${new Date(t.at).toLocaleTimeString()} ${t.event} ${JSON.stringify(meta)}` });
      })),
      el('button', { onclick: showSchoolSelect }, '返回'),
    ),
  );
}

// 轻量读取遥测
function showAbout() {
  screen().replaceChildren(
    el('div', { class: 'end-screen' },
      el('h2', { text: '关于' }),
      el('p', { class: 'info', text: '理论牌组：把「边建库边建群」的自我教育思想史做成思辨牌局。' }),
      el('p', { class: 'info', text: '本作改编自个人学习日志，仅作学习与归档用途。数据源已脱敏，不含群名、昵称与联系号码。' }),
      el('button', { onclick: showSchoolSelect }, '返回'),
    ),
  );
}

function showRunStatus() {
  const r = state.run;
  pushLog(`进度：第 ${r.act} 幕 | 学识 ${r.hp}/${r.maxHp} | 档案点 ${r.archivePoints} | 洞察 ${r.insight}`, 'me');
  renderMap();
}
showSchoolSelect();

// eslint-disable-next-line no-unused-vars
const never = RELICS;
// eslint-disable-next-line no-unused-vars
const alsoNumbers = ENEMIES;