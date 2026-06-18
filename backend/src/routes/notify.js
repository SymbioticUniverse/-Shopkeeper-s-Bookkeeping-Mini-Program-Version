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

// ==================== 保存通知列表（整体覆盖 — 先删后插） ====================

router.post('/', requireAuth, (req, res) => {
  const list = req.body || []
  if (!Array.isArray(list)) {
    return res.status(400).json({ error: 'list 必须是数组' })
  }

  const insertStmt = db.prepare(`
    INSERT INTO notifications (id, user_id, text, time, read)
    VALUES (?, ?, ?, ?, ?)
  `)

  db.transaction(() => {
    // 先清空该用户所有通知，再批量插入 → 同时实现新增/更新/删除
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(req.userId)
    for (const item of list) {
      insertStmt.run(
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
