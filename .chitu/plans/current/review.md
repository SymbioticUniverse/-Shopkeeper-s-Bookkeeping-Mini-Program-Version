# 自审 — VIP 路由模块

## 检查项

### 1. `backend/src/routes/vip.js` — 新建
- **GET /status**: requireAuth ✅ → 读 vip_subscriptions + usage_counters → 过期自动回退免费 ✅
- **POST /subscribe**: requireAuth ✅ → planId 校验 ✅ → 增量续期（从到期日计算，不重复叠加）✅ → upsert ✅
- **POST /activate-trial**: requireAuth ✅ → 一次性限制（existing 已存在则拒绝）✅ → 90 天 vipLevel=2 ✅
- **POST /usage**: requireAuth ✅ → type 白名单校验 ✅ → 按天重置（reset_date 对比）✅ → upsert ✅
- **PLANS 定义**: planId 0/1/2 → vipLevel 1/2/3 ✅
- **getLimits**: free(5/3/2) → PRO(50/20/-1) → enterprise(-1/-1/-1) ✅

### 2. `backend/src/db.js` — 新增表
- **vip_subscriptions**: user_id PK, vip_level ≥0 CHECK, expires_at, is_trial, ON DELETE CASCADE ✅
- **usage_counters**: (user_id,type) PK, count, reset_date, ON DELETE CASCADE ✅

### 3. `backend/src/app.js` — 路由注册
- `/api/vip` 挂载位置正确（learn 路由之后）✅
- require 路径正确 ✅

### 4. 边缘情况
- 无订阅记录 → vipLevel=0, 返回免费限额 ✅
- 已过期 VIP → 回退为免费 ✅
- 已试用再激活 → ok:false ✅
- 已付费再激活 → ok:false ✅
- 无效 type → 400 ✅
- 跨天用量 → reset_date 检查自重置 ✅

## 结论
全部通过，无问题。
