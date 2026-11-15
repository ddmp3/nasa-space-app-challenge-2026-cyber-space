#!/bin/bash
# Crée une issue GitHub par tâche du plan (docs/plan-projet.md), avec un libellé par personne.
# Idempotent : une issue dont le titre existe déjà n'est pas recréée.
set -euo pipefail
REPO="ddmp3/nasa-space-app-challenge-2026-cyber-space"
PLAN="https://github.com/$REPO/blob/main/docs/plan-projet.md"

existing="$(gh issue list -R "$REPO" --state all --limit 500 --json title --jq '.[].title')"

label() {
  gh label create "$1" -R "$REPO" --color "$2" --description "$3" --force >/dev/null
}

issue() {
  local who="$1" title="$2" body="$3"
  if grep -Fxq "$title" <<<"$existing"; then
    echo "déjà là : $title"
    return
  fi
  gh issue create -R "$REPO" --title "$title" --label "$who" \
    --body "$body"$'\n\n'"Plan : $PLAN · Contrats : docs/contrats.md" >/dev/null
  echo "créée : $title"
}

label david   1f6feb "David : chef de projet, infra, moteur de score"
label jesus   8250df "Jesus : API et sources de données"
label francois 0e8a16 "François : front"
label ouassim d4a72c "Ouassim : expertise métier et données"
label yann    e99695 "Yann : expérience utilisateur et tests"
label xavier  b60205 "Xavier : sécurité, présentation, soumission"

issue david "[David] Site en ligne (v0) avec deploy.sh" "Lancer infra/terraform/deploy.sh : API et site en ligne, URL partagée dans le canal. Avant sam 20 h."
issue david "[David] Route POST /api/analyze sur le squelette Express" "Le service analyze() est prêt (branche david/moteur-score). Reste : la route Express (400 sur ValidationError) une fois le squelette de Jesus fusionné. Avant sam 23 h 30."
issue david "[David] Profil lunaire : compléter les paramètres manquants" "data/reference/moon-south-pole.json est un brouillon sourcé. Reste avec Ouassim : pente, rugosité (LOLA), température de jour (Diviner), séismes (Apollo), ensoleillement. Avant sam 22 h."
issue david "[David] Revue et fusion des PR, déploiements aux jalons" "Relire et fusionner les PR ; redéployer à sam minuit et dim 12 h."

issue jesus "[Jesus] Squelette apps/api (Express, health, Dockerfile, Swagger)" "Node + TypeScript + Express (ES modules), /api/health, Dockerfile port 3001, Swagger UI. package.json, tsconfig et vitest existent déjà dans david/moteur-score : les compléter. Avant sam 17 h 30."
issue jesus "[Jesus] Contrat OpenAPI apps/api/openapi.yaml" "Avec François, à partir de docs/contrats.md §5. Figé à sam 17 h 30."
issue jesus "[Jesus] Connecteurs NASA POWER et USGS séismes" "Signature : docs/contrats.md §3. Avant sam 20 h."
issue jesus "[Jesus] Connecteur Copernicus DEM (pente, rugosité)" "COG avec geotiff.js : slope_mean, slope_max, roughness. Avant sam 22 h."
issue jesus "[Jesus] Connecteur MODIS via Planetary Computer (LST, NDVI)" "lst_day, lst_night, lst_amplitude, ndvi ; nouvelle tentative sur 502. Avant sam 22 h."
issue jesus "[Jesus] Connecteur GVP, cache mémoire, rate limit, CORS" "Smithsonian GVP (volcano_distance), cache mémoire, express-rate-limit, CORS limité au front. Avant minuit."
issue jesus "[Jesus] Routes /api/parameters, /api/modes, /api/sites/{id}" "Le catalogue et les modes existent dans apps/api/src/scoring (david/moteur-score) : les réutiliser. Avant minuit."
issue jesus "[Jesus] Bonus : explication de site par Claude" "Seulement si le MVP est stable. Clé dans un secret de la Container App."

issue francois "[François] Squelette apps/web" "React + TypeScript + Vite + Tailwind + Leaflet + zustand. Avant sam 17 h 30."
issue francois "[François] Client API typé généré depuis le contrat OpenAPI" "Avec Jesus. Avant sam 17 h 30."
issue francois "[François] Écran d'accueil : choix des 4 modes" "D'après les maquettes de Yann. Avant sam 20 h."
issue francois "[François] Carte Leaflet des sites colorés selon le score" "Développer sur data/fixtures/site-values.json en attendant /api/analyze. Avant sam 22 h."
issue francois "[François] Fiche site" "Score global, score par critère, correspond / ne correspond pas, raison d'exclusion (excluded). Avant minuit."
issue francois "[François] Formulaire du mode 4" "Paramètres, intervalles, tolérance, poids, filtre sol nu (bareSoilOnly). Avant dim 10 h."

issue ouassim "[Ouassim] Spécifications des rovers lunaires" "Pente franchissable, températures, avec sources. Avant sam 18 h 30."
issue ouassim "[Ouassim] Vérifier les intervalles des modes 1 et 2" "docs/scenarios.md, corrections sourcées. Avant sam 19 h 30."
issue ouassim "[Ouassim] data/candidates.json" "7 sites de validation et 30 à 50 sites peu étudiés (docs/contrats.md §1). Avant sam 21 h."
issue ouassim "[Ouassim] Classement attendu par mode" "Quels sites doivent sortir en haut, lesquels en bas, et pourquoi. Avant sam 23 h 30."
issue ouassim "[Ouassim] Vérification des classements réels" "Comparer au classement attendu, signaler les écarts. Avant dim 11 h."
issue ouassim "[Ouassim] 3 sites coups de cœur pour la présentation" "Avant dim 11 h."

issue yann "[Yann] Parcours utilisateur et maquettes" "Accueil, carte, fiche site, mode 4, remis à François. Avant sam 17 h 30."
issue yann "[Yann] Textes d'aide des modes et paramètres" "Compréhensibles par le grand public. Avant sam 20 h."
issue yann "[Yann] Plan de test docs/tests-fonctionnels.md" "Critères d'acceptation par mode. Avant sam 21 h."
issue yann "[Yann] Tests de la v0" "Une issue par anomalie. Avant sam 23 h."
issue yann "[Yann] Campagne de tests et feu vert du gel" "Avant dim 12 h."

issue xavier "[Xavier] Exigences et heure limite de soumission Space Apps" "Prévenir l'équipe. Avant sam 18 h."
issue xavier "[Xavier] Revue sécurité du repo" ".gitignore, secrets dans l'historique, npm audit ; résultat dans docs/securite.md. Avant sam 20 h."
issue xavier "[Xavier] Plan de la présentation" "Problème, 4 modes, démo, sites trouvés, limites, Mars en phase 2. Avant sam 23 h."
issue xavier "[Xavier] Contrôle du site en ligne" "CORS, limitation de débit, en-têtes HTTP. Avant dim 10 h."
issue xavier "[Xavier] Script et vidéo de démo" "Script de 3 minutes et vidéo de secours. Avant dim 12 h."
issue xavier "[Xavier] Soumission Space Apps et répétition" "Avant dim 13 h."
