# 接口文档 — 记账小程序

> 前端通过 `utils/api.js` 调用以下接口，后端接手后替换实现即可，前端零改动。
> 当前实现：`wx.getStorageSync / setStorageSync`（本地存储）
> 目标实现：`wx.request`（云端 API）

---

## 一、数据模型

### 1.1 账单记录 (Item)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `number` | 是 | 时间戳，唯一标识 |
| `category` | `string` | 是 | 分类名称，如 `'餐饮'`、`'采购'` |
| `type` | `string` | 是 | 二元类型：`'in'`（收入方向）/ `'out'`（支出方向） |
| `typeLabel` | `string` | 是 | 显示标签：`'收入'` / `'支出'` / `'垫付'` / `'应付'` |
| `scope` | `string` | 是 | 所属账本：`'personal'` / `'company'` |
| `amount` | `string` | 是 | 金额，保留两位小数，如 `'10.00'` |
| `date` | `string` | 是 | 日期，格式 `'YYYY-MM-DD'` |
| `note` | `string` | 否 | 备注，默认 `''` |
| `target` | `string` | 否 | 目标对象名称，如 `'公司'`、`'个人'`、`'外部'`、自定义名称 |
| `targetType` | `string` | 否 | 目标对象类型：`'internal'`（内部，触发联动）/ `'external'`（外部） |
| `linkedId` | `number` | 否 | 联动账单的 id（垫付/应付 内部对象时产生） |
| `voucher` | `string` | 否 | 凭证图片 URL（扫描凭证记账时产生），默认 `''`。须为后端返回的可跨端访问 URL，**不可存本地路径** |
| `_voided` | `boolean` | 否 | 是否已作废，默认 `false` |

**type 与 typeLabel 映射关系：**

| 业务类型 | `type` | `typeLabel` |
|----------|--------|-------------|
| 收入 | `'in'` | `'收入'` |
| 支出 | `'out'` | `'支出'` |
| 垫付 | `'in'` | `'垫付'` |
| 应付 | `'out'` | `'应付'` |

**联动规则（垫付/应付 + 内部对象）：**

当 `targetType === 'internal'` 且 `typeLabel` 为垫付或应付时，需同时在对面 scope 创建一条镜像账单：

| 原始 scope | 原始 typeLabel | 镜像 scope | 镜像 typeLabel | 镜像 target |
|------------|---------------|------------|---------------|-------------|
| personal | 垫付 | company | 应付 | `'个人'` |
| personal | 应付 | company | 垫付 | `'个人'` |
| company | 垫付 | personal | 应付 | `'公司'` |
| company | 应付 | personal | 垫付 | `'公司'` |

两条记录通过 `linkedId` 互相关联。

### 1.2 分类 (Category)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 格式 `'p_1'`（个人）/ `'c_1'`（公司），递增 |
| `name` | `string` | 是 | 分类名称，如 `'餐饮'`、`'采购'` |
| `emoji` | `string` | 是 | 分类图标 emoji，如 `'🍽'` |
| `inOut` | `string` | 是 | 收支方向：`'in'` / `'out'` |

### 1.3 公司信息 (CompanyInfo)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `companyUid` | `string` | 是 | 公司唯一码，如 `'UIDABC12345'` |
| `companyName` | `string` | 否 | 公司名称（boss 创建时填写） |
| `companyBossTitle` | `string` | 否 | 老板头衔，默认 `'BOSS'` |
| `companyRole` | `string` | 是 | 用户角色：`'boss'`（老板）/ `'employee'`（员工） |

### 1.4 审核记录 (AuditItem)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `number` | 是 | 唯一标识 |
| `status` | `string` | 是 | 状态：`'pending'` / `'approved'` / `'rejected'` |
| _(其他字段由业务扩展)_ | | | |

### 1.5 通知记录 (NotifyItem)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `number` | 是 | 时间戳标识 |
| `text` | `string` | 是 | 通知内容 |
| `time` | `string` | 是 | 时间字符串 |
| `read` | `boolean` | 是 | 是否已读 |

### 1.6 反馈记录 (FeedbackItem)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `number` | 是 | 时间戳标识 |
| `text` | `string` | 是 | 反馈内容 |
| `time` | `string` | 是 | 提交时间 |

### 1.7 用户信息 (UserInfo)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `nickName` | `string` | 是 | 昵称（手机登录时脱敏显示） |
| `avatarUrl` | `string` | 否 | 头像 URL |

### 1.8 简览卡片 (OverviewCard)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 唯一标识，如 `'c_1686000000'` |
| `templateId` | `string` | 否 | 对应模版 ID |
| `name` | `string` | 是 | 卡片名称 |
| `subtitle` | `string` | 否 | 副标题 |
| `type` | `string` | 是 | 卡片类型，如 `'overview_personal'`、`'overview_company'` |
| `span` | `number` | 是 | 占据列数：`1` 或 `2` |
| `x` | `number` | 否 | 水平位置坐标 |
| `y` | `number` | 否 | 垂直位置坐标 |

---

## 二、接口清单

### 2.1 账单 (Items)

#### `getItems(scope)`

获取指定 scope 的全部账单列表。

| 参数 | 类型 | 说明 |
|------|------|------|
| `scope` | `string` | `'personal'` / `'company'` |

**返回值：** `Item[]`，按时间倒序排列。无数据时返回 `[]`。

---

#### `addItem(scope, item)`

新增一条账单记录（插入到列表头部）。

| 参数 | 类型 | 说明 |
|------|------|------|
| `scope` | `string` | `'personal'` / `'company'` |
| `item` | `Item` | 完整的账单对象 |

**返回值：** `Item` — 传入的 item 对象。

---

#### `updateItem(id, data)`

按 id 更新账单记录的部分字段。自动查找 item 所在 scope。

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | `number` | 账单 id |
| `data` | `object` | 要合并更新的字段，如 `{ typeLabel: '收入' }` 或 `{ _voided: true }` |

**前端调用场景：**

| 场景 | data 示例 |
|------|-----------|
| 编辑账单 | `{ category, amount, note }` |
| 结清（垫付/应付→普通收支） | `{ typeLabel: '收入' }` 或 `{ typeLabel: '支出' }` |
| 作废 | `{ _voided: true }` |
| 取消作废 | `{ _voided: false }` |

---

#### `removeItem(id)`

按 id 删除账单记录。自动查找 item 所在 scope。

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | `number` | 账单 id |

---

#### `addLinkedItems(scope, item, mirrorScope, mirrorItem)`

同时新增两条互相关联的账单（垫付/应付联动）。两条记录通过 `linkedId` 互相引用。

| 参数 | 类型 | 说明 |
|------|------|------|
| `scope` | `string` | 主账单所属 scope |
| `item` | `Item` | 主账单对象（已设置 `linkedId`） |
| `mirrorScope` | `string` | 镜像账单所属 scope |
| `mirrorItem` | `Item` | 镜像账单对象（已设置 `linkedId`） |

---

### 2.2 分类 (Categories)

#### `getCategories(scope)`

获取指定 scope 的自定义分类列表。

| 参数 | 类型 | 说明 |
|------|------|------|
| `scope` | `string` | `'personal'` / `'company'` |

**返回值：** `Category[] | null`。未自定义过时返回 `null`，前端使用内置默认分类。

---

#### `saveCategories(scope, list)`

保存指定 scope 的分类列表（整体覆盖）。

| 参数 | 类型 | 说明 |
|------|------|------|
| `scope` | `string` | `'personal'` / `'company'` |
| `list` | `Category[]` | 完整分类列表 |

---

### 2.3 公司信息 (CompanyInfo)

#### `getCompanyInfo()`

获取当前用户绑定的公司信息。

**返回值：** `CompanyInfo | null`

---

#### `saveCompanyInfo(info)`

保存公司信息（创建公司 / 加入公司）。

| 参数 | 类型 | 说明 |
|------|------|------|
| `info` | `CompanyInfo` | 公司信息对象 |

**调用场景：**
- 老板创建公司：`{ companyUid, companyName, companyBossTitle, companyRole: 'boss' }`
- 员工加入公司：`{ companyUid, companyRole: 'employee' }`

---

#### `removeCompanyInfo()`

清除公司信息（重新选择公司 / 解散公司）。

---

### 2.4 审核 (Audit)

#### `getAuditList()`

获取审核列表。

**返回值：** `AuditItem[]`

---

#### `saveAuditList(list)`

保存审核列表（整体覆盖）。

| 参数 | 类型 | 说明 |
|------|------|------|
| `list` | `AuditItem[]` | 完整审核列表 |

---

#### `removeAuditList()`

清空审核列表。

---

### 2.5 通知 (Notify)

#### `getNotifyList()`

获取通知列表。

**返回值：** `NotifyItem[]`

---

#### `saveNotifyList(list)`

保存通知列表（整体覆盖）。

| 参数 | 类型 | 说明 |
|------|------|------|
| `list` | `NotifyItem[]` | 完整通知列表 |

---

### 2.6 反馈 (Feedback)

#### `getFeedbackList()`

获取用户反馈列表。

**返回值：** `FeedbackItem[]`

---

#### `saveFeedbackList(list)`

保存反馈列表（整体覆盖）。

| 参数 | 类型 | 说明 |
|------|------|------|
| `list` | `FeedbackItem[]` | 完整反馈列表 |

---

### 2.7 认证 (Auth)

#### `sendVerifyCode(phone)`

发送短信验证码。

| 参数 | 类型 | 说明 |
|------|------|------|
| `phone` | `string` | 手机号，格式 `1[3-9]xxxxxxxxx` |

**返回值：** `{ success: boolean }`

---

#### `loginByPhone(phone, code)`

手机号 + 验证码登录。验证通过后返回用户信息。

| 参数 | 类型 | 说明 |
|------|------|------|
| `phone` | `string` | 手机号 |
| `code` | `string` | 6 位短信验证码 |

**返回值：** `UserInfo` — 登录成功返回用户信息（含 nickName、avatarUrl 等）。

---

#### `loginByWechat(wxUserInfo)`

微信授权登录。前端通过微信 SDK 获取用户信息后传入。

| 参数 | 类型 | 说明 |
|------|------|------|
| `wxUserInfo` | `object` | 微信 SDK 返回的用户信息（nickName, avatarUrl 等） |

**返回值：** `UserInfo` — 登录成功返回用户信息。

---

#### `logout()`

退出登录，注销会话 / 清除 token。

---

### 2.8 用户 (User)

#### `getUserInfo()`

获取当前登录用户信息。

**返回值：** `UserInfo | null`

---

#### `saveUserInfo(info)`

保存用户信息（登录成功后）。

| 参数 | 类型 | 说明 |
|------|------|------|
| `info` | `UserInfo` | 用户信息对象 |

---

#### `removeUserInfo()`

清除用户信息（退出登录）。

---

### 2.9 设置 (Settings)

#### `getSetting(key)`

读取设置项。

| 参数 | 类型 | 说明 |
|------|------|------|
| `key` | `string` | 设置键名 |

**当前使用的 key：**

| key | 值类型 | 说明 | 可选值 |
|-----|--------|------|--------|
| `appLanguage` | `string` | 界面语言 | `'zh-CN'` / `'zh-TW'` / `'ja-JP'` / `'en-US'` |
| `appDarkMode` | `string` | 深色模式 | `'system'` / `'light'` / `'dark'` |
| `privacy_allowAnalytics` | `boolean` | 允许数据分析 | `true` / `false` |
| `privacy_allowCrashReport` | `boolean` | 允许崩溃报告 | `true` / `false` |
| `auditCleaned` | `boolean` | 审核列表已清理（一次性标记） | `true` |
| `budget_personal` | `number` | 个人账本月度预算（账本页设置；未设 / `0` 表示无预算） | ≥ 0 |
| `budget_company` | `number` | 公司账本月度预算（账本页设置；未设 / `0` 表示无预算） | ≥ 0 |

**返回值：** 对应值，不存在时返回 `undefined`（或 `''`，取决于存储实现）。

---

#### `saveSetting(key, value)`

保存设置项。

| 参数 | 类型 | 说明 |
|------|------|------|
| `key` | `string` | 设置键名 |
| `value` | `any` | 设置值 |

---

#### `removeSetting(key)`

删除设置项。

| 参数 | 类型 | 说明 |
|------|------|------|
| `key` | `string` | 设置键名 |

---

### 2.10 简览卡片 (OverviewCards)

#### `getOverviewCards()`

获取用户自定义的简览页卡片布局。

**返回值：** `OverviewCard[]`，未自定义时返回 `[]`。

---

#### `saveOverviewCards(cards)`

保存简览页卡片布局（整体覆盖）。

| 参数 | 类型 | 说明 |
|------|------|------|
| `cards` | `OverviewCard[]` | 完整卡片列表 |

---

### 2.11 数据迁移 (Migration)

#### `migrate()`

一次性迁移旧数据：将 `detailItems`（单 key 混存）拆分为 `personalItems` + `companyItems`。已迁移则跳过。后端上线后此接口可废弃。

---

### 2.12 凭证上传 (Voucher)

> 与其他接口不同：图片是二进制文件，走 `wx.uploadFile`（multipart）而非 `wx.request`（JSON）。
> 图片**不进数据库**，存对象存储（OSS / COS / 微信云存储），数据库的 `voucher` 字段只存返回的 URL。

#### `uploadVoucher(filePath)`

上传一张凭证图片，返回可跨端访问的 URL。

| 参数 | 类型 | 说明 |
|------|------|------|
| `filePath` | `string` | 微信临时文件路径（`wx.chooseImage` / `wx.chooseMedia` 返回的 `tempFilePath`） |

**返回值：** `Promise<string>` — 解析为图片 URL（如 `'https://cdn.xxx.com/voucher/2026/06/abc.jpg'`）。

**底层请求（后端需实现）：** `POST /api/upload`

`wx.uploadFile` 以 `multipart/form-data` 提交：

| 字段 | 说明 |
|------|------|
| `file`（文件字段名） | 图片二进制 |
| `header.Authorization` | 登录 token（同其他鉴权接口） |

**响应：**
```json
{ "ok": true, "url": "https://cdn.xxx.com/voucher/2026/06/abc.jpg" }
```

**约束：**
- 仅接受图片类型：`jpg` / `jpeg` / `png`
- 单张大小上限：建议 ≤ 5MB（前端已用 `sizeType: ['compressed']` 压缩）
- 须校验登录态，按 `user_id` 归档
- 返回的 URL 须长期有效、可跨设备/跨用户访问（公司账本共享场景）

---

## 三、接口总览

| # | 方法 | 参数 | 返回值 | 说明 |
|---|------|------|--------|------|
| 1 | `getItems(scope)` | scope | `Item[]` | 获取账单列表 |
| 2 | `addItem(scope, item)` | scope, item | `Item` | 新增账单 |
| 3 | `updateItem(id, data)` | id, data | — | 更新账单字段 |
| 4 | `removeItem(id)` | id | — | 删除账单 |
| 5 | `addLinkedItems(scope, item, mirrorScope, mirrorItem)` | 4 个参数 | — | 联动新增两条账单 |
| 6 | `getCategories(scope)` | scope | `Category[] \| null` | 获取分类 |
| 7 | `saveCategories(scope, list)` | scope, list | — | 保存分类 |
| 8 | `getCompanyInfo()` | — | `CompanyInfo \| null` | 获取公司信息 |
| 9 | `saveCompanyInfo(info)` | info | — | 保存公司信息 |
| 10 | `removeCompanyInfo()` | — | — | 清除公司信息 |
| 11 | `getAuditList()` | — | `AuditItem[]` | 获取审核列表 |
| 12 | `saveAuditList(list)` | list | — | 保存审核列表 |
| 13 | `removeAuditList()` | — | — | 清空审核列表 |
| 14 | `getNotifyList()` | — | `NotifyItem[]` | 获取通知列表 |
| 15 | `saveNotifyList(list)` | list | — | 保存通知列表 |
| 16 | `getFeedbackList()` | — | `FeedbackItem[]` | 获取反馈列表 |
| 17 | `saveFeedbackList(list)` | list | — | 保存反馈列表 |
| 18 | `sendVerifyCode(phone)` | phone | `{ success }` | 发送短信验证码 |
| 19 | `loginByPhone(phone, code)` | phone, code | `UserInfo` | 手机号登录 |
| 20 | `loginByWechat(wxUserInfo)` | wxUserInfo | `UserInfo` | 微信授权登录 |
| 21 | `logout()` | — | — | 退出登录 |
| 22 | `getUserInfo()` | — | `UserInfo \| null` | 获取用户信息 |
| 23 | `saveUserInfo(info)` | info | — | 保存用户信息 |
| 24 | `removeUserInfo()` | — | — | 清除用户信息 |
| 25 | `getSetting(key)` | key | `any` | 读取设置 |
| 26 | `saveSetting(key, value)` | key, value | — | 保存设置 |
| 27 | `removeSetting(key)` | key | — | 删除设置 |
| 28 | `getOverviewCards()` | — | `OverviewCard[]` | 获取简览卡片 |
| 29 | `saveOverviewCards(cards)` | cards | — | 保存简览卡片 |
| 30 | `migrate()` | — | — | 旧数据迁移（可废弃） |
| 31 | `uploadVoucher(filePath)` | filePath | `Promise<string>` | 上传凭证图片，返回 URL |

---

## 四、业务逻辑详述

### 4.1 认证体系

**登录方式：**
1. **手机号+验证码登录** — 前端调 `sendVerifyCode(phone)` 发送验证码，用户输入后调 `loginByPhone(phone, code)` 验证登录
2. **微信授权登录** — 前端通过微信 SDK 拿到用户授权信息后，调 `loginByWechat(wxUserInfo)` 完成登录
3. **退出登录** — 调 `logout()` 注销会话

**后端职责：**
- 发送短信验证码（对接短信服务商）
- 验证手机号+验证码的合法性
- 微信 `code` 换取 `openid/session_key`
- 生成并管理用户会话 token
- `getUserInfo()` 需要校验 token 有效性

**前端只做：**
- 手机号格式校验（`/^1[3-9]\d{9}$/`）
- 验证码位数校验（6 位）
- 60 秒发送倒计时（纯 UI）
- 登录状态展示

---

### 4.2 双账本体系

系统维护两套完全独立的账本：

| scope | 名称 | 说明 |
|-------|------|------|
| `personal` | 个人账本 | 个人日常收支、与公司/第三方的垫付应付 |
| `company` | 公司账本 | 公司经营收支、与个人/第三方的垫付应付 |

**核心规则：**
- 两套账本数据完全隔离存储，互不干扰
- 前端通过 `scope` 参数决定读写哪套账本
- 唯一的交叉点是「垫付/应付联动」（见 4.3）

---

### 4.3 记账类型与垫付/应付联动

**四种业务类型：**

| 业务类型 | type (存储) | typeLabel (显示) | 方向 |
|---------|-------------|-----------------|------|
| 收入 | `'in'` | `'收入'` | 正 |
| 支出 | `'out'` | `'支出'` | 负 |
| 垫付 | `'in'` | `'垫付'` | 正（我方先出，对方欠我） |
| 应付 | `'out'` | `'应付'` | 负（我方欠对方） |

**目标对象（target）：**

每笔账单都有目标对象，标识这笔钱的对手方：
- `targetType: 'internal'` — 内部对象（个人↔公司），触发联动
- `targetType: 'external'` — 外部对象（第三方），不联动

**默认目标对象：**

| scope | 业务类型 | 默认 targetType | 默认 target | 说明 |
|-------|----------|----------------|-------------|------|
| personal | 收入 | `internal` | `'公司'` | 个人收入通常来自公司 |
| personal | 垫付 | `internal` | `'公司'` | 个人通常替公司垫付 |
| personal | 支出 | `external` | `''` | 个人消费是外部 |
| personal | 应付 | `external` | `''` | 个人欠款通常是外部 |
| company | 垫付 | `internal` | `'个人'` | 公司通常替个人垫付 |
| company | 收入 | `external` | `''` | 公司收入来自客户等 |
| company | 支出 | `external` | `''` | 公司支出到供应商等 |
| company | 应付 | `external` | `''` | 公司欠款通常是外部 |

**联动规则（重要）：**

当 `targetType === 'internal'` 且 `typeLabel` 为垫付或应付时，调用 `addLinkedItems()` 同时在对面 scope 创建一条镜像账单。

**示例场景：** 个人替公司垫付 100 元餐费

```
主账单（personalItems）:
  { id: 1001, scope: 'personal', typeLabel: '垫付', amount: '100.00',
    target: '公司', targetType: 'internal', linkedId: 1002 }

镜像账单（companyItems，自动生成）:
  { id: 1002, scope: 'company', typeLabel: '应付', amount: '100.00',
    target: '个人', targetType: 'internal', linkedId: 1001 }
```

两条记录通过 `linkedId` 双向关联。

---

### 4.4 结清

将垫付/应付账单的 `typeLabel` 改为普通的收入/支出，表示双方已结算完毕。

- 垫付（`type: 'in'`） → 结清后 `typeLabel` 改为 `'收入'`
- 应付（`type: 'out'`） → 结清后 `typeLabel` 改为 `'支出'`

调用 `updateItem(id, { typeLabel: '收入' })` 或 `updateItem(id, { typeLabel: '支出' })`。

> 注意：结清只改当前这一条，不联动对面镜像账单。

---

### 4.5 作废与恢复

- **作废**：`updateItem(id, { _voided: true })` — 标记账单作废，保留记录不删除
- **恢复**：`updateItem(id, { _voided: false })` — 取消作废，恢复正常
- **删除**：`removeItem(id)` — 彻底删除

---

### 4.6 自定义分类

- 每个 scope 有独立的分类列表（`personalCategories` / `companyCategories`）
- 分类分为收入类（`inOut: 'in'`）和支出类（`inOut: 'out'`）
- 前端内置默认分类（个人 36 个、公司 16 个），用户可以增删
- 调 `saveCategories(scope, list)` 保存整个分类列表（整体覆盖）
- `getCategories(scope)` 返回 `null` 时前端使用内置默认分类

---

### 4.7 公司管理

**两种角色：**

| 角色 | companyRole | 能力 |
|------|-------------|------|
| 老板 | `'boss'` | 创建公司、生成 UID、邀请员工、审核、解散 |
| 员工 | `'employee'` | 输入 UID 加入公司、退出公司 |

**流程：**

1. **老板创建公司**：填写公司名称 → 生成 UID → `saveCompanyInfo({ companyUid, companyName, companyBossTitle, companyRole: 'boss' })`
2. **员工加入公司**：输入公司 UID → `saveCompanyInfo({ companyUid, companyRole: 'employee' })` → 提交审核
3. **老板审核**：`getAuditList()` 查看待审核 → 通过/拒绝 → `saveAuditList(updatedList)`
4. **审核通过时**：自动创建一条通知 → `saveNotifyList(updatedList)`
5. **重新选择公司**：`removeCompanyInfo()` → 重新走加入流程
6. **解散公司**：`removeCompanyInfo()` + `removeAuditList()` → 所有人失去公司账本权限

---

### 4.8 通知系统

- 通知列表支持已读/未读标记
- 审核通过时后端应自动生成通知
- 前端顶部角标显示是否有未读通知
- 通知支持左滑删除

---

### 4.9 设置与偏好

所有设置通过 `getSetting(key)` / `saveSetting(key, value)` 读写。

| key | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| `appLanguage` | `string` | `'zh-CN'` | 界面语言：zh-CN / zh-TW / ja-JP / en-US |
| `appDarkMode` | `string` | `'system'` | 深色模式：system / light / dark |
| `privacy_allowAnalytics` | `boolean` | `true` | 允许数据分析 |
| `privacy_allowCrashReport` | `boolean` | `true` | 允许崩溃报告 |
| `auditCleaned` | `boolean` | — | 审核列表清理标记（一次性） |
| `budget_personal` | `number` | — | 个人账本月度预算（账本页「月度预算」设置） |
| `budget_company` | `number` | — | 公司账本月度预算（账本页「月度预算」设置） |

---

### 4.10 简览卡片

- 用户可在简览页自定义展示哪些卡片（个人账本、公司账本等）
- 卡片有 `span` 属性控制宽度（1 列 / 2 列）
- 布局通过 `x` / `y` 坐标定位
- `getOverviewCards()` 返回 `[]` 时前端使用默认布局

---

### 4.11 扫描凭证记账与图片存储

用户在拓展菜单点「扫描凭证记账」→ 拍照 → 识别 → 自动填充金额/分类 → 确认保存。凭证图片随账单一起留存，详情页可回看。

**完整流程：**

```
1. wx.chooseImage(camera) → 拿到临时路径 tempFilePath
2. （识别）当前为前端模拟，后期替换为真实 OCR
3. url = await api.uploadVoucher(tempFilePath)   ← 上传，拿到跨端 URL
4. api.addItem(scope, { ...item, voucher: url }) ← URL 存进账单
5. 详情页 <image src="{{item.voucher}}"> 直接展示
```

**为什么图片必须走后端：**

| 方案 | 结果 |
|------|------|
| 本地 `saveFileSync`（返回 `wxfile://` 路径） | ❌ 路径仅本设备本用户有效；换设备/重装/公司账本共享给他人 → 图裂；本地存储 10MB 上限 |
| 后端上传 → 对象存储 → 返回 https URL | ✅ 跨设备、跨用户、长期可访问 |

> 前端骨架阶段临时用本地路径占位；后端上传接口就绪后，`utils/api.js` 内把 `saveFileSync` 替换为 `uploadVoucher` 即可，页面层零改动。

**`voucher` 字段贯穿：**
- `addItem` / `addLinkedItems`：写入时携带 `voucher`（镜像账单可不带）
- `getItems`：返回须包含 `voucher`
- `updateItem`：编辑账单时 `voucher` 字段保持不变（合并更新，不覆盖）

---

## 五、后端任务清单

### 任务 1：用户认证系统

**优先级：最高**

| 接口 | 后端工作 |
|------|---------|
| `sendVerifyCode(phone)` | 对接短信服务商（阿里云/腾讯云短信），生成验证码，存 Redis 设过期时间（5 分钟），发送短信 |
| `loginByPhone(phone, code)` | 校验验证码，查找或创建用户记录，生成 session token，返回 UserInfo |
| `loginByWechat(wxUserInfo)` | 前端传入微信 `code`，调微信 `code2Session` 接口换取 `openid`，查找或创建用户，生成 token，返回 UserInfo |
| `logout()` | 注销 token / 清除服务端会话 |
| `getUserInfo()` | 校验 token → 返回当前用户信息 |

**数据表设计建议：**
```
users: { id, phone, openid, nickName, avatarUrl, created_at, updated_at }
sessions: { token, user_id, expires_at }
verify_codes: { phone, code, expires_at }
```

---

### 任务 2：账单 CRUD + 联动

**优先级：最高**

| 接口 | 后端工作 |
|------|---------|
| `getItems(scope)` | 按 user_id + scope 查询，按创建时间倒序返回 |
| `addItem(scope, item)` | 写入一条账单记录 |
| `updateItem(id, data)` | 按 id 更新指定字段（合并更新，非整体覆盖） |
| `removeItem(id)` | 按 id 删除 |
| `addLinkedItems(...)` | **事务操作**：同时写入两条账单，设置互相的 `linkedId`，任一失败则回滚 |

**关键点：**
- `addLinkedItems` 必须保证原子性（事务/两阶段写入）
- `updateItem` 要自动找到 item 所在的 scope（或前端传入）
- `removeItem` 同理需要跨 scope 查找

**数据表设计建议：**
```
items: { id, user_id, scope, category, type, typeLabel, amount, date, note,
         target, targetType, linkedId, voucher, _voided, created_at }
```

---

### 任务 3：分类管理

**优先级：中**

| 接口 | 后端工作 |
|------|---------|
| `getCategories(scope)` | 按 user_id + scope 查询，无自定义数据时返回 null |
| `saveCategories(scope, list)` | 整体覆盖保存（删除旧数据 → 写入新列表） |

**数据表设计建议：**
```
categories: { id, user_id, scope, name, emoji, inOut, sort_order }
```

---

### 任务 4：公司管理

**优先级：中**

| 接口 | 后端工作 |
|------|---------|
| `saveCompanyInfo(info)` | 创建或更新公司绑定关系；boss 创建时生成公司记录，employee 加入时创建审核申请 |
| `getCompanyInfo()` | 查询当前用户的公司绑定状态和角色 |
| `removeCompanyInfo()` | 解除用户与公司的绑定关系 |

**关键点：**
- 公司 UID 需全局唯一
- 员工加入时应自动提交审核申请给 boss
- 解散公司时需清理所有员工的绑定关系

**数据表设计建议：**
```
companies: { id, uid, name, boss_title, boss_user_id, created_at }
company_members: { id, company_id, user_id, role, status, joined_at }
```

---

### 任务 5：审核系统

**优先级：中**

| 接口 | 后端工作 |
|------|---------|
| `getAuditList()` | 查询当前用户（boss）公司的待审核/已处理申请 |
| `saveAuditList(list)` | 更新审核状态 |
| `removeAuditList()` | 清空审核记录 |

**关键点：**
- 审核通过时，后端应自动：1）将员工状态改为已通过 2）为该员工创建一条通知
- 审核拒绝时，更新状态即可

---

### 任务 6：通知系统

**优先级：中**

| 接口 | 后端工作 |
|------|---------|
| `getNotifyList()` | 按 user_id 查询，按时间倒序 |
| `saveNotifyList(list)` | 整体覆盖保存（含已读状态更新） |

**关键点：**
- 审核通过等业务事件应由后端自动生成通知，而非前端手动插入
- 后续可扩展推送能力（微信模板消息等）

---

### 任务 7：反馈系统

**优先级：低**

| 接口 | 后端工作 |
|------|---------|
| `getFeedbackList()` | 查询当前用户提交的反馈 |
| `saveFeedbackList(list)` | 保存反馈记录 |

---

### 任务 8：设置存储

**优先级：低**

| 接口 | 后端工作 |
|------|---------|
| `getSetting(key)` | 按 user_id + key 查询 |
| `saveSetting(key, value)` | 按 user_id + key 写入 |
| `removeSetting(key)` | 按 user_id + key 删除 |

**数据表设计建议：**
```
user_settings: { user_id, key, value, updated_at }
```

**月度预算（`budget_personal` / `budget_company`）：**
- 账本页「月度预算」走通用设置接口落库，**无需新增专用端点**，复用 `saveSetting` / `getSetting` 即可
- `value` 为数值（月度预算金额，单位元），按 `user_id + key` 唯一存储；未设置时 `getSetting` 返回空，前端按「未设预算」处理
- `company` 维度的预算归属公司 boss 本人（与其他个人设置一致，按 user_id 存），员工不读写
- 后端如对 `value` 做类型规整，请保留数值精度（前端以 `parseFloat` 读取）

---

### 任务 9：简览卡片布局

**优先级：低**

| 接口 | 后端工作 |
|------|---------|
| `getOverviewCards()` | 按 user_id 查询自定义布局 |
| `saveOverviewCards(cards)` | 整体覆盖保存 |

---

### 任务 10：凭证图片上传与存储

**优先级：中**（扫描凭证记账功能依赖；接口未就绪前前端用本地路径占位）

| 接口 | 后端工作 |
|------|---------|
| `uploadVoucher(filePath)` → `POST /api/upload` | 接收 multipart 图片 → 校验类型/大小 → 存对象存储 → 返回可访问 URL |

**关键点：**
- 用对象存储（阿里云 OSS / 腾讯云 COS / 微信云存储），**不要把图片塞进数据库**，库里 `items.voucher` 只存 URL
- 校验登录态，按 `user_id` 归档目录（如 `voucher/{user_id}/{yyyy}/{mm}/`）
- 限制类型（jpg/jpeg/png）与大小（≤ 5MB）
- 返回 URL 须长期有效、可跨设备/跨用户访问（公司账本共享需要）
- 可选：删除账单时清理对应图片（避免孤儿文件），或留存做凭证审计

**对象存储建议：**
```
存储路径: voucher/{user_id}/{date}/{uuid}.jpg
返回:     https://{bucket-cdn}/voucher/{user_id}/{date}/{uuid}.jpg
```

---

## 六、接口对接方式

### 6.1 当前实现（本地存储）

```
前端页面 (mingxi.js) → api.js → wx.getStorageSync / setStorageSync
```

### 6.2 目标实现（云端 API）

```
前端页面 (mingxi.js) → api.js → wx.request → 后端服务 → 数据库
```

**改动范围：** 仅替换 `utils/api.js` 中每个函数的实现，将 `wx.getStorageSync` / `wx.setStorageSync` 改为 `wx.request`。前端页面层（`mingxi.js`）零改动。

### 6.3 接口文件位置

| 文件 | 职责 |
|------|------|
| `utils/api.js` | 前端接口层 — 后端替换此文件中的实现 |
| `pages/mingxi/mingxi.js` | 前端页面层 — 仅调用 `api.*`，不直接操作数据 |
| `API.md` | 本文档 — 接口契约 |
