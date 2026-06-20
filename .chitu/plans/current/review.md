# 安全加固 Review

## 改动文件

- `backend/src/app.js` — 裸 express.static → 鉴权代理路由
- `backend/src/routes/upload.js` — magic bytes + 扩展名白名单 + userId sanitize + 鉴权代理
- `backend/src/routes/items.js` — voucher 校验 + 删除清理磁盘 + /linked 校验

## 逐文件检查

### backend/src/app.js

- ✅ `express.static('/voucher')` 已移除
- ✅ 替换为 `app.get('/voucher/*', requireAuth, serveVoucher)`
- ✅ `requireAuth` 通过 inline require 注入（与现有路由注册风格一致）
- ✅ `serveVoucher` 从 upload.js 导出

### backend/src/routes/upload.js

**detectImageType():**
- ✅ PNG magic: 89 50 4E 47
- ✅ JPEG magic: FF D8 FF
- ✅ fd 用 `finally` 确保关闭，异常吞掉不泄漏
- ✅ 非图片返回 null

**sanitizeUserId():**
- ✅ 剔除 `/` `\` `.` 三个路径操作字符
- ✅ 空字符串降级为 `'unknown'`
- ✅ 首尾下划线修剪

**Multer 配置:**
- ✅ `destination` 使用 `sanitizeUserId(req.userId)`
- ✅ `filename` 统一用 `.tmp` 后缀，不再信任 `file.originalname`
- ✅ `fileFilter` 保留 MIME 初步过滤（深度校验在 magic bytes 阶段）

**POST 处理器:**
- ✅ multer 完成后调用 `detectImageType()` 校验真实类型
- ✅ 非图片时 `unlinkSync` 删除 `.tmp` 文件后返回 400
- ✅ 图片时 `renameSync` 改为正确扩展名（`.jpg` / `.png`）
- ✅ rename 失败时也清理临时文件
- ✅ URL 构建使用 `newPath`（已重命名后的路径）

**serveVoucher():**
- ✅ 从 `req.path` 提取相对路径
- ✅ 归属校验：`relPath.startsWith(safeId + '/')`
- ✅ `path.resolve` 后二次确认仍在 VOUCHER_DIR 内（防穿越）
- ✅ `X-Content-Type-Options: nosniff`
- ✅ `Cache-Control: private, max-age=86400`（私有缓存）
- ✅ 文件不存在返回 404

**边界检查:**
- ✅ safeId 防 userId=`1` 匹配 `10/...` 路径前缀问题：`'10/...'.startsWith('1/')` → false，不会误授权

### backend/src/routes/items.js

**validateVoucher():**
- ✅ 空值允许（无凭证场景）
- ✅ 检查 voucher URL 包含 `/safeId/` 段
- ✅ 也接受 `safeId/` 开头的相对路径
- ✅ 非法返回 null，调用方返回 400

**voucherToDiskPath():**
- ✅ 从完整 URL 提取 `/voucher/{safeId}/...` 后的相对路径
- ✅ 也支持纯相对路径
- ✅ `path.resolve` 后二次确认路径安全
- ✅ 文件操作 wrapped in try-catch，失败不影响响应

**POST /:**
- ✅ voucher 入库前校验归属

**PUT /:id:**
- ✅ voucher 更新前校验归属
- ✅ 允许 `voucher: ''` 清空凭证

**DELETE /:id:**
- ✅ 事务内收集所有将被删除的 item（主 + linked_id 正向镜像 + linked_id 反向镜像）的 voucher
- ✅ 事务成功后清理磁盘文件（非事务，失败仅 log 不报错）
- ✅ 磁盘清理使用 `existsSync` + `unlinkSync`

**POST /linked:**
- ✅ 新增 scope 值校验 `['personal', 'company'].includes()`
- ✅ 两条 item 的 voucher 均校验归属
- ✅ `SQLITE_CONSTRAINT_PRIMARYKEY` 返回 409（之前走 500）

## 未覆盖的审计点

- 🟢 migrate.js 路由仍在线（建议下线，非本次范围）
- 🟢 db.js REAL 金额精度（既有设计，非本次范围）
- 🟢 app.db 在 git 历史中（需 BFG 清理，非代码改动）

## 结论

五个审计点全部修复，代码自查无逻辑缺陷。
