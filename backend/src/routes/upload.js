/**
 * 凭证上传路由 — POST /api/upload  +  GET /voucher/*（鉴权代理）
 *
 * 安全加固：
 *   - Magic bytes 校验真实图片类型，拒绝伪造 MIME
 *   - 扩展名由服务端白名单生成（.jpg / .png），不信任客户端 originalname
 *   - userId 防御性 sanitize（防 ../ 路径穿越）
 *   - 凭证访问需登录 + 归属校验（替代裸 express.static）
 *   - 响应头 X-Content-Type-Options: nosniff 防 MIME 嗅探 XSS
 */
const express = require('express')
const multer = require('multer')
const path = require('path')
const crypto = require('crypto')
const fs = require('fs')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// 存储目录
const VOUCHER_DIR = path.join(__dirname, '..', 'data', 'voucher')

// 确保目录存在
if (!fs.existsSync(VOUCHER_DIR)) {
  fs.mkdirSync(VOUCHER_DIR, { recursive: true })
}

// ==================== Magic Bytes 检测 ====================

/** 读取文件头部 magic bytes 判断真实图片类型，返回 'jpg' | 'png' | null */
function detectImageType(filePath) {
  let fd
  try {
    const buf = Buffer.alloc(4)
    fd = fs.openSync(filePath, 'r')
    fs.readSync(fd, buf, 0, 4, 0)

    // PNG: 89 50 4E 47
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
      return 'png'
    }
    // JPEG: FF D8 FF
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
      return 'jpg'
    }
    return null
  } catch {
    return null
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd) } catch { /* ignore */ }
    }
  }
}

// ==================== 工具函数 ====================

/** 扩展名 → Content-Type 映射 */
const EXT_CONTENT_TYPE = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png'
}

/** 防御性 sanitize userId：剔除路径分隔符和相对路径标记 */
function sanitizeUserId(userId) {
  return String(userId).replace(/[\/\\\.]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown'
}

// ==================== Multer 配置 ====================

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const now = new Date()
    const safeId = sanitizeUserId(req.userId)
    const isAvatar = req.query.type === 'avatar'
    const subDir = isAvatar ? path.join(safeId, 'avatar') : path.join(safeId,
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'))
    const dir = path.join(VOUCHER_DIR, subDir)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: function (req, file, cb) {
    // 先用 .tmp 后缀保存，上传完成后按 magic bytes 重命名为正确扩展名
    const uuid = crypto.randomUUID()
    cb(null, uuid + '.tmp')
  }
})

// 文件过滤器：先做 MIME 初步过滤（深度校验在 magic bytes 阶段）
function fileFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png']
  if (allowed.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('仅支持 jpg/jpeg/png 格式图片'), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
})

// ==================== POST /api/upload — 上传 ====================

router.post('/', requireAuth, (req, res, next) => {
  upload.single('file')(req, res, function (err) {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: '图片大小不能超过 5MB' })
        }
        return res.status(400).json({ error: '上传失败: ' + err.message })
      }
      return res.status(400).json({ error: err.message })
    }

    if (!req.file) {
      return res.status(400).json({ error: '未收到图片文件' })
    }

    // Magic bytes 校验真实图片类型
    const realType = detectImageType(req.file.path)
    if (!realType) {
      // 不是真实图片，删除并拒绝
      try { fs.unlinkSync(req.file.path) } catch { /* ignore */ }
      return res.status(400).json({ error: '文件内容不是有效图片，请上传 jpg 或 png 格式' })
    }

    // 按真实类型重命名文件
    const ext = '.' + realType
    const newPath = req.file.path.replace(/\.tmp$/, ext)
    try {
      fs.renameSync(req.file.path, newPath)
    } catch (renameErr) {
      try { fs.unlinkSync(req.file.path) } catch { /* ignore */ }
      return res.status(500).json({ error: '文件保存失败' })
    }
    req.file.path = newPath
    req.file.filename = path.basename(newPath)

    // 构建可访问 URL
    // VOUCHER_BASE_URL: 生产环境设为 CDN 域名
    const baseUrl = process.env.VOUCHER_BASE_URL ||
      `${req.protocol}://${req.get('host')}`
    const relativePath = path.relative(VOUCHER_DIR, newPath)
    const isAvatar = req.query.type === 'avatar'
    const urlPrefix = isAvatar ? '/public/voucher/' : '/voucher/'
    const url = baseUrl + urlPrefix + relativePath.replace(/\\/g, '/')

    res.json({ ok: true, url })
  })
})

// ==================== GET /voucher/* — 鉴权代理（替代裸 express.static） ====================

/**
 * 凭证静态文件鉴权代理
 * 校验：登录态 + 文件路径归属当前用户
 * 安全头：X-Content-Type-Options: nosniff
 */
function serveVoucher(req, res, next) {
  // 从 URL 中提取相对路径（去掉 /voucher/ 前缀）
  const relPath = req.path.replace(/^\/+/, '')  // e.g. "1/2026/06/uuid.jpg"
  const safeId = sanitizeUserId(req.userId)

  // 归属校验：路径必须以 userId 目录开头
  if (!relPath.startsWith(safeId + '/') && !relPath.startsWith(safeId + '\\')) {
    return res.status(403).json({ error: '无权访问该凭证' })
  }

  const absPath = path.resolve(VOUCHER_DIR, relPath)

  // 二次确认 resolve 后仍在 VOUCHER_DIR 内（防路径穿越）
  if (!absPath.startsWith(VOUCHER_DIR + path.sep)) {
    return res.status(403).json({ error: '非法路径' })
  }

  if (!fs.existsSync(absPath)) {
    return res.status(404).json({ error: '凭证不存在' })
  }

  const ext = path.extname(absPath).toLowerCase()
  const contentType = EXT_CONTENT_TYPE[ext] || 'application/octet-stream'

  res.setHeader('Content-Type', contentType)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'private, max-age=86400')
  fs.createReadStream(absPath).pipe(res)
}

module.exports = { upload: router, serveVoucher, servePublicVoucher }

// ==================== GET /public/voucher/* — 免鉴权静态服务（头像等公开资源） ====================

/**
 * 公开凭证服务 — 无需登录，用于 <image src> 直接加载
 * 仅接受 /public/voucher/{safeId}/avatar/ 路径（头像专用）
 * 安全头：X-Content-Type-Options: nosniff
 */
function servePublicVoucher(req, res) {
  const relPath = req.path.replace(/^\/+/, '')  // e.g. "1/avatar/uuid.jpg"

  // 仅允许 avatar 子路径（防止越权访问非公开凭证）
  const parts = relPath.replace(/\\/g, '/').split('/')
  if (parts.length < 3 || parts[1] !== 'avatar') {
    return res.status(403).json({ error: '仅支持头像公开访问' })
  }

  const safeId = sanitizeUserId(parts[0])
  if (parts[0] !== safeId) {
    return res.status(403).json({ error: '非法用户标识' })
  }

  const absPath = path.resolve(VOUCHER_DIR, relPath)

  // 防路径穿越
  if (!absPath.startsWith(VOUCHER_DIR + path.sep)) {
    return res.status(403).json({ error: '非法路径' })
  }

  if (!fs.existsSync(absPath)) {
    return res.status(404).json({ error: '资源不存在' })
  }

  const ext = path.extname(absPath).toLowerCase()
  const contentType = EXT_CONTENT_TYPE[ext] || 'application/octet-stream'

  res.setHeader('Content-Type', contentType)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  fs.createReadStream(absPath).pipe(res)
}
