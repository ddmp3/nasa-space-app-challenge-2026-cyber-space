# Contrats partagés

Ces formats permettent à chacun de travailler sur sa branche **sans attendre le livrable des autres** : on code contre le contrat et les données d'exemple (`data/fixtures/`), puis on branche le vrai livrable quand il arrive. Un changement de contrat se discute en équipe et se fait dans une PR dédiée.

Identifiants de paramètres (`ParamId`) : ceux du catalogue de [scenarios.md](scenarios.md#catalogue-des-paramètres) (`slope_mean`, `t2m_min`, `quake_count`…).

## 1. Sites candidats — `data/candidates.json` (Wassim)

```json
[
  { "id": "haughton", "name": "Cratère Haughton (île Devon)", "lat": 75.38, "lon": -89.67, "terrain": "impact", "role": "validation" },
  { "id": "amazonie", "name": "Amazonie (témoin négatif)", "lat": -3.47, "lon": -62.37, "terrain": "forest", "role": "negative" }
]
```

- `id` : minuscules, chiffres et tirets, unique.
- `terrain` : `polar` | `desert` | `volcanic` | `impact` | `plateau` | `forest` | `other`.
- `role` : `validation` (analogue connu) | `negative` (témoin) | `candidate` (site peu étudié).

## 2. Profil lunaire de référence — `data/reference/moon-south-pole.json` (David + Wassim)

```json
{
  "id": "moon-south-pole",
  "body": "moon",
  "name": "Pôle Sud lunaire",
  "params": {
    "slope_mean": { "min": 0, "max": 15, "unit": "°", "source": "LOLA GDR (à préciser)" }
  }
}
```

Affiché dans la fiche site pour comparer avec les valeurs terrestres. Le score, lui, utilise les critères des modes.

## 3. Valeurs d'un site — sortie des connecteurs (Jesus)

```ts
type ParamValues = Partial<Record<ParamId, number | null>>;   // null = source indisponible
type Connector = (site: { lat: number; lon: number }) => Promise<ParamValues>;
```

Chaque connecteur ne renvoie que ses paramètres. L'API fusionne les résultats ; une source en panne donne `null`, jamais une erreur globale.

## 4. Critères et score (David)

```ts
type Criterion = { param: ParamId; min?: number; max?: number; tolerance: number; weight: number; group?: string }; // group : instrument (mode 2) ou besoin (mode 3)

type CriterionScore = {
  param: ParamId; value: number | null; score: number;            // 0 à 1
  verdict: "match" | "partial" | "mismatch" | "missing";           // ≥ 0,7 | 0,4–0,7 | < 0,4 | valeur absente
};

function scoreSite(values: ParamValues, criteria: Criterion[]): { total: number; criteria: CriterionScore[] }; // total sur 100
```

Un critère `missing` (source en panne) est exclu du total : le site n'est pas pénalisé par une panne de source. Implémentation : `apps/api/src/scoring/`.

## 5. Réponse de `POST /api/analyze` (Jesus + François)

Requête : `{ "mode": "robotics" | "calibration" | "colony" }` ou `{ "criteria": Criterion[] }`, avec en option `"bareSoilOnly": false` pour désactiver le filtre NDVI ≤ 0,1 (mode 4). Une requête invalide renvoie une erreur 400 (`ValidationError`). Pour des critères libres, `mode` vaut `"custom"` dans la réponse.

```json
{
  "mode": "robotics",
  "sites": [
    {
      "id": "haughton", "name": "Cratère Haughton (île Devon)", "lat": 75.38, "lon": -89.67, "role": "validation",
      "total": 78,
      "criteria": [
        { "param": "slope_mean", "value": 7.5, "score": 1, "verdict": "match" },
        { "param": "t2m_min", "value": -48.6, "score": 1, "verdict": "match" }
      ]
    }
  ]
}
```

Les sites sont triés par `total` décroissant. Un site végétalisé (NDVI > 0,2) reste dans la liste, en dernier, avec `"total": 0` et `"excluded": "vegetation"` : l'Amazonie apparaît ainsi en bas avec la raison de son exclusion. `GET /api/sites/{id}` renvoie le même objet site, plus `values` (toutes les valeurs brutes) et `sources`.

## 6. Données d'exemple — `data/fixtures/site-values.json`

Valeurs de trois sites au format `ParamValues`, pour développer le moteur de score (David), l'interface (François) et les tests (Yann) sans l'API. **Seules les valeurs NASA POWER et USGS de Haughton sont réelles** ; les autres sont fictives et ne doivent jamais apparaître dans la démo.
