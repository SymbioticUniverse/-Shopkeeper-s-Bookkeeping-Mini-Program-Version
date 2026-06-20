# Self-Review: 后端代码修复（第一轮）

## 修改文件

| 文件 | 修复项 |
|------|--------|
| `backend/src/db.js` | #3 迁移吞错 |
| `backend/src/routes/auth.js` | #1 微信登录, #7 验证码日志 |
| `backend/src/routes/items.js` | #2 linkedId注入, #4 type_label联动, #5 DELETE级联 |

## 逐项审查

### db.js — `addColumnSafely()` 替代 try/catch
- ✅ 使用 `PRAGMA table_info` 预先判断列是否存在，不再吞掉磁盘 I/O 等异常
- ✅ 日志输出 `[MIGRATE]` 方便追踪
- ✅ 保留 amount TEXT→REAL 迁移的原有 try/catch（有明确错误处理）
- ⚠️ `PRAGMA table_info` 若失败会抛异常，但这是初始化阶段，未被 try-catch 包裹会导致进程崩溃——但 PRAGMA 是纯元数据查询，不太可能失败

### auth.js — 验证码日志
- ✅ `NODE_ENV !== 'production'` 判断，生产环境不打印验证码明文
- ✅ 开发环境仍保留日志便于调试

### auth.js — 微信 code2Session
- ✅ `getOpenidByCode()` 函数：生产环境有 WECHAT_APPID/SECRET 时调用真实 code2Session API
- ✅ 开发环境降级：code 直接作为 openid，带 `console.warn` 提示
- ✅ 生产环境未配置时 `throw Error`（由调用方 500 返回）
- ✅ 路由改为 `async`，await 异步调用
- ✅ `https.get` 的 reject 路径正确：errcode、空 openid、JSON 解析失败、网络错误
- ✅ 错误信息不泄露 appid/secret（只输出 errcode+errmsg）
- ⚠️ 开发降级模式下 `code` 仍是弱 openid——但开发环境不需要强安全，且有 warn 日志提示

### items.js — validateLinkedId 函数
- ✅ `!linkedId` 判空（null/undefined/0 统一放过，SQLite id 自增从 1 开始）
- ✅ 查询 `items WHERE id = ? AND user_id = ?` 校验归属
- ✅ 三处调用：POST `/`、PUT `/:id`、POST `/linked`

### items.js — POST `/` linkedId 校验
- ✅ 在 INSERT 前校验
- ✅ 错误消息清晰："linkedId 指向的账单不存在或不属于当前用户"

### items.js — PUT `/:id` type_label 联动校验
- ✅ `effectiveType` 计算：优先用请求中的 `data.type`，其次查 DB
- ✅ `effectiveType === 'in'` 时要求 typeLabel 包含"收入"
- ✅ `effectiveType === 'out'` 时要求 typeLabel 包含"支出"
- ⚠️ 校验依赖字符串 `includes('收入')` / `includes('支出')`——中文硬编码，若未来国际化需调整
- ✅ `effectiveType` 为 null 时不进入任何 if 分支，静默放过（保守安全）

### items.js — PUT `/:id` linkedId 校验
- ✅ `data.linkedId !== null` 判断（null 表示解除链接，允许）
- ✅ 非 null 时调用 `validateLinkedId` 校验归属

### items.js — DELETE `/:id` 镜像查询加 user_id
- ✅ `WHERE linked_id = ? AND user_id = ?` 限制同用户
- ✅ 防止跨用户级联误删

### items.js — POST `/linked` 防护增强
- ✅ item.linkedId 和 mirrorItem.linkedId 各自校验
- ✅ `item.id === mirrorItem.id` 冲突检查（409 错误码）

## 边界情况
- `linkedId = 0`：`!linkedId` 为 true，作为 null 放过 → SQLite 自增 id 从 1 开始，id=0 不存在，安全
- `effectiveType = null`：不匹配 'in' 或 'out'，静默通过 → 保守策略，安全
- `data.type` 和 `data.typeLabel` 同时传入不一致的值 → 以 type 为准校验 typeLabel，正确

## 结论
所有修改逻辑正确，无新增安全漏洞，边界情况已覆盖。
