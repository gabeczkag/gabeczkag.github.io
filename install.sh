#!/usr/bin/env bash
# DevKit installer — skille dla OpenCode i Claude, opcjonalne runtime'y.
# Użycie:
#   curl -fsSL https://gabeczkag.github.io/install.sh | bash -s -- work-style claude-experience
#   ./install.sh --list
#   ./install.sh --check
#   ./install.sh --all --target opencode
#   ./install.sh --runtimes
#   ./install.sh --install-runtime go
set -euo pipefail

VERSION="1.0.0"
ARCHIVE_URL="${DEVKIT_ARCHIVE_URL:-https://github.com/gabeczkag/gabeczkag.github.io/archive/refs/heads/main.tar.gz}"
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/devkit"
OPENCODE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/skills"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills"

MODE="install"
TARGET="both"
FORCE=0
DRY=0
UPDATE=0
ALL=0
RUNTIME_NAME=""
WITH_RUNTIMES=()
SELECTED=()
TMP=""
SRC_DIR=""
MANIFEST=""
TSV=""

COUNT_OK=0
COUNT_SKIP=0
COUNT_ERR=0
PLUGIN_DONE=0
declare -A ROWS=()

info(){ printf '%s\n' "$*"; }
ok(){ printf '[ok]   %s\n' "$*"; }
skip(){ printf '[skip] %s\n' "$*"; }
warn(){ printf '[warn] %s\n' "$*" >&2; }
die(){ printf '[err]  %s\n' "$*" >&2; exit 1; }

usage(){
  cat <<'USAGE'
DevKit installer — skille Claude + OpenCode

Użycie:
  install.sh [opcje] [skill-id...]

Tryby:
  --list, list              lista skilli z manifestu
  --check, check            sprawdź, co jest zainstalowane
  --runtimes                wykryj Go, Python, Rust, Node, Java, .NET
  --install-runtime NAME    zainstaluj runtime przez mise (go|python|node|java)
  --all                     wszystkie skille poza builtin
  -h, --help                ta pomoc

Opcje instalacji:
  --target opencode|claude|both   cel (domyślnie both)
  --force                         nadpisz istniejące katalogi
  --dry-run                       pokaż plan, nic nie zmieniaj
  --update                        odśwież cache repozytoriów git
  --local DIR                     użyj lokalnego checkoutu (skills.json + skills/)
  --with-go|--with-python|--with-rust|--with-node
                                  po instalacji skilli doinstaluj runtime

Przykłady:
  ./install.sh --list
  ./install.sh work-style claude-experience --target both
  ./install.sh --all --target opencode
  ./install.sh taste-skill --dry-run
  ./install.sh --check
  curl -fsSL https://gabeczkag.github.io/install.sh | bash -s -- work-style claude-experience
USAGE
}

parse_args(){
  while [ $# -gt 0 ]; do
    case "$1" in
      -h|--help) usage; exit 0 ;;
      --list|list) MODE="list"; shift ;;
      --check|check) MODE="check"; shift ;;
      --runtimes|runtimes) MODE="runtimes"; shift ;;
      --install-runtime)
        MODE="runtime"
        RUNTIME_NAME="${2:-}"
        [ -n "$RUNTIME_NAME" ] || die "Podaj nazwę runtime: go|python|node|java|rust"
        shift 2 ;;
      install) shift ;; # pozwala: install.sh install <id>
      --all) ALL=1; shift ;;
      --target)
        TARGET="${2:-}"
        shift 2 ;;
      --force) FORCE=1; shift ;;
      --dry-run|-n) DRY=1; shift ;;
      --update) UPDATE=1; shift ;;
      --local)
        SRC_DIR="${2:-}"
        [ -n "$SRC_DIR" ] || die "--local wymaga ścieżki"
        shift 2 ;;
      --with-go) WITH_RUNTIMES+=("go"); shift ;;
      --with-python) WITH_RUNTIMES+=("python"); shift ;;
      --with-rust) WITH_RUNTIMES+=("rust"); shift ;;
      --with-node) WITH_RUNTIMES+=("node"); shift ;;
      -*) die "Nieznana opcja: $1 (użyj --help)" ;;
      *) SELECTED+=("$1"); shift ;;
    esac
  done

  case "$TARGET" in
    opencode|claude|both) ;;
    *) die "--target musi być: opencode, claude albo both" ;;
  esac
}

resolve_source(){
  TMP="$(mktemp -d "${TMPDIR:-/tmp}/devkit.XXXXXX")"
  trap 'rm -rf "$TMP"' EXIT

  if [ -n "$SRC_DIR" ]; then
    :
  elif [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ] && [ -f "$(dirname "${BASH_SOURCE[0]}")/skills/index.json" ]; then
    SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  elif [ -f "$PWD/skills.json" ] && [ -d "$PWD/skills" ] && [ -f "$PWD/install.sh" ]; then
    SRC_DIR="$PWD"
  else
    info "Pobieram manifest i skille..."
    command -v curl >/dev/null 2>&1 || die "Brak curl"
    command -v tar >/dev/null 2>&1 || die "Brak tar"
    curl -fsSL "$ARCHIVE_URL" -o "$TMP/site.tar.gz" || die "Nie udało się pobrać archiwum"
    tar -xzf "$TMP/site.tar.gz" -C "$TMP" || die "Nie udało się rozpakować archiwum"
    SRC_DIR="$(find "$TMP" -maxdepth 1 -type d -name 'gabeczkag.github.io-*' | head -n 1)"
    [ -n "$SRC_DIR" ] || die "Nie znaleziono katalogu repo w archiwum"
  fi

  MANIFEST="$SRC_DIR/skills/index.json"
  [ -f "$MANIFEST" ] || MANIFEST="$SRC_DIR/skills.json"
  [ -f "$MANIFEST" ] || die "Brak skills/index.json ani skills.json w $SRC_DIR"
  [ -d "$SRC_DIR/skills" ] || die "Brak katalogu skills/ w $SRC_DIR"
}

load_manifest(){
  command -v python3 >/dev/null 2>&1 || die "Wymagany python3 do odczytu manifestu"
  TSV="$TMP/skills.tsv"
  python3 - "$MANIFEST" > "$TSV" <<'PY'
import json, sys
m = json.load(open(sys.argv[1], encoding="utf-8"))
for s in m.get("skills", []):
    i = s.get("install", {})
    fields = [
        s.get("id", ""),
        s.get("name", ""),
        ",".join(s.get("types", [])),
        s.get("source", ""),
        i.get("kind", ""),
        i.get("repo", ""),
        i.get("ref", ""),
        i.get("path", ""),
        i.get("package", ""),
        s.get("license", ""),
        " ".join(s.get("description", "").split()),
    ]
    print("\x1f".join(str(f).replace("\x1f", " ").replace("\t", " ") for f in fields))
PY
  [ -s "$TSV" ] || die "Manifest jest pusty"
  ROWS=()
  while IFS= read -r line; do
    id="${line%%$'\x1f'*}"
    ROWS["$id"]="$line"
  done < "$TSV"
}

lookup(){
  printf '%s' "${ROWS[$1]:-}"
}

list_skills(){
  printf '%-34s %-12s %-16s %s\n' "ID" "SOURCE" "TYPES" "OPIS"
  while IFS=$'\x1f' read -r id name types source kind repo ref path package license desc; do
    printf '%-34s %-12s %-16s %s\n' "$id" "$source" "$types" "${desc:0:90}"
  done < "$TSV"
}

runtime_version(){
  local name="$1" cmd="$2"
  if command -v "${cmd%% *}" >/dev/null 2>&1; then
    printf '%-10s %s\n' "$name" "$($cmd 2>&1 | head -n 1)"
  else
    printf '%-10s %s\n' "$name" "brak"
  fi
}

show_runtimes(){
  runtime_version "Go" "go version"
  runtime_version "Python" "python3 --version"
  runtime_version "Rust" "rustc --version"
  runtime_version "Node" "node -v"
  runtime_version "Java" "java -version"
  runtime_version ".NET" "dotnet --version"
}

install_runtime(){
  local name="$1"
  case "$name" in
    go|python|node|java|rust) ;;
    *) die "Nieznany runtime: $name (go|python|node|java|rust)" ;;
  esac
  if [ "$DRY" = 1 ]; then
    printf '[dry]  zainstalowałbym runtime: %s\n' "$name"
    return 0
  fi
  if command -v mise >/dev/null 2>&1; then
    case "$name" in
      go) mise use -g go@latest ;;
      python) mise use -g python@latest ;;
      node) mise use -g node@lts ;;
      java) mise use -g java@21 ;;
      rust)
        if command -v rustup >/dev/null 2>&1; then rustup update
        else curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        fi ;;
    esac
    ok "runtime: $name"
    return 0
  fi
  case "$name" in
    go) info "Brak mise. Pobierz Go: https://go.dev/dl/" ;;
    python) info "Brak mise. Pobierz Python: https://www.python.org/downloads/ (albo zainstaluj uv)" ;;
    node) info "Brak mise. Pobierz Node LTS: https://nodejs.org/" ;;
    java) info "Brak mise. Pobierz JDK: https://adoptium.net/" ;;
    rust) info "Brak mise. Zainstaluj Rust: https://rustup.rs/" ;;
  esac
  return 1
}

check_skills(){
  local oc_ids="$TMP/opencode-ids.txt" oc_raw="$TMP/opencode-skills.json"
  : > "$oc_ids"
  if [ "${DEVKIT_NO_OPENCODE_API:-0}" != "1" ] && command -v opencode >/dev/null 2>&1; then
    if opencode api get /api/skill > "$oc_raw" 2>/dev/null; then
      python3 -c 'import sys,json; d=json.load(sys.stdin); [print(x["id"]) for x in d.get("data",[])]' \
        < "$oc_raw" > "$oc_ids" 2>/dev/null || : > "$oc_ids"
    fi
  fi
  printf '%-34s %-9s %-9s %s\n' "ID" "OPENCODE" "CLAUDE" "SOURCE"
  while IFS=$'\x1f' read -r id name types source kind repo ref path package license desc; do
    local o="no" c="no"
    if [ -s "$oc_ids" ]; then
      if grep -qxF "$id" "$oc_ids"; then o="yes"; fi
    elif [ -f "$OPENCODE_DIR/$id/SKILL.md" ]; then
      o="yes"
    fi
    if [ -f "$CLAUDE_DIR/$id/SKILL.md" ]; then c="yes"; fi
    if [ "$kind" = "builtin" ]; then o="builtin"; c="builtin"; fi
    if [ "$kind" = "plugin" ] && command -v opencode >/dev/null 2>&1; then
      if opencode plugin list 2>/dev/null | grep -qi 'superpowers'; then o="plugin"; fi
    fi
    printf '%-34s %-9s %-9s %s\n' "$id" "$o" "$c" "$source"
  done < "$TSV"
}

repo_dir_for(){
  local repo="$1" slug
  slug="$(printf '%s' "$repo" | sed -e 's#^https://github.com/##' -e 's#\.git$##' -e 's#/#__#g')"
  printf '%s/repos/%s' "$CACHE_DIR" "$slug"
}

ensure_repo(){
  local repo="$1" ref="$2" dir
  command -v git >/dev/null 2>&1 || die "Brak git (wymagany dla paczek)"
  dir="$(repo_dir_for "$repo")"
  if [ ! -d "$dir/.git" ]; then
    mkdir -p "$CACHE_DIR/repos"
    info "git clone $repo" >&2
    git clone --depth 1 --branch "$ref" "$repo" "$dir" >/dev/null 2>&1 || die "git clone nie powiódł się: $repo"
  elif [ "$UPDATE" = 1 ]; then
    info "git update $repo" >&2
    git -C "$dir" fetch --depth 1 origin "$ref" >/dev/null 2>&1 || warn "git fetch nie powiódł się: $repo"
    git -C "$dir" checkout -q FETCH_HEAD 2>/dev/null || true
  fi
  printf '%s' "$dir"
}

install_plugin(){
  local package="$1"
  if [ "$PLUGIN_DONE" = 1 ]; then return 0; fi
  PLUGIN_DONE=1
  if [ "$TARGET" = "claude" ]; then
    info "Claude: superpowers zainstaluj przez /plugin install superpowers@claude-plugins-official"
    return 0
  fi
  if [ "$DRY" = 1 ]; then
    printf '[dry]  opencode plugin add %s\n' "$package"
    return 0
  fi
  if command -v opencode >/dev/null 2>&1; then
    if opencode plugin add "$package" >/dev/null 2>&1; then
      ok "plugin: $package"
    else
      warn "Nie udało się dodać pluginu: $package"
      COUNT_ERR=$((COUNT_ERR+1))
    fi
  else
    info "Brak opencode w PATH. Plugin: $package"
  fi
}

copy_to_targets(){
  local id="$1" src="$2" license="$3"
  local installed=0
  local -a bases=()
  case "$TARGET" in
    both) bases=("$OPENCODE_DIR" "$CLAUDE_DIR") ;;
    opencode) bases=("$OPENCODE_DIR") ;;
    claude) bases=("$CLAUDE_DIR") ;;
  esac
  for base in "${bases[@]}"; do
    local dest="$base/$id"
    if [ -e "$dest" ] && [ "$FORCE" != 1 ]; then
      skip "$id → $dest (już istnieje, użyj --force)"
      COUNT_SKIP=$((COUNT_SKIP+1))
      continue
    fi
    if [ "$DRY" = 1 ]; then
      printf '[dry]  %s → %s\n' "$id" "$dest"
      installed=1
      COUNT_OK=$((COUNT_OK+1))
      continue
    fi
    mkdir -p "$base"
    [ -e "$dest" ] && rm -rf "$dest"
    cp -R "$src" "$dest"
    if [ -d "$src" ] && [ -n "$license" ]; then
      find "$src" -maxdepth 1 -type f -iname 'LICENSE*' -exec cp {} "$dest/" \; 2>/dev/null || true
    fi
    ok "$id → $dest"
    installed=1
    COUNT_OK=$((COUNT_OK+1))
  done
  if [ "$installed" = 0 ] && [ "$DRY" != 1 ]; then
    return 0
  fi
  return 0
}

copy_license_from_repo(){
  local id="$1" repo_dir="$2"
  local -a bases=()
  case "$TARGET" in
    both) bases=("$OPENCODE_DIR" "$CLAUDE_DIR") ;;
    opencode) bases=("$OPENCODE_DIR") ;;
    claude) bases=("$CLAUDE_DIR") ;;
  esac
  for base in "${bases[@]}"; do
    [ -d "$base/$id" ] || continue
    find "$repo_dir" -maxdepth 1 -type f -iname 'LICENSE*' -exec cp {} "$base/$id/" \; 2>/dev/null || true
  done
}

install_one(){
  local id="$1" row
  row="$(lookup "$id")"
  if [ -z "$row" ]; then
    warn "Nie znaleziono skilla: $id"
    COUNT_ERR=$((COUNT_ERR+1))
    return 1
  fi
  local sid name types source kind repo ref path package license desc
  IFS=$'\x1f' read -r sid name types source kind repo ref path package license desc <<< "$row"

  case "$kind" in
    builtin)
      skip "$sid (builtin, nic nie trzeba instalować)"
      COUNT_SKIP=$((COUNT_SKIP+1))
      ;;
    plugin)
      install_plugin "$package"
      ;;
    local)
      local src="$SRC_DIR/$path"
      if [ ! -e "$src" ]; then
        warn "$sid: brak pliku $src"
        COUNT_ERR=$((COUNT_ERR+1))
        return 1
      fi
      copy_to_targets "$sid" "$src" "$license"
      ;;
    git)
      local dir src
      if [ "$DRY" = 1 ]; then
        printf '[dry]  %s ← %s/%s\n' "$sid" "$repo" "$path"
        COUNT_OK=$((COUNT_OK+1))
        return 0
      fi
      dir="$(ensure_repo "$repo" "$ref")"
      src="$dir/$path"
      if [ ! -e "$src" ]; then
        warn "$sid: brak ścieżki w repo: $path"
        COUNT_ERR=$((COUNT_ERR+1))
        return 1
      fi
      copy_to_targets "$sid" "$src" "$license"
      copy_license_from_repo "$sid" "$dir"
      ;;
    *)
      warn "$sid: nieznany typ instalacji: $kind"
      COUNT_ERR=$((COUNT_ERR+1))
      return 1
      ;;
  esac
}

pick_interactive(){
  if [ "${#SELECTED[@]}" -gt 0 ] || [ "$ALL" = 1 ]; then return; fi
  if [ ! -t 0 ]; then
    die "Brak wybranych skilli. Użyj: install.sh <id...> albo --all (patrz --list)"
  fi
  local -a ids=()
  mapfile -t ids < <(cut -d $'\x1f' -f1 "$TSV")
  info "Dostępne skille:"
  local i=1
  for id in "${ids[@]}"; do
    printf '%3d) %s\n' "$i" "$id"
    i=$((i+1))
  done
  printf '\nPodaj numery lub ID (spacja), "all" albo "q": '
  local answer
  read -r answer
  if [ "$answer" = "q" ]; then exit 0; fi
  if [ "$answer" = "all" ]; then ALL=1; return; fi
  local token idx
  for token in $answer; do
    if [[ "$token" =~ ^[0-9]+$ ]]; then
      idx=$((token-1))
      if [ "$idx" -ge 0 ] && [ "$idx" -lt "${#ids[@]}" ]; then
        SELECTED+=("${ids[$idx]}")
      else
        warn "Nieprawidłowy numer: $token"
      fi
    else
      SELECTED+=("$token")
    fi
  done
}

install_selected(){
  local -a ids=()
  if [ "$ALL" = 1 ]; then
    mapfile -t ids < <(cut -d $'\x1f' -f1 "$TSV")
  else
    ids=("${SELECTED[@]}")
  fi
  if [ "${#ids[@]}" -eq 0 ]; then
    pick_interactive
    if [ "$ALL" = 1 ]; then
      mapfile -t ids < <(cut -d $'\x1f' -f1 "$TSV")
    else
      ids=("${SELECTED[@]}")
    fi
  fi
  [ "${#ids[@]}" -gt 0 ] || die "Nie wybrano żadnego skilla"
  for id in "${ids[@]}"; do
    install_one "$id" || true
  done
}

main(){
  parse_args "$@"
  resolve_source
  load_manifest

  case "$MODE" in
    list) list_skills; exit 0 ;;
    check) check_skills; exit 0 ;;
    runtimes) show_runtimes; exit 0 ;;
    runtime) install_runtime "$RUNTIME_NAME"; exit $? ;;
    install) ;;
  esac

  info "DevKit $VERSION — cel: $TARGET"
  install_selected

  local rt
  for rt in "${WITH_RUNTIMES[@]:-}"; do
    [ -n "$rt" ] && install_runtime "$rt" || true
  done

  printf '\nPodsumowanie: ok=%d, skip=%d, err=%d\n' "$COUNT_OK" "$COUNT_SKIP" "$COUNT_ERR"
  [ "$COUNT_ERR" -eq 0 ] || exit 1
}

main "$@"
