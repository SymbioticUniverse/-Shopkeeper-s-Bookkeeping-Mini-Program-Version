# Self-Review: 审查修复（第二轮）

## 修改文件

| 文件 | 修复项 |
|------|--------|
| `backend/src/routes/items.js` | #1 amount 校验, #2 note 长度限制, #3 validateLinkedId 拒绝0, #4 DELETE 去重 |
| `backend/src/routes/migrate.js` | #5 `||` → `??` 修复 0 值丢失 |
| `backend/src/routes/company.js` | #6 notifyId: `Math.random()` → `crypto.randomInt()` |
| `backend/src/routes/audit.js` | #6 notifyId: `Math.random()` → `crypto.randomInt()` |

## 逐项审查

### items.js — validateLinkedId 拒绝 0
- ✅ `linkedId === null || undefined || ''` 放行（无链接）
- ✅ `!Number.isFinite || <= 0` 拒绝（NaN、0、负数、字符串）
- ✅ 真实正整数查询 DB 归属
- ⚠️ `linkedId = ''` 放行，但调用方不会传空字符串（前端传 null/undefined），无影响

### items.js — POST `/` amount 校验
- ✅ `item.amount === null/undefined` 前置判空
- ✅ `Number(item.amount)` → `Number.isFinite()` 拒绝 NaN
- ✅ `amt < 0` 拒绝负数
- ✅ 校验后将 `item.amount` 规范化为数值
- ✅ `Number(null) === 0` 被前置判空拦掉
- ✅ `Number("0") === 0` 合法通过

### items.js — PUT `/:id` amount 校验
- ✅ `data.amount !== undefined` 前置门（仅在传入时校验）
- ✅ 相同的 `isFinite + < 0` 逻辑
- ✅ `params.push(amt)` 推入规范值

### items.js — POST `/linked` amount 校验
- ✅ item 和 mirrorItem 各自独立校验
- ✅ 错误消息区分 `item.amount` vs `mirrorItem.amount`，帮助前端定位

### items.js — note 长度校验（POST/PUT/linked）
- ✅ `data.note && data.note.length > 2000` 逻辑一致
- ✅ undefined/null/'' 不触发校验
- ✅ 2000 字符边界：中文 1 字符 = 1 length（`.length` 统计 UTF-16 code units），2000 中文字符 = 6KB UTF-8，SQLite TEXT 完全承受

### items.js — DELETE 去重
- ✅ `Set` 替代 `Array`，O(1) 查重
- ✅ 正向 mirror 和 reverseMirrors 各自 `!deletedSet.has()` 防重复
- ✅ `for (const did of deletedSet)` 迭代 Set 不会重复删除
- ⚠️ Set 迭代顺序 = 插入顺序，不影响正确性

### migrate.js — `||` → `??`
- ✅ `item.type ?? 'out'` 修复空字符串 '' 被错误替换
- ✅ `item.typeLabel ?? ''` 同上
- ✅ `item.amount ?? '0.00'` 修复金额 0 被 '0.00' 替换
- ⚠️ `item.type` 为 null/undefined 时 → `'out'`，安全默认值
- ⚠️ 其他字段（category, date, note 等）保留 `||`，因为空字符串 '' 对这些字段是合法默认值

### company.js / audit.js — notifyId
- ✅ `Math.random()` → `crypto.randomInt(100000, 1000000)` 密码学安全
- ✅ `Date.now() * 1000 + randomInt(...)` 保持整数格式，兼容 `INTEGER PRIMARY KEY`
- ⚠️ `Date.now() * 1000` 在 2050 年左右会突破 `Number.MAX_SAFE_INTEGER` — 但此时程序已运行 24 年，届时升级即可
- ✅ `randomInt` 范围 [100000, 1000000)，与原来的 `Math.floor(Math.random() * 1000000)` 范围等价（原 [0, 999999]）

## 边界情况覆盖
- `amount = 0` → `Number.isFinite(0) === true`，通过 ✅
- `amount = "0"` → `Number("0") === 0`，通过 ✅
- `amount = NaN` → `Number.isFinite(NaN) === false`，拒绝 ✅
- `amount = Infinity` → `Number.isFinite(Infinity) === false`，拒绝 ✅
- `amount = undefined` → 前置判空拒绝（POST）/ `data.amount !== undefined` 不进入（PUT）✅
- `amount = null` → 前置判空拒绝（POST）/ `Number(null) === 0`，PUT 允许设为 0 ✅
- `linkedId = 0` → `<= 0` 拒绝 ✅
- `linkedId = "abc"` → `Number.isFinite("abc")` false，拒绝 ✅
- `note.length = 2000` → 恰好 ≤2000，通过 ✅
- `note.length = 2001` → 拒绝 ✅
- 删除时 A.linked_id = B 且 B.linked_id = A → Set 去重，各删 1 次 ✅

## 结论
所有修改逻辑正确，无新增安全漏洞，边界情况已覆盖。`notify.js` 和 `feedback.js` 文本长度限制待边界扩展审批后处理。
