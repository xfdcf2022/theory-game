#!/usr/bin/env python3
"""
M1 数据管线：从 theory-notes 的 md 抽取候选内容，做脱敏校验与选材打分。

用法：
  python3 pipeline/build_data.py --src <theory-notes 目录> [--out data/candidates.json]
  python3 pipeline/build_data.py --check              # 仅校验脱敏规范（默认从 src 读取）

设计基准 (v0.10)：
  - 脱敏规则：公开内容不允许群名/群昵称/QQ号
  - 选材打分 rubrics：可抉择性/概念代表度/史实信息量，各 0-3 → 满分 8
  - 数据快照 pin：data_snapshot.json（版本+哈希）
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SRC = Path.home() / "Documents/QQChatExporter/exports/分账号导出_2022-11至2026-09/时间线md"

# ---- 脱敏黑名单（v0.10 规则）----
BANNED = [
    # 群名
    "做个老师的好学生", "先锋队冲锋",
    # 群昵称
    "沉默", "小冲锋", "沉默的猫",
    # QQ 号
    "85124187", "1449748962",
]
QQ_PATTERN = re.compile(r"(\d{5,13})")

# ---- 选材打分 rubrics（0-3 档，供 M4 作者桌校准）----
RUBRICS = {
    "choiceness": ["陈述句无岔路", "有决策但无风险", "二选一 + 代价", "多选 + 连锁后果"],
    "representation": ["日常口水", "主题外延", "学派核心概念", "独立创新概念"],
    "history": ["零", "泛泛", "具体事件", "独家细节/反差"],
}


def sanitize_check(text: str) -> list[str]:
    """返回违规命中列表；空表即通过。"""
    hits = []
    for b in BANNED:
        if b and b in text:
            hits.append(f"敏感词「{b}」")
    qq = QQ_PATTERN.findall(text)
    for q in qq:
        hits.append(f"疑似号码 {q}")
    return hits


def parse_md_candidates(src: Path) -> list[dict]:
    """粗糙抽取 md 中『引文/理论点』候选行（加粗行或引号行）。"""
    candidates = []
    for md in sorted(src.glob("*.md")):
        try:
            lines = md.read_text(encoding="utf-8").splitlines()
        except Exception:
            continue
        for line in lines:
            s = line.strip()
            if not s or s.startswith("#") or s.startswith("|"):
                continue
            # 寻找带引号或加粗的实质内容
            if ("「" in s or "“" in s or "《" in s or "**" in s) and len(s) > 12:
                candidates.append({"file": md.name, "line": line, "text": s})
    return candidates


def score_rubric(text: str) -> dict:
    """按 rubrics 打粗分（v0.10 口径：作为 M2.5b 校准前的初筛，最终校准在作者桌）。"""
    s = 0
    s += 2 if "「" in text or "“" in text else 0          # 有决策/引文口 → 至少 1-2
    s += 1 if "**" in text else 0                         # 加粗 → 概念代表度提示
    s += 1 if text.count("年") > 0 or "第" in text else 0 # 史实线索
    return {"score": min(3, s), "rubrics": RUBRICS}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC)
    ap.add_argument("--out", type=Path, default=ROOT / "data/candidates.json")
    ap.add_argument("--check", action="store_true", help="只校验脱敏")
    ap.add_argument("--limit", type=int, default=200, help="候选上限")
    args = ap.parse_args()

    src = args.src
    if not src.exists():
        print(f"[warn] 数据源不存在: {src}（切片阶段使用手写 data.js 即可）", file=sys.stderr)
        if args.check:
            sys.exit(0)
        return

    candidates = parse_md_candidates(src)
    if not candidates:
        print("[warn] 未抽取到候选", file=sys.stderr)
        return

    out_list = []
    violations = 0
    for c in candidates[: args.limit]:
        hits = sanitize_check(c["text"])
        if hits:
            violations += 1
            continue
        c["score"] = score_rubric(c["text"])
        out_list.append(c)

    print(f"[info] md 文件 {len(set(c['file'] for c in candidates))} 个，候选 {len(candidates)}，"
          f"脱敏拦截 {violations}，通过 {len(out_list)}")

    if violations:
        print(f"[💡] 命中 {violations} 行敏感内容（已在候选前剔除；正式版需回源清理）")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    blob = json.dumps(out_list, ensure_ascii=False, indent=1)
    args.out.write_text(blob, encoding="utf-8")
    digest = hashlib.sha256(blob.encode()).hexdigest()[:12]
    snap = {"version": "0.1.0", "sha256": digest, "count": len(out_list)}
    (ROOT / "data/data_snapshot.json").write_text(
        json.dumps(snap, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"[ok] 候选已写 {args.out}（snapshot sha256={digest}）")


if __name__ == "__main__":
    main()