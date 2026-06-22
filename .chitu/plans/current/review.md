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

## 结论

所有变更通过自检，无已知缺陷。
