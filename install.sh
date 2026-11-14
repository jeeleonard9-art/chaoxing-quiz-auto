#!/usr/bin/env bash
# 一键安装：把本仓库装进 AI 助手的 skills 目录，并装好依赖
# 用法: bash install.sh [目标skills目录]
#
# 有 git 就 clone；没有 git 就自动下载 GitHub zip 包解压
# （zip 里顶层目录名是 chaoxing-quiz-auto-*，会重命名为目标目录名）。
set -euo pipefail

SKILLS_DIR="${1:-$HOME/.workbuddy/skills}"
REPO_URL="https://github.com/jeeleonard9-art/chaoxing-quiz-auto.git"
REPO_ZIP="https://github.com/jeeleonard9-art/chaoxing-quiz-auto/archive/refs/heads/main.zip"
TARGET="$SKILLS_DIR/chaoxing-quiz-auto"

command -v node >/dev/null 2>&1 || { echo "需要 Node.js 20+，请先安装"; exit 1; }
node -e 'process.exit(Number(process.versions.node.split(".")[0]) < 20 ? 1 : 0)' \
  || { echo "Node.js 版本过低：playwright-core 1.6x 要求 Node 20+"; exit 1; }

mkdir -p "$SKILLS_DIR"

if [ -d "$TARGET/.git" ]; then
  echo "更新已有安装: $TARGET"
  git -C "$TARGET" pull --ff-only
elif [ -d "$TARGET" ] && [ -f "$TARGET/SKILL.md" ]; then
  echo "目标目录已存在且是已解压的技能包: $TARGET"
  echo "如需更新请先删除该目录后重跑本脚本"
else
  if command -v git >/dev/null 2>&1; then
    echo "安装到: $TARGET"
    git clone --depth 1 "$REPO_URL" "$TARGET"
  else
    echo "未检测到 git，改用 zip 包安装"
    TMP="$(mktemp -d)"
    trap 'rm -rf "$TMP"' EXIT
    if command -v curl >/dev/null 2>&1; then
      curl -fL --retry 3 -o "$TMP/repo.zip" "$REPO_ZIP"
    else
      wget -q -O "$TMP/repo.zip" "$REPO_ZIP"
    fi
    unzip -q "$TMP/repo.zip" -d "$TMP"
    SRC="$(find "$TMP" -maxdepth 1 -type d -name 'chaoxing-quiz-auto*' | head -1)"
    [ -n "$SRC" ] || { echo "解压失败，zip 结构异常"; exit 1; }
    mv "$SRC" "$TARGET"
    echo "安装到: $TARGET"
  fi
fi

cd "$TARGET"
npm install --no-audit --no-fund

echo ""
echo "完成。安装位置: $TARGET"
echo "下一步: 用你的 AI 助手打开作业页面，然后说「帮我把超星作业做完」"
