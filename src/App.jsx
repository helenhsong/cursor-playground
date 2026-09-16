import { ProjectHeader } from '@helenhsong/ui'
import '@helenhsong/ui/style.css'
import readme from '../README.md?raw'
import { CursorWindow } from './CursorWindow.jsx'

function App() {
  return (
    <>
      <ProjectHeader readme={readme} />
      <main className="project-page">
        <CursorWindow />
      </main>
    </>
  )
}

export default App
