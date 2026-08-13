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
    # знаменатель считаем по факту, а не константой 8: у 22 старших арканов блоков девять —
    # добавился birth_path (спека 09), и захардкоженная восьмёрка печатала бы «готово 9/8»
    per_card.append((c["id"], c["name"]["ru"], done, drafts, len(c["content"])))

total = sum(st.values())
print(f"Всего блоков: {total}")
for k in ("final", "reviewed", "draft", "todo"):
    print(f"  {k:9s}: {st.get(k,0):4d}  ({st.get(k,0)/total:.0%})")

print("\nКарты с начатым контентом:")
for cid, name, done, drafts, blocks in per_card:
    if done or drafts:
        print(f"  {cid:16s} {name:20s} готово {done}/{blocks}, черновиков {drafts}")
