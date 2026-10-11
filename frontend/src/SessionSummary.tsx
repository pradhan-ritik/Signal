export type SessionSummaryProps = {
  patternName: string
  needs: string[]
  steps?: { id: string; title: string; summary: string; priority: 'now' | 'soon' | 'later'; actions: string[]; ideas: string[] }[]
  checked?: Set<string>
  onCheck?: (keys: string[], on: boolean) => void
}

// The plan as a plain ordered list. It is the list view on screen, what a screen reader
// reads, and the page that prints. Styles, including the print layout, live in index.css.
export function SessionSummary({ patternName, needs, steps, checked = new Set(), onCheck }: SessionSummaryProps) {
  return (
    <article className="signal-session-summary" aria-labelledby="signal-summary-title">
      <header className="signal-session-summary__header">
        <div>
          <h2 id="signal-summary-title">What to do next</h2>
          <p className="signal-muted">Steps for: {patternName}. Keep this with you or share it with someone helping.</p>
        </div>
        <button type="button" className="signal-btn signal-btn--quiet" onClick={() => window.print()} aria-label="Print or save this plan as a PDF">
          Print or save
        </button>
      </header>

      <ol className="signal-session-summary__list">
        {steps?.length
          ? steps.map((step, index) => (
              <li key={step.id} className="signal-session-summary__step">
                <div className="signal-session-summary__step-head">
                  <span className="signal-mono">{String(index + 1).padStart(2, '0')} · {step.priority}</span>
                  <h3>{step.title}</h3>
                </div>
                <p>{step.summary}</p>
                <h4>What to do</h4>
                <ul className="signal-session-summary__actions">
                  {step.actions.map((action, actionIndex) => {
                    const key = `${step.title}|${actionIndex}`
                    return (
                      <li key={key}>
                        <label className="signal-session-summary__action">
                          <input type="checkbox" checked={checked.has(key)} onChange={(event) => onCheck?.([key], event.target.checked)} />
                          <span>{action}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
                {step.ideas.length > 0 && (
                  <p className="signal-session-summary__idea"><strong>Worth knowing:</strong> {step.ideas.join(' ')}</p>
                )}
              </li>
            ))
          : needs.map((need) => <li key={need}>{need}</li>)}
      </ol>

      <p className="signal-caption">If you are in immediate danger, call 911. This tool helps you plan next steps once you’re safe.</p>
    </article>
  )
}

export default SessionSummary
