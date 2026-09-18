import { useEffect, useMemo, useRef, useState } from 'react'

const DEFAULT_CARD = { width: 40, height: 45, radius: 0 }
const DEFAULT_SCROLL_SENSITIVITY = 5
const DEFAULT_SMOOTHING = 10
const TAU = Math.PI * 2
const FOCUS_ANGLE = (Math.PI * 3) / 2
const CARD_PERSPECTIVE = 1000
const STAGE_PERSPECTIVE = 2000
const HOVER_LERP = 0.15
const HOVER_REACH = 5
const HOVER_STRENGTH = 5
const HOVER_PARALLAX = 5
const ENTRY_CARDS = 2
const TOUCH_GAIN = 2.2
const WHEEL_CLAMP = 400
const PLACEHOLDER_COUNT = 12
const RING_FIT = 0.8

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function smoothstep(value) {
  return value * value * (3 - 2 * value)
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
  const lapProgress = (1 - entryFraction) * (cardCount / Math.max(1, cardCount - 1))
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
    progressTarget: 0,
    progressCurrent: 0,
    entry: 0,
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
    lapProgress,
    spanDegrees,
    zoomScale,
    renderScale,
    lift: ringRadius * zoomScale + zoomOffset,
  }), [
    baseScale,
    cardCount,
    entryFraction,
    hoverRadius,
    lapProgress,
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
      const finish = () => resolve()

      image.onload = () => {
        if (typeof image.decode === 'function') {
          image.decode().catch(() => {}).finally(finish)
        } else {
          finish()
        }
      }
      image.onerror = finish
      image.src = imageSource
    }))

    Promise.all(pending).then(() => {
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

      const scrollEase = 1 - Math.pow(1 - config.scrollLerp, deltaTime * 60)
      state.progressCurrent += (state.progressTarget - state.progressCurrent) * scrollEase

      const lapEnd = config.entryFraction + config.lapProgress
      if (state.progressCurrent >= lapEnd) {
        state.progressCurrent -= config.lapProgress
        state.progressTarget -= config.lapProgress
      }

      const progress = state.progressCurrent
      const entry = smoothstep(clamp(progress / config.entryFraction, 0, 1))
      const ride = config.entryFraction < 1
        ? Math.max(0, (progress - config.entryFraction) / (1 - config.entryFraction))
        : 0
      state.entry = entry

      const hoverEase = 1 - Math.pow(1 - HOVER_LERP, deltaTime * 60)
      const parallax = state.parallax
      parallax.currentX += (parallax.targetX - parallax.currentX) * hoverEase
      parallax.currentY += (parallax.targetY - parallax.currentY) * hoverEase
      parallax.currentZ += (parallax.targetZ - parallax.currentZ) * hoverEase

      state.cards.forEach((item) => {
        item.currentRotation += (item.targetRotation - item.currentRotation) * hoverEase
        item.currentScale += (item.targetScale - item.currentScale) * hoverEase
        item.currentX += (item.targetX - item.currentX) * hoverEase
        item.currentY += (item.targetY - item.currentY) * hoverEase
      })

      state.ring.x = 0
      state.ring.scale = config.baseScale + (config.zoomScale - config.baseScale) * entry
      state.ring.y = config.lift * entry
      state.ring.rotation = -ride * config.spanDegrees
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
      state.progressTarget = Math.max(
        0,
        state.progressTarget + deltaPixels / frame.current.scrollTotalPixels,
      )
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
    const percentX = centerX ? (pointerX - centerX) / centerX : 0
    const percentY = centerY ? (pointerY - centerY) / centerY : 0

    state.parallax.targetY = percentX * config.tilt
    state.parallax.targetX = -percentY * config.tilt
    state.parallax.targetZ = (percentX + percentY) * config.twist

    state.cards.forEach((item) => {
      const cardX = centerX + config.baseScale * (config.ringRadius * Math.cos(item.angle) + item.currentX)
      const cardY = centerY + config.baseScale * (config.ringRadius * Math.sin(item.angle) + item.currentY)
      const distance = Math.hypot(pointerX - cardX, pointerY - cardY)

      if (distance < config.hoverRadius) {
        const force = Math.max(0, 1 - distance / config.falloff)
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
  }

  function handlePointerLeave() {
    const state = scene.current
    state.cards.forEach((item) => {
      item.targetRotation = 0
      item.targetScale = 1
      item.targetX = 0
      item.targetY = 0
    })
    state.parallax.targetX = 0
    state.parallax.targetY = 0
    state.parallax.targetZ = 0
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
              <div
                key={index}
                ref={(node) => { cardRefs.current[index] = node }}
                className="circular-gallery__card"
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
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
