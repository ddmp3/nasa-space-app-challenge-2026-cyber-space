# 🛰️ Lunar Twins on Earth

**NASA Space Apps Challenge 2026 · Cyber&Space Montréal** · Challenge: [Permanent Moon Base Locations and Mars](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/)

A web application that ranks Earth sites as analogs of the **lunar south pole** for a chosen mission: rover mobility testing, instrument calibration, a self-sufficient colony, or free criteria. Each site is scored criterion by criterion with open data (NASA POWER, MODIS, Copernicus DEM, USGS, Smithsonian GVP) against lunar reference values (LRO LOLA slope and roughness computed with the same 1 km method as on Earth, LRO Diviner).

It is a **screening tool**: it ranks where to look first and says how solid each rank is. It does not approve a mission or replace field work.

Every site card shows what matches, what does not, the lunar value next to the Earth value, the source of each number, and what Earth cannot reproduce (gravity, vacuum, radiation).

**Live:** https://jolly-rock-05f5cb20f.3.azurestaticapps.net · **API docs:** https://ca-api-rtzkc5ya.bluesky-19c5e80c.canadacentral.azurecontainerapps.io/api/docs

![Home](docs/screenshots/01-home.jpg)
![Colony mission, Tunnunik Crater](docs/screenshots/02-mission-colony-tunnunik.jpg)

## The four modes

| Mode | Question it answers |
|---|---|
| **Robotics validation** | Where on Earth can a rover's mobility be tested before it goes to a lunar site? |
| **Instrument calibration** | Where can drills, wind, gas, seismic and thermal instruments be calibrated in near-lunar conditions? |
| **Self-sufficient colony** | Which sites reproduce the conditions that make a lunar site favorable to a self-sufficient base (water, energy, terrain, shelter)? |
| **Free criteria** | You choose the parameters, their intervals and their weights (only parameters our sources provide). |

Criteria and their justifications: [docs/scenarios.md](docs/scenarios.md).

## How it works

- **Scoring:** each criterion has a target interval, a tolerance and a weight. Score 1 inside the interval, linear decrease to 0 at the tolerance limit; site score is the weighted mean out of 100. A criterion with no data is excluded and shown as missing, never invented. Vegetation lowers the score progressively (MODIS NDVI above 0.2; dense vegetation, 0.6 and above, is excluded).
- **Rank stability:** weights, tolerances and interval bounds are expert estimates, not calibrated. Each rank therefore comes with a range from 500 scenarios (weights ±50%, tolerances ±25%, bounds ±10%): stable, moderate or fragile (how far the rank moves across the list).
- **Candidates:** 37 sites: 9 known analogs, 1 negative control (Amazon) and 27 candidate sites in cold, arid or volcanic regions. Goal: check that known analogs are rediscovered, then list candidates worth validating. They are hypotheses, not discoveries.
- **Data:** NASA POWER, USGS and Smithsonian GVP are read live by the API; terrain (Copernicus DEM) and MODIS values are precomputed offline in `tools/precompute/`. No database, no account, no secret.
- **Lunar reference:** `data/reference/moon-south-pole.json`, with slope and roughness computed from LRO LOLA over 71,731 windows of 1 km south of 85°S.

Sources and attributions: [docs/sources.md](docs/sources.md), or `GET /api/sources`.

## Validation

Known analogs are expected in the top half of the modes they are actually used for; the Amazon control must be excluded or last. **9 of 11 expectations are met** (threshold 75%); a random ranking would do as well only about 3% of the time, and the 9 hits hold in most perturbed scenarios. The two misses are explained by the data (Holuhraun is flat at 1 km scale, Svalbard air is humid). **Caveat:** the expectations were written by the team and there is a single negative control, so this is a consistency check, not an independent benchmark. Method, results and limits: [docs/validation.md](docs/validation.md).

## Limits of the analogy

Earth cannot reproduce lunar gravity, vacuum, absence of wind or radiation, and no site approaches the cold of permanently shadowed craters; temperature criteria are proxies. Every site card says what the analogy does not cover. Biology and habitability are out of scope. Not yet modelled: lighting at the pole (the Sun stays within 1.5° of the horizon), lithology (the highlands are anorthosite), regolith mechanics, communications and logistics. Until they are, a high score means "worth a closer look", not "good test site".

## Run it

```bash
docker compose up --build        # front end http://localhost:8080, API http://localhost:3001/api/docs
python3 tools/validation/e2e.py  # end-to-end tests against the running app
```

Stack: React, TypeScript, Vite, Leaflet · Node.js, TypeScript, Express, OpenAPI · Python (precompute, validation) · Docker, Terraform, Azure (Static Web App, Container Apps). Details: [docs/architecture.md](docs/architecture.md).

## Use of AI

The team defined the mission modes and the validation approach. Parts of the code, data processing scripts, tests and documentation were written with the help of Claude (Anthropic) and Microsoft Copilot, under the team's direction; commits made with Claude carry a `Co-Authored-By: Claude` trailer. No image, video or audio was generated with AI.

## Team

Cyber&Space Montréal: François, Jesus, Wassim, Yann, Xavier, David.
