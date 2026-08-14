import os
import shutil
import pathlib

ROOT = pathlib.Path(__file__).parent
BUILD = ROOT / "build"
PLACEHOLDER = "__AUTH_KEY_PLACEHOLDER__"
KEY = os.environ.get("AUTH_KEY_OR_PASSOWRD", "")

if not KEY:
    raise SystemExit("Brak sekretu AUTH_KEY_OR_PASSOWRD - deploy przerwany.")

if BUILD.exists():
    shutil.rmtree(BUILD)

shutil.copytree(
    ROOT,
    BUILD,
    ignore=shutil.ignore_patterns(".git", "build", ".github", "__pycache__"),
)

admin_js = BUILD / "assets" / "js" / "admin.js"
text = admin_js.read_text(encoding="utf-8").replace(PLACEHOLDER, KEY)
admin_js.write_text(text, encoding="utf-8")

print(f"Zbudowano w {BUILD} (klucz wstrzykniety: {len(KEY)} znakow).")
