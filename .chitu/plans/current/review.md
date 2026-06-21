# Self-Review — API.md 7.3：login 响应带回 hasCompany/companyRole

## 改动文件
- `backend/src/routes/auth.js` — 两个 login 路由 +company_members 查询
- `utils/api.js` — loginByPhone/loginByWechat 返回 isNew/hasCompany/companyRole
- `pages/mingxi/mingxi.js` — 4 个登录回调用 isNew 替代 _maybeProfileSetup，引导流程用 hasCompany 跳过身份引导

## 逐文件自检

### backend/src/routes/auth.js ✅
- `login-by-phone`（~106行）: `SELECT cm.role FROM company_members cm WHERE cm.user_id = ? AND cm.status = 'approved'` — 只查已通过的成员关系，逻辑正确
- `login-by-wechat`（~213行）: 同样的查询，在 token 生成前完成 — 不影响原有流程
- 两者均在 `expires_at` 后返回 `hasCompany`/`companyRole` — 字段位置合理

### utils/api.js ✅
- `loginByPhone`: 返回 `{...userInfo, isNew, hasCompany, companyRole}`，fallback 到 `|| false` / `|| null`
- `loginByWechat`: 同样处理
- JSDoc 已更新返回类型

### pages/mingxi/mingxi.js ✅
- `onPhoneLogin`: 用 `result.isNew` 替代 `this._maybeProfileSetup(userInfo)`，消除了脱敏手机号启发式误判
- `onWxLogin`: 同上
- `onGuidePhoneLogin`: 用 `result.isNew` + `result.hasCompany`，有公司直接 `onGuideComplete()`，新用户/无公司进 guideStep 2
- `onGuideWxLogin`: 同上
- `_maybeProfileSetup` / `_isFreshUser` 不再被调用（dead code，保留无害，后续可清理）

### 安全性
- hasCompany/companyRole 来自服务端公司成员表查询，不信任客户端输入 ✅
- 修改不改变 token 生成/验证逻辑 ✅
