from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware 

app =FastAPI(title = "GravityWell")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/sessions")
def list_sessions():
    return [
        {
            "id": "demo-0001",
            "honeypot": "hp1",
            "src_ip": "45.148.10.72",
            "username": "root",
            "started_at": "2026-11-07T18:22:01Z",
            "ended_at": "2026-11-07T18:24:40Z",
            "status": "closed",
            "command_count": 5,
            "cluster_name": "Cryptominer dropper",
            "severity": "high",
        },
        {
            "id": "demo-0002",
            "honeypot": "hp1",
            "src_ip": "193.32.162.14",
            "username": "admin",
            "started_at": "2026-11-07T18:31:12Z",
            "ended_at": None,
            "status": "open",
            "command_count": 2,
            "cluster_name": None,
            "severity": None,
        },
    ]