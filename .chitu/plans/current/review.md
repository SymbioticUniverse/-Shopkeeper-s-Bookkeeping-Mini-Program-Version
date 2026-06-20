# 自审报告 — 对照 API.md 修复 voucher + upload

## 改动文件 (7个)

### 1. `backend/src/db.js`
- ✅ ALTER TABLE 添加 voucher 列（迁移到已有 DB）
- ✅ items_mig 重建表也包含 voucher + INSERT 也迁移 voucher
- ⚠️ 原始 CREATE TABLE 未加 voucher，但 ALTER TABLE 兜底，新/旧库均覆盖

### 2. `backend/src/routes/items.js`
- ✅ rowToItem 添加 `voucher: row.voucher || ''`
- ✅ addItem INSERT 列从 13→14，参数加 item.voucher
- ✅ addLinkedItems INSERT 列从 13→14，两处 run 均加 voucher 参数
- ✅ updateItem setClauses 新增 voucher（合并更新，传了才覆盖，不传保留旧值 — 符合 API.md "编辑时 voucher 保持不变"）
- ✅ 无 null/undefined 风险：`|| ''` 兜底

### 3. `backend/src/routes/upload.js` (新建)
- ✅ multer diskStorage，按 `{userId}/{yyyy}/{mm}/{uuid}.ext` 归档
- ✅ fileFilter 仅允许 image/jpeg、image/jpg、image/png
- ✅ limits.fileSize = 5MB
- ✅ requireAuth 校验登录态
- ✅ 响应 `{ ok: true, url }`，URL 由 VOUCHER_BASE_URL 或 req host 构造
- ✅ multer 错误分类处理（LIMIT_FILE_SIZE 单独提示）

### 4. `backend/src/app.js`
- ✅ 添加 `const path = require('path')`
- ✅ 注册 `/api/upload` 路由
- ✅ 添加 `/voucher` 静态文件中间件（express.static）

### 5. `backend/package.json`
- ✅ 添加 multer@^1.4.5-lts.1

### 6. `backend/src/routes/migrate.js`
- ✅ INSERT 列从 13→14，参数加 item.voucher

### 7. `utils/api.js`
- ✅ 新增 `uploadVoucher(filePath)` 函数，使用 wx.uploadFile (multipart)
- ✅ 返回 Promise<string>，解析 `{ ok: true, url }` 响应
- ✅ 带 Authorization Bearer token
- ✅ 已导出到 module.exports

## 逻辑正确性检查
- ✅ voucher 字段贯穿：addItem → DB → getItems → rowToItem → 前端
- ✅ updateItem 不覆盖 voucher（除非显式传入 — 前端不会传）
- ✅ uploadVoucher 与其他接口一致使用 BASE_URL + token
- ✅ 上传目录自动创建（fs.mkdirSync recursive: true）
- ✅ 无循环依赖、无新增 null/undefined 风险

## 边界情况
- ✅ 无 voucher 的旧数据：rowToItem 返回 `''`，前端安全
- ✅ 未登录上传：requireAuth 返回 401
- ✅ 非图片上传：fileFilter 拒绝，返回 "仅支持 jpg/jpeg/png"
- ✅ 超大文件：multer LIMIT_FILE_SIZE 返回 400
- ✅ 无文件：req.file 检查返回 400

## 未覆盖（已知限制）
- ⚠️ 生产环境 voucher URL 需配 VOUCHER_BASE_URL 指向 CDN
- ⚠️ 删除账单时未清理对应 voucher 文件（API.md 标注为"可选"）
- ⚠️ multer 1.x 有已知漏洞，生产建议升 2.x（当前用 1.4.5-lts.2 是兼容选择）
