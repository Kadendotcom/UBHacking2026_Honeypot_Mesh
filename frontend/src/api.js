// All calls to the backend go through this file.
// While the real API isn't ready, USE_MOCK = true serves the JSON files in src/mock/.
// When it's ready: set USE_MOCK = false and put the API address in a .env file:
//   VITE_API_URL=http://localhost:8000

import mockSessions from './mock/sessions.json'
import mockClusters from './mock/clusters.json'
import mockIocs from './mock/iocs.json'
import mockStats from './mock/stats.json'

export const USE_MOCK = true
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// Pretend the network takes a moment, so loading states get tested too.
const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

async function request(path) {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`)
  return res.json()
}

// The list view doesn't need every command, so strip `events` out.
function summarize(session) {
  const { events, ...rest } = session
  return { ...rest, event_count: events.length }
}

/** GET /sessions → list of sessions, newest first, without events */
export async function getSessions() {
  if (USE_MOCK) {
    await delay()
    return mockSessions.map(summarize)
  }
  return request('/sessions')
}

/** GET /sessions/:id → one session including its events */
export async function getSession(id) {
  if (USE_MOCK) {
    await delay()
    const session = mockSessions.find((s) => s.id === id)
    if (!session) throw new Error(`Session ${id} not found`)
    return session
  }
  return request(`/sessions/${id}`)
}

/** GET /clusters → list of clusters */
export async function getClusters() {
  if (USE_MOCK) {
    await delay()
    return mockClusters
  }
  return request('/clusters')
}

/** GET /iocs → list of indicators of compromise */
export async function getIocs() {
  if (USE_MOCK) {
    await delay()
    return mockIocs
  }
  return request('/iocs')
}

/** GET /stats → headline numbers for the top bar and home page */
export async function getStats() {
  if (USE_MOCK) {
    await delay()
    return mockStats
  }
  return request('/stats')
}
