import { useEffect, useRef, useState } from 'react'
import { AsciiLake } from './AsciiLake'
import { DitherReveal } from './DitherReveal'

const PLAYGROUNDS = [
  { id: 'gaze', name: 'Gaze' },
  { id: 'dither', name: 'Dither' },
  { id: 'water', name: 'Water' },
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
  nw: 'gaze-nw.png',
  nnw: 'gaze-nnw.png',
  n: 'gaze-up.png',
  nne: 'gaze-nne.png',
  ne: 'gaze-ne.png',
  wnw: 'gaze-wnw.png',
  nw1: 'gaze-nw1.png',
  n1: 'gaze-n1.png',
  ne1: 'gaze-ne1.png',
  ene: 'gaze-ene.png',
  w: 'gaze-w.png',
  w1: 'gaze-w1.png',
  e1: 'gaze-e1.png',
  e: 'gaze-e.png',
  wsw: 'gaze-wsw.png',
  sw1: 'gaze-sw1.png',
  s1: 'gaze-s1.png',
  se1: 'gaze-se1.png',
  ese: 'gaze-ese.png',
  sw: 'gaze-sw.png',
  ssw: 'gaze-ssw.png',
  s: 'gaze-down.png',
  sse: 'gaze-sse.png',
  se: 'gaze-se.png',
  'up-left-soft': 'gaze-up-left-soft.png',
  'up-right-soft': 'gaze-up-right-soft.png',
  'center-up': 'gaze-center-up.png',
  'center-down': 'gaze-center-down.png',
  'middle-left-soft': 'gaze-middle-left-soft.png',
  'middle-left-mid': 'gaze-middle-left-mid.png',
  'middle-right-soft': 'gaze-middle-right-soft.png',
  'middle-right-mid': 'gaze-middle-right-mid.png',
  'middle-up-left-soft': 'gaze-middle-up-left-soft.png',
  'middle-up-right-soft': 'gaze-middle-up-right-soft.png',
  'middle-down-left-soft': 'gaze-middle-down-left-soft.png',
  'middle-down-right-soft': 'gaze-middle-down-right-soft.png',
}
const GAZE_DIRECTIONS = Object.keys(GAZE_ASSETS)
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
      gazeDirectionFor(pointer, person.anchor, settings.deadZone, person.id),
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
          href={`${ASSET_BASE}gaze-center.png`}
          width="1536"
          height="1024"
        />
        {GAZE_DIRECTIONS.flatMap((option) => GAZE_PEOPLE.map((person, personIndex) => {
          const offset = GAZE_PATCH_OFFSETS[option]?.[personIndex] ?? { x: 0, y: 0 }
          return (
            <image
              key={`${option}-${person.id}`}
              className={`gaze-state${directions[person.id] === option ? ' is-active' : ''}`}
              href={`${ASSET_BASE}${GAZE_ASSETS[option]}`}
              x={offset.x}
              y={offset.y}
              width="1536"
              height="1024"
              mask={`url(#gaze-eye-regions-${person.id})`}
            />
          )
        }))}
      </svg>

      <img
        className="gaze-cursor"
        src={`${ASSET_BASE}gaze-peony-cursor.png`}
        alt=""
        draggable="false"
        style={{ left: `${pointer.x}%`, top: `${pointer.y}%` }}
      />
    </div>
  )
}

function WaterPlayground() {
  return (
    <div className="scene scene--water">
      <AsciiLake />
    </div>
  )
}

function DitherPlayground({ pointer, settings }) {
  return (
    <div className="scene scene--dither">
      <DitherReveal imageSrc={`${ASSET_BASE}toki.png`} settings={settings} />
      <img
        className="dither-carrot-cursor"
        src={`${ASSET_BASE}dither-carrot-cursor.png`}
        alt=""
        draggable="false"
        style={{ left: `${pointer.x}%`, top: `${pointer.y}%` }}
      />
    </div>
  )
}

function PlaygroundScene({ id, pointer, settings }) {
  if (id === 'water') return <WaterPlayground />
  if (id === 'dither') return <DitherPlayground pointer={pointer} settings={settings} />
  return <GazePlayground pointer={pointer} settings={settings} />
}

export function CursorWindow() {
  const canvasRef = useRef(null)
  const [playgroundIndex, setPlaygroundIndex] = useState(0)
  const [pointer, setPointer] = useState({ x: 52, y: 48 })
  const [isLocationOpen, setIsLocationOpen] = useState(false)

  const playground = PLAYGROUNDS[playgroundIndex]
  const settings = DEFAULT_SETTINGS[playground.id]

  function switchPlayground(nextIndex) {
    const wrapped = (nextIndex + PLAYGROUNDS.length) % PLAYGROUNDS.length
    setPlaygroundIndex(wrapped)
    setPointer({ x: 52, y: 48 })
    setIsLocationOpen(false)
  }

  useEffect(() => {
    function handleShortcut(event) {
      if (event.key === 'Escape') {
        setIsLocationOpen(false)
        return
      }

      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

      event.preventDefault()
      const direction = event.key === 'ArrowLeft' ? -1 : 1
      setPlaygroundIndex((current) => (current + direction + PLAYGROUNDS.length) % PLAYGROUNDS.length)
      setPointer({ x: 52, y: 48 })
      setIsLocationOpen(false)
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  function handlePointerMove(event) {
    const bounds = canvasRef.current.getBoundingClientRect()
    const next = {
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
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

        <div
          className="location-control"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setIsLocationOpen(false)
          }}
        >
          <button
            className={`location-bar${isLocationOpen ? ' is-open' : ''}`}
            type="button"
            aria-haspopup="menu"
            aria-expanded={isLocationOpen}
            onClick={() => setIsLocationOpen((current) => !current)}
          >
            <span>cursor/</span><strong>{playground.id}</strong>
          </button>

          {isLocationOpen && (
            <div className="location-menu" role="menu" aria-label="Choose cursor playground">
              {PLAYGROUNDS.map((option, index) => (
                <button
                  className="location-option"
                  type="button"
                  role="menuitemradio"
                  aria-checked={index === playgroundIndex}
                  key={option.id}
                  onClick={() => switchPlayground(index)}
                >
                  <span className="location-option__label">{option.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
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
