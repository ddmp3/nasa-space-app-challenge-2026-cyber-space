# Plan projet — MVP Terre ↔ Lune (week-end du 14-15 novembre 2026)

> **Version à suivre pendant le week-end : https://claude.ai/artifact/L14HHuEdPnAwuw5RFp7moJ** (une colonne par personne, tâches à cocher, avancement partagé en direct).
>
> Mise à jour : dimanche 15 novembre, 1 h 30 (Montréal).

## Objectif du week-end

Une application web **déployée sur Azure** où l'on choisit un des 4 modes et où l'on obtient sur une carte les sites terrestres classés, avec pour chacun un score global, un score par critère et ce qui correspond ou non. Plus une présentation et une soumission Space Apps complètes, **en anglais**.

**Règle d'or : un projet simple et fini bat un projet ambitieux à moitié fait.** Mars, le SAR, EMIT et la grille mondiale sont hors MVP.

## Échéances officielles

- **Soumission : dimanche 15 novembre, 23 h 59, heure de Montréal.** Rien n'est soumis pour l'instant (décision de David).
- Tout en anglais : page de projet et éléments liés. Démo : vidéo de 30 s au plus **ou** 7 diapositives au plus. Détails : [soumission.md](soumission.md).

## Définition de « terminé » (MVP)

- [ ] Les 4 modes fonctionnent de bout en bout sur le site **déployé**. *Fait en local (docker compose, tests TF-04 à TF-07) ; reste le déploiement.*
- [x] Au moins 4 sources réelles branchées : NASA POWER, Copernicus DEM, MODIS (LST + NDVI), USGS séismes, plus Smithsonian GVP. Côté Lune : LRO LOLA (calculé), Diviner (publié).
- [x] Les analogues connus sortent dans le haut des modes où ils sont utilisés, l'Amazonie est écartée : 9 attentes tenues sur 11 ([validation-classements.md](validation-classements.md)).
- [x] Au moins 3 sites peu étudiés mis en avant, avec leur fiche : Tunnunik, Mistastin, Atakor (proposition, à confirmer par Wassim).
- [x] Contrat OpenAPI publié (`/api/docs`).
- [x] Toutes les sources nommées : `GET /api/sources`, source de chaque valeur dans la fiche.
- [ ] Interface, dépôt, page de projet et démo en anglais.
- [ ] Présentation, démo et soumission prêtes (brouillons : [presentation.md](presentation.md), [soumission.md](soumission.md)).

## Calendrier (dimanche)

| Quand | Étape | Livrable |
|---|---|---|
| Dim matin | Décisions d'équipe (voir plus bas), validation des sites par Wassim, tests à la main par Yann | Données et réglages validés |
| Dim matin | Déploiement Azure, avec l'accord de David | URL publique |
| **Dim 12 h** | **Gel du code** (seulement des correctifs bloquants après) | Version de démo |
| Dim 12 h – soir | Interface en anglais si décidé, démo, page de projet | Démo et textes en anglais |
| **Dim 23 h 59** | **Heure limite de soumission** (soumission par l'équipe, sur décision de David) | Projet soumis |

Points d'équipe de 10 minutes : dim 9 h, dim 12 h, dim 18 h.

## Règles de travail

- Une branche par tâche, une pull request vers `main`. **David relit et fusionne les PR** (revue de code avant chaque fusion).
- Aucun secret dans le repo ([securite.md](securite.md)).
- Bloqué plus de 30 minutes : on le dit dans le canal d'équipe.
- Chacun peut s'appuyer sur Claude : donnez-lui le lien du repo et le fichier de doc lié à votre tâche, demandez du concret, puis vérifiez le résultat.
- Après toute modification de `data/candidates.json` : relancer `tools/precompute/` (voir `apps/api/README.md`), puis `python tools/validation/rankings.py` et `python tools/validation/e2e.py`.

## État du dépôt (dim 15 nov, 1 h 30)

Toutes les PR (#38, #47, #48, #49, #50) et les branches de Jesus sont fusionnées sur `main`. L'application complète se lance avec `docker compose up --build` (front sur `localhost:8080`, API sur `localhost:3001`).

| Brique | État |
|---|---|
| Moteur de score (TS) | Modes 1 à 3, critères libres, filtre « sol nu » (NDVI ≤ 0,2), identique au scorer Python |
| API | `/api/analyze`, `/api/sites/{id}` (valeurs, source de chaque valeur, référence lunaire), `/api/sources`, `/api/modes`, `/api/parameters`, `/api/reference/moon`, `/api/docs` ; CORS, limitation de débit |
| Données Terre | 37 sites (9 analogues connus, 1 témoin négatif, 27 peu étudiés) ; relief et MODIS précalculés ; POWER, USGS et GVP en direct |
| Données Lune | Pente et rugosité du pôle Sud calculées avec LOLA (même méthode que sur Terre) ; froid, vide, gravité, rayonnement sourcés |
| Front | Modes, carte, fiche site (valeur lunaire, source, limites de la Terre), mode 4 avec aide, liste des sources ; types générés depuis OpenAPI |
| Tests | API 111, Python 22, bout en bout 12/12, classements tenus |
| Sécurité | 0 vulnérabilité npm, aucun secret, en-têtes de sécurité sur l'API et le front |
| Déploiement | `deploy.sh` corrigé ; **pas encore lancé** (accord de David requis) |

## Décisions d'équipe en attente

| Décision | Options | Où |
|---|---|---|
| Langue de l'interface | Traduire l'interface en anglais avant la soumission, ou lier le dépôt (présentation anglaise en tête du README) et une démo en anglais | [soumission.md](soumission.md) |
| Nom du projet | Proposition : *Lunar Twins on Earth* | [soumission.md](soumission.md) |
| Valeurs proposées par Wassim | `lst_amplitude` (seuil trop faible face aux ~300 K lunaires), `t2m_mean` du forage (≤ -10 °C ?), seuil `quake_count` | [verification-modes-1-2.md](verification-modes-1-2.md) |
| Règle des critères manquants | Un critère sans valeur est exclu du total (couverture affichée « n/m critères ») ; aujourd'hui tous les critères ont une valeur sur les 37 sites | [contrats.md](contrats.md) |
| Maquettes de Yann | Solution 1 (exploration libre) ou 2 (parcours en 4 chapitres), pour la phase interface | [parcours-utilisateur.md](parcours-utilisateur.md) |
| Déploiement Azure | Quand lancer `deploy.sh` (ressources payantes) | #3 |

Changements de réglage déjà faits, à relire en équipe :
- **Mode robotique** : pente moyenne 5 à 13° et rugosité 22 à 65 m, tirées du relief LOLA réel du pôle Sud (au lieu de 5 à 15° et 5 à 40 m). La proposition 3 à 10° (traversées d'Apollo, terrains équatoriaux) n'est pas retenue.
- **Filtre « sol nu »** : NDVI ≤ 0,2 au lieu de 0,1, qui écartait des déserts nus (Namib, Sahara) et deux terrains d'essai de la NASA ([scenarios.md](scenarios.md)).

---

## David — chef de projet, infrastructure, moteur de score

- [x] Contrats partagés et données d'exemple, sur `main`.
- [x] Issues GitHub par tâche (#3 à #37).
- [x] Moteur de score (`apps/api/src/scoring/`), vérifié contre le scorer Python de Jesus.
- [x] Route `POST /api/analyze` (#4, faite dans #50).
- [x] Revue et fusion des PR, intégration complète, `docker compose` local.
- [ ] Profil lunaire (#5). *Fait : relief LOLA, froid, gravité, vide, rayonnement, séismes. Reste : température de jour des crêtes éclairées (Diviner) et ensoleillement (LOLA).*
- [ ] Préparer le poste de déploiement : installer `terraform` dans WSL (demande sudo), `az login` (#52). **Nouveau.**
- [ ] Déploiement Azure avec `infra/terraform/deploy.sh` (#3), puis `python3 tools/validation/e2e.py --web <front> --api <api>`.
- [ ] Décisions d’équipe ci-dessus (#51).
- [ ] Partager la page de suivi avec l'équipe (menu Partager de la page, #53). **Nouveau.**
- [ ] Mettre à jour `contexte-david/` (branche `david/contexte`) avant de passer sur le Mac portable (#54). **Nouveau.**

## Jesus — API et sources de données

- [x] Squelette `apps/api`, Swagger, Dockerfile (#7), contrat OpenAPI (#8).
- [x] NASA POWER et USGS (#9), Copernicus DEM précalculé (#10), MODIS précalculé et corrigé (#11), GVP, cache, limitation de débit, CORS (#12).
- [x] Routes `/api/parameters`, `/api/modes`, `/api/sites/{id}` (#13).
- [x] Vérificateur Python du score, branches fusionnées.
- [ ] Relire les corrections du 15/11 : tuile MODIS calculée (`modis_values.py`), bord de tuile DEM (`point_geometry.py`), `lunar_reference.py` (#55). **Nouveau.**
- [ ] Bonus, seulement si le MVP est stable : explication de site générée par Claude (#14).

## François — front

- [x] Squelette `apps/web` (#15), client API typé généré depuis le contrat (#16).
- [x] Écran d'accueil (#17), carte (#18), fiche site (#19), formulaire du mode 4 (#20).
- [ ] Relire les ajouts du 15/11 dans la fiche : valeur lunaire, source de chaque valeur, limites de la Terre, liste des sources, textes d’aide (#56). **Nouveau.**
- [ ] Interface en anglais, si l'équipe le décide (libellés, textes d'aide, messages d’erreur, #57). **Nouveau.**

## Wassim — expertise métier et données

- [x] Spécifications des rovers lunaires (#21), vérification des modes 1 et 2 (#22) : [verification-modes-1-2.md](verification-modes-1-2.md).
- [x] Classement attendu par mode (#24) et vérification des classements (#25) : [validation-classements.md](validation-classements.md). *À relire.*
- [ ] Valider `data/candidates.json` (#23) : coordonnées approchées (champ `note`), points sur la terre ferme dans une fenêtre de 1 km, champ `known_for`.
- [ ] Confirmer ou remplacer les 3 sites coups de cœur (#26).
- [ ] Profil lunaire avec David (#5) : température de jour des crêtes et ensoleillement.

## Yann — expérience utilisateur et tests

- [x] Parcours et maquettes (#27), textes d'aide (#28), plan de test (#29).
- [ ] Tests à la main TV-01 à TV-08 ([tests-fonctionnels.md](tests-fonctionnels.md)), en local puis sur la version déployée ; une issue par anomalie (#30).
- [ ] Campagne complète et feu vert du gel de 12 h (#31).

## Xavier — sécurité, présentation, soumission

- [x] Exigences et heure limite de soumission (#32) : [soumission.md](soumission.md).
- [x] Revue sécurité du repo (#33) : [securite.md](securite.md).
- [ ] Plan de la présentation (#34) : brouillon en 7 diapositives dans [presentation.md](presentation.md).
- [ ] Contrôle du site en ligne (#35) : en-têtes, CORS, limitation de débit sur Azure.
- [ ] Démo (#36) : vidéo de **30 s au plus** ou **7 diapositives**, en anglais (le plan initial parlait d'un script de 3 minutes, hors règlement). Brouillon dans [presentation.md](presentation.md).
- [ ] Page de projet Space Apps en anglais : reprendre les brouillons de [soumission.md](soumission.md), vérifier que tous les membres sont confirmés au même événement local (#58). **Nouveau.** Ne pas soumettre sans l'accord de David.
- [ ] Répétition générale et soumission (#37), avant dim 23 h 59.

---

## Risques et parades

| Risque | Parade |
|---|---|
| Interface en français alors que le règlement demande l'anglais | Décider dimanche matin : traduction de l'interface, ou dépôt et démo en anglais |
| Une source en direct (POWER, USGS, GVP) est lente pendant la démo | Première analyse lancée avant la démo (cache) ; vidéo de secours |
| Une coordonnée de site tombe sur de l'eau ou une oasis | Contrôle de Wassim ; vérifier altitude, pente et NDVI dans `data/candidates-precomputed.json` |
| Déploiement Azure bloqué | Démo en local avec `docker compose` |
| La démo dépasse 30 s ou 7 diapositives | Chronométrer ; le projet serait inéligible au jugement global |

---

## Après le MVP : expérience utilisateur différenciante

Une fois le MVP livré, revue complète puis travail sur l'interface et la livraison en production. Détails : [ux.md](ux.md). Issues : libellé `apres-mvp`.

1. **Re-classement en direct** dans le navigateur : le front importe le moteur de score (fonction pure).
2. **Globe 3D** des sites candidats, animé au changement de mode.
3. **Vue « jumeau lunaire »** : site terrestre et région lunaire côte à côte.
4. **Signature radar** de chaque site, superposée au profil lunaire.
5. **Modes présentés comme des missions**.
6. **Mode 4 en curseurs** reliés au globe.
7. **Sites peu étudiés mis en avant** : badge « découverte » et fiche narrative.

Pistes de données pour la suite : RADARSAT-1 et RCM comparés à LRO Mini-RF, données de navigation de rover de l'île Devon, Mars (MOLA, THEMIS, CRISM), grille mondiale.
