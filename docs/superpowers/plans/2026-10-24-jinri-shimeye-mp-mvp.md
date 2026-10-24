# 今日食咩野 小程序 MVP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付「今日食咩野」单用户闭环 MVP——菜品管理（AI 识别预填）、今日菜单（随机/大转盘）、买菜清单、按天历史。

**Architecture:** 原生微信小程序 + 微信云开发（wx.cloud）：NoSQL 直连 CRUD + 云存储图片 + 唯一云函数 `recognizeDish` 做 AI 识别。推荐/聚合/解析逻辑全部抽为 `utils/` 纯函数（CommonJS，Jest 可测）。

**Tech Stack:** 原生小程序（基础库 ≥3.7.1）、wx.cloud、@cloudbase/node-sdk（云函数 AI）、Jest。

**Spec:** `docs/superpowers/specs/2026-10-24-jinri-shimeye-mp-mvp-design.md`

## Global Constraints

- 基础库版本下限 3.7.1（`wx.cloud.extend.AI` / AI 依赖）；`project.config.json` 的 `libVersion` 设 `"3.7.1"`
- `project.config.json`：`miniprogramRoot: "miniprogram/"`，`cloudfunctionRoot: "cloudfunctions/"`，`compileType: "miniprogram"`，appid 由用户提供
- 环境ID 只写在 `miniprogram/config.js` 的 `ENV_ID`，`app.js` 引用，不散落硬编码
- 数据库三集合 `dishes` / `menus` / `users` 权限一律「仅创建者可读写」
- tabBar 为纯文字自定义 tabBar（`custom: true`，无图标）：今日菜单 / 菜品库 / 我的
- 界面文案全部中文；不出现任何登录页/登录流程（天然免登录）
- 头像昵称用官方「头像昵称填写能力」，禁用 `wx.getUserProfile`
- `utils/` 与云函数内纯逻辑用 CommonJS（`module.exports`），保证 Jest 可 require
- AI 永远是增强不是阻塞：识别失败/限流 → toast + 手填表单照常可用
- 每个 Task 结束即 commit；所有纯函数 Task 严格 TDD（先写失败测试）

## Review Focus

1. **时区错位**：菜单按天分组若用 UTC 日期，晚间创建的菜单会掉进"昨天"——`utils/date.js` 的 `formatDateKey` 必须用本地时区，测试钉在 Task 3。
2. **同名材料不合并 / 无材料菜导致清单崩**：买菜清单聚合必须合并同名、跳过 `ingredients` 为空的菜——测试钉在 Task 3。
3. **空池卡死**：类型池为空/不足时必须跳过并上报 `skippedTypes`，不得死循环或抛错——测试钉在 Task 2。
4. **AI 返回污染表单**：模型回 markdown 围栏、编造枚举值时，解析层必须剥围栏、丢非法字段——测试钉在 Task 4。
5. **菜品删除后历史损坏**：菜单 items 必须是快照（含 name/photo/type/calories），删菜后历史仍完整——结构由 Task 3 的 `buildMenuDoc` 保证，走查钉在 Task 11。

---

### Task 1: 项目骨架 + Jest 初始化

**Files:**
- Create: `project.config.json`、`package.json`（根目录，jest 配置）、`miniprogram/app.js`、`miniprogram/app.json`、`miniprogram/app.wxss`、`miniprogram/config.js`、`miniprogram/custom-tab-bar/index.{js,json,wxml,wxss}`、`miniprogram/utils/constants.js`、7 个页面四件套（`pages/menu/{menu,create,detail}`、`pages/dishes/{dishes,edit,detail}`、`pages/profile/profile`，每页 `.js/.wxml/.wxss/.json`，先放占位内容并在 `.json` 配页面标题）、`tests/smoke.test.js`

**Interfaces:**
- Produces: `utils/constants.js` 导出 `SOURCE`（`{HOME:'home',DINEOUT:'dineout',TAKEOUT:'takeout'}`）、`SOURCE_LABELS`、`TYPE`（`{MEAT:'meat',VEG:'veg',STAPLE:'staple',SOUP:'soup',DRINK:'drink'}`）、`TYPE_LABELS`、`TYPE_ORDER=['meat','veg','staple','soup','drink']`（大转盘逐类顺序）、`DEFAULT_TAGS=['清淡健康','低脂轻食','香辣馋嘴']`、`AI_DAILY_LIMIT=20`
- Produces: `config.js` 导出 `{ ENV_ID: '' }`（Task 5 填入）
- Produces: 页面路径常量（`app.json` 的 pages/tabBar 注册，后续 Task 直接用）

- [ ] **Step 1: 向用户要 appid**，填入 `project.config.json`；`app.js` 引入 `config.js` 调 `wx.cloud.init({ env: ENV_ID, traceUser: true })`（ENV_ID 为空时 init 跳过并 console.warn，保证 Task 1 阶段可编译）
- [ ] **Step 2: 写 `tests/smoke.test.js`**：断言 `constants.TYPE.MEAT === 'meat'`、`TYPE_ORDER` 长度 5、`AI_DAILY_LIMIT === 20`
- [ ] **Step 3: Run `npx jest -v`** — Expected: PASS（1 suite）
- [ ] **Step 4: 微信开发者工具导入项目根目录，编译通过**；模拟器显示 3 个纯文字 tab，点击可切换到 7 个占位页面（若 Nightly `wechatide` CLI 可用则用 CLI 编译验证）
- [ ] **Step 5: Commit** `feat: 小程序项目骨架与 Jest 初始化`

### Task 2: 推荐算法 `utils/menuGenerator.js`（TDD）

**Files:**
- Create: `miniprogram/utils/menuGenerator.js`
- Test: `tests/menuGenerator.test.js`

**Interfaces:**
- Consumes: `constants.TYPE`、`TYPE_ORDER`
- Produces（后续页面直接调用）:
  - `generateMenu(dishes, { composition, avoid = [], recentDishIds = [], rng = Math.random }) -> { picks: Dish[], skippedTypes: string[] }` — `composition` 形如 `{meat:1, veg:1, staple:1, soup:0, drink:0}`；`avoid` 是标签名数组，可含特殊项 `'辣'`（排除 `spicy_level > 0`）
  - `pickForWheel(dishes, type, { avoid = [], excludeIds = [], rng = Math.random }) -> Dish | null` — 大转盘单类抽取
  - 内部导出 `filterPool(dishes, { type, avoid, excludeIds }) -> Dish[]`（供测试与转盘复用）

- [ ] **Step 1: 写失败测试**（rng 注入固定序列保证确定性），至少覆盖：①按 composition 各类取够数量；②某类型池空 → 该类型进 `skippedTypes`、其余正常返回；③`recentDishIds` 优先排除、剩余不足时放宽回全池仍能取够；④`avoid:['辣']` 排除辣菜；⑤`avoid:['清淡健康']` 排除含该标签的菜；⑥`pickForWheel` 空池返回 `null`、`excludeIds` 生效
- [ ] **Step 2: Run `npx jest tests/menuGenerator.test.js -v`** — Expected: FAIL（模块不存在）
- [ ] **Step 3: 实现**：`filterPool` 按 type + avoid + excludeIds 过滤；`generateMenu` 对 `TYPE_ORDER` 中数量 >0 的类型：先 `pool - recentDishIds`，不足则放宽用全 pool，再不足则记入 `skippedTypes`；抽样用 `pool[Math.floor(rng() * pool.length)]` 并从池中移除避免同单重复
- [ ] **Step 4: Run `npx jest tests/menuGenerator.test.js -v`** — Expected: PASS（全部用例）
- [ ] **Step 5: Commit** `feat: 菜单推荐与转盘抽取算法`

### Task 3: 聚合工具 `utils/shoppingList.js` + `utils/date.js`（TDD）

**Files:**
- Create: `miniprogram/utils/shoppingList.js`、`miniprogram/utils/date.js`
- Test: `tests/shoppingList.test.js`、`tests/date.test.js`

**Interfaces:**
- Produces:
  - `aggregateShoppingList(dishes: Dish[]) -> [{ name, amount, bought: false }]` — 同名合并（amount 拼接为字符串相加式合并，如 `'1个'+'1个'`→`'2个'` 无法数值化的保持 `'1个/1个'`）；`ingredients` 缺失/空数组的菜跳过；按首次出现排序；初始 `bought: false`
  - `sumCalories(items: MenuDoc['items']) -> number` — `calories` 为 null/undefined 按 0
  - `buildMenuDoc({ picks, requirements, mode }) -> { date, items, requirements, mode, total_calories, shopping_list }` — `items` 为**快照**（每项只取 `{dish_id, name, photo: photos[0], type, calories}`）
  - `formatDateKey(date: Date) -> 'YYYY-MM-DD'`（**本地时区**，用 `getFullYear/getMonth/getDate`，禁用 `toISOString`）、`lastNDays(n: number) -> string[]`（今天往前 n 天，含今天）

- [ ] **Step 1: 写失败测试**：①同名材料合并、无材料的菜被跳过；②`sumCalories` 混合 null/数字；③`buildMenuDoc` 输出的 items 是快照（改原 dish 对象不影响 doc）、热量合计正确、`date === formatDateKey(new Date())`；④`formatDateKey` 传 `new Date(2026, 9, 24, 23, 59)` 得 `'2026-10-24'`、`lastNDays(7)` 长度 7 且首项是今天
- [ ] **Step 2: Run 两个测试文件** — Expected: FAIL
- [ ] **Step 3: 实现两个模块**（amount 合并规则：两段都能解析出 `数字+单位` 时数值相加保留单位，否则用 `/` 连接）
- [ ] **Step 4: Run `npx jest -v`** — Expected: PASS（含 Task 1、2 全部）
- [ ] **Step 5: Commit** `feat: 买菜清单聚合/菜单文档构建/本地日期工具`

### Task 4: AI 结果解析 `utils/aiParse.js`（TDD）

**Files:**
- Create: `miniprogram/utils/aiParse.js`
- Test: `tests/aiParse.test.js`

**Interfaces:**
- Consumes: `constants.TYPE`、`SOURCE`
- Produces: `parseAiJson(raw: string) -> { ok: boolean, data: AiDishFields, error?: string }`，`AiDishFields = { name?: string, type?: TYPE值, source?: SOURCE值, tags?: string[], ingredients?: [{name, amount}], calories?: number, spicy_level?: 0|1|2|3 }` — 非法枚举字段**丢弃**（不报错），`ok:false` 仅当完全解析不出 JSON

- [ ] **Step 1: 写失败测试**：①纯 JSON 字符串 → 全字段通过；②带 ```` ```json ```` 围栏 → 剥离后通过；③`type:'海鲜'`（非法枚举）→ `data.type` 不存在、其余字段保留；④`spicy_level: 9` → 丢弃；⑤完全非 JSON → `{ok:false, error}`；⑥`ingredients` 含无 name 项 → 过滤该项
- [ ] **Step 2: Run** — Expected: FAIL
- [ ] **Step 3: 实现**：剥围栏 → `JSON.parse` 失败则正则提取首个 `{...}` 再 parse → 逐字段按 schema 清洗
- [ ] **Step 4: Run `npx jest -v`** — Expected: PASS
- [ ] **Step 5: Commit** `feat: AI 返回解析与字段清洗`

### Task 5: 云开发环境开通与集合初始化（用户协助）

**Files:**
- Modify: `miniprogram/config.js`（填入 ENV_ID）

**Interfaces:**
- Produces: 可用的 `ENV_ID`；三集合（`dishes`/`menus`/`users`）就绪，权限「仅创建者可读写」；`menus` 有 `_openid+date` 倒序组合索引。Task 6-11 的所有云操作以此为前提。

- [ ] **Step 1: 引导用户在微信开发者工具点「云开发」开通环境**（登录选「微信公众平台登录」；腾讯云账号需已实名认证；**不得**勾「使用云服务」）——确认环境 ID
- [ ] **Step 2: 把环境 ID 写入 `config.js` 的 `ENV_ID`**
- [ ] **Step 3: 经 CloudBase MCP `auth(set_env)` 绑定该环境**，用 `writeNoSqlDatabaseStructure` 创建 `dishes`/`menus`/`users` 三集合，权限确认「仅创建者可读写」，为 `menus` 建 `_openid+date` 倒序组合索引
- [ ] **Step 4: 验证**：MCP `readNoSqlDatabaseStructure` 列出三集合与索引；DevTools 重新编译，`wx.cloud.init` 不再告警
- [ ] **Step 5: Commit** `chore: 接入云开发环境与数据库集合`

### Task 6: 云函数 `recognizeDish`（含限流与两步预检）

**Files:**
- Create: `cloudfunctions/recognizeDish/index.js`、`cloudfunctions/recognizeDish/package.json`（依赖 `wx-server-sdk`、`@cloudbase/node-sdk`）、`cloudfunctions/recognizeDish/quota.js`
- Test: `tests/quota.test.js`

**Interfaces:**
- Consumes: `users` 集合（读写 `ai_usage`）、云存储 fileID、Task 5 环境
- Produces: `exports.main({ fileID }) -> { code: 0, data: AiDishFields }`；错误返回 `{ code: 429|500, message }`（429=超限/未登录异常，500=模型/解析失败）；`quota.js` 导出 `checkQuota(usage: {date,count}|undefined, today: string, limit = AI_DAILY_LIMIT) -> { allowed: boolean, nextUsage: {date, count} }`

- [ ] **Step 1: TDD `quota.js`**：写失败测试——①当日首次调用 `allowed:true, nextUsage:{date:today, count:1}`；②`count === limit` → `allowed:false`；③`usage.date` 是昨天 → 重新计数 `allowed:true`。实现后 Run 至 PASS
- [ ] **Step 2: 执行 AI 两步预检**（按 ai-model 技能，顺序固定）：①计费资格——MCP `callCloudApi(tcb/DescribeActivityInfo, ActivityNames:['ai_miniprogram_inspire_plan'])` 查成长计划；②组就绪——`DescribeAIModels` 查视觉 SKU，缺则 `DescribeManagedAIModelList` + `UpdateAIModel` 启用。**记录选定的 provider(GroupName) 与 model id**（成长计划优先，备选 `cloudbase` 组多模态模型）
- [ ] **Step 3: 实现 `index.js`**：`getWXContext().OPENID` → 查/写 `users.ai_usage`（用 `checkQuota`）→ `cloud.downloadFile` 取图 → node-sdk `ai.createModel(预检选定的Group).generateText({ model, messages: [system: 只回JSON的菜品识别prompt, user: 图片] })` → 复用 Task 4 解析逻辑（云函数内 require 一份等价实现或拷贝——云函数独立打包，采用拷贝 `parse.js` 的方式并在两处文件头注释注明同步关系）→ 返回
- [ ] **Step 4: 部署并真环境联调**：MCP `deployApply`（或 IDE）部署 → DevTools 控制台 `wx.cloud.callFunction({name:'recognizeDish', data:{fileID: 任意已上传图}})` → 返回 `{code:0, data:{name,...}}`；再传一张风景照 → 观察解析降级路径（`code:0` 但字段缺失，或 `code:500`，均为可接受，页面层有手填兜底）
- [ ] **Step 5: Run `npx jest -v` 全绿**（quota 测试入列）
- [ ] **Step 6: Commit** `feat: recognizeDish 云函数（AI识别+每日限流）`

### Task 7: 菜品录入/编辑页 + `services/dishes.js`

**Files:**
- Create: `miniprogram/services/dishes.js`
- Modify: `miniprogram/pages/dishes/edit.{js,wxml,wxss,json}`

**Interfaces:**
- Consumes: `parseAiJson`（Task 4）、`constants`
- Produces（Task 8/10/11 直接调用）:
  - `uploadDishPhotos(tempFilePaths: string[]) -> Promise<string[]>` — `wx.cloud.uploadFile` 逐张，单张失败自动重试 1 次，仍失败则整体 reject
  - `addDish(dish) -> Promise<string>`、`updateDish(id, patch) -> Promise`、`removeDish(id) -> Promise`、`getDish(id) -> Promise<Dish>`、`listDishes({ source?, type?, tag? }) -> Promise<Dish[]>`

- [ ] **Step 1: 实现 `services/dishes.js`**（按上述签名；`addDish` 客户端写入自动带 `_openid`，补 `created_at/updated_at`）
- [ ] **Step 2: 实现 edit 页**：`wx.chooseMedia({ count: 9, sizeType: ['compressed'] })` 选图 → 预览网格（可删）→「开始识别」按钮（取第一张上传后调 `recognizeDish`，loading 态）→ 成功则用 `parseAiJson` 结果**预填**表单（名称/类型/来源/标签/材料/热量/辣度），失败/限流 toast「识别失败，可手动填写」→ 表单可任意改 → 「保存」`uploadDishPhotos` 其余图 → `addDish`/`updateDish` → 返回菜品库。编辑模式经 `options.id` 加载 `getDish`
- [ ] **Step 3: DevTools 走查**：拍/选一张菜品图 → 点识别 → 表单出现预填 → 修正保存 → 控制台无报错、`dishes` 集合出现新记录（MCP 查最近记录确认字段）
- [ ] **Step 4: 断网走查（上传失败路径）**：DevTools 模拟器断网保存 → toast 提示、表单内容不丢、不白屏
- [ ] **Step 5: Commit** `feat: 菜品录入/编辑页与图片上传、AI 识别接入`

### Task 8: 菜品库列表页 + 菜品详情/删除

**Files:**
- Modify: `miniprogram/pages/dishes/dishes.{js,wxml,wxss,json}`、`miniprogram/pages/dishes/detail.{js,wxml,wxss,json}`

**Interfaces:**
- Consumes: `services/dishes.js`（`listDishes`/`removeDish`/`getDish`）、`constants`

- [ ] **Step 1: 实现 dishes 页**：默认「全部」+ 三组筛选器（来源/类型/标签，单选，标签含 `DEFAULT_TAGS` + 用户菜里出现过的自定义标签）；列表/卡片两种视图切换（本地 `wx.setStorageSync` 记忆）；卡片显示封面图、名称、类型/标签；点击进 detail；右下角「+」进 edit
- [ ] **Step 2: 实现 detail 页**：大图轮播（`swiper`）、全部字段、材料列表、「编辑」跳 edit、「删除」需 `wx.showModal` 确认后 `removeDish` 并返回
- [ ] **Step 3: DevTools 走查**：Task 7 添加的菜出现在列表 → 各筛选器组合过滤正确 → 视图切换生效且记忆 → 详情字段完整 → 删除确认后列表消失
- [ ] **Step 4: Commit** `feat: 菜品库列表/筛选/视图切换与详情删除`

### Task 9: 我的页 + `services/users.js`

**Files:**
- Create: `miniprogram/services/users.js`
- Modify: `miniprogram/pages/profile/profile.{js,wxml,wxss,json}`

**Interfaces:**
- Consumes: `users` 集合
- Produces（Task 10 调用）: `ensureUser() -> Promise<UserDoc>`（`_openid` 查，无则建默认文档 `{nickname:'', avatar:'', settings:{people:2, composition:{meat:1,veg:1,staple:1,soup:0,drink:0}, avoid:[]}, ai_usage:null, cabbage:0}`）、`saveSettings(settings: UserDoc['settings']) -> Promise`

- [ ] **Step 1: 实现 `services/users.js` 与 profile 页**：头像（`button open-type="chooseAvatar"`）+ 昵称（`input type="nickname"`）保存进 user 文档；默认偏好表单（人数 stepper、五类数量 stepper、忌口标签多选）「保存」→ `saveSettings`；「我的大白菜」只读显示 0（文案注明"即将上线"）；`app.js` onLaunch 里 `ensureUser()` 静默初始化
- [ ] **Step 2: DevTools 走查**：改头像昵称保存 → 重新进入小程序仍显示；改默认搭配保存 → MCP 查 `users` 集合 settings 已更新
- [ ] **Step 3: Commit** `feat: 用户页（头像昵称填写/默认偏好）`

### Task 10: 菜单生成页（随机整单 + 大转盘）

**Files:**
- Modify: `miniprogram/pages/menu/create.{js,wxml,wxss,json}`

**Interfaces:**
- Consumes: `generateMenu`/`pickForWheel`（Task 2）、`ensureUser`（Task 9 带出默认偏好）、`listDishes`（Task 7）、`listMenusGroupedByDate` 或 `db` 直查近 7 天菜单算 `recentDishIds`（用 `lastNDays`）
- Produces: 确认后把 `buildMenuDoc` 结果传给详情页落库（经 `services/menus.addMenu`，Task 11 提供；本 Task 先以页面参数传递 + `wx.setStorageSync` 暂存过渡，Task 11 接管）

- [ ] **Step 1: 实现需求设置区**：人数、五类数量（0 起）、忌口标签多选（含"辣"），进入页面时带出 `users.settings`
- [ ] **Step 2: 实现随机整单模式**：「生成」→ `generateMenu`（`recentDishIds` 取近 7 天菜单 items 的 dish_id）→ 结果卡片；`skippedTypes` 非空时黄条提示「厨房里还没有X类菜」；**左滑**（`movable-view` 或 touch 事件）→ 换一批
- [ ] **Step 3: 实现大转盘模式**：按 `TYPE_ORDER` 中数量>0 的类逐个转——CSS transition 旋转动画随机停在一项（结果来自 `pickForWheel`）→ 「就它了」锁定进下一类 / 「重转」（`excludeIds` 累加）→ 全类完成进入确认
- [ ] **Step 4: DevTools 走查**：用 Task 7/8 造的 ≥8 个菜（覆盖荤素主食）跑两种模式；把某类型数量设 0 验证转盘跳过；左滑换一批生效；确认后能进入详情页（本 Task 详情页为 Task 11 壳）
- [ ] **Step 5: Commit** `feat: 菜单生成（随机整单/大转盘/需求设置）`

### Task 11: 菜单详情 + 历史列表 + `services/menus.js`

**Files:**
- Create: `miniprogram/services/menus.js`
- Modify: `miniprogram/pages/menu/menu.{js,wxml,wxss,json}`、`miniprogram/pages/menu/detail.{js,wxml,wxss,json}`

**Interfaces:**
- Consumes: `buildMenuDoc`（Task 3）、`formatDateKey`（Task 3）
- Produces: `addMenu(doc) -> Promise<string>`、`getMenu(id) -> Promise<MenuDoc>`、`listMenusGroupedByDate() -> Promise<Array<{date, menus: MenuDoc[]}>>`（`_openid+date` 倒序索引查询后内存分组）、`toggleBought(menuId, itemIndex) -> Promise`

- [ ] **Step 1: 实现 detail 页**：接收 Task 10 确认的 picks → `buildMenuDoc` → `addMenu` 落库 → 展示菜品快照卡、热量合计、买菜清单（`bought` 勾选联动 `toggleBought`，划线样式）；历史入口打开时 `getMenu` 渲染
- [ ] **Step 2: 实现 menu tab 页**：「生成菜单」大按钮进 create；下方历史 `listMenusGroupedByDate` 渲染——按天隔断（日期标题），新在前，每天内多张菜单卡片（显示模式图标字：随机/转盘、菜数、热量）
- [ ] **Step 3: DevTools 走查核心路径②③**：设需求 → 生成 → 确认 → 详情清单出现（同名材料已合并）→ 勾选两项持久化（重进仍是勾选态）→ 返回 menu tab 历史按天隔断显示
- [ ] **Step 4: 删菜回归走查**：删除详情菜单里某道菜 → 打开该历史菜单 → 快照完整不烂（Review Focus ⑤）
- [ ] **Step 5: Commit** `feat: 菜单详情/买菜清单/按天历史`

### Task 12: 收尾——回归走查与 README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Run `npx jest -v`** — Expected: 全部 PASS
- [ ] **Step 2: 按规格 §8 三条核心路径完整回归**（加菜AI识别→可见 / 需求→生成→确认 / 清单勾选+历史查看），记录走查结果
- [ ] **Step 3: 写 README**：项目结构、`ENV_ID`/appid 配置位置、如何在 DevTools 打开、云函数部署命令、Jest 运行方式
- [ ] **Step 4: （可选，需用户在 mp 后台配置上传密钥）真机预览**：`wechatide` 或 `miniprogram-ci` 生成预览码，用户扫码真机走一遍核心路径
- [ ] **Step 5: Commit** `docs: README 与回归走查记录`
