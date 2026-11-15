# Plan projet — MVP Terre ↔ Lune (week-end du 14-15 novembre 2026)

> **Version à suivre pendant le week-end : https://claude.ai/artifact/L14HHuEdPnAwuw5RFp7moJ** (une colonne par personne, tâches à cocher, avancement partagé en direct).

## Objectif du week-end

Une application web **déployée sur Azure** où l'on choisit un des 4 modes et où l'on obtient sur une carte les sites terrestres classés, avec pour chacun un score global, un score par critère et ce qui correspond ou non. Plus une présentation et une soumission Space Apps complètes.

**Règle d'or : un projet simple et fini bat un projet ambitieux à moitié fait.** Mars, le SAR, EMIT et la grille mondiale sont hors MVP.

## Définition de « terminé » (MVP)

- [ ] Les 4 modes fonctionnent de bout en bout sur le site déployé.
- [ ] Au moins 4 sources réelles branchées : NASA POWER, Copernicus DEM, MODIS (LST + NDVI), USGS séismes.
- [ ] Les analogues connus sortent dans le haut du classement, l'Amazonie en bas.
- [ ] Au moins 3 sites peu étudiés mis en avant, avec leur fiche.
- [ ] Contrat OpenAPI publié (`/api/docs`).
- [ ] Présentation, démo et soumission prêtes.

## Calendrier

| Quand | Étape | Livrable |
|---|---|---|
| Sam 15 h – 16 h | **Lancement** : lecture du README et de `docs/scenarios.md`, attribution des tâches | Tout le monde sait quoi faire |
| Sam 16 h – 17 h 30 | **Contrats** : OpenAPI (Jesus + François-Xavier), maquettes (Yann), squelettes de code | Contrat et maquettes figés |
| Sam 17 h 30 – 20 h | **Bloc 1** : adaptateurs de sources, moteur de score, écrans | Briques testées séparément |
| Sam 20 h – 21 h | **Intégration v0** : premier déploiement Azure, front branché sur l'API | URL publique qui répond |
| Sam 21 h – minuit | **Bloc 2** : 4 modes complets, fiches de site, candidats | MVP fonctionnel |
| Dim 9 h – 12 h | **Bloc 3** : tests fonctionnels, validation des scores, corrections | MVP stable |
| **Dim 12 h** | **Gel du code** (seulement des correctifs bloquants après) | Version de démo |
| Dim 12 h – soumission | Répétition de la démo, vidéo de secours, soumission | Projet soumis |

Points d'équipe de 10 minutes : sam 20 h, sam minuit, dim 9 h, dim 12 h.

## Règles de travail

- Une branche par tâche, une pull request vers `main`. **François-Xavier relit chaque PR** avant fusion ; David fusionne.
- Aucun secret dans le repo (voir [architecture.md](architecture.md#sécurité-revue-xavier)).
- Bloqué plus de 30 minutes : on le dit dans le canal d'équipe.
- Chacun peut s'appuyer sur Claude : donnez-lui le lien du repo et le fichier de doc lié à votre tâche, demandez du concret (code, tableau, texte), puis vérifiez le résultat.
- **Personne n'attend personne** : on code contre les [contrats partagés](contrats.md) et les données d'exemple (`data/fixtures/site-values.json`), puis on branche le vrai livrable quand il arrive. Un changement de contrat se décide en équipe, dans une PR dédiée.

## Passages de relais

| Qui attend | Tâche | Attend | Prévu | Pour avancer sans attendre |
|---|---|---|---|---|
| David | Site en ligne (v0) | Jesus : squelette API ; François-Xavier : squelette web | sam 17 h 30 | Appliquer Terraform tout de suite (image de démonstration déjà prévue), pousser les vraies images après fusion |
| David | Profil lunaire | Wassim : specs rovers lunaires | sam 18 h 30 | Partir des intervalles de `docs/scenarios.md` |
| David | `/api/analyze` branché | Jesus : connecteurs POWER, USGS, DEM, MODIS | sam 20 h – 22 h | Connecteur factice qui lit les fixtures, remplacé source par source |
| David | Version de démo | François-Xavier : fiche site | dim minuit | Redéployer ce qui est fusionné à chaque jalon |
| Jesus | Routes `/parameters`, `/modes`, `/sites` | Wassim : `data/candidates.json` | sam 21 h | Servir les 3 sites des fixtures |
| Jesus | Explication par Claude (bonus) | David : `/api/analyze` | sam 23 h 30 | Préparer l'appel avec un site des fixtures |
| François-Xavier | Écran d'accueil | Yann : maquettes, textes d'aide | sam 17 h 30 / 20 h | Écran simple d'après `docs/scenarios.md`, textes provisoires dans un fichier séparé |
| François-Xavier | Carte, fiche site | David : `/api/analyze` | sam 23 h 30 | Lire les fixtures (même format que la réponse de l'API) |
| François-Xavier | Formulaire mode 4 | Yann : textes d'aide | sam 20 h | Paramètres tirés de `docs/scenarios.md`, textes branchés plus tard |
| Wassim | Vérification des classements | David : version déployée | dim 12 h | API en local depuis `main` dès que `/api/analyze` est fusionné |
| Yann | Tests de la v0 | David : site en ligne | sam 20 h | Tester les écrans en local avec les fixtures |
| Yann | Feu vert du gel | David : version de démo | dim 12 h | Dérouler le plan de test sur la dernière version déployée |
| Xavier | Contrôle du site en ligne | David : site en ligne | sam 20 h | Relire la config CORS et la limitation de débit dans le code |
| Xavier | Script et vidéo de démo | François-Xavier : fiche site ; Wassim : 3 sites | dim minuit / 11 h | Script sur les maquettes de Yann, vidéo en dernier |

La page de suivi montre en direct, pour chaque tâche, ce qu'elle attend (vert quand c'est livré) et ce qu'elle débloque.

---

## David — chef de projet, infrastructure, moteur de score

- [ ] Fusionner la PR de mise à jour du repo ; créer une issue GitHub par tâche ci-dessous.
- [ ] Sam 20 h : `infra/terraform/deploy.sh` exécuté, URL de l'API et du front publiques.
- [ ] Moteur de score dans `apps/api/src/scoring/` : fonction pure (critères + valeurs → scores), tests unitaires.
- [ ] Route `POST /api/analyze` branchée sur le moteur et les adaptateurs de Jesus.
- [ ] `data/reference/moon-south-pole.json` avec Wassim.
- [ ] Déploiements de l'intégration (sam 20 h, sam minuit, dim 12 h) et arbitrage des priorités.

## Jesus — API et sources de données (dev + IA)

- [ ] Squelette `apps/api` : Node + TypeScript + Express (ES modules), `/api/health`, Dockerfile (port 3001), Swagger UI.
- [ ] `apps/api/openapi.yaml` avec François-Xavier, figé à sam 17 h 30 (routes : [architecture.md](architecture.md#api-contrat-openapi-à-écrire-en-premier)).
- [ ] Adaptateurs dans `apps/api/src/sources/` qui renvoient les paramètres du catalogue ([scenarios.md](scenarios.md)) :
  - [ ] NASA POWER (température, vent, humidité, précipitations, ensoleillement)
  - [ ] Copernicus DEM en COG (`geotiff.js`) : pente moyenne et max, rugosité
  - [ ] Planetary Computer MODIS : LST jour/nuit et NDVI (jeton anonyme, nouvelle tentative sur 502)
  - [ ] USGS séismes, Smithsonian GVP (distance au volcan)
- [ ] Cache mémoire, `express-rate-limit`, CORS limité au domaine du front.
- [ ] Routes `/api/parameters`, `/api/modes`, `/api/sites/{id}`.
- [ ] Bonus (dimanche seulement si le MVP est stable) : courte explication du site générée par Claude, avec la clé dans un secret de la Container App.

## François-Xavier — front et revue de code

- [ ] Squelette `apps/web` : React + TypeScript + Vite + Tailwind + Leaflet + zustand (comme meteormadness).
- [ ] Contrat OpenAPI avec Jesus ; client API typé généré à partir du contrat.
- [ ] Écran d'accueil : choix entre les 4 modes (d'après les maquettes de Yann).
- [ ] Carte Leaflet : sites colorés selon le score ; fond de carte terrestre, encart lunaire en Moon Trek WMTS (bonus).
- [ ] Fiche site : score global, score par critère, « correspond / ne correspond pas », usage possible.
- [ ] Formulaire du mode 4 : choix des paramètres, intervalles, poids.
- [ ] **Revue de toutes les PR** : lisibilité, typage strict, gestion des erreurs, aucun secret.

## Wassim — expertise métier (robotique, instruments) et données

- [ ] Vérifier les intervalles des modes 1 et 2 de [scenarios.md](scenarios.md) : chercher avec Claude les spécifications des rovers lunaires (pente franchissable, températures) et des instruments (forage, sismomètres Apollo) ; noter chaque source.
- [ ] Créer `data/candidates.json` : les 7 sites de validation + 30 à 50 sites peu étudiés (format : [contrats.md §1](contrats.md#1-sites-candidats--datacandidatesjson-wassim)).
- [ ] Sam 23 h 30 : écrire le classement attendu par mode (quels sites en haut, lesquels en bas, et pourquoi).
- [ ] Avec David : valeurs lunaires de référence (Diviner, LOLA, LEND) dans `data/reference/moon-south-pole.json`, avec les sources.
- [ ] Dimanche : lancer les 4 modes et vérifier le classement (analogues connus en haut, Amazonie en bas) ; signaler les écarts.
- [ ] Fournir à Xavier 3 sites peu étudiés « coups de cœur » pour la présentation.

## Yann — expérience utilisateur et tests fonctionnels

- [ ] Sam 17 h 30 : parcours utilisateur et maquettes (accueil, carte, fiche site, mode 4), remis à François-Xavier.
- [ ] Libellés et textes d'aide de chaque paramètre et de chaque mode, compréhensibles par le grand public.
- [ ] Critères d'acceptation par mode et plan de test dans `docs/tests-fonctionnels.md`.
- [ ] Sam soir : tester la v0 déployée ; ouvrir une issue par anomalie.
- [ ] Dim 9 h – 12 h : campagne de tests complète, nouveaux tests des correctifs, feu vert pour le gel de 12 h.

## Xavier — sécurité et présentation

- [ ] Revue sécurité : `.gitignore`, aucun secret dans l'historique git, CORS, limitation de débit, `npm audit`, en-têtes HTTP du site déployé. Résultat dans `docs/securite.md`.
- [ ] Présentation (aidé de Claude pour structurer et rédiger) : le problème, les 4 modes, la démo, les sites peu étudiés trouvés, les limites de l'analogie, Mars en phase 2.
- [ ] Script de démo de 3 minutes et vidéo de secours (capture d'écran) au cas où le réseau tombe.
- [ ] Soumission Space Apps : vérifier les exigences officielles et l'heure limite, préparer les textes, liens (repo, site, vidéo) et membres de l'équipe.
- [ ] Dim 12 h – soumission : répétition avec toute l'équipe.

---

## Risques et parades

| Risque | Parade |
|---|---|
| Une source est lente ou en panne pendant la démo | Cache mémoire préchauffé avant la démo ; vidéo de secours |
| Le calcul de pente sur COG prend trop de temps | Fenêtre réduite, ou NASADEM ; en dernier recours, pente retirée du mode concerné |
| Les scores ne retrouvent pas les analogues connus | Wassim et David ajustent les intervalles dim matin |
| Retard sur le front | Le mode 4 passe en bonus ; les modes 1 à 3 d'abord |
| Déploiement Azure bloqué | Démo en local avec `docker compose` |
