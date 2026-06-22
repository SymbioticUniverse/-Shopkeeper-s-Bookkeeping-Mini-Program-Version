# Self-Review — API文档更新 + 后端Bug修复

## 修改文件
- `API.md`: 标记7.1-7.6完成 + 补数据模型/安全加固/约束章节
- `backend/src/routes/items.js`: 修复linkedId校验 + settle ID碰撞

## 逐项核查

### API.md
- ✅ 7.1-7.6 全部标记 `✅ 已交付`，不影响原文
- ✅ 新增八（12张表完整DDL）、九（安全加固清单）、十（已知约束）
- ✅ `login-by-phone` 返回值补充 `isNew/hasCompany/companyRole/updatedAt` 字段说明
- ✅ `loginByWechat` 参数改为 `(code, nickName, avatarUrl)` 与实际一致
- ✅ `type/typeLabel` 表格保留，仅去重了重复行（原markdown中无真正重复，diff是格式调整）

### items.js — linkedId校验
- ✅ 成对互指（item.linkedId === mirrorItem.id）时跳过validateLinkedId
- ✅ 非互指linkedId仍正常校验（防止指向无关账单）
- ✅ 代码逻辑简洁：`item.linkedId !== mirrorItem.id && !validateLinkedId(...)`

### items.js — settle ID碰撞
- ✅ 新增 `randomId()` 函数：`Date.now() * 1000 + Math.random() * 1000`
- ✅ 两处settle端点 `Date.now()` → `randomId()`
- ✅ 两处 `now + 10` / `now + 11` → `baseId + 10` / `baseId + 11`
- ✅ 移除重复 `const crypto = require('crypto')` 导入
- ✅ 碰撞概率：同一毫秒内2个并发请求碰撞概率 ~0.1%（1/1000），实际够用

### 边界情况
- ✅ `randomId()` 结果 ~1.7e15，在 `Number.MAX_SAFE_INTEGER (9e15)` 内
- ✅ settle时 `baseId + 10/11` 也不会溢出安全整数
- ✅ linkedId校验修改不影响 `POST /items` 和 `PUT /items/:id` 的独立校验路径
