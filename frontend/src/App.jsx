import { BrowserRouter, Routes, Route, Link } from 'react-router'
import { Button } from '@/components/ui/button'

function Horizon() {
  return <h1 className="text-3xl font-bold">Horizon</h1>
}

function Transmissions() {
  return <h1 className="text-3xl font-bold">Transmissions</h1>
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground p-8">
        <nav className="flex gap-4 mb-8">
          <Link to="/">Horizon</Link>
          <Link to="/transmissions">Transmissions</Link>
        </nav>
        <Routes>
          <Route path="/" element={<Horizon />} />
          <Route path="/transmissions" element={<Transmissions />} />
        </Routes>
        <Button className="mt-8">Cross the horizon</Button>
      </div>
    </BrowserRouter>
  )
}
