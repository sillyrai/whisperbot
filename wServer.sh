#!/usr/bin/env bash
set -e

# —————————————————————————————
# Configurable
# —————————————————————————————

# model file relative to this script
MODEL_PATH="./whisper.cpp/models/ggml-large-v3.bin"
#MODEL_PATH="./whisper.cpp/models/ggml-large-v3.bin"

# host & port you want the server on
HOST="0.0.0.0"
PORT="7777"

# where the server binary lives — adjust if your build dir differs
SERVER_BIN="./whisper.cpp/build/bin/whisper-server"

# extra flags you want
#EXTRA_ARGS="--convert --language auto --vad-threshold 0.3 --no-speech-thold 0.9"
EXTRA_ARGS="--convert --language auto"
# —————————————————————————————
# sanity checks
# —————————————————————————————

if [[ ! -f "$MODEL_PATH" ]]; then
  echo "❌ Model not found at $MODEL_PATH"
  exit 1
fi

if [[ ! -x "$SERVER_BIN" ]]; then
  echo "❌ Server binary not found or not executable: $SERVER_BIN"
  echo "   try building with cmake and make first or adjust path"
  exit 1
fi

# —————————————————————————————
# launch
# —————————————————————————————

echo "🚀 Starting whisper-server on $HOST:$PORT"
echo "   model: $MODEL_PATH"

"$SERVER_BIN" \
  --host "$HOST" \
  --port "$PORT" \
  --model "$MODEL_PATH" \
  $EXTRA_ARGS
