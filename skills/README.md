# Bundled skills

Te katalogi są częścią repo i instalują się bez klonowania zewnętrznych repozytoriów.

| Skill | Autor / źródło | Licencja |
|---|---|---|
| `work-style` | GabeczkaG | GPL-3.0 |
| `claude-experience` | GabeczkaG | GPL-3.0 |
| `skill-creator` | Anthropic | Apache-2.0 |
| `mcp-builder` | Anthropic | Apache-2.0 |
| `webapp-testing` | Anthropic | Apache-2.0 |
| `frontend-design` | Anthropic | Apache-2.0 |
| `humanizer` | Siqi Chen | MIT |
| `jeffallan/*` (67 skilli) | Jeffallan | MIT |

Pozostałe skille w `skills.json` mają typ `git` i są pobierane z repozytoriów upstream przy instalacji; ich licencje są zapisane w manifeście i kopiowane razem ze skillem.

## Mini database

- `index.json` — kanoniczna baza 182 skilli (dla installerów)
- `index.js` — wygenerowana kopia dla podglądu w przeglądarce

Po zmianie `index.json`:

```bash
python3 tools/build-db.py
```
