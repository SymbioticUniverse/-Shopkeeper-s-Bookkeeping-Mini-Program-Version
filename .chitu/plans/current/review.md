# Self-Review — API.md 7.1 isNew + 7.2 头像公开路由

## 改动文件
- `backend/src/routes/auth.js` — `login-by-phone` / `login-by-wechat` 加 `isNew`
- `backend/src/routes/upload.js` — 头像上传子目录 + `servePublicVoucher`
- `backend/src/app.js` — 注册 `GET /public/voucher/*`

## 逐文件检查

### auth.js
- `isNew` 默认 `false`，仅首次创建用户时设 `true` ✅
- 老用户登录 `isNew: false` ✅
- 两个登录接口行为一致 ✅
- 向后兼容：前端忽略多余字段不会出错 ✅

### upload.js
- **multer destination**: `?type=avatar` → `voucher/{safeId}/avatar/`（扁平目录）；否则 `voucher/{safeId}/{yyyy}/{mm}/` 不变 ✅
- **URL 返回**: avatar 走 `/public/voucher/` 前缀，普通凭证走 `/voucher/` 前缀 ✅
- **servePublicVoucher**:
  - 路径解析：`parts[1] !== 'avatar'` 强制仅 avatar 子路径可公开访问 ✅
  - userId sanitize + 比对：防 `../` 绕过 ✅
  - `absPath.startsWith(VOUCHER_DIR + path.sep)`：防路径穿越 ✅
  - 文件存在检查 + Content-Type + nosniff 安全头 ✅
  - Cache-Control: public（头像可缓存）✅
  - 无 `next` 参数：Express 正常处理，非错误中间件 ✅

### app.js
- `servePublicVoucher` 正确 import ✅
- `/public/voucher/*` 无 `requireAuth` 中间件 ✅
- 与 `/voucher/*` 鉴权路由互不影响 ✅

## 边界场景
- `/public/voucher/` 无子路径 → parts.length < 3 → 403 ✅
- `/public/voucher/../etc/passwd` → sanitizeUserId 替换 `.` 为 `_` + startsWith 检查 → 403 ✅
- 普通凭证 URL (`/voucher/1/2026/06/abc.jpg`) 走鉴权路由，不受公开路由影响 ✅
- `type=avatar` 不带 query → `req.query.type` 为 undefined → `isAvatar` 为 false → 正常凭证流程 ✅

## 测试结果
- `backend/test_settle.sh`：22/22 全量通过 ✅
- `isNew` 手动验证：新用户 `isNew:true`，老用户 `isNew:false` ✅
