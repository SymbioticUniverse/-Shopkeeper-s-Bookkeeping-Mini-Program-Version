/**
 * 语音识别（ASR）路由 — POST /api/asr/recognize
 *
 * 对接阿里云智能语音交互「一句话识别」RESTful API。
 * 前端录音 → 上传音频 → 后端调阿里云 NLS → 返回识别文本。
 *
 * 安全：
 *   - requireAuth 校验登录态
 *   - 临时文件用完即删
 *   - 音频大小上限 10MB
 */

const express = require('express')
const multer = require('multer')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const https = require('https')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// ==================== 配置 ====================

const AK_ID = process.env.ALIYUN_ACCESS_KEY_ID
const AK_SECRET = process.env.ALIYUN_ACCESS_KEY_SECRET
const ASR_APPKEY = process.env.ALIYUN_ASR_APPKEY

const NLS_TOKEN_ENDPOINT = 'nls-meta.cn-shanghai.aliyuncs.com'
const NLS_GATEWAY_ENDPOINT = 'nls-gateway.cn-shanghai.aliyuncs.com'

// 临时音频存储
const TEMP_DIR = path.join(__dirname, '..', 'data', 'temp')
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true })
}

const upload = multer({
  dest: TEMP_DIR,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
})

// ==================== 阿里云签名工具 ====================

/**
 * HMAC-SHA1 签名
 */
function hmacSha1(key, str) {
  return crypto.createHmac('sha1', key).update(str, 'utf8').digest()
}

/**
 * Base64 编码
 */
function base64(buf) {
  return buf.toString('base64')
}

/**
 * URL 编码（RFC 3986）
 */
function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
    .replace(/\+/g, '%20')
}

/**
 * 构建阿里云 OpenAPI 签名（HMAC-SHA1, SignatureVersion 1.0）
 * 参考：https://help.aliyun.com/document_detail/25490.html
 */
function buildAliyunSignature(method, params, secret) {
  // 1. 排序参数（按 key 字典排序）
  const sortedKeys = Object.keys(params).sort()
  const canonicalQuery = sortedKeys
    .map(k => percentEncode(k) + '=' + percentEncode(params[k]))
    .join('&')

  // 2. 构建待签名字符串
  const stringToSign = method + '&' + percentEncode('/') + '&' + percentEncode(canonicalQuery)

  // 3. HMAC-SHA1 签名
  const signature = hmacSha1(secret + '&', stringToSign)
  return base64(signature)
}

/**
 * 发起 HTTPS GET 请求，返回 parsed JSON
 */
function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get({ hostname, path, headers }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve(data) }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('请求超时')) })
  })
}

/**
 * 发起 HTTPS POST 请求，发送二进制 body
 */
function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path, method: 'POST', headers,
      timeout: 30000
    }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve(data) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ==================== NLS Token 获取 ====================

/** 缓存的 NLS token，避免每次请求都重新获取 */
let _nlsTokenCache = { token: null, expireTime: 0 }

/**
 * 获取阿里云 NLS Token（用于语音识别鉴权）
 */
async function getNlsToken() {
  const now = Math.floor(Date.now() / 1000)

  // 缓存未过期直接返回
  if (_nlsTokenCache.token && _nlsTokenCache.expireTime > now + 60) {
    return _nlsTokenCache.token
  }

  const timestamp = new Date().toISOString().replace(/\.\d{3}/, '')
  const nonce = crypto.randomUUID()

  const params = {
    AccessKeyId: AK_ID,
    Action: 'CreateToken',
    Format: 'JSON',
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: nonce,
    SignatureVersion: '1.0',
    Timestamp: timestamp,
    Version: '2019-02-28'
  }

  const signature = buildAliyunSignature('GET', params, AK_SECRET)
  const query = Object.keys(params).sort()
    .map(k => percentEncode(k) + '=' + percentEncode(params[k]))
    .join('&') + '&Signature=' + percentEncode(signature)

  const result = await httpsGet(NLS_TOKEN_ENDPOINT, '/pop/2019-02-28/tokens?' + query)

  // 新版 API 返回 Token.Id，旧版返回 NlsToken.Token
  const token = (result.Token && result.Token.Id) || (result.NlsToken && result.NlsToken.Token)
  const expireTime = (result.Token && result.Token.ExpireTime) || (result.NlsToken && result.NlsToken.ExpireTime) || now + 3600

  if (token) {
    _nlsTokenCache = { token, expireTime }
    return token
  }

  throw new Error('获取 NLS Token 失败: ' + JSON.stringify(result))
}

// ==================== POST /api/asr/recognize ====================

router.post('/recognize', requireAuth, (req, res, next) => {
  // 前置检查配置
  if (!AK_ID || !AK_SECRET || !ASR_APPKEY) {
    return res.status(503).json({
      error: '语音识别服务未配置（缺少 ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET / ALIYUN_ASR_APPKEY）'
    })
  }

  upload.single('file')(req, res, function (uploadErr) {
    if (uploadErr) {
      if (uploadErr instanceof multer.MulterError) {
        if (uploadErr.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: '音频文件不能超过 10MB' })
        }
        return res.status(400).json({ error: '上传失败: ' + uploadErr.message })
      }
      return res.status(400).json({ error: uploadErr.message })
    }

    if (!req.file) {
      return res.status(400).json({ error: '未收到音频文件' })
    }

    const filePath = req.file.path

    // 异步处理：调用阿里云 ASR
    ;(async () => {
      try {
        // 1. 读取音频文件
        const audioData = fs.readFileSync(filePath)

        // 2. 获取 NLS Token
        const token = await getNlsToken()

        // 3. 调用一句话识别 API
        // 阿里云一句话识别 RESTful API：
        // POST https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/asr?appkey=xxx
        const apiPath = '/stream/v1/asr?appkey=' + encodeURIComponent(ASR_APPKEY)
          + '&format=pcm&sample_rate=16000&enable_intermediate_result=false'

        const result = await httpsPost(NLS_GATEWAY_ENDPOINT, apiPath, {
          'X-NLS-Token': token,
          'Content-Type': 'application/octet-stream',
          'Content-Length': audioData.length
        }, audioData)

        // 4. 解析结果
        if (result.status === 20000000 && typeof result.result === 'string') {
          res.json({ ok: true, text: result.result })
        } else {
          const errMsg = result.status_text || result.message || '识别失败'
          console.error('[ASR] 识别失败:', JSON.stringify(result))
          res.status(422).json({ error: '语音识别失败: ' + errMsg })
        }
      } catch (e) {
        console.error('[ASR] 处理异常:', e.message)
        res.status(500).json({ error: '语音识别服务异常: ' + e.message })
      } finally {
        // 5. 清理临时文件
        try { fs.unlinkSync(filePath) } catch { /* ignore */ }
      }
    })()
  })
})

module.exports = { asr: router }
