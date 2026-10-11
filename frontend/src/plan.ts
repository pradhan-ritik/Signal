import { categoryFor } from './localResources'
import type { Match } from './matcher'
import { getResourceInfo } from './resourceContent'

// The plan Signal shows: an ordered list of steps. Each step is one star in the constellation.
export type Step = {
  id: string // "s1", "s2", ...
  title: string // the action, verb first
  summary: string // why it matters
  priority: 'now' | 'soon' | 'later' // sets the size of the star
  dependsOn: string[] // the step before it, which is where the connecting line comes from
  actions: string[] // concrete ways to get it done, shown as a checklist
  ideas: string[] // extra angles worth knowing
  resources: { label: string; url: string }[] // websites named in the actions
  category: string // the kind of nearby place that helps with this step (see localResources.ts)
  resourceQuery?: string // an AI-generated plan can request a more specific nearby search
  pattern: string // the situation this step comes from
}

export type Plan = { title: string; steps: Step[] }

// Shown under the text box. A test checks that each one really produces a plan.
export const EXAMPLES = [
  'I evacuated with my two kids. Their school is closed and we ran out of diapers.',
  'I lost my job after the flood. I have no cash and the ATM is down.',
  'My dog is with me. I left his leash and crate behind. I also lost my ID.',
]

// The first step is "now", the next two are "soon", everything after is "later"
const PRIORITIES = ['now', 'soon', 'soon'] as const

// A checklist item is remembered by its step title and position, so it survives edits to the situation
export const checkKey = (step: Step, index: number) => `${step.title}|${index}`

// Splits free text into separate facts at line breaks, sentence ends, commas and the word "and".
export function splitFacts(text: string): string[] {
  return text
    .split(/[\n.;!?,]+|\band\b/i)
    .map((part) => part.trim())
    .filter(Boolean)
}

// Collects the websites mentioned in a step's actions, so they can be opened directly.
function findWebsites(lines: string[]): Step['resources'] {
  const domains = lines.flatMap((line) => line.match(/\b(?:[a-z0-9-]+\.)+(?:org|gov|com|net)\b/gi) ?? [])
  return [...new Set(domains)].map((domain) => ({ label: domain, url: `https://${domain}` }))
}

// Turns the confirmed matches into one plan. Each situation keeps its own step order,
// the strongest situation goes first, and a step that appears twice is only listed once.
export function buildPlan(matches: Match[], allowPossible = false): Plan | null {
  const confirmed = matches.filter((match) => match.confirmed)
  // When the caller explicitly asks for it, provide a clearly labeled starting
  // plan from the strongest clue instead of leaving the person with no next step.
  const selected = confirmed.length > 0 ? confirmed : allowPossible ? matches.slice(0, 1) : []
  if (selected.length === 0) return null

  const steps: Step[] = []
  for (const match of selected) {
    for (const need of match.pattern.needs) {
      if (steps.some((step) => step.title === need)) continue
      const card = getResourceInfo(need)
      steps.push({
        id: `s${steps.length + 1}`,
        title: need,
        summary: card.summary,
        priority: PRIORITIES[steps.length] ?? 'later',
        dependsOn: steps.length > 0 ? [steps[steps.length - 1].id] : [],
        actions: card.whereToGo,
        ideas: card.tip ? [card.tip] : [],
        resources: findWebsites(card.whereToGo),
        category: categoryFor(need),
        pattern: match.pattern.name,
      })
    }
  }
  return { title: selected.map((match) => match.pattern.name).join(' + '), steps }
}
