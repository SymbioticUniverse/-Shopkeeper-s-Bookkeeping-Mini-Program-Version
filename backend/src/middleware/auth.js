/**
 * 认证中间件 — 校验 JWT token
 */
const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const JWT_SECRET = process.env.JWT_SECRET

// 生产环境必须设置 JWT_SECRET，否则拒绝启动
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET 环境变量未设置，生产环境拒绝启动')
  }
}

// dev 密钥持久化文件（放在 backend 根目录，不受服务重启影响）
const DEV_SECRET_FILE = path.join(__dirname, '..', '..', '.jwt-secret')

let _devSecret = null

function _loadDevSecret() {
  try {
    if (fs.existsSync(DEV_SECRET_FILE)) {
      return fs.readFileSync(DEV_SECRET_FILE, 'utf8').trim()
    }
  } catch (e) {
    console.warn('[WARN] 读取 .jwt-secret 失败，将重新生成:', e.message)
  }
  // 首次启动：生成新密钥并持久化
  const secret = crypto.randomBytes(32).toString('hex')
  try {
    fs.writeFileSync(DEV_SECRET_FILE, secret, 'utf8')
    console.log('[INFO] 已生成持久化 JWT 密钥 →', DEV_SECRET_FILE)
  } catch (e) {
    console.warn('[WARN] 无法写入 .jwt-secret，密钥仅存于内存（重启会失效）:', e.message)
  }
  return secret
}

function getSecret() {
  if (JWT_SECRET) return JWT_SECRET
  if (!_devSecret) {
    _devSecret = _loadDevSecret()
  }
  return _devSecret
}

// 生成 token
function generateToken(userId) {
  return jwt.sign({ userId }, getSecret(), { expiresIn: '30d' })
}

// 解析 token 获取 userId（不拒绝请求，仅做解析）
function parseToken(token) {
  try {
    const decoded = jwt.verify(token, getSecret())
    return decoded.userId
  } catch (e) {
    return null
  }
}

// 认证中间件 — 必须登录，且 token 在会话表中有效
const _db = require('../db').db
const _sessionCheck = _db.prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')")

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token || '')

  const userId = parseToken(token)
  if (!userId) {
    return res.status(401).json({ error: '未登录或登录已过期' })
  }

  // 验证 token 存在于会话表（未被 logout 清除）
  const session = _sessionCheck.get(token)
  if (!session) {
    return res.status(401).json({ error: '会话已注销，请重新登录' })
  }

  req.userId = userId
  next()
}

module.exports = { requireAuth, generateToken, parseToken, auth: requireAuth }
