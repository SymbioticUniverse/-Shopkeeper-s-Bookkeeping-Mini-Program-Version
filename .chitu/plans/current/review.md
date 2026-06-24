# Review — learn 模块实现

## 变更文件

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `backend/src/routes/learn.js` | 新增 | learn 路由：POST /upload, POST /upload-csv, GET /corrections, GET /item-categories, GET /patterns, GET /ocr-merchants |
| `backend/src/db.js` | 修改 | initSchema 新增 4 张学习库表 |
| `backend/src/app.js` | 修改 | 注册 /api/learn 路由 |

## 自审结果

### 正确性
- ✅ POST /api/learn/upload (asr_structured) — 实测返回 `{ok:true, correctionsAdded:2, itemCategoryMappingsAdded:2, patternsLearned:2}`
- ✅ POST /api/learn/upload (ocr) — 实测返回 `{ok:true, ocrMappingsAdded:2}`
- ✅ POST /api/learn/upload-csv — 实测 CSV 上传返回正确统计
- ✅ GET 查询端点均正常返回映射数据
- ✅ 路由受 requireAuth 保护，未登录返回 401

### 边界情况
- ✅ CSV 空文件 → 400 "CSV 文件为空或格式错误"
- ✅ 缺少 type/records → 400
- ✅ 不支持的 type → 400 "不支持的类型: xxx"
- ✅ diff 算法过滤纯标点差异、长度 <1 或 >6 的差异
- ✅ rawText === correctText 时不做 diff（跳过）
- ✅ 项目词为 '-' 时跳过 item-category 映射
- ✅ verb 为 '-' 时跳过 pattern 学习
- ✅ INSERT OR IGNORE 防重复映射

### 对齐 API.md
- ✅ 5.6 节 JSON 上传格式（type=asr_structured, 7字段+rawText+correctText）
- ✅ 5.6 节 CSV 上传格式（multipart, type=asr_structured）
- ✅ 5.4 节三层学习：错词纠错 → 项目词→分类 → 句式模式
- ✅ 5.8 节映射表：asr_corrections, item_category_map, asr_patterns, ocr_merchants
- ✅ 旧版接口兼容：type=asr, type=ocr
- ✅ 5.10 节长文本模式（type=asr_longtext 走 CSV）

### 潜在风险
- diff 算法是字符级 LCS O(mn)，对于长文本可能慢，但训练数据都是短句（<50字），可接受
- CSV 解析不支持字段内换行（标准 CSV 允许），对训练数据集场景足够
