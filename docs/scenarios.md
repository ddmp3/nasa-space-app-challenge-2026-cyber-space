# Modes et paramètres (MVP Terre ↔ Lune)

> **Statut : première proposition.** Les intervalles et poids sont des ordres de grandeur à valider par l'équipe (Wassim pour la robotique et les instruments, avec références). Chaque valeur modifiée doit citer sa source.
>
> **Vérification de Wassim (modes 1 et 2)** : voir [verification-modes-1-2.md](verification-modes-1-2.md). Toutes les lignes de température sont des **proxys** : aucun site terrestre n’approche le froid des zones en ombre permanente (29 à 50 K) ni l’amplitude jour-nuit lunaire (environ 300 K à basse latitude). Le pôle Sud lunaire est en croûte des hautes terres (anorthosite), pas en basalte de mer (Moriarty et Petro, EPSC2022-295).

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
| `volcano_distance` | distance au volcan holocène le plus proche | km | Smithsonian GVP | aucun volcanisme récent au pôle Sud (croûte des hautes terres) ; le basalte sert de substitut terrestre |

**Filtre commun à tous les modes** : `ndvi ≤ 0,2` (sol nu). Les sites végétalisés sont exclus avant le calcul du score.

> Seuil relevé de 0,1 à 0,2 le 15/11 après mesure (médiane annuelle 2024 du NDVI MODIS sur les 37 sites). À 0,1, le filtre écartait des déserts nus : Namib (0,116), Aorounga au Sahara (0,110), Harrat Khaybar (0,109), et deux terrains d'essai de la NASA, Black Point (0,151) et Meteor Crater (0,157). À 0,2, il écarte toujours l'Amazonie (0,867), la forêt boréale de Manicouagan (0,551), Wolfe Creek (0,325), Popigaï (0,241) et Gosses Bluff (0,240). Référence : NASA Earth Observatory, *Measuring Vegetation (NDVI & EVI)* : « des valeurs très faibles (0,1 et moins) correspondent à des zones de roche, de sable ou de neige ; des valeurs modérées (0,2 à 0,3) aux arbustes et prairies » (https://earthobservatory.nasa.gov/features/MeasuringVegetation/measuring_vegetation_2.php).

## Calcul du score

- Chaque critère a un intervalle cible `[min, max]`, une tolérance `t` et un poids `w`.
- Score du critère : 1 dans l'intervalle ; décroissance linéaire jusqu'à 0 à `t` de distance de l'intervalle.
- Score global : `Σ(w × score) / Σ(w)`, affiché sur 100.
- Fiche du site : critères ≥ 0,7 = « correspond », critères < 0,4 = « ne correspond pas ».

## Mode 1 — Validation robotique (mobilité)

Objectif : tester sur Terre la mobilité d'un rover ou d'un robot avant son envoi sur un site lunaire.

| Paramètre | Intervalle cible | Tolérance | Poids | Justification |
|---|---|---|---|---|
| `slope_mean` | 5 à 13° | 10° | 3 | intervalle interquartile mesuré au pôle Sud lunaire (LRO LOLA LDEM_85S_40M, 71 731 fenêtres de 1 km au sud de 85°S, même calcul que sur Terre : `tools/precompute/lunar_reference.py`). La proposition 3 à 10° (traversées d'Apollo 15 et 16, terrains équatoriaux plus doux) n'est pas retenue pour le pôle Sud |
| `slope_max` | 15 à 30° | 10° | 1 | limites de franchissement des rovers : VIPER 15° (25 à 30° si nécessaire), LRV 25°, LTV 20° (vérification de Wassim) ; au pôle Sud, la pente max sur 1 km est de 14 à 23° pour la moitié des fenêtres (LOLA) |
| `roughness` | 22 à 65 m | 30 m | 2 | intervalle interquartile de l'écart-type de l'altitude sur 1 km au pôle Sud lunaire (LOLA, même calcul que sur Terre) |
| `precipitation` | ≤ 1 mm/j | 1 | 1 | sol sec et meuble, proche du régolithe |
| `t2m_min` | ≤ -20 °C | 20 °C | 1 | test des composants au froid |
| `lst_amplitude` | ≥ 20 °C | 15 °C | 1 | cycles thermiques |
| `volcano_distance` | ≤ 50 km | 100 km | 1 | le basalte sert de substitut terrestre pour la mécanique des roches et du régolithe (le pôle Sud est en hautes terres) |

## Mode 2 — Calibration d'instruments

Objectif : calibrer sur Terre des instruments (forage, vent, gaz, sismographe, thermique) dans des conditions proches de la Lune.

| Instrument | Paramètre | Intervalle cible | Tolérance | Poids | Justification |
|---|---|---|---|---|---|
| Forage | `t2m_mean` | ≤ 0 °C | 10 °C | 2 | sol gelé, proxy du régolithe glacé |
| Forage | `volcano_distance` | ≤ 50 km | 100 km | 1 | basalte : substitut terrestre (le pôle Sud est en hautes terres, en anorthosite) |
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
- Le filtre `ndvi ≤ 0,2` reste actif par défaut et peut être désactivé.

## Candidats du MVP

Liste versionnée dans `data/candidates.json` (à créer) :

- **Validation** : Atacama, Dry Valleys, cratère Haughton (île Devon), Mauna Kea, Svalbard, Islande. Témoin négatif : Amazonie.
- **Sites peu étudiés** : 30 à 50 points dans des régions froides, arides ou volcaniques (Arctique canadien, Groenland, plateau tibétain, Altiplano, Gobi, Namib, hauts plateaux islandais, champs volcaniques, etc.).
