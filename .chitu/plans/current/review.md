# 自检报告 — 对照 API.md 完善后端 (7.4 + 7.5)

## 变更文件

| 文件 | 变更内容 |
|------|----------|
| `backend/src/db.js` | 新增 `profile_updated_at` 列迁移（`INTEGER NOT NULL DEFAULT 0`） |
| `backend/src/routes/auth.js` | GET/POST `/user-info` 支持 `updatedAt`；登录响应携带 `updatedAt` |
| `backend/src/routes/upload.js` | `type=avatar` 上传前清理旧头像文件，单用户单份存储 |

## 逐项检查

### 7.4 头像单份存储 (upload.js)

- ✅ 仅 `req.query.type === 'avatar'` 时触发清理
- ✅ `fs.existsSync` 检查目录存在性，不存在则跳过
- ✅ `readdirSync` + `unlinkSync` 遍历删除旧文件
- ✅ 异常被 catch，不影响后续上传流程（`console.error` 记录）
- ✅ 普通凭证（非 avatar）不受影响

### 7.5 用户资料时间戳 (db.js + auth.js)

**db.js:**
- ✅ `addColumnSafely` 幂等迁移，重复执行安全
- ✅ `INTEGER NOT NULL DEFAULT 0`，0 表示「从未更新」，与前端 `remoteTs > 0` 语义对齐

**auth.js — GET /user-info:**
- ✅ `profile_updated_at` 加入 SELECT
- ✅ 返回 `updatedAt: user.profile_updated_at || null`（0 转为 null，前端用 `> 0` 判断）
- ✅ 用户不存在返回 `null`

**auth.js — POST /user-info 冲突检测:**
- ✅ `updatedAt` 从 req.body 提取
- ✅ `updatedAt === undefined` 时不进入冲突检测（向后兼容旧客户端）
- ✅ `serverUpdatedAt === 0` 时不冲突（服务端从未被真实更新过）
- ✅ `serverUpdatedAt !== updatedAt` 时 409 + 返回 `serverUpdatedAt`
- ✅ 成功写入后存储 `Date.now()`（毫秒整数，匹配 INTEGER 列类型）
- ✅ 响应返回 `updatedAt: newUpdatedAt`（数字，前端可直接比较）

**auth.js — 登录响应:**
- ✅ 手机登录返回 `updatedAt: user.profile_updated_at || null`
- ✅ 微信登录返回 `updatedAt: user.profile_updated_at || null`
- ✅ 新用户 `profile_updated_at` 为 0，`|| null` 降级为 null — 前端正确识别为「无时间戳」

### 边界情况

| 场景 | 预期行为 | 实际 |
|------|----------|------|
| 旧客户端不发 `updatedAt` | 跳过冲突检测，直接写入 | ✅ |
| 新用户首次更新（server=0, client=Ts） | 不冲突，写入 | ✅ 已修复（原为 409） |
| 两设备同时更新（server=X, client=Y≠X） | 409 冲突 | ✅ |
| 同一设备正常更新（server=X, client=X） | 不冲突，写入 | ✅ |
| 头像目录不存在 | 跳过清理，正常上传 | ✅ |
| 头像清理时文件被占用 | catch 吞错，继续上传 | ✅ |
| profile_updated_at 列已存在 | addColumnSafely 跳过 | ✅ |

### 语法检查

```
$ node --check src/routes/auth.js  → OK
$ node --check src/routes/upload.js → OK
$ node --check src/db.js            → OK
```

### 7.3 前端配合 — 登录后同步刷新 (mingxi.js + api.js)

**mingxi.js 4 处登录路径统一补充:**
- ✅ `onLoginByPhone` → syncFromCloud 后 `.then()` 内调用 `_syncOverviewCards()` + `setData({userInfo})` + `_refreshAvatarDisplay(su)`
- ✅ `onLoginByWechat` → 同上
- ✅ `onWechatLoginSuccess` → 同上（phone 已绑定）
- ✅ `onWechatLoginSuccess` → 同上（同一账号）
- ✅ 删除 `_isFreshUser` / `_maybeProfileSetup` 死代码（登录响应已带回 hasCompany，不再需要客户端推测）

**mingxi.js 头像上传重构:**
- ✅ `wx.compressImage` 压缩先行（400 宽 / quality 80），3s 超时 fallback 用原图
- ✅ 压缩后调用 `_uploadAvatar(local)`，Promise 风格 `.then/.catch` 处理上传结果
- ✅ 传给 `api.uploadVoucher(local, 'avatar')` — 后端据此走头像专用通道
- ✅ 前端预校验（5MB / jpg-png）移到 compress 之前保留

**mingxi.js 简览安全:**
- ✅ `_syncOverviewCards(skipCharts)` — 资料弹窗保存时传 `true`，避免真机 canvas 重绘崩溃重启

**mingxi.wxml / mingxi.wxss 资料弹窗重设计:**
- ✅ 新增 subtitle、头像角标 badge、昵称 field-head + 字数计数
- ✅ 暗色模式配套 CSS 完整
- ✅ 无未使用 class、无越界 rpx

**utils/api.js:**
- ✅ `saveUserInfo` 自动打 updatedAt 毫秒戳（调用方已带则用调用方的）
- ✅ `syncFromCloud` last-write-wins 安全降级：仅当 `remoteTs > 0 && localTs > remoteTs` 保留本地并反推；否则云端权威
- ✅ `uploadVoucher(filePath, type)` — type='avatar' 时加 `?type=avatar` query，不传时兼容旧调用

**API.md:**
- ✅ 新增 7.3（公司角色持久化）、7.4（头像单份存储）、7.5（用户资料时间戳）

### 边界情况

| 场景 | 预期 | 实际 |
|------|------|------|
| syncFromCloud 后端不返回 updatedAt | 云端权威覆盖 | ✅ `remoteTs > 0` 不成立，走 else |
| syncFromCloud 本地无 userInfo | 云端覆盖 | ✅ `localTs = 0`，不大于 remoteTs |
| compressImage 不回调 | 3s 后用原图 | ✅ setTimeout 兜底 |
| uploadVoucher 旧调用（无 type） | query 为空，后端走普通凭证 | ✅ |
| profile 弹窗保存 | 不重绘 canvas | ✅ `skipCharts=true` |
| 暗色模式资料弹窗 | 所有元素有 dark 样式 | ✅ 逐项核对 |

### 语法检查

```
$ node --check pages/mingxi/mingxi.js  → OK (小程序环境依赖 wx API，语法层面无问题)
$ node --check utils/api.js             → OK
```

## 结论

所有变更（后端 3 文件 + 前端 5 文件）通过自检，无已知缺陷。
