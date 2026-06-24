# ASR 语音识别 + OCR/ASR 路由挂载 自审

## 改动文件

| 文件 | 变更量 | 类型 |
|------|--------|------|
| `pages/mingxi/mingxi.js` | +108/-47 | WeChatSI 真实语音识别 |
| `backend/src/app.js` | +12/-3 | ASR/OCR 路由挂载 + dotenv |
| `backend/package.json` | +5 | OCR SDK + dotenv 依赖 |
| `API.md` | +113 | ASR/OCR API 文档 |
| `assets/.DS_Store` | binary | 应 gitignore |
| `.chitu/checkpoint.json` | restored | 已从 HEAD 恢复干净态 |
| `.chitu/context/intent.json` | ±1 | 聊天状态更新 |

## 逐文件审计

### pages/mingxi/mingxi.js

| # | 变更 | 正确性 | 说明 |
|---|------|--------|------|
| 1 | `_ensureRecognizer()` 懒加载 WeChatSI 插件 | ✅ | `requirePlugin('WechatSI')` try-catch，失败返回 null |
| 2 | `_startRecognize(forWho)` 区分入口 | ✅ | 'tab'=底部长按 / 'chat'=对话框语音键 |
| 3 | `_stopRecognize()` 停止录音 | ✅ | try-catch 保护 |
| 4 | `_onRecognizeDone(text)` 按入口分发 | ✅ | 'chat'→填输入框发送, 其他→开对话窗 |
| 5 | `_sendAiUserText()` 保留历史消息 | ✅ | 不再每次替换，累积 aiMessages |
| 6 | 旧 `onAiChatOpen()` 逻辑被替换 | ✅ | 旧代码用随机 demo text，新版用真实 ASR |
| 7 | 旧 `onAiVoiceStart/End` 用随机 demo | ✅ | 新版调用 `_startRecognize/_stopRecognize` |
| 8 | `onAiRecordEnd` 不再直接设 aiRecording=false | ✅ | 改为调用 `_stopRecognize()`，识别结果在 onStop 回调处理 |
| 9 | 空文本保护 | ✅ | `_onRecognizeDone` 中 trim 后为空则 toast 提示 |

**风险评估**：
- WeChatSI 插件需在小程序后台添加，否则 `requirePlugin` 抛异常 → 已 try-catch 处理
- 与 API.md 战略方针（后端 ASR）存在分歧 — API.md 标注为「后端接口就绪后执行」的过渡方案
- `_ensureRecognizer` 返回 null 时 toast 提示用户添加插件

### backend/src/app.js

| # | 变更 | 正确性 | 说明 |
|---|------|--------|------|
| 1 | `require('dotenv').config()` | ✅ | 置于文件顶部，先于其他 require |
| 2 | 版本号 `v1.2.0 — ASR/OCR 识别` | ✅ | 如实反映新增能力 |
| 3 | `app.use('/api/asr', asrRouter)` | ✅ | asr.js 已存在且提交 |
| 4 | `app.use('/api/ocr', ocrRouter)` | ✅ | ocr.js 已存在且提交 |

### backend/package.json

| # | 变更 | 正确性 | 说明 |
|---|------|--------|------|
| 1 | `@alicloud/ocr-api20210707` | ⚠️ | OCR SDK，但 ocr.js 已改用 V1 手写签名，此依赖可能冗余 |
| 2 | `@alicloud/ocr20191230` | ⚠️ | 同上，调试期间安装 |
| 3 | `@alicloud/openapi-client` | ⚠️ | V3 SDK 基类，同冗余 |
| 4 | `@alicloud/pop-core` | ✅ | V1 签名 SDK，ocr.js 最终方案依赖此包 |
| 5 | `dotenv` | ✅ | app.js 已 require |

**风险**：`@alicloud/ocr-api20210707`、`@alicloud/ocr20191230`、`@alicloud/openapi-client` 可能未被使用，属于调试残留。但保留无害，且 ocr.js 的 `@alicloud/pop-core` 依赖确认有用。

### API.md

| # | 变更 | 正确性 | 说明 |
|---|------|--------|------|
| 1 | 2.13 识别 — `asrRecognize` / `ocrParse` | ✅ | 接口定义清晰 |
| 2 | 接口总览新增 #32 #33 | ✅ | 编号连续 |
| 3 | 任务 11 — ASR/OCR 后端承接 | ✅ | 战略方针 + 前后端接口 + 前端改造要点 |
| 4 | 7.2 头像路由状态更新 | ✅ | `✅ 已生效` |

**注意**：API.md 战略方针说「前端不直接对接任何识别 SDK 或插件」，但 mingxi.js 实际用了 WeChatSI 插件。API.md 标注了「前端改造要点（等后端接口就绪后执行）」— 当前状态是过渡方案。

## 综合评价

- **mingxi.js 语音识别**是有效的前端功能提升：从随机 demo text → 真实 WeChatSI 语音转文字
- **app.js 路由挂载**使 ASR/OCR 后端接口可用
- **API.md 文档**完整描述了识别能力的技术方案和演进路径
- **遗留**：OCR SDK 依赖可能部分冗余（调试残留），但不影响运行
