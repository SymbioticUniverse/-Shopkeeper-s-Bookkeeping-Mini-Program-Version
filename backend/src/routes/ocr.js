/**
 * 凭证图片识别（OCR）路由 — POST /api/ocr/parse
 *
 * 对接阿里云「文字识别OCR」专业单品 — RecognizeAllText API。
 * 前端扫描凭证 → 上传图片拿 URL → 提交 URL → 后端下载图片 → 以二进制 body 调 OCR → 返回结构化记账字段。
 *
 * 安全：
 *   - requireAuth 校验登录态
 *   - imageUrl 校验安全（仅允许 http/https）
 */

const express = require('express')
const crypto = require('crypto')
const https = require('https')
const http = require('http')
const path = require('path')
const fs = require('fs')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// ==================== 配置 ====================

const AK_ID = process.env.ALIYUN_ACCESS_KEY_ID
const AK_SECRET = process.env.ALIYUN_ACCESS_KEY_SECRET

/**
 * 文字识别OCR 服务接入点（仅 cn-hangzhou 地域）
 * 参考: https://help.aliyun.com/zh/ocr/developer-reference/api-ocr-api-2021-07-07-endpoint
 */
const OCR_ENDPOINT = 'ocr-api.cn-hangzhou.aliyuncs.com'

// ==================== 阿里云 V1 签名（HMAC-SHA1） ====================

/**
 * URL 编码（RFC 3986 兼容 Node v20）
 * Node v20 的 encodeURIComponent 不再编码 !'()* 需要手动补充。
 */
function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28')
    .replace(/\)/g, '%29').replace(/\*/g, '%2A').replace(/\+/g, '%20')
}

/**
 * 构建阿里云 OpenAPI V1 签名（HMAC-SHA1, SignatureVersion 1.0）
 * 签名参数全部放 query string（body 模式只传图片二进制）。
 */
function buildAliyunSignature(allParams, secret) {
  const sortedKeys = Object.keys(allParams).sort()
  const canonicalQuery = sortedKeys
    .map(k => percentEncode(k) + '=' + percentEncode(allParams[k]))
    .join('&')
  const stringToSign = 'POST&' + percentEncode('/') + '&' + percentEncode(canonicalQuery)
  return crypto.createHmac('sha1', secret + '&').update(stringToSign).digest('base64')
}

// 凭证图片本地存储目录（对齐 upload.js 的 VOUCHER_DIR）
const VOUCHER_DIR = path.join(__dirname, '..', 'data', 'voucher')

/**
 * 尝试从本地磁盘读取图片（URL 为本地 voucher 路径时走此通道，免 HTTP 401）。
 * 匹配 /voucher/ 或 /public/voucher/ 前缀，解析相对路径后从 VOUCHER_DIR 直读。
 * 返回 Buffer 或 null（非本地 URL 或文件不存在）。
 */
function readLocalVoucher(imageUrl) {
  const m = imageUrl.match(/\/(?:public\/)?voucher\/(.+?)(?:\?|$)/)
  if (!m) return null
  const relPath = m[1].replace(/\\/g, '/')
  const absPath = path.resolve(VOUCHER_DIR, relPath)
  // 防路径穿越
  if (!absPath.startsWith(VOUCHER_DIR + path.sep)) return null
  try {
    return fs.readFileSync(absPath)
  } catch {
    return null
  }
}

/**
 * 下载远程图片到内存 Buffer
 */
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http
    const req = proto.get(url, { timeout: 12000 }, res => {
      if (res.statusCode !== 200) {
        return reject(new Error('图片下载失败，状态码: ' + res.statusCode))
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })
    req.on('error', reject)
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('图片下载超时')) })
  })
}

/**
 * 以 body 模式发起 OCR 请求：签名参数在 query string，图片二进制在 POST body。
 */
function ocrRequest(imageBuffer) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/\.\d{3}/, '')
    const nonce = crypto.randomUUID()

    const allParams = {
      AccessKeyId: AK_ID,
      Action: 'RecognizeAllText',
      Format: 'JSON',
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: nonce,
      SignatureVersion: '1.0',
      Timestamp: timestamp,
      Type: 'General',
      Version: '2021-07-07'
    }

    const signature = buildAliyunSignature(allParams, AK_SECRET)

    const queryParts = Object.keys(allParams).sort()
      .map(k => percentEncode(k) + '=' + percentEncode(allParams[k]))
    queryParts.push('Signature=' + percentEncode(signature))
    const queryStr = queryParts.join('&')

    const req = https.request({
      hostname: OCR_ENDPOINT,
      path: '/?' + queryStr,
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': imageBuffer.length
      },
      timeout: 15000
    }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve(data) }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('OCR 请求超时')) })
    req.write(imageBuffer)
    req.end()
  })
}

// ==================== OCR 响应解析 ====================

/**
 * 从 RecognizeAllText 响应中提取所有文本行。
 * 响应结构: Data.SubImages[] → BlockInfo.BlockDetails[] → Text
 */
function extractTextLines(result) {
  const lines = []
  const subImages = result?.Data?.SubImages
  if (Array.isArray(subImages)) {
    for (const sub of subImages) {
      const blocks = sub?.BlockInfo?.BlockDetails
      if (Array.isArray(blocks)) {
        for (const block of blocks) {
          if (block.Text) lines.push(block.Text)
        }
      }
      // 兼容: 部分单据类识别返回额外的结构化字段
      const kvInfo = sub?.KvInfo?.KvDetails
      if (Array.isArray(kvInfo)) {
        for (const kv of kvInfo) {
          if (kv.Key === 'Amount' || kv.Key === '金额') lines.push('金额:' + kv.Value)
          if (kv.Key === 'Date' || kv.Key === '日期') lines.push('日期:' + kv.Value)
        }
      }
    }
  }
  return lines
}

/**
 * 从 OCR 识别出的文本行中，抽取结构化记账字段。
 * 输入：OCR 返回的文本数组（每行一个字符串）
 * 输出：{ amount, category, note, date }
 */
function parseOcrResult(textLines) {
  const joined = textLines.join(' ')
  let amount = ''
  let note = ''
  let date = ''

  // 金额抽取：匹配 ¥ 或 元 前后的数字
  const amountPatterns = [
    /(?:¥|￥|CNY|RMB)\s*(\d{1,10}(?:\.\d{1,2})?)/i,
    /(\d{1,10}(?:\.\d{1,2})?)\s*(?:元|圆)/,
    /合计[：:]\s*(\d{1,10}(?:\.\d{1,2})?)/,
    /总计[：:]\s*(\d{1,10}(?:\.\d{1,2})?)/,
    /(?:金额|小写)[：:]\s*(\d{1,10}(?:\.\d{1,2})?)/
  ]
  for (const pat of amountPatterns) {
    const m = joined.match(pat)
    if (m) { amount = m[1]; break }
  }

  // 日期抽取
  const datePatterns = [
    /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})[日]?/,
    /(\d{4}\.\d{1,2}\.\d{1,2})/
  ]
  for (const pat of datePatterns) {
    const m = joined.match(pat)
    if (m) {
      date = m[1]
        .replace(/年|\./g, '-')
        .replace(/月|\./g, '-')
        .replace(/日/g, '')
      const parts = date.split('-')
      if (parts.length === 3) {
        date = parts[0] + '-' + parts[1].padStart(2, '0') + '-' + parts[2].padStart(2, '0')
      }
      break
    }
  }

  // 备注：取第一条非数字非符号为主的文本行（通常是商户名）
  for (const line of textLines) {
    const cleaned = line.trim()
    if (/^[\d¥￥.,:：\s-]+$/.test(cleaned)) continue
    if (/^\d{4}[-/]\d/.test(cleaned)) continue
    if (cleaned.length >= 2 && cleaned.length <= 50) {
      note = cleaned
      break
    }
  }

  return {
    amount: amount || '',
    category: '',
    note: note || '',
    date: date || new Date().toISOString().slice(0, 10)
  }
}

// ==================== 分类匹配 ====================

const CATEGORY_KEYWORDS = [
  { keywords: ['餐饮', '餐', '食', '餐厅', '饭', '火锅', '烧烤', '外卖', '美团'], cat: '餐饮' },
  { keywords: ['交通', '出行', '打车', '滴滴', '地铁', '公交', '加油', '油'], cat: '交通' },
  { keywords: ['购物', '超市', '商超', '便利', '淘宝', '京东', '拼多多'], cat: '购物' },
  { keywords: ['房租', '房贷', '租金', '物业'], cat: '房租' },
  { keywords: ['医疗', '药', '医院', '诊所', '挂号'], cat: '医疗' },
  { keywords: ['教育', '培训', '学费', '书', '课程'], cat: '教育' },
  { keywords: ['工资', '薪资', '薪水', '薪酬'], cat: '工资' },
  { keywords: ['通讯', '话费', '流量', '宽带'], cat: '通讯' },
]

function guessCategory(text) {
  const lower = text.toLowerCase()
  for (const item of CATEGORY_KEYWORDS) {
    for (const kw of item.keywords) {
      if (lower.includes(kw)) return item.cat
    }
  }
  return ''
}

// ==================== POST /api/ocr/parse ====================

router.post('/parse', requireAuth, async (req, res) => {
  if (!AK_ID || !AK_SECRET) {
    return res.status(503).json({
      error: 'OCR 服务未配置（缺少 ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET）'
    })
  }

  const { imageUrl } = req.body || {}

  if (!imageUrl || typeof imageUrl !== 'string') {
    return res.status(400).json({ error: '缺少 imageUrl 参数' })
  }

  if (!/^https?:\/\//.test(imageUrl)) {
    return res.status(400).json({ error: 'imageUrl 必须以 http:// 或 https:// 开头' })
  }

  try {
    // 1. 获取图片数据：优先本地磁盘直读（免 HTTP 401），否则远程下载
    const imageBuffer = readLocalVoucher(imageUrl) || await downloadImage(imageUrl)

    // 2. 以 body 模式调用 OCR
    const result = await ocrRequest(imageBuffer)

    // 3. 解析 OCR 结果
    const textLines = extractTextLines(result)
    if (textLines.length > 0) {
      const parsed = parseOcrResult(textLines)
      const allText = textLines.join(' ')
      const category = guessCategory(allText)

      res.json({
        ok: true,
        amount: parsed.amount,
        category: category || parsed.category,
        note: parsed.note,
        date: parsed.date
      })
    } else {
      const errMsg = result.Message || result.message || '图片未识别到文字'
      console.error('[OCR] 识别失败:', JSON.stringify(result))
      res.status(422).json({ error: 'OCR 识别失败: ' + errMsg })
    }
  } catch (e) {
    console.error('[OCR] 处理异常:', e.message)
    res.status(500).json({ error: 'OCR 服务异常: ' + e.message })
  }
})

module.exports = { ocr: router }
