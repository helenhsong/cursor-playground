import { useEffect, useRef } from 'react'

const WATER_RAMP = ['.', '·', ':', ';', "'", '`', '~', '-', '=', '+', '*']
const WATER_COLORS = [
  '#18345f',
  '#204575',
  '#2b5689',
  '#38699c',
  '#4a7bad',
  '#6090bd',
  '#79a3c9',
  '#94b5d4',
  '#aec8de',
  '#c7d8e8',
  '#dce6ef',
  '#ecebe4',
  '#f1e2c3',
]
const DITHER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

export function AsciiLake() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return undefined

    const fontSize = 12
    const cellWidth = 8
    const cellHeight = 14
    const ripples = []
    const buckets = new Map()
    const startedAt = performance.now()
    let columns = 0
    let rows = 0
    let width = 0
    let height = 0
    let frameId = 0
    let lastRenderedAt = 0
    let lastRipple = { x: -Infinity, y: -Infinity }

    function resize() {
      const bounds = canvas.parentElement.getBoundingClientRect()
      const nextWidth = Math.max(1, Math.round(bounds.width))
      const nextHeight = Math.max(1, Math.round(bounds.height))
      if (nextWidth === width && nextHeight === height) return

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      width = nextWidth
      height = nextHeight
      columns = Math.ceil(width / cellWidth)
      rows = Math.ceil(height / cellHeight)
      canvas.width = Math.floor(width * pixelRatio)
      canvas.height = Math.floor(height * pixelRatio)
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.font = `600 ${fontSize}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`
      context.textBaseline = 'top'
    }

    function addRipple(x, y, amplitude = 1) {
      ripples.push({ x, y, birth: performance.now(), amplitude })
      if (ripples.length > 90) ripples.shift()
    }

    function handlePointerMove(event) {
      const bounds = canvas.getBoundingClientRect()
      const x = event.clientX - bounds.left
      const y = event.clientY - bounds.top
      const dx = x - lastRipple.x
      const dy = y - lastRipple.y

      if (dx * dx + dy * dy > 22 * 22) {
        lastRipple = { x, y }
        addRipple(x, y, 0.9)
      }
    }

    function handlePointerDown(event) {
      const bounds = canvas.getBoundingClientRect()
      const x = event.clientX - bounds.left
      const y = event.clientY - bounds.top
      lastRipple = { x, y }
      addRipple(x, y, 1.55)
    }

    function handlePointerLeave() {
      lastRipple = { x: -Infinity, y: -Infinity }
    }

    function ambientAt(x, y, time) {
      return (
        0.13 * Math.sin(x * 0.024 + time * 0.75) +
        0.11 * Math.sin(y * 0.038 - time * 0.58) +
        0.08 * Math.sin((x + y) * 0.017 + time * 0.42) +
        0.045 * Math.sin(x * 0.09 - y * 0.035 + time * 0.9)
      )
    }

    function rippleAt(x, y, now) {
      let sum = 0

      for (const ripple of ripples) {
        const age = (now - ripple.birth) / 1000
        if (age > 2.5) continue

        const distance = Math.hypot(x - ripple.x, y - ripple.y)
        const front = distance - age * 180
        if (Math.abs(front) > 48.4) continue

        const envelope = Math.exp(-(front * front) / (2 * 22 * 22))
        const fade = Math.exp(-age / 1.25)
        const distanceFalloff = 1 / (1 + distance * 0.006)
        sum += ripple.amplitude * Math.sin((front / 22) * Math.PI * 2) * envelope * fade * distanceFalloff
      }

      return sum
    }

    function pushGlyph(color, x, y, glyph) {
      if (!buckets.has(color)) buckets.set(color, [])
      buckets.get(color).push([x, y, glyph])
    }

    function drawFrame(frameTime) {
      frameId = requestAnimationFrame(drawFrame)
      if (frameTime - lastRenderedAt < 1000 / 30) return
      lastRenderedAt = frameTime

      const now = performance.now()
      const time = (now - startedAt) / 1000
      context.fillStyle = '#6b91c1'
      context.fillRect(0, 0, width, height)
      buckets.forEach((bucket) => { bucket.length = 0 })

      for (let row = 0; row < rows; row += 1) {
        const y = row * cellHeight
        for (let column = 0; column < columns; column += 1) {
          const x = column * cellWidth
          const ambient = ambientAt(x, y, time)
          const ripple = rippleAt(x, y, now)
          const water = ambient + ripple
          const dither = DITHER[row % 4][column % 4] / 16 - 0.5
          const density = clamp(0.5 + water * 0.34 + dither * 0.12)
          const glyphIndex = Math.min(WATER_RAMP.length - 1, Math.floor(density * WATER_RAMP.length))
          const highlight = clamp(0.46 + water * 0.92)
          const colorIndex = Math.min(WATER_COLORS.length - 1, Math.floor(highlight * WATER_COLORS.length))
          pushGlyph(WATER_COLORS[colorIndex], x, y, WATER_RAMP[glyphIndex])
        }
      }

      for (const [color, glyphs] of buckets) {
        context.fillStyle = color
        for (const [x, y, glyph] of glyphs) context.fillText(glyph, x, y)
      }

      while (ripples.length && now - ripples[0].birth > 2500) ripples.shift()
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas.parentElement)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointerleave', handlePointerLeave)
    resize()
    frameId = requestAnimationFrame(drawFrame)

    return () => {
      cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [])

  return <canvas ref={canvasRef} className="ascii-lake" aria-hidden="true" />
}
