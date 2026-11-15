# Contexte de travail de David (état au samedi 14 novembre 2026, 22 h 55, heure de Montréal)

Ce fichier résume tout ce qu'il faut savoir pour reprendre le travail avec Claude Code sur une autre machine. Il est fait pour être lu par David **et** par Claude (voir [PROMPT-REPRISE.md](PROMPT-REPRISE.md)).

## 1. Le projet en une minute

- **NASA Space Apps Challenge 2026**, équipe locale **Cyber&Space Montréal**.
- **MVP Terre ↔ Lune** : application web où l'on choisit un des 4 modes (validation robotique, calibration d'instruments, colonie autosuffisante, critères libres). Une carte classe les sites terrestres analogues au pôle Sud lunaire, avec un score global, un score par critère et ce qui correspond ou non. Mars viendra en phase 2.
- Architecture : front React (Azure Static Web App) → API Node/TS Express (Azure Container App) → sources NASA POWER, Copernicus DEM, MODIS, USGS, GVP. Infra Terraform dans `infra/terraform/`.
- Docs de référence : [readme.md](../readme.md), [docs/plan-projet.md](../docs/plan-projet.md), [docs/contrats.md](../docs/contrats.md), [docs/scenarios.md](../docs/scenarios.md), [docs/architecture.md](../docs/architecture.md), [docs/sources.md](../docs/sources.md). `docs/ux.md` est sur la branche `david/moteur-score`.

## 2. Équipe et rôles

| Membre | Rôle | Compte GitHub |
|---|---|---|
| David | Chef de projet, infra Azure, moteur de score. **Relit et fusionne toutes les PR.** | `ddmp3` (propriétaire du repo) |
| Jesus | API et sources de données | `jesuslayer` |
| François | Front (à ne pas confondre avec Xavier ; on n'écrit plus « François-Xavier ») | `francoisxavierdussault` |
| Wassim | Expertise métier (robotique, instruments), données | `wassim123-coder` |
| Yann | Expérience utilisateur, tests fonctionnels | `K35k1ld1` |
| Xavier | Sécurité, présentation, soumission | `rhapirou` |

## 3. Décisions prises avec Claude

1. **Contrats partagés** (`docs/contrats.md`) et **données d'exemple** (`data/fixtures/site-values.json`) : chacun code contre le contrat sans attendre les autres. Seules les valeurs NASA POWER et USGS de Haughton sont réelles dans les fixtures.
2. **David relit et fusionne toutes les PR.** François n'est plus relecteur.
3. **Pas de déploiement partiel** : intégration complète d'abord (cible initiale sam 20 h, pas encore faite), puis `infra/terraform/deploy.sh`. **Ne jamais lancer `deploy.sh` sans accord explicite de David** (ressources Azure payantes, souscription DEV `dev-meteormadness`).
4. **Moteur de score** : un critère sans valeur (source en panne) est **exclu du total** au lieu de compter 0. Un site végétalisé (NDVI > 0,1) reste dans la liste, en dernier, avec `total: 0` et `excluded: "vegetation"`. Ces deux règles restent **à confirmer en revue**.
5. **Après le MVP, interface différenciante** : pas de site à tableaux de données. Le front importe le moteur de score (fonction pure) et recalcule en direct. Il faut un globe 3D, une vue « jumeau lunaire », une signature radar, des modes présentés comme des missions, le mode 4 en curseurs et des fiches « découverte ». Détails dans `docs/ux.md` (branche `david/moteur-score`), issues #39 à #46 (libellé `apres-mvp`).
6. Conventions : réponses en français, préfixe `@claude:`, ES modules, TypeScript strict, tests avant de dire « fait », pas de secret dans le repo. Voir [claude/CLAUDE-global.md](claude/CLAUDE-global.md).

## 4. État du dépôt

### Sur `main`
Docs, contrats, fixtures, Terraform. Dernier commit : `f4f75fe`.

### Pull requests ouvertes (rien n'est encore fusionné)

| PR | Auteur | Branche → base | Contenu | Remarques pour la revue |
|---|---|---|---|---|
| **#38** | David | `david/moteur-score` → `main` | Moteur de score TS (`apps/api/src/scoring/`), service `analyze()` (`apps/api/src/analyze/`), profil lunaire brouillon, 42 tests (100 %), docs plan + `docs/ux.md` | Trancher les 2 règles de la décision 4. Vérification croisée avec le scorer Python de Jesus : identique. |
| **#50** | Jesus | `jesus/api-serveur` → **`david/moteur-score`** | Serveur Express (`/api/health`, `/modes`, `/parameters`, `/reference/moon`, `POST /analyze`, `/sites/{id}`, `/docs`), `openapi.yaml`, connecteurs POWER et USGS avec cache, géométrie DEM précalculée (`data/candidates-geometry.json`), CORS, rate limit, Dockerfile | Construite sur #38 : la fusionner **après** #38 (GitHub la rebascule sur `main`). Elle remplit aussi la tâche de route `/api/analyze` de David (issue #4). |
| **#49** | François | `francois-ui` → `main` | Front `apps/web` : choix des modes, carte Leaflet, fiche site, critères libres, client API | À tester de bout en bout une fois #38 et #50 fusionnées. |
| **#48** | Yann | `maquettes-yann` → `main` | Maquettes HTML cliquables + captures : **solution 1** (exploration libre) et **solution 2** (parcours narratif en 4 chapitres) | Arbitrage d'équipe à faire. La solution 2 colle à la vision « après le MVP ». |
| **#47** | Wassim | `Sample-of-data-collection-…` → `main` | Un fichier `Sample 2.docx` (données des modes 1 et 2, valeurs lunaires manquantes) | Ne pas fusionner un .docx tel quel : en extraire les valeurs vers `docs/scenarios.md` ou `data/reference/moon-south-pole.json`. |

**Ordre de fusion conseillé : #38 → #50 → #49 → #48**, puis #47 converti en données.

### Autres branches de Jesus (sans PR)
- `search-engine-geolocalization` : `tools/precompute/` (pente, rugosité, altitude Copernicus DEM précalculées).
- `search-engine-scoring-v1` : `tools/scoring/score_sites.py`, un vérificateur Python du score dont les résultats sont identiques au moteur TS. Seul écart : il met les sites exclus dans une liste `excluded` séparée.
- `search_engine_geolocation_v_0` : `tools/analog_backend/`, un prototype Python de référence, hors application. `lro.py` peut servir au profil lunaire.

Vérifier si #50 a déjà intégré une partie de ces branches avant de demander leur PR.

## 5. Tâches de David

| Issue | Tâche | État |
|---|---|---|
| — | Contrats et fixtures | Fait (`main`) |
| — | Issues GitHub (#3 à #37) | Fait |
| — | Moteur de score | Fait (PR #38) |
| #4 | Route `POST /api/analyze` | Service fait (#38). Route Express faite par Jesus dans #50 : à vérifier puis fermer. |
| #5 | Profil lunaire `data/reference/moon-south-pole.json` | Brouillon sourcé. Reste : pente, rugosité (LOLA), température de jour (Diviner), séismes (Apollo), ensoleillement. Voir aussi #47 et `lro.py`. |
| #6 | Revue et fusion des PR, déploiements aux jalons | **À faire maintenant** : #38, #50, #49, #48. |
| #3 | Site en ligne avec `deploy.sh` | Après l'intégration, avec accord explicite. |
| #39 | Après le MVP : moteur partagé entre API et front | Plus tard. |

## 6. Prochaines étapes (dans l'ordre)

1. Relire et fusionner #38, puis #50 (vérifier que #50 est bien rebasculée sur `main`).
2. `cd apps/api && npm install && npm test && npm run typecheck`, puis lancer l'API en local et tester `POST /api/analyze`.
3. Relire et fusionner #49, puis lancer le front contre l'API locale et tester les 4 modes.
4. Arbitrer #48 (solution 1 ou 2) avec l'équipe ; traiter #47.
5. Avec accord de David : `./infra/terraform/deploy.sh` (prérequis : `az login`, `terraform`, `docker`).
6. Mettre à jour `docs/plan-projet.md` et la page de suivi.
7. Dimanche : tests (Yann), vérification des classements (Wassim), gel du code à 12 h, démo et soumission (Xavier).

## 7. Liens et outils

- **Page de suivi de l'équipe** (Artifact claude.ai, compte de David) : https://claude.ai/artifact/L14HHuEdPnAwuw5RFp7moJ
  - Les coches de l'équipe sont dans la base partagée de la page (collection `done`, un document par tâche, par ex. `d3`).
  - Pour la modifier : demander à Claude de lire l'artifact par son URL (`Artifact` action `read`), modifier, puis republier sur la **même URL**. Une copie de la source au 14/11 22 h 55 est dans [outils/page-suivi/plan-cyberspace.html](outils/page-suivi/plan-cyberspace.html). Toujours repartir de la version en ligne, l'équipe a pu la changer.
  - La page n'est lisible que par David tant qu'elle n'est pas partagée (menu Partager de la page).
- Repo : https://github.com/ddmp3/nasa-space-app-challenge-2026-cyber-space
- Issues : libellés `david`, `jesus`, `francois`, `wassim`, `yann`, `xavier`, `apres-mvp`.
- [outils/compare-scorers.mjs](outils/compare-scorers.mjs) compare le moteur TS et le scorer Python (mode d'emploi dans le [README](README.md)).
- [outils/create-issues.sh](outils/create-issues.sh) a servi à créer les issues #3 à #37. On peut le relancer sans risque : il saute les titres existants.

## 8. Pièges connus

- Les commandes `gh` exigent `gh auth login` sur chaque machine. Le code d'authentification s'affiche **dans le terminal** et se saisit sur https://github.com/login/device. L'appli mobile ne le montre pas.
- `apps/api/package.json` existe dans #38 et dans #50 : #50 étant construite sur #38, il n'y a pas de conflit si on respecte l'ordre de fusion.
- Le state Terraform est **local** (`infra/terraform/terraform.tfstate`, ignoré par git). S'il a été créé sur une machine, il faut le copier à la main sur l'autre avant tout `terraform apply`, sinon Terraform voudra tout recréer. À ce jour, rien n'a été appliqué.
- Fixtures : les valeurs d'Atacama et de l'Amazonie sont fictives, à ne jamais montrer en démo.
