# 🛰️ Cyber&Space Montréal — NASA Space Apps Challenge 2026

## In English

**Challenge:** [Permanent Moon Base Locations and Mars](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/).

A web application that ranks Earth sites as analogs of the lunar south pole for a chosen mission: rover mobility testing, instrument calibration, self-sufficient colony, or free criteria. Each site is scored criterion by criterion with open data (NASA POWER, MODIS, Copernicus DEM, USGS, Smithsonian GVP) against lunar reference values (LRO LOLA slope and roughness computed with the same 1 km method as on Earth, LRO Diviner). Every site card shows what matches, what does not, the lunar value next to the Earth value, the source of each number, and what Earth cannot reproduce (gravity, vacuum, radiation).

Run it locally (Docker): `docker compose up --build`, then open http://localhost:8080 (API and docs: http://localhost:3001/api/docs). End-to-end tests: `python3 tools/validation/e2e.py`.

Data sources and terms: `GET /api/sources` and [docs/sources.md](docs/sources.md). Validation against known analogs: [docs/validation-classements.md](docs/validation-classements.md).

**Use of AI:** parts of the code, data processing scripts, tests and documentation were written with the help of Claude (Anthropic) and Microsoft Copilot, under the team's direction; commits made with Claude carry a `Co-Authored-By: Claude` trailer. The project documentation below is in French.

## 🌍 Le défi

**Identifier sur Terre des sites analogues aux futures bases permanentes sur la Lune et sur Mars.**

Énoncé : https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/

À partir des données ouvertes de la NASA et d'autres agences spatiales, identifier et caractériser des sites terrestres analogues (déserts, régions polaires, terrains volcaniques ou arides, grottes, etc.), expliquer **ce qui les rend analogues et ce qui ne l'est pas**, puis présenter les résultats sous forme de carte, de visualisation ou d'outil.

Objectif : ne pas seulement retrouver les analogues connus, mais **faire émerger des sites peu étudiés**.

## 🚀 Périmètre du MVP : Terre ↔ Lune

| Phase | Périmètre | Statut |
|---|---|---|
| **MVP (ce week-end)** | Sites terrestres analogues à la **Lune** (cible de référence : pôle Sud lunaire) | En cours |
| Phase 2 | Ajout de **Mars** (MOLA, THEMIS, CRISM, SHARAD) | Après le MVP |

Le moteur et l'interface sont conçus pour accueillir Mars sans refonte : seul un nouveau profil de référence sera à ajouter.

## 🎯 Public cible

- **Principal** : équipes de mission (ingénieurs robotique, instrumentistes, planificateurs de base) qui doivent choisir un site de test sur Terre avant d'envoyer un équipement sur la Lune.
- **Secondaire** : enseignants, étudiants et grand public (vulgarisation).

## 🧭 Les 4 modes de l'application

L'utilisateur choisit un mode, l'application interroge les sources de données et affiche les sites terrestres classés sur une carte.

| # | Mode | Question à laquelle il répond |
|---|---|---|
| 1 | **Validation robotique** | Où tester sur Terre la **mobilité** d'un rover ou d'un robot (NASA ou autre) avant de l'envoyer sur un site lunaire ? |
| 2 | **Calibration d'instruments** | Où calibrer sur Terre des instruments de mesure (forage, vent, gaz, sismographe, thermique) dans des conditions proches de la Lune ? |
| 3 | **Colonie autosuffisante** | Quels sites terrestres reproduisent les conditions qui rendent un site lunaire favorable à une colonie autonome (eau, énergie, terrain, abri) ? |
| 4 | **Critères libres** | L'utilisateur choisit lui-même les paramètres, leurs intervalles et leurs poids. Les paramètres proposés sont **limités à ceux que nos sources fournissent**. |

Les modes 1 à 3 sont des **jeux de paramètres prédéfinis** ; le mode 4 expose le même catalogue de paramètres sans présélection. Détail des paramètres : **[docs/scenarios.md](docs/scenarios.md)**.

Pour chaque site proposé, l'application affiche :

- un **score global** de similarité ;
- un **score par critère** ;
- ce qui **correspond**, ce qui **ne correspond pas**, et à quoi le site peut servir.

## ⚙️ Moteur de comparaison

- Chaque paramètre d'un mode a un **intervalle cible** (valeurs souhaitées) et une **tolérance**.
- Score d'un critère : **1** dans l'intervalle, décroissance linéaire jusqu'à **0** à la limite de tolérance.
- Score global : **moyenne pondérée** des scores par critère (poids fixés par le mode, ou par l'utilisateur en mode 4).
- Filtre commun : **exclusion des zones végétalisées** (MODIS NDVI).
- Candidats du MVP : une **liste versionnée de points** (analogues connus + régions froides, arides ou volcaniques peu étudiées). Le criblage sur une grille mondiale est prévu en phase 2.

## ✅ Validation

- Chaque analogue reconnu (Atacama, Dry Valleys, Haughton, Mauna Kea, Svalbard, Holuhraun, Meteor Crater, Black Point) doit sortir dans la moitié haute **des modes pour lesquels il est réellement utilisé** (champ `known_for` de `data/candidates.json`).
- Le témoin négatif (Amazonie) est écarté ou dernier dans tous les modes.
- Les meilleurs sites **hors** de cette liste sont mis en avant comme sites peu étudiés.
- Résultat et méthode : **[docs/validation-classements.md](docs/validation-classements.md)** ; tests : **[docs/tests-fonctionnels.md](docs/tests-fonctionnels.md)**.

## 📡 Sources de données

Liste complète, modes d'accès et statut de test : **[docs/sources.md](docs/sources.md)**.

Principes retenus :

- **Aucune base de données** : NASA POWER, USGS et Smithsonian GVP sont lus en direct par l'API (cache mémoire) ; le relief (Copernicus DEM) et MODIS sont précalculés hors ligne dans `data/candidates-precomputed.json` (`tools/precompute/`).
- **Profil de référence lunaire** : `data/reference/moon-south-pole.json`, dont la pente et la rugosité calculées à partir de LRO LOLA avec la même méthode que sur Terre (`tools/precompute/lunar_reference.py`).
- **Toutes les sources sont nommées** : catalogue servi par `GET /api/sources`, source de chaque valeur dans la fiche du site.
- **Socle sans authentification** : toutes les sources du MVP sont accessibles sans compte. Aucun secret ne doit être commité.

## ⚠️ Limites de l'analogie terrestre

La Terre ne reproduit pas la gravité réduite, le vide, l'absence de vent ni l'environnement de rayonnement lunaires. Chaque fiche de site rappelle ce que l'analogie ne couvre pas. La biologie et l'habitabilité sont hors périmètre.

## 🛠️ Architecture et stack

Même modèle que notre projet précédent (meteormadness), sur **Azure** :

- **Front** : React + TypeScript + Vite + Tailwind + Leaflet, hébergé sur **Azure Static Web App**.
- **API** : Node.js + TypeScript + Express, contrat **OpenAPI**, image Docker dans **Azure Container Registry**, exécutée sur **Azure Container Apps**.
- **Infrastructure** : **Terraform** (`infra/terraform`), région `canadacentral`, souscription DEV.

Détail : **[docs/architecture.md](docs/architecture.md)**. L'API publique (OpenAPI) est aussi un livrable.

## 🗓️ Plan projet

- **Tâches de chacun, à cocher : https://claude.ai/artifact/L14HHuEdPnAwuw5RFp7moJ**
- Version texte : [docs/plan-projet.md](docs/plan-projet.md).

## 🤖 Intelligence artificielle utilisée

- **Claude** (Anthropic), via Claude Code : analyse des sources, documentation, code.
- **Microsoft Copilot**

## 👥 Équipe

Équipe locale **Cyber&Space Montréal** : François, Jesus, Wassim, Yann, Xavier, David.
