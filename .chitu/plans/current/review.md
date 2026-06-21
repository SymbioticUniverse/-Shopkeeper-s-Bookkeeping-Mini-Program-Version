# Self-Review — 修复 typeLabel 校验 + date 格式校验

## 改动文件
- `backend/src/routes/items.js`

## 改动内容

### Fix 1: typeLabel 校验从 includes 改为精确白名单
- **前**: `!data.typeLabel.includes('收入')` 会错误拒绝 `'垫付'`
- **后**: `['收入', '垫付']` 白名单精确匹配，type='in' 接受 收入/垫付，type='out' 接受 支出/应付
- **影响**: API.md 4.4 节规定的 settle 流程（通过 updateItem 改 typeLabel）现在可以正常工作

### Fix 2: date 格式校验
- 新增 `isValidDate()` 工具函数，双重校验：正则 `/^\d{4}-\d{2}-\d{2}$/` + `new Date` 避免自动修正
- 在 3 个端点加入校验：`POST /`、`PUT /:id`、`POST /linked`（item + mirrorItem）

## 边界情况验证
- 空字符串 → 拒绝 ✅
- `/` 分隔符 → 拒绝 ✅
- `2026-02-30` 无效日期 → 拒绝 ✅
- `2026-06-21` 合法 → 通过 ✅
- typeLabel 白名单全覆盖：收入/垫付/支出/应付 ✅
- settle 22/22 回归通过 ✅

## 未修复项
- `getSetting` 返回 `null` 而非 `undefined`：JSON 规范无法表达 undefined，`null` 函数等价，不修
- Settle preview/execute 端点：近期事件提及但 API.md 无此接口，当前 `/settle` + `/settle-confirm` 已满足需求
