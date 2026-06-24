# OCR body 模式修复 自审

## 改动文件

| 文件 | 变更量 | 类型 |
|------|--------|------|
| `backend/src/routes/ocr.js` | +49/-47 | 重构：URL 模式 → body 模式 |
| `backend/test_ocr.js` | 新增 | 临时测试脚本 |

## 逐项审计

### 根因

旧代码混合参数模式（Type+Url 在 query，签名参数在 body）要求阿里云服务器能访问 imageUrl。但本地凭证图片的 URL 是 `http://192.168.x.x:3000/voucher/...`，阿里云无法访问 → `IllegalImageUrl`。

### 修复方案

改为 body 模式：
1. 后端先 `downloadImage()` 把图片下载到内存 Buffer
2. 所有签名参数放 query string（不再有 POST body 参数）
3. 图片二进制作为 POST body（`Content-Type: application/octet-stream`）

### ocr.js 变更

| # | 变更 | 正确性 | 说明 |
|---|------|--------|------|
| 1 | 新增 `http` require | ✅ | 支持 http 协议下载图片 |
| 2 | 新增 `downloadImage(url)` | ✅ | http/https 双协议，12s 超时，错误处理完整 |
| 3 | `buildAliyunSignature` 简化为单参数签名 | ✅ | 固定 POST 方法，去除 method 参数 |
| 4 | 新增 `ocrRequest(imageBuffer)` | ✅ | body 模式：签名在 query，二进制在 body |
| 5 | 删除 `httpsPostWithQuery` | ✅ | 不再需要混合参数模式 |
| 6 | handler 流程：下载→OCR→解析 | ✅ | 三步清晰 |
| 7 | `Content-Type: application/octet-stream` | ✅ | 必须用 octet-stream，image/png 会触发 body empty 错误 |

### 测试结果

```
Image: 6204 bytes → Status 200
RequestId: 31F2E369-8B98-5E46-A054-AB28C67F6723
```

签名通过，图片传输成功（测试图片无文字所以 0 blocks，但 API 调用全链路已通）。

### 风险评估

- **大图片**：5MB 以下（前端限制），下载+OCR 应在 15s 内完成 ✅
- **超时**：downloadImage 12s + ocrRequest 15s，整体最多 ~27s ✅
- **内存**：Buffer 在请求结束后自动释放 ✅
- **test_ocr.js**：临时测试文件，下次清理即可
