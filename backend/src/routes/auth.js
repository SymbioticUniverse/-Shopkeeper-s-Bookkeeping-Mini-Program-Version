/**
 * 认证路由 — 验证码 / 手机登录 / 微信登录 / 登出 / 用户信息
 */
const express = require('express')
const { db } = require('../db')
const { requireAuth, generateToken, parseToken } = require('../middleware/auth')

const router = express.Router()

// ==================== 发送验证码 ====================

router.post('/send-verify-code', (req, res) => {
  const { phone } = req.body || {}
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ error: '手机号格式不正确' })
  }

  // 生成 6 位验证码（生产环境应对接短信服务商）
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  // 存验证码（覆盖旧验证码）
  db.prepare(`
    INSERT INTO verify_codes (phone, code, expires_at) VALUES (?, ?, ?)
    ON CONFLICT(phone) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at
  `).run(phone, code, expiresAt)

  // 开发环境打印验证码到控制台
  console.log(`[DEV] 验证码 → ${phone}: ${code}`)

  res.json({ success: true })
})

// ==================== 手机号 + 验证码登录 ====================

router.post('/login-by-phone', (req, res) => {
  const { phone, code } = req.body || {}
  if (!phone || !code) {
    return res.status(400).json({ error: '手机号和验证码不能为空' })
  }

  // 校验验证码
  const row = db.prepare('SELECT code, expires_at FROM verify_codes WHERE phone = ?').get(phone)
  if (!row) {
    return res.status(400).json({ error: '请先发送验证码' })
  }
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM verify_codes WHERE phone = ?').run(phone)
    return res.status(400).json({ error: '验证码已过期，请重新发送' })
  }
  if (row.code !== code) {
    return res.status(400).json({ error: '验证码错误' })
  }

  // 验证通过，删除验证码
  db.prepare('DELETE FROM verify_codes WHERE phone = ?').run(phone)

  // 查找或创建用户
  let user = db.prepare('SELECT id, nick_name, avatar_url FROM users WHERE phone = ?').get(phone)
  if (!user) {
    // 新用户，使用手机号脱敏作为默认昵称
    const maskedPhone = phone.slice(0, 3) + '****' + phone.slice(7)
    const result = db.prepare(
      'INSERT INTO users (phone, nick_name) VALUES (?, ?)'
    ).run(phone, maskedPhone)
    user = { id: result.lastInsertRowid, nick_name: maskedPhone, avatar_url: '' }
  } else {
    // 更新登录时间
    db.prepare('UPDATE users SET updated_at = datetime(\'now\') WHERE id = ?').run(user.id)
  }

  // 生成 token 并存入会话表
  const token = generateToken(user.id)
  db.prepare(
    'INSERT OR REPLACE INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(token, user.id, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())

  res.json({
    nickName: user.nick_name,
    avatarUrl: user.avatar_url,
    token
  })
})

// ==================== 微信授权登录 ====================

router.post('/login-by-wechat', (req, res) => {
  const { nickName, avatarUrl, code } = req.body || {}

  // 如果前端传了微信 code，生产环境应调微信 code2Session 换取 openid
  // 此处以 nickName 作为临时标识（开发环境）
  const identifier = nickName || '微信用户'
  const avatar = avatarUrl || ''

  // 查找或创建用户（openid 匹配优先，降级为 nickName）
  let user = null
  if (code) {
    // 生产环境：用 code 换 openid，此处简化处理
    user = db.prepare('SELECT id, nick_name, avatar_url FROM users WHERE openid = ?').get(code)
  }

  if (!user) {
    // 按昵称 + 头像查找已有用户
    user = db.prepare(
      'SELECT id, nick_name, avatar_url FROM users WHERE nick_name = ? AND avatar_url = ?'
    ).get(identifier, avatar)
  }

  if (!user) {
    // 创建新用户
    const result = db.prepare(
      'INSERT INTO users (nick_name, avatar_url, openid) VALUES (?, ?, ?)'
    ).run(identifier, avatar, code || null)
    user = { id: result.lastInsertRowid, nick_name: identifier, avatar_url: avatar }
  } else {
    // 更新头像和昵称（微信可能更新）
    db.prepare(
      'UPDATE users SET nick_name = ?, avatar_url = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(identifier, avatar, user.id)
    user.nick_name = identifier
    user.avatar_url = avatar
  }

  // 生成 token 并存入会话表
  const token = generateToken(user.id)
  db.prepare(
    'INSERT OR REPLACE INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(token, user.id, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())

  res.json({
    nickName: user.nick_name,
    avatarUrl: user.avatar_url,
    token
  })
})

// ==================== 退出登录 ====================

router.post('/logout', requireAuth, (req, res) => {
  // 从会话表删除 token
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token || '')
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  }
  res.json({ success: true })
})

// ==================== 获取用户信息 ====================

router.get('/user-info', requireAuth, (req, res) => {
  const user = db.prepare('SELECT nick_name, avatar_url FROM users WHERE id = ?').get(req.userId)
  if (!user) {
    return res.json(null)
  }
  res.json({
    nickName: user.nick_name,
    avatarUrl: user.avatar_url
  })
})

// ==================== 保存用户信息 ====================

router.post('/user-info', requireAuth, (req, res) => {
  const { nickName, avatarUrl } = req.body || {}
  const updates = []
  const params = []

  if (nickName !== undefined) {
    updates.push('nick_name = ?')
    params.push(nickName)
  }
  if (avatarUrl !== undefined) {
    updates.push('avatar_url = ?')
    params.push(avatarUrl)
  }

  if (updates.length > 0) {
    updates.push('updated_at = datetime(\'now\')')
    params.push(req.userId)
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params)
  }

  res.json({ success: true })
})

// ==================== 清除用户信息 ====================

router.delete('/user-info', requireAuth, (req, res) => {
  // 清除用户信息
  db.prepare('UPDATE users SET nick_name = \'\', avatar_url = \'\', updated_at = datetime(\'now\') WHERE id = ?').run(req.userId)
  // 同时销毁会话（API.md 标注为"退出登录"）
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token || '')
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  }
  res.json({ success: true })
})

module.exports = { auth: router }
