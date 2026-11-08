from fake_session import FakeSession

session = FakeSession()

commands = [
    "pwd",
    "mkdir test",
    "cd test",
    "pwd",
    "touch hello.txt",
    "ls",
    "cat hello.txt",
    "cd ..",
    "ls",
    "history",
]

for command in commands:
    handled, output = session.execute(command)
    print(f"{session.prompt()}{command}")
    if output:
        print(output)