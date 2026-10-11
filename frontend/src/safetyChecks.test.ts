import { expect, test } from 'vitest'
import { safetyCheck } from './safetyChecks'

test.each([
  'I lost my ID',
  'my car is low on gas',
  'I have no cash',
  'We lost our home in the fire',
  'Our apartment flooded and the roof collapsed',
  'My truck broke down on the highway',
  'My grandmother uses a wheelchair',
  'Nobody is hurt, we are all at the shelter',
])('logistics fact does not trigger: %s', (fact) => {
  expect(safetyCheck([fact]).isActiveEmergency).toBe(false)
})

test.each([
  ['my husband is trapped under debris', 'trapped'],
  ['I can’t breathe', 'cant breathe'],
  ['My son is bleeding badly', 'bleeding'],
  ['The house next door is on fire', 'on fire'],
  ['I smell gas in the kitchen', 'smell gas'],
  ['Someone outside has a gun', 'has a gun'],
  ['We need an ambulance', 'need an ambulance'],
])('emergency fact triggers: %s', (fact, phrase) => {
  const check = safetyCheck(['I evacuated', fact])
  expect(check.isActiveEmergency).toBe(true)
  expect(check.matches.map((m) => m.phrase)).toContain(phrase)
})
