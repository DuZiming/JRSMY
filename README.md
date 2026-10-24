# 今日食咩野 🥬

微信小程序 MVP：解决"今天吃什么"——菜品库（拍照 + AI 识别自动填表）、今日菜单（随机整单 / 大转盘）、买菜清单、按天历史。

## 技术栈

- **前端**：原生微信小程序（基础库 ≥ 3.7.1）
- **后端**：微信云开发（`wx.cloud`）——NoSQL 文档数据库 + 云存储 + 云函数
- **AI**：云函数 `recognizeDish` 调用 CloudBase 托管多模态模型（glm-5.3-flash）识别菜品图片
- **测试**：Jest（纯函数层：推荐算法 / 清单聚合 / AI 解析 / 限流）

## 项目结构

```
miniprogram/            小程序源码（miniprogramRoot）
  app.js|json|wxss      入口 + 全局设计 tokens（奶油底/叶绿/南瓜橘）
  config.js             ENV_ID —— 云开发环境 ID 在这里改
  custom-tab-bar/       悬浮胶囊 tabBar
  pages/
    menu/               今日菜单（首页 hero + 按天历史）、生成（随机/大转盘）、详情（买菜清单）
    dishes/             菜品库（筛选/双视图）、编辑（拍照/AI识别/旋转）、详情
    profile/            我的（头像昵称填写能力、默认偏好）
  services/             数据访问层：dishes / menus / users
  utils/                纯函数层（Jest 覆盖）：menuGenerator / shoppingList / aiParse / date / constants
cloudfunctions/
  recognizeDish/        唯一云函数：限流(20次/人/天) + 取图 + 多模态识别 + 字段清洗
tests/                  Jest 测试
docs/superpowers/       设计规格与实施计划
```

## 快速开始

1. 微信开发者工具（**Nightly**）导入项目根目录，appid 填自己的
2. 开通云开发环境，把环境 ID 填进 `miniprogram/config.js` 的 `ENV_ID`
3. 云开发控制台创建集合 `dishes` / `menus` / `users`（权限：仅创建者可读写），`menus` 建 `_openid+date` 倒序组合索引
4. AI 识别：控制台「AI+ → 模型管理」启用 `glm-5.3-flash`（或改 `cloudfunctions/recognizeDish/index.js` 里的 `AI_MODEL` 为你启用的多模态模型）
5. 部署云函数 `recognizeDish`（超时 120s，云端安装依赖）

## 命令

```bash
npm install        # 安装 jest
npm test           # 运行全部单测（42 用例）
```

## 关键设计决策（详见 docs/superpowers/specs/）

- **菜单 items 存快照**：菜品被删/改，历史菜单与买菜清单不受影响
- **AI 只预填不自动保存**：识别失败随时手填，AI 永不阻塞
- **厨房/大白菜/美食广场**：二期（个人主体类目限制，企业主体后开）
