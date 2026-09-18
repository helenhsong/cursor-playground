import { useEffect, useState } from 'react'
import { ProjectHeader } from '@helenhsong/ui'
import '@helenhsong/ui/style.css'
import readme from '../README.md?raw'
import { CursorWindow } from './CursorWindow.jsx'

const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`
const INTRO_ASSETS = [
  `${ASSET_BASE}gaze-center.png`,
  `${ASSET_BASE}gaze-peony-cursor.png`,
]

function preloadImage(source) {
  return new Promise((resolve) => {
    const image = new Image()
    const finish = () => resolve()
    image.addEventListener('load', finish, { once: true })
    image.addEventListener('error', finish, { once: true })
    image.src = source
  })
}

function App() {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let isCancelled = false
    const isReadme = /\/readme\/?$/.test(window.location.pathname)
    const fontsReady = document.fonts?.ready ?? Promise.resolve()
    const assetsReady = isReadme ? [] : INTRO_ASSETS.map(preloadImage)

    Promise.all([fontsReady, ...assetsReady]).then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!isCancelled) setIsReady(true)
        })
      })
    })

    return () => {
      isCancelled = true
    }
  }, [])

  return (
    <div className={`app-shell${isReady ? ' is-ready' : ''}`} aria-busy={!isReady}>
      <ProjectHeader readme={readme} />
      <main className="project-page">
        <CursorWindow />
      </main>
    </div>
  )
}

export default App
