# api.js 混合对接计划

> 策略：本地缓存同步读 + 后端异步写，页面零改动

## 核心原则
- **读操作**：从本地 Storage 同步读取（不改已有调用方）
- **写操作**：先写本地 Storage（同步），再异步推送到后端
- **认证操作**：完全走后端，token 存本地
- **初始同步**：提供 `syncFromCloud()` 从后端拉数据到本地

## 实现步骤

### 1. 基础设施
- `BASE_URL` 常量
- `_token` 本地存取
- `_request(method, path, data)` — wx.request Promise 封装
- `_syncFromCloud()` — 拉取后端全量数据到本地 Storage

### 2. 改造函数矩阵

| 函数 | 读/写 | 改造方式 |
|------|-------|---------|
| getItems | 读 | 不动 |
| addItem | 写 | 本地 + 后端异步 |
| updateItem | 写 | 本地 + 后端异步 |
| removeItem | 写 | 本地 + 后端异步 |
| addLinkedItems | 写 | 本地 + 后端异步 |
| getCategories | 读 | 不动 |
| saveCategories | 写 | 本地 + 后端异步 |
| getCompanyInfo | 读 | 不动 |
| saveCompanyInfo | 写 | 本地 + 后端异步 |
| removeCompanyInfo | 写 | 本地 + 后端异步 |
| getAuditList | 读 | 不动 |
| saveAuditList | 写 | 本地 + 后端异步 |
| removeAuditList | 写 | 本地 + 后端异步 |
| getNotifyList | 读 | 不动 |
| saveNotifyList | 写 | 本地 + 后端异步 |
| getFeedbackList | 读 | 不动 |
| saveFeedbackList | 写 | 本地 + 后端异步 |
| sendVerifyCode | 写 | 纯后端（async） |
| loginByPhone | 写 | 纯后端（async），存token |
| loginByWechat | 写 | 纯后端（async），存token |
| logout | 写 | 纯后端（async），清token |
| getUserInfo | 读 | 不动（本地缓存） |
| saveUserInfo | 写 | 本地 + 后端异步 |
| removeUserInfo | 写 | 本地 + 后端异步 |
| getSetting | 读 | 不动 |
| saveSetting | 写 | 本地 + 后端异步 |
| removeSetting | 写 | 本地 + 后端异步 |
| getOverviewCards | 读 | 不动 |
| saveOverviewCards | 写 | 本地 + 后端异步 |
| migrate | 写 | 本地 + 后端异步 |
