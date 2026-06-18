/**
 * 数据迁移路由 — 一次性迁移旧 localStorage 数据到云端
 *
 * 前端旧数据格式：detailItems（单 key 混存 personal + company）
 * 新数据格式：personalItems + companyItems（双 key 分离）
 *
 * 后端上线后此接口可废弃。当前实现：接收旧数据 → 按 scope 拆分 → 写入云端。
 */
const express = require('express')
const { db } = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// ==================== 执行迁移 ====================

router.post('/migrate', requireAuth, (req, res) => {
  const { detailItems } = req.body || {}

  // 无旧数据直接返回
  if (!detailItems || !Array.isArray(detailItems) || detailItems.length === 0) {
    return res.json({ success: true, migrated: 0 })
  }

  // 按 scope 拆分
  const personalItems = detailItems.filter(it => (it.scope || 'personal') === 'personal')
  const companyItems = detailItems.filter(it => it.scope === 'company')

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO items
      (id, user_id, scope, category, type, type_label, amount, date, note, target, target_type, linked_id, voided)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  let count = 0

  db.transaction(() => {
    for (const items of [personalItems, companyItems]) {
      for (const item of items) {
        if (!item.id) continue
        const result = insertStmt.run(
          item.id,
          req.userId,
          item.scope || 'personal',
          item.category || '',
          item.type || 'out',
          item.typeLabel || '',
          item.amount || '0.00',
          item.date || '',
          item.note || '',
          item.target || '',
          item.targetType || '',
          item.linkedId || null,
          item._voided ? 1 : 0
        )
        if (result.changes > 0) count++
      }
    }
  })()

  res.json({ success: true, migrated: count })
})

module.exports = router
