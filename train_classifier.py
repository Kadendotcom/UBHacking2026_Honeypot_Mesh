
from pathlib import Path

import joblib
import pandas as pd

from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix

DATA_PATH = Path("data/curated_commands.csv")
MODEL_PATH = Path("models/attack_classifier.joblib")

# 1. Load dataset
df = pd.read_csv(DATA_PATH)

print("Dataset columns:", df.columns.tolist())
print("Total records:", len(df))

# 2. Clean data
required = ["command", "severity_vi", "session_id"]

missing = [col for col in required if col not in df.columns]
if missing:
    raise ValueError(f"Missing columns: {missing}")

df = df.dropna(subset=required).copy()
df["command"] = df["command"].astype(str)
df["severity_vi"] = df["severity_vi"].astype(int)

print("\nSeverity distribution:")
print(df["severity_vi"].value_counts().sort_index())

# 3. Split by session to reduce data leakage
splitter = GroupShuffleSplit(
    n_splits=1,
    test_size=0.2,
    random_state=42
)

train_idx, test_idx = next(
    splitter.split(df, groups=df["session_id"])
)

train = df.iloc[train_idx]
test = df.iloc[test_idx]

# 4. Create ML pipeline
model = Pipeline([
    ("tfidf", TfidfVectorizer(
        analyzer="char",
        ngram_range=(2, 5),
        max_features=30000,
        sublinear_tf=True
    )),
    ("classifier", LogisticRegression(
        max_iter=1500,
        class_weight="balanced"
    ))
])

# 5. Train
print("\nTraining classifier...")

model.fit(
    train["command"],
    train["severity_vi"]
)

# 6. Evaluate
predictions = model.predict(test["command"])

print("\nClassification Report:")
print(classification_report(
    test["severity_vi"],
    predictions,
    labels=[0, 1, 2, 3, 4],
    zero_division=0
))

print("\nConfusion Matrix:")
print(confusion_matrix(
    test["severity_vi"],
    predictions,
    labels=[0, 1, 2, 3, 4]
))

# 7. Save model
MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
joblib.dump(model, MODEL_PATH)

print(f"\nModel saved to: {MODEL_PATH}")
