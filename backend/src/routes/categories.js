/**
 * 分类路由 — 按 scope 读写自定义分类
 */
const express = require('express')
const { db } = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// ==================== 获取分类列表 ====================

router.get('/', requireAuth, (req, res) => {
  const { scope } = req.query
  if (!scope || !['personal', 'company'].includes(scope)) {
    return res.status(400).json({ error: 'scope 参数无效，需为 personal 或 company' })
  }

  const rows = db.prepare(`
    SELECT cat_id AS id, name, emoji, in_out AS inOut
    FROM categories
    WHERE user_id = ? AND scope = ?
    ORDER BY sort_order, cat_id
  `).all(req.userId, scope)

  // 无数据时返回 null，前端使用内置默认分类
  if (rows.length === 0) return res.json(null)
  res.json(rows)
})

// ==================== 保存分类列表（整体覆盖） ====================

router.post('/', requireAuth, (req, res) => {
  const { scope, list } = req.body || {}
  if (!scope || !['personal', 'company'].includes(scope)) {
    return res.status(400).json({ error: 'scope 参数无效' })
  }
  if (!Array.isArray(list)) {
    return res.status(400).json({ error: 'list 必须是数组' })
  }

  // 事务：删除旧数据 → 写入新列表
  const deleteStmt = db.prepare('DELETE FROM categories WHERE user_id = ? AND scope = ?')
  const insertStmt = db.prepare(`
    INSERT INTO categories (user_id, scope, cat_id, name, emoji, in_out, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  db.transaction(() => {
    deleteStmt.run(req.userId, scope)
    list.forEach((cat, i) => {
      insertStmt.run(
        req.userId,
        scope,
        cat.id,
        cat.name,
        cat.emoji,
        cat.inOut,
        i
      )
    })
  })()

  res.json({ success: true })
})

module.exports = router
