#!/bin/bash
set -euo pipefail

# Only needed in Claude Code cloud sessions - local sessions set this up once by hand.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# GARMIN_PERSONAL_API_KEY must be configured as an environment variable in this
# repo's Claude Code on the web environment settings (never commit the key itself).
# Without it, there's nothing to register, so skip quietly.
if [ -z "${GARMIN_PERSONAL_API_KEY:-}" ]; then
  exit 0
fi

# claude mcp add fails if the name already exists, so clear it first to stay idempotent.
claude mcp remove garmin >/dev/null 2>&1 || true
claude mcp add garmin -e GARMIN_PERSONAL_API_KEY="$GARMIN_PERSONAL_API_KEY" -- npx -y @trainingloadai/garmin-personal-api-mcp >&2
