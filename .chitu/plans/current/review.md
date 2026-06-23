# Self-Review — 7.7 图片路由挂载修复

## 修改文件
- `backend/src/app.js`: 2 行
- `API.md`: 1 行

## 逐项核查

### backend/src/app.js (line 101, 104)
- ✅ `app.get('/voucher/*', ...)` → `app.use('/voucher', ...)` — Express `app.use` 自动剥离挂载前缀
- ✅ `app.get('/public/voucher/*', ...)` → `app.use('/public/voucher', ...)` — 同上
- ✅ 其余路由均使用 `app.use`，风格统一
- ✅ `serveVoucher` 签名 `(req, res, next)` 兼容 `app.use` 中间件链
- ✅ `servePublicVoucher` 签名 `(req, res)` 作为终端 handler，不会调用 next

### 路径校验验证
- **serveVoucher**: `req.path="/4/2026/06/uuid.jpg"` → `relPath="4/2026/06/uuid.jpg"` → `startsWith("4/")` → ✅ 通过
- **servePublicVoucher**: `req.path="/4/avatar/uuid.jpg"` → `parts=["4","avatar","uuid.jpg"]` → `parts[1]==="avatar"` → ✅ 通过

### API.md (7.7)
- ✅ ⚠️待修 → ✅已交付，描述更新

## 边界情况
- ✅ `app.use` 匹配所有 HTTP method，但 handler 只读文件不产生副作用，非 GET 请求会执行同样校验后返回 404（文件不存在），无安全风险
- ✅ 路由 `/voucher`（无尾部路径）命中时 `relPath` 为空 → `startsWith` 失败 → 403 被拒绝，不会泄露目录
- ✅ 路由 `/public/voucher`（无尾部路径）同理 → `parts.length < 3` → 403
