import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { latLngBounds } from 'leaflet'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import * as THREE from 'three'
import fixtureJson from '../../../data/fixtures/site-values.json'
import './App.css'
import {
  analyzeSites,
  calibrationCriteria,
  calibrationInstruments,
  getSiteDetails,
  getMoonReference,
  getParameters,
  type MoonReference,
  parameterCatalog,
  type CalibrationInstrument,
  type Criterion,
  type FixtureSite,
  type ModeId,
  type ParamId,
  type SiteDetail,
  type SiteResult,
  type SiteView,
} from './api'
import { useAppStore } from './store'

const modes: {
  id: ModeId | 'custom'
  number: string
  title: string
  description: string
}[] = [
  {
    id: 'robotics',
    number: '01',
    title: 'Robotics validation',
    description: 'Find terrain for rover mobility testing.',
  },
  {
    id: 'calibration',
    number: '02',
    title: 'Instrument calibration',
    description: 'Compare conditions for instrument calibration.',
  },
  {
    id: 'colony',
    number: '03',
    title: 'Self-sufficient colony',
    description: 'Explore conditions suitable for a lunar base.',
  },
  {
    id: 'custom',
    number: '04',
    title: 'Custom criteria',
    description: 'Build an analysis with your own criteria.',
  },
]

const fixtureSites = (fixtureJson as { sites: FixtureSite[] }).sites

type Language = 'fr' | 'en'

const translations = {
  fr: {
    'Workflow steps': 'Étapes du parcours',
    Mission: 'Mission',
    Parameters: 'Paramètres',
    Sites: 'Sites',
    Summary: 'Synthèse',
    'EARTH ↔ MOON EXPLORATION': 'EXPLORATION TERRE ↔ LUNE',
    'EARTH ANALOGUES': 'ANALOGUES TERRESTRES',
    'The Moon begins': 'La Lune commence',
    'here, on Earth.': 'ici, sur Terre.',
    'Compare Earth environments with lunar south-pole conditions and find the best test sites.':
      'Comparez des environnements terrestres aux conditions du pôle Sud lunaire et trouvez les meilleurs terrains d’essai.',
    'Choose a mission': 'Choisir une mission',
    'Analysis mode': 'Mode d’analyse',
    'Analysis in progress…': 'Analyse en cours…',
    'Run analysis': 'Lancer l’analyse',
    'Load local preview': 'Charger l’aperçu local',
    'Filter by instrument': 'Filtrer par instrument',
    'All instruments': 'Tous les instruments',
    "The score will be calculated using the selected instrument's criteria.":
      'Le score sera calculé sur les critères de l’instrument choisi.',
    'Exclude vegetated sites': 'Exclure les sites végétalisés',
    'Bare-soil filter (NDVI ≤ 0.1). Disable it to include these sites.':
      'Filtre sol nu (NDVI ≤ 0,1). Désactivez-le pour inclure ces sites.',
    'Your criteria': 'Vos critères',
    '+ Add': '+ Ajouter',
    Parameter: 'Paramètre',
    'Earth:': 'Terre :',
    Tolerance: 'Tolérance',
    Weight: 'Poids',
    'Remove criterion': 'Supprimer le critère',
    'Scores are calculated by the API. The local preview only shows raw development values.':
      'Les scores seront calculés par l’API. L’aperçu local affiche uniquement des valeurs brutes de développement.',
    'Documentation catalog:': 'Catalogue documentaire :',
    'Analysis results': 'Résultats de l’analyse',
    WAITING: 'EN ATTENTE',
    'Development preview — do not use for demos': 'Aperçu de développement — ne pas utiliser en démo',
    'Test values; no scores are calculated. Sites with NDVI above 0.1 are marked as excluded when the filter is active.':
      'Valeurs de test, aucun score calculé. Les sites au NDVI supérieur à 0,1 sont marqués comme exclus lorsque le filtre est actif.',
    'Your next destination starts with a question.': 'Votre prochaine destination commence par une question.',
    'Choose a mode, then run the analysis to rank sites.':
      'Choisissez un mode, puis lancez l’analyse pour classer les sites.',
    'OR LOAD THE LOCAL PREVIEW TO EXPLORE THE INTERFACE':
      'OU CHARGEZ L’APERÇU LOCAL POUR EXPLORER L’INTERFACE',
    'Unable to reach the analysis service': 'Impossible de joindre le service d’analyse',
    'Check that the API is running, or use the local preview.':
      'Vérifiez que l’API est lancée, ou utilisez l’aperçu local.',
    'PREVIEW SITES': 'SITES DE L’APERÇU',
    'RANKED SITES': 'SITES CLASSÉS',
    'Excluded: vegetation': 'Exclu : végétation',
    EXCLUDED: 'EXCLU',
    'SITE RECORD': 'FICHE DU SITE',
    'OVERALL SCORE': 'SCORE GLOBAL',
    'POSSIBLE USE': 'USAGE POSSIBLE',
    'Exclude from this analysis': 'À écarter de cette analyse',
    'Rover test terrain': 'Terrain d’essai pour rover',
    'Instrument calibration': 'Calibration d’instruments',
    'Lunar base study': 'Étude d’une base lunaire',
    'Evaluate against your criteria': 'À évaluer selon vos critères',
    'This site is excluded from the ranking because its vegetation index exceeds the allowed threshold.':
      'Ce site est exclu du classement parce que son indice de végétation dépasse le seuil autorisé.',
    'Sources queried': 'Sources interrogées',
    'Loading values and sources…': 'Chargement des valeurs et des sources…',
    'No raw values were returned for this site.': 'Aucune valeur brute n’a été renvoyée pour ce site.',
    'Detailed site record unavailable:': 'Fiche détaillée indisponible :',
    'High score': 'Score élevé',
    Explore: 'À explorer',
    'Low score': 'Score faible',
    'Development values; no scores are calculated.': 'Valeurs de test, aucun score calculé.',
    'Robotics validation': 'Validation robotique',
    'Find terrain for rover mobility testing.': 'Trouver un terrain pour tester la mobilité d’un rover.',
    'Compare conditions for instrument calibration.': 'Comparer des conditions pour calibrer des instruments.',
    'Self-sufficient colony': 'Colonie autosuffisante',
    'Explore conditions suitable for a lunar base.': 'Explorer les conditions utiles à une base lunaire.',
    'Custom criteria': 'Critères libres',
    'Build an analysis with your own criteria.': 'Composer une analyse avec vos propres critères.',
    'Known analogue': 'Analogue connu',
    'Candidate site': 'Site candidat',
    'Negative control': 'Témoin négatif',
    Matches: 'Correspond',
    'Partially matches': 'Correspond partiellement',
    'Does not match': 'Ne correspond pas',
    'Missing data': 'Donnée manquante',
    'Unavailable': 'Indisponible',
    'Not documented': 'Non documentée',
    Moon: 'Lune',
    Earth: 'Terre',
    'Shackleton crater': 'Cratère Shackleton',
    'Analogue sites': 'Sites analogues',
    Drilling: 'Forage',
    Wind: 'Vent',
    Gas: 'Gaz',
    Seismograph: 'Sismographe',
    Thermal: 'Thermique',
  },
  en: {},
} as const

function translate(language: Language, value: string) {
  return language === 'fr'
    ? (translations.fr[value as keyof typeof translations.fr] ?? value)
    : value
}

const siteNameTranslations: Record<string, Record<Language, string>> = {
  haughton: {
    fr: 'Cratère Haughton (île Devon)',
    en: 'Haughton Crater (Devon Island)',
  },
  atacama: {
    fr: "Désert d'Atacama",
    en: 'Atacama Desert',
  },
  amazonie: {
    fr: 'Amazonie (témoin négatif)',
    en: 'Amazon (negative control)',
  },
  tunnunik: {
    fr: 'Cratère Tunnunik (île Victoria, T.N.-O.)',
    en: 'Tunnunik Crater (Victoria Island, N.W.T.)',
  },
  pingualuit: {
    fr: 'Cratère des Pingualuit, rebord ouest (Nunavik, Québec)',
    en: 'Pingualuit Crater, west rim (Nunavik, Quebec)',
  },
  'peary-land': {
    fr: 'Terre de Peary (nord du Groenland)',
    en: 'Peary Land (northern Greenland)',
  },
  popigai: {
    fr: 'Cratère de Popigaï (Sibérie)',
    en: 'Popigai Crater (Siberia)',
  },
  elgygytgyn: {
    fr: "Cratère d'El'gygytgyn, rebord est (Tchoukotka)",
    en: "El'gygytgyn Crater, east rim (Chukotka)",
  },
  aorounga: {
    fr: "Cratère d'Aorounga (Tchad)",
    en: 'Aorounga Crater (Chad)',
  },
  tenoumer: {
    fr: 'Cratère de Tenoumer (Mauritanie)',
    en: 'Tenoumer Crater (Mauritania)',
  },
  'wolfe-creek': {
    fr: 'Cratère de Wolfe Creek (Australie)',
    en: 'Wolfe Creek Crater (Australia)',
  },
}

const parameterFrench: Record<string, { label: string; lunar: string; help: string }> = {
  slope_mean: { label: 'Pente moyenne', lunar: 'LOLA', help: 'Inclinaison moyenne du terrain dans une fenêtre de 1 km.' },
  slope_max: { label: 'Pente maximale', lunar: 'LOLA', help: 'Pente la plus forte observée dans une fenêtre de 1 km.' },
  roughness: { label: 'Rugosité', lunar: 'LOLA', help: 'Écart-type de l’altitude autour du site.' },
  elevation: { label: 'Altitude', lunar: 'Pas d’équivalent direct', help: 'Altitude au-dessus du niveau moyen de la mer.' },
  ndvi: { label: 'Végétation (NDVI)', lunar: 'Aucune végétation', help: 'Indice de végétation : 0 correspond au sol nu, 1 à une végétation dense.' },
  lst_day: { label: 'Température de surface, jour', lunar: 'Diviner', help: 'Température mesurée à la surface pendant le jour.' },
  lst_night: { label: 'Température de surface, nuit', lunar: 'Diviner', help: 'Température mesurée à la surface pendant la nuit.' },
  lst_amplitude: { label: 'Amplitude thermique', lunar: 'Diviner', help: 'Écart entre les températures de surface du jour et de la nuit.' },
  t2m_mean: { label: 'Température moyenne de l’air', lunar: 'Proxy du froid lunaire', help: 'Température moyenne de l’air à 2 m du sol.' },
  t2m_min: { label: 'Température minimale de l’air', lunar: 'Proxy du froid lunaire', help: 'Moyenne des températures minimales de l’air.' },
  t2m_max: { label: 'Température maximale de l’air', lunar: 'Pas d’atmosphère', help: 'Moyenne des températures maximales de l’air.' },
  wind: { label: 'Vent', lunar: '0 m/s — pas d’atmosphère', help: 'Vitesse moyenne du vent à 2 m du sol.' },
  humidity: { label: 'Humidité', lunar: '0 % — pas d’atmosphère', help: 'Humidité relative de l’air à 2 m.' },
  precipitation: { label: 'Précipitations', lunar: '0 mm/j — pas d’atmosphère', help: 'Pluie et neige moyennes quotidiennes.' },
  solar: { label: 'Ensoleillement', lunar: 'Éclairage quasi continu sur certaines crêtes', help: 'Énergie solaire reçue par jour.' },
  latitude_abs: { label: 'Latitude absolue', lunar: '84 à 90° — régions polaires', help: 'Distance angulaire du site par rapport à l’équateur.' },
  quake_count: { label: 'Séismes (depuis 2000)', lunar: 'Séismes lunaires faibles', help: 'Nombre de séismes de magnitude ≥ 2,5 dans un rayon de 300 km.' },
  volcano_distance: { label: 'Distance au volcan', lunar: 'Mers basaltiques et tubes de lave', help: 'Distance au volcan holocène le plus proche.' },
}

function localizedSiteName(site: Pick<SiteView, 'id' | 'name'>, language: Language) {
  return siteNameTranslations[site.id]?.[language] ?? site.name
}

type SiteDetailLoadState =
  | { siteId: string; detail: SiteDetail }
  | { siteId: string; error: string }

function MapResizeHandler() {
  const map = useMap()

  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 100)
    return () => window.clearTimeout(timer)
  }, [map])

  return null
}

function FitMapToSites({ sites }: { sites: SiteView[] }) {
  const map = useMap()

  useEffect(() => {
    if (sites.length === 0) return
    const bounds = latLngBounds(sites.map((site) => [site.lat, site.lon]))
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 5 })
  }, [map, sites])

  return null
}

function FocusMapSite({ site }: { site: SiteView | null }) {
  const map = useMap()

  useEffect(() => {
    if (!site) return
    map.setView([site.lat, site.lon], Math.max(map.getZoom(), 4), {
      animate: true,
    })
  }, [map, site])

  return null
}

function globePosition(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

function globeLabelSites(sites: SiteView[], selectedSite: SiteView | null) {
  const topSites = sites.filter((site) => !site.excluded).slice(0, 5)
  if (!selectedSite || selectedSite.excluded || topSites.some((site) => site.id === selectedSite.id)) {
    return topSites
  }
  return [...topSites, selectedSite]
}

function GlobeCanvas({
  type,
  sites = [],
  selectedSite = null,
  language,
  onSelectSite,
}: {
  type: 'moon' | 'earth'
  sites?: SiteView[]
  selectedSite?: SiteView | null
  language: Language
  onSelectSite?: (siteId: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const labelRefs = useRef(new Map<string, HTMLSpanElement>())

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
    camera.position.z = 3.25
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const group = new THREE.Group()
    group.rotation.order = 'YXZ'
    scene.add(group)
    const markerObjects: THREE.Object3D[] = []
    scene.add(new THREE.AmbientLight(0xffffff, type === 'earth' ? 0.65 : 0.8))
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4)
    keyLight.position.set(-3, 1.5, 4)
    scene.add(keyLight)

    const texture = new THREE.TextureLoader().load(
      type === 'earth'
        ? 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'
        : 'https://threejs.org/examples/textures/planets/moon_1024.jpg',
    )
    texture.colorSpace = THREE.SRGBColorSpace
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 64),
      new THREE.MeshPhongMaterial({
        map: texture,
        shininess: type === 'earth' ? 14 : 3,
        specular: type === 'earth' ? 0x223344 : 0x111111,
      }),
    )
    group.add(planet)

    if (type === 'earth') {
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.08, 64, 48),
        new THREE.MeshBasicMaterial({
          color: 0x2d9fe8,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
        }),
      )
      scene.add(atmosphere)
      sites.forEach((site) => {
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(site.id === selectedSite?.id ? 0.044 : 0.026, 14, 10),
          new THREE.MeshBasicMaterial({
            color: scoreColor(site.total, site.role, Boolean(site.excluded)),
          }),
        )
        marker.position.copy(globePosition(site.lat, site.lon, 1.015))
        marker.userData.siteId = site.id
        group.add(marker)
        markerObjects.push(marker)
      })
    }

    if (selectedSite) {
      const selectedPosition = globePosition(selectedSite.lat, selectedSite.lon, 1)
      group.quaternion.setFromUnitVectors(
        selectedPosition.normalize(),
        new THREE.Vector3(0, 0, 1),
      )
    }

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let dragging = false
    let hasInteracted = false
    let moved = false
    let lastX = 0
    let lastY = 0

    const updatePointer = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    }

    const pointerDown = (event: PointerEvent) => {
      dragging = true
      hasInteracted = true
      moved = false
      lastX = event.clientX
      lastY = event.clientY
      renderer.domElement.setPointerCapture(event.pointerId)
    }

    const pointerMove = (event: PointerEvent) => {
      if (!dragging) return
      const deltaX = event.clientX - lastX
      const deltaY = event.clientY - lastY
      if (Math.abs(deltaX) + Math.abs(deltaY) > 2) moved = true
      group.rotation.y += deltaX * 0.008
      group.rotation.x += deltaY * 0.008
      lastX = event.clientX
      lastY = event.clientY
    }

    const pointerUp = (event: PointerEvent) => {
      if (!moved && onSelectSite && type === 'earth') {
        updatePointer(event)
        raycaster.setFromCamera(pointer, camera)
        const hit = raycaster.intersectObjects(markerObjects, false)[0]
        if (hit) onSelectSite(hit.object.userData.siteId as string)
      }
      dragging = false
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId)
      }
    }

    renderer.domElement.addEventListener('pointerdown', pointerDown)
    renderer.domElement.addEventListener('pointermove', pointerMove)
    renderer.domElement.addEventListener('pointerup', pointerUp)

    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let animationFrame = 0
    const animate = () => {
      if (type === 'earth' && !hasInteracted && !reducedMotion) {
        group.rotation.y += 0.0012
      }
      group.updateMatrixWorld(true)
      camera.updateMatrixWorld(true)
      globeLabelSites(sites, selectedSite).forEach((site) => {
        const label = labelRefs.current.get(site.id)
        if (!label) return
        const worldPosition = globePosition(site.lat, site.lon, 1.015)
          .applyMatrix4(group.matrixWorld)
        const projected = worldPosition.clone().project(camera)
        const surfaceNormal = worldPosition.clone().normalize()
        const viewDirection = camera.position.clone().sub(worldPosition).normalize()
        const visible =
          surfaceNormal.dot(viewDirection) > 0 &&
          projected.z > -1 &&
          projected.z < 1 &&
          projected.x > -1 &&
          projected.x < 1 &&
          projected.y > -1 &&
          projected.y < 1
        label.hidden = !visible
        if (visible) {
          label.style.left = `${(projected.x * 0.5 + 0.5) * 100}%`
          label.style.top = `${(-projected.y * 0.5 + 0.5) * 100}%`
        }
      })
      renderer.render(scene, camera)
      animationFrame = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(animationFrame)
      observer.disconnect()
      texture.dispose()
      planet.geometry.dispose()
      planet.material.dispose()
      renderer.domElement.removeEventListener('pointerdown', pointerDown)
      renderer.domElement.removeEventListener('pointermove', pointerMove)
      renderer.domElement.removeEventListener('pointerup', pointerUp)
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [language, onSelectSite, selectedSite, sites, type])

  return (
    <div className={`globe-canvas globe-${type}`} ref={containerRef}>
      {type === 'earth' &&
        globeLabelSites(sites, selectedSite).map((site) => (
          <span
            className={`globe-follow-tag ${site.id === selectedSite?.id ? 'is-selected' : ''}`}
            key={site.id}
            onClick={() => onSelectSite?.(site.id)}
            ref={(element) => {
              if (element) labelRefs.current.set(site.id, element)
              else labelRefs.current.delete(site.id)
            }}
            role="button"
            style={{
              '--tag-color': site.id === selectedSite?.id
                ? 'var(--scenario-accent)'
                : scoreColor(site.total, site.role),
            } as CSSProperties}
            tabIndex={0}
          >
            {localizedSiteName(site, language)}
            {site.total !== null ? ` · ${Math.round(site.total)}` : ''}
          </span>
        ))}
    </div>
  )
}

function PlanetScene({
  sites,
  selectedSiteId,
  language,
  onSelectSite,
}: {
  sites: SiteView[]
  selectedSiteId: string | null
  language: Language
  onSelectSite: (siteId: string) => void
}) {
  const highlightedSites = sites.filter((site) => !site.excluded).slice(0, 3)
  const selectedSite = sites.find((site) => site.id === selectedSiteId) ?? null

  return (
    <section className="planet-scene" aria-label={language === 'fr' ? 'Comparaison visuelle Terre-Lune' : 'Earth-Moon visual comparison'}>
      <div className="planet-panel moon-panel">
        <div className="planet-label">
          <strong>{translate(language, 'Moon')}</strong>
          <span>{translate(language, 'Shackleton crater')}</span>
        </div>
        <GlobeCanvas language={language} type="moon" />
        <span className="planet-tag moon-tag">{translate(language, 'Shackleton crater')}</span>
      </div>
      <div className="planet-panel earth-panel">
        <div className="planet-label">
          <strong>{translate(language, 'Earth')}</strong>
          <span>{highlightedSites[0] ? localizedSiteName(highlightedSites[0], language) : translate(language, 'Analogue sites')}</span>
        </div>
        <GlobeCanvas
          onSelectSite={onSelectSite}
          selectedSite={selectedSite}
          sites={sites}
          language={language}
          type="earth"
        />
        <span className="globe-hint">Drag to rotate · 360°</span>
      </div>
    </section>
  )
}

function RadarChart({
  site,
  moonReference,
  parameterInfo,
  language,
}: {
  site: SiteView
  moonReference: MoonReference | null
  parameterInfo: (paramId: ParamId | string) => {
    label: string
    earthMin: number
    earthMax: number
  }
  language: Language
}) {
  const rows = site.criteria.slice(0, 8)
  if (rows.length < 3) return null
  const center = 120
  const radius = 78
  const point = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (index / rows.length) * Math.PI * 2
    return {
      x: center + Math.cos(angle) * radius * value,
      y: center + Math.sin(angle) * radius * value,
    }
  }
  const earthPoints = rows.map((row, index) => {
    const parameter = parameterInfo(row.param)
    const value = parameter.earthMax === parameter.earthMin
      ? 0
      : Math.max(0, Math.min(1, ((row.value ?? parameter.earthMin) - parameter.earthMin) / (parameter.earthMax - parameter.earthMin)))
    const p = point(index, value)
    return `${p.x},${p.y}`
  }).join(' ')
  const lunarPoints = rows.map((row, index) => {
    const parameter = parameterInfo(row.param)
    const lunar = moonReference?.params?.[row.param]
    const value = lunar?.min !== undefined && lunar.max !== undefined
      ? ((lunar.min + lunar.max) / 2 - parameter.earthMin) / (parameter.earthMax - parameter.earthMin)
      : 0.5
    const p = point(index, Math.max(0, Math.min(1, value)))
    return `${p.x},${p.y}`
  }).join(' ')

  return (
    <div className="radar-card">
      <div className="radar-heading">
        <strong>{language === 'fr' ? 'Signature du site' : 'Site signature'}</strong>
        <span>{language === 'fr' ? 'comparée au profil lunaire' : 'compared with the lunar profile'}</span>
      </div>
      <div className="radar-layout">
        <svg aria-label={language === 'fr' ? 'Radar Terre contre Lune' : 'Earth versus Moon radar'} className="radar-chart" viewBox="0 0 240 240" role="img">
          {[0.33, 0.66, 1].map((scale) => (
            <polygon
              fill="none"
              key={scale}
              points={rows.map((_, index) => {
                const p = point(index, scale)
                return `${p.x},${p.y}`
              }).join(' ')}
              stroke="rgba(170, 190, 220, 0.22)"
            />
          ))}
          <polygon className="radar-lunar" points={lunarPoints} />
          <polygon className="radar-earth" points={earthPoints} />
          {rows.map((row, index) => {
            const p = point(index, 1)
            return <line key={row.param} x1={center} x2={p.x} y1={center} y2={p.y} />
          })}
        </svg>
        <div className="radar-legend">
          <span><i className="radar-swatch earth" /> {language === 'fr' ? 'Terre' : 'Earth'}</span>
          <span><i className="radar-swatch moon" /> {language === 'fr' ? 'Référence lunaire' : 'Lunar reference'}</span>
          {rows.map((row) => <small key={row.param}>{parameterInfo(row.param).label}</small>)}
        </div>
      </div>
    </div>
  )
}

function TwinImagery({
  site,
  language,
}: {
  site: SiteView
  language: Language
}) {
  const earthZoom = 5
  const earthN = 2 ** earthZoom
  const earthLat = Math.max(-85, Math.min(85, site.lat)) * Math.PI / 180
  const earthX = Math.max(0, Math.min(earthN - 1, Math.floor((site.lon + 180) / 360 * earthN)))
  const earthY = Math.max(0, Math.min(earthN - 1, Math.floor((1 - Math.log(Math.tan(earthLat) + 1 / Math.cos(earthLat)) / Math.PI) / 2 * earthN)))
  const earthTile = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${earthZoom}/${earthY}/${earthX}`
  const moonX = Math.max(0, Math.min(63, Math.floor((site.lon + 180) / 360 * 64)))
  const moonY = Math.max(0, Math.min(31, Math.floor((90 - site.lat) / 180 * 32)))
  const moonTile = `https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/5/${moonY}/${moonX}.jpg`
  return (
    <div className="twin-imagery">
      <div>
        <img alt={`${site.name} ${language === 'fr' ? 'imagerie terrestre' : 'Earth imagery'}`} src={earthTile} />
        <span>{language === 'fr' ? 'Terre · imagerie satellite' : 'Earth · satellite imagery'}</span>
      </div>
      <div>
        <img alt={language === 'fr' ? 'Région polaire lunaire de référence' : 'Reference lunar polar region'} src={moonTile} />
        <span>{language === 'fr' ? 'Lune · région polaire de référence' : 'Moon · reference polar region'}</span>
      </div>
    </div>
  )
}

function scoreColor(
  total: number | null,
  role: SiteResult['role'],
  excluded = false,
) {
  if (excluded) return '#a0a5b3'
  if (total !== null) {
    if (total >= 70) return '#9cf26b'
    if (total >= 40) return '#f4c95d'
    return '#fa786e'
  }
  if (role === 'negative') return '#fa786e'
  if (role === 'candidate') return '#f4c95d'
  return '#7b91ff'
}

function formatValue(value: number | null | undefined, unit = '', language: Language = 'en') {
  if (value === null || value === undefined) return translate(language, 'Unavailable')
  const formatted = value.toLocaleString('fr-CA', { maximumFractionDigits: 2 })
  return unit ? `${formatted} ${unit}` : formatted
}

function formatRange(
  min: number | undefined,
  max: number | undefined,
  unit = '',
  language: Language = 'en',
) {
  if (min !== undefined && max !== undefined) {
    return `${formatValue(min, unit, language)} ${language === 'fr' ? 'à' : 'to'} ${formatValue(max, unit, language)}`
  }
  if (min !== undefined) return `≥ ${formatValue(min, unit, language)}`
  if (max !== undefined) return `≤ ${formatValue(max, unit, language)}`
  return translate(language, 'Not documented')
}

function roleLabel(role: SiteResult['role'], language: Language = 'en') {
  if (role === 'negative') return translate(language, 'Negative control')
  if (role === 'candidate') return translate(language, 'Candidate site')
  return translate(language, 'Known analogue')
}

function verdictLabel(
  verdict: SiteResult['criteria'][number]['verdict'],
  language: Language = 'en',
) {
  if (verdict === 'match') return translate(language, 'Matches')
  if (verdict === 'partial') return translate(language, 'Partially matches')
  if (verdict === 'mismatch') return translate(language, 'Does not match')
  return translate(language, 'Missing data')
}

/** Number of criteria with a known value. */
function evaluatedCount(site: SiteView) {
  return site.criteria.filter((criterion) => criterion.verdict !== 'missing').length
}

function hasMissingCriteria(site: SiteView) {
  return site.criteria.length > 0 && evaluatedCount(site) < site.criteria.length
}

function coverageLabel(site: SiteView) {
  if (site.criteria.length === 0) return ''
  return ` · ${evaluatedCount(site)}/${site.criteria.length} criteria`
}

/** Source names returned by GET /api/sites/{id}. */
function sourceNames(sources: unknown): string[] {
  return Array.isArray(sources)
    ? sources.filter((source): source is string => typeof source === 'string')
    : []
}

function toFixtureResult(site: FixtureSite): SiteView {
  return {
    id: site.id,
    name: site.name,
    lat: site.lat,
    lon: site.lon,
    role: site.role,
    total: null,
    criteria: [],
    ...(typeof site.values.ndvi === 'number' && site.values.ndvi > 0.1
      ? { excluded: 'vegetation' as const }
      : {}),
    values: site.values,
  }
}

function App() {
  const [language, setLanguage] = useState<Language>(() => {
    const stored = window.localStorage.getItem('cyberspace-language')
    return stored === 'fr' ? 'fr' : 'en'
  })
  const selectedMode = useAppStore((state) => state.selectedMode)
  const criteriaDraft = useAppStore((state) => state.criteriaDraft)
  const bareSoilOnly = useAppStore((state) => state.bareSoilOnly)
  const calibrationInstrument = useAppStore((state) => state.calibrationInstrument)
  const setSelectedMode = useAppStore((state) => state.setSelectedMode)
  const setBareSoilOnly = useAppStore((state) => state.setBareSoilOnly)
  const setCalibrationInstrument = useAppStore((state) => state.setCalibrationInstrument)
  const updateCriterion = useAppStore((state) => state.updateCriterion)
  const addCriterion = useAppStore((state) => state.addCriterion)
  const removeCriterion = useAppStore((state) => state.removeCriterion)
  const [sites, setSites] = useState<SiteView[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [isPreview, setIsPreview] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [siteDetailState, setSiteDetailState] = useState<SiteDetailLoadState | null>(null)
  const [moonReference, setMoonReference] = useState<MoonReference | null>(null)
  const [apiParameters, setApiParameters] = useState<
    Awaited<ReturnType<typeof getParameters>>
  >([])
  const [catalogError, setCatalogError] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.lang = language
    window.localStorage.setItem('cyberspace-language', language)
  }, [language])

  function parameterInfo(paramId: ParamId | string) {
    const local = parameterCatalog.find((parameter) => parameter.id === paramId) ?? parameterCatalog[0]
    const remote = apiParameters.find((parameter) => parameter.id === paramId)
    const french = language === 'fr' ? parameterFrench[paramId] : undefined
    return {
      ...local,
      label: remote?.label ?? local.label,
      unit: remote?.unit ?? local.unit,
      source: remote?.source ?? local.source,
      lunar: remote?.lunar ?? local.lunar,
      ...(french ? { label: french.label, lunar: french.lunar, help: french.help } : {}),
    }
  }

  const selectedSite = sites.find((site) => site.id === selectedSiteId) ?? null
  const selectedModeDetails = modes.find((mode) => mode.id === selectedMode)
  const selectedSiteDetailState =
    siteDetailState?.siteId === selectedSiteId ? siteDetailState : null
  const siteDetail =
    selectedSiteDetailState && 'detail' in selectedSiteDetailState
      ? selectedSiteDetailState.detail
      : null
  const detailError =
    selectedSiteDetailState && 'error' in selectedSiteDetailState
      ? selectedSiteDetailState.error
      : null
  const detailLoading =
    !isPreview && selectedSiteId !== null && selectedSiteDetailState === null

  const rankedSites = useMemo(
    () =>
      [...sites].sort((a, b) => {
        if (a.excluded && !b.excluded) return 1
        if (!a.excluded && b.excluded) return -1
        if (a.total === null && b.total === null) return 0
        if (a.total === null) return 1
        if (b.total === null) return -1
        return b.total - a.total
      }),
    [sites],
  )
  const mapSites = useMemo(() => {
    return rankedSites.filter((site) => !site.excluded)
  }, [rankedSites])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([getParameters(controller.signal), getMoonReference(controller.signal)])
      .then(([parameters, reference]) => {
        setApiParameters(parameters)
        setMoonReference(reference)
      })
      .catch((catalogRequestError: unknown) => {
        if (!controller.signal.aborted) {
          setCatalogError(
            catalogRequestError instanceof Error
              ? catalogRequestError.message
              : 'The documentation catalog is unavailable.',
          )
        }
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (isPreview || !selectedSiteId) return

    const controller = new AbortController()

    getSiteDetails(
      selectedSiteId,
      controller.signal,
      selectedMode === 'custom' ? undefined : selectedMode,
    )
      .then((detail) => setSiteDetailState({ siteId: selectedSiteId, detail }))
      .catch((detailRequestError: unknown) => {
        if (!controller.signal.aborted) {
          setSiteDetailState({
            siteId: selectedSiteId,
            error:
              detailRequestError instanceof Error
                ? detailRequestError.message
                : 'Unable to load the site record.',
          })
        }
      })

    return () => controller.abort()
  }, [isPreview, selectedMode, selectedSiteId])

  function buildCustomCriteria(): Criterion[] {
    const seenParams = new Set<ParamId>()
    return criteriaDraft.map((draft, index) => {
      if (seenParams.has(draft.param)) {
        throw new Error(`Parameter "${draft.param}" is selected more than once.`)
      }
      seenParams.add(draft.param)

      const min = draft.min.trim() === '' ? undefined : Number(draft.min)
      const max = draft.max.trim() === '' ? undefined : Number(draft.max)
      const tolerance = Number(draft.tolerance)
      const weight = Number(draft.weight)

      if (
        (min !== undefined && !Number.isFinite(min)) ||
        (max !== undefined && !Number.isFinite(max)) ||
        !Number.isFinite(tolerance) ||
        !Number.isFinite(weight)
      ) {
        throw new Error(`Check the values for criterion ${index + 1}.`)
      }
      if (min === undefined && max === undefined) {
        throw new Error(`Add a minimum or maximum bound to criterion ${index + 1}.`)
      }
      if (min !== undefined && max !== undefined && min > max) {
        throw new Error(`The minimum bound exceeds the maximum bound for criterion ${index + 1}.`)
      }
      if (tolerance < 0 || weight <= 0) {
        throw new Error(`Tolerance must be non-negative and weight must be greater than 0 (criterion ${index + 1}).`)
      }

      return { param: draft.param, min, max, tolerance, weight }
    })
  }

  async function handleAnalyze() {
    setError(null)
    setSites([])
    setSelectedSiteId(null)
    setSiteDetailState(null)
    setIsPreview(false)
    setIsLoading(true)

    try {
      const request =
        selectedMode === 'custom'
          ? { criteria: buildCustomCriteria(), bareSoilOnly }
          : selectedMode === 'calibration' && calibrationInstrument !== 'all'
            ? {
              criteria: calibrationCriteria
                .filter((criterion) => criterion.group === calibrationInstrument)
                .map(({ group: _group, ...criterion }) => criterion),
                bareSoilOnly,
              }
            : { mode: selectedMode, bareSoilOnly }
      const response = await analyzeSites(request)
      setSites(response.sites)
      setSelectedSiteId(response.sites[0]?.id ?? null)
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : 'An unknown error occurred during analysis.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (selectedMode !== 'custom' || isPreview || sites.length === 0) return
    const timer = window.setTimeout(() => {
      void handleAnalyze()
    }, 350)
    return () => window.clearTimeout(timer)
  // The analysis handler intentionally stays outside the dependency list: it is
  // recreated by React, while the effect should only react to criterion edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bareSoilOnly, criteriaDraft, isPreview, selectedMode])

  function showFixturePreview(
    bareSoilFilter = bareSoilOnly,
  ) {
    const previewSites = fixtureSites.map((site) => {
      const result = toFixtureResult(site)
      if (!bareSoilFilter) return { ...result, excluded: undefined }
      return result
    })
    setSites(previewSites)
    setSelectedSiteId(previewSites[0]?.id ?? null)
    setIsPreview(true)
    setError(null)
  }

  function handleBareSoilToggle(enabled: boolean) {
    setBareSoilOnly(enabled)
    if (isPreview) {
      showFixturePreview(enabled)
      return
    }

    setSites([])
    setSelectedSiteId(null)
    setSiteDetailState(null)
    setError(null)
  }

  function handleCalibrationInstrumentChange(
    instrument: CalibrationInstrument | 'all',
  ) {
    setCalibrationInstrument(instrument)
    setSites([])
    setSelectedSiteId(null)
    setSiteDetailState(null)
    setIsPreview(false)
    setError(null)
  }

  return (
    <main className={`app-shell mode-${selectedMode}`}>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Cyber&Space Montreal, home">
          <span className="brand-mark" aria-hidden="true">🛰️</span>
          <span>
            <strong>CYBER&SPACE</strong>
            <small>MONTREAL · SPACE APPS 2026</small>
          </span>
        </a>
        <nav className="chapter-nav" aria-label={translate(language, 'Workflow steps')}>
          {['Mission', 'Parameters', 'Sites', 'Summary'].map((chapter, index) => {
            const chapterModes: Array<ModeId | 'custom'> = [
              'robotics',
              'calibration',
              'colony',
              'custom',
            ]
            const chapterMode = chapterModes[index]
            return (
              <button
                className={`chapter-step ${selectedMode === chapterMode ? 'is-current' : ''}`}
                key={chapter}
                onClick={() => {
                  setSelectedMode(chapterMode)
                  setSites([])
                  setSelectedSiteId(null)
                  setSiteDetailState(null)
                  setIsPreview(false)
                  setError(null)
                }}
                type="button"
              >
                <i>{String(index + 1).padStart(2, '0')}</i>
                <span>{translate(language, chapter)}</span>
              </button>
            )
          })}
        </nav>
        <div className="topbar-status">
          <span className="status-dot" />
          <span>{translate(language, 'EARTH ↔ MOON EXPLORATION')}</span>
        </div>
        <div className="language-toggle" aria-label={language === 'fr' ? 'Langue' : 'Language'}>
          <button
            aria-pressed={language === 'fr'}
            className={language === 'fr' ? 'is-active' : ''}
            onClick={() => setLanguage('fr')}
            type="button"
          >
            FR
          </button>
          <span aria-hidden="true">/</span>
          <button
            aria-pressed={language === 'en'}
            className={language === 'en' ? 'is-active' : ''}
            onClick={() => setLanguage('en')}
            type="button"
          >
            EN
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="control-panel">
          <section className="intro">
            <div className="eyebrow"><span>MISSION 01</span> {translate(language, 'EARTH ANALOGUES')}</div>
            <h1>{translate(language, 'The Moon begins')} <span>{translate(language, 'here, on Earth.')}</span></h1>
            <p>
              {translate(language, 'Compare Earth environments with lunar south-pole conditions and find the best test sites.')}
            </p>
          </section>
          <div className="panel-heading">
            <div>
              <span className="section-index">01 / ANALYSIS</span>
              <h2>{translate(language, 'Choose a mission')}</h2>
            </div>
            <span className="step-count">1—2</span>
          </div>

          <div className="mode-list" role="group" aria-label={translate(language, 'Analysis mode')}>
            {modes.map((mode) => (
              <button
                className={`mode-option ${selectedMode === mode.id ? 'is-selected' : ''}`}
                disabled={isLoading}
                key={mode.id}
                onClick={() => {
                  setSelectedMode(mode.id)
                  setSites([])
                  setSelectedSiteId(null)
                  setSiteDetailState(null)
                  setIsPreview(false)
                  setError(null)
                }}
                aria-pressed={selectedMode === mode.id}
                type="button"
              >
                <span className="mode-number">{mode.number}</span>
                <span className="mode-copy">
                  <strong>{translate(language, mode.title)}</strong>
                  <small>{translate(language, mode.description)}</small>
                </span>
                <span className="radio-indicator" />
              </button>
            ))}
          </div>

          <div className="actions">
            <button
              className="primary-button"
              disabled={isLoading}
              onClick={handleAnalyze}
              type="button"
            >
              {isLoading ? translate(language, 'Analysis in progress…') : translate(language, 'Run analysis')}
              {!isLoading && <span aria-hidden="true">↗</span>}
            </button>
            <button
              className="preview-button"
              disabled={isLoading}
              onClick={() => showFixturePreview()}
              type="button"
            >
              {translate(language, 'Load local preview')} <span>↗</span>
            </button>
          </div>

          {selectedMode === 'calibration' && (
            <label className="filter-control">
              <span>{translate(language, 'Filter by instrument')}</span>
              <select
                onChange={(event) =>
                  handleCalibrationInstrumentChange(
                    calibrationInstruments.find(
                      (instrument) => instrument.id === event.target.value,
                    )?.id ?? 'all',
                  )
                }
                value={calibrationInstrument}
              >
                <option value="all">{translate(language, 'All instruments')}</option>
                {calibrationInstruments.map((instrument) => (
                  <option key={instrument.id} value={instrument.id}>
                    {instrument.label}
                  </option>
                ))}
              </select>
              <small>{translate(language, "The score will be calculated using the selected instrument's criteria.")}</small>
            </label>
          )}

          <label className="bare-soil-toggle">
            <input
              checked={bareSoilOnly}
              onChange={(event) => handleBareSoilToggle(event.target.checked)}
              type="checkbox"
            />
            <span>
              <strong>{translate(language, 'Exclude vegetated sites')}</strong>
              <small>
                {translate(language, 'Bare-soil filter (NDVI ≤ 0.1). Disable it to include these sites.')}
              </small>
            </span>
          </label>

          {selectedMode === 'custom' && (
            <div className="criteria-editor">
              <div className="criteria-title">
                <strong>{translate(language, 'Your criteria')}</strong>
                <button
                  className="text-button"
                  disabled={criteriaDraft.length >= parameterCatalog.length}
                  onClick={addCriterion}
                  type="button"
                >
                  {translate(language, '+ Add')}
                </button>
              </div>
              {criteriaDraft.map((criterion, index) => (
                <div className="criterion-row" key={`criterion-${index}`}>
                  <label>
                    <span>{translate(language, 'Parameter')}</span>
                    <select
                      value={criterion.param}
                      onChange={(event) =>
                        updateCriterion(index, {
                          param: parameterCatalog.find(
                            (parameter) => parameter.id === event.target.value,
                          )?.id ?? criterion.param,
                        })
                      }
                    >
                      {parameterCatalog.map((parameter) => (
                        <option
                          disabled={criteriaDraft.some(
                            (other, otherIndex) =>
                              otherIndex !== index && other.param === parameter.id,
                          )}
                          key={parameter.id}
                          value={parameter.id}
                        >
                          {parameter.label}
                        </option>
                      ))}
                    </select>
                    <small className="parameter-help">
                      {translate(language, 'Earth:')} {formatRange(
                        parameterInfo(criterion.param).earthMin,
                        parameterInfo(criterion.param).earthMax,
                        parameterInfo(criterion.param).unit,
                        language,
                      )}
                      {' · '}
                      {parameterInfo(criterion.param).help}
                    </small>
                  </label>
                  <div className="criterion-inputs">
                    <label>
                      <span>Min.</span>
                      <input
                        inputMode="decimal"
                        onChange={(event) =>
                          updateCriterion(index, { min: event.target.value })
                        }
                        placeholder="—"
                        value={criterion.min}
                      />
                    </label>
                    <label>
                      <span>Max.</span>
                      <input
                        inputMode="decimal"
                        onChange={(event) =>
                          updateCriterion(index, { max: event.target.value })
                        }
                        placeholder="—"
                        value={criterion.max}
                      />
                    </label>
                    <label>
                      <span>{translate(language, 'Tolerance')}</span>
                      <input
                        inputMode="decimal"
                        onChange={(event) =>
                          updateCriterion(index, { tolerance: event.target.value })
                        }
                        value={criterion.tolerance}
                      />
                    </label>
                    <label>
                      <span>{translate(language, 'Weight')}</span>
                      <input
                        inputMode="decimal"
                        onChange={(event) =>
                          updateCriterion(index, { weight: event.target.value })
                        }
                        value={criterion.weight}
                      />
                    </label>
                  </div>
                  {criteriaDraft.length > 1 && (
                    <button
                      className="remove-criterion"
                      onClick={() =>
                        removeCriterion(index)
                      }
                      type="button"
                      aria-label={`${translate(language, 'Remove criterion')} ${index + 1}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <div className="error-message" role="alert">{error}</div>}

          <div className="panel-footnote">
            <span className="info-mark">i</span>
            {translate(language, 'Scores are calculated by the API. The local preview only shows raw development values.')}
            {catalogError && <small className="catalog-error">{translate(language, 'Documentation catalog:')} {catalogError}</small>}
          </div>
        </aside>

        <section className="results-panel" aria-label={translate(language, 'Analysis results')}>
          <div className="results-heading">
            <div>
              <span className="section-index">02 / EXPLORATION</span>
              <h2>
                {selectedModeDetails ? translate(language, selectedModeDetails.title) : 'Results'}
                {selectedMode === 'calibration' && calibrationInstrument !== 'all'
                  ? ` · ${translate(language, calibrationInstruments.find((item) => item.id === calibrationInstrument)?.label ?? '')}`
                  : ''}
              </h2>
            </div>
            <div className="results-meta">
              {sites.length > 0 ? `${sites.length} ${translate(language, 'Sites').toUpperCase()}` : translate(language, 'WAITING')}
              <span className="meta-divider" />
              <span>{translate(language, 'Earth').toUpperCase()}</span>
            </div>
          </div>

          {sites.length > 0 && (
            <PlanetScene
              language={language}
              onSelectSite={setSelectedSiteId}
              selectedSiteId={selectedSiteId}
              sites={rankedSites}
            />
          )}

          {isPreview && (
            <div className="fixture-warning" role="status">
              <span className="warning-icon">!</span>
              <div>
                <strong>{translate(language, 'Development preview — do not use for demos')}</strong>
                <p>
                  {translate(language, 'Test values; no scores are calculated. Sites with NDVI above 0.1 are marked as excluded when the filter is active.')}
                </p>
              </div>
            </div>
          )}

          {!isPreview && sites.length === 0 && !error && (
            <div className="empty-state">
              <div className="empty-orbit" aria-hidden="true">
                <span className="orbit orbit-one" />
                <span className="orbit orbit-two" />
                <span className="orbit-core" />
              </div>
              <strong>{translate(language, 'Your next destination starts with a question.')}</strong>
              <p>{translate(language, 'Choose a mode, then run the analysis to rank sites.')}</p>
              <span className="empty-hint">{translate(language, 'OR LOAD THE LOCAL PREVIEW TO EXPLORE THE INTERFACE')}</span>
            </div>
          )}

          {error && (
            <div className="api-error-state">
              <span className="error-symbol">!</span>
              <div>
                <strong>{translate(language, 'Unable to reach the analysis service')}</strong>
                <p>{error}</p>
                <small>{translate(language, 'Check that the API is running, or use the local preview.')}</small>
              </div>
            </div>
          )}

          {sites.length > 0 && (
            <div className="results-layout">
              <div className="map-frame">
                <MapContainer
                  center={[35, -35]}
                  className="site-map"
                  scrollWheelZoom
                  zoom={2}
                >
                  <MapResizeHandler />
                  <FitMapToSites sites={mapSites} />
                  <FocusMapSite site={selectedSite?.excluded ? null : selectedSite} />
                  <TileLayer
                    attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Sources: Esri, Maxar, Earthstar Geographics'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  />
                  {mapSites.map((site) => (
                    <CircleMarker
                      center={[site.lat, site.lon]}
                      eventHandlers={{ click: () => setSelectedSiteId(site.id) }}
                      key={site.id}
                      pathOptions={{
                        color: selectedSiteId === site.id
                          ? '#ffffff'
                          : scoreColor(site.total, site.role, Boolean(site.excluded)),
                        fillColor: scoreColor(site.total, site.role, Boolean(site.excluded)),
                        fillOpacity: 0.9,
                        weight: selectedSiteId === site.id ? 3 : 1,
                      }}
                      radius={selectedSiteId === site.id ? 10 : 7}
                    >
                      <Popup>
                        <strong>{localizedSiteName(site, language)}</strong>
                        <br />
                        {site.excluded
                          ? translate(language, 'Excluded: vegetation')
                          : site.total === null
                          ? roleLabel(site.role, language)
                            : `Score: ${site.total}/100`}
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
                <div className="map-legend">
                  {isPreview ? (
                    <>
                      <span><i className="legend-dot blue" /> {translate(language, 'Known analogue')}</span>
                      <span><i className="legend-dot yellow" /> {translate(language, 'Candidate site')}</span>
                      <span><i className="legend-dot red" /> {translate(language, 'Negative control')}</span>
                    </>
                  ) : (
                    <>
                      <span><i className="legend-dot green" /> {translate(language, 'High score')}</span>
                      <span><i className="legend-dot yellow" /> {translate(language, 'Explore')}</span>
                      <span><i className="legend-dot red" /> {translate(language, 'Low score')}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="site-list">
                <div className="list-heading">
                  <span>{translate(language, isPreview ? 'PREVIEW SITES' : 'RANKED SITES')}</span>
                  <span>{sites.length.toString().padStart(2, '0')}</span>
                </div>
                {rankedSites.map((site, index) => (
                  <button
                    className={`site-card ${selectedSiteId === site.id ? 'is-active' : ''} ${site.excluded ? 'is-excluded' : ''}`}
                    key={site.id}
                    onClick={() => setSelectedSiteId(site.id)}
                    type="button"
                  >
                    <span className="site-rank">{(index + 1).toString().padStart(2, '0')}</span>
                    <span className="site-card-copy">
                      <strong>{localizedSiteName(site, language)}</strong>
                      <small>
                        {site.excluded ? translate(language, 'Excluded: vegetation') : roleLabel(site.role, language)}
                        {!site.excluded && coverageLabel(site)}
                      </small>
                    </span>
                    {site.excluded ? (
                      <span className="excluded-label">{translate(language, 'EXCLUDED')}</span>
                    ) : (
                      <span className="site-score">
                        {site.total === null ? '—' : `${Math.round(site.total)}`}
                        {site.total !== null && <small>/100</small>}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedSite && (
            <section className="site-detail">
              <div className="detail-heading">
                <div>
                  <span className="section-index">
                    {translate(language, 'SITE RECORD')} ·{' '}
                    {selectedSite.excluded
                      ? translate(language, 'Excluded: vegetation').toUpperCase()
                      : roleLabel(selectedSite.role, language).toUpperCase()}
                  </span>
                  <h3>{localizedSiteName(selectedSite, language)}</h3>
                </div>
                <span className="coordinates">
                  {selectedSite.lat.toFixed(2)}° / {selectedSite.lon.toFixed(2)}°
                </span>
              </div>
              <div className="detail-summary">
                <div className="detail-score">
                  <span> {translate(language, 'OVERALL SCORE')}</span>
                  <strong>
                    {selectedSite.total === null ? '—' : `${Math.round(selectedSite.total)}`}
                    {selectedSite.total !== null && <small>/100</small>}
                  </strong>
                </div>
                <div className="detail-use">
                  <span>{translate(language, 'POSSIBLE USE')}</span>
                  <strong>
                    {selectedSite.excluded
                      ? translate(language, 'Exclude from this analysis')
                      : selectedMode === 'robotics'
                        ? translate(language, 'Rover test terrain')
                        : selectedMode === 'calibration'
                          ? translate(language, 'Instrument calibration')
                          : selectedMode === 'colony'
                            ? translate(language, 'Lunar base study')
                            : translate(language, 'Evaluate against your criteria')}
                  </strong>
                </div>
              </div>
              {!selectedSite.excluded && selectedSite.criteria.length >= 3 && (
                <>
                  <RadarChart
                    language={language}
                    moonReference={moonReference}
                    parameterInfo={parameterInfo}
                    site={selectedSite}
                  />
                  <TwinImagery language={language} site={selectedSite} />
                </>
              )}
              {selectedSite.excluded && (
                <p className="exclusion-notice">
                  {translate(language, 'This site is excluded from the ranking because its vegetation index exceeds the allowed threshold.')}
                </p>
              )}
              {!selectedSite.excluded && hasMissingCriteria(selectedSite) && (
                <p className="coverage-notice" role="status">
                  {language === 'fr' ? 'Score calculé sur' : 'Score calculated from'} {evaluatedCount(selectedSite)} criterion
                  {evaluatedCount(selectedSite) > 1 ? 's' : ''} {language === 'fr' ? 'sur' : 'out of'}{' '}
                  {selectedSite.criteria.length}: {language === 'fr' ? 'les autres valeurs sont indisponibles pour ce site.' : 'the other values are unavailable for this site.'}
                </p>
              )}
              {!selectedSite.excluded && selectedSite.criteria.length > 0 ? (
                <div className="criterion-results">
                  {selectedSite.criteria.map((criterion) => {
                    const parameter = parameterInfo(criterion.param)
                    const lunar = moonReference?.params?.[criterion.param]
                    return (
                      <div className="criterion-result" key={criterion.param}>
                        <div className="criterion-copy">
                          <span>{parameter?.label ?? criterion.param}</span>
                          <strong>{formatValue(criterion.value, parameter?.unit, language)}</strong>
                        </div>
                        <div className="criterion-score">
                          <strong>{Math.round(criterion.score * 100)}%</strong>
                          <small>{language === 'fr' ? 'score' : 'score'}</small>
                        </div>
                        <span className={`verdict verdict-${criterion.verdict}`}>
                          {verdictLabel(criterion.verdict, language)}
                        </span>
                        <div className="criterion-reference">
                          <span>
                            <strong>{language === 'fr' ? 'Lune' : 'Moon'}</strong>{' '}
                            {lunar
                              ? formatRange(lunar.min, lunar.max, lunar.unit ?? parameter.unit, language)
                              : parameter.lunar}
                          </span>
                          <span><strong>{language === 'fr' ? 'Terre' : 'Earth'}</strong> {formatRange(parameter.earthMin, parameter.earthMax, parameter.unit, language)}</span>
                          <span><strong>{language === 'fr' ? 'Source' : 'Source'}</strong> {parameter.source}</span>
                          <small>{parameter.help}</small>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
              {isPreview && selectedSite.values ? (
                <div className="raw-values">
                  {Object.entries(selectedSite.values)
                    .map(([paramId, value]) => {
                      const parameter = parameterInfo(paramId)
                      return (
                        <div className="raw-value" key={paramId}>
                          <span>{parameter?.label ?? paramId}</span>
                          <strong>{formatValue(value, parameter?.unit, language)}</strong>
                        </div>
                      )
                    })}
                </div>
              ) : !isPreview && detailLoading ? (
                <p className="no-site-data">{translate(language, 'Loading values and sources…')}</p>
              ) : !isPreview && detailError ? (
                <p className="detail-error" role="alert">
                  {translate(language, 'Detailed site record unavailable:')} {detailError}
                </p>
              ) : !isPreview && siteDetail ? (
                <>
                  <div className="raw-values">
                    {Object.entries(siteDetail.values).map(([paramId, value]) => {
                      const parameter = parameterInfo(paramId)
                      return (
                        <div className="raw-value" key={paramId}>
                          <span>{parameter?.label ?? paramId}</span>
                          <strong>{formatValue(value, parameter?.unit, language)}</strong>
                        </div>
                      )
                    })}
                  </div>
                  {sourceNames(siteDetail.sources).length > 0 && (
                    <div className="data-sources">
                      <strong>{translate(language, 'Sources queried')}</strong>
                      <ul>
                        {sourceNames(siteDetail.sources).map((source) => <li key={source}>{source}</li>)}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="no-site-data">{translate(language, 'No raw values were returned for this site.')}</p>
              )}
            </section>
          )}
        </section>
      </section>

      <footer className="page-footer">
        <span>CYBER&SPACE MONTREAL</span>
        <span>{language === 'fr' ? 'UN PROJET NASA SPACE APPS CHALLENGE 2026' : 'A NASA SPACE APPS CHALLENGE 2026 PROJECT'}</span>
        <span>{language === 'fr' ? 'TERRE · LUNE · EXPLORATION' : 'EARTH · MOON · EXPLORATION'}</span>
      </footer>
    </main>
  )
}

export default App
