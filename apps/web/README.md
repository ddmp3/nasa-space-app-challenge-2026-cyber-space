# Interface web

Interface React + TypeScript + Vite pour explorer les sites analogues terrestres.

## Développement local

```bash
cd apps/web
npm ci
npm run dev
```

Le bouton **Charger l’aperçu local** affiche les données de [`../../data/fixtures/site-values.json`](../../data/fixtures/site-values.json). Quand le filtre « sol nu » est actif, les sites dont le NDVI dépasse `0,2` sont marqués comme exclus, comme dans la réponse de l’API; le filtre peut être désactivé avec la case à cocher. Ces données servent uniquement au développement : certaines sont fictives et aucun score n’y est calculé. Ne pas utiliser cet aperçu dans la démo.

Le mode de calibration permet de filtrer les critères par instrument. Les critères de l’instrument sélectionné sont envoyés à l’API comme une analyse personnalisée, conformément au contrat actuel.

Pour lancer une analyse avec l’API, démarrez `apps/api` et définissez `VITE_API_URL` dans `apps/web/.env.local` (par exemple `VITE_API_URL=http://localhost:3001`). L’interface envoie les requêtes à `POST /api/analyze` et charge les valeurs détaillées avec `GET /api/sites/{id}`.

Le client HTTP utilise les types générés depuis le contrat OpenAPI :

```bash
npm run generate:api
```

Cette commande lit `../api/openapi.yaml` et met à jour `src/generated/openapi.ts`. La génération utilise une toolchain TypeScript isolée, car le projet web utilise une version de TypeScript différente de celle attendue par le générateur.

## Vérifications

```bash
npm run lint
npm run build
```
