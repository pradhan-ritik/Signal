

export type EmergencyCategory =
  | 'medical'
  | 'breathing'
  | 'trapped'
  | 'fire or gas'
  | 'rising water'
  | 'violence'
  | 'missing person'
  | 'self-harm'
  | 'immediate danger'

export const emergencyPhrases: Record<EmergencyCategory, string[]> = {
  medical: [
    'bleeding', 'blood everywhere', 'unconscious', 'unresponsive', 'passed out',
    'wont wake up', 'not waking up', 'chest pain', 'heart attack', 'stroke',
    'seizure', 'overdose', 'overdosed', 'allergic reaction', 'broken bone',
    'broken leg', 'broken arm', 'broken neck', 'head injury', 'injured',
    'seriously hurt', 'badly hurt', 'is hurt', 'are hurt', 'got hurt',
    'need an ambulance', 'call an ambulance', 'need a doctor now',
    'need medical help', 'in labor', 'water broke', 'contractions',
  ],
  breathing: [
    'cant breathe', 'cannot breathe', 'can not breathe', 'not breathing',
    'stopped breathing', 'trouble breathing', 'hard to breathe', 'choking',
  ],
  trapped: [
    'trapped', 'stuck under', 'pinned under', 'pinned down', 'cant get out',
    'cannot get out', 'buried under', 'under the rubble', 'collapsed on',
  ],
  'fire or gas': [
    'on fire', 'fire is close', 'fire is near', 'fire nearby', 'fire is coming',
    'fire is spreading', 'is burning', 'are burning', 'see flames', 'flames are',
    'smell smoke', 'smoke inside', 'smoke in the house', 'smell gas', 'gas leak',
    'carbon monoxide', 'co alarm',
  ],
  'rising water': [
    'water is rising', 'water rising', 'drowning', 'swept away', 'stuck in the water',
    'car is flooding', 'water is coming in', 'stuck on the roof', 'stuck on our roof',
  ],
  violence: [
    'attacking', 'being attacked', 'has a gun', 'has a knife', 'shooting',
    'breaking in', 'threatening to kill', 'threatening us', 'threatening me',
  ],
  'missing person': [
    'child is missing', 'kid is missing', 'missing child', 'cant find my child',
    'cant find my kid', 'cant find my son', 'cant find my daughter', 'cant find my baby',
  ],
  'self-harm': ['kill myself', 'end my life', 'suicide', 'suicidal', 'want to die', 'hurt myself'],
  'immediate danger': [
    'in danger', 'im not safe', 'we are not safe', 'were not safe', 'not safe here',
    'not safe right now', 'send help', 'need rescue', 'need to be rescued', 'rescue us',
    'sos', 'call 911', 'emergency right now',
  ],
}

export const negationWords = [
  'no', 'not', 'nobody', 'noone', 'none', 'never', 'without',
  'isnt', 'arent', 'wasnt', 'werent', 'dont', 'doesnt', 'didnt',
]

export const EMERGENCY_MESSAGE = 'This sounds like an active emergency. Please call 911 now.'
export const CRISIS_LINE_MESSAGE =
  'If you are thinking about ending your life, call or text 988 (Suicide & Crisis Lifeline), any time.'

export type SafetyMatch = {
  phrase: string // the exact phrase from emergencyPhrases that triggered
  category: EmergencyCategory
  fact: string // the fact it was found in
}

export type SafetyResult = {
  isActiveEmergency: boolean // true = show the 911 state, skip matching and the constellation
  matches: SafetyMatch[]
  message: string | null // banner text, null when nothing triggered
  crisisLineMessage: string | null // extra line when self-harm language was found
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['‘’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// True when the phrase appears in the fact and isn't negated by the 3 words before it
function factHasPhrase(fact: string, phrase: string): boolean {
  const text = ` ${normalize(fact)} `
  for (let at = text.indexOf(` ${phrase} `); at !== -1; at = text.indexOf(` ${phrase} `, at + 1)) {
    const wordsBefore = text.slice(0, at).trim().split(' ').slice(-3)
    if (!wordsBefore.some((word) => negationWords.includes(word))) return true
  }
  return false
}

export function safetyCheck(facts: string[]): SafetyResult {
  const matches: SafetyMatch[] = []
  for (const fact of facts) {
    for (const [category, phrases] of Object.entries(emergencyPhrases) as [EmergencyCategory, string[]][]) {
      for (const phrase of phrases) {
        if (factHasPhrase(fact, phrase)) matches.push({ phrase, category, fact })
      }
    }
  }

  const isActiveEmergency = matches.length > 0
  return {
    isActiveEmergency,
    matches,
    message: isActiveEmergency ? EMERGENCY_MESSAGE : null,
    crisisLineMessage: matches.some((m) => m.category === 'self-harm') ? CRISIS_LINE_MESSAGE : null,
  }
}
