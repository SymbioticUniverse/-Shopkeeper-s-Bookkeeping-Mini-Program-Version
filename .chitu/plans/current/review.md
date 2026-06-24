# 自审报告 — 修复 updatedAt 格式不一致 + 409 带 serverVersion

## 变更文件

### 1. `backend/src/routes/items.js` — rowToItem（行 53）

- `updatedAt: row.updated_at ? new Date(row.updated_at + 'Z').getTime() : null`
- SQLite datetime 字符串 "2026-06-24 12:30:00" → 毫秒时间戳
- `updated_at` 为 NULL → 返回 null（守卫正确）
- SQLite 内置格式稳定，不会有 NaN 风险

### 2. `backend/src/routes/items.js` — POST 409（行 237）

- `SQLITE_CONSTRAINT_PRIMARYKEY` 时 SELECT 已有记录 → `rowToItem(existing)` → 返回 `{ error, existingItem }`
- `existing` 非空断言：INSERT 因主键冲突失败，行必然存在；SQLite 单写锁保证无 TOCTOU 竞态
- rowToItem 会走同样的 updatedAt 毫秒转换 ✅

### 3. `utils/api.js` — _pushDirtyItems（行 572）

- `e.existingItem` 存在时构建 duplicate_id 冲突（与 `_detectConflicts` 同格式）
- 追加到 `PENDING_CONFLICTS_KEY`，不清脏标记
- 边界：
  - 同一 ID 重复冲突：同一周期内不会重复推（顺序循环），跨周期有重复也安全
  - `_save` 是同步 wx.setStorageSync，不会失败
  - `e` 非 409（网络错误等）跳过 if 块，行为不变 ✅

### 4. `utils/api.js` — _mergeItems（行 769）

- `_updatedAt: rIt.updatedAt || 0` — 服务端条目继承后端毫秒时间戳
- Pass 1 本地条目已有 `_updatedAt`（addItem/updateItem 时写入）
- 老数据无 `_updatedAt` 降为 0：已有行为，非本次引入
- 排序 `(b._updatedAt || 0) - (a._updatedAt || 0)` 现在两端都正常工作 ✅

## 结论
✅ 通过，可提交。
