# Sources de données

Accès testé le 2026-11-14 par requêtes GET. « Vérifié » signifie que l'endpoint répond (HTTP 200/206) et renvoie des données lisibles ; ce n'est pas une validation scientifique. Les licences sont à confirmer avant diffusion. « Navigateur OK » signifie que l'API renvoie `Access-Control-Allow-Origin: *` (appel possible depuis le front).

## Principe d'accès

- **Cible (Lune)** : profil de référence établi une fois, livré en JSON versionné (`data/reference/`).
- **Candidats (Terre)** : interrogés en direct par l'API (REST, STAC, WMTS ou lecture partielle de COG), sans stockage. Cache mémoire seulement.
- **Aucun compte requis pour le MVP** : MODIS passe par Microsoft Planetary Computer (jeton anonyme) au lieu d'Earthdata.
- Planetary Computer renvoie parfois une erreur 502 au premier appel : prévoir une nouvelle tentative automatique.

## Socle MVP — Lune (profil de référence)

| Source | Variables | Accès | Auth | Statut |
|---|---|---|---|---|
| LRO **LOLA** (GDR DEM, pente) | relief, pente, régions en ombre permanente (`GDRPSR`) | [ODE REST](https://oderest.rsl.wustl.edu/live2/) `ihid=LRO&iid=LOLA&pt=GDRDEM` (270 produits) ; [PDS Geosciences](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/) | Non | Vérifié |
| LRO **Diviner** (DLRE GDR L3) | température de surface | ODE REST `ihid=LRO&iid=DLRE&pt=GDR_L3` (1 827 produits) | Non | Vérifié |
| LRO **LEND** | hydrogène près de la surface (glace) | ODE REST `iid=LEND&pt=RDRDLD4` | Non | Vérifié |
| **Moon Trek WMTS** | fonds de carte lunaires (affichage) | [WMTS LOLA](https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLA_ClrShade_Global_128ppd_v04/1.0.0/WMTSCapabilities.xml) | Non | Vérifié, navigateur OK |

## Socle MVP — Terre (sites candidats)

| Source | Variables | Accès | Auth | Statut |
|---|---|---|---|---|
| **Copernicus DEM GLO-30** | altitude, pente et rugosité (calculées) | COG sur AWS : `https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N{lat}_00_W{lon}_00_DEM/...tif` ; [STAC Planetary Computer](https://planetarycomputer.microsoft.com/api/stac/v1/collections/cop-dem-glo-30) | Non | Vérifié (lecture partielle OK) |
| **NASA POWER** | température de l'air (moy/min/max), vent, humidité, précipitations, ensoleillement | [API climatologie par point](https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,T2M_MIN,T2M_MAX,WS2M,RH2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN&community=RE&longitude=-89.67&latitude=75.38&format=JSON) ; endpoint régional aussi disponible | Non | Vérifié, navigateur OK (Haughton : T2M -14,4 °C, RH2M 94 %) |
| **MODIS LST** (MOD11A2) | température de surface jour/nuit | [STAC Planetary Computer](https://planetarycomputer.microsoft.com/api/stac/v1/collections/modis-11A2-061) | Jeton anonyme | Vérifié |
| **MODIS NDVI** (MOD13A1) | végétation (filtre « sol nu ») | [STAC Planetary Computer](https://planetarycomputer.microsoft.com/api/stac/v1/collections/modis-13A1-061) | Jeton anonyme | Vérifié |
| **USGS Earthquake Catalog** | sismicité locale (nombre de séismes) | [API FDSN](https://earthquake.usgs.gov/fdsnws/event/1/count?format=geojson&latitude=75.38&longitude=-89.67&maxradiuskm=300&starttime=2000-01-01&minmagnitude=2.5) | Non | Vérifié, navigateur OK |
| Smithsonian **GVP** | volcans holocènes (tubes de lave, basalte) | [WFS GeoJSON](https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application/json&maxFeatures=1) | Non | Vérifié |

## Compléments (si le temps le permet)

| Source | Corps | Usage | Accès | Statut |
|---|---|---|---|---|
| **EMIT** L2B minéraux (60 m) | Terre | minéralogie des surfaces arides | CMR `short_name=EMITL2BMIN` | Recherche vérifiée ; fichiers : Earthdata Login |
| **ASTER** GDEM / thermique | Terre | émissivité infrarouge thermique | CMR `short_name=ASTGTM` | Recherche vérifiée ; fichiers : Earthdata Login |
| **GLiM** | Terre | lithologie (basalte, anorthosite, sédiments meubles) | À identifier | À trouver |
| **HLS** (Landsat / Sentinel-2, 30 m) | Terre | imagerie des sites | CMR `HLSL30` / `HLSS30` ; [STAC PC](https://planetarycomputer.microsoft.com/api/stac/v1/collections/hls2-l30) | Vérifié |
| **SRTM GL1** / **NASADEM** | Terre | relief (alternative à Copernicus DEM) | CMR `SRTMGL1` ; STAC PC `nasadem` | Vérifié |
| Aérosols (MOD04, MERRA-2 M2T1NXAER) | Terre | poussière | CMR | Recherche vérifiée |
| **ICESat-2** ATL06 | Terre | élévation et rugosité des glaces | CMR `short_name=ATL06` | Recherche vérifiée |
| **ArcticDEM / REMA** | Terre | relief fin des pôles | [STAC PGC](https://pgc-opendata-dems.s3.us-west-2.amazonaws.com/pgc-data-stac.json) | Vérifié |
| **Sentinel-1** RTC / GRD | Terre | radar (rugosité), bonus SAR sur 1 ou 2 sites | STAC PC `sentinel-1-rtc`, `sentinel-1-grd` | Vérifié |
| LRO **Mini-RF** | Lune | radar (rugosité, glace) | ODE REST `iid=MRFLRO&pt=MOSCDR` (24 mosaïques) | Vérifié |
| LROC / QuickMap | Lune | imagerie, catalogue des pits (tubes de lave) | [quickmap.lroc.asu.edu](https://quickmap.lroc.asu.edu/) | Site accessible ; pas d'API testée |
| ERA5 | Terre | climat (réanalyse) | [CDS](https://cds.climate.copernicus.eu/) | Catalogue vérifié ; téléchargement : compte CDS |
| RADARSAT-1 / RCM (ASC) | Terre | radar | Liens fournis dans l'énoncé du défi | Non testé |
| Earth Impact Database (UNB) | Terre | cratères d'impact | `passc.net` redirige vers une page « lander » (domaine qui semble parqué) | Nouvelle adresse à trouver |

## Phase 2 — Mars

| Source | Usage | Accès | Statut |
|---|---|---|---|
| MGS **MOLA** | altimétrie, pente | ODE REST (base `mars`) | Instrument présent dans ODE |
| ODY **THEMIS** | inertie thermique, température | ODE REST | Instrument présent dans ODE |
| MRO **CRISM** | minéralogie | ODE REST | Instrument présent dans ODE |
| MRO **CTX / HiRISE** | imagerie | ODE REST | Instruments présents dans ODE |
| MRO **SHARAD** | radar de sub-surface (glace enfouie) | ODE REST | Instrument présent dans ODE |
| **Mars Trek WMTS** | fonds de carte | [WMTS MOLA](https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/WMTSCapabilities.xml) | Vérifié |
| USGS Astrogeology | catalogues (grottes candidates) | [STAC](https://stac.astrogeology.usgs.gov/api/collections) | Vérifié |

## Couverture des dimensions du défi (MVP Lune)

| Dimension | Couverte ? | Sources |
|---|---|---|
| Relief, pente, rugosité | Oui | LOLA, Copernicus DEM |
| Température, extrêmes | Oui | Diviner, MODIS LST, NASA POWER |
| Eau, glace | Partiel (proxy : sol gelé) | LEND, NASA POWER |
| Énergie solaire | Oui | NASA POWER (ensoleillement), latitude |
| Sismicité | Oui | USGS Earthquake Catalog |
| Géologie, minéralogie | Partiel | GVP (volcanisme) ; EMIT, ASTER, GLiM en complément |
| Grottes, tubes de lave | Partiel | GVP (proximité volcanique) ; pits LROC en complément |
| Biologie, habitabilité | Non | Hors périmètre (assumé) |

## Limites connues

- Le SAR (Mini-RF contre Sentinel-1/RCM) n'est pas directement comparable : longueurs d'onde et polarisations différentes. Bonus uniquement.
- Aucun site terrestre n'approche les températures des zones en ombre permanente (environ 25 à 110 K) : le critère de température compare des **tendances** (froid extrême, forte amplitude), pas des valeurs absolues.

## Utilisées dans le MVP (état au 15 novembre)

Le catalogue exact, avec la mention à reproduire pour chaque source, est servi par `GET /api/sources` (`apps/api/src/sources/catalog.ts`).

| Source | Paramètres | Accès dans l’application |
|---|---|---|
| NASA POWER | `t2m_*`, `wind`, `humidity`, `precipitation`, `solar` | API en direct, cache mémoire |
| USGS Earthquake Catalog | `quake_count` | API en direct, cache mémoire |
| Smithsonian GVP | `volcano_distance` | Liste des volcans holocènes chargée une fois, distance calculée localement |
| Copernicus DEM GLO-30 | `elevation`, `slope_mean`, `slope_max`, `roughness` | Précalculé (`tools/precompute/enrich_candidates.py`), fenêtres de 1 km |
| MODIS MOD11A2/MYD11A2, MOD13A1/MYD13A1 (v6.1) | `lst_*`, `ndvi` | Précalculé (`tools/precompute/modis_values.py`) : moyennes 2024 sur la tuile sinusoïdale qui contient le site, au moins 6 compositions valides |
| LRO LOLA LDEM_85S_40M | pente et rugosité lunaires | Précalculé (`tools/precompute/lunar_reference.py`) : intervalle interquartile de 71 731 fenêtres de 1 km au sud de 85°S |
| LRO Diviner, NASA Moon Fact Sheet | froid des zones d’ombre, gravité, pression | Valeurs publiées citées dans `data/reference/moon-south-pole.json` |

## Données canadiennes (accord de l’équipe pour leur usage)

Pistes relevées par Wassim ([verification-modes-1-2.md](verification-modes-1-2.md), section 8), pas encore intégrées au moteur :

- **RADARSAT-1** (archive ouverte depuis 2019) et **RCM** (produits archivés ouverts via EODMS de RNCan, licence du gouvernement ouvert) : radar à synthèse d’ouverture, voit à travers les nuages et la nuit polaire. Comparaison possible avec LRO Mini-RF sur un ou deux sites, sans l’intégrer au score (longueurs d’onde différentes).
- **Réseau d’analogues de l’ASC (CARN)** : station HMP (Haughton), station McGill (île Axel Heiberg) ; missions à Mistastin depuis 2010 ; cratère Tunnunik (programme SOAR). Ces sites sont dans `data/candidates.json`.
- **Jeu de données de navigation de rover de l’île Devon** (Université de Toronto, subvention CARN) : données réelles de conduite pour valider les intervalles de pente et de rugosité du mode 1.
