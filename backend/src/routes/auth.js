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

  // 频率限制：60 秒内同一手机号不允许重复发送
  const lastCode = db.prepare(
    'SELECT expires_at FROM verify_codes WHERE phone = ?'
  ).get(phone)
  if (lastCode) {
    const issuedAt = new Date(lastCode.expires_at).getTime() - 5 * 60 * 1000
    if (Date.now() - issuedAt < 60000) {
      const remainSec = Math.ceil((60000 - (Date.now() - issuedAt)) / 1000)
      return res.status(429).json({ error: `请 ${remainSec} 秒后再发送验证码` })
    }
  }

  // 生成 6 位验证码（生产环境应对接短信服务商）
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  // 存验证码（覆盖旧验证码）
  db.prepare(`
    INSERT INTO verify_codes (phone, code, expires_at) VALUES (?, ?, ?)
    ON CONFLICT(phone) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at
  `).run(phone, code, expiresAt)

  // 仅开发环境打印验证码到控制台
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] 验证码 → ${phone}: ${code}`)
  }

  res.json({ success: true })
})

// ==================== 手机号 + 验证码登录 ====================

router.post('/login-by-phone', (req, res) => {
  const { phone, code } = req.body || {}
  if (!phone || !code) {
    return res.status(400).json({ error: '手机号和验证码不能为空' })
  }

  // 暴力破解防护：5 次错误后锁定 15 分钟
  const attempts = db.prepare(
    'SELECT failed_attempts, locked_until FROM verify_codes WHERE phone = ?'
  ).get(phone)
  if (attempts && attempts.locked_until && new Date(attempts.locked_until) > new Date()) {
    const remainMin = Math.ceil((new Date(attempts.locked_until) - new Date()) / 60000)
    return res.status(429).json({ error: `验证码错误次数过多，请 ${remainMin} 分钟后再试` })
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
    // 记录失败次数，超过阈值锁定
    const newAttempts = (attempts ? attempts.failed_attempts : 0) + 1
    const lockedUntil = newAttempts >= 5
      ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
      : null
    db.prepare(`
      UPDATE verify_codes SET failed_attempts = ?, locked_until = ? WHERE phone = ?
    `).run(newAttempts, lockedUntil, phone)
    return res.status(400).json({ error: '验证码错误' })
  }

  // 验证通过，删除验证码
  db.prepare('DELETE FROM verify_codes WHERE phone = ?').run(phone)

  // 查找或创建用户
  let user = db.prepare('SELECT id, nick_name, avatar_url FROM users WHERE phone = ?').get(phone)
  let isNew = false
  if (!user) {
    // 新用户，使用手机号脱敏作为默认昵称
    isNew = true
    const maskedPhone = phone.slice(0, 3) + '****' + phone.slice(7)
    const result = db.prepare(
      'INSERT INTO users (phone, nick_name) VALUES (?, ?)'
    ).run(phone, maskedPhone)
    user = { id: result.lastInsertRowid, nick_name: maskedPhone, avatar_url: '' }
  } else {
    // 更新登录时间
    db.prepare('UPDATE users SET updated_at = datetime(\'now\') WHERE id = ?').run(user.id)
  }

  // 查询公司归属与角色
  const member = db.prepare(`
    SELECT cm.role FROM company_members cm
    WHERE cm.user_id = ? AND cm.status = 'approved'
  `).get(user.id)
  const hasCompany = !!member
  const companyRole = member ? member.role : null

  // 生成 token 并存入会话表
  const token = generateToken(user.id)
  db.prepare(
    'INSERT OR REPLACE INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(token, user.id, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())

  res.json({
    nickName: user.nick_name,
    avatarUrl: user.avatar_url,
    token,
    isNew,
    hasCompany,
    companyRole
  })
})

// ==================== 微信 code2Session 工具函数 ====================

/**
 * 调用微信 code2Session 换取 openid
 * 生产环境：设置 WECHAT_APPID + WECHAT_SECRET 启用真实调用
 * 开发环境：未配置时降级为 code 直接作为 openid（仅用于本地测试）
 */
function getOpenidByCode(wechatCode) {
  const appId = process.env.WECHAT_APPID
  const appSecret = process.env.WECHAT_SECRET

  if (!appId || !appSecret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('生产环境必须设置 WECHAT_APPID 和 WECHAT_SECRET')
    }
    // 开发环境降级：code 作为 openid（仅本地测试可用）
    console.warn('[DEV] 微信登录降级模式：code 直接用作 openid（仅开发环境）')
    return Promise.resolve(wechatCode)
  }

  // 生产环境：真实调用微信 code2Session API
  const https = require('https')
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${wechatCode}&grant_type=authorization_code`

  return new Promise((resolve, reject) => {
    https.get(url, (resp) => {
      let data = ''
      resp.on('data', chunk => data += chunk)
      resp.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (result.errcode) {
            reject(new Error(`微信 code2Session 失败: ${result.errmsg} (errcode=${result.errcode})`))
          } else if (!result.openid) {
            reject(new Error('微信 code2Session 未返回 openid'))
          } else {
            resolve(result.openid)
          }
        } catch (e) {
          reject(new Error('微信 code2Session 响应解析失败'))
        }
      })
    }).on('error', reject)
  })
}

// ==================== 微信授权登录 ====================

router.post('/login-by-wechat', async (req, res) => {
  const { nickName, avatarUrl, code } = req.body || {}

  if (!code) {
    return res.status(400).json({ error: '缺少微信登录凭证(code)' })
  }

  // 调用 code2Session 获取真实 openid
  let openid
  try {
    openid = await getOpenidByCode(code)
  } catch (err) {
    console.error('[WECHAT] code2Session 失败:', err.message)
    return res.status(500).json({ error: '微信登录失败，请稍后重试' })
  }

  const nickname = nickName || '微信用户'
  const avatar = avatarUrl || ''

  let user = db.prepare('SELECT id, nick_name, avatar_url FROM users WHERE openid = ?').get(openid)
  let isNew = false

  if (!user) {
    isNew = true
    const result = db.prepare(
      'INSERT INTO users (nick_name, avatar_url, openid) VALUES (?, ?, ?)'
    ).run(nickname, avatar, openid)
    user = { id: result.lastInsertRowid, nick_name: nickname, avatar_url: avatar }
  } else {
    db.prepare(
      'UPDATE users SET nick_name = ?, avatar_url = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(nickname, avatar, user.id)
    user.nick_name = nickname
    user.avatar_url = avatar
  }

  // 查询公司归属与角色
  const member = db.prepare(`
    SELECT cm.role FROM company_members cm
    WHERE cm.user_id = ? AND cm.status = 'approved'
  `).get(user.id)
  const hasCompany = !!member
  const companyRole = member ? member.role : null

  const token = generateToken(user.id)
  db.prepare(
    'INSERT OR REPLACE INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(token, user.id, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())

  res.json({
    nickName: user.nick_name,
    avatarUrl: user.avatar_url,
    token,
    isNew,
    hasCompany,
    companyRole
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
