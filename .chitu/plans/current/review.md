# Self-Review — 资料弹窗改造：profileEditMode 区分新用户引导/编辑 + 防秒关

## 修改文件
- `pages/mingxi/mingxi.js`: 新增 `profileEditMode` data + `onProfileMaskTap()` + 4 处登录路径显式设 `profileEditMode: false`
- `pages/mingxi/mingxi.wxml`: 弹窗标题/副标题/按钮动态文案 + nickname 改为打开编辑弹窗 + mask 使用 debounce handler
- `pages/mingxi/mingxi.wxss`: 按钮样式刷新 + :active 态 + 暗色适配

## 逐项核查

### mingxi.js
- ✅ `profileEditMode: false` 默认值，data 初始化正确
- ✅ `onMyAvatarTap()`: 先设 `_profileOpenAt` 再 setData，防时序竞争
- ✅ 5 处 `showProfileModal: true` 全部显式设 `profileEditMode`（1 处 true + 4 处 false），无遗漏
- ✅ `onProfileMaskTap()`: `<350ms` 防穿透秒关，`_profileOpenAt` 未定义时 `Date.now() - 0` 远大于 350，安全
- ✅ `onProfileSave()`: 未受影响，逻辑不变

### mingxi.wxml
- ✅ `profileName.length` 替代 `(profileName || '').length`：`profileName` 初始化 `''`，input 绑定始终返回 string，安全
- ✅ nickname `bindtap` 改为 `onMyAvatarTap`（不再直接登出），符合预期
- ✅ mask `catchtap` 改为 `onProfileMaskTap`，modal 内部 `catchtap="nop"` 阻止冒泡关闭
- ✅ 三元表达式 `{{profileEditMode ? '编辑资料' : '完善资料'}}` 正确

### mingxi.wxss
- ✅ `.profile-btn--skip` 新增 border + 浅色 bg，可读性更好
- ✅ `:active` 伪类（skip/save）仅反馈态，不影响核心交互
- ✅ 暗色模式 `.page--dark .profile-btn--skip` 与 `:active` 暗色对应完整

### 边界情况
- ✅ 快速连点头像 → `_profileOpenAt` 被刷新，debounce 延长 → 防秒关，行为正确
- ✅ 新用户跳过 → 旧 `onProfileSkip()` 仍正常工作（关闭弹窗）
- ✅ 老用户点击昵称 → 进入编辑模式，标题「编辑资料」、按钮「取消/完成」— 与引导模式区分清晰
