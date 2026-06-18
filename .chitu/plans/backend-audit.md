# Backend Audit Plan

对比 API.md 契约，对后端 10 个路由模块逐接口审计。

## 子任务

- [x] 1. 审计 items.js — 账单接口（5 个 + 联动）✅ GET/POST/PUT/DELETE + linked 全部通过
- [x] 2. 审计 categories.js — 分类接口（2 个）✅ GET/POST scope 隔离正常
- [x] 3. 审计 company.js — 公司接口（3 个 + 申请/退出/解散）✅ boss 创建/删除正确，重复 UID 返回 409
- [x] 4. 审计 audit.js — 审核接口（3 个）✅ boss 专属，非 boss 返回错误
- [x] 5. 审计 notify.js — 通知接口（2 个）✅ GET/POST user_id 隔离正确
- [x] 6. 审计 feedback.js — 反馈接口（2 个）✅ GET/POST user_id 隔离正确
- [x] 7. 审计 auth.js — 认证接口（7 个）✅ 验证码一次性使用、手机/微信登录返回 token、logout 销毁会话、user-info CRUD 正常
- [x] 8. 审计 settings.js — 设置接口（3 个 + /all）✅ GET(key)/POST/DELETE + GET /all 同步接口均正常
- [x] 9. 审计 overview.js — 简览卡片接口（2 个）✅ GET/POST 整体覆盖正常
- [x] 10. 审计 migrate.js — 迁移接口（1 个）✅ POST 返回 {success, migrated}
- [x] 11. 审计 db.js — 表结构完整覆盖 API.md 数据模型 ✅ 11 张表：users/sessions/verify_codes/items/categories/companies/company_members/notifications/feedback/user_settings/overview_cards
- [x] 12. 审计 auth.js 中间件 — JWT 校验正确 ✅ 未登录返回 401、过期/注销返回对应错误、req.userId 注入正确
- [x] 13. 运行时测试 — 启动后端，curl 验证全部 30 个接口 ✅ 30/30 PASS
