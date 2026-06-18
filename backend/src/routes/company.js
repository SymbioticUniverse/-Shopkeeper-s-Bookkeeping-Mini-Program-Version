/**
 * 公司路由 — 创建 / 加入 / 退出 / 查询公司信息
 */
const express = require('express')
const { db } = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// ==================== 获取公司信息 ====================

router.get('/', requireAuth, (req, res) => {
  const member = db.prepare(`
    SELECT cm.role, cm.status, cm.joined_at,
           c.uid AS companyUid, c.name AS companyName, c.boss_title AS companyBossTitle
    FROM company_members cm
    JOIN companies c ON c.id = cm.company_id
    WHERE cm.user_id = ? AND cm.status = 'approved'
  `).get(req.userId)

  if (!member) return res.json(null)

  res.json({
    companyUid: member.companyUid,
    companyName: member.companyName || '',
    companyBossTitle: member.companyBossTitle || 'BOSS',
    companyRole: member.role
  })
})

// ==================== 保存公司信息（创建 / 加入） ====================

router.post('/', requireAuth, (req, res) => {
  const info = req.body || {}
  const { companyUid, companyName, companyBossTitle, companyRole } = info

  if (!companyUid || !companyRole || !['boss', 'employee'].includes(companyRole)) {
    return res.status(400).json({ error: '参数不完整：需要 companyUid, companyRole(boss|employee)' })
  }

  // 检查用户是否已有活跃的公司绑定
  const existing = db.prepare(`
    SELECT cm.id, cm.company_id, cm.status, c.uid
    FROM company_members cm
    JOIN companies c ON c.id = cm.company_id
    WHERE cm.user_id = ?
  `).get(req.userId)

  if (existing && existing.status === 'approved') {
    // 已是某公司成员，需先退出
    return res.status(400).json({ error: '请先退出当前公司再操作' })
  }

  if (companyRole === 'boss') {
    // 老板创建公司
    if (!companyName) {
      return res.status(400).json({ error: '创建公司需要填写 companyName' })
    }

    db.transaction(() => {
      // 删除旧的 pending/rejected 记录
      if (existing) {
        db.prepare('DELETE FROM company_members WHERE id = ?').run(existing.id)
      }

      // 创建公司
      const companyResult = db.prepare(`
        INSERT INTO companies (uid, name, boss_title, boss_user_id)
        VALUES (?, ?, ?, ?)
      `).run(companyUid, companyName, companyBossTitle || 'BOSS', req.userId)

      // 老板自动成为已通过成员
      db.prepare(`
        INSERT INTO company_members (company_id, user_id, role, status, joined_at)
        VALUES (?, ?, 'boss', 'approved', datetime('now'))
      `).run(companyResult.lastInsertRowid, req.userId)
    })()

    return res.json({ success: true })
  }

  // employee 加入公司
  const company = db.prepare('SELECT id, boss_user_id FROM companies WHERE uid = ?').get(companyUid)
  if (!company) {
    return res.status(400).json({ error: '公司不存在，请检查 UID' })
  }

  db.transaction(() => {
    // 删除旧记录
    if (existing) {
      db.prepare('DELETE FROM company_members WHERE id = ?').run(existing.id)
    }

    // 创建待审核成员记录
    db.prepare(`
      INSERT INTO company_members (company_id, user_id, role, status)
      VALUES (?, ?, 'employee', 'pending')
    `).run(company.id, req.userId)

    // 自动为老板生成一条审核通知
    const notifyId = Date.now()
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO notifications (id, user_id, text, time, read)
      VALUES (?, ?, ?, ?, 0)
    `).run(
      notifyId,
      company.boss_user_id,
      `有新员工申请加入公司`,
      now
    )
  })()

  res.json({ success: true })
})

// ==================== 退出 / 解散公司 ====================

router.delete('/', requireAuth, (req, res) => {
  const member = db.prepare(`
    SELECT cm.id, cm.role, cm.company_id
    FROM company_members cm
    WHERE cm.user_id = ? AND cm.status = 'approved'
  `).get(req.userId)

  if (!member) {
    return res.json({ success: true }) // 没有绑定，无需操作
  }

  if (member.role === 'boss') {
    // 解散公司：删除所有成员、删除公司
    db.transaction(() => {
      db.prepare('DELETE FROM company_members WHERE company_id = ?').run(member.company_id)
      db.prepare('DELETE FROM companies WHERE id = ?').run(member.company_id)
    })()
  } else {
    // 员工退出
    db.prepare('DELETE FROM company_members WHERE id = ?').run(member.id)
  }

  res.json({ success: true })
})

module.exports = { company: router }
