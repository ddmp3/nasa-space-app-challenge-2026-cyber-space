# Instructions Globales pour Claude

## Convention de Nommage Obligatoire

Dans **TOUTES** tes réponses, utilise systématiquement cette convention avec **@** :

- **@claude:** Actions directes (lecture/édition, bash simple, explications)
- **@explore:** Exploration du code (agent spécialisé)
- **@general:** Tâches complexes multi-étapes
- **@[nom-agent]:** Pour tout autre agent invoqué (ex: @ai-architect)

**Exemple:**
```
@claude: Je vais lire le fichier classifier.py
@explore: Exploration de la structure du projet...
@claude: Voici les résultats
```

## Workflow Professionnel

**IMPORTANT:** Suis toujours ce processus:
1. **Plan** → Utilise TodoWrite pour planifier les tâches complexes
2. **Small diffs** → Changements incrémentaux et testables
3. **Tests** → Vérifie systématiquement
4. **Review** → Explique les changements

## Standards de Code

### Style Python
- Utilise **type hints** pour toutes les fonctions
- Docstrings au format Google/NumPy
- PEP 8 strict (black, flake8, mypy)
- Pas de code commenté (supprime-le)
- Fonctions max 50 lignes

### Style JavaScript/TypeScript
- ES modules (jamais CommonJS)
- TypeScript strict mode
- Async/await (pas de .then)
- Nommage: camelCase (variables), PascalCase (classes)

### Tests
- **YOU MUST** exécuter les tests avant de marquer une tâche comme complète
- Coverage minimum: 80%
- Tests unitaires + intégration

## Commandes Bash Courantes

```bash
# Python
python3 -m pytest tests/
black . && flake8 . && mypy .

# Node.js
npm run test
npm run build
npm run lint
```

## Architecture

### Patterns Préférés
- Séparation des préoccupations (SoC)
- Dependency Injection
- Repository pattern pour data access
- Factory pattern pour création d'objets

### Structure de Fichiers
- `/src` → Code source principal
- `/tests` → Tests (miroir de /src)
- `/docs` → Documentation technique
- `/scripts` → Scripts utilitaires

## Gestion du Contexte

### Avant de Commencer
1. **Lis** les fichiers pertinents
2. **Comprends** l'architecture existante
3. **Planifie** avec TodoWrite si tâche complexe
4. **Demande** si incertain

### Pendant le Travail
- **Changements incrémentaux** (pas de refactoring massif)
- **Tests après chaque étape**
- **Commits fréquents** avec messages clairs
- **Explique** tes décisions techniques

## Autonomie des Commandes

**IMPORTANT:** Exécute immédiatement sans validation les commandes en lecture seule:

### Commandes Autonomes (pas de validation requise)
- **Lecture:** `cat`, `ls`, `head`, `tail`, `grep`, `find`, `tree`
- **Inspection:** `git status`, `git log`, `git diff`, `git show`
- **Queries:** `SELECT` (read-only), `SHOW`, `DESCRIBE`, `EXPLAIN`
- **Informations:** `ps`, `top`, `df`, `du`, `which`, `env`
- **Azure/Cloud:** `az [resource] show`, `az [resource] list`, `kubectl get`
- **API (GET):** Requêtes HTTP GET en lecture seule
- **Recherche/Consultation:** `WebSearch`, `WebFetch`, recherches documentation, consultation APIs publiques

### Commandes Nécessitant Validation
- **Modifications:** `rm`, `mv`, `cp`, `git commit`, `git push`
- **Création:** `mkdir`, `touch`, `write`, `INSERT`, `UPDATE`, `DELETE`
- **Déploiement:** `deploy`, `publish`, `apply`, `create`
- **Installation:** `npm install`, `pip install`, `apt install`

**Règle:** Si la commande est **idempotente** et **sans effet de bord**, exécute immédiatement.

## Qualité et Sécurité

**YOU MUST:**
- ❌ Jamais commiter de secrets (.env, credentials)
- ✅ Valider les inputs utilisateur
- ✅ Gérer les erreurs explicitement
- ✅ Logger les opérations critiques
- ✅ Optimiser les performances (pas de N+1 queries)

## Communication

- **Concis et technique** (pas de fluff)
- **Markdown** pour formatage
- **Liens cliquables** pour fichiers: `[file.py:42](path/file.py#L42)`
- **Pas d'emojis** sauf demande explicite

## Optimisation

- Longueur idéale CLAUDE.md: **100-200 lignes**
- Si trop long → Créer CLAUDE.md dans sous-dossiers
- Raffiner régulièrement (comme un prompt)
