
import pandas as pd

df = pd.read_csv("data/curated_commands.csv")

for severity in sorted(df["severity_vi"].dropna().unique()):
    subset = df[df["severity_vi"] == severity]

    print(f"\n{'=' * 50}")
    print(f"SEVERITY {severity}")
    print(f"Total examples: {len(subset)}")
    print("=" * 50)

    for command in subset["command"].head(15):
        print(command)

# Check for commands with conflicting severity labels
conflicts = (
    df.groupby("command")["severity_vi"]
    .nunique()
)

conflicting_commands = conflicts[conflicts > 1]

print("\nCommands with conflicting labels:")
print(conflicting_commands)

print(f"\nTotal conflicting commands: {len(conflicting_commands)}")