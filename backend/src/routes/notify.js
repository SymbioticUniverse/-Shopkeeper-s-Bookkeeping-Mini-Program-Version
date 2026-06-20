/**
 * 通知路由 — 获取 / 保存 / 删除通知
 *
 * 通知分两种来源：
 *   source='user'   — 前端管理的手动通知（可增删改）
 *   source='system' — 后端自动生成的通知（审核/解散等，前端不可覆盖）
 */
const express = require('express')
const { db } = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// ==================== 获取通知列表 ====================

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT id, text, time, read, source, type, target_user_id, item_id
    FROM notifications
    WHERE user_id = ?
    ORDER BY id DESC
  `).all(req.userId)

  res.json(rows.map(r => ({
    id: r.id,
    text: r.text,
    time: r.time,
    read: r.read === 1,
    source: r.source,
    type: r.type || '',
    targetUserId: r.target_user_id || null,
    itemId: r.item_id || null
  })))
})

// ==================== 保存通知列表（仅覆盖 source='user' 的通知） ====================

router.post('/', requireAuth, (req, res) => {
  const list = req.body || []
  if (!Array.isArray(list)) {
    return res.status(400).json({ error: 'list 必须是数组' })
  }

  // 文本长度校验
  for (const item of list) {
    if (item.text && item.text.length > 2000) {
      return res.status(400).json({ error: '通知内容不能超过 2000 个字符' })
    }
  }

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO notifications (id, user_id, text, time, read, source, type, target_user_id, item_id)
    VALUES (?, ?, ?, ?, ?, 'user', ?, ?, ?)
  `)

  db.transaction(() => {
    // 只清空用户手动管理的通知，系统自动通知不受影响
    db.prepare("DELETE FROM notifications WHERE user_id = ? AND source = 'user'").run(req.userId)
    for (const item of list) {
      // 仅处理前端传来的通知（前端不会传 source 字段，统一视为 user 源）
      insertStmt.run(
        item.id,
        req.userId,
        item.text,
        item.time,
        item.read ? 1 : 0,
        item.type || '',
        item.targetUserId || null,
        item.itemId || null
      )
    }
  })()

  res.json({ success: true })
})

// ==================== 删除单条通知（仅允许 source='user'） ====================

router.delete('/:id', requireAuth, (req, res) => {
  const result = db.prepare(`
    DELETE FROM notifications
    WHERE id = ? AND user_id = ? AND source = 'user'
  `).run(Number(req.params.id), req.userId)

  if (result.changes === 0) {
    return res.status(404).json({ error: '通知不存在或无权删除' })
  }

  res.json({ success: true })
})

module.exports = { notify: router }
