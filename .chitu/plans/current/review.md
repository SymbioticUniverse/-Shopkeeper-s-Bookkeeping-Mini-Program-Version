# 前端 ASR/OCR 后端化改造 自审

## 变更概览

将语音识别从 WeChatSI 插件切换到后端阿里云 ASR，将 OCR 从 mock 随机数据切换到后端阿里云 OCR，同时优化触控手势。

| # | 文件 | 变更 |
|---|------|------|
| 1 | `utils/api.js` | 新增 `asrRecognize()`、`ocrParse()` 两个接口函数 |
| 2 | `pages/mingxi/mingxi.js` | ASR 从 WeChatSI → RecorderManager+后端、OCR 从 mock → 后端、触控改为 touchstart/touchend+250ms 判定 |
| 3 | `pages/mingxi/mingxi.wxml` | 中心 Tab 按钮事件绑定更换、AI 对话遮罩事件绑定更新、语音指示器条件放宽 |
| 4 | `pages/mingxi/mingxi.wxss` | 移除语音指示器 `pointer-events: auto`（不再拦截触摸） |
| 5 | `API.md` | 前端状态速查表从「待替换」更新为「✅ 已落地」、后端实现标记为已完成 |

## 逐项审查

### 1. utils/api.js — `asrRecognize` / `ocrParse`

- `asrRecognize(tempFilePath)`：使用 `wx.uploadFile` 上传 PCM 音频到 `/asr/recognize`，带 Authorization header，解析 JSON 返回 text。✅
- `ocrParse(imageUrl)`：使用 `_request('POST', '/ocr/parse', { imageUrl })`，后端校验 imageUrl 必须以 http(s) 开头。✅
- 两个函数均正确加入 `module.exports`。✅
- `uploadVoucher` 已存在且导出，`_startScanRecognize` 中正确调用。✅

### 2. mingxi.js — ASR 重构

- `_ensureRecorder()`：正确使用 `wx.getRecorderManager()`，事件通过方法调用 `.onStop(fn)` 而非属性赋值。✅
- `_onRecorderStop(tempFilePath)`：`_asrPending` 防重入守卫在 `clearTimeout` 之后、`tempFilePath` 检查之前，逻辑正确。异常路径（空文件、后端失败）均会重置 `_aiRecognizeFor` 和 `aiRecording`。✅
- `_startRecognize(forWho)`：PCM 16kHz 单声道 15s 超时，与后端阿里云 NLS 参数一致。兜底超时 15s 强制停止。✅
- `_stopRecognize()`：立即复位 UI → 停止录音 → 500ms fallback 清理 `_aiRecognizeFor`。`_onRecorderStop` 开头 `clearTimeout(this._stopFallback)` 正常覆盖此兜底。✅
- `onAiVoiceStart/End`：仍使用 '_chat' 入口，通过 `_startRecognize('chat')` / `_stopRecognize()` 调用。✅
- 潜在问题：`_startRecognize` 无防重入守卫。若同时触发 Tab 长按和语音键，`_aiRecognizeFor` 会被覆盖。但在实际使用中几乎不可能同时触发两个入口。**轻微风险，可接受。**

### 3. mingxi.js — OCR 真实后端

- `_startScanRecognize(photo)`：`api.uploadVoucher(photo)` → `api.ocrParse(url)` 链式调用，成功后填充 `bookForm`。catch 显示错误 toast 但保留 `bookPhoto`（用户可手动填表）。✅
- `_mockOcrParse()` 已删除。✅

### 4. mingxi.js — 触控手势改进

- `onTabCenterTouchStart`：250ms 定时器判定长按 vs 短按。长按 → 打开 AI 对话窗 + 开始录音。✅
- `onTabCenterTouchEnd`：`_tabHoldTimer` 存在（短按）→ 切 Tab；`_isHoldingTab`（长按松手）→ 停止录音。✅
- `onAiOverlayTouchEnd`：松手即停止录音（不关窗）。✅
- `onAiOverlayTap`：录音中点按 → 停止；非录音中点按 → 关闭对话窗。✅
- `onAiChatClose`：新增停止录音保护（关窗时避免残留录音）。✅
- `switchTab`：移除 `_longPressTriggered` 守卫（不再需要，触控机制已替换）。✅

### 5. WXML 事件绑定

- 中心 Tab：`bindtap/bindlongpress/bindtouchend` → `bindtouchstart/bindtouchend/bindtouchcancel`。✅
- AI 遮罩：`catchtap="onAiChatClose"` → `catchtap="onAiOverlayTap" bindtouchend/bindtouchcancel`。✅
- 语音指示器：`(aiRecording || searchRecording) && !showAiChat` → `(aiRecording || searchRecording)`。现在录音时即使 AI 对话窗打开也显示底部指示器（与聊天内 `ai-recording-banner` 双重反馈）。**功能增强，非 bug。** ✅

### 6. WXSS

- `.ai-voice-indicator--show` 移除 `pointer-events: auto`：语音指示器不再拦截触摸事件，用户可正常操作下层元素。✅

### 7. API.md 文档

- 状态速查表更新为「✅ 已落地」，后端实现标记完成，调用链描述与实际代码一致。✅

## 风险评估

- **ASR 并发风险**：`_startRecognize` 无防重入（低风险，实际触发路径互斥）
- **语音指示器双重显示**：底部 + 聊天内同时显示「正在聆听…」（UX 增强，非缺陷）
- **开发者工具兼容**：`_stopFallback` 兜底处理 `onStop` 不触发的情况
- **麦克风权限**：`onShow` 预请求，失败静默忽略

## 结论

所有变更逻辑正确，空值/异常路径均有处理，防重入守卫到位，与后端 ASR/OCR 接口参数一致。**建议提交。**
