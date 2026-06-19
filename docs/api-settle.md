# 结清（Settlement）后端 API 需求

## 数据模型扩展

### item 新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `settleStatus` | `NULL` / `'company_settled'` / `'settled'` | 结清状态 |
| `settleInfo` | `TEXT` | 结清时间戳备注，格式: `"2026年06月19日 14:30 由[应付]结清"` |
| `_autoSettle` | `BOOLEAN` | 系统自动生成的对账记录标记 |

> 数据库 `items` 表需新增这 3 个字段（均可为 NULL）。

---

## API 接口

### 1. `PUT /api/items/:id/settle` — 结清单项

公司结清应付项 或 个人结清应付项时调用。

**请求体：**
```json
{
  "settleStatus": "settled",
  "settleInfo": "2026年06月19日 14:30 由[应付]结清"
}
```

**后端事务逻辑（Case A/B — 公司结清应付）：**
1. 更新公司应付项: `settleStatus → 'settled'`, `settleInfo → 时间戳`
2. 自动创建公司支出记录: `{ typeLabel:'支出', type:'out', _autoSettle:true, settleInfo }`
3. 查找镜像个人垫付项（通过 `linkedId`）
4. 判断用户是否为 boss:
   - **是 boss**: 自动完成个人端确认（`settleStatus → 'settled'`, `typeLabel → '支出'`）+ 创建个人收入记录
   - **非 boss**: 设置个人垫付项 `settleStatus → 'company_settled'`，推送通知
5. 以上操作应在**同一事务**内完成

**后端事务逻辑（Case C — 个人结清应付）：**
1. 更新个人应付项: `settleStatus → 'settled'`, `settleInfo → 时间戳`
2. 自动创建个人支出记录
3. 更新公司垫付项: `settleStatus → 'settled'`, `typeLabel → '收入'`, `settleInfo → 时间戳`
4. 自动创建公司收入记录
5. 以上操作应在**同一事务**内完成

**响应：**
```json
{ "ok": true }
```

---

### 2. `POST /api/items/:id/settle-confirm` — 个人确认结清

个人确认垫付项到账时调用（仅 `settleStatus === 'company_settled'` 的项可调用）。

**请求体：**
```json
{
  "settleInfo": "2026年06月19日 14:30 由[垫付]结清"
}
```

**后端逻辑：**
1. 校验该项 `settleStatus === 'company_settled'`
2. 更新: `settleStatus → 'settled'`, `typeLabel → '支出'`, `settleInfo → 时间戳`
3. 自动创建个人收入记录: `{ typeLabel:'收入', type:'in', _autoSettle:true, settleInfo }`

**响应：**
```json
{ "ok": true }
```

---

### 3. `POST /api/notify` — 推送结清通知

公司结清应付后，需通知个人端（非 boss 场景）。

**请求体：**
```json
{
  "targetUserId": "user_xxx",
  "type": "settle_pending",
  "text": "公司已结清您的垫付款 ¥100.00，请确认到账",
  "itemId": "12345"
}
```

> 现有 `POST /api/notify` 已支持通知列表写入，需扩展支持 `type` 字段以区分结清通知。

---

## 现有接口变更

### `PUT /api/items/:id`

需支持更新以下新字段：
- `settleStatus`
- `settleInfo`
- `_autoSettle`

### `POST /api/items`

新记录可能包含 `settleInfo` 和 `_autoSettle` 字段，需正常存储。

### `GET /api/items?scope=xxx`

返回的 item 应包含 `settleStatus`、`settleInfo`、`_autoSettle` 字段。

---

## 注意事项

1. **事务原子性**: 结清操作涉及多表多行更新 + 新记录插入，必须在同一事务内完成
2. **Boss 判断**: 通过 `company` 表的 `companyRole` 字段判断当前用户是否为 boss
3. **幂等性**: 对已 `settled` 的项重复调用应返回成功但不重复执行
4. **自动记录不可手动删除**: `_autoSettle: true` 的记录在 `DELETE /api/items/:id` 时应拒绝或提示
