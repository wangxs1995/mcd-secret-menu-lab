# 麦门隐藏菜单研究所 · MCD Secret Menu Lab — 设计文档

> 麦当劳程序员节创意开发大赛参赛项目 · 2026-10-10

## 1. 一句话

用麦当劳真实在售餐品组合出「隐藏吃法」，自动验证可行性、计算营养与价格、生成可晒的配方卡，并一键下单。

## 2. 为什么做这个

- **空白赛道**：主流参赛项目集中在 省钱 / 营养 / 人格测试 三大赛道；「把菜单本身玩起来」的隐藏菜单赛道没有同类作品。
- **传播力原生**：隐藏吃法是全球麦当劳粉丝文化中传播力最强的内容形态（薯条蘸冰淇淋、DIY 组合堡……），小红书上「麦门隐藏吃法」长期有热度，天然产出可分享物料（配方卡）。
- **深度使用 MCP**：菜单 → 套餐详情 → 营养 → 领券 → 算价 → 下单，全链路闭环，不是「查一查」的浅层调用。
- **实用价值**：组合吃法经常比单点更划算、更有趣；对价格敏感的学生党/打工人有真实省钱场景。

## 3. 目标用户

| 用户 | 场景 |
|---|---|
| 麦门信徒 / 爱尝鲜的年轻人 | 想试新吃法但懒得自己研究 |
| 内容创作者 | 需要发小红书/朋友圈的素材（配方卡） |
| 学生党 / 打工人 | 想用组合吃法吃得更好还更省 |
| 仪式感玩家 | 喜欢「暗号点单」的乐趣 |

## 4. 核心功能

- **F1 隐藏菜单图鉴**：内置 10+ 道经典隐藏吃法（全部基于真实在售餐品），含名字、配方、吃法步骤、口味标签、营养与价格估算。
- **F2 AI 实验室**：输入约束（预算 / 热量 / 口味 / 时段 / 心情）→ 实时拉取门店在售菜单 → 生成 3 个新隐藏吃法方案。
- **F3 配方卡**：生成「实验室机密档案」风格的 HTML 配方卡（自包含、可离线打开、可截图晒图）。
- **F4 一键下单**：选定组合 → 自动领券 → 算价 → 创建订单（麦乐送 / 到店自取）。
- **F5 时段彩蛋**：早餐 / 正餐 / 夜宵时段限定吃法（由 `now-time-info` 驱动）。

## 5. 用户旅程

- **J1 探索**：打开 README → 看配方卡样例 → 本地运行 `mcd-lab menu` 查看今日隐藏菜单。
- **J2 定制**：`mcd-lab lab --budget 30 --calorie 600 --vibe 深夜` → 得到 3 个方案 → `mcd-lab order --recipe fries-float` 下单。
- **J3 Agent**：在 WorkBuddy / Claude / Cherry Studio 挂上 SKILL.md + 麦当劳 MCP → 说「给我来个隐藏吃法」→ Agent 自动完成查询、生成、下单。

## 6. 技术架构

- **零运行时依赖**，Node.js ≥ 18（原生 `fetch`），开箱即用。
- `src/mcp-client.mjs`：极简 Streamable HTTP JSON-RPC 客户端（initialize → tools/list → tools/call，含 SSE 解析与错误码处理）。
- `src/lab.mjs`：CLI 入口（`menu` / `lab` / `order` / `card` 子命令）。
- `src/recipes.mjs`：隐藏吃法知识库 + 组合生成规则。
- `src/nutrition.mjs`、`src/pricing.mjs`：营养与价格计算、评分。
- `src/card.mjs`：配方卡 HTML 渲染（自包含 CSS，无外部资源）。
- `src/sample-data/`：脱敏样例数据（菜单 / 营养快照）——无 Token 也能完整演示。
- `SKILL.md`：Agent Skill 入口（frontmatter + 使用说明），供 WorkBuddy / Claude / Cherry Studio 使用。
- 数据流：`CLI / Agent → MCP Client → mcp.mcd.cn → 真实菜单/营养/价格 → 本地计算与渲染 → 配方卡 / 订单`。

## 7. MCP 工具映射

| 功能 | Tool | 用途 |
|---|---|---|
| 找店 | `query-nearby-stores` / `delivery-query-stores` | 确定可售菜单的门店 |
| 菜单 | `query-meals` | 拉取真实在售 SKU |
| 套餐组成 | `query-meal-detail` | 拆解套餐与可替换项，验证组合可行性 |
| 营养 | `list-nutrition-foods` | 热量 / 蛋白质 / 脂肪 / 钠 |
| 算价 | `calculate-price` | 组合总价、配送费、优惠金额 |
| 优惠 | `available-coupons` / `auto-bind-coupons` / `query-my-coupons` / `query-store-coupons` | 先领券再算价 |
| 活动 | `campaign-calendar` | 限定新品联动吃法 |
| 时间 | `now-time-info` | 时段限定吃法 |
| 下单 | `create-order` | 一键下单 |
| 订单 | `query-order` / `cancel-order` | 订单状态与取消 |

## 8. 合规与安全

- Token 仅存本地 `.env`，仓库内一律环境变量占位符；`.gitignore` 屏蔽。
- README / SKILL 显著位置声明「非麦当劳官方产品，输出仅供参考；餐品信息、价格及供应状态以麦当劳官方渠道的实时结果为准」。
- 内容红线自查：不出现违法违规、低俗、对比其他品牌、不健康饮食宣传等表述；所有配方基于门店真实在售餐品。
- 只读优先：查询类工具为主；下单等写操作需用户显式确认。
- 不构成医疗、营养或其他专业建议。

## 9. 交付物（对照赛事要求）

| 文件 | 状态 |
|---|---|
| `README.md`（介绍 / 安装 / 使用示例 / 目标用户） | ✅ |
| `CONTEST_DECLARATION.md`（官方原文，不可改动） | ✅ |
| `MCP_INTEGRATION.md`（Server / Tool / 调用流程 / 联调证据 / 业务价值） | ✅ |
| `mcp-config.example.json`（仅环境变量占位符） | ✅ |
| 源代码（可运行，零依赖） | ✅ |
| `workbuddy.md`（WorkBuddy 专项奖励，非必需） | 待补 |
| 加分项：演示页、12 张配方卡、自测（12 个）、真实快照刷新脚本 | ✅ |

## 9.1 实现状态（2026-10-10）

- 已接入并联调通过的 MCP 工具：`query-nearby-stores`、`query-meals`（含 `reservationDate` 早餐时段）、`list-nutrition-foods`、`now-time-info`、`campaign-calendar`、`calculate-price`、`create-order`（按 schema 接入，默认预演）；联调验证：`query-meal-detail`、`query-store-coupons`
- v1 聚焦到店自取（`orderType=1 / beType=1`）；外送需配送地址与 `beCode`，列入路线图
- 离线样例为真实快照（上海某门店到店菜单 + 次日早餐菜单 + 全量营养表），由 `scripts/refresh-sample-data.mjs` 生成

## 10. 里程碑

1. **M1** 脚手架 + 设计（D0，10-10）
2. **M2** MCP 客户端 + 图鉴 + CLI（D1–D2）
3. **M3** 配方卡 + 样例素材（D3）
4. **M4** 真实联调 + 演示录屏（D3–D4）
5. **M5** 发布 GitHub + Issue 报名（D4）
6. **M6** 推广冲刺（D5–D15）

## 11. 风险与对策

| 风险 | 对策 |
|---|---|
| 隐藏吃法的「改造步骤」无法通过单一订单表达 | 以「多单品组合下单」为主，改造步骤（拆、夹、蘸）交给用户；订单备注辅助 |
| 菜单与价格存在门店/时段差异 | 运行时实时拉取为准；样例数据仅用于离线演示 |
| 内容合规红线 | 提交前对照活动规则逐条自查（不刷星、不对比品牌、不宣传不健康饮食） |
| 依赖真实 Token 的联调不可用 | 全流程支持 `--offline` 样例数据模式，演示与测试不依赖 Token |
