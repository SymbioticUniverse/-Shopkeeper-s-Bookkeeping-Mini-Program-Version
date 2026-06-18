/**
 * 账单路由 — CRUD + 垫付应付联动
 */
const express = require('express')
const { db } = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// ==================== 工具函数 ====================

/** DB 行 (snake_case) → API 对象 (camelCase) */
function rowToItem(row) {
  if (!row) return null
  return {
    id: row.id,
    category: row.category,
    type: row.type,
    typeLabel: row.type_label,
    scope: row.scope,
    amount: String(row.amount),
    date: row.date,
    note: row.note || '',
    target: row.target || '',
    targetType: row.target_type || '',
    linkedId: row.linked_id ?? undefined,
    _voided: row.voided === 1
  }
}

/** 检查 item 是否属于当前用户 */
function checkOwnership(userId, id) {
  return db.prepare('SELECT id, scope FROM items WHERE id = ? AND user_id = ?').get(id, userId)
}

// ==================== 获取账单列表 ====================

router.get('/', requireAuth, (req, res) => {
  const { scope } = req.query
  if (!scope || !['personal', 'company'].includes(scope)) {
    return res.status(400).json({ error: 'scope 参数无效，需为 personal 或 company' })
  }

  const rows = db.prepare(`
    SELECT * FROM items
    WHERE user_id = ? AND scope = ?
    ORDER BY id DESC
  `).all(req.userId, scope)

  res.json(rows.map(rowToItem))
})

// ==================== 新增账单 ====================

router.post('/', requireAuth, (req, res) => {
  const { scope, item } = req.body || {}
  if (!scope || !['personal', 'company'].includes(scope)) {
    return res.status(400).json({ error: 'scope 参数无效' })
  }
  if (!item || !item.id) {
    return res.status(400).json({ error: 'item 数据不完整' })
  }

  try {
    db.prepare(`
      INSERT INTO items (id, user_id, scope, category, type, type_label, amount, date, note, target, target_type, linked_id, voided)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id,
      req.userId,
      scope,
      item.category,
      item.type,
      item.typeLabel,
      item.amount,
      item.date,
      item.note || '',
      item.target || '',
      item.targetType || '',
      item.linkedId || null,
      item._voided ? 1 : 0
    )
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(409).json({ error: '账单 id 已存在' })
    }
    throw err
  }

  res.json(item)
})

// ==================== 更新账单字段 ====================

router.put('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const data = req.body || {}

  // 检查归属
  const existing = checkOwnership(req.userId, id)
  if (!existing) {
    return res.status(404).json({ error: '账单不存在' })
  }

  // 构建动态 UPDATE
  const setClauses = []
  const params = []

  if (data.category !== undefined) {
    setClauses.push('category = ?')
    params.push(data.category)
  }
  if (data.type !== undefined) {
    setClauses.push('type = ?')
    params.push(data.type)
  }
  if (data.typeLabel !== undefined) {
    setClauses.push('type_label = ?')
    params.push(data.typeLabel)
  }
  if (data.amount !== undefined) {
    setClauses.push('amount = ?')
    params.push(data.amount)
  }
  if (data.date !== undefined) {
    setClauses.push('date = ?')
    params.push(data.date)
  }
  if (data.note !== undefined) {
    setClauses.push('note = ?')
    params.push(data.note)
  }
  if (data.target !== undefined) {
    setClauses.push('target = ?')
    params.push(data.target)
  }
  if (data.targetType !== undefined) {
    setClauses.push('target_type = ?')
    params.push(data.targetType)
  }
  if (data.linkedId !== undefined) {
    setClauses.push('linked_id = ?')
    params.push(data.linkedId)
  }
  if (data._voided !== undefined) {
    setClauses.push('voided = ?')
    params.push(data._voided ? 1 : 0)
  }

  if (setClauses.length === 0) {
    return res.json({ success: true })
  }

  params.push(id)

  // 事务包裹：主更新 + 镜像级联更新要么全成功要么全回滚
  const updated = db.transaction(() => {
    db.prepare(`UPDATE items SET ${setClauses.join(', ')} WHERE id = ?`).run(...params)

    // 级联更新：同步 linked_id 关联的镜像记录
    const item = db.prepare('SELECT linked_id FROM items WHERE id = ?').get(id)
    const linkedId = item ? item.linked_id : null
    // 也查找 linked_id 指向本记录的镜像
    const mirror = linkedId
      ? db.prepare('SELECT id FROM items WHERE id = ?').get(linkedId)
      : db.prepare('SELECT id FROM items WHERE linked_id = ?').get(id)

    if (mirror) {
      const mirrorClauses = []
      const mirrorParams = []
      // 同步关键字段到镜像（金额、日期、备注、作废状态）
      if (data.amount !== undefined) {
        mirrorClauses.push('amount = ?')
        mirrorParams.push(data.amount)
      }
      if (data.date !== undefined) {
        mirrorClauses.push('date = ?')
        mirrorParams.push(data.date)
      }
      if (data.note !== undefined) {
        mirrorClauses.push('note = ?')
        mirrorParams.push(data.note)
      }
      if (data._voided !== undefined) {
        mirrorClauses.push('voided = ?')
        mirrorParams.push(data._voided ? 1 : 0)
      }
      if (mirrorClauses.length > 0) {
        mirrorParams.push(mirror.id)
        db.prepare(`UPDATE items SET ${mirrorClauses.join(', ')} WHERE id = ?`).run(...mirrorParams)
      }
    }

    return db.prepare('SELECT * FROM items WHERE id = ?').get(id)
  })()

  res.json(rowToItem(updated))
})

// ==================== 删除账单（级联清理联动镜像） ====================

router.delete('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)

  const existing = checkOwnership(req.userId, id)
  if (!existing) {
    return res.status(404).json({ error: '账单不存在' })
  }

  db.transaction(() => {
    // 获取当前 item 的 linkedId
    const item = db.prepare('SELECT linked_id FROM items WHERE id = ?').get(id)
    const linkedId = item ? item.linked_id : null

    // 删除当前 item
    db.prepare('DELETE FROM items WHERE id = ?').run(id)

    // 级联：删除 linked_id 指向当前 item 的镜像
    if (linkedId) {
      db.prepare('DELETE FROM items WHERE id = ?').run(linkedId)
    }
    // 级联：删除 linked_id 指向当前 item 的其他 item
    db.prepare('DELETE FROM items WHERE linked_id = ?').run(id)
  })()

  res.json({ success: true })
})

// ==================== 联动新增 — 事务写入两条关联账单 ====================

router.post('/linked', requireAuth, (req, res) => {
  const { scope, item, mirrorScope, mirrorItem } = req.body || {}

  if (!scope || !mirrorScope || !item || !mirrorItem) {
    return res.status(400).json({ error: '参数不完整：需要 scope, item, mirrorScope, mirrorItem' })
  }
  if (!item.id || !mirrorItem.id) {
    return res.status(400).json({ error: 'item 和 mirrorItem 必须包含 id' })
  }

  const insertStmt = db.prepare(`
    INSERT INTO items (id, user_id, scope, category, type, type_label, amount, date, note, target, target_type, linked_id, voided)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // 事务：两条同时写入，任一失败自动回滚
  const doInsert = db.transaction(() => {
    insertStmt.run(
      item.id, req.userId, scope,
      item.category, item.type, item.typeLabel,
      item.amount, item.date,
      item.note || '', item.target || '', item.targetType || '',
      item.linkedId || null, item._voided ? 1 : 0
    )
    insertStmt.run(
      mirrorItem.id, req.userId, mirrorScope,
      mirrorItem.category, mirrorItem.type, mirrorItem.typeLabel,
      mirrorItem.amount, mirrorItem.date,
      mirrorItem.note || '', mirrorItem.target || '', mirrorItem.targetType || '',
      mirrorItem.linkedId || null, mirrorItem._voided ? 1 : 0
    )
  })

  try {
    doInsert()
    res.json({ success: true, id: item.id, mirrorId: mirrorItem.id })
  } catch (err) {
    console.error('联动写入失败:', err.message)
    res.status(500).json({ error: '联动写入失败' })
  }
})

module.exports = { items: router }
