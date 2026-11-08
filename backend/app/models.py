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