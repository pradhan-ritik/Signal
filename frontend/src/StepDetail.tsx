import { CATEGORIES, directionsUrl, moreNearbyUrl, type Place, type Resource } from './localResources'
import { HELP_LINES } from './nationalResources'
import { checkKey, type Step } from './plan'

const PRIORITY_LABEL = { now: 'Do this now', soon: 'Do this soon', later: 'Do this later' }

type Props = {
  step: Step
  number: number
  checked: Set<string>
  // Ticks or unticks one or more checklist items
  onCheck: (keys: string[], on: boolean) => void
  place: Place | null
  nearby: Resource[] | 'failed' | undefined // undefined while the map is still being asked
}

// The panel beside the constellation: everything about the selected step.
function StepDetail({ step, number, checked, onCheck, place, nearby }: Props) {
  const keys = step.actions.map((_, i) => checkKey(step, i))
  const allDone = keys.every((key) => checked.has(key))
  const category = CATEGORIES[step.category]
  const places = Array.isArray(nearby) ? nearby : []

  return (
    <aside className="signal-detail" aria-label={`Step ${number}`}>
      <p className="signal-mono signal-muted">
        Step {String(number).padStart(2, '0')} · {PRIORITY_LABEL[step.priority]}
      </p>
      <h2>{step.title}</h2>
      <p>{step.summary}</p>

      <h3>Ways to get it done</h3>
      <ul className="signal-checklist">
        {step.actions.map((action, i) => (
          <li key={action}>
            <label>
              <input type="checkbox" checked={checked.has(keys[i])} onChange={(event) => onCheck([keys[i]], event.target.checked)} />
              <span>{action}</span>
            </label>
          </li>
        ))}
      </ul>
      <button type="button" className="signal-btn signal-btn--quiet" onClick={() => onCheck(keys, !allDone)}>
        {allDone ? 'Mark not done' : 'Mark done'}
      </button>

      {step.ideas.length > 0 && (
        <>
          <h3>Worth knowing</h3>
          {step.ideas.map((idea) => (
            <p key={idea} className="signal-muted">
              {idea}
            </p>
          ))}
        </>
      )}

      {/* Real places from the map. Nothing in this section is written by AI. */}
      <h3>Nearby help · {category.label}</h3>
      {!place && <p className="signal-caption">Add your location above the constellation to see places near you.</p>}
      {place && nearby === undefined && <p className="signal-caption">Looking for places near {place.label}…</p>}
      {place && nearby === 'failed' && <p className="signal-caption">The map service did not answer. The help lines below still work.</p>}
      {place && Array.isArray(nearby) && places.length === 0 && (
        <p className="signal-caption">No mapped places of this kind within 10 miles. The help lines below can point you to one.</p>
      )}
      <ul className="signal-places">
        {places.slice(0, 3).map((resource) => (
          <li key={resource.name}>
            <p>{resource.name}</p>
            <p className="signal-caption">
              {resource.distanceMiles !== undefined && `${resource.distanceMiles.toFixed(1)} mi away`}
              {resource.address && ` · ${resource.address}`}
              {resource.openNow !== undefined && ` · ${resource.openNow ? 'Open now' : 'Closed now'}`}
              {resource.hours && ` · Hours: ${resource.hours}`}
            </p>
            <p className="signal-places__actions">
              {resource.phone && <a href={`tel:${resource.phone.replace(/[^+\d]/g, '')}`}>Call {resource.phone}</a>}
              {resource.website && (
                <a href={resource.website} target="_blank" rel="noreferrer">
                  Website
                </a>
              )}
              {resource.lat !== undefined && resource.lng !== undefined && (
                <a href={directionsUrl(resource)} target="_blank" rel="noreferrer">
                  Directions
                </a>
              )}
            </p>
            <p className="signal-caption">
              Source: {resource.sourceUrl ? <a href={resource.sourceUrl} target="_blank" rel="noreferrer">{resource.source}</a> : resource.source}
            </p>
          </li>
        ))}
      </ul>
      {place && (
        <a className="signal-link" href={moreNearbyUrl(step.category, place)} target="_blank" rel="noreferrer">
          More nearby on a map
        </a>
      )}

      <h3>Help lines</h3>
      <ul className="signal-places">
        {category.helpLines.map((key) => (
          <li key={key}>
            <p>{HELP_LINES[key].name}</p>
            <p className="signal-caption">{HELP_LINES[key].about}</p>
            <p className="signal-places__actions">
              <a href={HELP_LINES[key].href}>{HELP_LINES[key].contact}</a>
              <a href={HELP_LINES[key].source} target="_blank" rel="noreferrer">
                Official site
              </a>
            </p>
          </li>
        ))}
      </ul>

      {step.resources.length > 0 && (
        <>
          <h3>Websites mentioned</h3>
          <ul className="signal-resources">
            {step.resources.map((resource) => (
              <li key={resource.url}>
                <a href={resource.url} target="_blank" rel="noreferrer">
                  <span className="signal-mono signal-muted">Link</span>
                  {resource.label}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="signal-caption">Part of: {step.pattern}</p>
    </aside>
  )
}

export default StepDetail
