# Validation des classements

Ce document répond à trois tâches : le classement attendu par mode, la vérification des classements réels, et le choix de 3 sites peu étudiés pour la présentation. Le rapport chiffré est produit par [`tools/validation/rankings.py`](../tools/validation/rankings.py) à partir de l'API qui tourne (vraies sources, `docker compose up`), puis recopié ci-dessous entre les balises.

```bash
python tools/validation/rankings.py --markdown docs/validation-classements.md
```

## Classement attendu

Un analogue terrestre ne ressemble jamais à la Lune en tout. L'énoncé le dit : un site peut être un excellent analogue géologique et un mauvais analogue thermique. On n'attend donc pas des analogues connus qu'ils sortent bien dans tous les modes, mais dans les modes qui correspondent à leur usage réel. Ces attentes sont dans `data/candidates.json` (champ `known_for`).

| Analogue connu | Modes attendus dans la moitié haute | Usage réel |
|---|---|---|
| Cratère Haughton (Nunavut) | robotique, colonie | Haughton-Mars Project : essais de rovers et de sorties, station habitée |
| Désert d'Atacama | robotique, calibration | Essais NASA de rovers et de forage (ARADS) |
| Vallées sèches de McMurdo | calibration, colonie | Désert froid : instruments, pergélisol et glace |
| Mauna Kea | robotique | PISCES : essais de rovers et d'ISRU |
| Svalbard, Bockfjorden | calibration | AMASE : essais d'instruments |
| Holuhraun (Islande) | robotique | NASA SAND-E : navigation de rovers sur coulée de lave |
| Meteor Crater | robotique | Entraînement géologique de terrain des astronautes Apollo |
| Black Point (Arizona) | robotique | NASA Desert RATS : essais de rovers et de sorties |
| Vallée de la Mort | aucun | Analogue de Mars cité dans l'énoncé |

Autres attentes :
- le témoin négatif (Amazonie) est écarté par le filtre « sol nu » ou sort dernier dans tous les modes ;
- les déserts chauds sortent en bas du mode colonie (froid polaire), et les sites polaires humides en bas du mode calibration (air sec). C'est le comportement voulu : chaque mode décrit un besoin différent.

Seuil : au moins 75 % des attentes tenues, et le témoin négatif toujours écarté ou dernier.

## Résultat (15 novembre 2026)

<!-- rankings:start -->
**Verdict : tenu.** Attentes tenues : 9/11 (82%, seuil 75%). Témoin négatif écarté ou dernier dans tous les modes : oui.

| Mode | Sites classés | Analogues attendus dans la moitié haute | Témoin négatif | Couverture moyenne des critères |
|---|---|---|---|---|
| Validation robotique | 32 | 5/6 | écarté ou dernier | 100% |
| Calibration d'instruments | 32 | 2/3 | écarté ou dernier | 100% |
| Colonie autosuffisante | 32 | 2/2 | écarté ou dernier | 100% |

### Validation robotique

| Rang | Site | Rôle | Score |
|---|---|---|---|
| 1 | craters-of-the-moon | candidate | 99 |
| 2 | atacama | validation | 90 |
| 3 | changtang | candidate | 88 |
| 4 | meteor-crater | validation | 87 |
| 5 | hoggar-atakor | candidate | 84 |
| 6 | black-point | validation | 83 |
| 7 | mauna-kea | validation | 80 |
| 8 | peary-land | candidate | 80 |
| 9 | tenoumer | candidate | 79 |
| 10 | erta-ale | candidate | 78 |

Attendus dans la moitié haute (rang ≤ 16) et présents : atacama, black-point, haughton, mauna-kea, meteor-crater.
Attendus mais plus bas : islande-holuhraun (19ᵉ).
Tous les analogues connus : atacama (2ᵉ, 90), meteor-crater (4ᵉ, 87), black-point (6ᵉ, 83), mauna-kea (7ᵉ, 80), svalbard-bockfjorden (13ᵉ, 72), haughton (16ᵉ, 68), dry-valleys (18ᵉ, 66), islande-holuhraun (19ᵉ, 63), death-valley (30ᵉ, 42).
Meilleurs sites peu étudiés : Craters of the Moon (Idaho) (99), Plateau du Changtang (Tibet) (88), Champ volcanique de l'Atakor, Hoggar (Algérie) (84).
Écartés par le filtre « sol nu » (NDVI > 0,2) : amazonie, manicouagan, popigai, wolfe-creek, gosses-bluff.

### Calibration d'instruments

| Rang | Site | Rôle | Score |
|---|---|---|---|
| 1 | hoggar-atakor | candidate | 77 |
| 2 | namib-gobabeb | candidate | 70 |
| 3 | erebus | candidate | 68 |
| 4 | harrat-khaybar | candidate | 65 |
| 5 | axel-heiberg | candidate | 62 |
| 6 | changtang | candidate | 62 |
| 7 | qaidam-lenghu | candidate | 61 |
| 8 | tunnunik | candidate | 60 |
| 9 | dry-valleys | validation | 58 |
| 10 | licancabur | candidate | 57 |

Attendus dans la moitié haute (rang ≤ 16) et présents : atacama, dry-valleys.
Attendus mais plus bas : svalbard-bockfjorden (30ᵉ).
Tous les analogues connus : dry-valleys (9ᵉ, 58), atacama (12ᵉ, 56), black-point (14ᵉ, 55), meteor-crater (16ᵉ, 52), haughton (22ᵉ, 47), death-valley (28ᵉ, 39), svalbard-bockfjorden (30ᵉ, 34), mauna-kea (31ᵉ, 32), islande-holuhraun (32ᵉ, 32).
Meilleurs sites peu étudiés : Champ volcanique de l'Atakor, Hoggar (Algérie) (77), Plaines de graviers du Namib, Gobabeb (Namibie) (70), Mont Erebus, île de Ross (Antarctique) (68).
Écartés par le filtre « sol nu » (NDVI > 0,2) : amazonie, manicouagan, popigai, wolfe-creek, gosses-bluff.

### Colonie autosuffisante

| Rang | Site | Rôle | Score |
|---|---|---|---|
| 1 | dry-valleys | validation | 100 |
| 2 | tunnunik | candidate | 92 |
| 3 | haughton | validation | 88 |
| 4 | mistastin | candidate | 83 |
| 5 | pingualuit | candidate | 79 |
| 6 | islande-holuhraun | validation | 77 |
| 7 | erebus | candidate | 77 |
| 8 | axel-heiberg | candidate | 69 |
| 9 | elgygytgyn | candidate | 69 |
| 10 | peary-land | candidate | 63 |

Attendus dans la moitié haute (rang ≤ 16) et présents : dry-valleys, haughton.
Tous les analogues connus : dry-valleys (1ᵉ, 100), haughton (3ᵉ, 88), islande-holuhraun (6ᵉ, 77), svalbard-bockfjorden (11ᵉ, 55), black-point (17ᵉ, 41), death-valley (21ᵉ, 38), atacama (28ᵉ, 25), meteor-crater (29ᵉ, 20), mauna-kea (31ᵉ, 15).
Meilleurs sites peu étudiés : Cratère Tunnunik (île Victoria, T.N.-O.) (92), Structure d'impact de Mistastin, rive est (Labrador) (83), Cratère des Pingualuit, rebord ouest (Nunavik, Québec) (79).
Écartés par le filtre « sol nu » (NDVI > 0,2) : amazonie, manicouagan, popigai, wolfe-creek, gosses-bluff.
<!-- rankings:end -->

## Lecture des écarts

- **Holuhraun en robotique.** La coulée est récente et rugueuse à l'échelle du mètre, mais plate à l'échelle de 1 km (pente moyenne de 2,4°). Le moteur mesure le relief sur 1 km, comme le DEM lunaire, et ne voit pas la rugosité fine qui intéresse la navigation. Une mesure à plus petite échelle demanderait un DEM plus fin des deux côtés.
- **Svalbard en calibration.** L'air arctique est humide (le mode demande au plus 40 % d'humidité, un proxy de l'absence d'atmosphère). Les essais AMASE visent des instruments pour Mars, pas un environnement sec comme celui de la Lune.
- **Ce que cela montre.** Le moteur ne se contente pas de retrouver les analogues célèbres : il dit pour quoi chacun est un bon analogue, et pour quoi il ne l'est pas.

## Trois sites coups de cœur

Choisis parmi les sites peu étudiés les mieux classés, en privilégiant ceux qui racontent quelque chose de nouveau.

1. **Cratère Tunnunik (île Victoria, Territoires du Nord-Ouest).** 2ᵉ du mode colonie (92/100), juste derrière les vallées sèches de McMurdo. Cratère d'impact arctique, sol gelé (air à -14 °C en moyenne), aucun séisme de magnitude 2,5 ou plus recensé à moins de 300 km depuis 2000. Peu étudié comme analogue lunaire ; des recherches y sont financées en partie par le programme SOAR de l'Agence spatiale canadienne.
2. **Structure d'impact de Mistastin (Labrador).** Dans les premiers du mode colonie (83/100). C'est surtout le meilleur jumeau rocheux du pôle Sud : de l'anorthosite, la roche des hautes terres lunaires, que nos critères volcaniques ne savent pas mesurer. L'ASC y a mené des missions analogues depuis 2010 (vérification de Wassim).
3. **Champ volcanique de l'Atakor, Hoggar (Algérie).** Parmi les premiers des modes robotique et calibration : relief accidenté comparable au pôle Sud lunaire (pente moyenne de 12°, rugosité de 58 m sur 1 km, dans l'intervalle LOLA), air sec (23 % d'humidité), sol nu (NDVI 0,08), un seul séisme de magnitude 2,5 ou plus recensé à moins de 300 km depuis 2000 (le catalogue USGS est moins complet dans les régions isolées). Presque absent de la littérature des analogues planétaires.

Les scores exacts sont dans le rapport ci-dessus : ils changent si les données ou les intervalles changent. Les coordonnées de ces sites sont à confirmer par Wassim (issue #23).
