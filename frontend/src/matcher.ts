import { situationPatterns, type SituationPattern, type Trigger } from './situationPatterns'

// How matching works, in one sentence:
// a trigger is "lit" when one of the user's facts contains one of its keywords,
// and a pattern's confidence is the share of its triggers that are lit.

export type Match = {
  pattern: SituationPattern
  lit: { trigger: Trigger; fact: string; keyword: string }[] // which fact lit which trigger, and the word that did it
  confidence: number // 0 to 1
  confirmed: boolean // true when two or more different facts lit this pattern
}

// Finds the keyword in the fact as a whole word or phrase; null when it is not there.
// A trailing "s" is allowed, so "kid" also matches "kids".
export function findKeyword(fact: string, keyword: string): RegExpMatchArray | null {
  const text = fact.toLowerCase().replaceAll('’', "'")
  return text.match(new RegExp(`\\b${keyword}s?\\b`))
}

// Returns every pattern with at least one lit trigger, strongest first.
export function matchPatterns(facts: string[]): Match[] {
  const matches: Match[] = []

  for (const pattern of situationPatterns) {
    const lit: Match['lit'] = []
    for (const trigger of pattern.triggers) {
      // The first fact that contains one of this trigger's keywords lights it
      for (const fact of facts) {
        const keyword = trigger.keywords.find((k) => findKeyword(fact, k))
        if (keyword) {
          lit.push({ trigger, fact, keyword })
          break
        }
      }
    }
    if (lit.length > 0) {
      const factsUsed = new Set(lit.map((item) => item.fact)).size
      matches.push({ pattern, lit, confidence: lit.length / pattern.triggers.length, confirmed: factsUsed >= 2 })
    }
  }

  // Confirmed patterns first, then highest confidence; ties go to the pattern with more lit triggers
  return matches.sort(
    (a, b) => Number(b.confirmed) - Number(a.confirmed) || b.confidence - a.confidence || b.lit.length - a.lit.length,
  )
}
