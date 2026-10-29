#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# BazionWeb — Vercel Ignored Build Step
# Exit 0 = Cancel / Skip build (spares deployment quota & build minutes)
# Exit 1 = Proceed with build
# ─────────────────────────────────────────────────────────────────────────────

# 1. Skip if commit message explicitly requests skip
COMMIT_MSG=$(git log -1 --pretty=%B 2>/dev/null)
if echo "$COMMIT_MSG" | grep -qiE '\[(skip deploy|skip ci|skip vercel)\]'; then
  echo "🛑 [skip deploy] found in commit message. Skipping Vercel build."
  exit 0
fi

# 2. Skip if only docs, markdown, or non-web config files changed
# Check if apps/web or core shared dependencies changed
if git diff --quiet HEAD^ HEAD -- apps/web package.json package-lock.json vercel.json 2>/dev/null; then
  echo "🛑 No changes detected in apps/web or core configs. Skipping Vercel build."
  exit 0
fi

echo "✅ Relevant changes detected in apps/web. Proceeding with Vercel build."
exit 1

