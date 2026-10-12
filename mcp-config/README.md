# 多客户端 MCP 配置

所有配置都只用环境变量占位符 `${MCD_MCP_TOKEN}`，使用前请替换为你在 https://open.mcd.cn/mcp 申请的 Token（或在客户端里引用环境变量）。**不要把真实 Token 提交到任何仓库。**

| 客户端 | 文件 | 放到哪里 |
|---|---|---|
| WorkBuddy / Cherry Studio / Trae / Kiro | [`workbuddy-cherry-studio.json`](./workbuddy-cherry-studio.json) | 客户端的「自定义连接器 → 配置 MCP / 从 JSON 导入」 |
| Cursor | [`cursor.json`](./cursor.json) | `~/.cursor/mcp.json` 或项目内 `.cursor/mcp.json` |
| Claude Code | [`claude-code.mcp.json`](./claude-code.mcp.json) | 项目根目录 `.mcp.json`；或执行 `claude mcp add --transport http mcd-mcp https://mcp.mcd.cn --header "Authorization: Bearer <TOKEN>"` |
| VS Code（Copilot MCP） | [`vscode.mcp.json`](./vscode.mcp.json) | 项目内 `.vscode/mcp.json` |

配置好连接器后，把本仓库的 `SKILL.md`（以及 `references/`、`src/`）作为 Skill 导入：

- 一键安装：`.\install.ps1`（Windows）或 `bash install.sh`（macOS / Linux）
- 手动：复制到 WorkBuddy 的 `~/.workbuddy/skills/mcd-secret-menu-lab/` 或 Claude Code 的 `~/.claude/skills/mcd-secret-menu-lab/`

服务端接入细节以 [麦当劳 MCP 官方指南](https://github.com/M-China/mcd-mcp-server) 为准。
