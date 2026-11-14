#!/usr/bin/env bash
# 一键安装：把本仓库装进 AI 助手的 skills 目录，并装好依赖
# 用法: bash install.sh [目标skills目录]
set -euo pipefail

SKILLS_DIR="${1:-$HOME/.workbuddy/skills}"
REPO_URL="https://github.com/jeeleonard9-art/chaoxing-quiz-auto.git"
TARGET="$SKILLS_DIR/chaoxing-quiz-auto"

command -v node >/dev/null 2>&1 || { echo "需要 Node.js 18+，请先安装"; exit 1; }
node -e 'process.exit(Number(process.versions.node.split(".")[0]) < 18 ? 1 : 0)' \
  || { echo "Node.js 版本过低，需要 18+"; exit 1; }

mkdir -p "$SKILLS_DIR"

if [ -d "$TARGET/.git" ]; then
  echo "更新已有安装: $TARGET"
  git -C "$TARGET" pull --ff-only
else
  echo "安装到: $TARGET"
  git clone --depth 1 "$REPO_URL" "$TARGET"
fi

cd "$TARGET"
npm install --no-audit --no-fund

echo ""
echo "完成。安装位置: $TARGET"
echo "下一步: 用你的 AI 助手打开作业页面，然后说「帮我把超星作业做完」"
