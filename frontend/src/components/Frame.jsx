// The frame around every page: a double border with tick marks along the
// top and left edges, and the page heading aligned to the left.
// `leading` is optional: something to show above the heading (like a back link).
// `fill` makes the frame exactly fill the screen height so its content can size to fit (no scrolling).

export default function Frame({ title, caption, leading, fill = false, children }) {
  return (
    <section className={`neatline bg-night ${fill ? 'flex min-h-0 flex-1 flex-col' : ''}`}>
      <div className="graduated-x absolute inset-x-[5px] top-[5px]" aria-hidden="true" />
      <div className="graduated-y absolute inset-y-[5px] left-[5px]" aria-hidden="true" />

      <div className={`px-6 pb-8 pt-10 sm:px-10 ${fill ? 'flex min-h-0 flex-1 flex-col' : ''}`}>
        <header className="mb-8 shrink-0">
          {leading && <div className="mb-3">{leading}</div>}
          <h1 className="font-display text-5xl italic">{title}</h1>
          {caption && <p className="mt-2 max-w-xl text-sm text-muted-foreground">{caption}</p>}
        </header>
        {children}
      </div>
    </section>
  )
}
