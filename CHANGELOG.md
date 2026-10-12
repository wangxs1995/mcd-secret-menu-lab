# 更新日志

## [0.2.0] - 2026-10-12

- 演示页升级为零安装交互体验：场景 / 难度筛选、搜原料、🎲 随机来一道、一键复制文字版、下载配方卡 PNG
- 新增隐藏吃法投稿 Issue 模板、贡献指南、社区投稿墙
- 新增多客户端 MCP 配置模板（`mcp-config/`）、一键安装脚本（`install.ps1` / `install.sh`）、Skill ZIP 打包（`dist/`）
- 新增英文 README、分享素材包（`docs/share/`）、社交预览图
- README 增加差异对照表、FAQ、搜索关键词
- 配方卡文案与数据来源标注优化；快照时间改为北京时间

## [0.1.1] - 2026-10-10

- 接入真实麦当劳 MCP：门店查询、实时菜单（含 `reservationDate` 早餐时段）、营养表、服务器时间、活动日历、实时算价、下单流程（默认预演）
- 新增 `src/mcp-parse.mjs`：「说明文字 + JSON」抽取、紧凑文本表格、菜单归一化、活动日历解析
- 离线样例改为真实快照（183 个餐品 + 158 项营养），`scripts/refresh-sample-data.mjs` 一键刷新
- 配方对齐真实餐品名（菜单名 / 营养名分离、支持数量）
- README / MCP_INTEGRATION（含 traceId 联调证据）/ SKILL / references/recipes

## [0.1.0] - 2026-10-10

- 首发：12 道隐藏吃法知识库、零依赖 MCP Streamable HTTP 客户端、CLI 9 个命令
- 「机密档案」风格配方卡（HTML / PNG / 文本）与演示页
- 自测脚本、参赛声明、MCP 配置模板
