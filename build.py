import pathlib, shutil

ROOT = pathlib.Path(__file__).parent
BUILD = ROOT / "build"

if BUILD.exists():
    shutil.rmtree(BUILD)

shutil.copytree(
    ROOT,
    BUILD,
    ignore=shutil.ignore_patterns(".git", "build", ".github", "__pycache__"),
)

print(f"Zbudowano w {BUILD}")
