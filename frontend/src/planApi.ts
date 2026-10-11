import type { Plan, Step } from './plan'
import { API_BASE } from './api'

type StreamInput = {
  situation: string
  situationHints: string[]
  fallbackPlan: Plan
  onSteps: (steps: Step[]) => void
  onFallback: () => void
  onReset: () => void
}

type ApiStep = {
  id: string
  title: string
  summary: string
  priority: Step['priority']
  dependsOn: string[]
  actions: string[]
  ideas: string[]
  resourceNeeds: { category: string; query: string }[]
  pattern?: string | null
}

type ApiPlan = { title: string; steps: ApiStep[]; source?: 'ai' | 'offline-fallback' }

function toStep(step: ApiStep): Step {
  return {
    id: step.id,
    title: step.title,
    summary: step.summary,
    priority: step.priority,
    dependsOn: step.dependsOn,
    actions: step.actions,
    ideas: step.ideas,
    resources: [],
    category: step.resourceNeeds[0]?.category ?? 'community',
    resourceQuery: step.resourceNeeds[0]?.query,
    pattern: step.pattern ?? 'Tailored plan',
  }
}

// Reads the API's server-sent events as they arrive. Each step is validated on the
// server before it is sent; the existing local plan remains on screen until then.
export async function streamTailoredPlan({ situation, situationHints, fallbackPlan, onSteps, onFallback, onReset }: StreamInput) {
  const response = await fetch(`${API_BASE}/api/plan/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      situation,
      situationHints,
      fallbackPlan,
      allowExternalAI: true,
      crisisDetected: false,
    }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!response.ok) throw new Error(`Plan service returned ${response.status}`)
  if (!response.body) throw new Error('Plan service did not return a stream')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let steps: Step[] = []
  let completed: Plan | null = null
  let usedFallback = false

  function processEvents() {
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() ?? ''
    for (const block of blocks) {
      const event = block.match(/^event:\s*(.+)$/m)?.[1]?.trim()
      const raw = block.match(/^data:\s*(.+)$/m)?.[1]
      if (!event || !raw) continue
      const payload = JSON.parse(raw) as ApiStep | ApiPlan | { message?: string }
      if (event === 'fallback') {
        usedFallback = true
        onFallback()
        steps = []
      } else if (event === 'reset') {
        usedFallback = false
        steps = []
        onReset()
      } else if (event === 'step') {
        steps = [...steps, toStep(payload as ApiStep)]
        if (!usedFallback) onSteps(steps)
      } else if (event === 'complete') {
        const value = payload as ApiPlan
        if (value.steps?.length) completed = { title: value.title, steps: value.steps.map(toStep) }
      }
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    processEvents()
  }
  buffer += decoder.decode()
  processEvents()
  if (!completed) throw new Error('Plan stream ended before a complete plan arrived')
  return { plan: completed, usedFallback }
}
