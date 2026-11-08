import { useEffect, useRef, useState } from 'react'

export default function usePolling(load, intervalMs = 5000) {
  const loadRef = useRef(load)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    let active = true
    let pending = false

    async function refresh() {
      if (pending) return
      pending = true
      try {
        const result = await loadRef.current()
        if (active) {
          setData(result)
          setError(null)
        }
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        pending = false
      }
    }

    refresh()
    const timer = setInterval(refresh, intervalMs)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [intervalMs])

  return { data, error }
}
