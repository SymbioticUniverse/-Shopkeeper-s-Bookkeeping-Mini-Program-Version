# Backend Audit Plan

对比 API.md 契约，对后端 10 个路由模块逐接口审计。

## 子任务

- [ ] 1. 审计 items.js — 账单接口（5 个 + 联动）
- [ ] 2. 审计 categories.js — 分类接口（2 个）
- [ ] 3. 审计 company.js — 公司接口（3 个 + 申请/退出/解散）
- [ ] 4. 审计 audit.js — 审核接口（3 个）
- [ ] 5. 审计 notify.js — 通知接口（2 个）
- [ ] 6. 审计 feedback.js — 反馈接口（2 个）
- [ ] 7. 审计 auth.js — 认证接口（7 个：验证码/手机登录/微信登录/登出/用户信息CRU）
- [ ] 8. 审计 settings.js — 设置接口（3 个 + /all）
- [ ] 9. 审计 overview.js — 简览卡片接口（2 个）
- [ ] 10. 审计 migrate.js — 迁移接口（1 个）
- [ ] 11. 审计 db.js — 表结构是否完整覆盖 API.md 数据模型
- [ ] 12. 审计 auth.js 中间件 — JWT 校验是否正确
- [ ] 13. 运行时测试 — 启动后端，curl 验证全部 30 个接口
