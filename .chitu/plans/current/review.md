# 自审 — 验证码查看网页

## 变更文件

### 1. `backend/src/routes/admin.js` — 新增
- `GET /api/admin/verify-codes`: 查询 verify_codes 表最近的 50 条记录，返回 `{ codes: [...] }`
- `GET /admin`: 内联 HTML 网页，3 秒轮询验证码，按过期状态排序（有效在前），显示手机号、验证码、过期/锁定状态、失败次数
- 通过 `req.baseUrl` 区分 `/admin`（返回 HTML）和 `/api/admin`（跳过，让 Express 匹配 verify-codes 路由）

### 2. `backend/src/app.js` — 新增路由挂载
- `app.use('/api/admin', adminRouter)` — 挂载验证码 JSON API
- `app.use('/admin', adminRouter)` — 挂载验证码查看网页

### 3. `admin/index.html` — 保留本地参考（不参与部署）

### 4. `docker-compose.yml` — 端口从 80:80 改为 8080:80

### 5. `utils/api.js` — BASE_URL 改为 `http://8.134.250.114:8080/api`

### 6. `.env` — 真实密钥

## 自审检查

| 检查项 | 状态 |
|--------|------|
| admin.js 语法 `node -c` 通过 | ✅ |
| `/admin` 公网返回 200 | ✅ |
| `/api/admin/verify-codes` 返回有效 JSON | ✅ |
| 无验证码时返回 `{"codes":[]}` 不报错 | ✅ |
| baseUrl 判断正确（/admin 返回 HTML，/api/admin 跳过） | ✅ |
| SQL 注入防护：phone/code/expires_at 等列名硬编码，无动态拼接 | ✅ |
| HTML 内联，不依赖文件系统 | ✅ |
| 空状态 UI：显示"暂无验证码"提示 | ✅ |
| 过期/锁定状态 badge 正确 | ✅ |
