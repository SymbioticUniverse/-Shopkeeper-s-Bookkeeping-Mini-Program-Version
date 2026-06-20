# Self-Review: notify.js / feedback.js 文本长度校验

## 修改文件

| 文件 | 修复项 |
|------|--------|
| `backend/src/routes/notify.js` | POST 接口新增 `item.text` ≤2000 字符校验 |
| `backend/src/routes/feedback.js` | POST 接口新增 `item.text` ≤2000 字符校验 |

## 逐项审查

### notify.js — 文本长度校验（行 41-46）
- ✅ 校验位于事务之前，防止部分状态
- ✅ `item.text &&` 安全处理 null/undefined/''（空文本合法通过）
- ✅ `item.text.length > 2000` 与 items.js 的 note 校验一致
- ✅ 返回 400 + 中文错误消息"通知内容不能超过 2000 个字符"
- ✅ 仅校验 POST（保存列表），不校验 GET/DELETE（无文本输入）
- ⚠️ 系统通知（source='system'）由后端生成，不经过此接口，不受影响

### feedback.js — 文本长度校验（行 31-36）
- ✅ 校验位于事务之前
- ✅ 与 notify.js 完全相同的校验逻辑
- ✅ 返回 "反馈内容不能超过 2000 个字符"

## 边界情况覆盖
- `item.text = null` → `null &&` 短路 → 通过 ✅
- `item.text = undefined` → `undefined &&` 短路 → 通过 ✅
- `item.text = ''` → 空字符串 falsy，短路 → 通过 ✅
- `item.text = 2000 中文字符` → `2000 > 2000` false → 通过 ✅
- `item.text = 2001 字符` → `>2000` true → 拒绝 400 ✅
- `item` 不含 `text` 字段 → `undefined` → 通过 ✅

## 结论
两处修改逻辑正确，与 items.js 的 note 校验模式一致。无新增安全漏洞。边界情况已覆盖。
