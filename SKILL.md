---
name: mcd-secret-menu-lab
description: 麦门隐藏菜单研究所 —— 用麦当劳真实在售餐品组合「隐藏吃法」的 Agent Skill。当用户想尝试麦当劳隐藏吃法 / DIY 组合 / 暗号点单，问「怎么点更香、更有趣、更划算」，想按预算或热量选一份麦当劳，或想生成可分享的配方卡时使用。基于麦当劳官方 MCP（mcp.mcd.cn），支持真实菜单校验、营养与价格计算、一键下单。
---

# 麦门隐藏菜单研究所（MCD Secret Menu Lab）

把麦当劳菜单玩成一个实验室：用**真实在售餐品**组合出「隐藏吃法」，算好营养和价格，生成可晒的配方卡，并一键下单。

## 何时使用本 Skill

- 用户想尝试「隐藏吃法 / 隐藏菜单 / DIY 组合 / 暗号点单」
- 用户问「怎么点更香 / 更有趣 / 更划算」，希望拿到具体方案
- 用户想按 预算 / 热量 / 场景（早餐 / 正餐 / 下午茶 / 夜宵）选一份麦当劳
- 用户想要一张可分享的「配方卡」

## 前置条件

1. 已配置麦当劳 MCP Server（配置模板见 `mcp-config.example.json`；Token 申请：https://open.mcd.cn/mcp ）
2. 本仓库可用：零依赖，Node.js >= 18；无 Token 时自动降级为内置真实快照（仅演示）

## 两种使用模式

### 模式 A（推荐）：配合本仓库 CLI —— 数据与计算交给确定性代码

```bash
node src/lab.mjs stores --city 上海市 --keyword 人民广场      # 找门店，拿 storeCode
node src/lab.mjs menu  --store <storeCode>                   # 实时菜单 + 今天能做的隐藏吃法
node src/lab.mjs lab   --store <storeCode> --budget 30       # 按约束出 3 个方案（自动联动时段与活动日历）
node src/lab.mjs card  --recipe fries-float --png            # 生成配方卡（HTML + 自动截图 PNG）
node src/lab.mjs card  --spec '{"name":"…","ingredients":["脆薯饼","圆筒冰淇淋"],"steps":["…"]}' --png   # 为自创吃法出卡
node src/lab.mjs price --recipe fries-float --store <storeCode>        # MCP 实时算价（含优惠）
node src/lab.mjs order --recipe fries-float --store <storeCode>        # 预演下单（dry-run）
node src/lab.mjs order --recipe fries-float --store <storeCode> --yes  # 真实下单（需用户明确同意）
```

所有命令支持 `--json`（便于解析）与 `--offline`（强制快照）。推荐流程：`stores → lab → card/price → order`。

### 模式 B：直接编排 MCP 工具（不依赖 CLI）

本项目 v1 聚焦**到店自取**：`orderType=1`、`beType=1`，不传 `beCode`。

1. `query-nearby-stores`（`beType=1, searchType=2, city, keyword`，两者都要传）→ `storeCode`
2. `query-meals`（`storeCode, orderType=1, beType=1`）→ 真实在售菜单；返回为「说明文字 + JSON」，餐品在 `data.meals[code]`，分类在 `data.categories[]`
3. 从菜单里挑餐品组合出吃法（机制与配方参考 `references/recipes.md`：蘸 / 夹 / 倒 / 摇 / 冰火 / 组合）
4. `query-meal-detail`（`storeCode, orderType, beType, code`）校验套餐组成与特调项
5. `list-nutrition-foods` → `data` 是紧凑文本表格（`[N]{列名}:\n 行…`），按名称累加热量
6. `calculate-price`（`items=[{productCode, quantity}]`）→ 金额单位为**分**；记录返回的 `takeWayList[].code`
7. 用户明确确认后 `create-order`（同上参数 + `takeWayCode` + `needTableware`）

## 硬性规则（必须遵守）

1. **绝不臆造餐品**：所有原料必须来自 `query-meals` 的实时返回；菜单里没有的餐品不得出现在方案里；早餐单品只在早餐时段有
2. **下单必须显式确认**：只有用户明确表达「下单」才可调用 `create-order`；下单后提醒用户在麦当劳官方渠道完成支付
3. **营养数值必须按营养表累加**：用 `list-nutrition-foods` 的数据逐项相加（菜单叫「薯条」营养表叫「中薯条」，按最接近的规格取），不要凭感觉给一个数；展示时标注「估算，仅供参考」，不构成营养或医疗建议
4. **价格以 MCP `calculate-price` 为准**：不要用语言模型心算价格
5. **改造动作（拆 / 夹 / 蘸 / 摇）由用户到手完成**，不要求门店做任何特殊处理
6. **措辞红线**：不使用任何歧视或贬低人群的说法——指向阶层、地域、收入、身体、精神状态的标签一律不要（例如把便宜吃法叫成「贫民窟 ×××」就不行）；可以用轻松的自嘲式网络词（打工人、牛马、学生党），但只用于自嘲，不给别人贴标签
7. 不与其他品牌对比；不做医疗功效宣称；不用「最 / 第一 / 之王」类绝对化用语；不宣传不健康饮食或浪费；输出保持轻松、友善
8. **生成文案后自检**：模式 A 下运行 `node src/lab.mjs lint --text "<文案>"`，有命中就改掉再交给用户；模式 B 下对照以上两条逐句自查

## 输出规范（聊天里就要「看得见卡片」）

配方卡是 CLI 生成的 HTML / PNG 文件，聊天窗口不会自动显示文件，所以**每个方案都必须在回复里用下面的 Markdown 卡片格式呈现**，再附文件或链接。**不要用 `━━━` 这类长横线做分隔**（聊天窗口是比例字体，会折成两段），多个方案之间只放一行 `---`。

```markdown
### 🍟❄️ 冰雪薯条 —— 咸与甜的第一次握手
`新手友好` · 机制：蘸 · 场景：下午茶 / 夜宵 · 热度 ★★★★★

**原料**（MCP 实时算价）
- 薯条　¥13.5
- 圆筒冰淇淋　¥5.0
- **合计 ¥18.5**

**改造步骤**（到手自己动手，不用麻烦店员）
1. 点一份现炸薯条和一个圆筒冰淇淋
2. 捏住薯条根部，旋转蘸取冰淇淋
3. 趁冰淇淋没化，三秒内入口

**营养**：382 千卡 · 蛋白质 6g · 脂肪 15g · 钠 201mg（按营养表累加，估算，仅供参考）
**老饕提示**：薯条要现炸的，冰淇淋用圆筒比新地更好蘸。
🃏 **配方卡**：https://wangwengao.github.io/mcd-secret-menu-lab/cards/fries-float.html
```

「配方卡」这一行按情况填：

- 方案是图鉴里的 12 道之一：在线卡片 `https://wangwengao.github.io/mcd-secret-menu-lab/cards/<id>.html`（图片直链 `https://raw.githubusercontent.com/wangwengao/mcd-secret-menu-lab/main/assets/cards/<id>.png`）
- 自创吃法（模式 A）：运行 `node src/lab.mjs card --spec '{"name":"薯饼冰淇淋三明治","emoji":"🍦","tagline":"…","ingredients":["脆薯饼","圆筒冰淇淋"],"steps":["…","…","…"],"vibes":["早餐"]}' --png`，把生成的 HTML / PNG 路径写在这一行
- 自创吃法（模式 B，无法运行命令）：写「用仓库的 `card --spec` 命令可生成图片版」

模式 A 下可直接 `node src/lab.mjs card --recipe <id> --format md` 得到上述格式原样粘贴。

## 示例对话

> **用户**：晚上加班想吃点不一样的，30 块以内。
> **助手**：（`lab --store … --budget 30 --vibe 夜宵`）给出 3 个方案，说明原料、步骤、价格与热量，并询问要生成配方卡还是直接下单。

> **用户**：就第一个，帮我点了吧。
> **助手**：（先 `order` 预演并展示 MCP 实时算价清单与取餐方式）经用户确认后加 `--yes` 真实下单，并把支付链接交给用户。

## 免责声明

本项目为粉丝开源作品，非麦当劳官方产品。餐品信息、价格与供应状态以麦当劳官方渠道的实时结果为准。
