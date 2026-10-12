# 贡献指南

欢迎一起把麦当劳菜单玩成实验室。两种参与方式：

## 1. 投稿一个隐藏吃法（不用写代码）

到 [Issues → 🍟 投稿一个隐藏吃法](../../issues/new?template=recipe.yml) 填表即可。通过审核的吃法会加入图鉴、生成配方卡，并署名你的 GitHub ID。

硬性要求：

- 原料必须是麦当劳**在售餐品**（可以用 `node src/lab.mjs menu --store <门店编码>` 查实时菜单）
- 改造动作（拆 / 夹 / 蘸 / 摇）在拿到餐后自己完成，不要求门店做任何特殊处理
- 内容轻松友善：不使用歧视或贬低人群的词（指向阶层、地域、收入、身体、精神状态的说法一律不要；自嘲式网络词如「打工人」可以用，但只自嘲不贴标签），不对比其他品牌，不做功效或「最 / 第一」类绝对化宣称，不宣传不健康饮食方式。提交前跑 `node src/lab.mjs lint` 自检

## 2. 提 PR

```bash
git clone https://github.com/wangwengao/mcd-secret-menu-lab.git
cd mcd-secret-menu-lab
npm test                       # 零依赖，node --test
```

新增吃法：在 `src/recipes.mjs` 的 `RECIPES` 里追加一条，字段说明见文件头部注释。要点：

- `match`：菜单名关键词（按优先级），匹配规则是「先完全相等，再取名称最短的包含项」
- `nutritionMatch`：营养表名关键词（菜单叫「薯条」，营养表叫「中薯条」）
- 跑 `npm test` 确保「样例快照覆盖所有配方的全部原料」通过
- 跑 `node src/lab.mjs demo` 重新生成演示页；配方卡 PNG 由维护者统一生成

代码约定：零第三方依赖、ESM、中文注释、不在仓库里出现任何真实 Token。

## 3. 刷新快照

有 Token 的话可以用自己附近的门店刷新离线样例：

```bash
cp .env.example .env            # 填入 MCD_MCP_TOKEN
node src/lab.mjs stores --city <城市> --keyword <地标>
node scripts/refresh-sample-data.mjs --store <门店编码> --store-name "<门店名>"
```
