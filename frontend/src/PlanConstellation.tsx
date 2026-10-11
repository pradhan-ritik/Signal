import { useEffect, useState } from 'react'
import { checkKey, type Step } from './plan'

const ROW_HEIGHT = 190 // pixels for each row of stars
const DOT_SIZE = { now: 18, soon: 13, later: 9 } // star diameter by priority

// A fixed up-or-down nudge per star, so the same plan always draws the same shape
const nudge = (index: number) => Math.round(Math.sin(index * 2.4 + 1) * 30)

type Props = {
  steps: Step[]
  selectedId: string
  doneIds: Set<string>
  checked: Set<string> // ticked checklist items, so finished actions draw hollow
  placesFound: Record<string, number> // how many nearby places were found for each category
  onSelect: (id: string) => void
}

// The plan drawn as a constellation: one star per step, joined in order by thin lines.
// Around each star sit its satellites: a square per action, a circle per idea, a diamond per nearby place.
// Stars are real buttons, so the keyboard and screen readers can use them.
function PlanConstellation({ steps, selectedId, doneIds, checked, placesFound, onSelect }: Props) {
  // Wide screens fit four stars in a row; phones fit two
  const [perRow, setPerRow] = useState(4)
  useEffect(() => {
    const phone = window.matchMedia('(max-width: 720px)')
    const update = () => setPerRow(phone.matches ? 2 : 4)
    update()
    phone.addEventListener('change', update)
    return () => phone.removeEventListener('change', update)
  }, [])

  // Rows alternate direction (left to right, then right to left) so the line snakes down
  // the page and never has to jump back across it.
  const points = steps.map((_, i) => {
    const row = Math.floor(i / perRow)
    const column = row % 2 === 0 ? i % perRow : perRow - 1 - (i % perRow)
    return {
      x: ((column + 0.5) / perRow) * 100, // percent of the width
      y: row * ROW_HEIGHT + ROW_HEIGHT / 2 + nudge(i), // pixels from the top
      // The last star in a row has a line dropping down from it, so its label goes above instead
      labelAbove: i % perRow === perRow - 1 && i < steps.length - 1,
    }
  })
  const selected = steps.findIndex((step) => step.id === selectedId)
  // Keep the whole constellation reveal around two seconds, whether it has three
  // steps or ten, so the connecting path is easy to notice during a demo.
  const linkStagger = steps.length > 1 ? Math.min(230, 1500 / (steps.length - 1)) : 0

  // Arrow keys move to the next or previous star
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const move = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0
    const next = steps[selected + move]
    if (move === 0 || !next) return
    event.preventDefault()
    onSelect(next.id)
    event.currentTarget.querySelectorAll('button')[selected + move].focus()
  }

  return (
    <div
      className="signal-map"
      role="group"
      aria-label="Your steps as a constellation. Use the arrow keys to move between steps."
      style={{ height: Math.ceil(steps.length / perRow) * ROW_HEIGHT, '--per-row': perRow } as React.CSSProperties}
      onKeyDown={onKeyDown}
    >
      <svg aria-hidden="true">
        {points.slice(1).map((point, i) => (
          <line
            key={steps[i + 1].id}
            x1={`${points[i].x}%`}
            y1={points[i].y}
            x2={`${point.x}%`}
            y2={point.y}
            pathLength={1}
            className={i === selected || i + 1 === selected ? 'is-active' : undefined}
            style={{ animationDelay: `${(i + 1) * linkStagger}ms` }}
          />
        ))}

        {/* Sparkle: a tiny solid point of light travels along each link */}
        {points.slice(1).map((point, i) => (
          <line
            key={`spark-${steps[i + 1].id}`}
            x1={`${points[i].x}%`}
            y1={points[i].y}
            x2={`${point.x}%`}
            y2={point.y}
            pathLength={1}
            className={i === selected || i + 1 === selected ? 'signal-spark is-active' : 'signal-spark'}
            style={{ animationDelay: `${i * -1.3}s` }}
          />
        ))}

        {/* Satellites fan out on the side of the star away from its label */}
        {steps.map((step, i) => {
          const satellites = [
            ...step.actions.map((_, a) => (checked.has(checkKey(step, a)) ? 'action is-done' : 'action')),
            ...step.ideas.map(() => 'idea'),
            ...Array.from({ length: Math.min(placesFound[step.category] ?? 0, 3) }, () => 'place'),
          ]
          const middle = points[i].labelAbove ? 90 : -90 // degrees: straight down or straight up
          return (
            <svg key={step.id} x={`${points[i].x}%`} y={points[i].y} className={step.id === selectedId ? 'signal-orbit is-selected' : 'signal-orbit'}>
              {satellites.map((kind, n) => {
                const angle = ((middle - 75 + (150 / (satellites.length + 1)) * (n + 1)) * Math.PI) / 180
                const distance = n % 2 === 0 ? 34 : 46
                const x = Math.cos(angle) * distance
                const y = Math.sin(angle) * distance
                return (
                  <g key={n} className={`is-${kind}`} style={{ animationDelay: `${(i * 3 + n) * -0.9}s` }}>
                    <line x1={0} y1={0} x2={x} y2={y} />
                    {kind === 'idea' ? (
                      <circle cx={x} cy={y} r={2.5} />
                    ) : (
                      <rect x={x - 2.5} y={y - 2.5} width={5} height={5} transform={kind === 'place' ? `rotate(45 ${x} ${y})` : undefined} />
                    )}
                  </g>
                )
              })}
            </svg>
          )
        })}
      </svg>

      {steps.map((step, i) => (
        <button
          key={step.id}
          type="button"
          className={[
            'signal-star',
            step.id === selectedId && 'is-selected',
            doneIds.has(step.id) && 'is-done',
            points[i].labelAbove && 'is-above',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ left: `${points[i].x}%`, top: points[i].y, animationDelay: `${i * 120}ms` }}
          aria-label={`Step ${i + 1} of ${steps.length}: ${step.title}${doneIds.has(step.id) ? ' (done)' : ''}`}
          aria-pressed={step.id === selectedId}
          onClick={() => onSelect(step.id)}
        >
          <span className="signal-star__hit">
            <span
              className="signal-star__dot"
              style={{ width: DOT_SIZE[step.priority], height: DOT_SIZE[step.priority], animationDelay: `${i * 120}ms, ${760 + i * 120}ms` }}
            />
          </span>
          <span className="signal-star__label">
            <span className="signal-mono">{String(i + 1).padStart(2, '0')}</span> {step.title}
          </span>
        </button>
      ))}
    </div>
  )
}

export default PlanConstellation
