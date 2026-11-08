import unittest

from session_risk import SessionRisk


class SessionRiskTests(unittest.TestCase):
    def test_confidence_boundary_and_persistent_flag(self):
        risk = SessionRisk()
        self.assertFalse(risk.update(3, 0.699)["session_flagged"])
        result = risk.update(3, 0.70)
        self.assertTrue(result["session_newly_flagged"])
        self.assertEqual(result["session_priority"], "review")
        result = risk.update(0, 0.99)
        self.assertTrue(result["session_flagged"])
        self.assertFalse(result["session_newly_flagged"])

    def test_escalation_does_not_downgrade(self):
        risk = SessionRisk()
        risk.update(3, 0.8)
        self.assertEqual(risk.update(4, 0.7)["session_priority"], "high")
        self.assertEqual(risk.update(2, 0.8)["session_priority"], "high")

    def test_repeated_commands_even_with_low_confidence(self):
        risk = SessionRisk()
        for severity in [2, 0, 2, 1]:
            self.assertFalse(risk.update(severity, 0.4)["session_flagged"])
        result = risk.update(2, 0.4)
        self.assertTrue(result["session_flagged"])
        self.assertEqual(result["session_flag_reason"], "repeated_suspicious_commands")

    def test_window_expires_and_failures_count(self):
        risk = SessionRisk()
        for severity in [2, 2, 0, None, 0, 2]:
            self.assertFalse(risk.update(severity, 0.8)["session_flagged"])
        self.assertFalse(SessionRisk().update(None, None)["session_flagged"])

    def test_sessions_are_isolated(self):
        first, second = SessionRisk(), SessionRisk()
        first.update(4, 0.9)
        self.assertFalse(second.update(0, 0.9)["session_flagged"])
