# Review — OCR 修复 + 关键词驱动解析 + 凭证持久化 + 账单分组布局

## 变更文件

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `backend/src/routes/ocr.js` | 修改 | 修复 extractTextLines 字段名 Bug + 多重健壮性增强 |
| `backend/src/routes/items.js` | 修改 | voucher 校验软化：本地路径静默降级为空 |
| `pages/mingxi/mingxi.js` | 修改 | 关键词驱动 7 字段弹性解析替代旧正则；新增日期分组 |
| `pages/mingxi/mingxi.wxml` | 修改 | 明细列表按日期分组展示；报表汇总区独立滚动 |
| `pages/mingxi/mingxi.wxss` | 修改 | 移除 bill-date 样式、新增 date-group-header、调整布局 |
| `training/asr_training_template.csv` | 修改 | 移除「正确文本」列（后端自动拼装） |
| `training/asr_longtext_template.csv` | 修改 | 移除「正确分句」列；西瓜分类餐饮→购物 |
| `API.md` | 修改 | 新增 §5.2.1 弹性解析规则、§5.12 AI 财务分析、§7.8 凭证持久化 |

## 自审结果

### 核心修复 — OCR 字段名 Bug

- **根因**：`extractTextLines()` 读 `block.Text`，但 RecognizeAllText API 返回 `block.BlockContent`
- ✅ 改为 `block.BlockContent`，与阿里云 SDK `RecognizeAllTextResponseBodyData.BlockDetailsElement.BlockContent` 对齐
- ✅ 新增 `Data.Content` 回落：SubImages 为空时用全局文本按空白分行
- ✅ `ocrRequest()` 返回 `{ statusCode, body }`，调用方分层检查 HTTP 状态码 + 业务错误码
- ✅ `isLocalVoucherUrl()` 支持 `/voucher/*` 本地路径（不再强制 http/https）

### 凭证校验软化

- ✅ POST `/items`、PUT `/:id`、POST `/linked` 三处统一：`validateVoucher` 返回 null 时静默设空，不再 400 拒绝整条记录
- ✅ 与 API.md §7.8 对齐：本地 `wxfile://` 路径不阻塞账单保存

### 关键词驱动解析 (_mockAiReply 重写)

- ✅ 时间词自动匹配（今天/昨天/前天/明天/后天），从输入文本移除
- ✅ 金额提取：数字正则优先，回落中文数字（一二三十百千万）
- ✅ 收支判定：13 个收入关键词 + 红包上下文判定（发红包=支出，收到红包=收入）
- ✅ 主体判定：5 个公司关键词，缺省个人
- ✅ 分类匹配：13 个分类 × 3-7 个关键词，命中后从文本移除
- ✅ 剩余文本清洗去无意义词、动词、量词 → 备注
- ✅ 无金额 → 追问「请问金额是多少？」
- ✅ `_saveAiRecord` 新增 `scope` 字段入账
- ✅ 空分类回落 `note || '其他'`

### 日期分组布局

- ✅ `_buildDetailGroups()` 按 YYYY-MM-DD 归组，生成 `{ dateLabel: "6月24日", items: [...] }`
- ✅ WXML: `wx:for="{{detailGroups}}"` 双层循环，每日期一组 `date-group-header`
- ✅ 移除 `.bill-date` 列（日期已由 group header 展示）
- ✅ 所有 setData 调用同步更新 `detailGroups`
- ✅ 报表汇总区新增独立 scroll-view，避免长列表被截断

### 训练数据 CSV

- ✅ 移除「正确文本」/「正确分句」列，对齐 API.md §5.3「正确文本由后端自动拼装」
- ✅ `asr_longtext_template.csv` 西瓜分类餐饮→购物（更准确）

### 边界情况

- ✅ OCR: SubImages 为空 → 回落 Data.Content
- ✅ OCR: HTTP 非 200 → 502 错误
- ✅ OCR: body.Code 存在 → 502 业务错误
- ✅ OCR: 图片无文字 → 422
- ✅ 凭证: wxfile:// 路径 → 静默降级，不丢记录
- ✅ AI: 无金额 → 追问而不是崩溃
- ✅ AI: 中文数字 "一百二" → 120
- ✅ AI: 红包上下文判定 → 收入/支出自动区分
- ✅ AI: 关键词命中后从文本移除 → 避免重复匹配
- ✅ UI: 明细为空时 groups 为空 → 无崩溃

### 潜在风险

- `_mockAiReply` 中文数字转换仅处理简单格式（不处理"三百二十一"这类），对记账场景够用
- date-group-header 在暗色模式下的 `.bill-item--voided` 删除线不再包含 bill-date（已移除）
- API.md 章节号从「五」改为「八」——需确认前端文档引用不受影响
