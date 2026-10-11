import { expect, test } from 'vitest'
import { matchPatterns } from './matcher'
import { buildPlan, EXAMPLES, splitFacts } from './plan'

const planFor = (text: string) => buildPlan(matchPatterns(splitFacts(text)))

test('free text is split into separate facts', () => {
  expect(splitFacts('I evacuated with my two kids. Their school is closed and we ran out of diapers.')).toEqual([
    'I evacuated with my two kids',
    'Their school is closed',
    'we ran out of diapers',
  ])
  expect(splitFacts('no cash, no ID\nlost my job!')).toEqual(['no cash', 'no ID', 'lost my job'])
  expect(splitFacts('   ')).toEqual([])
})

test.each(EXAMPLES)('the example "%s" produces a plan', (example) => {
  expect(planFor(example)!.steps.length).toBeGreaterThanOrEqual(4)
})

test('a plan is an ordered chain of steps', () => {
  const plan = planFor(EXAMPLES[0])!
  expect(plan.title).toBe('Evacuee with dependents')
  expect(plan.steps.map((step) => step.id)).toEqual(['s1', 's2', 's3', 's4'])
  expect(plan.steps.map((step) => step.priority)).toEqual(['now', 'soon', 'soon', 'later'])
  expect(plan.steps.map((step) => step.dependsOn)).toEqual([[], ['s1'], ['s2'], ['s3']])
  expect(plan.steps[0].title).toBe('Find a shelter with space for families')
  expect(plan.steps[0].actions.length).toBeGreaterThan(0)
})

test('two confirmed situations become one plan with no repeated steps', () => {
  const plan = planFor(`${EXAMPLES[0]} ${EXAMPLES[1]}`)!
  expect(plan.title).toBe('Evacuee with dependents + Financial hardship')
  const titles = plan.steps.map((step) => step.title)
  expect(new Set(titles).size).toBe(titles.length)
  expect(titles.length).toBe(9)
})

test('websites named in a step become its resources', () => {
  const step = planFor(EXAMPLES[0])!.steps[0]
  expect(step.resources).toContainEqual({ label: 'redcross.org', url: 'https://redcross.org' })
})

test('one fact alone is not enough for a plan', () => {
  expect(planFor('I have no cash')).toBeNull()
  expect(planFor('I like pizza')).toBeNull()
})
