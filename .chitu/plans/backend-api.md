# 后端 API 实现计划

> 基于 API.md 接口契约，在 `backend/` 下构建完整的微信小程序后端。

## 技术选型
- **运行时**: Node.js
- **框架**: Express
- **数据库**: SQLite (better-sqlite3)
- **认证**: JWT (jsonwebtoken)
- **密码哈希**: bcryptjs

## 子任务

### [ ] 1. 项目骨架 — package.json / 数据库 Schema / 迁移脚本 / Express 启动
- 文件: `backend/package.json`, `backend/src/db.js`, `backend/src/migrate.js`, `backend/src/app.js`

### [ ] 2. 认证系统 — 验证码 / 手机登录 / 微信登录 / 登出 / 用户信息
- 接口: sendVerifyCode, loginByPhone, loginByWechat, logout, getUserInfo, saveUserInfo, removeUserInfo
- 文件: `backend/src/routes/auth.js`, `backend/src/middleware/auth.js`

### [ ] 3. 账单 CRUD + 联动 — 双账本 / 垫付应付联动 / 结清 / 作废
- 接口: getItems, addItem, updateItem, removeItem, addLinkedItems
- 文件: `backend/src/routes/items.js`

### [ ] 4. 分类 + 公司 + 审核 + 通知 — 四个中优先级模块
- 接口: getCategories, saveCategories, getCompanyInfo, saveCompanyInfo, removeCompanyInfo, getAuditList, saveAuditList, removeAuditList, getNotifyList, saveNotifyList
- 文件: `backend/src/routes/categories.js`, `backend/src/routes/company.js`, `backend/src/routes/audit.js`, `backend/src/routes/notify.js`

### [ ] 5. 反馈 + 设置 + 简览卡片 + 迁移
- 接口: getFeedbackList, saveFeedbackList, getSetting, saveSetting, removeSetting, getOverviewCards, saveOverviewCards, migrate
- 文件: `backend/src/routes/feedback.js`, `backend/src/routes/settings.js`, `backend/src/routes/overview.js`, `backend/src/routes/migrate.js`
