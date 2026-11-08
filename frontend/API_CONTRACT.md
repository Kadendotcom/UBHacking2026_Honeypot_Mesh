# Event Horizon API contract (draft)

This is the data format the frontend expects. It's a proposal: change anything, just tell the frontend before renaming or removing a field. Full examples of every response are in `frontend/src/mock/`.

All responses are JSON. Times are ISO 8601 in UTC (`"2026-11-07T17:01:00Z"`). IDs are strings.

**CORS:** the frontend runs on `http://localhost:5173` during development, so the API needs to allow that origin. In FastAPI:

```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])
```

## Endpoints

| Method | Path | Returns |
|---|---|---|
| GET | `/sessions` | All sessions, newest first, **without** `events` |
| GET | `/sessions/{id}` | One session **with** `events` |
| GET | `/clusters` | All clusters |
| GET | `/iocs` | All indicators of compromise |
| GET | `/stats` | Headline numbers |

## Session

One attacker connection to a honeypot.

```json
{
  "id": "s001",
  "src_ip": "203.0.113.119",
  "country": "DE",
  "protocol": "ssh",
  "node_id": "n3",
  "started_at": "2026-11-07T17:40:00Z",
  "ended_at": null,
  "duration_s": 382,
  "status": "active",
  "cluster_id": "c1",
  "position": { "x": -2.23, "y": 1.635 },
  "ioc_ids": ["i13", "i14", "i29"],
  "event_count": 10,
  "events": [
    { "t": 0.0,  "type": "login",  "text": "login root / 123456  ✓ accepted" },
    { "t": 9.3,  "type": "input",  "text": "uname -a" },
    { "t": 10.3, "type": "output", "text": "Linux prod-db-02 5.15.0-91-generic ..." }
  ]
}
```

| Field | Notes |
|---|---|
| `country` | Two-letter country code |
| `protocol` | `"ssh"` or `"http"` |
| `node_id` | Which honeypot was hit (see `nodes` in `/stats`) |
| `ended_at` | `null` while the session is still active |
| `duration_s` | Seconds the attacker stayed (so far, if active) |
| `status` | `"active"` or `"closed"` |
| `cluster_id` | `null` if not clustered yet |
| `position` | 2D coordinates from the ML embedding (UMAP / t-SNE). Any scale is fine; the frontend rescales. `null` if not computed yet |
| `events` | Only in `/sessions/{id}`. `t` = seconds since session start. `type` is `"login"`, `"input"` (attacker) or `"output"` (LLM's fake response) |
| `event_count` | Only in `/sessions` (list) |

## Cluster

A group of similar attacks found by the ML.

```json
{
  "id": "c1",
  "category": "botnet",
  "name": "Mirai Nebula",
  "label": "IoT botnet dropper",
  "summary": "Logs in with default credentials, checks the CPU architecture, then ...",
  "mitre": [{ "id": "T1105", "name": "Ingress Tool Transfer" }],
  "session_count": 6,
  "first_seen": "2026-11-07T08:12:00Z",
  "last_seen": "2026-11-07T17:01:00Z",
  "ioc_ids": ["i4", "i16", "i17"]
}
```

| Field | Notes |
|---|---|
| `category` | One of `recon`, `botnet`, `miner`, `credential_theft`, `web_exploit`, `unknown`. Decides the star symbol on the chart, so it must be one of these exact values |
| `name` | Space-themed display name (an LLM can generate these) |
| `label` | Plain description of the attack type |
| `summary` | 1–3 sentence explanation (LLM-written) |
| `mitre` | MITRE ATT&CK techniques; can be `[]` |

## IOC (indicator of compromise)

```json
{
  "id": "i16",
  "type": "domain",
  "value": "cdn-update.invalid",
  "first_seen": "2026-11-07T08:12:00Z",
  "last_seen": "2026-11-07T17:01:00Z",
  "session_ids": ["s001", "s010"],
  "cluster_ids": ["c1"],
  "confidence": 0.93
}
```

| Field | Notes |
|---|---|
| `type` | `"ip"`, `"domain"`, `"url"`, `"hash"`, `"file_path"` (more is fine) |
| `confidence` | 0 to 1 |

## Stats

```json
{
  "active_sessions": 2,
  "total_sessions": 20,
  "total_engaged_s": 5646,
  "avg_engaged_s": 282,
  "baseline_avg_s": 14,
  "cluster_count": 4,
  "ioc_count": 31,
  "nodes": [
    { "id": "n1", "name": "Kepler", "persona": "Ubuntu 22.04 database server" }
  ]
}
```

| Field | Notes |
|---|---|
| `avg_engaged_s` | Average time attackers stay with the LLM honeypot |
| `baseline_avg_s` | Average for a normal (non-LLM) honeypot, for comparison. Can be a fixed number from research or testing |

## Later (optional)

- `WS /live`: push new sessions and events as they happen. Until then, the frontend re-fetches `/sessions` and `/stats` every few seconds.
