# Revue de sécurité

Revue du 15 novembre 2026, sur `main` et l'application lancée en local (`docker compose`). À refaire sur la version déployée (contrôle du site en ligne).

## Résultats

| Contrôle | Résultat | Détail |
|---|---|---|
| Secrets dans l'historique git | Aucun | Recherche sur tout l'historique (`git log --all -p`) : clés AWS, jetons GitHub, clés privées, chaînes de connexion Azure, mots de passe |
| Fichiers sensibles suivis | Aucun | Ni `.env`, ni state Terraform, ni clé ou certificat ; `.gitignore` les exclut |
| Dépendances de l'API (`npm audit`) | 0 vulnérabilité | Production et développement. Les 7 alertes de développement (dont 2 critiques, chaîne vitest 3) sont corrigées par le passage à vitest 4.1.12 |
| Dépendances du front (`npm audit`) | 0 vulnérabilité | |
| Image Docker de l'API | Utilisateur non root, dépendances de production seulement | `USER node`, `npm ci --omit=dev` |
| CORS | Limité au front | Seule l'origine `FRONTEND_URL` est acceptée (plus `localhost:5173` hors production) ; une origine inconnue ne reçoit aucun en-tête CORS (test TF-03) |
| Limitation de débit | Active | 120 requêtes par minute et par IP sur `/api` (`express-rate-limit`), `/api/health` exclu pour les sondes Azure |
| Validation des entrées | Stricte | Corps JSON limité à 50 ko (413 au-delà), critères validés un par un, au plus un critère par paramètre, 400 avec un message (test TF-08) |
| En-têtes de l'API | `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Powered-By` retiré | |
| En-têtes du front | Ajoutés | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, politique de sécurité du contenu (scripts du site seulement, tuiles OpenStreetMap, API autorisée) ; version de nginx masquée. En local : `apps/web/nginx/default.conf.template` ; sur Azure : `staticwebapp.config.json` généré par `deploy.sh` |
| Outils de déploiement | Versions figées | `@azure/static-web-apps-cli@2.0.10`, `openapi-typescript@7.13.0` |
| Données exposées | Publiques uniquement | L'API ne sert que des données ouvertes ; aucune donnée personnelle, aucun compte |

## Points restant à vérifier

- Sur la version déployée : relancer `python3 tools/validation/e2e.py --web <front> --api <api>` et vérifier les en-têtes (`curl -I`).
- Dans un navigateur : aucune ressource bloquée par la politique de sécurité du contenu (console du navigateur, test TV-01).
- Le state Terraform reste local et hors du dépôt : le copier à la main d'une machine à l'autre, jamais dans git.
- Les tuiles OpenStreetMap sont soumises à leur politique d'usage : adaptées à une démo, pas à un trafic important.
