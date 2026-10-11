import { expect, test } from 'vitest'
import { matchPatterns } from './matcher'
import { resourceContent } from './resourceContent'
import { situationPatterns } from './situationPatterns'

const names = (facts: string[]) => matchPatterns(facts).map((m) => m.pattern.name)

test('scattered facts from the pitch connect to several patterns', () => {
  const matches = matchPatterns([
    'I evacuated',
    'I have my kids with me',
    'my car is low on gas',
    'I have no cash',
    'I lost my ID',
  ])
  expect(matches[0].pattern.name).toBe('Financial hardship')
  expect(matches[0].confidence).toBe(0.5) // 2 of 4 triggers: no cash, gas
  expect(matches.map((m) => m.pattern.name)).toEqual(
    expect.arrayContaining([
      'Evacuee with dependents',
      'Needs replacement documents',
      'Needs temporary housing',
      'Stranded without transportation',
    ]),
  )
})

test('pet facts match the pet owner pattern', () => {
  expect(names(['My dog is with me', 'I forgot his leash and crate'])[0]).toBe('Pet owner evacuee')
})

test('mobility facts match the elderly or mobility-limited pattern', () => {
  const facts = ['My grandmother uses a wheelchair', 'The shelter has stairs she cannot climb']
  expect(names(facts)[0]).toBe('Elderly or mobility-limited evacuee')
})

test('unrelated facts match nothing', () => {
  expect(matchPatterns(['I like pizza'])).toEqual([])
})

test('keywords only match whole words', () => {
  // "kids" contains the letters "id" but must not count as a lost ID
  expect(names(['The kids are fine'])).toEqual(['Evacuee with dependents'])
})

test('every predicted need stays logistics-only and has a resource card', () => {
  const banned = /911|medical|medication|doctor|hospital|ambulance|injur/i
  for (const pattern of situationPatterns) {
    for (const need of pattern.needs) {
      expect(need).not.toMatch(banned)
      expect(resourceContent).toHaveProperty([need])
    }
  }
})

// Realistic phrasing, one case per pattern: [facts, expected strongest pattern]
const realisticCases: [string[], string][] = [
  [['I have a toddler and a 7 year old with me', 'Their school is closed', 'We ran out of diapers'], 'Evacuee with dependents'],
  [['My passport and birth certificate were in the house', "I don't have my debit card either"], 'Needs replacement documents'],
  [['We got out with our two cats', "I don't have their carrier or any cat food", "The shelter won't take animals"], 'Pet owner evacuee'],
  [['My dad is 81 and uses a walker', 'He can’t drive anymore', 'We need somewhere without stairs'], 'Elderly or mobility-limited evacuee'],
  [["I'm a senior living alone", 'I left my cane behind'], 'Elderly or mobility-limited evacuee'],
  [['I lost my job when the store closed', "I can't afford groceries", 'The ATM is not working'], 'Financial hardship'],
  [['We lost our home in the fire', 'We are staying in a motel for two nights', "My landlord isn't answering"], 'Needs temporary housing'],
  [['My truck broke down on the highway', "I'm stranded 40 miles away from the shelter"], 'Stranded without transportation'],
]

test.each(realisticCases)('%j matches %s', (facts, expected) => {
  expect(names(facts)[0]).toBe(expected)
})

test('one fact is only a possible match, never a confirmed pattern', () => {
  const [match] = matchPatterns(['I have 2 kids and I am a single mother'])
  expect(match.pattern.name).toBe('Evacuee with dependents')
  expect(match.confirmed).toBe(false)
})

test('one fact that lights two triggers is still not confirmed', () => {
  const [match] = matchPatterns(['My passport and birth certificate burned'])
  expect(match.lit.length).toBe(2)
  expect(match.confirmed).toBe(false)
})

test('two facts pointing to the same pattern confirm it', () => {
  const [match] = matchPatterns(['I have 2 kids with me', 'Their school is closed'])
  expect(match.confirmed).toBe(true)
})

test('a confirmed pattern ranks above an unconfirmed one with higher confidence', () => {
  const matches = matchPatterns(['My passport and birth certificate burned', 'I have no cash', 'I lost my job'])
  expect(matches[0].pattern.name).toBe('Financial hardship') // 2 facts, 50%
  expect(matches[1].pattern.name).toBe('Needs replacement documents') // 1 fact, 67%
})

test('confidence grows as more facts point to a pattern', () => {
  const two = matchPatterns(['I have no cash', 'I lost my job'])[0]
  const three = matchPatterns(['I have no cash', 'I lost my job', 'The ATM is not working'])[0]
  expect(three.confidence).toBeGreaterThan(two.confidence)
})

test('each lit sign records the fact and the exact word that lit it', () => {
  const [match] = matchPatterns(['I have my kids with me', 'Their school is closed'])
  expect(match.lit.map((l) => [l.trigger.label, l.fact, l.keyword])).toEqual([
    ['Children are with you', 'I have my kids with me', 'kid'],
    ['School or childcare is disrupted', 'Their school is closed', 'school'],
  ])
})

test('the recorded word really appears in the recorded fact', () => {
  for (const [facts] of realisticCases) {
    for (const match of matchPatterns(facts)) {
      for (const { fact, keyword } of match.lit) expect(fact.toLowerCase().replaceAll('’', "'")).toContain(keyword)
    }
  }
})

test('a vehicle that broke down, or renting a car, is not read as money trouble', () => {
  expect(names(['My truck broke down', 'I need to rent a car'])).not.toContain('Financial hardship')
  expect(names(['I’m broke', 'I am behind on rent'])[0]).toBe('Financial hardship')
})
