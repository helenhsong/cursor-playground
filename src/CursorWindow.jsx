import { useEffect, useRef, useState } from 'react'
import { CircularGallery } from './CircularGallery'
import { DitherReveal } from './DitherReveal'

const PLAYGROUNDS = [
  { id: 'gaze', name: 'Gaze' },
  { id: 'dither', name: 'Dither' },
  { id: 'gallery', name: 'Gallery' },
]

const GAZE_EYES = [
  { x: 249, y: 318, rx: 38, ry: 24, angle: 7 },
  { x: 350, y: 323, rx: 38, ry: 24, angle: -7 },
  { x: 654, y: 250, rx: 42, ry: 25, angle: 8 },
  { x: 766, y: 244, rx: 42, ry: 25, angle: -9 },
  { x: 1148, y: 319, rx: 38, ry: 24, angle: 8 },
  { x: 1251, y: 322, rx: 38, ry: 24, angle: -7 },
]

const GAZE_ASSETS = {
  nw: 'gaze-nw.jpg',
  nnw: 'gaze-nnw.jpg',
  n: 'gaze-up.jpg',
  nne: 'gaze-nne.jpg',
  ne: 'gaze-ne.jpg',
  wnw: 'gaze-wnw.jpg',
  nw1: 'gaze-nw1.jpg',
  n1: 'gaze-n1.jpg',
  ne1: 'gaze-ne1.jpg',
  ene: 'gaze-ene.jpg',
  w: 'gaze-w.jpg',
  w1: 'gaze-w1.jpg',
  e1: 'gaze-e1.jpg',
  e: 'gaze-e.jpg',
  wsw: 'gaze-wsw.jpg',
  sw1: 'gaze-sw1.jpg',
  s1: 'gaze-s1.jpg',
  se1: 'gaze-se1.jpg',
  ese: 'gaze-ese.jpg',
  sw: 'gaze-sw.jpg',
  ssw: 'gaze-ssw.jpg',
  s: 'gaze-down.jpg',
  sse: 'gaze-sse.jpg',
  se: 'gaze-se.jpg',
  'up-left-soft': 'gaze-up-left-soft.jpg',
  'up-right-soft': 'gaze-up-right-soft.jpg',
  'center-up': 'gaze-center-up.jpg',
  'center-down': 'gaze-center-down.jpg',
  'middle-left-soft': 'gaze-middle-left-soft.jpg',
  'middle-left-mid': 'gaze-middle-left-mid.jpg',
  'middle-right-soft': 'gaze-middle-right-soft.jpg',
  'middle-right-mid': 'gaze-middle-right-mid.jpg',
  'middle-up-left-soft': 'gaze-middle-up-left-soft.jpg',
  'middle-up-right-soft': 'gaze-middle-up-right-soft.jpg',
  'middle-down-left-soft': 'gaze-middle-down-left-soft.jpg',
  'middle-down-right-soft': 'gaze-middle-down-right-soft.jpg',
}
const GAZE_GRID = [
  ['nw', 'nnw', 'n', 'nne', 'ne'],
  ['wnw', 'nw1', 'n1', 'ne1', 'ene'],
  ['w', 'w1', null, 'e1', 'e'],
  ['wsw', 'sw1', 's1', 'se1', 'ese'],
  ['sw', 'ssw', 's', 'sse', 'se'],
]
const GAZE_PEOPLE = [
  { id: 'left-woman', eyeIndexes: [0, 1], anchor: { x: 19.5, y: 31.3 } },
  { id: 'center-man', eyeIndexes: [2, 3], anchor: { x: 46.2, y: 24.1 } },
  { id: 'right-woman', eyeIndexes: [4, 5], anchor: { x: 78.1, y: 31.3 } },
]

const GAZE_PATCH_OFFSETS = {
  n: [{ x: 0, y: 4 }, { x: 0, y: 4 }, { x: 0, y: 6 }],
  n1: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 2 }],
  s1: [{ x: 0, y: -2 }, { x: 0, y: 0 }, { x: 0, y: -4 }],
  s: [{ x: 0, y: -6 }, { x: 0, y: -4 }, { x: -2, y: -6 }],
}

const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`
const GALLERY_IMAGES = Array.from(
  { length: 10 },
  (_, index) => `${ASSET_BASE}gallery-images/${index + 1}.jpg`,
)

const ENVIRONMENT_CONTROLS = {
  gaze: [
    { key: 'deadZone', label: 'Center hold', min: 4, max: 24, step: 1, defaultValue: 7, precision: 0, suffix: '%' },
    { key: 'cursorScale', label: 'Cursor size', min: 0.65, max: 1.4, step: 0.05, defaultValue: 0.9, precision: 2, suffix: '×' },
  ],
  dither: [
    { key: 'dotSize', label: 'Dither scale', min: 2, max: 14, step: 1, defaultValue: 5, precision: 0, suffix: 'px' },
    { key: 'revealRadius', label: 'Reveal radius', min: 55, max: 260, step: 5, defaultValue: 170, precision: 0, suffix: 'px' },
    { key: 'softness', label: 'Reveal softness', min: 0.05, max: 0.85, step: 0.05, defaultValue: 0.42, precision: 2 },
    { key: 'waveSpeed', label: 'Drift speed', min: 0.1, max: 1.5, step: 0.1, defaultValue: 0.72, precision: 1 },
    { key: 'waveDensity', label: 'Wave density', min: 4, max: 18, step: 1, defaultValue: 9, precision: 0 },
  ],
}

function defaultSettings() {
  return Object.fromEntries(
    Object.entries(ENVIRONMENT_CONTROLS).map(([id, controls]) => [
      id,
      Object.fromEntries(controls.map((control) => [control.key, control.defaultValue])),
    ]),
  )
}

const DEFAULT_SETTINGS = defaultSettings()

function gazeDirectionFor(pointer, anchor, deadZone, personId) {
  const deltaX = pointer.x - anchor.x
  const deltaY = pointer.y - anchor.y
  const distance = Math.hypot(deltaX, deltaY)
  const activeDeadZone = personId === 'center-man' ? Math.min(deadZone, 4) : deadZone

  if (distance <= activeDeadZone) return null

  const gazeX = Math.max(-1, Math.min(1, deltaX / 40))
  const gazeY = Math.max(-1, Math.min(1, deltaY / 30))
  const gridX = Math.round((gazeX + 1) * 2)
  const gridY = Math.round((gazeY + 1) * 2)
  let direction = GAZE_GRID[gridY][gridX]

  if (gazeY <= -0.5 && Math.abs(gazeX) < 0.5) {
    if (gazeX < -0.08) direction = 'up-left-soft'
    if (gazeX > 0.08) direction = 'up-right-soft'
  }

  if (Math.abs(gazeX) < 0.25 && Math.abs(gazeY) < 0.5) {
    if (gazeY < 0) direction = 'center-up'
    if (gazeY > 0) direction = 'center-down'
  }

  if (personId === 'center-man') {
    const localX = Math.max(-1, Math.min(1, deltaX / 24))
    const localY = Math.max(-1, Math.min(1, deltaY / 20))
    const horizontalDistance = Math.abs(localX)

    if (localY >= 0.72) {
      if (localX <= -0.68) direction = 'sw'
      else if (localX <= -0.22) direction = 'ssw'
      else if (localX < 0.22) direction = 's'
      else if (localX < 0.68) direction = 'sse'
      else direction = 'se'
    } else if (horizontalDistance >= 0.14) {
      const horizontalName = localX < 0 ? 'left' : 'right'

      if (localY <= -0.25) {
        direction = `middle-up-${horizontalName}-soft`
      } else if (localY >= 0.25) {
        direction = `middle-down-${horizontalName}-soft`
      } else {
        const distanceName = horizontalDistance < 0.55 ? 'soft' : 'mid'
        direction = `middle-${horizontalName}-${distanceName}`
      }
    } else if (localY <= -0.18) {
      direction = 'center-up'
    } else if (localY >= 0.18) {
      direction = 'center-down'
    }
  }

  return direction
}

function GazePlayground({ pointer, settings }) {
  const directions = Object.fromEntries(
    GAZE_PEOPLE.map((person) => [
      person.id,
      pointer.active
        ? gazeDirectionFor(pointer, person.anchor, settings.deadZone, person.id)
        : null,
    ]),
  )

  return (
    <div
      className="scene scene--gaze"
      style={{ '--gaze-cursor-scale': settings.cursorScale }}
    >
      <svg className="gaze-canvas" viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <filter id="gaze-eye-feather" x="-35%" y="-50%" width="170%" height="200%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          {GAZE_PEOPLE.map((person) => (
            <mask key={person.id} id={`gaze-eye-regions-${person.id}`} maskUnits="userSpaceOnUse">
              <rect width="1536" height="1024" fill="#000" />
              {person.eyeIndexes.map((eyeIndex) => {
                const eye = GAZE_EYES[eyeIndex]
                return (
                  <ellipse
                    key={eyeIndex}
                    cx={eye.x}
                    cy={eye.y}
                    rx={eye.rx}
                    ry={eye.ry}
                    fill="#fff"
                    filter="url(#gaze-eye-feather)"
                    transform={`rotate(${eye.angle} ${eye.x} ${eye.y})`}
                  />
                )
              })}
            </mask>
          ))}
        </defs>

        <image
          className="gaze-base"
          href={`${ASSET_BASE}gaze-center.jpg`}
          width="1536"
          height="1024"
        />
        {GAZE_PEOPLE.map((person, personIndex) => {
          const option = directions[person.id]
          if (!option) return null

          const offset = GAZE_PATCH_OFFSETS[option]?.[personIndex] ?? { x: 0, y: 0 }
          return (
            <image
              key={`${option}-${person.id}`}
              className="gaze-state is-active"
              href={`${ASSET_BASE}${GAZE_ASSETS[option]}`}
              x={offset.x}
              y={offset.y}
              width="1536"
              height="1024"
              mask={`url(#gaze-eye-regions-${person.id})`}
            />
          )
        })}
      </svg>

      <img
        className="gaze-cursor"
        src={`${ASSET_BASE}gaze-peony-cursor-small.png`}
        alt=""
        draggable="false"
        style={{ left: `${pointer.x}%`, top: `${pointer.y}%` }}
      />
    </div>
  )
}

function GalleryPlayground() {
  return (
    <div className="scene scene--gallery">
      <CircularGallery
        images={GALLERY_IMAGES}
        count={GALLERY_IMAGES.length}
        card={{ width: 56, height: 40, radius: 0 }}
      />
    </div>
  )
}

function DitherPlayground({ pointer, settings }) {
  return (
    <div className="scene scene--dither">
      <DitherReveal imageSrc={`${ASSET_BASE}toki.jpg`} settings={settings} />
      <img
        className="dither-carrot-cursor"
        src={`${ASSET_BASE}dither-carrot-cursor-small.png`}
        alt=""
        draggable="false"
        style={{ left: `${pointer.x}%`, top: `${pointer.y}%` }}
      />
    </div>
  )
}

function PlaygroundScene({ id, pointer, settings }) {
  if (id === 'gallery') return <GalleryPlayground />
  if (id === 'dither') return <DitherPlayground pointer={pointer} settings={settings} />
  return <GazePlayground pointer={pointer} settings={settings} />
}

export function CursorWindow() {
  const canvasRef = useRef(null)
  const [playgroundIndex, setPlaygroundIndex] = useState(0)
  const [pointer, setPointer] = useState({ x: 52, y: 48, active: false })

  const playground = PLAYGROUNDS[playgroundIndex]
  const settings = DEFAULT_SETTINGS[playground.id]

  function switchPlayground(nextIndex) {
    const wrapped = (nextIndex + PLAYGROUNDS.length) % PLAYGROUNDS.length
    setPlaygroundIndex(wrapped)
    setPointer({ x: 52, y: 48, active: false })
  }

  useEffect(() => {
    function handleShortcut(event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

      event.preventDefault()
      const direction = event.key === 'ArrowLeft' ? -1 : 1
      setPlaygroundIndex((current) => (current + direction + PLAYGROUNDS.length) % PLAYGROUNDS.length)
      setPointer({ x: 52, y: 48, active: false })
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  function handlePointerMove(event) {
    const bounds = canvasRef.current.getBoundingClientRect()
    const next = {
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
      active: true,
    }

    setPointer(next)
  }

  return (
    <section className="mac-window" aria-label="Cursor Playground">
      <header className="window-titlebar">
        <div className="window-toolbar-left">
          <div className="traffic-lights" aria-label="Window controls">
            <button className="traffic-light traffic-light--close" type="button" aria-label="Close" />
            <button className="traffic-light traffic-light--minimize" type="button" aria-label="Minimize" />
            <button className="traffic-light traffic-light--zoom" type="button" aria-label="Zoom" />
          </div>

          <nav className="browser-navigation" aria-label="Cycle through environments">
            <button
              type="button"
              aria-label="Previous environment"
              onClick={() => switchPlayground(playgroundIndex - 1)}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              aria-label="Next environment"
              onClick={() => switchPlayground(playgroundIndex + 1)}
            >
              <span aria-hidden="true">→</span>
            </button>
          </nav>
        </div>

        <div className="window-title" aria-live="polite">{playground.name}</div>
      </header>

      <div
        ref={canvasRef}
        className="window-content"
        role="application"
        aria-label={`${playground.name} cursor playground`}
        tabIndex="0"
        onPointerMove={handlePointerMove}
      >
        <PlaygroundScene
          id={playground.id}
          pointer={pointer}
          settings={settings}
        />
      </div>
    </section>
  )
}
