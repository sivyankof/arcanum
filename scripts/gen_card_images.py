#!/usr/bin/env python3
"""Регенерирует src/lib/cardImages.ts после изменения списка карт."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
cards = json.load(open(ROOT / 'content/cards.json', encoding='utf-8'))['cards']
lines = ["/** АВТОГЕНЕРАЦИЯ: python3 scripts/gen_card_images.py — не править вручную. */",
         "export const cardImages: Record<string, any> = {"]
for c in cards:
    lines.append(f'  "{c["id"]}": require("../../assets/cards/{c["id"]}.jpg"),')
lines.append("};\n")
(ROOT / 'src/lib/cardImages.ts').write_text("\n".join(lines), encoding='utf-8')
print("OK")
