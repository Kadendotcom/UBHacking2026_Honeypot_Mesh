
import posixpath
import shlex
import json
import re

class FakeSession:
    def __init__(self):
        self.cwd = "/root"
        self.home = "/root"
        self.username = "root"
        self.hostname = "ubuntu"

        # Simulated directories and files
        self.directories = {
            "/",
            "/root",
            "/root/documents",
            "/root/downloads",
            "/etc",
            "/tmp",
            "/var",
            "/var/log",
        }

        self.files = {
            "/root/secrets.txt": "FAKE_PASSWORD=example123\n",
            "/etc/hostname": "ubuntu\n",
            "/etc/os-release": (
                'PRETTY_NAME="Ubuntu 22.04.3 LTS"\n'
                'NAME="Ubuntu"\n'
                'VERSION_ID="22.04"\n'
                'ID=ubuntu\n'
            ),
        }

        self.history = []

    def write_file(self, path, content, append=False):
        target = self.resolve_path(path)
        parent = posixpath.dirname(target)

        if parent not in self.directories:
            return f"bash: {path}: No such file or directory"

        if target in self.directories:
            return f"bash: {path}: Is a directory"

        if append:
            self.files[target] = self.files.get(target, "") + content
        else:
            self.files[target] = content

        return ""

    def remove_path(self, path, recursive=False):
        target = self.resolve_path(path)

        if target in ("/", "/root"):
            return f"rm: cannot remove '{path}': Permission denied"

        if target in self.files:
            del self.files[target]
            return ""

        if target not in self.directories:
            return f"rm: cannot remove '{path}': No such file or directory"

        if not recursive:
            return f"rm: cannot remove '{path}': Is a directory"

        prefix = target + "/"

        self.files = {
            p: content for p, content in self.files.items()
            if p != target and not p.startswith(prefix)
        }

        self.directories = {
            p for p in self.directories
            if p != target and not p.startswith(prefix)
        }

        return ""

    def copy_file(self, source, destination):
        src = self.resolve_path(source)
        dst = self.resolve_path(destination)

        if src not in self.files:
            return f"cp: cannot stat '{source}': No such file or directory"

        if dst in self.directories:
            dst = posixpath.join(dst, posixpath.basename(src))

        if posixpath.dirname(dst) not in self.directories:
            return f"cp: cannot create regular file '{destination}': No such file or directory"

        self.files[dst] = self.files[src]
        return ""

    def move_file(self, source, destination):
        src = self.resolve_path(source)
        dst = self.resolve_path(destination)

        if src not in self.files:
            return f"mv: cannot stat '{source}': No such file or directory"

        if dst in self.directories:
            dst = posixpath.join(dst, posixpath.basename(src))

        if posixpath.dirname(dst) not in self.directories:
            return f"mv: cannot move '{source}': No such file or directory"

        self.files[dst] = self.files.pop(src)
        return ""

    def snapshot(self):
        """Provide limited fake-session context to the MLX model."""
        visible_files = sorted(self.files.keys())[:30]
        visible_dirs = sorted(self.directories)[:30]

        return json.dumps({
            "hostname": self.hostname,
            "username": self.username,
            "cwd": self.cwd,
            "files": visible_files,
            "directories": visible_dirs,
            "recent_commands": self.history[-8:]
        })

    def resolve_path(self, path):
        """Resolve a simulated Linux path."""
        if path == "~":
            return self.home

        if path.startswith("~/"):
            path = self.home + path[1:]

        if not path.startswith("/"):
            path = posixpath.join(self.cwd, path)

        return posixpath.normpath(path)

    def prompt(self):
        """Return a shell prompt reflecting the current directory."""
        if self.cwd == self.home:
            location = "~"
        elif self.cwd.startswith(self.home + "/"):
            location = "~" + self.cwd[len(self.home):]
        else:
            location = self.cwd

        return f"{self.username}@{self.hostname}:{location}# "

    def execute(self, command):
        """
        Return (handled, output).

        handled=False means the MLX fallback can respond.
        """
        self.history.append(command)

        try:
            args = shlex.split(command)
        except ValueError as exc:
            return True, f"bash: {exc}"

        if not args:
            return True, ""

        cmd = args[0]

        if cmd == "pwd":
            return True, self.cwd

        if cmd == "whoami":
            return True, self.username

        if cmd == "hostname":
            return True, self.hostname

        if cmd == "cd":
            target = self.resolve_path(
                args[1] if len(args) > 1 else "~"
            )

            if target in self.files:
                return True, f"bash: cd: {args[1]}: Not a directory"

            if target not in self.directories:
                return True, (
                    f"bash: cd: {args[1] if len(args) > 1 else '~'}: "
                    "No such file or directory"
                )

            self.cwd = target
            return True, ""

        if cmd == "mkdir":
            if len(args) < 2:
                return True, "mkdir: missing operand"

            # Support mkdir -p
            recursive = "-p" in args[1:]
            paths = [a for a in args[1:] if a != "-p"]

            if not paths:
                return True, "mkdir: missing operand"

            errors = []

            for path in paths:
                target = self.resolve_path(path)

                if target in self.files:
                    errors.append(
                        f"mkdir: cannot create directory '{path}': File exists"
                    )
                    continue

                if target in self.directories:
                    if not recursive:
                        errors.append(
                            f"mkdir: cannot create directory '{path}': File exists"
                        )
                    continue

                parent = posixpath.dirname(target)

                if recursive:
                    current = target
                    missing = []

                    while current not in self.directories:
                        if current in self.files:
                            break
                        missing.append(current)
                        current = posixpath.dirname(current)

                    if current in self.files:
                        errors.append(
                            f"mkdir: cannot create directory '{path}': "
                            "Not a directory"
                        )
                        continue

                    self.directories.update(missing)

                elif parent not in self.directories:
                    errors.append(
                        f"mkdir: cannot create directory '{path}': "
                        "No such file or directory"
                    )
                else:
                    self.directories.add(target)

            return True, "\n".join(errors)

        if cmd == "touch":
            if len(args) < 2:
                return True, "touch: missing file operand"

            errors = []

            for path in args[1:]:
                target = self.resolve_path(path)
                parent = posixpath.dirname(target)

                if parent not in self.directories:
                    errors.append(
                        f"touch: cannot touch '{path}': "
                        "No such file or directory"
                    )
                elif target not in self.directories:
                    self.files.setdefault(target, "")

            return True, "\n".join(errors)

        if cmd == "ls":
            # Minimal support for common display flags
            paths = [a for a in args[1:] if not a.startswith("-")]
            path = paths[0] if paths else "."
            target = self.resolve_path(path)

            if target in self.files:
                return True, posixpath.basename(target)

            if target not in self.directories:
                return True, (
                    f"ls: cannot access '{path}': "
                    "No such file or directory"
                )

            entries = []

            for directory in self.directories:
                if directory != target and posixpath.dirname(directory) == target:
                    entries.append(posixpath.basename(directory))

            for file_path in self.files:
                if posixpath.dirname(file_path) == target:
                    entries.append(posixpath.basename(file_path))

            return True, "  ".join(sorted(entries))

        if cmd == "cat":
            if len(args) < 2:
                return True, "cat: missing file operand"

            outputs = []

            for path in args[1:]:
                target = self.resolve_path(path)

                if target in self.files:
                    outputs.append(self.files[target].rstrip("\n"))
                elif target in self.directories:
                    outputs.append(f"cat: {path}: Is a directory")
                else:
                    outputs.append(
                        f"cat: {path}: No such file or directory"
                    )

            return True, "\n".join(outputs)

        if cmd == "history":
            return True, "\n".join(
                f"{i:5}  {entry}"
                for i, entry in enumerate(self.history, start=1)
            )

        # echo and output redirection
        if cmd == "echo":
            # Simple redirection: echo hello > file.txt
            match = re.match(r"^echo\s+(.*?)\s*(>>|>)\s*(\S+)\s*$", command)

            if match:
                content, operator, filename = match.groups()

                try:
                    words = shlex.split(content)
                    content = " ".join(words)
                except ValueError:
                    return True, "bash: unmatched quote"

                return True, self.write_file(
                    filename,
                    content + "\n",
                    append=(operator == ">>")
                )

            # Normal echo
            return True, " ".join(args[1:])

        # rm file.txt / rm -rf directory
        if cmd == "rm":
            recursive = any(
                arg.startswith("-") and "r" in arg
                for arg in args[1:]
            )

            paths = [
                arg for arg in args[1:]
                if not arg.startswith("-")
            ]

            if not paths:
                return True, "rm: missing operand"

            errors = []

            for path in paths:
                result = self.remove_path(path, recursive)
                if result:
                    errors.append(result)

            return True, "\n".join(errors)

        # cp source destination
        if cmd == "cp":
            if len(args) != 3:
                return True, "cp: expected source and destination"

            return True, self.copy_file(args[1], args[2])

        # mv source destination
        if cmd == "mv":
            if len(args) != 3:
                return True, "mv: expected source and destination"

            return True, self.move_file(args[1], args[2])

        # Not handled by the simulated filesystem
        return False, ""
