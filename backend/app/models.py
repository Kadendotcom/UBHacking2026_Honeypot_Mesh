from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class EventIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str
    src_ip: str
    node_id: str
    type: Literal["login", "command", "logout"]
    protocol: str = "ssh"
    ts: str | None = None
    username: str | None = None
    password: str | None = None
    command: str | None = Field(default=None, max_length=4000)
    response: str | None = None
    severity: int | None = Field(default=None, ge=0, le=4)
    confidence: float | None = Field(default=None, ge=0, le=1)
    classification_error: str | None = None
    session_flagged: bool = False
    session_newly_flagged: bool = False
    session_priority: Literal["review", "high"] | None = None
    session_flag_reason: str | None = None
