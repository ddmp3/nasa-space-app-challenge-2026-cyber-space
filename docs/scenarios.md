# Modes et paramètres (MVP Terre ↔ Lune)

> **Statut : première proposition.** Les intervalles et poids sont des ordres de grandeur à valider par l'équipe (Wassim pour la robotique et les instruments, avec références). Chaque valeur modifiée doit citer sa source.

## Catalogue des paramètres

Seuls ces paramètres existent dans l'application : ce sont ceux que nos sources fournissent. Les modes 1 à 3 en présélectionnent une partie ; le mode 4 (critères libres) les propose tous.

| ID | Paramètre | Unité | Source Terre | Équivalent lunaire |
|---|---|---|---|---|
| `slope_mean` | pente moyenne (fenêtre 1 km) | ° | Copernicus DEM | LOLA |
| `slope_max` | pente maximale (fenêtre 1 km) | ° | Copernicus DEM | LOLA |
| `roughness` | rugosité : écart-type de l'altitude (fenêtre 1 km) | m | Copernicus DEM | LOLA |
| `elevation` | altitude | m | Copernicus DEM | — |
| `ndvi` | indice de végétation | — | MODIS MOD13A1 | aucune végétation |
| `lst_day`, `lst_night` | température de surface jour / nuit | °C | MODIS MOD11A2 | Diviner |
| `lst_amplitude` | amplitude jour-nuit de surface | °C | MODIS MOD11A2 | Diviner |
| `t2m_mean`, `t2m_min`, `t2m_max` | température de l'air (climatologie) | °C | NASA POWER | — (proxy du froid) |
| `wind` | vitesse moyenne du vent à 2 m | m/s | NASA POWER | 0 (pas d'atmosphère) |
| `humidity` | humidité relative à 2 m | % | NASA POWER | 0 |
| `precipitation` | précipitations | mm/jour | NASA POWER | 0 |
| `solar` | ensoleillement | kWh/m²/jour | NASA POWER | éclairage quasi continu sur certaines crêtes polaires |
| `latitude_abs` | latitude absolue | ° | coordonnées | régime d'éclairage polaire |
| `quake_count` | séismes M ≥ 2,5 à moins de 300 km depuis 2000 | nombre | USGS Earthquake Catalog | séismes lunaires faibles |
| `volcano_distance` | distance au volcan holocène le plus proche | km | Smithsonian GVP | mers basaltiques, tubes de lave |

**Filtre commun à tous les modes** : `ndvi ≤ 0,1` (sol nu). Les sites végétalisés sont exclus avant le calcul du score.

## Calcul du score

- Chaque critère a un intervalle cible `[min, max]`, une tolérance `t` et un poids `w`.
- Score du critère : 1 dans l'intervalle ; décroissance linéaire jusqu'à 0 à `t` de distance de l'intervalle.
- Score global : `Σ(w × score) / Σ(w)`, affiché sur 100.
- Fiche du site : critères ≥ 0,7 = « correspond », critères < 0,4 = « ne correspond pas ».

## Mode 1 — Validation robotique (mobilité)

Objectif : tester sur Terre la mobilité d'un rover ou d'un robot avant son envoi sur un site lunaire.

| Paramètre | Intervalle cible | Tolérance | Poids | Justification |
|---|---|---|---|---|
| `slope_mean` | 5 à 15° | 10° | 3 | terrain incliné comparable aux régions candidates du pôle Sud |
| `slope_max` | 15 à 30° | 10° | 1 | permet de tester les limites de franchissement (à valider avec les spécifications des rovers lunaires) |
| `roughness` | 5 à 40 m | 30 m | 2 | terrain accidenté, cratérisé |
| `precipitation` | ≤ 1 mm/j | 1 | 1 | sol sec et meuble, proche du régolithe |
| `t2m_min` | ≤ -20 °C | 20 °C | 1 | test des composants au froid |
| `lst_amplitude` | ≥ 20 °C | 15 °C | 1 | cycles thermiques |
| `volcano_distance` | ≤ 50 km | 100 km | 1 | substrat basaltique |

## Mode 2 — Calibration d'instruments

Objectif : calibrer sur Terre des instruments (forage, vent, gaz, sismographe, thermique) dans des conditions proches de la Lune.

| Instrument | Paramètre | Intervalle cible | Tolérance | Poids | Justification |
|---|---|---|---|---|---|
| Forage | `t2m_mean` | ≤ 0 °C | 10 °C | 2 | sol gelé, proxy du régolithe glacé |
| Forage | `volcano_distance` | ≤ 50 km | 100 km | 1 | roche basaltique |
| Vent | `wind` | ≤ 3 m/s | 3 m/s | 2 | ligne de base calme (pas de vent sur la Lune) |
| Gaz | `humidity` | ≤ 40 % | 30 % | 2 | atmosphère sèche |
| Gaz | `precipitation` | ≤ 0,5 mm/j | 1 | 1 | environnement sec |
| Sismographe | `quake_count` | ≤ 5 | 20 | 3 | bruit sismique faible, comme les séismes lunaires |
| Thermique | `lst_amplitude` | ≥ 25 °C | 15 °C | 2 | forte amplitude jour-nuit |
| Thermique | `t2m_min` | ≤ -30 °C | 20 °C | 1 | froid extrême |

L'utilisateur peut filtrer par instrument (ne garder que les lignes « Sismographe », par exemple).

## Mode 3 — Colonie autosuffisante

Objectif : trouver des sites terrestres qui reproduisent les conditions rendant un site lunaire favorable à une colonie autonome.

| Besoin | Paramètre | Intervalle cible | Tolérance | Poids | Justification |
|---|---|---|---|---|---|
| Eau | `t2m_mean` | ≤ -5 °C | 10 °C | 3 | pergélisol, proxy de la glace des zones en ombre permanente (LEND) |
| Énergie | `latitude_abs` | ≥ 65° | 15° | 2 | régime d'éclairage polaire, comme le pôle Sud lunaire |
| Énergie | `solar` | ≥ 2 kWh/m²/j | 2 | 1 | potentiel solaire minimal |
| Construction | `slope_mean` | ≤ 5° | 5° | 3 | terrain plat constructible |
| Abri | `volcano_distance` | ≤ 100 km | 200 km | 1 | tubes de lave possibles |
| Stabilité | `quake_count` | ≤ 10 | 30 | 2 | sol stable pour les structures |
| Survie | `t2m_min` | ≤ -30 °C | 20 °C | 1 | test des systèmes de survie |

## Mode 4 — Critères libres

- L'utilisateur choisit des paramètres dans le catalogue ci-dessus, puis fixe pour chacun l'intervalle, la tolérance et le poids.
- Valeurs par défaut proposées : celles du mode le plus proche, sinon l'intervalle complet du paramètre.
- Le filtre `ndvi ≤ 0,1` reste actif par défaut et peut être désactivé.

## Candidats du MVP

Liste versionnée dans `data/candidates.json` (à créer) :

- **Validation** : Atacama, Dry Valleys, cratère Haughton (île Devon), Mauna Kea, Svalbard, Islande. Témoin négatif : Amazonie.
- **Sites peu étudiés** : 30 à 50 points dans des régions froides, arides ou volcaniques (Arctique canadien, Groenland, plateau tibétain, Altiplano, Gobi, Namib, hauts plateaux islandais, champs volcaniques, etc.).
