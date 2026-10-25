#!/usr/bin/env python3
"""Generate skills/index.js (browser copy) from skills/index.json."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "skills/index.json"
OUT = ROOT / "skills/index.js"

data = json.loads(DB.read_text(encoding="utf-8"))
OUT.write_text("window.DEVKIT_DB = " + json.dumps(data, ensure_ascii=False) + ";\n", encoding="utf-8")
print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
