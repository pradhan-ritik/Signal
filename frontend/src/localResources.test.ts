import { expect, test } from 'vitest'
import { CATEGORIES, categoryFor, toResource } from './localResources'
import { HELP_LINES } from './nationalResources'
import { resourceContent } from './resourceContent'
import { situationPatterns } from './situationPatterns'

const place = { label: 'San Jose', lat: 37.34, lng: -121.89 }

test('each step is sent to a sensible kind of nearby place', () => {
  expect(categoryFor('Find a shelter with space for families')).toBe('shelter')
  expect(categoryFor('Find a pet-friendly shelter or emergency boarding')).toBe('pets')
  expect(categoryFor('Get free meals and groceries')).toBe('food')
  expect(categoryFor('Request a replacement Social Security card')).toBe('government')
  expect(categoryFor('Write down every document that is missing')).toBe('community')
})

test('every step in every situation maps to a known category', () => {
  for (const pattern of situationPatterns) {
    for (const need of pattern.needs) expect(CATEGORIES).toHaveProperty(categoryFor(need))
  }
})

test('a map result becomes a resource that says where it came from', () => {
  const resource = toResource(
    {
      name: 'Second Harvest',
      lat: '37.35',
      lon: '-121.9',
      address: { house_number: '750', road: 'Curtner Ave', city: 'San Jose' },
      extratags: { phone: '+1 408 266 8866', website: 'shfb.org', opening_hours: 'Mo-Fr 08:00-17:00' },
    },
    'food',
    place,
    '2026-10-10T00:00:00.000Z',
  )!
  expect(resource).toMatchObject({
    name: 'Second Harvest',
    phone: '+1 408 266 8866',
    website: 'https://shfb.org',
    address: '750 Curtner Ave, San Jose',
    hours: 'Mo-Fr 08:00-17:00',
    source: 'OpenStreetMap',
  })
  expect(resource.distanceMiles).toBeGreaterThan(0)
  expect(resource.distanceMiles).toBeLessThan(2)
})

test('an unnamed map result is skipped, and no contact details are invented', () => {
  expect(toResource({ lat: '1', lon: '1' }, 'food', place, '')).toBeNull()
  const bare = toResource({ name: 'Community Pantry', lat: '37.3', lon: '-121.9', extratags: null }, 'food', place, '')!
  expect(bare.phone).toBeUndefined()
  expect(bare.website).toBeUndefined()
  expect(bare.address).toBeUndefined()
})

test('every help line has a dialable link and an official source page', () => {
  for (const line of Object.values(HELP_LINES)) {
    expect(line.href).toMatch(/^(tel:\d+|sms:\d+)/)
    expect(line.source).toMatch(/^https:\/\//)
  }
})

test('every phone number written in a step is one of the checked help lines', () => {
  const checked = Object.values(HELP_LINES).map((line) => line.href.replace(/\D/g, ''))
  const cardText = Object.values(resourceContent).map((card) => [card.summary, ...card.whereToGo, card.tip ?? ''].join(' '))
  const numbers = cardText.flatMap((text) => text.match(/1-\d{3}-\d{3}-\d{4}/g) ?? [])
  expect(numbers.length).toBeGreaterThan(0)
  for (const number of numbers) expect(checked).toContain(number.replace(/\D/g, ''))
})

test('every help line named by a category exists', () => {
  for (const category of Object.values(CATEGORIES)) {
    for (const key of category.helpLines) expect(HELP_LINES).toHaveProperty(key)
  }
})
