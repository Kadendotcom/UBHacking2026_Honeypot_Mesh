// Wrap every IOC found in a line of text in an amber <mark>.
// Returns a list of strings and <mark> elements React can render.
export function highlightIocs(text, iocValues) {
  if (iocValues.length === 0) return [text]

  // Escape characters like . and / that mean something special in a regex
  const escaped = iocValues.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'g')

  // split() with a (group) keeps the matches, so the parts alternate:
  // [normal, match, normal, match, ...]
  return text.split(pattern).map((part, i) =>
    iocValues.includes(part) ? (
      <mark key={i} className="bg-live/20 px-0.5 text-live">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}
