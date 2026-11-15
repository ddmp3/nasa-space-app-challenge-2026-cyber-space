import type { components } from './api-schema'
import { FR_MOON_NOTES, FR_PARAMS } from './content-fr'
import type { Lang } from './i18n'

// Plain-language help for each parameter (what it measures, and what it means for the Moon).
export const parameterCatalog = [
  { id: 'slope_mean', unit: '°', label: 'Mean slope',
    help: 'Average tilt of the ground over 1 km. At the lunar south pole, half of the 1 km areas have a mean slope between 5 and 13° (LOLA).' },
  { id: 'slope_max', unit: '°', label: 'Maximum slope',
    help: 'Steepest slope over 1 km: it tells whether a rover can get through. Lunar rovers handle 15 to 25°.' },
  { id: 'roughness', unit: 'm', label: 'Roughness',
    help: 'How much elevation varies over 1 km: rough ground is broken and cratered.' },
  { id: 'elevation', unit: 'm', label: 'Elevation',
    help: 'Height of the site above sea level.' },
  { id: 'ndvi', unit: '', label: 'Vegetation (NDVI)',
    help: 'Vegetation index measured from orbit. Above 0.2 there are plants: the site does not look like the Moon.' },
  { id: 'lst_day', unit: '°C', label: 'Surface temperature, day',
    help: 'Ground temperature during the day, seen from orbit (annual mean).' },
  { id: 'lst_night', unit: '°C', label: 'Surface temperature, night',
    help: 'Ground temperature at night. On the Moon, shadowed craters drop to -240 °C: no Earth site comes close.' },
  { id: 'lst_amplitude', unit: '°C', label: 'Day-night swing',
    help: 'Gap between day and night. On the Moon it reaches about 300 °C; on Earth, deserts give a small taste of it.' },
  { id: 't2m_mean', unit: '°C', label: 'Mean air temperature',
    help: 'Average air temperature: a very cold site has frozen ground, comparable to icy lunar soil.' },
  { id: 't2m_min', unit: '°C', label: 'Minimum air temperature',
    help: 'Coldest temperature of the year: useful to cold-test hardware.' },
  { id: 't2m_max', unit: '°C', label: 'Maximum air temperature',
    help: 'Warmest temperature of the year.' },
  { id: 'wind', unit: 'm/s', label: 'Wind',
    help: 'Average wind speed. The Moon has no atmosphere, so no wind: a calm site is closer to it.' },
  { id: 'humidity', unit: '%', label: 'Humidity',
    help: 'Moisture in the air. The Moon has none: dry air is closer to it.' },
  { id: 'precipitation', unit: 'mm/day', label: 'Precipitation',
    help: 'Rain or snow per day. Dry, loose ground is closer to lunar regolith.' },
  { id: 'solar', unit: 'kWh/m²/day', label: 'Solar energy',
    help: 'Solar energy received per day: useful to power a base.' },
  { id: 'latitude_abs', unit: '°', label: 'Absolute latitude',
    help: 'Distance from the equator. Near the poles the Sun stays low on the horizon, as at the lunar south pole.' },
  { id: 'quake_count', unit: '', label: 'Earthquakes (since 2000)',
    help: 'Number of magnitude 2.5+ earthquakes within 300 km since 2000. The Moon is seismically very quiet.' },
  { id: 'volcano_distance', unit: 'km', label: 'Distance to a volcano',
    help: 'Distance to the nearest recent volcano: volcanic rock (basalt) stands in for lunar ground.' },
] as const

// Types generated from apps/api/openapi.yaml: run `npm run generate:api` after every contract change.
type Schemas = components['schemas']

export type ParamId = Schemas['ParamId']
export type ModeId = Schemas['ModeId']
export type SiteRole = Schemas['AnalyzedSite']['role']
export type Verdict = Schemas['Verdict']
export type Criterion = Schemas['Criterion']
export type CriterionScore = Schemas['CriterionScore']
export type SiteResult = Schemas['AnalyzedSite']
export type AnalysisResponse = Schemas['AnalyzeResponse']
export type SiteDetail = Schemas['SiteDetail']
export type MoonValue = Schemas['MoonValue']
export type DataSource = Schemas['DataSource']
export type Mode = Schemas['Mode']

// The displayed catalog must cover exactly the contract's ParamId values.
const catalogCoversContract: ParamId extends (typeof parameterCatalog)[number]['id'] ? true : false = true
void catalogCoversContract

/** What the parameter means on the Moon when the profile has no numeric range (proxy or sourced context). */
const MOON_NOTES: Partial<Record<ParamId, string>> = {
  t2m_mean: 'No air on the Moon: proxy for frozen ground',
  t2m_min: 'No air: proxy for extreme cold (29–50 K in shadow)',
  t2m_max: 'No air on the Moon',
  lst_day: 'Sunlit ridges: not sourced yet',
  lst_amplitude: 'About 300 K at the equator (Diviner)',
  solar: 'Near-continuous sunlight on some polar ridges',
  quake_count: '28 shallow moonquakes in 8 years (Apollo)',
  volcano_distance: 'No recent volcanism: basalt is an Earth stand-in',
  elevation: 'Not comparable',
}

/** Label, unit and help text of a parameter. */
export function paramInfo(id: string, lang: Lang = 'en'): { label: string; unit: string; help: string } {
  const p = parameterCatalog.find((item) => item.id === id)
  if (!p) return { label: id, unit: '', help: '' }
  const fr = lang === 'fr' ? FR_PARAMS[id] : undefined
  return fr ? { label: fr.label, unit: fr.unit ?? p.unit, help: fr.help } : { label: p.label, unit: p.unit, help: p.help }
}

/** Lunar meaning of a parameter without a numeric lunar range, in the interface language. */
export function moonNote(id: ParamId, lang: Lang = 'en'): string | undefined {
  return (lang === 'fr' ? FR_MOON_NOTES[id] : undefined) ?? MOON_NOTES[id]
}

export type CalibrationInstrument = 'drill' | 'wind' | 'gas' | 'seismograph' | 'thermal'
export const calibrationInstruments: CalibrationInstrument[] = ['drill', 'wind', 'gas', 'seismograph', 'thermal']

function getApiUrl() {
  return (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/+$/, '')
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    let detail = ''
    try {
      detail = ((await response.json()) as { error?: string }).error ?? ''
    } catch {
      // non-JSON body: keep the HTTP status
    }
    throw new Error(`HTTP ${response.status}${detail ? ` · ${detail}` : ''}`)
  }
  return (await response.json()) as T
}

export async function analyzeSites(
  request: { mode: ModeId; bareSoilOnly?: boolean } | { criteria: Criterion[]; bareSoilOnly?: boolean },
): Promise<AnalysisResponse> {
  return requestJson<AnalysisResponse>(`${getApiUrl()}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
}

export async function getSiteDetails(siteId: string, signal: AbortSignal): Promise<SiteDetail> {
  return requestJson<SiteDetail>(`${getApiUrl()}/api/sites/${encodeURIComponent(siteId)}`, { signal })
}

/** Criteria of a predefined mode, as the API applies them (single source: apps/api/src/scoring/modes.ts). */
export async function getModeCriteria(mode: ModeId): Promise<Criterion[]> {
  const { modes } = await requestJson<{ modes: Mode[] }>(`${getApiUrl()}/api/modes`)
  const found = modes.find((m) => m.id === mode)
  if (!found) throw new Error(`Unknown mode: ${mode}`)
  return found.criteria
}

export async function getSources(): Promise<DataSource[]> {
  return (await requestJson<{ sources: DataSource[] }>(`${getApiUrl()}/api/sources`)).sources
}

/** Limits of Earth as an analog (data/reference/moon-south-pole.json, earth_limits field). */
export interface EarthLimit {
  id: string
  label: string
  moon: string
  earth: string
  effect: string
  source: string
}

export async function getEarthLimits(): Promise<EarthLimit[]> {
  const reference = await requestJson<{ earth_limits?: EarthLimit[] }>(`${getApiUrl()}/api/reference/moon`)
  return Array.isArray(reference.earth_limits) ? reference.earth_limits : []
}

/** Precomputed images of each site and its lunar twin (tools/precompute/site_visuals.py). */
export interface SiteVisual {
  photo?: { source: string; credit: string }
  earth: { slope_mean: number; slope_max: number | null; roughness: number; match_share: number }
  twin: { lat: number; lon: number; slope_mean: number; slope_max: number; roughness: number; distance: number; match_share: number }
}

export interface VisualManifest {
  extent_km: number
  pixel_m: number
  slope_band_deg: [number, number]
  moon_source: string
  earth_relief_source: string
  sites: Record<string, SiteVisual>
}

export async function getVisualManifest(): Promise<VisualManifest> {
  return requestJson<VisualManifest>(`${import.meta.env.BASE_URL}sites/manifest.json`)
}

export function siteImage(siteId: string, file: 'earth.jpg' | 'earth-relief.jpg' | 'earth-match.png' | 'moon-relief.jpg' | 'moon-match.png'): string {
  return `${import.meta.env.BASE_URL}sites/${siteId}/${file}`
}
