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
| `settleStatus` | `string` | 否 | 结清状态：未设（未结清）/ `'company_settled'`（一方已确认、待对方确认的中间态，仍视为未结清）/ `'settled'`（已结清，`typeLabel` 已转为收入/支出） |
| `settleInfo` | `object` | 否 | 结清快照（结清时间、对方、金额等），结清完成时写入 |
| `_voided` | `boolean` | 否 | 是否已作废，默认 `false` |
| `_autoSettle` | `boolean` | 否 | 是否为系统自动生成的结清记录，默认 `false`。此标记的记录不可手动删除 |

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

**返回值：**
```json
{
  "nickName": "138****8000",
  "avatarUrl": "",
  "token": "eyJhbGci...",
  "isNew": true,
  "hasCompany": false,
  "companyRole": null,
  "updatedAt": null
}
```
  1086	
  1087	---
  1088	
  1089	## 八、数据模型
  1090	
  1091	> 以下为后端数据库实际表结构（SQLite），与五节设计一致，个别字段已按实施调整。
  1092	
  1093	### 8.1 用户表 `users`
  1094	
  1095	| 列 | 类型 | 说明 |
  1096	|---|------|------|
  1097	| `id` | INTEGER PK | 自增主键 |
  1098	| `phone` | TEXT UNIQUE | 手机号（脱敏后存储，如 `138****8000`） |
  1099	| `openid` | TEXT | 微信 openid |
  1100	| `nickName` | TEXT | 昵称 |
  1101	| `avatarUrl` | TEXT | 头像 URL |
  1102	| `profile_updated_at` | INTEGER | 资料最后更新时间戳（毫秒），支持跨端 last-write-wins |
  1103	| `created_at` | TEXT | 创建时间 |
  1104	| `updated_at` | TEXT | 服务器更新时间 |
  1105	
  1106	### 8.2 会话表 `sessions`
  1107	
  1108	| 列 | 类型 | 说明 |
  1109	|---|------|------|
  1110	| `id` | INTEGER PK | 自增主键 |
  1111	| `token` | TEXT UNIQUE | JWT token（索引） |
  1112	| `user_id` | INTEGER | 关联 users.id |
  1113	| `expires_at` | TEXT | 过期时间 |
  1114	
  1115	### 8.3 验证码表 `verify_codes`
  1116	
  1117	| 列 | 类型 | 说明 |
  1118	|---|------|------|
  1119	| `id` | INTEGER PK | 自增主键 |
  1120	| `phone` | TEXT | 手机号 |
  1121	| `code` | TEXT | 6 位验证码 |
  1122	| `expires_at` | TEXT | 过期时间 |
  1123	
  1124	### 8.4 账单表 `items`
  1125	
  1126	| 列 | 类型 | 说明 |
  1127	|---|------|------|
  1128	| `id` | INTEGER PK | 自增主键 |
  1129	| `user_id` | INTEGER | 关联 users.id（索引） |
  1130	| `scope` | TEXT | `personal` / `company`（索引） |
  1131	| `category` | TEXT | 分类 emoji+名称 |
  1132	| `type` | TEXT | `in` / `out` |
  1133	| `typeLabel` | TEXT | 收入/支出/垫付/应付 |
  1134	| `amount` | TEXT | 金额（字符串存储，保留精度） |
  1135	| `date` | TEXT | 日期 `YYYY-MM-DD` |
  1136	| `note` | TEXT | 备注 |
  1137	| `target` | TEXT | 目标对象名称 |
  1138	| `targetType` | TEXT | `internal` / `external` |
  1139	| `linkedId` | INTEGER | 关联镜像账单 id |
  1140	| `voucher` | TEXT | 凭证图片 URL |
  1141	| `settleStatus` | TEXT | `company_settled` / `settled`，未设 = 未结清 |
  1142	| `settleInfo` | TEXT | 结清快照 JSON |
  1143	| `_voided` | INTEGER | 0（正常）/ 1（作废） |
  1144	| `created_at` | TEXT | 创建时间 |
  1145	| `updated_at` | TEXT | 更新时间 |
  1146	
  1147	**索引**：`(user_id, scope)`、`linkedId`、`(user_id, date)`
  1148	
  1149	### 8.5 分类表 `categories`
  1150	
  1151	| 列 | 类型 | 说明 |
  1152	|---|------|------|
  1153	| `id` | INTEGER PK | 自增主键 |
  1154	| `user_id` | INTEGER | 关联 users.id |
  1155	| `scope` | TEXT | `personal` / `company` |
  1156	| `name` | TEXT | 分类名 |
  1157	| `emoji` | TEXT | emoji 图标 |
  1158	| `inOut` | TEXT | `in` / `out` |
  1159	| `sort_order` | INTEGER | 排序 |
  1160	
  1161	### 8.6 公司表 `companies`
  1162	
  1163	| 列 | 类型 | 说明 |
  1164	|---|------|------|
  1165	| `id` | INTEGER PK | 自增主键 |
  1166	| `uid` | TEXT UNIQUE | 公司邀请码 |
  1167	| `name` | TEXT | 公司名称 |
  1168	| `boss_title` | TEXT | 老板头衔 |
  1169	| `boss_user_id` | INTEGER | 老板用户 id |
  1170	| `created_at` | TEXT | 创建时间 |
  1171	
  1172	### 8.7 公司成员表 `company_members`
  1173	
  1174	| 列 | 类型 | 说明 |
  1175	|---|------|------|
  1176	| `id` | INTEGER PK | 自增主键 |
  1177	| `company_id` | INTEGER | 关联 companies.id |
  1178	| `user_id` | INTEGER | 关联 users.id（索引） |
  1179	| `role` | TEXT | `boss` / `employee` |
  1180	| `status` | TEXT | `pending` / `approved` / `rejected` |
  1181	| `joined_at` | TEXT | 加入时间 |
  1182	
  1183	### 8.8 审核表 `audits`
  1184	
  1185	| 列 | 类型 | 说明 |
  1186	|---|------|------|
  1187	| `id` | INTEGER PK | 自增主键 |
  1188	| `company_id` | INTEGER | 关联 companies.id |
  1189	| `applicant_id` | INTEGER | 申请人 user_id |
  1190	| `applicant_nick` | TEXT | 申请人昵称 |
  1191	| `status` | TEXT | `pending` / `approved` / `rejected` |
  1192	| `created_at` | TEXT | 申请时间 |
  1193	
  1194	### 8.9 通知表 `notifications`
  1195	
  1196	| 列 | 类型 | 说明 |
  1197	|---|------|------|
  1198	| `id` | INTEGER PK | 自增主键 |
  1199	| `user_id` | INTEGER | 接收人 user_id（索引） |
  1200	| `type` | TEXT | `audit_approved` / `audit_rejected` 等 |
  1201	| `title` | TEXT | 通知标题 |
  1202	| `detail` | TEXT | 通知详情 |
  1203	| `read` | INTEGER | 0（未读）/ 1（已读） |
  1204	| `created_at` | TEXT | 创建时间 |
  1205	
  1206	### 8.10 反馈表 `feedbacks`
  1207	
  1208	| 列 | 类型 | 说明 |
  1209	|---|------|------|
  1210	| `id` | INTEGER PK | 自增主键 |
  1211	| `user_id` | INTEGER | 提交人 user_id |
  1212	| `content` | TEXT | 反馈内容 |
  1213	| `contact` | TEXT | 联系方式 |
  1214	| `created_at` | TEXT | 提交时间 |
  1215	
  1216	### 8.11 设置表 `user_settings`
  1217	
  1218	| 列 | 类型 | 说明 |
  1219	|---|------|------|
  1220	| `user_id` | INTEGER | 关联 users.id |
  1221	| `key` | TEXT | 设置键名 |
  1222	| `value` | TEXT | 设置值（JSON） |
  1223	| `updated_at` | TEXT | 更新时间 |
  1224	
  1225	**主键**：`(user_id, key)`
  1226	
  1227	### 8.12 简览卡片表 `overview_cards`
  1228	
  1229	| 列 | 类型 | 说明 |
  1230	|---|------|------|
  1231	| `id` | INTEGER PK | 自增主键 |
  1232	| `user_id` | INTEGER | 关联 users.id |
  1233	| `card_id` | TEXT | 卡片标识 |
  1234	| `x` | INTEGER | 布局 x |
  1235	| `y` | INTEGER | 布局 y |
  1236	| `span` | INTEGER | 列数（1/2） |
  1237	
  1238	---
  1239	
  1240	## 九、安全加固清单
  1241	
  1242	| 加固项 | 状态 |
  1243	|--------|------|
  1244	| `sessions.token` 索引 | ✅ 认证热路径加速 |
  1245	| 6 个业务查询索引 | ✅ `items(user_id, scope)` 等 |
  1246	| `addColumnSafely` 正则防注入 | ✅ DDL 安全 |
  1247	| `_devSecret` 惰性生成 | ✅ 首次请求时生成 |
  1248	| `GET /items` 分页（limit/offset） | ✅ 向后兼容无参调用 |
  1249	| JWT 签发幂等（同一 phone 取同一 token） | ✅ 防并发刷库 |
  1250	| CSRF 防护（SOP + 自定义头） | ✅ 非标准头强制预检 |
  1251	| 并发会话防冲突（同一 phone 多次登录复用 token） | ✅ 不串号 |
  1252	| 服务器时间一致性（`Date.now()` 统一） | ✅ |
  1253	
  1254	---
  1255	
  1256	## 十、已知约束与后续方向
  1257	
  1258	- **金额存储**：`amount` 为 TEXT 字符串，`Number` 运算时需注意浮点精度（前端 `parseFloat` 格式化到分）。
  1259	- **Settle ID 方案**：当前 `Date.now() + 随机后缀`，中低并发够用；高并发下可换 UUID v7 或自增 ID。
  1260	- **单进程模型**：SQLite + Express 单进程，水平扩展需换 PostgreSQL + 连接池（见高并发方案）。
  1261	- **图片存储**：当前本地磁盘 `vouchers/`，生产环境应迁对象存储（OSS/COS）。
  1262	- **短信服务**：验证码当前日志输出，生产需对接阿里云/腾讯云短信。
  1263	- **微信登录**：当前 openid 占位，生产需对接 `code2Session`。
| 字段 | 类型 | 说明 |
|------|------|------|
| `nickName` | `string` | 昵称 |
| `avatarUrl` | `string` | 头像 URL |
| `token` | `string` | JWT 会话令牌，后续鉴权接口需带 `Authorization: Bearer <token>` |
| `isNew` | `boolean` | 是否首次注册（该手机号首次登录） |
| `hasCompany` | `boolean` | 是否已加入公司 |
| `companyRole` | `string\|null` | 公司角色：`'boss'` / `'employee'` / `null` |
| `updatedAt` | `number\|null` | 用户资料最后更新时间戳（毫秒），用于跨端冲突检测 |

---

#### `loginByWechat(code, nickName, avatarUrl)`

微信授权登录。前端通过 `wx.login()` 获取 `code`，连同用户授权信息传入。

| 参数 | 类型 | 说明 |
|------|------|------|
| `code` | `string` | 微信 `wx.login()` 返回的临时登录凭证 |
| `nickName` | `string` | 用户微信昵称（可选） |
| `avatarUrl` | `string` | 用户微信头像 URL（可选） |

**返回值：** 同 `loginByPhone`，包含 `token` / `isNew` / `hasCompany` / `companyRole` / `updatedAt`。

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

### 2.13 识别 (Recognize)

> **战略方针：** 个人主体小程序识别能力受限（微信云 OCR 不可用），统一走后端 API 中转。前端只采集（录音/拍照），后端调第三方 ASR/OCR 返回结果。前端不直接对接任何识别 SDK 或插件。

#### `asrRecognize(tempFilePath)`

语音识别（ASR）— 上传录音文件，返回识别文本。

| 参数 | 类型 | 说明 |
|------|------|------|
| `tempFilePath` | `string` | `wx.getRecorderManager().stop()` 返回的临时文件路径 |

**返回值：** `Promise<string>` — 识别出的文本

**底层请求：** `POST /api/asr/recognize`（`wx.uploadFile` multipart）

---

#### `ocrParse(imageUrl)`

凭证图片识别（OCR）— 提交图片 URL，返回结构化记账字段。

| 参数 | 类型 | 说明 |
|------|------|------|
| `imageUrl` | `string` | 图片 URL（先通过 `uploadVoucher` 上传获得） |

**返回值：** `Promise<{ amount: string, category: string, note: string, date: string } | null>`

**底层请求：** `POST /api/ocr/parse`（`wx.request` JSON）

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
| 32 | `asrRecognize(tempFilePath)` | tempFilePath | `Promise<string>` | 语音转文字（后端 ASR） |
| 33 | `ocrParse(imageUrl)` | imageUrl | `Promise<\| null>` | 凭证 OCR 识别（后端） |

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

垫付/应付账单结清后，将 `typeLabel` 转为普通收入/支出，并通过 `settleStatus` 记录结清进度。

**typeLabel 转换：**

- 垫付（`type: 'in'`） → 结清完成后 `typeLabel` 改为 `'收入'`
- 应付（`type: 'out'`） → 结清完成后 `typeLabel` 改为 `'支出'`

**settleStatus 流转：**

| settleStatus | 含义 |
|--------------|------|
| 未设（undefined） | 未结清，计入未结清往来款（应收/应付） |
| `'company_settled'` | 一方（公司侧）已确认、等待对方（个人）确认的中间态，仍视为未结清 |
| `'settled'` | 已结清完成，`typeLabel` 已转为收入/支出，`settleInfo` 写入结清快照 |

- 聚合「未结清应收/应付」时以 `settleStatus !== 'settled'` 判定。
- 内部对象（`targetType: 'internal'`）结清时会**联动更新对面镜像账单**的 `settleStatus` 与 `typeLabel`（见 4.3）；外部对象只更新自身。
- 相关调用：`updateItem(id, { settleStatus, settleInfo, typeLabel })`。

**收支与资产聚合口径（前端计算，不改变存储）：**

聚合统一按 `typeLabel` 计算（不依赖 `type`）：

- 收入 = `typeLabel === '收入'`
- 个人支出 = `typeLabel === '支出'` 或 `'垫付'`（垫付已实际出账，计入支出；结清回账后转为收入）
- 未结清应付 = `typeLabel === '应付' && settleStatus !== 'settled'`，**不计入收入/支出**，但计入月度预算占用（视为已承诺花掉）
- 公司「真实支出」 = `typeLabel === '支出'`（不含垫付/应付）

公司账本四项资产：

| 项目 | 公式 |
|------|------|
| 总资金 | 收入 − 真实支出 |
| 总负债 | 未结清应付 |
| 净资产 | 总资金 − 应付 |
| 可支配资产 | 总资金 − 未结清垫付 − 未结清应付 |

> 公司账本不设月度预算；月度预算仅个人账本。

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

### 任务 11：语音识别 (ASR) 与图片识别 (OCR) 后端承接

**背景：** 个人主体小程序无法调用微信云 OCR，`WechatSI` 插件可用但不属于后端可控链路。**识别能力统一后移到后端**，通过第三方 API 中转，解除主体限制，前端只负责采集（录音/拍照），不直接对接任何识别 SDK 或插件。

**优先级：中**（AI 对话语音入口 + 扫描凭证记账 依赖）

**战略方针：**

> 核心原则：**前端采集，后端识别。** 所有识别能力（语音→文本、图片→结构化字段）全部走后端 API。前端不调用任何第三方识别 SDK / 插件，只负责把原始数据（音频文件 / 图片）交给后端，后端返回识别结果。

**当前前端状态速查：**

| 能力 | 当前实现 | 位置 | 待替换点 |
|------|---------|------|---------|
| 语音→文本 | `WechatSI` 插件 `getRecordRecognitionManager()` | `mingxi.js:4661-4672` | `_ensureRecognizer` / `_startRecognize` / `_stopRecognize` / `_onRecognizeDone` |
| 图片→字段 | `_mockOcrParse()` 随机模拟 | `mingxi.js:4634-4643` | `_startScanRecognize` → `_mockOcrParse()` |
| 语音入口 | AI 对话语音键 (`onAiVoiceStart`/`End`) + 底部长按 (`onAiChatOpen`/`onAiRecordEnd`) | `mingxi.js:4758-4886` | 录音改用 `wx.getRecorderManager()`，上传后用后端 ASR |

**新增后端接口：**

---

#### `POST /api/asr/recognize` — 语音识别

前端录音 → 上传音频文件 → 后端调第三方 ASR → 返回识别文本。

**请求：** `multipart/form-data`

| 字段 | 类型 | 说明 |
|------|------|------|
| `file` | `File` | 录音文件（mp3/aac/pcm），由 `wx.getRecorderManager()` 录制 |

**响应：** `{ "ok": true, "text": "午餐 25 餐饮" }`

| 字段 | 类型 | 说明 |
|------|------|------|
| `text` | `string` | 识别出的完整文本 |

**后端接入建议：**
- 腾讯云 ASR（实时语音识别 / 一句话识别），个人可申请免费额度
- 备选：百度 ASR / 阿里云 NLS
- 文件格式转换如需要可在后端做（ffmpeg / sox）

---

#### `POST /api/ocr/parse` — 凭证图片识别

前端拍照/选图 →（可选先上传拿 URL）→ 提交图片 URL → 后端调第三方 OCR → 返回结构化记账字段。

**请求：** `application/json`

| 字段 | 类型 | 说明 |
|------|------|------|
| `imageUrl` | `string` | 图片 URL（可先通过 `POST /api/upload` 上传后获得） |

**响应：** `{ "ok": true, "amount": "25.00", "category": "餐饮", "note": "午餐", "date": "2026-06-23" }`

| 字段 | 类型 | 说明 |
|------|------|------|
| `amount` | `string` | 识别出的金额 |
| `category` | `string` | 识别出的分类，应落在一级分类内（如无法匹配则返回 `''`，前端让用户手动选） |
| `note` | `string` | 识别出的备注（商户名/商品名等） |
| `date` | `string` | 识别出的日期，格式 `YYYY-MM-DD`（如未识别到则返回当天） |

**后端接入建议：**
- 腾讯云 OCR（通用票据识别 / 增值税发票识别），个人可申请免费额度
- 备选：百度 OCR（通用票据识别）
- 金额/分类/日期由后端从识别结果中抽取，如无法抽取则对应字段返回空

---

**前端改造要点（等后端接口就绪后执行）：**

1. **语音**：`wx.getRecorderManager()` 录音 → `wx.uploadFile` 调 `/api/asr/recognize` → 拿到 `text` → 走现有 `_onRecognizeDone(text)` 分发逻辑
2. **图片**：拍照 → `api.uploadVoucher(tempFilePath)` 上传拿 URL → `api.ocrParse(imageUrl)` 调 `/api/ocr/parse` → 拿到 `{ amount, category, note, date }` → 填充 `bookForm` 替代 `_mockOcrParse()`
3. **改动范围**：仅 `mingxi.js` 中上述几个方法，WXML/WXSS 及相机拍照流程不变

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

---

## 七、后端待办需求（前端依赖）

> 以下能力前端已落地。**全部 6 项已实现并验证。**

### 7.1 ✅ 已交付 — 登录返回 `isNew`（新用户注册引导）

**现状**：`POST /api/auth/login-by-phone`「登录即注册」——手机号未注册则自动建号，默认昵称 = 脱敏手机号（如 `138****8000`）、`avatarUrl` 为空，响应**不区分新老用户**。

**前端临时方案**：登录后用启发式判定新用户（`avatarUrl` 为空 且 `nickName` 匹配 `^\d{3}\*{4}\d{4}$`）→ 弹出「完善资料」设置昵称 + 头像。

**期望后端改动**：`login-by-phone`（及 `login-by-wechat`）在响应里返回 `isNew`，前端据此精确判定，去掉脆弱的脱敏手机号正则。

| 字段 | 类型 | 说明 |
|------|------|------|
| `isNew` | `boolean` | 该手机号/openid 是否首次注册（本次登录新建用户） |

### 7.2 ✅ 已交付 — 头像公开访问路由（免鉴权）

**现状**：头像复用凭证上传 `POST /api/upload`，返回 URL 走 `GET /voucher/*`，该路由**要求 Bearer token + 归属校验**。小程序 `<image src>` 无法携带 `Authorization` 头 → 头像 **401 加载失败**。

**前端临时方案**：`api.downloadAuthedImage(url)` 用 `wx.downloadFile` 带 token 头把头像下成本地临时路径再喂给 `<image>`（多一次请求）。

**期望后端改动**：头像单独走一条**公开（免鉴权）只读路由**（头像本身不敏感），或上传时按 `type=avatar` 存公开目录并返回可被 `<image>` 直接加载的 URL。届时前端去掉 `downloadAuthedImage` 绕过，直接 `<image src="{{avatarUrl}}">`。

> ✅ 已生效：公开路由 `GET /public/voucher/*` 的挂载已按 7.7 改为 `app.use`，`req.path` 前缀正确剥离，头像可正常加载（重启后端后验证通过）。

### 7.3 ✅ 已交付 — 账号与公司角色持久化（避免重复引导）

**原则**：手机号即账号身份——同一手机号 = 同一 `user`。用户的**公司归属与角色（boss/employee + companyUid）必须服务端持久化**，登录后可被客户端取回（当前经 `syncFromCloud` 中的 `GET /api/company`）。

**前端依赖**：登录成功后客户端 `await syncFromCloud()` → 若已取到公司信息（含 companyUid），则**跳过「选择身份/创建公司」引导**，老用户（尤其 boss）登录不再被重复询问身份。

**期望后端保证**：
- 同一手机号多次登录指向同一 `user`，其 `company_members`（角色、companyUid）稳定持久；
- `GET /api/company` 对已创建/加入公司的用户稳定返回其公司与角色；
- （可选优化）`login-by-phone` 响应直接带回 `companyRole` / `hasCompany`，免去登录后额外一次 `GET /company` 往返即可判定，进一步消除引导闪现。

### 7.4 ✅ 已交付 — 头像单份存储（上传前清理旧文件）

**问题**：`POST /api/upload` 每次都用 `crypto.randomUUID()` 生成新文件名、保存后**从不删除同一用户的旧文件**。用户每换一次头像就在磁盘多留一个文件，永不回收 → 单用户头像文件无限堆积，小服务器存储吃不消。

**前端已配合**：
- 头像上传带 `?type=avatar`（普通凭证不带），后端可据此区分头像；
- 客户端选图后先 `wx.compressImage`（压到 400 宽 / quality 80）再上传，单图体积已大幅下降。

**期望后端改动**：当 `type=avatar` 时，保存新头像**之前先清空该用户的 avatar 目录**（`{safeId}/avatar/` 下旧文件全删），或使用**固定文件名覆盖写入**，保证「单个用户头像磁盘上恒为一份」。普通凭证（非 avatar）不受影响，仍按年/月保留。

> 与 7.2 配合：`type=avatar` 既走免鉴权 public 路由（解决 401 显示），又做单份覆盖（解决堆积），一处改动解决头像两个痛点。

### 7.5 ✅ 已交付 — 用户资料时间戳（昵称/头像跨端 last-write-wins）

**目标**：同一手机号在多端（真机 / 开发者工具）改昵称或头像，以**最新时间戳为准**自动同步——哪端新用哪端，本地比云端新就反推后端，避免旧数据覆盖新数据。

**现状**：`users` 表已有 `updated_at`（服务器 `datetime('now')`），但 `GET /api/auth/user-info`（auth.js:250）**不返回它**，`POST /api/auth/user-info`（auth.js:263）也**不接收前端传的时间戳**（用服务器时间）。前端因此拿不到云端时间戳，无法对比。

**前端已落地**：
- `saveUserInfo` 写入时带 `updatedAt`（毫秒），一并 `POST /auth/user-info`；
- `syncFromCloud` 对 userInfo 做**安全降级的 last-write-wins**：
  - 后端返回的 `updatedAt > 0` 且 `本地 updatedAt > 云端` → 保留本地并反推后端；
  - 否则（后端未返回 `updatedAt`，或云端更新/同等）→ 用云端覆盖本地（即当前行为）。
- 因此后端未改前**不破坏现状**，后端补齐后**自动启用**双向对比。

**期望后端改动**（任一可行方案）：
- `GET /auth/user-info` 在响应里**返回 `updatedAt`**（毫秒数）。这是前端能对比的**硬前提**。
- `POST /auth/user-info` **接收并存储前端传的 `updatedAt`**（建议新增列 `profile_updated_at INTEGER` 存毫秒，或把现有 `updated_at` 以毫秒返回），并在写入时**比较时间戳**：若传入 `updatedAt` 比库中旧则忽略（服务端兜底防旧覆盖新）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `updatedAt` | `number` | 资料（昵称/头像）最后更新的毫秒时间戳，`GET` 需返回、`POST` 需接收存储 |

### 7.6 ✅ 已交付 — 联动账单成对新建：跳过「指向对方」的 linkedId 校验

**问题**：「内部对象 + 垫付/应付」会一次性新建**两条互相关联**的账单（`item.id=A, linkedId=B` 与 `mirrorItem.id=B, linkedId=A`），走 `POST /api/items/linked`。但后端在**插入之前**就用 `validateLinkedId`（items.js:62-66）校验 linkedId——该函数要求 `linkedId` 指向的账单**已存在于库中且属于当前用户**（`SELECT id FROM items WHERE id=? AND user_id=?`）。可这两条是同一请求里一起创建、互相引用，校验那一刻**谁都还没入库** → 查不到 → `items.js:536-542` 返回 400 `item.linkedId 指向的账单不存在或不属于当前用户`。**只要是成对互相关联的新建，这个校验永远过不去**，与账单内容无关。

**影响**：`addLinkedItems` 先写本地、再 fire-and-forget 推送（`_pushBackend` 只 `console.warn` 不抛错），所以**本地记账正常、UI 提示成功**，但这两条**不会同步到后端** → 跨端 / 退出再登录后丢失。

**前端无法单独干净修复**：`POST /items`（items.js:200）、`PUT /items/:id`（items.js:325）有同样的 `validateLinkedId` 校验。前端唯一绕法是把一次事务拆成「建 mirror（不带 linkedId）→ 建 item（linkedId 指向已入库 mirror）→ PUT 回填 mirror.linkedId」3 步串行，但会**失去「两条同时成败」的事务原子性**（中途失败留孤儿账单），不推荐。

**期望后端改动（一行）**：成对新建时跳过「指向对方」的校验，其余 linkedId 仍照常校验，插入仍在事务里、原子性不变（items.js:536-542）：
```js
if (item.linkedId && item.linkedId !== mirrorItem.id && !validateLinkedId(req.userId, item.linkedId)) {
  return res.status(400).json({ error: 'item.linkedId 指向的账单不存在或不属于当前用户' })
}
if (mirrorItem.linkedId && mirrorItem.linkedId !== item.id && !validateLinkedId(req.userId, mirrorItem.linkedId)) {
  return res.status(400).json({ error: 'mirrorItem.linkedId 指向的账单不存在或不属于当前用户' })
}
```

### 7.7 ✅ 已交付 — 图片服务路由挂载修复：`app.get` → `app.use`，`req.path` 前缀已剥离

**问题**：两条图片路由都用 `app.get('/X/*')` 挂载，而 `app.get` **不剥离路径前缀**，handler 拿到的 `req.path` 是带前缀的完整路径；但两个 handler 都假设前缀已被剥离 → 路径校验在读文件**之前**就失配返回 403。

| 挂载（app.js） | handler | 实际 `req.path` | 校验失配点 | 返回 |
|---|---|---|---|---|
| `app.js:104` `app.get('/public/voucher/*', servePublicVoucher)` | `upload.js:220` | `/public/voucher/4/avatar/x.jpg` | `relPath="public/voucher/4/avatar/x.jpg"` → `parts[1]='voucher' !== 'avatar'`（upload.js:225） | 403 `仅支持头像公开访问` |
| `app.js:101` `app.get('/voucher/*', requireAuth, serveVoucher)` | `upload.js:181` | `/voucher/4/2026/06/x.jpg` | `relPath="voucher/4/..."` 不以 `{safeId}/`（如 `4/`）开头（upload.js:187） | 403 `无权访问该凭证` |

> handler 注释（upload.js:183 / 221）写期望 `"1/avatar/uuid.jpg"`，印证设计本意是「前缀已剥离」，与 `app.get` 的实际行为矛盾。

**影响**：**当前后端任何头像/凭证图都加载不出**——403 早于 `fs.existsSync`，与文件是否存在无关，这使 7.2「头像公开访问路由」实际未生效。复现：

```
curl http://<host>:3000/public/voucher/4/avatar/x.jpg
→ 403 {"error":"仅支持头像公开访问"}
```

**前端已配合**：`utils/api.js` 的 `_rewriteHost` 已把存量绝对 URL 的 host 对齐当前 `BASE_URL`（解决 IP/域名变化致 host 不可达），后端路由修好后即可正常显示，前端无需再改。

**期望后端改动（二选一）**：

方案 A（推荐，改挂载——`app.use` 会剥掉挂载前缀，handler 拿到的 `req.path` 即期望的 `/4/avatar/x.jpg`，校验逻辑一行不动即可通过）：
```js
// app.js（把 app.get('/X/*') 换成 app.use('/X')）
app.use('/voucher', require('./middleware/auth').requireAuth, serveVoucher)
app.use('/public/voucher', servePublicVoucher)
```

方案 B（改 handler 去前缀——保留现有挂载）：
```js
// upload.js  serveVoucher / servePublicVoucher 开头
const relPath = req.path.replace(/^\/(public\/)?voucher\//, '').replace(/^\/+/, '')
```

> 附注：旧头像物理文件可能已不在磁盘（`backend/data/voucher/` 目录缺失）。路由修好后需**重新上传一张头像**验证整条链路。
