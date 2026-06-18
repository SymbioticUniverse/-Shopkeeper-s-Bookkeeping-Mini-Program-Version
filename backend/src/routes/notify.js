/**
 * 通知路由 — 获取 / 保存通知列表
 */
const express = require('express')
const { db } = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// ==================== 获取通知列表 ====================

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT id, text, time, read
    FROM notifications
    WHERE user_id = ?
    ORDER BY id DESC
  `).all(req.userId)

  res.json(rows.map(r => ({
    id: r.id,
    text: r.text,
    time: r.time,
    read: r.read === 1
  })))
})

// ==================== 保存通知列表（整体覆盖） ====================

router.post('/', requireAuth, (req, res) => {
  const list = req.body || []
  if (!Array.isArray(list)) {
    return res.status(400).json({ error: 'list 必须是数组' })
  }

  // upsert：不删除已有通知，避免丢失后端自动创建的通知
  const upsertStmt = db.prepare(`
    INSERT INTO notifications (id, user_id, text, time, read)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      text = excluded.text,
      time = excluded.time,
      read = excluded.read
  `)
  db.transaction(() => {
    for (const item of list) {
      upsertStmt.run(
        item.id,
        req.userId,
        item.text,
        item.time,
        item.read ? 1 : 0
      )
    }
  })()

  res.json({ success: true })
})

module.exports = { notify: router }
