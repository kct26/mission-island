#!/bin/sh
# Saves your Anthropic API key into .env.local without showing it on screen.
cd "$(dirname "$0")/.." || exit 1
printf 'Paste your Anthropic API key (it stays hidden), then press Enter: '
stty -echo 2>/dev/null
read -r KEY
stty echo 2>/dev/null
echo
KEY=$(printf '%s' "$KEY" | tr -d ' \t\r"')
case "$KEY" in
  sk-ant-*) ;;
  *) echo "That doesn't look like an Anthropic key (it should start with sk-ant-). Nothing was saved."; exit 1 ;;
esac
umask 077
printf 'ANTHROPIC_API_KEY=%s\nAI_MODE=live\n' "$KEY" > .env.local
KEY=
echo "Saved to .env.local. Go back to Claude and say: done"
