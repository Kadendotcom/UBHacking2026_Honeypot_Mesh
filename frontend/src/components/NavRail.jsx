import { NavLink } from 'react-router'

const links = [
  { to: '/', label: 'Horizon', icon: '◉', end: true },
  { to: '/transmissions', label: 'Signals', icon: '≋' },
  { to: '/chart', label: 'Chart', icon: '✶' },
]

export default function NavRail() {
  return (
    <nav className="flex w-20 flex-col items-center gap-2 border-r border-border py-4">
      <div className="mb-6 font-display text-3xl italic">E</div>

      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) =>
            `relative flex w-full flex-col items-center gap-1 py-3 transition-colors ${
              isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-2 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-live" />
              )}
              <span className="text-xl" aria-hidden="true">{link.icon}</span>
              <span className="text-[10px] uppercase tracking-widest">{link.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
