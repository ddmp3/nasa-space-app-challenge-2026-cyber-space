# contexte-david : reprendre le travail avec Claude sur une autre machine

Ce dossier transporte le contexte de travail de David d'une machine à l'autre :

- **ce soir** : du Mac de bureau vers le PC (VS Code + Claude Code) ;
- **demain** (dim 15 nov) : vers le Mac portable, sur site.

Il ne contient aucun secret : ni jeton, ni state Terraform, ni `.env`.

| Fichier | Rôle |
|---|---|
| [CONTEXTE.md](CONTEXTE.md) | **À lire en premier.** Projet, équipe, décisions, état des PR, tâches de David, prochaines étapes, pièges |
| [PROMPT-REPRISE.md](PROMPT-REPRISE.md) | Message à coller dans Claude Code pour qu'il reprenne où on en était |
| `memoire/` | Mémoire de Claude pour ce projet (décisions durables), à installer sur la nouvelle machine |
| `claude/CLAUDE-global.md` | Copie des instructions globales de David (`~/.claude/CLAUDE.md`) |
| `scripts/restaurer-contexte.sh` / `.ps1` | Installent la mémoire et les instructions, vérifient les outils (macOS/Linux, Windows) |
| `outils/page-suivi/plan-cyberspace.html` | Source de la page de suivi au 14/11 22 h 55 (secours ; la version en ligne fait foi) |
| `outils/compare-scorers.mjs` | Compare le moteur de score TS et le scorer Python de Jesus |
| `outils/create-issues.sh` | Script qui a créé les issues #3 à #37 |

## Transfert, pas à pas

### 1. Prérequis sur la nouvelle machine

- **Obligatoires** : Git, Node.js 22+ (npm), VS Code + extension Claude Code (connecté au même compte claude.ai), GitHub CLI (`gh`).
- **Pour le déploiement** : Azure CLI (`az`), Terraform ≥ 1.0, Docker. Python 3 pour les outils de Jesus.
- Windows : `winget install Git.Git OpenJS.NodeJS.LTS GitHub.cli Microsoft.AzureCLI Hashicorp.Terraform Docker.DockerDesktop`
- macOS : `brew install git node gh azure-cli terraform` + Docker Desktop

### 2. Récupérer le repo et ce dossier

```bash
git clone https://github.com/ddmp3/nasa-space-app-challenge-2026-cyber-space.git
cd nasa-space-app-challenge-2026-cyber-space
git fetch --all
git switch david/contexte          # pour avoir contexte-david/
```

Si le repo est déjà cloné : `git fetch --all && git switch david/contexte && git pull`.

### 3. Installer le contexte Claude

macOS / Linux :
```bash
./contexte-david/scripts/restaurer-contexte.sh
```
Windows (PowerShell, à la racine du repo) :
```powershell
powershell -ExecutionPolicy Bypass -File .\contexte-david\scripts\restaurer-contexte.ps1
```

Le script :
- copie `memoire/` dans `~/.claude/projects/<chemin du repo encodé>/memory/`, c'est-à-dire là où Claude Code la lit pour ce projet ;
- sauvegarde au préalable tout fichier différent déjà présent ;
- installe `~/.claude/CLAUDE.md` s'il n'existe pas ;
- liste les outils manquants.

**Lancer le script depuis l'emplacement définitif du repo** : le dossier de mémoire dépend du chemin du repo. Si on déplace le repo, il faut relancer le script.

### 4. Se connecter

```bash
gh auth login -h github.com -p https -w   # le code s'affiche dans le terminal, à saisir sur github.com/login/device
az login                                  # seulement pour le déploiement
```

### 5. Reprendre avec Claude

1. Ouvrir le dossier du repo dans VS Code, puis ouvrir Claude Code.
2. Coller le message de [PROMPT-REPRISE.md](PROMPT-REPRISE.md).
3. Claude lit `CONTEXTE.md`, vérifie l'état réel du dépôt et des PR, puis propose la suite.

## Avant de changer de machine (ce soir sur le PC, avant de partir demain)

Demander à Claude :

> Mets à jour `contexte-david/` : CONTEXTE.md (état des PR, tâches, prochaines étapes) et `memoire/` (copie de ta mémoire de projet), puis commite et pousse sur `david/contexte`.

Ou copier la mémoire à la main :

```bash
# macOS / Linux, depuis la racine du repo
cp ~/.claude/projects/$(pwd | sed 's/[^A-Za-z0-9]/-/g')/memory/*.md contexte-david/memoire/
```
```powershell
# Windows, depuis la racine du repo
Copy-Item "$HOME\.claude\projects\$((Get-Location).Path -replace '[^A-Za-z0-9]','-')\memory\*.md" contexte-david\memoire\
```

Puis `git add contexte-david && git commit -m "docs: met à jour le contexte de David" && git push`.

## Ce qui ne passe pas par le repo

- **Historique de la conversation Claude** : il contient des données personnelles, donc il n'est pas commité. Ce dossier le remplace. Pour garder l'historique complet malgré tout, copier à la main (clé USB ou AirDrop, jamais dans git) le fichier `~/.claude/projects/-Users-david-dev-projects-nasa-space-app-challenge-2026-cyber-space/*.jsonl` du Mac. Il va dans le dossier `projects/<chemin encodé>/` de la nouvelle machine, puis on lance `claude --resume`.
- **State Terraform** (`infra/terraform/terraform.tfstate`) : il n'existe pas encore, rien n'a été déployé. Après le premier `deploy.sh`, il faut le copier à la main (jamais dans git) sur la machine qui fera les déploiements suivants.
- **Page de suivi** : elle est en ligne, aucun transfert n'est nécessaire. Il suffit d'être connecté au même compte claude.ai.

## Comparer les deux moteurs de score

```bash
git show origin/search-engine-scoring-v1:tools/scoring/score_sites.py > /tmp/score_sites.py
for m in robotics calibration colony; do python3 /tmp/score_sites.py data/fixtures/site-values.json --mode $m --json /tmp/py-$m.json; done
(cd apps/api && npx tsc --outDir /tmp/ts-build --noEmit false)   # sur une branche qui contient apps/api/src/analyze
node contexte-david/outils/compare-scorers.mjs /tmp/ts-build /tmp data/fixtures/site-values.json
```
Résultat attendu au 14/11 : « aucun écart ».
