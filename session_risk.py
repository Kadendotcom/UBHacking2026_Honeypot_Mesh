"""Session alert policy for classifier predictions."""
from collections import deque


class SessionRisk:
    def __init__(self):
        self.recent = deque(maxlen=5)
        self.flagged = False
        self.priority = None
        self.reason = None

    def update(self, severity, confidence):
        # Failed predictions still consume a command in the five-command window.
        self.recent.append(severity)
        reason = None
        priority = None
        if severity is not None and confidence is not None:
            if severity >= 3 and confidence >= 0.70:
                reason = "high_severity_command"
                priority = "high" if severity >= 4 else "review"
        if reason is None and sum(s is not None and s >= 2 for s in self.recent) >= 3:
            reason = "repeated_suspicious_commands"
            priority = "review"

        newly_flagged = reason is not None and not self.flagged
        if reason is not None:
            if not self.flagged or (priority == "high" and self.priority != "high"):
                self.priority = priority
                self.reason = reason
            self.flagged = True

        return {
            "session_flagged": self.flagged,
            "session_newly_flagged": newly_flagged,
            "session_priority": self.priority,
            "session_flag_reason": self.reason,
        }
