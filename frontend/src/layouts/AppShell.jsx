import { Outlet } from 'react-router'
import NavRail from '@/components/NavRail'
import TopBar from '@/components/TopBar'

export default function AppShell() {
  return (
    <div className="flex h-screen bg-abyss text-foreground">
      <NavRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
