from pydantic import BaseModel
from pydantic import Field

# defines messages/ events
class EventIn(BaseModel):
    session_id: str
    src_ip: str
    type: str #"login", "command" or "logout"
    protocol: str = "ssh"
    ts: str | None = None 
    username: str | None = None
    password: str | None = None
    command: str | None = Field(default=None, max_length=4000)
    response: str | None = None
    node_id: str