
"""Fake SSH honeypot server using Paramiko."""

import logging
import socket
import threading
import uuid
from model_inference import generate_response
import paramiko
from fake_session import FakeSession
import json
import urllib.request
import queue
# SSH host keys
HOSTKEY_RSA = paramiko.RSAKey(filename="keys/server_rsa")
HOSTKEY_ECDSA = paramiko.ECDSAKey(filename="keys/server_ecdsa")
HOSTKEY_ED25519 = paramiko.Ed25519Key(filename="keys/server_ed25519")

HOSTKEYS = [HOSTKEY_ECDSA, HOSTKEY_ED25519, HOSTKEY_RSA]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


COLLECTOR_URL = "http://127.0.0.1:8000/events"
NODE_ID = "n1"


event_queue = queue.Queue(maxsize=1000)


def event_worker():
    while True:
        payload = event_queue.get()

        try:
            request = urllib.request.Request(
                COLLECTOR_URL,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )

            with urllib.request.urlopen(request, timeout=2) as response:
                response.read()

        except Exception:
            logger.exception("Failed to send event to backend")

        finally:
            event_queue.task_done()


def send_event(session_id, src_ip, event_type, **fields):
    try:
        payload = {
            "session_id": session_id,
            "src_ip": src_ip,
            "node_id": NODE_ID,
            "type": event_type,
            "protocol": "ssh",
            **fields,
        }

        event_queue.put_nowait(payload)

    except queue.Full:
        logger.warning("Event queue full; dropping %s event", event_type)
    except Exception:
        logger.exception("Failed to queue event")


threading.Thread(
    target=event_worker,
    name="collector-worker",
    daemon=True,
).start()
class BaseServer(paramiko.ServerInterface):

    def __init__(self):
        self.event = threading.Event()
        self.responses = {
            "whoami": "root",
            "pwd": "/root",
            "hostname": "ubuntu",
            "ls": "secrets.txt  documents  downloads",
            "uname": "Linux",
            "id": "uid=0(root) gid=0(root) groups=0(root)",

            "cat /etc/hostname": "ubuntu",

            "cat /etc/os-release": (
                'PRETTY_NAME="Ubuntu 22.04.3 LTS"\n'
                'NAME="Ubuntu"\n'
                'VERSION_ID="22.04"\n'
                'ID=ubuntu'
            ),

            "sudo -l": (
                "Matching Defaults entries for root on ubuntu:\n"
                "    env_reset, mail_badpass\n\n"
                "User root may run the following commands on ubuntu:\n"
                "    (ALL : ALL) ALL"
            ),

            "cat secrets.txt": "FAKE_PASSWORD=example123",
        }
        self.responses.update({
            "sudo -l": (
                "Matching Defaults entries for root on ubuntu:\n"
                "    env_reset, mail_badpass\n\n"
                "User root may run the following commands on ubuntu:\n"
                "    (ALL : ALL) ALL"
            ),
            "hostname": "ubuntu",
            "id": "uid=0(root) gid=0(root) groups=0(root)",
            "uname": "Linux",
            "ls -a": ". .. .bashrc Documents Downloads secrets.txt",
            "ls /": "bin boot dev etc home lib opt proc root tmp usr var",
            "cat /etc/hostname": "ubuntu",
            "cat /etc/os-release": (
                'PRETTY_NAME="Ubuntu 22.04.5 LTS"\n'
                'NAME="Ubuntu"\n'
                'VERSION_ID="22.04"'
            ),
            "cat secrets.txt": "DB_USER=demo\nDB_PASSWORD=FAKE_PASSWORD",
            "ps aux": (
                "USER PID %CPU %MEM COMMAND\n"
                "root 1 0.0 0.1 /sbin/init\n"
                "root 782 0.0 0.2 /usr/sbin/sshd"
            ),
            "systemctl status ssh": (
                "● ssh.service - OpenBSD Secure Shell server\n"
                "     Active: active (running)"
            ),
        })

    # Authentication
    def get_allowed_auths(self, username):
        return "password"

    def check_auth_password(self, username, password):
        send_event(
            self.session_id,
            self.src_ip,
            "login",
            username=username,
            password=password,
        )
        return paramiko.AUTH_SUCCESSFUL

    # SSH channel
    def check_channel_request(self, kind, chanid):
        if kind == "session":
            return paramiko.OPEN_SUCCEEDED

        return paramiko.OPEN_FAILED_ADMINISTRATIVELY_PROHIBITED

    def check_channel_pty_request(
        self, channel, term, width, height,
        pixelwidth, pixelheight, modes
    ):
        print("DEBUG: PTY request received", flush=True)
        return True

    def check_channel_shell_request(self, channel):
        print("DEBUG: Shell request received", flush=True)
        self.event.set()
        return True

    def get_banner(self):
        return ("Paramiko test server", "en-US")

    # Load SSH host keys
    def _load_host_keys(self, transport):
        for host_key in HOSTKEYS:
            transport.add_server_key(host_key)

    # Fake Linux terminal

    def execute_fake_command(self, command, session=None):
        command = command.strip()

        if not command:
            return ""

        # First, check hardcoded responses
        if command in self.responses:
            print(f"HARDCODED: {command}", flush=True)
            return self.responses[command]

        # Otherwise, use your fine-tuned MLX model
        try:
            print(f"MLX COMMAND: {command}", flush=True)

            context = session.snapshot() if session else None

            output = generate_response(
                command,
                session_context=context
            )

            print(f"MLX OUTPUT: {output!r}", flush=True)

            return str(output) if output is not None else ""

        except Exception:
            logger.exception("MLX inference failed")
            return "bash: temporary system error"

    def handle_shell(self, channel):
        session = FakeSession()
        print("DEBUG: Fake shell started", flush=True)

        channel.sendall(b"Welcome to Ubuntu 22.04 LTS\r\n")
        channel.sendall(b"root@ubuntu:~# ")

        buffer = ""
        last_was_cr = False

        while True:
            data = channel.recv(1024)

            if not data:
                break

            for char in data.decode("utf-8", errors="replace"):

                # Avoid processing CRLF as two commands
                if char == "\n" and last_was_cr:
                    last_was_cr = False
                    continue

                last_was_cr = (char == "\r")

                if char in ("\r", "\n"):
                    command = buffer.strip()
                    buffer = ""

                    channel.sendall(b"\r\n")

                    if command == "exit":
                        channel.sendall(b"logout\r\n")
                        return

                    if command:
                        print(f"COMMAND: {command}", flush=True)

                        handled, output = session.execute(command)

                        if not handled:
                            output = self.execute_fake_command(command, session)

                        send_event(
                            self.session_id, self.src_ip, "command",
                            command=command, response=output,
                        )

                        # Normalize line endings
                        output = output.replace("\r\n", "\n")
                        output = output.replace("\r", "\n")
                        output = output.replace("\n", "\r\n")

                        if output:
                            channel.sendall(
                                (output + "\r\n").encode("utf-8")
                            )

                    channel.sendall(session.prompt().encode("utf-8"))

                elif char in ("\x08", "\x7f"):
                    if buffer:
                        buffer = buffer[:-1]
                        channel.sendall(b"\b \b")

                elif char.isprintable():
                    buffer += char
                    channel.sendall(char.encode("utf-8"))


        
    
    # Start SSH server
    def listen(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

        sock.setsockopt(
            socket.SOL_SOCKET,
            socket.SO_REUSEADDR,
            1
        )

        sock.bind(("127.0.0.1", 2222))
        sock.listen(100)

        print("DEBUG: Listening on 127.0.0.1:2222", flush=True)

        try:
            client, addr = sock.accept()
            self.session_id = str(uuid.uuid4())
            self.src_ip = addr[0]
            print(f"DEBUG: Connection from {addr}", flush=True)

            transport = paramiko.Transport(client)

            try:
                self._load_host_keys(transport)

                transport.start_server(server=self)
                print("DEBUG: SSH server started", flush=True)

                channel = transport.accept(20)

                if channel is None:
                    raise ValueError("No SSH channel opened")

                print("DEBUG: Channel accepted", flush=True)

                if not self.event.wait(30):
                    raise ValueError("No shell request received")

                print("DEBUG: Starting fake Linux shell", flush=True)

                try:
                    self.handle_shell(channel)
                finally:
                    channel.close()

            finally:
                transport.close()
                send_event(self.session_id, self.src_ip, "logout")

        finally:
            sock.close()

def clean_terminal_output(output):
    output = output.strip()

    if output.startswith("```"):
        lines = output.splitlines()

        if lines and lines[0].startswith("```"):
            lines.pop(0)

        if lines and lines[-1].strip() == "```":
            lines.pop()

        output = "\n".join(lines)

    return output

if __name__ == "__main__":
    while True:
        try:
            server = BaseServer()
            server.listen()

        except KeyboardInterrupt:
            print("\nServer stopped")
            break

        except Exception:
            logger.exception("Caught exception from listener")
