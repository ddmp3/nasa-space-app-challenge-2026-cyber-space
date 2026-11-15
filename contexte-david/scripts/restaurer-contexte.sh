#!/usr/bin/env bash
# Restaure le contexte Claude de David sur macOS ou Linux.
# À lancer depuis n'importe où dans le repo :  ./contexte-david/scripts/restaurer-contexte.sh
# Ne remplace jamais un fichier existant sans sauvegarde.
set -euo pipefail

REPO="$(git rev-parse --show-toplevel)"
CTX="$REPO/contexte-david"
# Claude Code range la mémoire d'un projet sous ~/.claude/projects/<chemin du repo, caractères non alphanumériques remplacés par ->/memory
ENCODED="$(printf '%s' "$REPO" | sed 's/[^A-Za-z0-9]/-/g')"
MEM="$HOME/.claude/projects/$ENCODED/memory"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "Repo    : $REPO"
echo "Mémoire : $MEM"

mkdir -p "$MEM"
for f in "$CTX"/memoire/*.md; do
  dest="$MEM/$(basename "$f")"
  if [ -f "$dest" ] && ! cmp -s "$f" "$dest"; then
    cp "$dest" "$dest.bak-$STAMP"
    echo "  sauvegarde : $(basename "$dest").bak-$STAMP"
  fi
  cp "$f" "$dest"
  echo "  copié : $(basename "$f")"
done

GLOBAL="$HOME/.claude/CLAUDE.md"
if [ ! -f "$GLOBAL" ]; then
  mkdir -p "$HOME/.claude"
  cp "$CTX/claude/CLAUDE-global.md" "$GLOBAL"
  echo "Instructions globales installées : $GLOBAL"
elif ! cmp -s "$CTX/claude/CLAUDE-global.md" "$GLOBAL"; then
  echo "Instructions globales déjà présentes et différentes : $GLOBAL (non modifiées ; comparer avec contexte-david/claude/CLAUDE-global.md)"
fi

echo
echo "Outils :"
for t in git node npm gh az terraform docker python3; do
  if command -v "$t" >/dev/null 2>&1; then
    printf '  %-10s ok\n' "$t"
  else
    printf '  %-10s MANQUANT\n' "$t"
  fi
done
if command -v gh >/dev/null 2>&1 && ! gh auth status >/dev/null 2>&1; then
  echo "  gh n'est pas connecté : lancer  gh auth login -h github.com -p https -w"
fi

echo
echo "Étapes suivantes :"
echo "  1. git fetch --all && git switch david/moteur-score   (ou la branche du moment)"
echo "  2. cd apps/api && npm install && npm test"
echo "  3. Ouvrir le repo dans VS Code, lancer Claude Code et coller contexte-david/PROMPT-REPRISE.md"
