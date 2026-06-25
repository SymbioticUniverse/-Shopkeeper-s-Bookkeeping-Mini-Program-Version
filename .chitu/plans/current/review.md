# 自审 — VIP 前端改造

## 变更文件

### 1. `utils/api.js` — 新增 VIP 6 函数 + 用量配额
- `getVipStatus()`: GET /vip/status → 缓存本地 ✅
- `subscribeVip(planId)`: POST /vip/subscribe → 异步刷新 ✅
- `activateTrial()`: POST /vip/activate-trial → 异步刷新 ✅
- `checkUsage(type)`: 同步读本地缓存，白名单 type ✅
- `isVip()`: 同步读本地缓存，布尔判定 ✅
- `getVipLevel()`: 同步读本地缓存 ✅
- `incrementUsage(type)`: POST /vip/usage + 乐观更新本地 ✅
- `asrRecognize`: 前置 checkUsage('asr')，超限返回 Promise.reject ✅
- `ocrParse`: 前置 checkUsage('ocr')，超限返回 Promise.reject ✅
- 6 个新函数已加入 module.exports ✅

### 2. `pages/mingxi/mingxi.js` — VIP 页面改造
- **vipCards**: 8 档 → 3 档（personal PRO id=1 / enterprise PRO id=2 / custom id=3）✅
- **vipStatus/trialOfferDays/vipTrialDays/showTrialBanner** data 字段新增 ✅
- **onVipEntry**: 拉取 VIP 状态→计算试用剩余天数→显示页面 ✅
- **onActivateTrial**: modal 确认→activateTrial→刷新状态 ✅
- **onVipSelect**: index 切换选中/取消 ✅
- **onVipSeatsMinus/Plus**: 4-20 范围限制 ✅
- **_calcEnterprisePrice**: 阶梯计价 + 年费 8.8 折 ✅
- **onVipConfirm**: 套餐校验→企业版动态价格确认→subscribeVip ✅
- **_computeTrialDays**: 从 vipExpiresAt 计算剩余天数，负数→0 ✅
- **onExportPersonal/onExportCompany**: checkUsage('export') 前置+incrementUsage 后置 ✅
- **_canUseProSummary**: 从 `return true` 改为 `api.isVip()` ✅
- 冷启动 / 手机登录 / 微信登录后均调用 getVipStatus 刷新 ✅

### 3. `pages/mingxi/mingxi.wxml` — VIP UI 重新设计
- 试用激活横幅：新用户限时福利 + 天数倒计时 + 立即领取 ✅
- 三卡垂直排列：personal/enterprise/custom，每卡有主题色左边框 ✅
- 企业版席位选择器：± 按钮 4-20 范围 ✅
- 动态价格显示：月付/年费 + 8.8折徽章 ✅
- 我的 Tab VIP 入口：PRO 徽章 + 到期信息 + 用量统计 ✅
- 底部确认按钮：仅非联系套餐、已选中时显示 ✅

### 4. `pages/mingxi/mingxi.wxss` — 对应样式
- 试用横幅：深色背景 + 金色标题 + 大号倒计时 ✅
- 套餐卡：白色卡片 + 主题色左边框 + 选中态浮起 ✅
- 席位选择器：± 圆形按钮 + 禁用态透明 ✅
- 我的 Tab VIP 入口：金色渐变背景 + PRO 角标 + 到期天数 ✅
- 修复: CSS 重复块已去重（.my-item--vip-* 组只保留一份）✅

## 边缘情况
- 未拉取 VIP 状态时 checkUsage 返回 allowed:true（容错放行）✅
- vipStatus 为 null 时 isVip 返回 false ✅
- trialOfferDays 负数→0 ✅
- 企业版 <10 人显示月付，>10 人仅年费 ✅
- 席位 min/max 按钮防越界 ✅
- onVipBack 兼容旧 vipDetailId 逻辑（永远 -1，直接关页）✅
- getVipStatus 失败时 .catch 静默处理不阻塞 UI ✅

## 已知限制
- subscribeVip 仅传 planId，body 中的 seats/amount/isAnnual 暂未发送后端（后端尚未支持）
- 导出两次快速点击可能有本地缓存竞态（后端 checkUsage 兜底）

## 结论
全部通过，无阻塞问题。
