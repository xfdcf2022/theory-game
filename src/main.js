import { SCHOOLS, startingDeck, CONCEPT_CARDS, RELICS, ENEMIES } from './data.js';
import { Game } from './engine.js';
import { Save } from './save.js';
import { telemetry } from './telemetry.js';

const screen = () => document.getElementById('screen');

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  });
  children.flat().forEach((c) => {
    if (c) node.append(c.nodeType ? c : document.createTextNode(String(c)));
  });
  return node;
}

// ---- 全局状态 ----
const state = {
  school: null,
  relic: null,
  battleIndex: 0,
  game: null,
  acquired: [],       // 本局获得的概念牌收藏
  archivePoints: 0,
  insight: 0,
  logList: [],
};

const LOG = [];
function pushLog(text, kind = 'me') {
  LOG.push({ text, kind });
  const box = document.getElementById('logs');
  if (box) {
    const line = el('div', { class: kind === 'enemy' ? 'enemy' : kind === 'good' ? 'me' : 'me', text });
    box.append(line);
    box.scrollTop = box.scrollHeight;
    state.logList.push({ text, kind });
    if (LOG.length > 60) { LOG.shift(); box.firstChild?.remove(); }
  }
}

// ---- 屏幕 1：选学派 ----
export function showSchoolSelect() {
  state.battleIndex = 0;
  state.acquired = [];
  state.relic = null;
  state.archivePoints = 0;
  state.insight = 0;

  const s = Save.load();
  const welcome = s.school ? `上次你以「${s.school}」出发，继续当见习研究者。` : '你已是见习研究者：学他的牌，驳它的旧敌。';

  screen().replaceChildren(
    el('div', { class: 'screen-title' },
      el('h1', { text: '理论牌组' }),
      el('p', { class: 'info', text: '否证切片 · 首通引导局 | v0.10' }),
      el('p', { text: welcome }),
    ),
    el('h2', { text: '选择你要继承的学派' }),
    el('div', { class: 'row' }, Object.values(SCHOOLS).map((sc) =>
      el('div', { class: 'school-card', onclick: () => startSlice(sc) },
        el('h3', { text: sc.name, style: `color:${sc.color}` }),
        el('p', { class: 'info', text: `${sc.phase} · ${sc.growth}` }),
        el('p', { class: 'e', text: sc.rule }),
      )
    )),
    el('div', { class: 'tab', style: 'margin-top:18px' },
      el('button', { onclick: showArchive }, '结业档案'),
      el('button', { onclick: showAbout }, '关于'),
    ),
  );
}

// ---- 屏幕 2：战斗 ----
function startSlice(school) {
  state.school = school.id;
  telemetry('school_select', { school: school.id });

  const deckCards = startingDeck(school.id);
  // 切片：开局就注入两张概念牌以便测试组合技与学派引擎
  const seeded = CONCEPT_CARDS.filter((c) => c.school === school.id || c.school === 'common').slice(0, 2);
  seeded.forEach((c) => { deckCards.push({ ...c }); state.acquired.push(c); });

  launchBattle(0);
}

function launchBattle(idx) {
  const enemy = ENEMIES[idx] || ENEMIES[ENEMIES.length - 1];
  const relics = state.relic ? [state.relic] : [];
  const game = new Game({
    school: state.school,
    deckCards: RunDeck(),
    enemy,
    relics,
  });
  game.onLog = (t, k) => pushLog(t, k);
  state.game = game;

  renderBattle(enemy);
}

// 本局牌堆 = 开局牌 + 已获得概念牌
function RunDeck() {
  const base = startingDeck(state.school);
  state.acquired.forEach((c) => base.push({ ...c }));
  return base;
}

function renderBattle(enemy) {
  const g = state.game;
  const r = el('div', { class: 'arena' },
    // 敌人面板
    el('div', { class: 'opponent', style: `border-left:4px solid ${enemy.color}` },
      el('div', {},
        el('div', { class: 'badge', text: `${enemy.kind} · B${state.battleIndex + 1}/3` }),
        el('h2', { text: enemy.name }),
        el('p', { class: 'info', text: enemy.desc }),
      ),
      el('div', { class: 'col', style: 'align-items:flex-end' },
        el('div', { class: 'hp-bar' },
          el('div', { class: 'fill', style: `width:${(g.enemy.hp / g.enemy.maxHp) * 100}%;` }),
        ),
        el('div', { class: 'intent', id: 'opponent-intent' }),
      ),
    ),
    // 玩家面板
    el('div', { class: 'player' },
      el('div', {},
        el('strong', { text: '见习研究者' }),
        el('div', { class: 'meter' },
          el('span', { id: 'hp', text: `学识 ${g.player.hp}/${g.player.maxHp}` }),
          el('span', { id: 'guard', text: `护甲 ${g.player.guard}` }),
          el('span', { id: 'arch', text: `档案点 ${state.archivePoints}` }),
        ),
        el('div', { class: 'info', id: 'school-line', text: schoolLine(g) }),
      ),
      el('div', { class: 'meter' },
        el('span', { id: 'energy', class: 'pips' }),
      ),
    ),
    // 手牌
    el('h3', { text: '手牌' }),
    el('div', { class: 'hand', id: 'hand' }),
    // 操作条
    el('div', { class: 'row' },
      el('button', { class: 'btn-primary', onclick: () => onEndTurn() }, '结束回合'),
      el('button', { onclick: () => onSurrender() }, '放弃'),
    ),
    // 日志
    el('div', { class: 'logs', id: 'logs' }),
  );
  screen().replaceChildren(r);
  renderHand();
  refreshStage();
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
  telemetry('battle_won', { idx: state.battleIndex });
  const rewards = [10, 25, 50];
  state.archivePoints += rewards[state.battleIndex];
  state.insight += rewards[state.battleIndex];

  if (state.battleIndex === 0 && !state.relic) {
    // 入库战：3 选 1 遗物
    renderRelicChoice();
    return;
  }
  if (state.battleIndex === 1) {
    // 精英战：给张概念牌
    const pool = CONCEPT_CARDS.filter((c) => !state.acquired.some((a) => a.id === c.id));
    if (pool.length) {
      const card = pool[Math.floor(Math.random() * pool.length)];
      state.acquired.push(card);
      pushLog(`精英战奖励：获得概念牌「${card.name}」`, 'good');
    }
  }
  nextOrFinish();
}

function renderRelicChoice() {
  const candidates = RELICS.filter((r) => !state.relic || r.id !== state.relic.id).slice(0, 3);
  const r = el('div', { class: 'arena' },
    el('h2', { text: '入库 · 3 选 1 遗物' }),
    el('p', { class: 'info', text: `你驳倒了「${ENEMIES[0].name}」，从书目中入库一件。` }),
    el('div', { class: 'reward-list' }, candidates.map((rc) =>
      el('div', { class: 'relic-item', onclick: () => pickRelic(rc) },
        el('strong', { text: rc.name }),
        el('p', { class: 'info', text: rc.desc }),
        el('div', { class: 'r', text: rc.rarity }),
      )
    )),
  );
  screen().replaceChildren(r);
}

function pickRelic(rc) {
  state.relic = rc;
  pushLog(`入库：${rc.name}`, 'good');
  if (state.battleIndex === 0) {
    nextOrFinish();
  }
}

function nextOrFinish() {
  if (state.battleIndex < ENEMIES.length - 1) {
    state.battleIndex += 1;
    launchBattle(state.battleIndex);
  } else {
    renderSynthesis();
  }
}

function onBattleLost() {
  telemetry('battle_lost', { idx: state.battleIndex });
  state.insight += 40;
  showFail();
}

// ---- 屏幕 3：合题 ----
function renderSynthesis() {
  const pool = CONCEPT_CARDS.filter((c) => c.merge || c.school === 'common').slice(0, 5);
  const r = el('div', { class: 'arena' },
    el('h2', { text: '合题 · 白区×红区' }),
    el('p', { class: 'info', text: '把互斥的两张牌合题，方法论升级。选 2 张合并（先选一张）。' }),
    el('div', { class: 'slot', id: 'syn-slot' }),
    el('div', { class: 'reward-list', id: 'syn-pool' }, pool.map((c) =>
      el('div', {
        class: 'synthesis-pick',
        onclick: () => chooseSynthesis(c),
      },
        el('strong', { text: c.name }),
        el('p', { class: 'info', text: c.desc }),
      )
    )),
    el('div', { class: 'row' },
      el('button', { class: 'btn-primary', onclick: submitSynthesis }, '合并'),
      el('button', { onclick: finishSlice }, '跳过合题'),
    ),
  );
  screen().replaceChildren(r);
  state._synPick = null;
}

function chooseSynthesis(c) {
  state._synPick = c;
  document.querySelectorAll('.synthesis-pick').forEach((n) => n.classList.remove('sel'));
  const pool = [...document.querySelectorAll('.synthesis-pick')];
  const node = pool.find((n) => n.firstChild?.textContent === c.name);
  if (node) node.classList.add('sel');
}

function submitSynthesis() {
  const c = state._synPick;
  if (!c) { pushLog('请先选择一张要合并的牌。'); return; }
  const merged = { ...c, id: c.id + '_synth', name: c.name + '·升级', cost: Math.max(1, c.cost - 1), desc: c.desc + '（合并后 -1 费）', merged: true };
  state.acquired.push(merged);
  state.archivePoints = Math.max(0, Math.floor(state.archivePoints * (state.relic?.effect?.synthDiscount ? 0.7 : 1)));
  pushLog(`合题成功：「${c.name}」→「${merged.name}」`, 'good');
  finishSlice();
}

// ---- 屏幕 4：结业档案 ----
function finishSlice() {
  const s = Save.load();
  const totalInsight = s.insight + state.insight;
  Save.save({ school: state.school, insight: totalInsight, wins: s.wins + (state.game && state.game.state === 'won' ? 1 : 0), archive: s.archive });
  telemetry('slice_finish', { insight: state.insight, archive: state.archivePoints, school: state.school });

  const stats = [
    ['驳倒场次', '3 / 3'],
    ['本局洞察', `+${state.insight}`],
    ['档案点', `${state.archivePoints}`],
    ['学派', SCHOOLS[state.school].name],
    ['已获概念牌', `${state.acquired.length} 张`],
    ['终身洞察', `${totalInsight}`],
  ];
  const r = el('div', { class: 'end-screen' },
    el('h2', { text: '结业档案' }),
    el('p', { class: 'info', text: '你的总结已归档（本机导出）。所有数据已脱敏，仅存于 localStorage。' }),
    el('div', { style: 'margin:14px 0' }, stats.map(([k, v]) =>
      el('div', { class: 'stat' }, el('span', { text: k }), el('strong', { text: v })),
    )),
    el('div', { class: 'row' },
      el('button', { class: 'btn-primary', onclick: showSchoolSelect }, '再来一局'),
      el('button', { onclick: showArchive }, '查看档案'),
    ),
  );
  screen().replaceChildren(r);
}

function showFail() {
  const r = el('div', { class: 'end-screen' },
    el('h2', { text: '被劝退' }),
    el('p', { text: '你被驳倒了——但批评与自我批评本就是研究的一部分。' }),
    el('p', { class: 'info', text: `获得洞察 +40（本局累计 ${state.insight}）。` }),
    el('div', { class: 'row', style: 'margin-top:14px' },
      el('button', { class: 'btn-primary', onclick: showSchoolSelect }, '回主城'),
    ),
  );
  screen().replaceChildren(r);
}

function showArchive() {
  const s = Save.load();
  const r = el('div', { class: 'end-screen' },
    el('h2', { text: '结业档案' }),
    el('div', { style: 'margin:14px 0' },
      el('div', { class: 'stat' }, el('span', { text: '终身洞察' }), el('strong', { text: String(s.insight) })),
      el('div', { class: 'stat' }, el('span', { text: '对拍胜利' }), el('strong', { text: String(s.wins) })),
    ),
    el('button', { onclick: showSchoolSelect }, '返回'),
  );
  screen().replaceChildren(r);
}

function showAbout() {
  const r = el('div', { class: 'end-screen' },
    el('h2', { text: '关于' }),
    el('p', { class: 'info', text: '理论牌组：把「边建库边建群」的自我教育思想史做成思辨牌局。' }),
    el('p', { class: 'info', text: '本作改编自个人学习日志，仅作学习与归档用途。数据源已脱敏，不含群名、昵称与联系号码。' }),
    el('button', { onclick: showSchoolSelect }, '返回'),
  );
  screen().replaceChildren(r);
}

// ---- 启动 ----
showSchoolSelect();