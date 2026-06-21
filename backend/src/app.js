/**
 * 记账小程序后端 API 服务
 * v1.1.0 — 安全加固版
 */
const express = require('express')
const path = require('path')
const { initSchema, db } = require('./db')

const app = express()
const PORT = process.env.PORT || 3000

// 中间件 — body 限制提升至 10MB（支持大量账单同步）
app.use(express.json({ limit: '10mb' }))

// CORS — 白名单模式
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : (process.env.NODE_ENV === 'production'
    ? ['https://servicewechat.com']  // 微信小程序合法来源
    : ['*'])

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (ALLOWED_ORIGINS.includes('*') || (origin && ALLOWED_ORIGINS.includes(origin))) {
    res.header('Access-Control-Allow-Origin', origin || ALLOWED_ORIGINS[0])
  }
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// 初始化数据库
initSchema()

// 定时清理过期数据（每 10 分钟）
setInterval(() => {
  try {
    const deletedSessions = db.prepare(
      "DELETE FROM sessions WHERE expires_at < datetime('now')"
    ).run().changes
    const deletedCodes = db.prepare(
      "DELETE FROM verify_codes WHERE expires_at < datetime('now')"
    ).run().changes
    if (deletedSessions > 0 || deletedCodes > 0) {
      console.log(`[CLEANUP] 清理 ${deletedSessions} 条过期会话, ${deletedCodes} 条过期验证码`)
    }
  } catch (e) {
    console.error('[CLEANUP] 清理失败:', e.message)
  }
}, 10 * 60 * 1000)

// ==================== 路由注册 ====================

// 认证
const { auth: authRouter } = require('./routes/auth')
app.use('/api/auth', authRouter)

// 账单
const { items: itemsRouter } = require('./routes/items')
app.use('/api/items', itemsRouter)

// 分类
const { categories: categoriesRouter } = require('./routes/categories')
app.use('/api/categories', categoriesRouter)

// 公司
const { company: companyRouter } = require('./routes/company')
app.use('/api/company', companyRouter)

// 审核
const { audit: auditRouter } = require('./routes/audit')
app.use('/api/audit', auditRouter)

// 通知
const { notify: notifyRouter } = require('./routes/notify')
app.use('/api/notify', notifyRouter)

// 反馈
const { feedback: feedbackRouter } = require('./routes/feedback')
app.use('/api/feedback', feedbackRouter)

// 设置
const { settings: settingsRouter } = require('./routes/settings')
app.use('/api/settings', settingsRouter)

// 简览卡片
const { overview: overviewRouter } = require('./routes/overview')
app.use('/api/overview', overviewRouter)

// 数据迁移（一次性）
const { migrate: migrateRouter } = require('./routes/migrate')
app.use('/api', migrateRouter)

// 凭证上传
const { upload: uploadRouter, serveVoucher, servePublicVoucher } = require('./routes/upload')
app.use('/api/upload', uploadRouter)

// 凭证图片鉴权代理 —— 替代裸 express.static
// 校验登录态 + 凭证归属当前用户，防止越权访问
app.get('/voucher/*', require('./middleware/auth').requireAuth, serveVoucher)

// 头像公开访问 —— 免鉴权，供 <image src> 直接加载
app.get('/public/voucher/*', servePublicVoucher)

// ==================== 全局错误处理 ====================

app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message, err.stack)
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message
  })
})

// ==================== 启动 ====================

app.listen(PORT, () => {
  console.log(`后端服务已启动 → http://localhost:${PORT}`)
})

module.exports = app
