import { useEffect, useMemo, useRef, useState } from 'react'

export type ConstellationViewProps = {
  facts: string[]
  matchedPatternName: string | null
  confidence: number
}

type Point = { x: number; y: number; phase: number; magnitude: number }
type Edge = { from: number; to: number }

const STAR_COLORS = ['#f2d19a', '#a7dcd4', '#c7b8ec', '#a9cfea', '#f0bfa2']

const DEMO_FACTS = [
  'Water reached the breaker box',
  'The fridge stopped overnight',
  'A strong chemical smell downstairs',
  "I can't find my wallet or transit card",
  'The power company says restoration is uncertain',
]

const DENSE_DEMO_FACTS = [
  'Water reached the breaker box',
  'The fridge stopped overnight',
  'A strong chemical smell downstairs',
  "I can't find my wallet or transit card",
  'The power company says restoration is uncertain',
  'The nearest fuel station is closed',
  'My bus route is on a detour',
  'The community center has charging outlets',
  'A neighbor offered a ride across town',
  'The supply pickup moved to the library',
]

const PAIR_DEMO_FACTS = [
  'The apartment still has power',
  'The only open grocery store is across town',
]

const CONNECTION_DURATION_MS = 1900

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function hashText(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededUnit(seed: number, salt: number) {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

function curvePoint(from: { x: number; y: number }, control: { x: number; y: number }, to: { x: number; y: number }, t: number) {
  const inverse = 1 - t
  return {
    x: inverse * inverse * from.x + 2 * inverse * t * control.x + t * t * to.x,
    y: inverse * inverse * from.y + 2 * inverse * t * control.y + t * t * to.y,
  }
}

/** Splits a label into at most maxLines lines that fit maxWidth, ending in … if cut short. */
function wrapLabel(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const lines: string[] = []
  let line = ''
  let wordIndex = 0
  for (; wordIndex < words.length; wordIndex += 1) {
    const candidate = line ? `${line} ${words[wordIndex]}` : words[wordIndex]
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line)
      line = words[wordIndex]
      if (lines.length === maxLines) break
    } else {
      line = candidate
    }
  }
  if (line && lines.length < maxLines) lines.push(line)

  const truncated = wordIndex < words.length
  if (truncated && lines.length > 0) {
    let lastLine = lines[lines.length - 1]
    while (lastLine.length > 0 && context.measureText(`${lastLine}…`).width > maxWidth) {
      lastLine = lastLine.slice(0, -1).trimEnd()
    }
    lines[lines.length - 1] = `${lastLine}…`
  }
  return lines
}

/** A self-contained, canvas-rendered view of facts becoming a recognized pattern. */
export function ConstellationView({
  facts,
  matchedPatternName,
  confidence,
}: ConstellationViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)
  const progressRef = useRef(0)
  const startTimeRef = useRef<number | null>(null)
  const revealCompleteRef = useRef(false)
  const pointerRef = useRef({ x: 0, y: 0 })
  const [reducedMotion, setReducedMotion] = useState(false)
  const [revealComplete, setRevealComplete] = useState(
    () => !matchedPatternName || facts.length < 2,
  )
  const factCount = facts.length
  const hasFacts = factCount > 0
  const matched = hasFacts && Boolean(matchedPatternName)
  const safeConfidence = Number.isFinite(confidence)
    ? clamp(confidence, 0, 1)
    : 0

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  const points = useMemo<Point[]>(() => {
    if (factCount === 0) return []

    const magnitudeFor = (fact: string, index: number) => {
      // A little more detail reads as a little more visual weight. The stable
      // hash keeps equal-length facts from looking mechanically identical.
      const words = fact.trim().split(/\s+/).filter(Boolean).length
      return 0.88 + clamp(words / 35, 0, 0.24) + seededUnit(hashText(fact), index) * 0.1
    }

    // Six or more facts travel around a broad open orbit: down the left side,
    // across the lower edge, and back up the right. The open top keeps labels
    // clear and gives the shape room to breathe at dense counts.
    if (factCount >= 6) {
      const leftCount = Math.ceil(factCount / 2)
      const rightCount = factCount - leftCount
      return facts.map((_, index) => {
        const isLeft = index < leftCount
        const row = isLeft ? index : rightCount - 1 - (index - leftCount)
        const rows = isLeft ? leftCount : rightCount
        const t = rows <= 1 ? 0.5 : row / (rows - 1)
        const wave = Math.sin((t + 0.12) * Math.PI) * 0.024
        return {
          x: isLeft ? 0.24 - wave : 0.76 + wave,
          y: 0.14 + t * 0.72,
          phase: seededUnit(hashText(facts[index] ?? ''), index + 3) * Math.PI * 2,
          magnitude: magnitudeFor(facts[index] ?? '', index),
        }
      })
    }

    // Hand-composed slots keep labels apart at common demo sizes, while avoiding
    // a rigid grid. Slots are listed in order around the shape, so the outline
    // that connects them never crosses itself.
    const layouts: Record<number, [number, number][]> = {
      2: [[0.27, 0.34], [0.73, 0.66]],
      3: [[0.2, 0.31], [0.8, 0.28], [0.52, 0.73]],
      4: [[0.2, 0.27], [0.79, 0.31], [0.75, 0.72], [0.24, 0.75]],
      5: [[0.18, 0.34], [0.48, 0.19], [0.82, 0.32], [0.75, 0.72], [0.25, 0.77]],
    }
    const layout = layouts[factCount]
    if (layout) {
      return facts.map((_, index) => ({
        x: layout[index][0],
        y: layout[index][1],
        phase: seededUnit(hashText(facts[index] ?? ''), index + 3) * Math.PI * 2,
        magnitude: magnitudeFor(facts[index] ?? '', index),
      }))
    }

    return facts.map((_, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / factCount
      const irregularity = 0.9 + seededUnit(hashText(facts[index] ?? ''), index) * 0.12
      return {
        x: 0.5 + Math.cos(angle) * 0.32 * irregularity,
        y: 0.5 + Math.sin(angle) * 0.34 * irregularity,
        phase: seededUnit(hashText(facts[index] ?? ''), index + 3) * Math.PI * 2,
        magnitude: magnitudeFor(facts[index] ?? '', index),
      }
    })
  }, [factCount, facts])

  const edges = useMemo<Edge[]>(() => {
    if (points.length < 2) return []
    if (points.length === 2) return [{ from: 0, to: 1 }]
    // Dense sets zigzag between two columns; closing that path would cut across it.
    if (points.length >= 6) return points.slice(1).map((_, index) => ({ from: index, to: index + 1 }))
    // A closed path lets the final connection complete a clearly recognizable shape.
    return points.map((_, index) => ({ from: index, to: (index + 1) % points.length }))
  }, [points])

  useEffect(() => {
    const shouldAnimate = matched && edges.length > 0 && !reducedMotion
    progressRef.current = shouldAnimate ? 0 : matched && edges.length > 0 ? 1 : 0
    startTimeRef.current = null
    revealCompleteRef.current = !shouldAnimate
    setRevealComplete(!shouldAnimate)
  }, [matchedPatternName, factCount, matched, edges.length, reducedMotion])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    let width = 0
    let height = 0
    let dpr = 1

    const paint = (now: number) => {
      if (!width || !height) return

      if (matched && edges.length > 0 && !reducedMotion) {
        if (startTimeRef.current === null) startTimeRef.current = now
        const rawProgress = clamp((now - startTimeRef.current) / CONNECTION_DURATION_MS, 0, 1)
        // Smoothstep preserves a gentle start and finish while the full reveal takes 1.9s.
        progressRef.current = rawProgress * rawProgress * (3 - 2 * rawProgress)
        if (rawProgress >= 1 && !revealCompleteRef.current) {
          revealCompleteRef.current = true
          setRevealComplete(true)
        }
      }
      const reveal = progressRef.current
      const time = now / 1000

      context.clearRect(0, 0, width, height)
      const background = context.createLinearGradient(0, 0, width, height)
      background.addColorStop(0, '#09171d')
      background.addColorStop(0.5, '#0a1720')
      background.addColorStop(1, '#11151e')
      context.fillStyle = background
      context.fillRect(0, 0, width, height)

      const atmosphere = context.createRadialGradient(width * 0.49, height * 0.48, 0, width * 0.49, height * 0.48, Math.max(width, height) * 0.76)
      atmosphere.addColorStop(0, 'rgba(75, 127, 127, 0.075)')
      atmosphere.addColorStop(0.54, 'rgba(31, 63, 76, 0.045)')
      atmosphere.addColorStop(1, 'rgba(1, 7, 12, 0.42)')
      context.fillStyle = atmosphere
      context.fillRect(0, 0, width, height)

      // Wide, soft color clouds sit behind the chart like distant interstellar
      // dust. Their drift is deliberately slow enough to read as atmosphere.
      const pointer = reducedMotion ? { x: 0, y: 0 } : pointerRef.current
      const cloudShiftX = Math.sin(time * 0.035) * width * 0.012 + pointer.x * width * 0.014
      const cloudShiftY = Math.cos(time * 0.03) * height * 0.012 + pointer.y * height * 0.014
      const clouds = [
        { x: 0.23, y: 0.3, rx: 0.34, ry: 0.35, color: 'rgba(70, 147, 148, 0.085)' },
        { x: 0.76, y: 0.68, rx: 0.31, ry: 0.4, color: 'rgba(115, 89, 143, 0.07)' },
        { x: 0.52, y: 0.88, rx: 0.42, ry: 0.28, color: 'rgba(177, 131, 86, 0.045)' },
      ]
      clouds.forEach((cloud, index) => {
        const drift = index % 2 === 0 ? 1 : -1
        const cx = width * cloud.x + cloudShiftX * drift
        const cy = height * cloud.y + cloudShiftY * drift
        context.save()
        context.translate(cx, cy)
        context.scale(cloud.rx * width, cloud.ry * height)
        const haze = context.createRadialGradient(0, 0, 0.02, 0, 0, 1)
        haze.addColorStop(0, cloud.color)
        haze.addColorStop(0.48, cloud.color.replace(/0\.0\d+\)/, '0.025)'))
        haze.addColorStop(1, 'rgba(0, 0, 0, 0)')
        context.fillStyle = haze
        context.fillRect(-1, -1, 2, 2)
        context.restore()
      })

      // Faint chart rings and registration marks make the field feel surveyed,
      // while leaving the facts themselves unconnected until a match is made.
      context.save()
      context.strokeStyle = 'rgba(184, 202, 194, 0.055)'
      context.lineWidth = 1
      for (const fraction of [0.18, 0.31, 0.44]) {
        context.beginPath()
        context.ellipse(width * 0.5, height * 0.51, width * fraction, height * fraction * 0.56, -0.12, 0, Math.PI * 2)
        context.stroke()
      }
      context.strokeStyle = 'rgba(207, 218, 204, 0.12)'
      for (const [x, y, sx, sy] of [[18, 18, 1, 1], [width - 18, 18, -1, 1], [18, height - 18, 1, -1], [width - 18, height - 18, -1, -1]] as const) {
        context.beginPath()
        context.moveTo(x, y + sy * 10)
        context.lineTo(x, y)
        context.lineTo(x + sx * 10, y)
        context.stroke()
      }
      context.restore()

      // Quiet field stars give the canvas depth without competing with the facts.
      // A lone star gets a fuller sky so the canvas never looks empty.
      const fieldStars = factCount <= 1 ? 150 : 76
      for (let i = 0; i < fieldStars; i += 1) {
        const seed = i + 37
        const depth = i % 7 === 0 ? 0.32 : i % 3 === 0 ? 0.62 : 1
        const drift = reducedMotion ? 0 : Math.sin(time * (0.025 + depth * 0.018) + i * 1.7) * (1 - depth) * 6
        const x = seededUnit(seed, 1) * width + drift + pointer.x * width * (1 - depth) * 0.018
        const y = seededUnit(seed, 2) * height + Math.cos(time * 0.025 + i) * (1 - depth) * 4 + pointer.y * height * (1 - depth) * 0.018
        const twinkle = (reducedMotion ? 0.28 : 0.2 + (Math.sin(time * 0.58 + i * 2.1) + 1) * 0.11) * depth
        const radius = (i % 13 === 0 ? 1.1 : 0.58 + seededUnit(seed, 3) * 0.34) * (depth === 0.32 ? 0.76 : 1)
        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fillStyle = i % 11 === 0
          ? `rgba(238, 199, 143, ${twinkle})`
          : i % 7 === 0
            ? `rgba(160, 213, 204, ${twinkle})`
            : `rgba(179, 202, 218, ${twinkle})`
        context.shadowColor = context.fillStyle
        context.shadowBlur = depth < 0.5 ? 4 : i % 5 === 0 ? 2 : 0
        context.fill()
        if (i % 17 === 0 && depth > 0.5) {
          context.strokeStyle = `rgba(205, 220, 215, ${twinkle * 0.45})`
          context.lineWidth = 0.55
          context.beginPath()
          context.moveTo(x - 2.8, y)
          context.lineTo(x + 2.8, y)
          context.moveTo(x, y - 2.8)
          context.lineTo(x, y + 2.8)
          context.stroke()
        }
      }
      context.shadowBlur = 0

      const pixelPoints = points.map((point) => ({ x: point.x * width, y: point.y * height }))
      const lineAlpha = 0.1 + safeConfidence * 0.74
      const lineWidth = 0.8 + safeConfidence * 1.65

      edges.forEach((edge, index) => {
        const from = pixelPoints[edge.from]
        const to = pixelPoints[edge.to]
        const dx = to.x - from.x
        const dy = to.y - from.y
        const distance = Math.hypot(dx, dy)
        const bend = Math.min(width, height) * (points.length === 2 ? 0.095 : 0.045)
        const bendSign = index % 2 === 0 ? 1 : -1
        const control = {
          x: (from.x + to.x) / 2 - (dy / (distance || 1)) * bend * bendSign,
          y: (from.y + to.y) / 2 + (dx / (distance || 1)) * bend * bendSign,
        }
        // Reveal connections in order; the name appears on the frame the last line completes.
        const edgeProgress = clamp(reveal * edges.length - index, 0, 1)
        if (edgeProgress <= 0) return
        const sampled = Math.max(1, Math.ceil(36 * edgeProgress))
        const trail = Array.from({ length: sampled + 1 }, (_, pointIndex) =>
          curvePoint(from, control, to, edgeProgress * pointIndex / sampled),
        )
        const head = trail[trail.length - 1]
        const gradient = context.createLinearGradient(from.x, from.y, to.x, to.y)
        gradient.addColorStop(0, `rgba(249, 212, 151, ${lineAlpha * edgeProgress})`)
        gradient.addColorStop(0.48, `rgba(132, 194, 190, ${lineAlpha * 0.58 * edgeProgress})`)
        gradient.addColorStop(1, `rgba(220, 200, 157, ${lineAlpha * 0.9 * edgeProgress})`)
        context.beginPath()
        trail.forEach((point, pointIndex) => {
          if (pointIndex === 0) context.moveTo(point.x, point.y)
          else context.lineTo(point.x, point.y)
        })
        context.strokeStyle = gradient
        context.lineWidth = lineWidth
        context.lineCap = 'round'
        context.shadowColor = `rgba(173, 222, 208, ${0.5 * safeConfidence * edgeProgress})`
        context.shadowBlur = 10 * safeConfidence
        context.stroke()
        context.shadowBlur = 0

        // A warm point of light travels with the reveal, then settles into the star.
        if (edgeProgress < 1) {
          const headGlow = context.createRadialGradient(head.x, head.y, 0, head.x, head.y, 11)
          headGlow.addColorStop(0, `rgba(255, 241, 204, ${0.88 * safeConfidence})`)
          headGlow.addColorStop(0.28, `rgba(207, 238, 220, ${0.52 * safeConfidence})`)
          headGlow.addColorStop(1, 'rgba(180, 216, 213, 0)')
          context.fillStyle = headGlow
          context.beginPath()
          context.arc(head.x, head.y, 11, 0, Math.PI * 2)
          context.fill()
        }
      })

      points.forEach((point, index) => {
        const { x, y } = pixelPoints[index]
        const pulse = reducedMotion ? 0 : Math.sin(time * 0.9 + point.phase) * 0.17
        const color = STAR_COLORS[index % STAR_COLORS.length]
        const solo = factCount === 1
        const radius = (3 + point.magnitude * 0.9 + pulse + reveal * 0.35) * (solo ? 1.18 : 1)
        const glowRadius = (solo ? 54 : 32) * point.magnitude
        if (solo) {
          // A slow expanding ring shows the lone star is active and waiting for more facts.
          const ring = reducedMotion ? 0.5 : (time * 0.45) % 1
          context.beginPath()
          context.arc(x, y, 12 + ring * 36, 0, Math.PI * 2)
          context.strokeStyle = `rgba(190, 220, 206, ${(1 - ring) * 0.46})`
          context.lineWidth = 1
          context.stroke()
        }
        const outerHalo = context.createRadialGradient(x, y, 0, x, y, glowRadius)
        outerHalo.addColorStop(0, `${color}${Math.round((0.26 + reveal * 0.14 + pulse * 0.08) * 255).toString(16).padStart(2, '0')}`)
        outerHalo.addColorStop(0.28, 'rgba(107, 169, 163, 0.13)')
        outerHalo.addColorStop(0.68, 'rgba(76, 130, 150, 0.035)')
        outerHalo.addColorStop(1, 'rgba(68, 130, 150, 0)')
        context.fillStyle = outerHalo
        context.beginPath()
        context.arc(x, y, glowRadius, 0, Math.PI * 2)
        context.fill()

        const innerHalo = context.createRadialGradient(x, y, radius * 0.45, x, y, radius * 4.2)
        innerHalo.addColorStop(0, 'rgba(255, 248, 222, 0.42)')
        innerHalo.addColorStop(0.34, `${color}70`)
        innerHalo.addColorStop(1, `${color}00`)
        context.fillStyle = innerHalo
        context.beginPath()
        context.arc(x, y, radius * 4.2, 0, Math.PI * 2)
        context.fill()

        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fillStyle = color
        context.shadowColor = color
        context.shadowBlur = 12 + point.magnitude * 6 + pulse * 5
        context.fill()
        context.shadowBlur = 0
        context.beginPath()
        context.arc(x - radius * 0.16, y - radius * 0.16, Math.max(0.9, radius * 0.28), 0, Math.PI * 2)
        context.fillStyle = 'rgba(255, 255, 241, 0.94)'
        context.fill()

        const compact = factCount >= 6
        const labelWidth = compact
          ? Math.min(width * 0.3, 210)
          : Math.min(width * 0.38, 210)
        const lineHeight = compact ? 15 : 18
        const maxLines = compact ? 2 : 3
        context.font = compact
          ? '500 12px "IBM Plex Sans", sans-serif'
          : '500 13px "IBM Plex Sans", sans-serif'
        context.textBaseline = 'top'
        context.textAlign = 'left'
        context.fillStyle = 'rgba(238, 239, 225, 0.97)'
        context.shadowColor = 'rgba(2, 8, 18, 0.9)'
        context.shadowBlur = 7

        const lines = wrapLabel(context, facts[index] ?? '', labelWidth, maxLines)
        const blockHeight = lines.length * lineHeight
        const blockWidth = Math.max(0, ...lines.map((line) => context.measureText(line).width))

        let labelX: number
        let labelY: number
        if (compact) {
          const onLeft = x < width * 0.5
          labelX = onLeft ? x + 12 : x - 12
          context.textAlign = onLeft ? 'left' : 'right'
          labelY = clamp(y - blockHeight / 2, 12, height - blockHeight - 12)
        } else if (factCount === 1) {
          labelX = x
          labelY = y + 28
          context.textAlign = 'center'
        } else {
          // Labels sit outside the shape: above the upper stars and below the lower ones,
          // so the connecting lines never run through the words.
          const onLeft = x < width * 0.5
          labelX = onLeft ? x - 5 : x + 5
          context.textAlign = onLeft ? 'left' : 'right'
          const above = y - 15 - blockHeight
          labelY = y < height * 0.5 && above >= 50 ? above : Math.min(y + 15, height - blockHeight - 46)
        }

        // A soft plate behind the words keeps them readable if a line still passes underneath.
        const plateX = context.textAlign === 'left' ? labelX : context.textAlign === 'right' ? labelX - blockWidth : labelX - blockWidth / 2
        context.shadowBlur = 0
        context.fillStyle = 'rgba(9, 22, 28, 0.82)'
        context.fillRect(plateX - 6, labelY - 4, blockWidth + 12, blockHeight + 6)
        context.fillStyle = 'rgba(238, 239, 225, 0.97)'
        lines.forEach((line, lineIndex) => context.fillText(line, labelX, labelY + lineIndex * lineHeight))
        context.shadowBlur = 0
      })

      // Keep the slow star pulse alive while idle and after the constellation resolves.
      if (!reducedMotion || (matched && edges.length > 0 && reveal < 1)) {
        frameRef.current = requestAnimationFrame(paint)
      }
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      width = rect.width
      height = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      cancelAnimationFrame(frameRef.current)
      frameRef.current = requestAnimationFrame(paint)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      pointerRef.current = {
        x: clamp((event.clientX - rect.left) / rect.width - 0.5, -0.5, 0.5),
        y: clamp((event.clientY - rect.top) / rect.height - 0.5, -0.5, 0.5),
      }
    }
    const handlePointerLeave = () => {
      pointerRef.current = { x: 0, y: 0 }
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas.parentElement ?? canvas)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerleave', handlePointerLeave)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(frameRef.current)
      observer.disconnect()
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerleave', handlePointerLeave)
      window.removeEventListener('resize', resize)
    }
  }, [edges, facts, factCount, matched, points, reducedMotion, safeConfidence])

  // One fact is never enough to name a pattern
  const showPatternName = matched && factCount >= 2 && revealComplete

  return (
    <section className="signal-constellation" data-dense={factCount >= 6} aria-label="Situation constellation">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap');
        .signal-constellation, .signal-constellation * { box-sizing: border-box; }
        .signal-constellation { position: relative; isolation: isolate; width: 100%; min-width: 0; max-width: 100%; min-height: 440px; height: min(68vh, 650px); overflow: hidden; border: 1px solid rgba(183, 198, 181, .19); border-radius: 2px; background: #09171d; color: #f1f0e8; font-family: 'IBM Plex Sans', sans-serif; box-shadow: 0 28px 90px rgba(1, 8, 12, .24); }
        .signal-constellation canvas { display: block; width: 100%; max-width: 100%; height: 100%; }
        .signal-constellation__eyebrow { position: absolute; z-index: 1; top: 25px; left: 29px; display: flex; align-items: center; gap: 10px; color: #d2d6c9; font-size: 10px; font-weight: 700; letter-spacing: .19em; text-transform: uppercase; }
        .signal-constellation__eyebrow::before { width: 7px; height: 7px; border-radius: 50%; background: #c7a86d; box-shadow: 0 0 12px rgba(223, 187, 125, .65); content: ''; }
        .signal-constellation__status { position: absolute; z-index: 1; bottom: 24px; left: 29px; display: flex; align-items: center; gap: 10px; color: #d2d6c9; font-size: 13px; letter-spacing: .01em; }
        .signal-constellation__status::before { width: 22px; height: 1px; background: #c7a86d; content: ''; }
        .signal-constellation__name { position: absolute; z-index: 1; top: 20px; right: 25px; display: grid; justify-items: end; gap: 4px; max-width: 52%; color: #f2dbad; text-align: right; text-shadow: 0 0 30px rgba(214, 174, 112, .27); opacity: 0; transform: translateY(7px); animation: signal-name-in 580ms cubic-bezier(.16, 1, .3, 1) forwards; }
        .signal-constellation[data-dense="true"] .signal-constellation__name { right: 34%; left: 34%; justify-items: center; max-width: none; text-align: center; }
        .signal-constellation__name small { color: #c5c4b4; font-size: 9px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; }
        .signal-constellation__name strong { font-family: 'Instrument Serif', Georgia, serif; font-size: clamp(22px, 2.7vw, 31px); font-weight: 400; letter-spacing: -.015em; line-height: 1.05; }
        .signal-constellation__waiting { position: absolute; inset: 0; display: grid; align-content: center; justify-items: center; gap: 11px; padding: 85px 24px; text-align: center; pointer-events: none; }
        .signal-constellation__waiting-mark { display: grid; width: 56px; height: 56px; place-items: center; margin-bottom: 4px; border: 1px solid rgba(193, 205, 184, .19); border-radius: 50%; background: radial-gradient(circle, rgba(181, 190, 145, .11), rgba(9, 23, 29, .28) 70%); color: #d9bd83; box-shadow: 0 0 42px rgba(108, 156, 143, .08), inset 0 0 20px rgba(163, 198, 167, .045); }
        .signal-constellation__waiting-mark svg { width: 23px; height: 23px; }
        .signal-constellation__waiting strong { color: #f1f0e8; font-family: 'Instrument Serif', Georgia, serif; font-size: clamp(26px, 3.4vw, 34px); font-weight: 400; letter-spacing: -.015em; }
        .signal-constellation__waiting span { max-width: 300px; color: #c6cbc1; font-size: 14px; line-height: 1.55; }
        @keyframes signal-name-in { 0% { opacity: 0; transform: translateY(7px); filter: blur(3px); } 72% { filter: blur(0); } 100% { opacity: 1; transform: translateY(0); filter: blur(0); } }
        @media (max-width: 600px) { .signal-constellation { min-height: 520px; height: 68vh; border-radius: 2px; } .signal-constellation__eyebrow { top: 20px; left: 18px; } .signal-constellation__name { top: 45px; left: 18px; right: 18px; max-width: none; justify-items: start; text-align: left; } .signal-constellation[data-dense="true"] .signal-constellation__name { left: 32%; right: 32%; justify-items: center; text-align: center; } .signal-constellation__status { left: 18px; bottom: 18px; } }
        @media (prefers-reduced-motion: reduce) { .signal-constellation__name { animation-duration: 1ms; } }
      `}</style>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={
          !hasFacts
            ? 'Waiting for situation facts'
            : matched && edges.length > 0 && revealComplete
              ? `Facts connected as ${matchedPatternName}`
              : factCount === 1
                ? 'One situation fact shown as a glowing star'
                : 'Situation facts shown as unconnected stars'
        }
      />
      <span className="signal-constellation__eyebrow">Signal / Field notes</span>
      {!hasFacts && (
        <div className="signal-constellation__waiting" aria-live="polite">
          <div className="signal-constellation__waiting-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 2.8v6.1m0 6.2v6.1m9.2-9.2h-6.1m-6.2 0H2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".55" />
              <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="12" cy="12" r=".8" fill="currentColor" />
            </svg>
          </div>
          <strong>Start with what you know.</strong>
          <span>A few details can make the next step easier to see.</span>
        </div>
      )}
      {showPatternName && (
        <div className="signal-constellation__name" key={matchedPatternName}>
          <small>Your pattern</small>
          <strong>{matchedPatternName}</strong>
        </div>
      )}
      <span className="signal-constellation__status" aria-live="polite">
        {!hasFacts
          ? 'Ready when you are'
          : matched
            ? edges.length === 0
              ? 'One point on the map · add another detail when you’re ready'
              : revealComplete
                ? 'Pattern recognized'
                : 'Connections are coming into view'
            : factCount === 1
              ? 'One point on the map · add another detail when you’re ready'
              : 'Your facts, gathered in one place'}
      </span>
    </section>
  )
}

/** Standalone visual sandbox for empty, single, typical, and dense fact sets. */
export function ConstellationViewDemo() {
  const [scenario, setScenario] = useState<'empty' | 'single' | 'pair' | 'typical' | 'dense'>('typical')
  const [matched, setMatched] = useState(false)
  const facts =
    scenario === 'empty'
      ? []
      : scenario === 'single'
        ? ["I can't find my wallet or transit card"]
        : scenario === 'pair'
          ? PAIR_DEMO_FACTS
        : scenario === 'dense'
          ? DENSE_DEMO_FACTS
          : DEMO_FACTS

  return (
    <div className="signal-constellation-demo">
      <style>{`
        .signal-constellation-demo { display: grid; gap: 12px; width: 100%; }
        .signal-constellation-demo__controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: #b9c9df; font: 12px Inter, ui-sans-serif, system-ui, sans-serif; }
        .signal-constellation-demo__controls button { border: 1px solid rgba(141, 169, 213, .24); border-radius: 999px; padding: 7px 11px; background: #0b1525; color: #dce8f8; font: inherit; cursor: pointer; }
        .signal-constellation-demo__controls button[aria-pressed="true"] { border-color: rgba(112, 184, 255, .68); background: #13253a; color: #fff; }
        .signal-constellation-demo__controls button:focus-visible { outline: 2px solid #82c7ff; outline-offset: 2px; }
      `}</style>
      <div className="signal-constellation-demo__controls" aria-label="Constellation demo controls">
        {(['empty', 'single', 'pair', 'typical', 'dense'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={scenario === option}
            onClick={() => {
              setScenario(option)
              setMatched(false)
            }}
          >
            {option === 'empty' ? 'No facts' : option === 'single' ? 'One fact' : option === 'pair' ? 'Two facts' : option === 'typical' ? 'Five facts' : 'Ten facts'}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={matched}
          disabled={scenario === 'empty'}
          onClick={() => setMatched((value) => !value)}
        >
          {matched ? 'Scatter facts' : 'Reveal pattern'}
        </button>
      </div>
      <ConstellationView
        facts={facts}
        matchedPatternName={matched ? 'Unsafe power after flooding' : null}
        confidence={0.82}
      />
    </div>
  )
}

export default ConstellationView
