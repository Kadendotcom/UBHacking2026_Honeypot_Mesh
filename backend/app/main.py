from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware 
from . import store 
from .models import EventIn
from .db import init_db 
app =FastAPI(title = "GravityWell")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"]
)
init_db()

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/sessions")
def list_sessions():
    return [dict(r) for r in store.list_sessions()]
@app.post("/events")
def post_event(ev: EventIn):
    store.insert_event(ev)
    return {"ok": True}

@app.get("/sessions/{session_id}/events")
def get_session_events(session_id: str):
    rows = store.list_session_events(session_id)
    return [dict(row) for row in rows]
    