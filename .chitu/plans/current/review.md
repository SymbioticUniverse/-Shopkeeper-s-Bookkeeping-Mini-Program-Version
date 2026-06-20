# Self-Review: Backend Settlement API

## 修改文件

| 文件 | 修改 |
|------|------|
| `backend/src/routes/items.js` | rowToItem 含 settle 字段、POST/PUT/linked 支持 settle 字段、DELETE 拒绝 _autoSettle、新增 PUT /:id/settle + POST /:id/settle-confirm |
| `backend/src/routes/notify.js` | GET/POST 支持 type/targetUserId/itemId 三个新字段 |

## 逐项审查

### items.js — rowToItem
- ✅ `settleStatus: row.settleStatus ?? undefined` — NULL 安全映射
- ✅ `settleInfo: row.settleInfo ?? undefined` — NULL 安全映射
- ✅ `_autoSettle: row._autoSettle === 1` — 布尔转换正确

### items.js — POST /items
- ✅ INSERT 列新增 settleStatus/settleInfo/_autoSettle（17 列 → 3 占位符值）
- ✅ 默认值：`item.settleStatus || null`、`item.settleInfo || null`、`item._autoSettle ? 1 : 0`

### items.js — PUT /items/:id
- ✅ 动态 UPDATE 支持 data.settleStatus、data.settleInfo、data._autoSettle
- ✅ _autoSettle 布尔→INT 转换正确

### items.js — DELETE /items/:id
- ✅ 先查 `_autoSettle` 字段，若为 1 返回 403 "系统自动结清记录不可手动删除"
- ⚠️ 注意：级联删除的镜像若含 _autoSettle=true 则无法被级联删除（正确行为：自动记录不可删）

### items.js — POST /items/linked
- ✅ INSERT 列和值均新增 3 个 settle 字段
- ✅ item 和 mirrorItem 各自独立传值

### items.js — PUT /:id/settle（结清）
- ✅ 所有权校验（checkOwnership）
- ✅ 幂等性：settleStatus==='settled' 返回 {ok:true, idempotent:true}
- ✅ 仅应付项可结清（type_label==='应付'）
- ✅ 镜像查找：优先 linked_id，回退到反向查询
- ✅ Boss 判断：查询 company_members 表 WHERE user_id=? AND status='approved'
- ✅ Case A/B（公司应付）：更新 + 创建公司支出 auto-record + boss自动确认 / 非boss设company_settled+通知
- ✅ Case C（个人应付）：更新 + 创建个人支出 auto-record + 更新公司镜像+创建公司收入 auto-record
- ✅ 事务包裹（db.transaction）
- ✅ PRIMARY KEY 冲突 → 409
- ⚠️ ID 生成：Date.now()+10/+11 有同毫秒冲突风险，但 PRIMARY KEY catch 兜底

### items.js — POST /:id/settle-confirm（确认结清）
- ✅ 所有权校验
- ✅ 状态校验：settleStatus==='company_settled' 才允许
- ✅ 类型校验：type_label==='垫付' 才允许
- ✅ 事务内：更新垫付项 + 创建个人收入 auto-record
- ✅ PRIMARY KEY 冲突 → 409

### notify.js — GET /notify
- ✅ SELECT 新增 type, target_user_id, item_id
- ✅ 响应映射：camelCase（type, targetUserId, itemId）

### notify.js — POST /notify
- ✅ INSERT 新增 type, target_user_id, item_id
- ✅ 前端传值：item.type || ''、item.targetUserId || null、item.itemId || null
- ✅ DELETE 不变（仅允许 source='user'）

## 边界检查
- ✅ 旧数据兼容：settleStatus/settleInfo 为 NULL 时 rowToItem 返回 undefined
- ✅ 空 settleInfo 时 settle 端点自动生成时间戳
- ✅ notify DELETE 不受新字段影响（DELETE 语句未变）
- ✅ 系统通知（source='system'）不会被 POST /notify 的全量覆盖删除

## 结论
所有变更低风险，事务保护完整，向后兼容。
