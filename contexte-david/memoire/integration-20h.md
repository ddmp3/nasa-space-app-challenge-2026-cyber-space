---
name: integration-20h
description: "Intégration complète du projet (prévue sam 14/11 20 h, pas encore faite à 22 h 55) : David relit et fusionne toutes les PR, puis deploy.sh ; app exploitable le dim 15/11"
metadata:
  node_type: memory
  type: project
  originSessionId: c6c636e8-9169-4505-8ebf-3958a2310430
  modified: 2026-11-15T03:55:59.412Z
---

Décision du 14/11/2026 : pas de déploiement partiel. On compile le projet complet une fois les sources prêtes (cible initiale : sam 14/11 20 h, Montréal), puis `deploy.sh` (issue #3) ; objectif : app exploitable le dim 15/11. **David relit et fusionne toutes les PR** (pas François).

État à sam 22 h 55 : rien de fusionné. PR ouvertes : #38 (David, moteur de score, base main), #50 (Jesus, serveur Express + POWER/USGS + OpenAPI, **base = david/moteur-score**), #49 (François, front apps/web), #48 (Yann, maquettes, 2 solutions d'interface à arbitrer), #47 (Ouassim, un .docx). Ordre de fusion conseillé : #38 → #50 → #49 → #48 ; #47 à convertir en données.

Dim 15/11 : David reprend sur son Mac portable sur site ; sam soir sur son PC. Le contexte complet est dans `contexte-david/` (branche `david/contexte`).

**Why:** éviter de déployer une version partielle ; une seule intégration propre.

**How to apply:** ne pas lancer `deploy.sh` sans accord explicite ; vérifier l'état réel des PR (`gh pr list`) avant d'agir, il évolue vite. Voir [[ux-differenciante]].
