// 遥测 T 循环：本机埋点，按 v0.10 口径分正式/短局/无尽三池（切片=正式）
const KEY = 'theory_game_telemetry_v1';

export function telemetry(event, data = {}) {
  let bucket = [];
  try {
    bucket = JSON.parse(localStorage.getItem(KEY)) || [];
  } catch (e) {
    bucket = [];
  }
  bucket.push({ event, pool: 'formal', at: Date.now(), ...data });
  // 兜住存储上限
  if (bucket.length > 2000) bucket = bucket.slice(-1500);
  try {
    localStorage.setItem(KEY, JSON.stringify(bucket));
  } catch (e) {
    // 满：清最旧一半
    try {
      localStorage.setItem(KEY, JSON.stringify(bucket.slice(-750)));
    } catch (_e) {
      /* ignore */
    }
  }
}

export function telemetryDump() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch (e) {
    return [];
  }
}