import { BrowserRouter, Routes, Route } from 'react-router'
import AppShell from '@/layouts/AppShell'
import Horizon from '@/pages/Horizon'
import Transmissions from '@/pages/Transmissions'
import SessionDetail from '@/pages/SessionDetail'
import StarChart from '@/pages/StarChart'
import NotFound from '@/pages/NotFound'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Horizon />} />
          <Route path="transmissions" element={<Transmissions />} />
          <Route path="transmissions/:id" element={<SessionDetail />} />
          <Route path="chart" element={<StarChart />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
