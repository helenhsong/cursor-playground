import { useEffect, useRef, useState } from 'react'

const PLAYGROUNDS = [
  { id: 'gaze', name: 'Gaze' },
  { id: 'sketch', name: 'Sketch' },
  { id: 'pixel', name: 'Pixel' },
  { id: 'magnetic', name: 'Magnetic' },
  { id: 'ripple', name: 'Ripple' },
]

const INITIAL_TRAIL = [
  { x: 43, y: 55 },
  { x: 46, y: 53 },
  { x: 49, y: 51 },
  { x: 52, y: 48 },
]

const FIELD_NODES = Array.from({ length: 48 }, (_, index) => ({
  x: 8 + (index % 8) * 12,
  y: 12 + Math.floor(index / 8) * 15,
}))

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
  sketch: [
    { key: 'trail', label: 'Trail length', min: 6, max: 23, step: 1, defaultValue: 23, precision: 0 },
    { key: 'weight', label: 'Pencil weight', min: 0.25, max: 1.2, step: 0.05, defaultValue: 0.58, precision: 2 },
    { key: 'echo', label: 'Line echo', min: 0, max: 0.8, step: 0.05, defaultValue: 0.3, precision: 2 },
  ],
  pixel: [
    { key: 'trail', label: 'Trail length', min: 4, max: 23, step: 1, defaultValue: 16, precision: 0 },
    { key: 'snap', label: 'Grid snap', min: 1.25, max: 5, step: 0.25, defaultValue: 2.5, precision: 2 },
    { key: 'glow', label: 'Pixel glow', min: 0, max: 22, step: 1, defaultValue: 12, precision: 0, suffix: 'px' },
  ],
  magnetic: [
    { key: 'radius', label: 'Field radius', min: 18, max: 55, step: 1, defaultValue: 34, precision: 0, suffix: '%' },
    { key: 'pull', label: 'Attraction', min: 0.08, max: 0.5, step: 0.02, defaultValue: 0.26, precision: 2 },
    { key: 'bloom', label: 'Node bloom', min: 1, max: 5, step: 0.2, defaultValue: 2.6, precision: 1, suffix: '×' },
  ],
  ripple: [
    { key: 'rings', label: 'Echoes', min: 2, max: 8, step: 1, defaultValue: 5, precision: 0 },
    { key: 'speed', label: 'Decay speed', min: 0.8, max: 3.5, step: 0.1, defaultValue: 1.9, precision: 1, suffix: 's' },
    { key: 'reach', label: 'Ripple reach', min: 2.5, max: 8, step: 0.25, defaultValue: 5.4, precision: 2, suffix: '×' },
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

function nodePosition(node, pointer, settings) {
  const dx = pointer.x - node.x
  const dy = pointer.y - node.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  const pull = Math.max(0, 1 - distance / settings.radius) * settings.pull

  return {
    left: `${node.x + dx * pull}%`,
    top: `${node.y + dy * pull}%`,
    transform: `translate(-50%, -50%) scale(${1 + pull * settings.bloom})`,
  }
}

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

    if (horizontalDistance >= 0.14) {
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

function SketchPlayground({ pointer, trail, settings }) {
  const points = trail.slice(-settings.trail).map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <div className="scene scene--sketch">
      <span className="sketch-doodle sketch-doodle--star">✦</span>
      <span className="sketch-doodle sketch-doodle--loop">⌁</span>
      <span className="sketch-note">move slowly / draw freely</span>
      <svg
        className="sketch-line"
        style={{ '--sketch-weight': settings.weight, '--sketch-echo': settings.echo }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline points={points} />
        <polyline className="sketch-line__ghost" points={points} transform="translate(0.35 0.28)" />
      </svg>
      <span className="sketch-cursor" style={{ left: `${pointer.x}%`, top: `${pointer.y}%` }}>
        <i />
      </span>
    </div>
  )
}

function PixelPlayground({ pointer, trail, settings }) {
  return (
    <div className="scene scene--pixel">
      <div className="pixel-horizon" aria-hidden="true" />
      {trail.slice(-settings.trail).map((point, index) => (
        <span
          className="pixel-block"
          key={`${point.x}-${point.y}-${index}`}
          style={{
            left: `${Math.round(point.x / settings.snap) * settings.snap}%`,
            top: `${Math.round(point.y / settings.snap) * settings.snap}%`,
            opacity: 0.18 + index / Math.max(settings.trail + 3, 7),
            boxShadow: `0 0 0 2px #153f48, 0 0 ${settings.glow}px #53efb0`,
          }}
        />
      ))}
      <span className="pixel-sprite pixel-sprite--one" />
      <span className="pixel-sprite pixel-sprite--two" />
      <span className="pixel-cursor" style={{ left: `${pointer.x}%`, top: `${pointer.y}%` }} />
    </div>
  )
}

function MagneticPlayground({ pointer, settings }) {
  return (
    <div className="scene scene--magnetic">
      <svg className="field-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <circle cx={pointer.x} cy={pointer.y} r={settings.radius * 0.38} />
        <circle cx={pointer.x} cy={pointer.y} r={settings.radius * 0.65} />
      </svg>
      {FIELD_NODES.map((node, index) => (
        <span className="field-node" key={index} style={nodePosition(node, pointer, settings)} />
      ))}
      <span className="magnetic-core" style={{ left: `${pointer.x}%`, top: `${pointer.y}%` }}>
        <i />
      </span>
    </div>
  )
}

function RipplePlayground({ pointer, trail, settings }) {
  return (
    <div className="scene scene--ripple" style={{ '--ripple-reach': settings.reach }}>
      <span className="water-light" style={{ left: `${pointer.x}%`, top: `${pointer.y}%` }} />
      {trail.slice(-settings.rings).map((point, index) => (
        <span
          className="ripple-ring"
          key={`${point.x}-${point.y}-${index}`}
          style={{
            left: `${point.x}%`,
            top: `${point.y}%`,
            animationDelay: `${index * -0.16}s`,
            animationDuration: `${settings.speed}s`,
          }}
        />
      ))}
      <span className="ripple-cursor" style={{ left: `${pointer.x}%`, top: `${pointer.y}%` }} />
    </div>
  )
}

function PlaygroundScene({ id, pointer, trail, settings }) {
  if (id === 'sketch') return <SketchPlayground pointer={pointer} trail={trail} settings={settings} />
  if (id === 'pixel') return <PixelPlayground pointer={pointer} trail={trail} settings={settings} />
  if (id === 'magnetic') return <MagneticPlayground pointer={pointer} settings={settings} />
  if (id === 'ripple') return <RipplePlayground pointer={pointer} trail={trail} settings={settings} />
  return <GazePlayground pointer={pointer} settings={settings} />
}

export function CursorWindow() {
  const canvasRef = useRef(null)
  const [playgroundIndex, setPlaygroundIndex] = useState(0)
  const [pointer, setPointer] = useState({ x: 52, y: 48 })
  const [trail, setTrail] = useState(INITIAL_TRAIL)
  const [isLocationOpen, setIsLocationOpen] = useState(false)

  const playground = PLAYGROUNDS[playgroundIndex]
  const settings = DEFAULT_SETTINGS[playground.id]

  function switchPlayground(nextIndex) {
    const wrapped = (nextIndex + PLAYGROUNDS.length) % PLAYGROUNDS.length
    setPlaygroundIndex(wrapped)
    setPointer({ x: 52, y: 48 })
    setTrail(INITIAL_TRAIL)
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
      setTrail(INITIAL_TRAIL)
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
    setTrail((current) => [...current.slice(-22), next])
  }

  return (
    <section className="mac-window" aria-label="Cursor Playground">
      <header className="window-titlebar">
        <div className="traffic-lights" aria-label="Window controls">
          <button className="traffic-light traffic-light--close" type="button" aria-label="Close" />
          <button className="traffic-light traffic-light--minimize" type="button" aria-label="Minimize" />
          <button className="traffic-light traffic-light--zoom" type="button" aria-label="Zoom" />
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
              <div className="location-menu__header" aria-hidden="true">
                <span>Playgrounds</span>
                <span>← → to switch</span>
              </div>
              {PLAYGROUNDS.map((option, index) => (
                <button
                  className={`location-option location-option--${option.id}`}
                  type="button"
                  role="menuitemradio"
                  aria-checked={index === playgroundIndex}
                  key={option.id}
                  onClick={() => switchPlayground(index)}
                >
                  <span className="location-option__icon" aria-hidden="true" />
                  <span className="location-option__copy">
                    <strong>{option.name}</strong>
                    <small>cursor/{option.id}</small>
                  </span>
                  <span className="location-option__check" aria-hidden="true">✓</span>
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
        <PlaygroundScene id={playground.id} pointer={pointer} trail={trail} settings={settings} />
      </div>
    </section>
  )
}
