import createClient from 'openapi-fetch'
import type { components, paths } from './generated/openapi'

export const parameterCatalog = [
  { id: 'slope_mean', label: 'Mean slope', unit: '°', earthMin: 0, earthMax: 45, source: 'Copernicus DEM', lunar: 'LOLA', help: 'Mean terrain incline within a 1 km window.' },
  { id: 'slope_max', label: 'Maximum slope', unit: '°', earthMin: 0, earthMax: 70, source: 'Copernicus DEM', lunar: 'LOLA', help: 'Steepest slope observed within a 1 km window.' },
  { id: 'roughness', label: 'Roughness', unit: 'm', earthMin: 0, earthMax: 200, source: 'Copernicus DEM', lunar: 'LOLA', help: 'Standard deviation of elevation around the site.' },
  { id: 'elevation', label: 'Elevation', unit: 'm', earthMin: -500, earthMax: 6000, source: 'Copernicus DEM', lunar: 'No direct equivalent', help: 'Elevation above mean sea level.' },
  { id: 'ndvi', label: 'Vegetation (NDVI)', unit: '', earthMin: 0, earthMax: 1, source: 'MODIS MOD13A1', lunar: 'No vegetation', help: 'Vegetation index: 0 is bare soil and 1 is dense vegetation.' },
  { id: 'lst_day', label: 'Surface temperature, day', unit: '°C', earthMin: -60, earthMax: 70, source: 'MODIS MOD11A2', lunar: 'Diviner', help: 'Temperature measured at the surface during the day.' },
  { id: 'lst_night', label: 'Surface temperature, night', unit: '°C', earthMin: -70, earthMax: 40, source: 'MODIS MOD11A2', lunar: 'Diviner', help: 'Temperature measured at the surface during the night.' },
  { id: 'lst_amplitude', label: 'Thermal amplitude', unit: '°C', earthMin: 0, earthMax: 60, source: 'MODIS MOD11A2', lunar: 'Diviner', help: 'Difference between day and night surface temperatures.' },
  { id: 't2m_mean', label: 'Mean air temperature', unit: '°C', earthMin: -40, earthMax: 35, source: 'NASA POWER', lunar: 'Lunar cold proxy', help: 'Mean air temperature at 2 m above the ground.' },
  { id: 't2m_min', label: 'Minimum air temperature', unit: '°C', earthMin: -60, earthMax: 25, source: 'NASA POWER', lunar: 'Lunar cold proxy', help: 'Mean of minimum air temperatures.' },
  { id: 't2m_max', label: 'Maximum air temperature', unit: '°C', earthMin: -20, earthMax: 50, source: 'NASA POWER', lunar: 'No atmosphere', help: 'Mean of maximum air temperatures.' },
  { id: 'wind', label: 'Wind', unit: 'm/s', earthMin: 0, earthMax: 15, source: 'NASA POWER', lunar: '0 m/s — no atmosphere', help: 'Mean wind speed at 2 m above the ground.' },
  { id: 'humidity', label: 'Humidity', unit: '%', earthMin: 0, earthMax: 100, source: 'NASA POWER', lunar: '0% — no atmosphere', help: 'Relative humidity at 2 m above the ground.' },
  { id: 'precipitation', label: 'Precipitation', unit: 'mm/day', earthMin: 0, earthMax: 10, source: 'NASA POWER', lunar: '0 mm/day — no atmosphere', help: 'Mean daily rain and snowfall.' },
  { id: 'solar', label: 'Solar exposure', unit: 'kWh/m²/day', earthMin: 0, earthMax: 8, source: 'NASA POWER', lunar: 'Near-continuous illumination on some peaks', help: 'Solar energy received per day.' },
  { id: 'latitude_abs', label: 'Absolute latitude', unit: '°', earthMin: 0, earthMax: 90, source: 'Site coordinates', lunar: '84 to 90° — polar regions', help: 'Angular distance of the site from the equator.' },
  { id: 'quake_count', label: 'Earthquakes (since 2000)', unit: '', earthMin: 0, earthMax: 2000, source: 'USGS Earthquake Catalog', lunar: 'Weak moonquakes', help: 'Number of magnitude ≥ 2.5 earthquakes within a 300 km radius.' },
  { id: 'volcano_distance', label: 'Distance to volcano', unit: 'km', earthMin: 0, earthMax: 3000, source: 'Smithsonian GVP', lunar: 'Basaltic maria and lava tubes', help: 'Distance to the nearest Holocene volcano.' },
] as const

export type ParameterCatalogItem = (typeof parameterCatalog)[number]

export interface MoonParameterReference {
  min?: number
  max?: number
  unit?: string
  source?: string
}

export interface MoonReference {
  id?: string
  name?: string
  params?: Partial<Record<ParamId, MoonParameterReference>>
}

export type ParamId = components['schemas']['ParamId']
export type ModeId = components['schemas']['ModeId']
export type SiteRole = components['schemas']['AnalyzedSite']['role']
export type Verdict = components['schemas']['Verdict']
export type CalibrationInstrument =
  | 'drill'
  | 'wind'
  | 'gas'
  | 'seismograph'
  | 'thermal'

export const calibrationInstruments: {
  id: CalibrationInstrument
  label: string
}[] = [
  { id: 'drill', label: 'Drilling' },
  { id: 'wind', label: 'Wind' },
  { id: 'gas', label: 'Gas' },
  { id: 'seismograph', label: 'Seismograph' },
  { id: 'thermal', label: 'Thermal' },
]

export type Criterion = components['schemas']['Criterion']

export const calibrationCriteria: Criterion[] = [
  { param: 't2m_mean', max: 0, tolerance: 10, weight: 2, group: 'drill' },
  { param: 'volcano_distance', max: 50, tolerance: 100, weight: 1, group: 'drill' },
  { param: 'wind', max: 3, tolerance: 3, weight: 2, group: 'wind' },
  { param: 'humidity', max: 40, tolerance: 30, weight: 2, group: 'gas' },
  { param: 'precipitation', max: 0.5, tolerance: 1, weight: 1, group: 'gas' },
  { param: 'quake_count', max: 5, tolerance: 20, weight: 3, group: 'seismograph' },
  { param: 'lst_amplitude', min: 25, tolerance: 15, weight: 2, group: 'thermal' },
  { param: 't2m_min', max: -30, tolerance: 20, weight: 1, group: 'thermal' },
]

export type CriterionScore = components['schemas']['CriterionScore']
export type SiteResult = components['schemas']['AnalyzedSite']

export interface SiteView extends Omit<SiteResult, 'total'> {
  total: number | null
  values?: Partial<Record<ParamId, number | null>>
}

export type AnalysisResponse = components['schemas']['AnalyzeResponse']
export type SiteDetail = components['schemas']['SiteDetail']

export interface FixtureSite {
  id: string
  name: string
  lat: number
  lon: number
  terrain: string
  role: SiteRole
  values: Partial<Record<ParamId, number | null>>
}

type AnalyzeRequest = components['schemas']['AnalyzeRequest']

function getApiUrl() {
  return (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(
    /\/+$/,
    '',
  )
}

const apiClient = createClient<paths>({ baseUrl: getApiUrl() })

function throwApiError(
  response: Response,
  error: components['schemas']['Error'] | undefined,
): never {
  const details = error?.error
  throw new Error(
    `The API returned ${response.status}${details ? `: ${details}` : ''}`,
  )
}

export async function analyzeSites(request: AnalyzeRequest) {
  const result = await apiClient.POST('/api/analyze', { body: request })
  if (result.error) {
    throwApiError(result.response, result.error)
  }
  if (!result.data) {
    throw new Error('The API returned an empty analysis response.')
  }
  return result.data
}

export async function getSiteDetails(
  siteId: string,
  signal: AbortSignal,
  mode?: ModeId,
) {
  const result = await apiClient.GET('/api/sites/{id}', {
    params: {
      path: { id: siteId },
      query: mode ? { mode } : undefined,
    },
    signal,
  })
  if (result.error) {
    throwApiError(result.response, result.error)
  }
  if (!result.data) {
    throw new Error('The API returned an empty site record.')
  }
  return result.data
}

export async function getParameters(signal?: AbortSignal) {
  const result = await apiClient.GET('/api/parameters', { signal })
  if (!result.response.ok) {
    throw new Error(`The API returned ${result.response.status} for the parameter catalog.`)
  }
  if (!result.data) {
    throw new Error('The API returned an empty parameter catalog.')
  }
  return result.data.parameters
}

export async function getMoonReference(signal?: AbortSignal): Promise<MoonReference> {
  const result = await apiClient.GET('/api/reference/moon', { signal })
  if (result.error) {
    throwApiError(result.response, result.error)
  }
  if (!result.data || typeof result.data !== 'object') {
    throw new Error('The API returned an invalid lunar reference.')
  }
  return result.data as MoonReference
}
