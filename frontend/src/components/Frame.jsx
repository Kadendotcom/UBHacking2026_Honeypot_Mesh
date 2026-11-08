// The frame around every page: a double border with tick marks along the
// top and left edges, and the page heading aligned to the left.
// `leading` is optional: something to show above the heading (like a back link).
// `fill` stretches the frame to the screen height so its content can size to fit. It never shrinks
// below its content: on a short window the page scrolls instead of content spilling past the border.
// `scrollInside` (with `fill`) lets the frame shrink anyway, for pages whose content scrolls inside it.

export default function Frame({ title, caption, leading, fill = false, scrollInside = false, children }) {
  const fillClass = fill ? `flex flex-1 flex-col ${scrollInside ? 'min-h-0' : ''}` : ''

  return (
    <section className={`neatline min-w-0 bg-night ${fillClass}`}>
      <div className="graduated-x absolute inset-x-[5px] top-[5px]" aria-hidden="true" />
      <div className="graduated-y absolute inset-y-[5px] left-[5px]" aria-hidden="true" />

      <div className={`min-w-0 px-5 pb-8 pt-10 sm:px-10 ${fillClass}`}>
        <header className="mb-8 shrink-0">
          {leading && <div className="mb-3">{leading}</div>}
          <h1 className="font-display text-4xl italic [overflow-wrap:anywhere] sm:text-5xl">{title}</h1>
          {caption && <p className="mt-2 max-w-xl text-sm text-muted-foreground">{caption}</p>}
        </header>
        {children}
      </div>
    </section>
  )
}
