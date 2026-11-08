# Gravity Well API contract

The frontend reads live data from the FastAPI collector. Set `VITE_API_URL` in
`frontend/.env` to the API base URL; it defaults to `http://localhost:8000`.
The dashboard refreshes its lists and headline stats every five seconds, and
refreshes an active replay on the same interval.

All responses are JSON. Times are ISO 8601 (`"2026-11-07T17:01:00Z"`). IDs
used by the UI are strings.

**CORS:** the frontend runs at `http://localhost:5173` during development, so
the API must allow that origin.

## Endpoints

| Method | Path | Returns |
|---|---|---|
| GET | `/sessions` | All sessions, newest first, without `events` |
| GET | `/sessions/{id}` | One session with `events` |
| GET | `/clusters` | All clusters |
| GET | `/iocs` | All indicators of compromise |
| GET | `/stats` | Headline numbers |

`GET /sessions/{id}/events` and `GET /events` remain available for collector
clients. The dashboard uses `/sessions/{id}` for replay data.

## Session

| Field | Notes |
|---|---|
| `id`, `src_ip`, `protocol`, `node_id` | Collector session fields |
| `country` | Two-letter code, or `"Unknown"` until GeoIP is available |
| `started_at`, `ended_at` | ISO 8601 timestamps; `ended_at` is `null` while active |
| `duration_s` | Calculated from `started_at` to `ended_at` for closed sessions and to the current time for active sessions |
| `status`, `event_count`, `cluster_id` | Collector session fields |
| `position` | Currently `null`; the collector does not store embedding coordinates yet |
| `ioc_ids` | String IOC IDs associated with the session |
| `events` | Only in `/sessions/{id}`; `t` is seconds since session start and `type` is `login`, `input`, or `output` |

Replay events are converted from collector `login` and `command` rows.
Commands become `input` events and non-empty responses become `output`
events.

## Cluster

Cluster records include `id`, `name`, `label`, `summary`, `first_seen`,
`last_seen`, and a computed `session_count`. `category` is currently
`"unknown"` because the collector schema does not store the classifier result.

## IOC

IOC records include `id`, `type`, `value`, `first_seen`, `session_ids`, and
`cluster_ids`. The current IOC table does not store `last_seen`; the frontend
uses `first_seen` to sort those records until that field is available.

## Stats

`/stats` reports `active_sessions`, `total_sessions`, `total_engaged_s`,
`avg_engaged_s`, `cluster_count`, `ioc_count`, and `nodes`. Node names
currently fall back to their IDs because the collector does not store names or
personas. `baseline_avg_s` is `null` because the collector has no baseline
source; the frontend hides time dilation until a positive baseline is
provided.

The frontend polls until a push-based `WS /live` endpoint exists.
