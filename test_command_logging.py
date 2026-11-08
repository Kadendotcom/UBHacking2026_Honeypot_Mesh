"""Exercise shell logging without loading MLX, SSH keys, or model artifacts."""
import importlib.util
import json
from pathlib import Path
import tempfile
import types
import threading
import unittest
from unittest.mock import MagicMock, patch


class CommandLoggingTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location(
            "server_under_test", Path(__file__).with_name("base_server.py")
        )
        self.server = importlib.util.module_from_spec(spec)
        paramiko = types.ModuleType("paramiko")
        paramiko.ServerInterface = object
        paramiko.AUTH_SUCCESSFUL = 0
        for name in ("RSAKey", "ECDSAKey", "Ed25519Key"):
            setattr(paramiko, name, MagicMock())
        classifier = types.ModuleType("attack_classifier")
        classifier.classify_command = MagicMock(
            return_value={"severity": 2, "confidence": 0.875}
        )
        inference = types.ModuleType("model_inference")
        inference.generate_response = MagicMock(return_value="fallback output")
        with patch.dict("sys.modules", {
            "paramiko": paramiko, "attack_classifier": classifier,
            "model_inference": inference,
        }), patch("threading.Thread.start"):
            spec.loader.exec_module(self.server)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.server.COMMAND_LOG_PATH = Path(self.temp.name) / "logs/commands.jsonl"
        self.server.MONITOR_LOG_PATH = Path(self.temp.name) / "logs/high.jsonl"

    def records(self):
        return [json.loads(line) for line in
                self.server.COMMAND_LOG_PATH.read_text().splitlines()]

    def test_shell_logs_local_fallback_and_exit_once_with_crlf(self):
        server = self.server.BaseServer()
        server.session_id = "session-test"
        server.src_ip = "192.0.2.1"
        channel = MagicMock()
        channel.recv.side_effect = [b'whoami\r\nunknown-command\r\nexit\r\n']
        with patch.object(self.server, "send_event") as send_event:
            server.handle_shell(channel)
        records = self.records()
        self.assertEqual([r["command"] for r in records],
                         ["whoami", "unknown-command", "exit"])
        self.assertEqual([r["response"] for r in records],
                         ["root", "fallback output", "logout"])
        self.assertTrue(all(r["severity"] == 2 and r["confidence"] == 0.875
                            and r["session_id"] == "session-test" for r in records))
        self.assertEqual(send_event.call_count, 3)
        self.assertEqual(send_event.call_args.kwargs["severity"], 2)
        self.assertFalse(records[0]["session_flagged"])
        self.assertTrue(records[-1]["session_newly_flagged"])
        self.assertEqual(records[-1]["session_flag_reason"],
                         "repeated_suspicious_commands")

    def test_failure_is_logged_and_newlines_remain_one_jsonl_record(self):
        self.server.classify_command.side_effect = RuntimeError("unavailable")
        with self.assertLogs(self.server.logger, level="ERROR"):
            self.server.log_command("s", "192.0.2.1", 'echo "hello"', "a\nb")
        record, = self.records()
        self.assertIsNone(record["severity"])
        self.assertEqual(record["classification_error"], "classification_failed")
        self.assertEqual(record["response"], "a\nb")

    def test_log_write_failure_does_not_raise(self):
        self.server.COMMAND_LOG_PATH = Path(self.temp.name)
        with self.assertLogs(self.server.logger, level="ERROR"):
            self.server.log_command("s", "192.0.2.1", "ls", "")

    def test_high_priority_keeps_shell_open_and_monitors_following_inputs(self):
        server = self.server.BaseServer()
        server.session_id = "monitored-session"
        server.src_ip = "192.0.2.2"
        with patch.object(self.server, "send_event"):
            server.check_auth_password("visitor", "test-password")
        self.server.classify_command.side_effect = [
            {"severity": 0, "confidence": 0.9},
            {"severity": 4, "confidence": 0.9},
            RuntimeError("inference unavailable"),
            {"severity": 0, "confidence": 0.9},
        ]
        channel = MagicMock()
        channel.recv.side_effect = [b"pwd\rwhoami\rpwd\rexit\r"]
        with patch.object(self.server, "send_event"), self.assertLogs(
            self.server.logger, level="WARNING"
        ):
            server.handle_shell(channel)
        monitored = [json.loads(line) for line in
                     self.server.MONITOR_LOG_PATH.read_text().splitlines()]
        self.assertEqual([r["command"] for r in monitored], ["whoami", "pwd", "exit"])
        self.assertTrue(all(r["username"] == "visitor"
                            and r["session_id"] == "monitored-session"
                            and r["src_ip"] == "192.0.2.2"
                            and r["session_priority"] == "high" for r in monitored))
        self.assertEqual(len(self.records()), 4)
        self.assertEqual(monitored[1]["classification_error"], "classification_failed")

    def test_monitor_writes_even_if_primary_log_fails(self):
        self.server.COMMAND_LOG_PATH = Path(self.temp.name)
        self.server.classify_command.return_value = {"severity": 4, "confidence": 0.9}
        with self.assertLogs(self.server.logger, level="WARNING"):
            self.server.log_command("s", "192.0.2.1", "ls", "",
                                    self.server.SessionRisk(), "visitor")
        self.assertTrue(self.server.MONITOR_LOG_PATH.is_file())

    def test_two_connections_run_concurrently_with_separate_identity(self):
        servers = [self.server.BaseServer(), self.server.BaseServer()]
        barrier = threading.Barrier(2)
        transports = [MagicMock(), MagicMock()]
        clients = [MagicMock(), MagicMock()]
        seen = []

        def shell(server, username):
            server.username = username
            barrier.wait(timeout=3)
            seen.append((server.session_id, server.src_ip, server.username))

        for i, server in enumerate(servers):
            server.event.set()
            server.handle_shell = lambda channel, s=server, u=f"user{i}": shell(s, u)
        self.server.paramiko.Transport = MagicMock(side_effect=transports)
        with patch.object(self.server, "send_event") as send_event:
            workers = [threading.Thread(target=s.handle_client,
                       args=(clients[i], (f"192.0.2.{i + 1}", 1000 + i)))
                       for i, s in enumerate(servers)]
            for worker in workers:
                worker.start()
            for worker in workers:
                worker.join(timeout=5)
            self.assertTrue(all(not w.is_alive() for w in workers))
        self.assertEqual(len(seen), 2)
        self.assertNotEqual(seen[0][0], seen[1][0])
        self.assertEqual({(ip, user) for _, ip, user in seen},
                         {("192.0.2.1", "user0"), ("192.0.2.2", "user1")})
        self.assertEqual(send_event.call_count, 2)
        for transport, client in zip(transports, clients):
            transport.close.assert_called_once()
            client.close.assert_called_once()

    def test_listener_dispatches_each_connection_to_distinct_worker(self):
        sock = MagicMock()
        clients = [MagicMock(), MagicMock()]
        sock.accept.side_effect = [
            (clients[0], ("192.0.2.1", 1)),
            (clients[1], ("192.0.2.2", 2)), KeyboardInterrupt,
        ]
        with patch.object(self.server.socket, "socket", return_value=sock), \
                patch.object(self.server.threading, "Thread") as worker:
            with self.assertRaises(KeyboardInterrupt):
                self.server.BaseServer().listen()
        self.assertEqual(worker.call_count, 2)
        targets = [call.kwargs["target"].__self__ for call in worker.call_args_list]
        self.assertIsNot(targets[0], targets[1])
        self.assertEqual(worker.return_value.start.call_count, 2)
        sock.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
