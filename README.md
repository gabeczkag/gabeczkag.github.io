# GabeczkaG DevKit

Statyczna strona-katalog skilli dla Claude i OpenCode + installer CLI/TUI.

## Jeden install, jeden download

Wszystkie skille są w tym repo:

- `skills/index.json` — mini database (182 pozycje)
- `skills/index.js` — wygenerowana kopia DB dla podglądu w przeglądarce
- `skills/<id>/` — 166 gotowych katalogów skilli
- 14 skilli Superpowers instaluje się jako plugin OpenCode, 67 skilli Jeffallan jest w bundlu
- 2 pozycje to builtin OpenCode

Installer pobiera **jeden ZIP repo** i kopiuje wybrane foldery lokalnie. Nie klonuje 92 repozytoriów i nie robi setek requestów per skill.

Po zmianie bazy:

```bash
python3 tools/build-db.py
```

## Bash

```bash
curl -fsSL https://gabeczkag.github.io/install.sh | bash -s -- work-style claude-experience
```

```bash
./install.sh --list
./install.sh --check
./install.sh --all --target opencode
./install.sh taste-skill --dry-run
./install.sh --runtimes
./install.sh --install-runtime go
```

## PowerShell TUI

```powershell
irm https://gabeczkag.github.io/install.ps1 | iex
```

albo lokalnie:

```powershell
pwsh ./install.ps1
pwsh ./install.ps1 -List
pwsh ./install.ps1 -Check
pwsh ./install.ps1 -All -Target opencode
pwsh ./install.ps1 -Skills work-style,claude-experience -DryRun
```

TUI: `↑↓` ruch, `space` zaznacz, `a` wszystko, `n` nic, `t` target, `c` check, `enter` instaluj, `q` wyjście.

## Cele instalacji

- OpenCode: `~/.config/opencode/skills` (albo `$XDG_CONFIG_HOME/opencode/skills`)
- Claude: `~/.claude/skills` (albo `$CLAUDE_CONFIG_DIR/skills`)

`--target opencode|claude|both` / `-Target` wybiera cel. `--force` / `-Force` nadpisuje istniejące katalogi. `--dry-run` / `-DryRun` pokazuje plan.

`--check` / `-Check` korzysta z `opencode api get /api/skill`, jeśli usługa OpenCode działa; w przeciwnym razie sprawdza katalogi. `DEVKIT_NO_OPENCODE_API=1` wymusza tryb plikowy.

## Strona

- `index.html` — katalog skilli w stylu `opencode.ai`
- `skills/index.js` — mini-DB ładowana przez stronę
- `favicon.svg` — ikona

```bash
python3 -m http.server 4173
# http://127.0.0.1:4173/
```

## Deploy

GitHub Pages przez `.github/workflows/deploy.yml`; `build.py` kopiuje katalog repo do `build/`. Instalatory, `skills/index.json` i foldery skilli są częścią deployu, więc `https://gabeczkag.github.io/install.sh` oraz `install.ps1` działają po pushu na `main`.

## Licencje

- Kod strony: GNU GPL v3 (`LICENSE`)
- Bundled skille: `skills/README.md`
- Skille git/plugin: licencje w `skills/index.json` i w katalogach źródłowych
