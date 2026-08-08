#!/usr/bin/env python3
"""Отчёт о готовности контента: сколько блоков в каком статусе."""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
d = json.load(open(ROOT / "content/cards.json", encoding="utf-8"))

st = Counter()
per_card = []
for c in d["cards"]:
    done = sum(1 for v in c["content"].values() if v["status"] in ("reviewed", "final"))
    drafts = sum(1 for v in c["content"].values() if v["status"] == "draft")
    st.update(v["status"] for v in c["content"].values())
    per_card.append((c["id"], c["name"]["ru"], done, drafts))

total = sum(st.values())
print(f"Всего блоков: {total}")
for k in ("final", "reviewed", "draft", "todo"):
    print(f"  {k:9s}: {st.get(k,0):4d}  ({st.get(k,0)/total:.0%})")

print("\nКарты с начатым контентом:")
for cid, name, done, drafts in per_card:
    if done or drafts:
        print(f"  {cid:16s} {name:20s} готово {done}/8, черновиков {drafts}")
