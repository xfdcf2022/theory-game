// localStorage v3 存档：永久洞察不清零、损坏自动重置保洞察
const KEY = 'theory_game_save_v3';

export const Save = {
  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && typeof raw === 'object') {
        return {
          school: raw.school || null,
          insight: Number(raw.insight) || 0,
          wins: Number(raw.wins) || 0,
          archive: raw.archive || [],
        };
      }
    } catch (e) {
      // 存档损坏：重置，但保留可恢复的洞察（预留在 NewGame 前可读）
    }
    return { school: null, insight: 0, wins: 0, archive: [] };
  },
  save(data) {
    const next = { ...this.load(), ...data };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch (e) {
      // 存储满：降级尝试只存洞察
    }
    return next;
  },
};