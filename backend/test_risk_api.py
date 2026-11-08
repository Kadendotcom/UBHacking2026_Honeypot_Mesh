"""Run with the backend environment: python -m unittest backend.test_risk_api -v."""
from pathlib import Path
import os
import sqlite3
import tempfile
import unittest

_temp = tempfile.TemporaryDirectory()
os.environ["HONEYPOT_DB_PATH"] = _temp.name + "/test.db"
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app import db


class RiskApiTests(unittest.TestCase):
    def setUp(self):
        with db.tLock:
            for table in ("events", "sessions"):
                db.conn.execute(f"DELETE FROM {table}")
            db.conn.commit()
        self.client = TestClient(app)

    def post(self, **fields):
        payload = dict(session_id="one", src_ip="192.0.2.1", node_id="n1",
                       type="command", command="test", username="alice")
        payload.update(fields)
        return self.client.post("/events", json=payload)

    def test_prediction_round_trip_and_persistent_session_flag(self):
        self.assertEqual(self.post(severity=4, confidence=.9, session_flagged=True,
            session_newly_flagged=True, session_priority="high",
            session_flag_reason="high_severity_command").status_code, 200)
        self.assertEqual(self.post(severity=0, confidence=.8).status_code, 200)
        self.post(type="logout", command=None)
        session = self.client.get("/sessions/one").json()
        self.assertEqual(session["session_priority"], "high")
        self.assertEqual(session["severity"], 4)
        self.assertTrue(session["session_flagged"])
        self.assertEqual(session["status"], "closed")
        self.assertEqual(session["username"], "alice")
        self.assertEqual(session["events"][0]["severity"], 4)
        self.assertEqual(self.client.get("/sessions").json()[0]["session_priority"], "high")
        self.assertEqual(self.client.get("/events").json()[0]["confidence"], .9)
        self.assertEqual(self.client.get("/sessions/one/events").json()[0]["severity"], 4)
        self.assertEqual(self.client.get("/stats").json()["high_priority_sessions"], 1)
        self.post(session_id="two", username="bob")
        self.assertFalse(self.client.get("/sessions/two").json()["session_flagged"])

    def test_validation_and_legacy_events(self):
        self.assertEqual(self.post(severity=5).status_code, 422)
        self.assertEqual(self.post(confidence=1.1).status_code, 422)
        self.assertEqual(self.post(session_priority="invalid").status_code, 422)
        self.assertEqual(self.post().status_code, 200)

    def test_migration_preserves_existing_rows_and_is_repeatable(self):
        original = db.conn
        try:
            db.conn = sqlite3.connect(":memory:")
            db.conn.row_factory = sqlite3.Row
            schema = Path(db.__file__).with_name("schema.sql").read_text()
            db.conn.executescript(schema)
            db.conn.execute("INSERT INTO sessions (id) VALUES ('existing')")
            db.conn.commit()
            db.init_db()
            db.init_db()
            row = db.conn.execute("SELECT * FROM sessions WHERE id='existing'").fetchone()
            self.assertEqual(row["session_flagged"], 0)
            self.assertIsNone(row["session_priority"])
        finally:
            db.conn.close()
            db.conn = original
