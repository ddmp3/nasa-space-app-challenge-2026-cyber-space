import type { ParamId, ParamValues } from "../scoring/index.js";

/**
 * Catalogue des sources de données, nommées pour l'application et la soumission Space Apps
 * (toutes les sources doivent être citées). Chaque paramètre n'a qu'une source.
 */
export type DataSource = {
  id: string;
  name: string;
  provider: string;
  url: string;
  /** Côté Terre (candidats) ou Lune (profil de référence). */
  body: "earth" | "moon";
  params: ParamId[];
  /** Mention ou conditions d'utilisation à reproduire. */
  terms: string;
};

export const SOURCES: DataSource[] = [
  {
    id: "coordinates",
    name: "Coordonnées des sites candidats",
    provider: "Équipe Cyber&Space Montréal (data/candidates.json)",
    url: "https://github.com/ddmp3/nasa-space-app-challenge-2026-cyber-space/blob/main/data/candidates.json",
    body: "earth",
    params: ["latitude_abs"],
    terms: "Liste versionnée dans le dépôt du projet.",
  },
  {
    id: "nasa-power",
    name: "NASA POWER (climatologie par point)",
    provider: "NASA Langley Research Center",
    url: "https://power.larc.nasa.gov/",
    body: "earth",
    params: ["t2m_mean", "t2m_min", "t2m_max", "wind", "humidity", "precipitation", "solar"],
    terms: "Données NASA, accès libre. Mention : « Data obtained from the NASA Langley Research Center POWER Project ».",
  },
  {
    id: "usgs-comcat",
    name: "USGS Earthquake Catalog (ComCat)",
    provider: "U.S. Geological Survey",
    url: "https://earthquake.usgs.gov/fdsnws/event/1/",
    body: "earth",
    params: ["quake_count"],
    terms: "Domaine public (gouvernement des États-Unis). Séismes M ≥ 2,5 à moins de 300 km depuis 2000.",
  },
  {
    id: "smithsonian-gvp",
    name: "Smithsonian Global Volcanism Program, Volcanoes of the World (holocène)",
    provider: "Smithsonian Institution",
    url: "https://volcano.si.edu/",
    body: "earth",
    params: ["volcano_distance"],
    terms: "Global Volcanism Program, Smithsonian Institution. Citer la base Volcanoes of the World.",
  },
  {
    id: "copernicus-dem",
    name: "Copernicus DEM GLO-30",
    provider: "ESA / Union européenne (programme Copernicus), via AWS Open Data",
    url: "https://registry.opendata.aws/copernicus-dem/",
    body: "earth",
    params: ["elevation", "slope_mean", "slope_max", "roughness"],
    terms:
      "Produit à partir de Copernicus WorldDEM-30 © DLR e.V. 2010-2014 et © Airbus Defence and Space GmbH 2014-2018, fourni dans le cadre de COPERNICUS par l'Union européenne et l'ESA. Pente et rugosité calculées en fenêtres de 1 km (tools/precompute).",
  },
  {
    id: "modis",
    name: "NASA MODIS MOD11A2 / MYD11A2 (température de surface) et MOD13A1 / MYD13A1 (NDVI), version 6.1",
    provider: "NASA LP DAAC, via Microsoft Planetary Computer",
    url: "https://planetarycomputer.microsoft.com/dataset/group/modis",
    body: "earth",
    params: ["lst_day", "lst_night", "lst_amplitude", "ndvi"],
    terms: "Données NASA, accès libre. Moyennes 2024 précalculées (tools/precompute/modis_values.py).",
  },
  {
    id: "lro-lola",
    name: "LRO LOLA, modèle d'élévation polaire LDEM_85S_40M",
    provider: "NASA, PDS Geosciences Node",
    url: "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/",
    body: "moon",
    params: ["slope_mean", "slope_max", "roughness"],
    terms: "Données NASA PDS, accès libre. Calculé comme pour la Terre (tools/precompute/lunar_reference.py).",
  },
  {
    id: "lro-diviner",
    name: "LRO Diviner (températures lunaires)",
    provider: "NASA / UCLA, Paige et al. 2010 (Science 330:479)",
    url: "https://www.diviner.ucla.edu/",
    body: "moon",
    params: ["lst_night"],
    terms: "Valeurs publiées citées dans data/reference/moon-south-pole.json.",
  },
];

const EARTH_SOURCE_BY_PARAM = new Map<ParamId, string>(
  SOURCES.filter((s) => s.body === "earth").flatMap((s) => s.params.map((p) => [p, s.id] as const)),
);

/** Source (id du catalogue) de chaque valeur connue. En mode fixtures, tout vient des données d'exemple. */
export function valueSources(values: ParamValues, useFixtures = false): Partial<Record<ParamId, string>> {
  const out: Partial<Record<ParamId, string>> = {};
  for (const [param, value] of Object.entries(values) as [ParamId, number | null | undefined][]) {
    if (typeof value !== "number") continue;
    out[param] = useFixtures && param !== "latitude_abs" ? "fixtures" : (EARTH_SOURCE_BY_PARAM.get(param) ?? "inconnue");
  }
  return out;
}
