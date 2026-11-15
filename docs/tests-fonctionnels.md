# Tests fonctionnels

Plan de test du MVP Terre ↔ Lune. Les tests TF-01 à TF-12 sont automatisés ([`tools/validation/e2e.py`](../tools/validation/e2e.py)) ; les tests TV-01 à TV-08 se font à la main dans un navigateur (Yann).

## Lancer les tests

```bash
docker compose up --build -d                     # front http://localhost:8080, API http://localhost:3001
python tools/validation/e2e.py                   # tests TF (bibliothèque standard Python)
python tools/validation/rankings.py              # classements contre le classement attendu (docs/validation-classements.md)
```

Sur Azure, après le déploiement : `python tools/validation/e2e.py --web https://<front> --api https://<api>`.

Tests unitaires, par composant :

```bash
cd apps/api && npm test && npm run typecheck     # moteur de score, service d'analyse, serveur, connecteurs
cd apps/web && npm run build && npm run lint     # front (types générés depuis openapi.yaml)
python -m pytest -q tools/precompute tools/validation
```

## Critères d'acceptation automatisés

| Id | Ce qui est vérifié | Critère d'acceptation |
|---|---|---|
| TF-01 | Le front se charge | Page 200, bundle JavaScript servi, et ce bundle appelle l'URL de l'API attendue |
| TF-02 | Santé de l'API | `/api/health` répond `{"status":"ok"}` |
| TF-03 | CORS | L'origine du front est acceptée ; une origine inconnue ne reçoit pas d'en-tête CORS |
| TF-04 à TF-06 | Modes 1, 2 et 3 | Au moins 30 sites ; scores entre 0 et 100, triés ; sites écartés en dernier ; Amazonie écartée par le filtre « sol nu » |
| TF-07 | Mode 4 | Critères libres acceptés ; filtre « sol nu » désactivable ; chaque site porte exactement les critères demandés |
| TF-08 | Erreurs | Liste vide, paramètre inconnu, mode inconnu, JSON illisible : 400 avec un message |
| TF-09 | Fiche site | Valeurs, source de **chaque** valeur connue, aucune donnée d'exemple en mode réel, référence lunaire sourcée ; 404 pour un site inconnu |
| TF-10 | Sources | Chaque source a un nom, une adresse `https://` et sa mention ou ses conditions |
| TF-11 | Profil lunaire | Chaque paramètre lunaire est sourcé ; les limites de la Terre (gravité, vide, rayonnement) sont présentes |
| TF-12 | Documentation | Swagger UI sur `/api/docs` |

## Vérifications à la main (navigateur)

| Id | Parcours | Attendu |
|---|---|---|
| TV-01 | Ouvrir le site, choisir chaque mode, lancer l'analyse | La carte affiche les sites colorés selon le score ; la liste est triée ; aucune erreur affichée |
| TV-02 | Ouvrir la fiche d'un site du haut et d'un site du bas | Score par critère, verdict, valeur lunaire à côté de la valeur terrestre, source de chaque valeur, bloc « Ce que la Terre ne peut pas reproduire » |
| TV-03 | Mode 2 : filtrer par instrument (sismographe, par exemple) | Seuls les critères de cet instrument sont utilisés |
| TV-04 | Mode 4 : ajouter trois critères, changer intervalles et poids, désactiver le filtre « sol nu » | Le classement change ; l'Amazonie revient dans la liste ; chaque paramètre affiche son texte d'aide |
| TV-05 | Mode 4 : saisir un intervalle vide ou un paramètre en double | Message d'erreur clair, pas d'appel bloqué |
| TV-06 | Couper l'API puis lancer une analyse | Message d'erreur lisible ; la page reste utilisable |
| TV-07 | Largeur de téléphone (environ 400 px) | Carte, liste et fiche lisibles, sans défilement horizontal |
| TV-08 | Bas de page | Liste des sources des données, avec liens |

## Résultats

### 15 novembre 2026, local (docker compose, vraies sources)

Tests automatisés : **12/12**.

```
OK   TF-01  Le front se charge et vise la bonne API : bundle 389 Ko, API http://localhost:3001
OK   TF-02  Sonde de santé de l'API
OK   TF-03  CORS : origine du front acceptée, origine inconnue refusée
OK   TF-04  Mode 1, validation robotique : 37 sites, 1er craters-of-the-moon (99), 0 critères sans valeur
OK   TF-05  Mode 2, calibration d'instruments : 37 sites, 1er hoggar-atakor (77), 0 critères sans valeur
OK   TF-06  Mode 3, colonie autosuffisante : 37 sites, 1er dry-valleys (100), 0 critères sans valeur
OK   TF-07  Mode 4, critères libres, filtre sol nu désactivé : 1er axel-heiberg (100)
OK   TF-08  Requêtes invalides refusées avec un message (400)
OK   TF-09  Fiche site : valeurs, source de chaque valeur, référence lunaire ; 404 site inconnu : 18 valeurs sourcées, 9 références lunaires
OK   TF-10  Catalogue des sources complet : coordinates, nasa-power, usgs-comcat, smithsonian-gvp, copernicus-dem, modis, lro-lola, lro-diviner
OK   TF-11  Profil lunaire sourcé et limites de la Terre
OK   TF-12  Documentation de l'API
```

Tests unitaires : API 111/111, outils Python 24/24, front compilé sans erreur ni avertissement de lint.

Classements : voir [validation-classements.md](validation-classements.md) (9 attentes tenues sur 11).

Vérifications à la main TV-01 à TV-08 : **à faire par Yann**, en local puis sur la version déployée. Une issue GitHub par anomalie.
