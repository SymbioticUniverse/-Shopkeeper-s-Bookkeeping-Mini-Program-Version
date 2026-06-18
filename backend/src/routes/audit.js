/**
 * 审核路由 — 老板审核员工加入申请
 */
const express = require('express')
const { db } = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// ==================== 获取审核列表 ====================

router.get('/', requireAuth, (req, res) => {
  // 找到用户作为老板的公司
  const bossMember = db.prepare(`
    SELECT cm.company_id
    FROM company_members cm
    WHERE cm.user_id = ? AND cm.role = 'boss' AND cm.status = 'approved'
  `).get(req.userId)

  if (!bossMember) {
    return res.json([])
  }

  // 查询该公司下所有待审核/已处理的申请
  const rows = db.prepare(`
    SELECT cm.id, cm.user_id, cm.status, cm.joined_at,
           u.nick_name AS applicantName, u.avatar_url AS applicantAvatar
    FROM company_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.company_id = ? AND cm.role = 'employee'
    ORDER BY cm.id DESC
  `).all(bossMember.company_id)

  res.json(rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    applicantName: r.applicantName,
    applicantAvatar: r.applicantAvatar,
    status: r.status,
    joinedAt: r.joined_at
  })))
})

// ==================== 保存审核结果（整体覆盖） ====================

router.post('/', requireAuth, (req, res) => {
  const list = req.body || []
  if (!Array.isArray(list)) {
    return res.status(400).json({ error: 'list 必须是数组' })
  }

  // 找到 boss 的公司
  const bossMember = db.prepare(`
    SELECT cm.company_id
    FROM company_members cm
    WHERE cm.user_id = ? AND cm.role = 'boss' AND cm.status = 'approved'
  `).get(req.userId)

  if (!bossMember) {
    return res.status(400).json({ error: '您不是任何公司的老板' })
  }

  const company = db.prepare('SELECT name FROM companies WHERE id = ?').get(bossMember.company_id)

  db.transaction(() => {
    for (const item of list) {
      // 获取旧状态
      const old = db.prepare(
        'SELECT user_id, status FROM company_members WHERE id = ? AND company_id = ?'
      ).get(item.id, bossMember.company_id)

      if (!old) continue

      // 更新状态
      if (item.status === 'approved') {
        db.prepare(`
          UPDATE company_members SET status = 'approved', joined_at = datetime('now')
          WHERE id = ?
        `).run(item.id)
      } else if (item.status === 'rejected') {
        db.prepare(`
          UPDATE company_members SET status = 'rejected'
          WHERE id = ?
        `).run(item.id)
      }

      // 审核通过时，自动为员工创建通知
      if (item.status === 'approved' && old.status !== 'approved') {
        const notifyId = Date.now() + Math.random()
        const now = new Date().toISOString()
        db.prepare(`
          INSERT INTO notifications (id, user_id, text, time, read)
          VALUES (?, ?, ?, ?, 0)
        `).run(
          notifyId,
          old.user_id,
          `您加入「${company.name || '公司'}」的申请已通过`,
          now
        )
      }

      // 审核拒绝时也发通知
      if (item.status === 'rejected' && old.status !== 'rejected') {
        const notifyId = Date.now() + Math.random()
        const now = new Date().toISOString()
        db.prepare(`
          INSERT INTO notifications (id, user_id, text, time, read)
          VALUES (?, ?, ?, ?, 0)
        `).run(
          notifyId,
          old.user_id,
          `您加入「${company.name || '公司'}」的申请已被拒绝`,
          now
        )
      }
    }
  })()

  res.json({ success: true })
})

// ==================== 清空审核列表 ====================

router.delete('/', requireAuth, (req, res) => {
  const bossMember = db.prepare(`
    SELECT cm.company_id
    FROM company_members cm
    WHERE cm.user_id = ? AND cm.role = 'boss' AND cm.status = 'approved'
  `).get(req.userId)

  if (bossMember) {
    // 删除非已通过的申请记录
    db.prepare(`
      DELETE FROM company_members
      WHERE company_id = ? AND role = 'employee' AND status != 'approved'
    `).run(bossMember.company_id)
  }

  res.json({ success: true })
})

module.exports = { audit: router }
