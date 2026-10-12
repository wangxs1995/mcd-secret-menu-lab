#!/usr/bin/env bash
# 麦门隐藏菜单研究所 · 一键安装（macOS / Linux）
# 把 Skill 复制到 WorkBuddy 与 Claude Code 的技能目录；已存在时先备份。
# 用法：bash install.sh [workbuddy|claude|all]   默认 all
set -euo pipefail

TARGET="${1:-all}"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAME="mcd-secret-menu-lab"
FILES=(SKILL.md package.json mcp-config.example.json .env.example references src)

targets=()
[[ "$TARGET" == "workbuddy" || "$TARGET" == "all" ]] && targets+=("$HOME/.workbuddy/skills/$NAME")
[[ "$TARGET" == "claude"    || "$TARGET" == "all" ]] && targets+=("$HOME/.claude/skills/$NAME")
BACKUP_ROOT="$HOME/.$NAME-backups"

for dest in "${targets[@]}"; do
  if [[ -d "$dest" ]]; then
    mkdir -p "$BACKUP_ROOT"
    backup="$BACKUP_ROOT/$(basename "$(dirname "$(dirname "$dest")")")-$(date +%Y%m%d-%H%M%S)"
    mv "$dest" "$backup"
    echo "已备份旧版本 -> $backup"
  fi
  mkdir -p "$dest"
  for f in "${FILES[@]}"; do
    [[ -e "$SRC/$f" ]] && cp -R "$SRC/$f" "$dest/"
  done
  # 本地 .env（含你的 Token）一并复制，这样 Agent 运行 CLI 时能走联网模式；只在本机，不会进入任何仓库
  if [[ -f "$SRC/.env" ]]; then cp "$SRC/.env" "$dest/"; echo "已复制本地 .env（联网模式可用）"; fi
  echo "✅ 已安装到 $dest"
done

cat <<'EOF'

下一步：
  1. 在客户端里配置麦当劳 MCP 连接器（见 mcp-config/README.md），替换 ${MCD_MCP_TOKEN}
  2. 在技能目录里复制 .env.example 为 .env 并填入 Token（CLI 模式需要）
  3. 对 Agent 说：「给我来一个 30 块以内的麦当劳隐藏吃法」
EOF
