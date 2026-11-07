
"""Fake SSH honeypot server using Paramiko."""

import logging
import socket
import threading

import paramiko

# SSH host keys
HOSTKEY_RSA = paramiko.RSAKey(filename="keys/server_rsa")
HOSTKEY_ECDSA = paramiko.ECDSAKey(filename="keys/server_ecdsa")
HOSTKEY_ED25519 = paramiko.Ed25519Key(filename="keys/server_ed25519")

HOSTKEYS = [HOSTKEY_ECDSA, HOSTKEY_ED25519, HOSTKEY_RSA]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class BaseServer(paramiko.ServerInterface):

    def __init__(self):
        self.event = threading.Event()

    # Authentication
    def get_allowed_auths(self, username):
        return "password"

    def check_auth_password(self, username, password):
        if username == "user" and password == "password":
            return paramiko.AUTH_SUCCESSFUL

        return paramiko.AUTH_FAILED

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
    def handle_shell(self, channel):
        print("DEBUG: Fake shell started", flush=True)

        channel.send(b"Welcome to Ubuntu 22.04 LTS\r\n")
        channel.send(b"root@ubuntu:~# ")

        responses = {
            "whoami": "root",
            "pwd": "/root",
            "ls": "Documents Downloads secrets.txt",
            "uname -s": "Linux",
            "uname -a": "Linux ubuntu 5.15.0 x86_64 GNU/Linux",
        }

        buffer = ""

        while True:
            data = channel.recv(1024)

            if not data:
                break

            for char in data.decode("utf-8", errors="replace"):

                if char in ("\r", "\n"):
                    command = buffer.strip()
                    buffer = ""

                    channel.send(b"\r\n")

                    if command == "exit":
                        channel.send(b"logout\r\n")
                        return

                    if command:
                        print(f"COMMAND: {command}", flush=True)

                        output = responses.get(
                            command,
                            f"bash: {command}: command not found"
                        )

                        channel.send(
                            (output + "\r\n").encode("utf-8")
                        )

                    channel.send(b"root@ubuntu:~# ")

                elif char in ("\x08", "\x7f"):
                    if buffer:
                        buffer = buffer[:-1]
                        channel.send(b"\b \b")

                elif char.isprintable():
                    buffer += char
                    channel.send(char.encode("utf-8"))

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

        finally:
            sock.close()


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
