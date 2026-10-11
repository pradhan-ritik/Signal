import { useEffect, useState } from 'react'
import LocationBar from './LocationBar'
import { findNearby, type Place, type Resource } from './localResources'
import { findKeyword, matchPatterns, type Match } from './matcher'
import { HELP_LINES } from './nationalResources'
import { buildPlan, checkKey, EXAMPLES, splitFacts } from './plan'
import { streamTailoredPlan } from './planApi'
import PlanConstellation from './PlanConstellation'
import { safetyCheck } from './safetyChecks'
import SessionSummary from './SessionSummary'
import StepDetail from './StepDetail'

// One saved situation: what the person wrote, and which checklist items they have ticked.
// The plan itself is never saved; it is rebuilt from the text every time.
type Situation = { id: string; text: string; checked: string[] }

const situationKey = (text: string) => text.trim().replace(/\s+/g, ' ').toLocaleLowerCase()

function uniqueSituations(items: Situation[]): Situation[] {
  const seen = new Set<string>()
  return items.filter((situation) => {
    const key = situationKey(situation.text)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const STORAGE_KEY = 'signal.situations'
const PLACE_KEY = 'signal.place'

// The whole pipeline in one line: text -> facts -> matched situations -> plan
const planFor = (text: string) => buildPlan(matchPatterns(splitFacts(text)), true)

function loadSituations(): Situation[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(saved)) return []
    const valid = saved.filter((item): item is Situation => {
      if (!item || typeof item.id !== 'string' || typeof item.text !== 'string') return false
      return true
    })
    return uniqueSituations(valid)
  } catch {
    return [] // unreadable storage just means starting fresh
  }
}

// Line icons, all drawn at one size and one stroke width
const ICONS = {
  plus: 'M5 12h14M12 5v14',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  menu: 'M4 6h16M4 12h16M4 18h16',
  pencil: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
}
function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

// Shows why a situation matched: each fact that lit a sign, with the matching word marked
function Evidence({ lit }: { lit: Match['lit'] }) {
  return (
    <ul className="signal-evidence">
      {lit.map(({ trigger, fact, keyword }) => {
        const found = findKeyword(fact, keyword)
        const start = found?.index ?? 0
        const end = start + (found?.[0].length ?? 0)
        return (
          <li key={trigger.label}>
            <span>
              “{fact.slice(0, start)}
              <mark>{fact.slice(start, end)}</mark>
              {fact.slice(end)}”
            </span>
            <span className="signal-muted">{trigger.label}</span>
          </li>
        )
      })}
    </ul>
  )
}

function App() {
  const [situations, setSituations] = useState<Situation[]>(loadSituations)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState('') // the text in the big "Describe your situation" box
  const [editing, setEditing] = useState(false)
  const [selectedStep, setSelectedStep] = useState('s1')
  const [view, setView] = useState<'map' | 'list'>('map')
  const [railOpen, setRailOpen] = useState(false) // phones only: the rail is a drawer
  const [detail, setDetail] = useState('') // the "Add a detail" box under the plan
  const [tailoredPlan, setTailoredPlan] = useState<{ situationId: string; text: string; plan: ReturnType<typeof buildPlan> } | null>(null)
  const [tailoringStatus, setTailoringStatus] = useState<'idle' | 'loading' | 'ready' | 'offline' | 'error'>('idle')
  // Where to look for nearby help. Optional, and only ever a rounded position.
  const [place, setPlace] = useState<Place | null>(() => JSON.parse(localStorage.getItem(PLACE_KEY) ?? 'null'))
  // Places found so far, by category. A category is missing while it is still loading.
  const [nearby, setNearby] = useState<Record<string, Resource[] | 'failed'>>({})

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(uniqueSituations(situations)))
  }, [situations])
  useEffect(() => {
    localStorage.setItem(PLACE_KEY, JSON.stringify(place))
  }, [place])

  // Everything shown is worked out from the active situation's text, in this order:
  // split into facts -> safety check -> match situations -> build the plan
  const active = situations.find((situation) => situation.id === activeId)
  const visibleSituations = uniqueSituations(situations)
  const facts = active ? splitFacts(active.text) : []
  const safety = safetyCheck(facts)
  const matches = safety.isActiveEmergency ? [] : matchPatterns(facts)
  const provisionalPlan = matches.length > 0 && !matches.some((match) => match.confirmed)
  const offlinePlan = buildPlan(matches, true)
  const savedTailoredPlan = tailoredPlan && tailoredPlan.situationId === active?.id && tailoredPlan.text === active?.text ? tailoredPlan.plan : null
  const plan = savedTailoredPlan ?? offlinePlan
  const checked = new Set(active?.checked)
  const doneIds = new Set(
    plan?.steps.filter((step) => step.actions.every((_, i) => checked.has(checkKey(step, i)))).map((step) => step.id),
  )
  const step = plan?.steps.find((s) => s.id === selectedStep) ?? plan?.steps[0]
  const litFacts = new Set(matches.flatMap((match) => match.lit.map((l) => l.fact)))
  const unusedFacts = facts.filter((fact) => !litFacts.has(fact))

  // Whenever the plan's categories or the place change, look up real places nearby,
  // one category at a time, starting with the selected step's
  const categories = [...new Set([step?.category, ...(plan?.steps.map((s) => s.category) ?? [])])].filter(Boolean).join(',')
  const resourcePlanKey = plan?.steps.map((planStep) => `${planStep.category}:${planStep.resourceQuery ?? ''}`).join('|') ?? ''
  useEffect(() => {
    setNearby({})
    if (!place || !categories) return
    let stale = false
    ;(async () => {
      for (const category of categories.split(',')) {
        const query = plan?.steps.find((candidate) => candidate.category === category)?.resourceQuery
        const found = await findNearby(category, place, query).catch(() => 'failed' as const)
        if (stale) return
        setNearby((soFar) => ({ ...soFar, [category]: found }))
      }
    })()
    return () => {
      stale = true
    }
    // Runs again for a new place or a new plan, not on every step click
  }, [place, plan?.title, resourcePlanKey])

  function open(id: string | null) {
    setActiveId(id)
    setEditing(false)
    setTailoredPlan(null)
    setTailoringStatus('idle')
    setSelectedStep('s1')
    setView('map')
    setRailOpen(false)
    setDraft('')
  }

  function updateActive(changes: Partial<Situation>) {
    setSituations(situations.map((situation) => (situation.id === activeId ? { ...situation, ...changes } : situation)))
  }

  function mapSteps(event: React.FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    if (active && editing) {
      updateActive({ text })
      setEditing(false)
      setSelectedStep('s1')
      setTailoredPlan(null)
      setTailoringStatus('idle')
    } else {
      const existing = situations.find((situation) => situationKey(situation.text) === situationKey(text))
      if (existing) {
        open(existing.id)
        return
      }
      const id = String(Date.now())
      setSituations([{ id, text, checked: [] }, ...situations])
      open(id)
    }
  }

  // A follow-up adds to the situation and redraws the plan; it does not add a reply
  function addDetail(event: React.FormEvent) {
    event.preventDefault()
    if (!active || !detail.trim()) return
    updateActive({ text: `${active.text}\n${detail.trim()}` })
    setDetail('')
    setSelectedStep('s1')
    setTailoredPlan(null)
    setTailoringStatus('idle')
  }

  function remove(id: string) {
    const removed = situations.find((situation) => situation.id === id)
    const key = removed ? situationKey(removed.text) : ''
    setSituations(situations.filter((situation) => situation.id !== id && (!key || situationKey(situation.text) !== key)))
    if (situations.some((situation) => situation.id === id && id === activeId)) open(null)
  }

  function check(keys: string[], on: boolean) {
    const next = new Set(checked)
    keys.forEach((key) => (on ? next.add(key) : next.delete(key)))
    updateActive({ checked: [...next] })
  }

  async function tailorSteps() {
    if (!active || safety.isActiveEmergency || !offlinePlan) return
    setTailoringStatus('loading')
    setTailoredPlan(null)
    try {
      const result = await streamTailoredPlan({
        situation: active.text,
        situationHints: matches.map((match) => match.pattern.name),
        fallbackPlan: offlinePlan,
        onFallback: () => {
          setTailoredPlan(null)
          setTailoringStatus('offline')
        },
        onReset: () => setTailoredPlan(null),
        onSteps: (steps) => {
          setTailoredPlan({ situationId: active.id, text: active.text, plan: { title: offlinePlan.title, steps } })
        },
      })
      if (result.usedFallback) {
        setTailoredPlan(null)
        setTailoringStatus('offline')
      } else {
        setTailoredPlan({ situationId: active.id, text: active.text, plan: result.plan })
        setTailoringStatus('ready')
      }
    } catch {
      setTailoredPlan(null)
      setTailoringStatus('error')
    }
  }

  return (
    <div className={railOpen ? 'signal-shell is-rail-open' : 'signal-shell'}>
      <nav className="signal-rail" aria-label="Past situations">
        <p className="signal-wordmark">Signal</p>
        <button type="button" className="signal-btn signal-btn--quiet" onClick={() => open(null)}>
          <Icon name="plus" /> New situation
        </button>
        <p className="signal-caption">Past situations</p>
        {visibleSituations.length === 0 && <p className="signal-caption">Nothing yet. Situations you map are kept on this device only.</p>}
        <ul>
          {visibleSituations.map((situation) => (
            <li key={situation.id} className={situation.id === activeId ? 'signal-rail__row is-active' : 'signal-rail__row'}>
              {/* Titled by its plan when there is one, otherwise by what was written */}
              <button type="button" className="signal-rail__item" title={situation.text} onClick={() => open(situation.id)}>
                {planFor(situation.text)?.title ?? situation.text}
              </button>
              <button type="button" className="signal-rail__delete" aria-label="Delete this situation" onClick={() => remove(situation.id)}>
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="signal-main">
        <p className="signal-safety">
          <strong>If you are in immediate danger, call 911.</strong> This tool helps you plan next steps once you’re safe.
        </p>
        <header className="signal-topbar">
          <button type="button" className="signal-link" aria-label="Show past situations" aria-expanded={railOpen} onClick={() => setRailOpen(!railOpen)}>
            <Icon name="menu" />
          </button>
          <span className="signal-wordmark">Signal</span>
        </header>

        <main className="signal-content">
          {!active || editing ? (
            <form className="signal-compose" onSubmit={mapSteps}>
              <h1>
                <label htmlFor="situation">Describe your situation</label>
              </h1>
              <p className="signal-muted">Write it the way you would tell a friend. Signal turns it into steps, in order.</p>
              <textarea
                id="situation"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={Math.max(4, draft.split('\n').length + 1)}
                placeholder="Who is with you, what changed, what you no longer have"
              />
              <div className="signal-compose__actions">
                <button type="submit" className="signal-btn signal-btn--primary" disabled={!draft.trim()}>
                  {editing ? 'Update my steps' : 'Map my steps'}
                </button>
                {editing && (
                  <button type="button" className="signal-link" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                )}
              </div>
              {!editing && (
                <div className="signal-examples">
                  <p className="signal-caption">Or start from an example</p>
                  {EXAMPLES.map((example) => (
                    <button type="button" className="signal-link" key={example} onClick={() => setDraft(example)}>
                      {example}
                    </button>
                  ))}
                </div>
              )}
            </form>
          ) : (
            <>
              <section className="signal-situation" aria-label="Your situation">
                <p>{active.text}</p>
                <button type="button" className="signal-link" onClick={() => (setDraft(active.text), setEditing(true))}>
                  <Icon name="pencil" /> Edit situation
                </button>
              </section>

              {safety.isActiveEmergency ? (
                // Safety first: an active emergency stops everything. No matching, no plan.
                <section role="alert" className="signal-alert">
                  <h2>{safety.message}</h2>
                  <div className="signal-alert__calls">
                    <a href={HELP_LINES.emergency.href} className="signal-btn signal-btn--primary">
                      {HELP_LINES.emergency.contact}
                    </a>
                    <a href={HELP_LINES.lifeline988.href} className="signal-btn signal-btn--quiet">
                      {HELP_LINES.lifeline988.contact}
                    </a>
                    <a href={HELP_LINES.crisisText.href} className="signal-btn signal-btn--quiet">
                      {HELP_LINES.crisisText.contact}
                    </a>
                  </div>
                  <p>
                    We stopped because you mentioned {[...new Set(safety.matches.map((m) => `“${m.phrase}”`))].join(', ')}. Signal
                    only helps with next steps once you’re safe.
                  </p>
                  {safety.crisisLineMessage && <p>{safety.crisisLineMessage}</p>}
                </section>
              ) : !plan ? (
                // Not enough to go on yet: say what is missing and what would help
                <section className="signal-note">
                  <h2>{matches[0] ? `One detail points to “${matches[0].pattern.name}”` : 'No steps yet'}</h2>
                  <p className="signal-muted">
                    {matches[0]
                      ? 'Signal needs two details that point the same way before it maps a plan. Add one more below.'
                      : 'Nothing here matches a situation Signal knows. Add plain details below: who is with you, what you’ve lost, where you’re staying.'}
                  </p>
                  {matches[0] && <Evidence lit={matches[0].lit} />}
                </section>
              ) : (
                <>
                  <header className="signal-plan-head">
                    <div>
                      <h1>{provisionalPlan && !savedTailoredPlan ? `Starting steps for ${plan.title}` : plan.title}</h1>
                      <p className="signal-caption">
                        {plan.steps.length} steps · {doneIds.size} done · {savedTailoredPlan ? 'AI-tailored' : provisionalPlan ? 'based on one clue' : 'pattern-based'}
                      </p>
                    </div>
                    <div className="signal-plan-head__actions">
                      <button type="button" className="signal-btn signal-btn--quiet" onClick={tailorSteps} disabled={tailoringStatus === 'loading'}>
                        {tailoringStatus === 'loading' ? 'Tailoring steps…' : savedTailoredPlan ? 'Refresh tailored steps' : 'Tailor steps with AI'}
                      </button>
                      <div className="signal-toggle" role="group" aria-label="How to show the plan">
                        <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>
                          Constellation
                        </button>
                        <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
                          Step by step
                        </button>
                      </div>
                    </div>
                  </header>

                  <p className="signal-caption" role="status">
                    {tailoringStatus === 'loading' && 'Your current steps stay available while a more tailored version is prepared.'}
                    {tailoringStatus === 'ready' && 'The tailored plan is ready. Its actions and nearby contacts stay separate.'}
                    {tailoringStatus === 'offline' && 'AI is not configured right now, so Signal is showing its offline plan.'}
                    {tailoringStatus === 'error' && 'Could not reach the plan service. Your offline steps are still ready below.'}
                    {provisionalPlan && tailoringStatus === 'idle' && 'This is a starting plan from one clue. Add another detail to help confirm or refine it.'}
                    {!provisionalPlan && tailoringStatus === 'idle' && 'AI tailoring sends the situation you entered to the Signal plan service only after you choose it.'}
                  </p>

                  {/* What sets this apart from asking a chatbot: where each kind of information comes from */}
                  <ul className="signal-proof">
                    <li>
                      <span className="signal-mono">Places</span> Real locations near you from OpenStreetMap, with directions.
                    </li>
                    <li>
                      <span className="signal-mono">Help lines</span> Every number checked against the organization’s own site.
                    </li>
                    <li>
                      <span className="signal-mono">Reasoning</span> Each step traced to the words you wrote. No AI-written contacts.
                    </li>
                  </ul>

                  <LocationBar place={place} onPlace={setPlace} />

                  {view === 'map' ? (
                    <div className="signal-plan">
                      <div className="signal-map-column">
                        <div className="signal-map-intro">
                          <span className="signal-mono">Your way forward</span>
                          <p>Each star is a step. Follow the line in order, or select a star to see the actions and nearby help for it.</p>
                        </div>
                        {/* The key redraws the constellation when the plan changes */}
                        <PlanConstellation
                          key={`${active.id}-${active.text}-${plan.steps.length}`}
                          steps={plan.steps}
                          selectedId={step!.id}
                          doneIds={doneIds}
                          checked={checked}
                          placesFound={Object.fromEntries(Object.entries(nearby).map(([category, found]) => [category, found.length]))}
                          onSelect={setSelectedStep}
                        />
                      </div>
                      <StepDetail
                        key={step!.id}
                        step={step!}
                        number={plan.steps.indexOf(step!) + 1}
                        checked={checked}
                        onCheck={check}
                        place={place}
                        nearby={nearby[step!.category]}
                      />
                    </div>
                  ) : (
                    <SessionSummary
                      patternName={plan.title}
                      needs={plan.steps.map((s) => s.title)}
                      steps={plan.steps}
                      checked={checked}
                      onCheck={check}
                    />
                  )}

                  <details className="signal-why" open>
                    <summary>Why these steps</summary>
                    {matches.map((match) => (
                      <div key={match.pattern.name}>
                        <p>
                          {match.confirmed ? match.pattern.name : provisionalPlan && match === matches[0] ? `Starting point: ${match.pattern.name}` : `Possible, not in the plan yet: ${match.pattern.name}`}
                          <span className="signal-caption">
                            {' '}
                            · {match.lit.length} of {match.pattern.triggers.length} signs
                          </span>
                        </p>
                        <Evidence lit={match.lit} />
                      </div>
                    ))}
                    {unusedFacts.length > 0 && (
                      <p className="signal-caption">Not used, because no known sign matched: {unusedFacts.map((fact) => `“${fact}”`).join(', ')}</p>
                    )}
                  </details>
                </>
              )}
            </>
          )}

          <details className="signal-why">
            <summary>Help lines, each checked against its official site</summary>
            <ul className="signal-evidence">
              {Object.values(HELP_LINES).map((line) => (
                <li key={line.name}>
                  <span>
                    {line.name} <span className="signal-caption">· {line.about}</span>
                  </span>
                  <span className="signal-places__actions">
                    <a href={line.href}>{line.contact}</a>
                    <a href={line.source} target="_blank" rel="noreferrer">
                      Official site
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </main>

        {active && !editing && !safety.isActiveEmergency && (
          <form className="signal-followup" onSubmit={addDetail}>
            <input
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              aria-label="Add a detail"
              placeholder="Add a detail, for example “I also lost my ID”"
            />
            <button type="submit" className="signal-btn signal-btn--quiet" disabled={!detail.trim()}>
              Add detail
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default App
