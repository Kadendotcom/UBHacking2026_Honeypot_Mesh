import { useState } from 'react'
import { Outlet } from 'react-router'
import NavRail from '@/components/NavRail'
import TopBar from '@/components/TopBar'

export default function AppShell() {
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background text-foreground">
      {navOpen && <NavRail />}
      <div className="flex flex-1 flex-col">
        <TopBar navOpen={navOpen} onToggleNav={() => setNavOpen((open) => !open)} />
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
