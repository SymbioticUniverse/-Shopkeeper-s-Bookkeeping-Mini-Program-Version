# 自检报告 — 提交未提交的前端变更（iter086 补提交）

## 背景
iter085 提交了后端 3 文件（db.js, auth.js, upload.js）。iter086 仅提交了 review.md，前端 5 文件（mingxi.js, mingxi.wxml, mingxi.wxss, api.js, API.md）的变更留在了工作区未提交。本次补提交这些前端变更。

## 变更文件

| 文件 | 变更内容 |
|------|----------|
| `pages/mingxi/mingxi.js` | 删除 _isFreshUser/_maybeProfileSetup 死代码；onChooseAvatar 重构为 compressImage + _uploadAvatar；onProfileSave 调用 _syncOverviewCards(true) 跳过 canvas；_syncOverviewCards 支持 skipCharts 参数；4 处登录路径 syncFromCloud 后补充 _syncOverviewCards + _refreshAvatarDisplay |
| `pages/mingxi/mingxi.wxml` | 资料弹窗重设计：新增 subtitle、头像角标 badge、field-head + 字数计数、placeholder-class |
| `pages/mingxi/mingxi.wxss` | 资料弹窗 CSS 重设计（尺寸/圆角/间距/暗色适配），新增 profile-avatar-badge、profile-field、profile-field-head/label/count、profile-name-ph 样式 |
| `utils/api.js` | saveUserInfo 自动打 updatedAt 毫秒戳；syncFromCloud last-write-wins 安全降级；uploadVoucher 支持 type='avatar' 参数 |
| `API.md` | 新增 7.3（公司角色持久化）、7.4（头像单份存储）、7.5（用户资料时间戳） |

## 逐项检查

### mingxi.js
- ✅ _isFreshUser / _maybeProfileSetup 死代码已删除（登录响应已带回 isNew/isNewUser）
- ✅ onChooseAvatar：压缩先行（400w/quality80/3s 超时兜底），格式校验仅保留 jpg/png
- ✅ _uploadAvatar 独立方法：Promise 风格 .then/.catch，type='avatar' 传给 uploadVoucher
- ✅ onProfileSave：_syncOverviewCards(true) 跳过 canvas 重绘
- ✅ _syncOverviewCards(skipCharts)：skipCharts 时跳过 _initOverviewCharts
- ✅ 4 处登录路径 (onLoginByPhone, onWxLogin, onGuidePhoneLogin, onGuideWxLogin) syncFromCloud 后统一刷新简览+头像

### mingxi.wxml
- ✅ subtitle 行新增，class 有 dark 配套
- ✅ 头像角标 badge（profile-avatar-badge）
- ✅ field-head（label + 字数计数）
- ✅ placeholder-class="profile-name-ph" 暗色适配
- ✅ 无未使用 class

### mingxi.wxss
- ✅ 所有新增 class 有 dark 对应样式
- ✅ 无越界 rpx
- ✅ badge 使用 absolute 定位 + green 背景 + white border

### utils/api.js
- ✅ saveUserInfo：updatedAt 逻辑正确（调用方已带则沿用，否则 Date.now()）
- ✅ syncFromCloud userInfo：安全降级 — remoteTs>0 且 localTs>remoteTs 时保留本地并反推；否则云端权威
- ✅ uploadVoucher：type='avatar' 时加 ?type=avatar query，旧调用（无 type）走普通凭证兼容

### API.md
- ✅ 7.3/7.4/7.5 文档完整

### 边界情况

| 场景 | 预期 | 实际 |
|------|------|------|
| syncFromCloud 后端不返回 updatedAt | 云端权威覆盖 | ✅ remoteTs=0，不进入 if |
| syncFromCloud 本地无 userInfo | 云端覆盖 | ✅ localTs=0 |
| compressImage 不回调 | 3s 后用原图 | ✅ setTimeout 兜底 |
| uploadVoucher 旧调用（无 type） | query 为空，后端走普通凭证 | ✅ |
| profile 弹窗保存 | 不重绘 canvas | ✅ skipCharts=true |
| 暗色模式资料弹窗 | 所有元素有 dark 样式 | ✅ 逐项核对 |

## 结论

所有前端变更与 review.md 描述一致，边界情况覆盖完整，无已知缺陷。可提交。
