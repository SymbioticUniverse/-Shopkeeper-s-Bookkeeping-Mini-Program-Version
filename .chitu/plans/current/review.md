## OCR 路由修复自审

### 改动文件
- `backend/src/routes/ocr.js` — 全文重写

### 关键变更审计

| # | 变更 | 正确性 | 说明 |
|---|------|--------|------|
| 1 | endpoint: `ocr-api.cn-hangzhou.aliyuncs.com` | ✅ | 文字识别OCR 仅在 cn-hangzhou 有服务接入点 |
| 2 | Action: `RecognizeAllText` | ✅ | 专业单品版 API |
| 3 | Version: `2021-07-07` | ✅ | 对应 API 版本 |
| 4 | 参数: `Url` (非 `ImageURL`) + `Type=General` | ✅ | 按 SDK 源码确认 |
| 5 | 混合发送: Type/Url→query, 签名→body | ✅ | 实测通过（IllegalImageUrl 说明参数被正确解析） |
| 6 | V1 签名 (HMAC-SHA1) | ✅ | 用户 AK 不支持 V3，V1 已验证可用 |
| 7 | `extractTextLines()` 适配 RecognizeAllText 响应 | ⚠️ | 响应结构基于文档推测，实测后需验证 |
| 8 | `httpsPost` → `httpsPostWithQuery` | ✅ | 新增 query 参数支持 |

### 风险点
- **extractTextLines() 未实测**：OCR API 的完整成功响应尚未获取（`IllegalImageUrl` 因图片不可用），`SubImages.BlockInfo.BlockDetails.Text` 路径基于 SDK 类型定义推断，需用户提供公网可访问图片 URL 后验证
- **Type 枚举值**：当前硬编码 `General`，后续可能需支持 `IdCard`/`Invoice` 等

### 遗留
- 图片需托管在 OSS 或公网可访问地址
- needToBuyTest 可能需要预付包月（[购买页](https://common-buy.aliyun.com/?commodityCode=ocr_api_personal)）
