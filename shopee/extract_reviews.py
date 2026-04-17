import json
from pathlib import Path

import pandas as pd

# Đọc file JSON gốc
input_path = Path("shopee_reviews.json")
with input_path.open("r", encoding="utf-8") as f:
    data = json.load(f)

# Một số file Shopee có thể là {"data": [...]} hoặc chỉ là list
if isinstance(data, dict):
    reviews = data.get("data", data.get("ratings", data.get("items", [])))
else:
    reviews = data

# Chỉ lấy comment + author_username
rows = []
for r in reviews:
    rows.append({"author": r.get("author_username", ""), "comment": r.get("comment", "").replace("\n", " ").strip()})

# Xuất ra JSON gọn
with open("reviews_clean.json", "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)

# Xuất ra Excel (xlsx)
df = pd.DataFrame(rows)
df.to_excel("reviews_clean.xlsx", index=False)

print(f"Đã xuất {len(rows)} đánh giá vào reviews_clean.json và reviews_clean.xlsx")
