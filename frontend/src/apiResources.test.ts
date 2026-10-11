import { afterEach, expect, test, vi } from 'vitest'
import { findNearby, findPlace } from './localResources'

afterEach(() => vi.unstubAllGlobals())

test('city lookup uses the API and keeps only the rounded place returned by it', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ label: 'Oakland', lat: 37.8, lng: -122.27 }) })
  vi.stubGlobal('fetch', fetchMock)
  await expect(findPlace('Oakland, CA')).resolves.toEqual({ label: 'Oakland', lat: 37.8, lng: -122.27 })
  expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/location\/search$/)
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ query: 'Oakland, CA' })
})

test('nearby contacts retain provider source, status, distance and direction link', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      resources: [
        {
          name: 'Community Food Center',
          category: 'food',
          phone: '510-555-0199',
          website: 'https://example.org',
          address: 'Oakland, CA',
          distanceKm: 2,
          hours: 'Mo-Fr 09:00-17:00',
          openNow: true,
          source: 'google',
          sourceUrl: 'https://maps.google.com/?cid=1',
          mapsUri: 'https://maps.google.com/?cid=1',
          fetchedAt: '2026-10-10T12:00:00Z',
        },
      ],
    }),
  })
  vi.stubGlobal('fetch', fetchMock)
  const [place] = await findNearby('food', { label: 'Oakland', lat: 37.8, lng: -122.27 })
  expect(place).toMatchObject({
    name: 'Community Food Center',
    phone: '510-555-0199',
    distanceMiles: expect.closeTo(1.24, 2),
    openNow: true,
    source: 'Google',
    sourceUrl: 'https://maps.google.com/?cid=1',
    mapsUri: 'https://maps.google.com/?cid=1',
  })
  expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/resources\/nearby$/)
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ category: 'food', query: 'food bank', lat: 37.8, lng: -122.27 })
})
