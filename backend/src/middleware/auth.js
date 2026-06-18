/**
 * 认证中间件 — 校验 JWT token
 */
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'miniprogram-secret-key-change-in-production'

// 生成 token
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' })
}

// 解析 token 获取 userId（不拒绝请求，仅做解析）
function parseToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    return decoded.userId
  } catch (e) {
    return null
  }
}

// 认证中间件 — 必须登录
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token || '')

  const userId = parseToken(token)
  if (!userId) {
    return res.status(401).json({ error: '未登录或登录已过期' })
  }
  req.userId = userId
  next()
}

module.exports = { requireAuth, generateToken, parseToken, JWT_SECRET, auth: requireAuth }
