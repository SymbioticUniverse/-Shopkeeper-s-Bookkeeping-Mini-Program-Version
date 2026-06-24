# OCR 本地 voucher 直读修复 自审

## 根因

前端上传凭证后得 URL `http://host/voucher/4/2026/06/uuid.png`，提交 OCR 时后端 `downloadImage()` 用普通 HTTP GET 下载，但 `/voucher/*` 路由有 `requireAuth` 中间件 → 401。

## 修复

新增 `readLocalVoucher(imageUrl)`：正则匹配 `/voucher/` 或 `/public/voucher/` 前缀，提取相对路径后从 `VOUCHER_DIR` 直接 `fs.readFileSync`。handler 改为 `readLocalVoucher(imageUrl) || await downloadImage(imageUrl)` 短路求值。

| # | 变更 | 正确性 |
|---|------|--------|
| 1 | require `path` + `fs` | ✅ |
| 2 | 新增 `VOUCHER_DIR` 常量 | ✅ 对齐 upload.js 的 `../data/voucher` |
| 3 | `readLocalVoucher` 正则+路径穿越防护+try/catch | ✅ 非本地 URL 返回 null 走 HTTP fallback |
| 4 | handler `readLocalVoucher() \|\| downloadImage()` | ✅ 短路求值，本地命中不发起 HTTP |

## 风险评估

- **正则** `/\/(?:public\/)?voucher\/(.+?)(?:\?|$)/`：匹配 voucher 和 public/voucher 两种前缀 → ✅
- **路径穿越防护**：`path.resolve` 后 `startsWith(VOUCHER_DIR + path.sep)` → ✅  
- **fallback**：非本地 URL 或文件不存在时返回 null，走原有 HTTP 下载 → ✅
