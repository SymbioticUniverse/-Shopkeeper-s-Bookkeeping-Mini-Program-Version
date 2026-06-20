/**
 * 凭证上传路由 — POST /api/upload
 *
 * 接收 multipart 图片 → 校验类型/大小 → 存本地磁盘 → 返回可访问 URL
 * 生产环境应替换为对象存储（OSS/COS），此处为本地文件系统实现。
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

// multer 配置：磁盘存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 按 user_id 和年月归档
    const now = new Date()
    const userId = req.userId || 'unknown'
    const dir = path.join(VOUCHER_DIR, String(userId),
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'))
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: function (req, file, cb) {
    // 生成唯一文件名
    const ext = path.extname(file.originalname) || '.jpg'
    const uuid = crypto.randomUUID()
    cb(null, uuid + ext)
  }
})

// 文件过滤器：仅接受图片
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

// ==================== 上传接口 ====================

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

    // 构建可访问 URL
    // VOUCHER_BASE_URL: 生产环境设为 CDN 域名（如 https://cdn.xxx.com）
    // 开发环境自动根据请求 host 构造
    const baseUrl = process.env.VOUCHER_BASE_URL ||
      `${req.protocol}://${req.get('host')}`
    const relativePath = path.relative(VOUCHER_DIR, req.file.path)
    const url = baseUrl + '/voucher/' + relativePath.replace(/\\/g, '/')

    res.json({ ok: true, url })
  })
})

module.exports = { upload: router }
