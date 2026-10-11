import type { HelpLineKey } from './nationalResources'
import { API_BASE } from './api'

// Real places near the user, from OpenStreetMap's search service. No API key is needed, and
// every name, phone number, website and address comes from the map data, never from AI.

// Where the user is, rounded to about 1 km. Exact coordinates are never kept.
export type Place = { label: string; lat: number; lng: number }

export type Resource = {
  name: string
  category: string
  phone?: string
  website?: string
  address?: string
  hours?: string
  openNow?: boolean
  lat?: number
  lng?: number
  distanceMiles?: number
  source: 'OpenStreetMap' | 'Google' | '211.org' | 'Signal directory'
  fetchedAt: string
  mapsUri?: string
  sourceUrl?: string
}

type Category = {
  label: string
  searches: string[] // what to look for on the map, tried in order until one finds something
  helpLines: HelpLineKey[] // always shown, so a step never has nothing to act on
}

export const CATEGORIES: Record<string, Category> = {
  // Emergency shelters are rarely mapped ahead of time; they usually open in community centers
  shelter: { label: 'Shelters and community centers', searches: ['emergency shelter', 'homeless shelter', 'community center'], helpLines: ['redCross', 'local211'] },
  food: { label: 'Food banks', searches: ['food bank', 'food pantry'], helpLines: ['local211', 'redCross'] },
  childcare: { label: 'Childcare', searches: ['childcare', 'daycare', 'preschool'], helpLines: ['local211'] },
  pets: { label: 'Animal shelters', searches: ['animal shelter', 'veterinary'], helpLines: ['local211'] },
  government: { label: 'Public service offices', searches: ['social services', 'DMV', 'city hall'], helpLines: ['fema', 'socialSecurity', 'local211'] },
  bank: { label: 'Banks', searches: ['bank'], helpLines: ['local211'] },
  lodging: { label: 'Hotels', searches: ['hotel', 'motel'], helpLines: ['fema', 'local211'] },
  fuel: { label: 'Fuel stations', searches: ['gas station'], helpLines: ['local211'] },
  transit: { label: 'Transit stations', searches: ['bus station'], helpLines: ['local211'] },
  seniors: { label: 'Senior centers', searches: ['senior center'], helpLines: ['eldercare', 'local211'] },
  equipment: { label: 'Medical supply stores', searches: ['medical supply'], helpLines: ['eldercare', 'local211'] },
  post: { label: 'Post offices', searches: ['post office'], helpLines: ['socialSecurity', 'local211'] },
  community: { label: 'Community centers', searches: ['community center'], helpLines: ['local211', 'disasterDistress'] },
}

// The first rule whose word appears in a step's title decides its category
const RULES: [RegExp, string][] = [
  [/pet/i, 'pets'],
  [/shelter/i, 'shelter'],
  [/meals|groceries|food|diapers/i, 'food'],
  [/childcare/i, 'childcare'],
  [/hotel|housing|rental assistance/i, 'lodging'],
  [/fuel/i, 'fuel'],
  [/shuttle|transit|transportation|roads/i, 'transit'],
  [/mobility equipment/i, 'equipment'],
  [/case manager/i, 'seniors'],
  [/mailing address/i, 'post'],
  [/bank|payments/i, 'bank'],
  [/license|certificate|social security|fema|benefits|unemployment/i, 'government'],
]

export function categoryFor(stepTitle: string): string {
  return RULES.find(([word]) => word.test(stepTitle))?.[1] ?? 'community'
}

// ---------- Talking to OpenStreetMap's search service (Nominatim) ----------

type MapResult = {
  name?: string
  lat: string
  lon: string
  address?: Record<string, string>
  extratags?: Record<string, string> | null
}

// ---------- Finding the user's place ----------

export function roundPlace(label: string, lat: number, lng: number): Place {
  return { label, lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 }
}

// Turns a ZIP code or city name into a place
export async function findPlace(query: string): Promise<Place | null> {
  const response = await fetch(`${API_BASE}/api/location/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) return null
  const hit = (await response.json()) as Place
  return roundPlace(hit.label || query, hit.lat, hit.lng)
}

// ---------- Finding places nearby ----------

function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 3959 * 2 * Math.asin(Math.sqrt(h))
}

// Turns one map result into a resource. Unnamed results are skipped, and a phone number,
// website or address only appears if the map data has one.
export function toResource(result: MapResult, category: string, place: Place, fetchedAt: string): Resource | null {
  if (!result.name) return null
  const extra = result.extratags ?? {}
  const address = result.address ?? {}
  const website = extra.website ?? extra['contact:website']
  const street = [address.house_number, address.road].filter(Boolean).join(' ')
  const lat = Number(result.lat)
  const lng = Number(result.lon)
  return {
    name: result.name,
    category,
    phone: extra.phone ?? extra['contact:phone'],
    website: website && (website.startsWith('http') ? website : `https://${website}`),
    address: [street, address.city ?? address.town].filter(Boolean).join(', ') || undefined,
    hours: extra.opening_hours,
    openNow: undefined,
    lat,
    lng,
    distanceMiles: milesBetween(place, { lat, lng }),
    source: 'OpenStreetMap',
    fetchedAt,
    mapsUri: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    sourceUrl: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`,
  }
}

// Looks for one kind of place within about 10 miles. Results are kept for a day,
// so the same search in the same area never asks the map service twice.
export async function findNearby(category: string, place: Place, query = CATEGORIES[category].searches[0]): Promise<Resource[]> {
  const response = await fetch(`${API_BASE}/api/resources/nearby`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, query, lat: place.lat, lng: place.lng }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`Nearby resource search failed for ${category}`)
  const payload = (await response.json()) as { resources: Record<string, unknown>[] }
  return (payload.resources ?? []).map((item) => ({
    name: String(item.name ?? 'Local service'),
    category: String(item.category ?? category),
    phone: typeof item.phone === 'string' ? item.phone : undefined,
    website: typeof item.website === 'string' ? item.website : undefined,
    address: typeof item.address === 'string' ? item.address : undefined,
    hours: typeof item.hours === 'string' ? item.hours : undefined,
    openNow: typeof item.openNow === 'boolean' ? item.openNow : undefined,
    lat: typeof item.lat === 'number' ? item.lat : undefined,
    lng: typeof item.lng === 'number' ? item.lng : undefined,
    distanceMiles: typeof item.distanceKm === 'number' ? item.distanceKm * 0.621371 : undefined,
    source: item.source === 'google' ? 'Google' : item.source === 'osm' ? 'OpenStreetMap' : item.source === '211' ? '211.org' : 'Signal directory',
    fetchedAt: String(item.fetchedAt ?? new Date().toISOString()),
    mapsUri: typeof item.mapsUri === 'string' ? item.mapsUri : undefined,
    sourceUrl: typeof item.sourceUrl === 'string' ? item.sourceUrl : undefined,
  }))
}

export const directionsUrl = (resource: Resource) =>
  resource.mapsUri ?? (resource.lat !== undefined && resource.lng !== undefined ? `https://www.google.com/maps/dir/?api=1&destination=${resource.lat},${resource.lng}` : resource.website ?? 'https://www.211.org/')

export const moreNearbyUrl = (category: string, place: Place) =>
  `https://www.google.com/maps/search/${encodeURIComponent(CATEGORIES[category].searches[0])}/@${place.lat},${place.lng},12z`
