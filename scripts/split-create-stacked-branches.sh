#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

resolve_conflicts() {
  # Prefer incoming cache/script versions; keep files added by incoming on modify/delete.
  git diff --name-only --diff-filter=U | while read -r f; do
    if [[ "$f" == "app/index.html" || "$f" == "app/sw.js" || "$f" == "package.json" ]]; then
      git checkout --theirs -- "$f" 2>/dev/null || true
    fi
  done
  git diff --name-only --diff-filter=U | while read -r f; do
    if [[ -f "$f" ]]; then
      git add "$f"
    fi
  done
  if git diff --name-only --diff-filter=U | grep -q .; then
    echo "Unresolved conflicts remain:" >&2
    git diff --name-only --diff-filter=U >&2
    return 1
  fi
  return 0
}

cherry_pick_commits() {
  for c in "$@"; do
    if ! git cherry-pick "$c"; then
      resolve_conflicts || { git cherry-pick --abort; return 1; }
      git cherry-pick --continue --no-edit
    fi
  done
}

declare -a BRANCHES=(
  "pr/02-bible-reader|eaf9d0f"
  "pr/03-camera-sources|934be1e"
  "pr/04-hymnal-library|ce2536a 7c8cd71 49b4747"
  "pr/05-live-bible-projection|3977ca3"
  "pr/06-live-queue-and-switch|65898e7 2ab5bd5"
  "pr/07-vachinoda-rebrand|000775a"
  "pr/08-service-and-quiet-mode|ac027c6 8117b1f"
  "pr/09-ux-performance-and-outputs|1f16699 1e7c418 e584b20 feddf9c da01d1b ad24e9c"
  "pr/10-recovery-and-rc1|3c65f4b c4379f6 52f084e"
)

PREV="pr/01-obs-foundations"
for entry in "${BRANCHES[@]}"; do
  BR="${entry%%|*}"
  COMMITS="${entry#*|}"
  echo "=== $BR from $PREV ==="
  git checkout -B "$BR" "$PREV"
  # shellcheck disable=SC2086
  cherry_pick_commits $COMMITS
  git push -u origin "$BR"
  PREV="$BR"
done

git checkout cursor/obs-auth-sda-hymnal-fixes
echo "All stacked branches pushed."
