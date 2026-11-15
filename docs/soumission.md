# Soumission Space Apps 2026

Source : guide officiel *Project Submission Guide* (https://www.spaceappschallenge.org/resources/project-submission-guide/), lu le 15 novembre 2026.

## Règles à respecter

- **Heure limite : dimanche 15 novembre, 23 h 59, heure de Montréal** (heure de l'événement local). Cliquer sur « Submit for Judging » avant. On peut modifier et resoumettre autant de fois qu'on veut jusque-là ; seule la dernière version compte.
- **Tout en anglais** : la page de projet **et tous les éléments liés** (site, dépôt, démo). Une vidéo peut être parlée dans une autre langue, mais avec des sous-titres anglais. Les diapositives doivent être en anglais.
- **Démo obligatoire** : une vidéo de **30 secondes ou moins**, ou **7 diapositives au plus** (titre et introduction compris). Au-delà, le projet n'est pas éligible au jugement global. Hébergée à l'extérieur (YouTube, Google Drive, GitHub…), lien public sans connexion.
- **Lien vers le projet final** public, sans mot de passe ni inscription.
- **Au moins une donnée ou ressource NASA** pour être éligible à un prix global (nous en avons plusieurs, voir plus bas).
- **Lister toutes les données, ressources et outils**, y compris le code et les images libres.
- **Usage de l'IA (« Super Intelligence », SI)** : le déclarer. Le code et les données produits avec une IA doivent le signaler dans le texte et les métadonnées ; une image ou une vidéo générée doit porter un filigrane visible. Une IA ne doit pas servir à trouver l'idée de la solution. Aucun élément de la marque NASA (logos, drapeaux, identifiants de mission) dans du contenu généré.
- Aucune image, vidéo ou voix de personne de moins de 18 ans.
- Tous les membres doivent être confirmés au même événement local. Cocher « Terms and Conditions » et « Confirm All Work is Original », puis « Submit for Judging ».
- Critères de jugement : Impact, Creativity, Validity, Relevance, Presentation (*2026 Judging and Awards Guide*).

## Points d'attention pour l'équipe

1. **L'application et le dépôt sont en français.** Le guide exige l'anglais pour les éléments liés. Il faut soit traduire l'interface avant la soumission, soit lier le dépôt (avec la présentation anglaise en tête du README) et une démo en anglais. Décision : David.
2. Le site doit être en ligne et public avant de soumettre son lien (déploiement Azure, avec l'accord de David). Le guide recommande de demander une classification FortiGuard pour qu'un nouveau site ne soit pas bloqué chez les juges (facultatif).
3. Démo : vidéo de 30 secondes **ou** 7 diapositives. Script et plan dans [presentation.md](presentation.md).

## Brouillons des champs du formulaire (en anglais)

### Project Name

*(proposition, à choisir en équipe)* Lunar Twins on Earth: analog sites for a Moon base

### High-Level Project Summary

We built a web application that searches Earth for places that can stand in for the lunar south pole, where NASA plans future Artemis landings and a permanent base. The user picks a mission (rover mobility testing, instrument calibration, self-sufficient colony, or free criteria) and the app ranks 37 Earth sites, scoring each one criterion by criterion against values measured on the Moon. Each site card shows what matches, what does not, the lunar reference value next to the Earth value, the source of every number, and what Earth cannot reproduce (gravity, vacuum, radiation). Beyond confirming well-known analogs such as the McMurdo Dry Valleys and Haughton Crater, it highlights understudied sites such as Tunnunik Crater (Northwest Territories), the Mistastin impact structure (Labrador, anorthosite like the lunar highlands) and the Atakor volcanic field (Algeria).

### Link to Project Demo

*(lien public vers la vidéo de 30 s ou les 7 diapositives)*

### Link to Final Project

*(URL du site déployé sur Azure, ou https://github.com/ddmp3/nasa-space-app-challenge-2026-cyber-space)*

### Detailed Project Description

**What it does.** For each Earth candidate site, the app collects terrain, climate, surface temperature, vegetation, seismicity and volcanism data, then scores it against the target conditions of a mission mode. Scores are explainable: each criterion has a target interval, a tolerance and a weight; the site card lists the measured value, the lunar reference, the verdict (matches, partially matches, does not match) and the data source. A criterion with no available data is excluded from the total and shown as missing, never invented. Vegetated sites (MODIS NDVI above 0.2) are flagged and ranked last.

**How it works.** A TypeScript scoring engine (pure functions, 111 unit tests) runs behind an Express API that queries NASA POWER, the USGS Earthquake Catalog and the Smithsonian Global Volcanism Program live, and reads terrain (Copernicus DEM GLO-30) and MODIS values precomputed offline with Python. On the Moon side, we computed slope and roughness at the lunar south pole from the LRO LOLA polar elevation model with exactly the same 1 km window method as on Earth (71,731 windows south of 85°S). This changed our rover mode: the real lunar south pole has a mean slope of 5 to 13° (interquartile range) over 1 km, steeper than the Apollo traverses we started from. A React front end shows the ranking on a map and the site cards. An independent Python scorer gives identical results to the TypeScript engine.

**Validation.** Known analogs are expected to rank in the top half of the modes they are actually used for (for example Black Point Lava Flow for NASA Desert RATS rover tests, the Dry Valleys for cold-desert instruments); 9 of 11 expectations are met, and the Amazon negative control is excluded in every mode. The two misses are explained by the data (Holuhraun is flat at 1 km scale; Svalbard air is humid).

**Benefits.** Mission teams and students can see which Earth site is a good analog for which purpose, and why, with every number traceable to an open dataset.

**Tools.** TypeScript, Node.js, Express, React, Vite, Leaflet, Python (NumPy, rasterio, pystac-client), Docker, Terraform, Microsoft Azure.

### Use of Super Intelligence (SI)

Yes. The team defined the idea, the mission modes and the validation approach. We used Claude (Anthropic) and Microsoft Copilot as coding and documentation assistants. Claude was used for: writing and reviewing parts of the TypeScript and Python code, data processing scripts (LOLA and MODIS), tests, documentation, and a first draft of the candidate site list, which team members review. Commits produced with this assistance carry a "Co-Authored-By: Claude" trailer in the Git history, and the repository README states it. No images, video or audio were generated with SI.

### NASA Data

- NASA POWER (Prediction Of Worldwide Energy Resources), NASA Langley Research Center: air temperature, wind, humidity, precipitation and solar irradiance climatology for each site.
- MODIS Land Surface Temperature (MOD11A2 / MYD11A2 v6.1) and Vegetation Indices (MOD13A1 / MYD13A1 v6.1), NASA LP DAAC (accessed through Microsoft Planetary Computer): surface temperature day/night and NDVI, 2024.
- LRO LOLA polar digital elevation model LDEM_85S_40M, NASA Planetary Data System (Geosciences Node): lunar south pole slope and roughness.
- LRO Diviner published results (Paige et al. 2010, Science 330:479): permanently shadowed region temperatures.
- NASA Moon Fact Sheet (NSSDCA): lunar gravity, surface pressure.
- NASA, Artemis III candidate landing regions (August 2022): latitude of the target region.
- NASA Earth Observatory, *Measuring Vegetation (NDVI & EVI)*: NDVI thresholds.

### Space Agency Partner Data and Other References

- ESA / European Union, Copernicus DEM GLO-30 (via AWS Open Data): elevation, slope, roughness. Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA.
- CSA (Canadian Space Agency): Canadian analog research network (Haughton-Mars Project station, McGill Arctic Research Station), Mistastin Lake analog missions, Tunnunik Crater research (SOAR program), used to select and document candidate sites.
- U.S. Geological Survey, Earthquake Catalog (ComCat): seismicity.
- Smithsonian Institution, Global Volcanism Program, Volcanoes of the World: distance to Holocene volcanoes.
- OpenStreetMap contributors: base map tiles.
- Literature cited for mission criteria: NASA SP-4214 (Apollo LRV), NASA NTRS reports on VIPER mobility and Apollo traverses, Nakamura and Latham et al. (Apollo seismology), Moriarty and Petro EPSC2022-295 (south pole geology), ISRO Chandrayaan-3 ChaSTE results. Full list: docs/verification-modes-1-2.md.
- Open-source software: Node.js, Express, React, Vite, Leaflet, NumPy, rasterio, pystac-client, vitest.
