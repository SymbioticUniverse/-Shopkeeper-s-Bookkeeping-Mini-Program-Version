# Self-Review: DB Schema — settlement columns

## 修改文件

| 文件 | 修改 |
|------|------|
| `backend/src/db.js` | 新增 6 个 migration + amount 迁移表兼容 |

## 逐项审查

### items 表新增列
- ✅ `settleStatus TEXT DEFAULT NULL` — 允许 NULL（未结清）、'company_settled'、'settled'
- ✅ `settleInfo TEXT DEFAULT NULL` — 结清时间戳备注
- ✅ `_autoSettle INTEGER NOT NULL DEFAULT 0` — 系统自动对账记录标记

### notifications 表新增列
- ✅ `type TEXT DEFAULT ''` — 区分 'settle_pending' 等通知类型
- ✅ `target_user_id INTEGER DEFAULT NULL` — 目标用户 ID
- ✅ `item_id INTEGER DEFAULT NULL` — 关联的账单 item ID

### amount TEXT→REAL 迁移兼容
- ✅ `CREATE TABLE items_mig` 包含新列 settleStatus/settleInfo/_autoSettle
- ✅ `INSERT ... SELECT` 映射全部 16 列（原 13 + 新 3）
- ✅ 列顺序与 CREATE TABLE 一致

### 边界检查
- ✅ `addColumnSafely` 幂等：已存在的列不会重复添加
- ✅ 默认值安全：旧数据 settleStatus/settleInfo 为 NULL，_autoSettle 为 0
- ✅ notifications 旧数据 type 为空字符串，target_user_id/item_id 为 NULL

## 结论
Schema migration 安全、幂等，low risk。
