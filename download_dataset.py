
import json
import csv
from pathlib import Path

source = Path("data/curated.jsonl")
destination = Path("data/curated_commands.csv")

rows = []

with source.open(encoding="utf-8") as f:
    for line in f:
        if line.strip():
            rows.append(json.loads(line))

if not rows:
    raise ValueError("Dataset is empty")

print("Records:", len(rows))
print("Columns:", list(rows[0].keys()))

with destination.open("w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(
        f,
        fieldnames=list(rows[0].keys()),
        extrasaction="ignore"
    )
    writer.writeheader()
    writer.writerows(rows)

print("Saved:", destination)
