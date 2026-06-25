# 自审 — DELETE 幂等修复

## 变更文件

### 1. `backend/src/routes/items.js` — DELETE 404 → 200 幂等
- 删除不存在记录时返回 200 `{ ok: true, deleted: false, reason: 'already_deleted' }`，而非 404
- 与 PUT handler 行为一致（之前的迭代已修复 PUT 的相同问题）

### 2. `utils/api.js` — `_pushDirtyItems` 容错 404
- catch 块新增 `e.error === '账单不存在'` 判断，匹配直接 `continue` 清理墓碑
- 双重保险：后端已返回 200，前端额外兜底

## 自审检查

| 检查项 | 状态 |
|--------|------|
| DELETE 不存在的记录返回 200 而非 404 | ✅ |
| 前端 catch 404 不再重试（continue 跳过后不加入 remainingDeleted） | ✅ |
| 不影响正常删除流程（存在记录走原逻辑，级联清理镜像+磁盘凭证文件） | ✅ |
| PUT handler 已有同样幂等逻辑（255 行）| ✅ |
| settle/settle-confirm 不受影响（404 仍正确，因结清需账单存在） | ✅ |
