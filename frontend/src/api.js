// All calls to the live backend go through this file.
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function request(path) {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`)
  return res.json()
}

/** GET /sessions → list of sessions, newest first, without events */
export const getSessions = () => request('/sessions')

/** GET /sessions/:id → one session including its events */
export const getSession = (id) => request(`/sessions/${encodeURIComponent(id)}`)

/** GET /clusters → all clusters */
export const getClusters = () => request('/clusters')

/** GET /iocs → all indicators of compromise */
export const getIocs = () => request('/iocs')

/** GET /stats → headline numbers for the top bar and home page */
export const getStats = () => request('/stats')
