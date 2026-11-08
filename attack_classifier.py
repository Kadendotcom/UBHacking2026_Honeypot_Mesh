
from pathlib import Path
import joblib
from functools import lru_cache

MODEL_PATH = (
    Path(__file__).resolve().parent
    / "models"
    / "attack_classifier.joblib"
)

@lru_cache(maxsize=1)
def load_model():
    return joblib.load(MODEL_PATH)


def classify_command(command):
    model = load_model()
    probabilities = model.predict_proba([command])[0]

    best_index = probabilities.argmax()

    return {
        "command": command,
        "severity": int(model.classes_[best_index]),
        "confidence": round(
            float(probabilities[best_index]), 3
        )
    }


if __name__ == "__main__":
    commands = [
        "ls",
        "whoami",
        "uname -a",
        "sudo -l",
        "cat /etc/shadow",
        "history -c"
    ]

    for command in commands:
        print(classify_command(command))
