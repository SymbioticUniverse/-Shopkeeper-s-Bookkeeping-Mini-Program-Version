/**
 * 记账小程序后端 API 服务
 * v1.0.0 — 覆盖 API.md 全部 30 个接口
 */
const express = require('express')
const { initSchema } = require('./db')

const app = express()
const PORT = process.env.PORT || 3000

// 中间件
app.use(express.json())

// 初始化数据库
initSchema()

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

// ==================== 启动 ====================

app.listen(PORT, () => {
  console.log(`后端服务已启动 → http://localhost:${PORT}`)
})

module.exports = app
