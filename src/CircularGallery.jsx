import { useEffect, useMemo, useRef, useState } from 'react'

const DEFAULT_CARD = { width: 40, height: 45, radius: 0 }
const DEFAULT_SCROLL_SENSITIVITY = 5
const DEFAULT_SMOOTHING = 10
const TAU = Math.PI * 2
const FOCUS_ANGLE = (Math.PI * 3) / 2
const CARD_PERSPECTIVE = 1000
const STAGE_PERSPECTIVE = 2000
const HOVER_LERP = 0.15
const HOVER_RESTORE_LERP = 0.065
const HOVER_REACH = 5
const HOVER_STRENGTH = 5
const HOVER_PARALLAX = 5
const ENTRY_CARDS = 2
const TOUCH_GAIN = 2.2
const WHEEL_CLAMP = 400
const PLACEHOLDER_COUNT = 12
const RING_FIT = 0.8
const DEFAULT_AMBIENT_PALETTE = [[232, 226, 232], [225, 232, 237]]
const AMBIENT_COLOR_LERP = 0.075

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function smoothstep(value) {
  return value * value * (3 - 2 * value)
}

function mixWithWhite(value, amount) {
  return Math.round(value + (255 - value) * amount)
}

function colorToCss(color) {
  return `rgb(${color.map((channel) => Math.round(channel)).join(' ')})`
}

function hslToRgb(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const hueSection = (((hue % 360) + 360) % 360) / 60
  const secondary = chroma * (1 - Math.abs((hueSection % 2) - 1))
  let color = [0, 0, 0]

  if (hueSection < 1) color = [chroma, secondary, 0]
  else if (hueSection < 2) color = [secondary, chroma, 0]
  else if (hueSection < 3) color = [0, chroma, secondary]
  else if (hueSection < 4) color = [0, secondary, chroma]
  else if (hueSection < 5) color = [secondary, 0, chroma]
  else color = [chroma, 0, secondary]

  const match = lightness - chroma / 2
  return color.map((channel) => Math.round((channel + match) * 255))
}

function sampleImagePalette(image) {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return DEFAULT_AMBIENT_PALETTE

    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    const accent = { r: 0, g: 0, b: 0, weight: 0 }
    const light = { r: 0, g: 0, b: 0, weight: 0 }
    const hueSample = { x: 0, y: 0, saturation: 0, weight: 0 }

    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] < 128) continue
      const r = pixels[index]
      const g = pixels[index + 1]
      const b = pixels[index + 2]
      const high = Math.max(r, g, b)
      const low = Math.min(r, g, b)
      const chromaValue = high - low
      const chroma = chromaValue / 255
      const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255
      const accentWeight = 0.2 + chroma * 2.4
      const lightWeight = 0.2 + luminance * 1.4

      accent.r += r * accentWeight
      accent.g += g * accentWeight
      accent.b += b * accentWeight
      accent.weight += accentWeight
      light.r += r * lightWeight
      light.g += g * lightWeight
      light.b += b * lightWeight
      light.weight += lightWeight

      const saturation = high > 0 ? chromaValue / high : 0
      if (saturation > 0.055 && luminance > 0.06 && luminance < 0.96) {
        let hue = 0
        if (high === r) hue = 60 * (((g - b) / chromaValue) % 6)
        else if (high === g) hue = 60 * ((b - r) / chromaValue + 2)
        else hue = 60 * ((r - g) / chromaValue + 4)
        if (hue < 0) hue += 360

        const hueWeight = Math.pow(saturation, 1.6)
          * (0.45 + 4 * luminance * (1 - luminance))
        const radians = (hue * Math.PI) / 180
        hueSample.x += Math.cos(radians) * hueWeight
        hueSample.y += Math.sin(radians) * hueWeight
        hueSample.saturation += saturation * hueWeight
        hueSample.weight += hueWeight
      }
    }

    if (hueSample.weight > 1) {
      const hue = (Math.atan2(hueSample.y, hueSample.x) * 180) / Math.PI
      const averageSaturation = hueSample.saturation / hueSample.weight
      const backgroundSaturation = clamp(0.26 + averageSaturation * 0.3, 0.3, 0.52)
      return [
        hslToRgb(hue, backgroundSaturation, 0.83),
        hslToRgb(hue + 18, backgroundSaturation * 0.72, 0.915),
      ]
    }

    const soften = (color, amount) => {
      const weight = Math.max(1, color.weight)
      return [
        mixWithWhite(color.r / weight, amount),
        mixWithWhite(color.g / weight, amount),
        mixWithWhite(color.b / weight, amount),
      ]
    }

    return [soften(accent, 0.63), soften(light, 0.77)]
  } catch {
    return DEFAULT_AMBIENT_PALETTE
  }
}

function resolveSrc(item) {
  if (!item) return null
  if (typeof item === 'string') return item || null
  return typeof item.src === 'string' && item.src ? item.src : null
}

function placeholderFill(index) {
  const hue = (index * 47 + 210) % 360
  return `linear-gradient(150deg, hsl(${hue} 38% 30%), hsl(${(hue + 45) % 360} 52% 8%))`
}

function cardAngle(index, count) {
  return (index / Math.max(1, count)) * TAU + FOCUS_ANGLE
}

function makeCard(index, count) {
  return {
    angle: cardAngle(index, count),
    currentRotation: 0,
    targetRotation: 0,
    currentX: 0,
    targetX: 0,
    currentY: 0,
    targetY: 0,
    currentScale: 1,
    targetScale: 1,
  }
}

function syncCards(scene, count) {
  if (scene.cards.length === count) return

  scene.cards = Array.from({ length: count }, (_, index) => {
    const previous = scene.cards[index]
    if (!previous) return makeCard(index, count)
    previous.angle = cardAngle(index, count)
    return previous
  })
}

function resetHoverResponse(state, immediate = false) {
  state.cards.forEach((item) => {
    item.targetRotation = 0
    item.targetScale = 1
    item.targetX = 0
    item.targetY = 0
    if (immediate) {
      item.currentRotation = 0
      item.currentScale = 1
      item.currentX = 0
      item.currentY = 0
    }
  })
  state.parallax.targetX = 0
  state.parallax.targetY = 0
  state.parallax.targetZ = 0
  state.ambient.target = 0
  if (immediate) {
    state.parallax.currentX = 0
    state.parallax.currentY = 0
    state.parallax.currentZ = 0
    state.ambient.current = 0
    state.ambient.paletteIndex = -1
    state.hoverActivation.current = 0
    state.hoverActivation.target = 0
  }
}

export function CircularGallery({
  images = [],
  background = '#f8f8f6',
  count = 16,
  ringRadius = 175,
  card,
  zoom = 8,
  zoomOffset = 0,
  scrollSensitivity = DEFAULT_SCROLL_SENSITIVITY,
  smoothing = DEFAULT_SMOOTHING,
}) {
  const containerRef = useRef(null)
  const stageRef = useRef(null)
  const cardRefs = useRef([])
  const palettesRef = useRef(new Map())
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [pointerFine, setPointerFine] = useState(false)

  const cardOptions = { ...DEFAULT_CARD, ...card }
  const source = useMemo(() => {
    const resolved = images.map(resolveSrc).filter(Boolean)
    return resolved.length ? resolved : Array.from({ length: PLACEHOLDER_COUNT }, () => null)
  }, [images])
  const imageSources = useMemo(() => [...new Set(source.filter(Boolean))], [source])
  const sourceSignature = imageSources.join('\n')
  const [loadedSourceSignature, setLoadedSourceSignature] = useState('')
  const imagesReady = imageSources.length === 0 || loadedSourceSignature === sourceSignature

  const cardCount = Math.max(1, Math.round(count))
  const totalCards = Math.max(1, ENTRY_CARDS + cardCount - 1)
  const entryFraction = ENTRY_CARDS / totalCards
  const spanDegrees = ((cardCount - 1) * 360) / cardCount
  const span = 2 * ringRadius + Math.hypot(cardOptions.width, cardOptions.height)
  const baseScale = size.width > 0 && size.height > 0 && span > 0
    ? Math.max(0.01, Math.min(1, Math.min(size.width, size.height) / span) * RING_FIT)
    : 1
  const scrollLerp = clamp(0.16 - clamp(smoothing, 0, 10) * 0.012, 0.03, 0.16)
  const scrollPerCard = 400 - clamp(scrollSensitivity, 0, 10) * 32
  const scrollTotalPixels = Math.max(1, scrollPerCard * totalCards)
  const hoverRadius = (100 + HOVER_REACH * 80) * baseScale
  const zoomScale = clamp(zoom, 0.5, 20) * baseScale
  const renderScale = Math.max(1, clamp(zoom, 0.5, 20))

  const scene = useRef({
    cards: [],
    parallax: {
      currentX: 0,
      targetX: 0,
      currentY: 0,
      targetY: 0,
      currentZ: 0,
      targetZ: 0,
    },
    ring: { x: 0, y: 0, rotation: 0, scale: 1 },
    ambient: {
      current: 0,
      target: 0,
      paletteIndex: -1,
      currentStart: [...DEFAULT_AMBIENT_PALETTE[0]],
      targetStart: [...DEFAULT_AMBIENT_PALETTE[0]],
      currentEnd: [...DEFAULT_AMBIENT_PALETTE[1]],
      targetEnd: [...DEFAULT_AMBIENT_PALETTE[1]],
      currentAngle: 125,
      targetAngle: 125,
    },
    hoverActivation: {
      current: 1,
      target: 1,
    },
    hoverSuspended: false,
    pointer: {
      x: null,
      y: null,
    },
    startRotation: {
      current: 0,
      target: 0,
    },
    progressTarget: 0,
    progressCurrent: 0,
    entry: 0,
    pendingZoom: false,
    pendingZoomOut: false,
  })

  const frameConfiguration = useMemo(() => ({
    count: cardCount,
    ringRadius,
    baseScale,
    hover: pointerFine,
    hoverRadius,
    falloff: Math.max(1, hoverRadius / 2),
    push: HOVER_STRENGTH * 10,
    grow: HOVER_STRENGTH * 0.06,
    tilt: HOVER_PARALLAX * 3,
    twist: HOVER_PARALLAX,
    scrollLerp,
    scrollTotalPixels,
    entryFraction,
    spanDegrees,
    zoomScale,
    renderScale,
    lift: ringRadius * zoomScale + zoomOffset,
  }), [
    baseScale,
    cardCount,
    entryFraction,
    hoverRadius,
    pointerFine,
    ringRadius,
    scrollLerp,
    scrollTotalPixels,
    spanDegrees,
    zoomOffset,
    zoomScale,
    renderScale,
  ])
  const frame = useRef(frameConfiguration)

  useEffect(() => {
    frame.current = frameConfiguration
  }, [frameConfiguration])

  useEffect(() => {
    let isCancelled = false
    const pending = imageSources.map((imageSource) => new Promise((resolve) => {
      const image = new Image()
      const finish = () => resolve([imageSource, sampleImagePalette(image)])

      image.onload = () => {
        if (typeof image.decode === 'function') {
          image.decode().catch(() => {}).finally(finish)
        } else {
          finish()
        }
      }
      image.onerror = () => resolve([imageSource, DEFAULT_AMBIENT_PALETTE])
      image.src = imageSource
    }))

    Promise.all(pending).then((palettes) => {
      palettesRef.current = new Map(palettes)
      requestAnimationFrame(() => {
        if (!isCancelled) setLoadedSourceSignature(sourceSignature)
      })
    })

    return () => {
      isCancelled = true
    }
  }, [imageSources, sourceSignature])

  useEffect(() => {
    const node = containerRef.current
    if (!node) return undefined

    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(node)
    setSize({ width: node.clientWidth, height: node.clientHeight })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const query = window.matchMedia?.('(hover: hover) and (pointer: fine)')
    if (!query) return undefined

    const update = () => setPointerFine(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    let animationFrame = 0
    let previousTime = 0

    function paint() {
      const config = frame.current
      const state = scene.current
      const entryWeight = 1 - state.entry

      if (stageRef.current) {
        const { currentX, currentY, currentZ } = state.parallax
        stageRef.current.style.transform = `rotate(${currentZ * entryWeight}deg) rotateX(${currentX * entryWeight}deg) rotateY(${currentY * entryWeight}deg)`
      }

      if (containerRef.current) {
        containerRef.current.style.setProperty(
          '--gallery-ambient-start',
          colorToCss(state.ambient.currentStart),
        )
        containerRef.current.style.setProperty(
          '--gallery-ambient-end',
          colorToCss(state.ambient.currentEnd),
        )
        containerRef.current.style.setProperty(
          '--gallery-ambient-angle',
          `${state.ambient.currentAngle.toFixed(2)}deg`,
        )
        containerRef.current.style.setProperty(
          '--gallery-ambient-opacity',
          (state.ambient.current * entryWeight * 0.76).toFixed(3),
        )
      }

      const ringRotation = (state.ring.rotation * Math.PI) / 180
      const ringCos = Math.cos(ringRotation)
      const ringSin = Math.sin(ringRotation)

      state.cards.forEach((item, index) => {
        const node = cardRefs.current[index]
        if (!node) return
        const localX = config.ringRadius * Math.cos(item.angle) + item.currentX * entryWeight
        const localY = config.ringRadius * Math.sin(item.angle) + item.currentY * entryWeight
        const x = state.ring.x + state.ring.scale * (localX * ringCos - localY * ringSin)
        const y = state.ring.y + state.ring.scale * (localX * ringSin + localY * ringCos)
        const spin = (item.angle * 180) / Math.PI + 90 + state.ring.rotation
        const twist = item.currentRotation * entryWeight
        const scale = (
          state.ring.scale * (1 + (item.currentScale - 1) * entryWeight)
        ) / config.renderScale
        const centerDistance = Math.hypot(x, y)
        node.style.zIndex = `${Math.max(1, 100000 - Math.round(centerDistance * 10))}`
        node.style.transform = `perspective(${CARD_PERSPECTIVE}px) translate3d(${x}px, ${y}px, 0) rotate(${spin}deg) rotateY(${twist}deg) scale(${scale})`
      })
    }

    function tick(now) {
      animationFrame = requestAnimationFrame(tick)
      const deltaTime = previousTime ? Math.min(0.064, (now - previousTime) / 1000) : 1 / 60
      previousTime = now

      const config = frame.current
      const state = scene.current
      syncCards(state, config.count)
      state.hoverActivation ??= { current: 1, target: 1 }
      state.hoverSuspended ??= false
      state.pointer ??= { x: null, y: null }

      const scrollEase = 1 - Math.pow(1 - config.scrollLerp, deltaTime * 60)
      state.progressCurrent += (state.progressTarget - state.progressCurrent) * scrollEase
      const progress = state.progressCurrent
      const entry = smoothstep(clamp(progress / config.entryFraction, 0, 1))
      const ride = config.entryFraction < 1
        ? Math.max(0, (progress - config.entryFraction) / (1 - config.entryFraction))
        : 0
      state.entry = entry

      const hoverEase = 1 - Math.pow(1 - HOVER_LERP, deltaTime * 60)
      const hoverRestoreEase = 1 - Math.pow(1 - HOVER_RESTORE_LERP, deltaTime * 60)
      state.hoverActivation.current += (
        state.hoverActivation.target - state.hoverActivation.current
      ) * hoverRestoreEase
      const hoverResponseEase = hoverEase * state.hoverActivation.current
      const parallax = state.parallax
      parallax.currentX += (parallax.targetX - parallax.currentX) * hoverResponseEase
      parallax.currentY += (parallax.targetY - parallax.currentY) * hoverResponseEase
      parallax.currentZ += (parallax.targetZ - parallax.currentZ) * hoverResponseEase
      state.ambient.current += (
        state.ambient.target - state.ambient.current
      ) * hoverResponseEase
      const ambientColorEase = 1 - Math.pow(1 - AMBIENT_COLOR_LERP, deltaTime * 60)
      state.ambient.currentStart.forEach((channel, index) => {
        state.ambient.currentStart[index] = channel
          + (state.ambient.targetStart[index] - channel) * ambientColorEase
        state.ambient.currentEnd[index] += (
          state.ambient.targetEnd[index] - state.ambient.currentEnd[index]
        ) * ambientColorEase
      })
      state.ambient.currentAngle += (
        state.ambient.targetAngle - state.ambient.currentAngle
      ) * ambientColorEase

      state.cards.forEach((item) => {
        item.currentRotation += (
          item.targetRotation - item.currentRotation
        ) * hoverResponseEase
        item.currentScale += (item.targetScale - item.currentScale) * hoverResponseEase
        item.currentX += (item.targetX - item.currentX) * hoverResponseEase
        item.currentY += (item.targetY - item.currentY) * hoverResponseEase
      })

      const rotationEase = 1 - Math.pow(0.88, deltaTime * 60)
      state.startRotation.current += (
        state.startRotation.target - state.startRotation.current
      ) * rotationEase
      if (
        state.pendingZoom
        && Math.abs(state.startRotation.target - state.startRotation.current) < 0.15
      ) {
        state.startRotation.current = state.startRotation.target
        state.progressTarget = config.entryFraction
        state.pendingZoom = false
      }
      if (
        state.pendingZoomOut
        && Math.abs(state.startRotation.target - state.startRotation.current) < 0.15
      ) {
        state.startRotation.current = state.startRotation.target
        state.progressTarget = 0
        state.pendingZoomOut = false
      }
      state.ring.x = 0
      state.ring.scale = config.baseScale + (config.zoomScale - config.baseScale) * entry
      state.ring.y = config.lift * entry
      state.ring.rotation = state.startRotation.current - ride * config.spanDegrees
      paint()
    }

    animationFrame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationFrame)
  }, [])

  useEffect(() => {
    const node = containerRef.current
    if (!node) return undefined
    const state = scene.current

    function advance(deltaPixels) {
      const config = frame.current
      const nextProgress = clamp(
        state.progressTarget + deltaPixels / config.scrollTotalPixels,
        0,
        1,
      )
      const isReturningToCircle = deltaPixels < 0
        && nextProgress < config.entryFraction

      if (isReturningToCircle) {
        resetHoverResponse(state, true)
        state.hoverSuspended = true
      }
      state.pendingZoom = false
      state.pendingZoomOut = false
      state.progressTarget = nextProgress
    }

    function isAtStart(delta) {
      return delta < 0 && state.progressTarget <= 0
    }

    function handleWheel(event) {
      let delta = event.deltaY
      if (event.deltaMode === 1) delta *= 16
      else if (event.deltaMode === 2) delta *= node.clientHeight || 800
      delta = clamp(delta, -WHEEL_CLAMP, WHEEL_CLAMP)
      if (isAtStart(delta)) return
      event.preventDefault()
      advance(delta)
    }

    let touchY = null
    function handleTouchStart(event) {
      touchY = event.touches[0]?.clientY ?? null
    }

    function handleTouchMove(event) {
      const y = event.touches[0]?.clientY
      if (y == null || touchY == null) return
      const delta = clamp((touchY - y) * TOUCH_GAIN, -WHEEL_CLAMP, WHEEL_CLAMP)
      touchY = y
      if (isAtStart(delta)) return
      if (event.cancelable) event.preventDefault()
      advance(delta)
    }

    function handleTouchEnd() {
      touchY = null
    }

    node.addEventListener('wheel', handleWheel, { passive: false })
    node.addEventListener('touchstart', handleTouchStart, { passive: true })
    node.addEventListener('touchmove', handleTouchMove, { passive: false })
    node.addEventListener('touchend', handleTouchEnd, { passive: true })
    node.addEventListener('touchcancel', handleTouchEnd, { passive: true })
    return () => {
      node.removeEventListener('wheel', handleWheel)
      node.removeEventListener('touchstart', handleTouchStart)
      node.removeEventListener('touchmove', handleTouchMove)
      node.removeEventListener('touchend', handleTouchEnd)
      node.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [])

  function handlePointerMove(event) {
    const config = frame.current
    const state = scene.current
    const node = containerRef.current
    if (!config.hover || !node) return

    const bounds = node.getBoundingClientRect()
    const centerX = bounds.width / 2
    const centerY = bounds.height / 2
    const pointerX = event.clientX - bounds.left
    const pointerY = event.clientY - bounds.top
    const previousPointerX = state.pointer.x
    const previousPointerY = state.pointer.y
    state.pointer.x = event.clientX
    state.pointer.y = event.clientY

    if (state.hoverSuspended) {
      const circleIsSettled = state.entry < 0.001
        && state.progressCurrent < config.entryFraction * 0.01
      const pointerMoved = previousPointerX != null
        && previousPointerY != null
        && Math.hypot(
          event.clientX - previousPointerX,
          event.clientY - previousPointerY,
        ) > 0.5

      if (!circleIsSettled || !pointerMoved) return
      state.hoverSuspended = false
    }

    const percentX = centerX ? (pointerX - centerX) / centerX : 0
    const percentY = centerY ? (pointerY - centerY) / centerY : 0

    state.hoverActivation.target = 1
    state.parallax.targetY = percentX * config.tilt
    state.parallax.targetX = -percentY * config.tilt
    state.parallax.targetZ = (percentX + percentY) * config.twist

    let strongestForce = 0
    let strongestIndex = -1
    const entryWeight = 1 - state.entry
    const ringRotation = (state.ring.rotation * Math.PI) / 180
    const ringCos = Math.cos(ringRotation)
    const ringSin = Math.sin(ringRotation)
    state.cards.forEach((item, index) => {
      const localX = config.ringRadius * Math.cos(item.angle)
        + item.currentX * entryWeight
      const localY = config.ringRadius * Math.sin(item.angle)
        + item.currentY * entryWeight
      const cardX = centerX + state.ring.x
        + state.ring.scale * (localX * ringCos - localY * ringSin)
      const cardY = centerY + state.ring.y
        + state.ring.scale * (localX * ringSin + localY * ringCos)
      const distance = Math.hypot(pointerX - cardX, pointerY - cardY)

      if (distance < config.hoverRadius) {
        const force = Math.max(0, 1 - distance / config.falloff)
        if (force > strongestForce) {
          strongestForce = force
          strongestIndex = index
        }
        const move = config.push * force
        item.targetRotation = 16 * force
        item.targetScale = 1 + config.grow * force
        item.targetX = move * Math.cos(item.angle)
        item.targetY = move * Math.sin(item.angle)
      } else {
        item.targetRotation = 0
        item.targetScale = 1
        item.targetX = 0
        item.targetY = 0
      }
    })
    state.ambient.target = strongestForce
    if (strongestIndex >= 0 && strongestIndex !== state.ambient.paletteIndex) {
      const imageSource = source[strongestIndex % source.length]
      const palette = palettesRef.current.get(imageSource) ?? DEFAULT_AMBIENT_PALETTE
      state.ambient.paletteIndex = strongestIndex
      state.ambient.targetStart = [...palette[0]]
      state.ambient.targetEnd = [...palette[1]]
      state.ambient.targetAngle = 105
        + (strongestIndex / Math.max(1, state.cards.length)) * 120
    }
  }

  function handlePointerLeave() {
    resetHoverResponse(scene.current)
  }

  function handleCardClick(index, event) {
    const state = scene.current
    const config = frame.current
    const degreesPerCard = 360 / config.count
    const desiredRotation = -index * degreesPerCard
    const currentRotation = state.ring.rotation
    const nearestTurn = Math.round((currentRotation - desiredRotation) / 360)
    const targetRotation = desiredRotation + nearestTurn * 360
    const isZoomed = state.entry > 0.5
      || state.progressCurrent > config.entryFraction * 0.5

    if (isZoomed) {
      resetHoverResponse(state, true)
      state.hoverSuspended = true
      state.pointer.x = event.clientX
      state.pointer.y = event.clientY
    }
    state.progressCurrent = isZoomed ? config.entryFraction : 0
    state.progressTarget = isZoomed ? config.entryFraction : 0
    state.entry = isZoomed ? 1 : 0
    state.startRotation.current = currentRotation
    state.startRotation.target = targetRotation
    state.pendingZoom = !isZoomed
    state.pendingZoomOut = isZoomed
    state.ambient.target = 0
  }

  return (
    <div
      ref={containerRef}
      className={`circular-gallery${imagesReady ? ' is-ready' : ''}`}
      style={{ background }}
      aria-busy={!imagesReady}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div
        ref={stageRef}
        className="circular-gallery__stage"
        style={{ perspective: `${STAGE_PERSPECTIVE}px` }}
      >
        <div className="circular-gallery__ring">
          {Array.from({ length: cardCount }, (_, index) => {
            const src = source[index % source.length]
            return (
              <button
                key={index}
                type="button"
                ref={(node) => { cardRefs.current[index] = node }}
                className="circular-gallery__card"
                aria-label={`View gallery image ${index + 1}`}
                onClick={(event) => handleCardClick(index, event)}
                style={{
                  width: cardOptions.width * renderScale,
                  height: cardOptions.height * renderScale,
                  marginLeft: -(cardOptions.width * renderScale) / 2,
                  marginTop: -(cardOptions.height * renderScale) / 2,
                  borderRadius: cardOptions.radius * renderScale,
                }}
              >
                {src ? (
                  <img src={src} alt="" draggable="false" />
                ) : (
                  <div
                    className="circular-gallery__placeholder"
                    style={{ background: placeholderFill(index) }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
