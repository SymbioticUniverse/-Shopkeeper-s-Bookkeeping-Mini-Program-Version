# api.js 混合对接计划

> 策略：本地缓存同步读 + 后端异步写，页面零改动

## 核心原则
- **读操作**：从本地 Storage 同步读取（不改已有调用方）
- **写操作**：先写本地 Storage（同步），再异步推送到后端
- **认证操作**：完全走后端，token 存本地
- **初始同步**：提供 `syncFromCloud()` 从后端拉数据到本地

## 实现步骤

### [x] 1. 基础设施
- [x] `BASE_URL` 常量
- [x] `_getToken` / `_setToken` 本地存取
- [x] `_request(method, path, data)` — wx.request Promise 封装
- [x] `_pushBackend(method, path, data)` — 异步后台推送
- [x] `syncFromCloud()` — 拉取后端全量数据到本地 Storage

### [x] 2. 改造函数矩阵

| 函数 | 读/写 | 改造方式 | 状态 |
|------|-------|---------|------|
| getItems | 读 | 不动 | [x] |
| addItem | 写 | 本地 + 后端异步 | [x] |
| updateItem | 写 | 本地 + 后端异步 | [x] |
| removeItem | 写 | 本地 + 后端异步 | [x] |
| addLinkedItems | 写 | 本地 + 后端异步 | [x] |
| getCategories | 读 | 不动 | [x] |
| saveCategories | 写 | 本地 + 后端异步 | [x] |
| getCompanyInfo | 读 | 不动 | [x] |
| saveCompanyInfo | 写 | 本地 + 后端异步 | [x] |
| removeCompanyInfo | 写 | 本地 + 后端异步 | [x] |
| getAuditList | 读 | 不动 | [x] |
| saveAuditList | 写 | 本地 + 后端异步 | [x] |
| removeAuditList | 写 | 本地 + 后端异步 | [x] |
| getNotifyList | 读 | 不动 | [x] |
| saveNotifyList | 写 | 本地 + 后端异步 | [x] |
| getFeedbackList | 读 | 不动 | [x] |
| saveFeedbackList | 写 | 本地 + 后端异步 | [x] |
| sendVerifyCode | 写 | 纯后端（async） | [x] |
| loginByPhone | 写 | 纯后端（async），存token | [x] |
| loginByWechat | 写 | 纯后端（async），存token | [x] |
| logout | 写 | 纯后端（async），清token | [x] |
| getUserInfo | 读 | 不动（本地缓存） | [x] |
| saveUserInfo | 写 | 本地 + 后端异步 | [x] |
| removeUserInfo | 写 | 本地 + 后端异步 | [x] |
| getSetting | 读 | 不动 | [x] |
| saveSetting | 写 | 本地 + 后端异步 | [x] |
| removeSetting | 写 | 本地 + 后端异步 | [x] |
| getOverviewCards | 读 | 不动 | [x] |
| saveOverviewCards | 写 | 本地 + 后端异步 | [x] |
| migrate | 写 | 本地 + 后端异步 | [x] |

### [x] 3. 导出

- [x] 全部 30 个函数 + syncFromCloud 通过 module.exports 导出
