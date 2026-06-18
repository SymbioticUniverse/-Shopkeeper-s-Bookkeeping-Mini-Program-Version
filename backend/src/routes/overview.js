/**
 * 简览卡片路由 — 获取 / 保存自定义卡片布局
 */
const express = require('express')
const { db } = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// ==================== 获取简览卡片 ====================

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT id, template_id, name, subtitle, type, span, x, y
    FROM overview_cards
    WHERE user_id = ?
    ORDER BY y, x
  `).all(req.userId)

  res.json(rows.map(r => ({
    id: r.id,
    templateId: r.template_id || '',
    name: r.name,
    subtitle: r.subtitle || '',
    type: r.type,
    span: r.span,
    x: r.x ?? 0,
    y: r.y ?? 0
  })))
})

// ==================== 保存简览卡片（整体覆盖） ====================

router.post('/', requireAuth, (req, res) => {
  const cards = req.body || []
  if (!Array.isArray(cards)) {
    return res.status(400).json({ error: 'cards 必须是数组' })
  }

  db.transaction(() => {
    db.prepare('DELETE FROM overview_cards WHERE user_id = ?').run(req.userId)
    const insertStmt = db.prepare(`
      INSERT INTO overview_cards (id, user_id, template_id, name, subtitle, type, span, x, y)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const c of cards) {
      insertStmt.run(
        c.id,
        req.userId,
        c.templateId || '',
        c.name,
        c.subtitle || '',
        c.type,
        c.span,
        c.x ?? 0,
        c.y ?? 0
      )
    }
  })()

  res.json({ success: true })
})

module.exports = { overview: router }
