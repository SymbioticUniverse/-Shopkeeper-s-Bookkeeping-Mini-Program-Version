/**
 * 认证中间件 — 校验 JWT token
 */
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET

// 生产环境必须设置 JWT_SECRET，否则拒绝启动
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET 环境变量未设置，生产环境拒绝启动')
  }
  // 开发环境使用随机密钥（每次重启 token 失效，可接受）
  console.warn('[WARN] JWT_SECRET 未设置，使用随机密钥（仅开发环境可用）')
}

function getSecret() {
  return JWT_SECRET || require('crypto').randomBytes(32).toString('hex')
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
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token || '')

  const userId = parseToken(token)
  if (!userId) {
    return res.status(401).json({ error: '未登录或登录已过期' })
  }

  // 验证 token 存在于会话表（未被 logout 清除）
  const db = require('../db').db
  const session = db.prepare('SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime(\'now\')').get(token)
  if (!session) {
    return res.status(401).json({ error: '会话已注销，请重新登录' })
  }

  req.userId = userId
  next()
}

module.exports = { requireAuth, generateToken, parseToken, auth: requireAuth }
