/**
 * 账单路由 — CRUD + 垫付应付联动
 *
 * 安全加固：
 *   - voucher 字段入库前校验归属（防绕过上传接口设任意 URL）
 *   - DELETE 同步清理磁盘凭证文件
 */
const express = require('express')
const path = require('path')
const fs = require('fs')
const { db } = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// 凭证存储目录（与 upload.js 一致）
const VOUCHER_DIR = path.join(__dirname, '..', 'data', 'voucher')

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
    voucher: row.voucher || '',
    _voided: row.voided === 1
  }
}

/** 检查 item 是否属于当前用户 */
function checkOwnership(userId, id) {
  return db.prepare('SELECT id, scope FROM items WHERE id = ? AND user_id = ?').get(id, userId)
}

/** 防御性 sanitize userId（与 upload.js 一致） */
function sanitizeUserId(userId) {
  return String(userId).replace(/[\/\\\.]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown'
}

/**
 * 校验 voucher URL 是否属于当前用户
 * 接受格式：.../voucher/{userId}/... 或相对路径 {userId}/...
 * 返回校验后的标准化 voucher 字符串，非法时返回 null
 */
function validateVoucher(voucher, userId) {
  if (!voucher || typeof voucher !== 'string' || !voucher.trim()) {
    return ''  // 空值允许（无凭证）
  }
  const safeId = sanitizeUserId(userId)
  // 匹配 voucher 路径中是否包含 /{safeId}/ 段
  const normalized = voucher.replace(/\\/g, '/')
  if (normalized.includes('/' + safeId + '/')) {
    return voucher.trim()
  }
  // 也接受以 safeId/ 开头的相对路径
  if (normalized.startsWith(safeId + '/')) {
    return voucher.trim()
  }
  return null  // 非法 voucher
}

/** 从 voucher URL 提取磁盘文件路径 */
function voucherToDiskPath(voucher, userId) {
  if (!voucher) return null
  const safeId = sanitizeUserId(userId)
  const normalized = voucher.replace(/\\/g, '/')
  // 提取 /voucher/{safeId}/... 后的相对路径部分
  const idx = normalized.indexOf('/voucher/' + safeId + '/')
  let rel
  if (idx !== -1) {
    rel = normalized.slice(idx + '/voucher/'.length)  // e.g. "1/2026/06/uuid.jpg"
  } else if (normalized.startsWith(safeId + '/')) {
    rel = normalized  // already relative
  } else {
    return null
  }
  const absPath = path.resolve(VOUCHER_DIR, rel)
  // 防路径穿越
  if (!absPath.startsWith(VOUCHER_DIR + path.sep)) {
    return null
  }
  return absPath
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

  // 校验 voucher 归属
  if (item.voucher) {
    const valid = validateVoucher(item.voucher, req.userId)
    if (valid === null) {
      return res.status(400).json({ error: 'voucher 凭证路径不合法' })
    }
    item.voucher = valid
  }

  try {
    db.prepare(`
      INSERT INTO items (id, user_id, scope, category, type, type_label, amount, date, note, target, target_type, linked_id, voucher, voided)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      item.voucher || '',
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

  // 校验 voucher 归属
  if (data.voucher !== undefined) {
    if (data.voucher) {
      const valid = validateVoucher(data.voucher, req.userId)
      if (valid === null) {
        return res.status(400).json({ error: 'voucher 凭证路径不合法' })
      }
      data.voucher = valid
    }
    // 允许清空（data.voucher === ''）
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
  if (data.voucher !== undefined) {
    setClauses.push('voucher = ?')
    params.push(data.voucher)
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

// ==================== 删除账单（级联清理联动镜像 + 磁盘凭证文件） ====================

router.delete('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)

  const existing = checkOwnership(req.userId, id)
  if (!existing) {
    return res.status(404).json({ error: '账单不存在' })
  }

  // 先查出所有将被删除的 item 的 voucher，用于清理磁盘文件
  const toDelete = db.transaction(() => {
    // 获取当前 item
    const item = db.prepare('SELECT id, voucher, linked_id FROM items WHERE id = ?').get(id)
    const linkedId = item ? item.linked_id : null

    // 收集所有将被删除的 id 及其 voucher
    const deletedIds = [id]
    const vouchersToClean = []
    if (item && item.voucher) {
      vouchersToClean.push({ id: item.id, voucher: item.voucher })
    }

    // 级联镜像
    if (linkedId) {
      const mirror = db.prepare('SELECT id, voucher FROM items WHERE id = ?').get(linkedId)
      if (mirror) {
        deletedIds.push(mirror.id)
        if (mirror.voucher) {
          vouchersToClean.push({ id: mirror.id, voucher: mirror.voucher })
        }
      }
    }
    // linked_id 指向本记录的镜像
    const reverseMirrors = db.prepare('SELECT id, voucher FROM items WHERE linked_id = ?').all(id)
    for (const m of reverseMirrors) {
      deletedIds.push(m.id)
      if (m.voucher) {
        vouchersToClean.push({ id: m.id, voucher: m.voucher })
      }
    }

    // 执行删除
    for (const did of deletedIds) {
      db.prepare('DELETE FROM items WHERE id = ?').run(did)
    }

    return vouchersToClean
  })()

  // 清理磁盘凭证文件（非事务，失败不影响响应）
  for (const vc of toDelete) {
    const diskPath = voucherToDiskPath(vc.voucher, req.userId)
    if (diskPath) {
      try {
        if (fs.existsSync(diskPath)) {
          fs.unlinkSync(diskPath)
        }
      } catch (e) {
        console.error(`[VOUCHER] 删除凭证文件失败: ${diskPath}`, e.message)
      }
    }
  }

  res.json({ success: true })
})

// ==================== 联动新增 — 事务写入两条关联账单 ====================

router.post('/linked', requireAuth, (req, res) => {
  const { scope, mirrorScope, item, mirrorItem } = req.body || {}

  if (!scope || !mirrorScope || !item || !mirrorItem) {
    return res.status(400).json({ error: '参数不完整：需要 scope, item, mirrorScope, mirrorItem' })
  }
  if (!['personal', 'company'].includes(scope) || !['personal', 'company'].includes(mirrorScope)) {
    return res.status(400).json({ error: 'scope 参数无效，需为 personal 或 company' })
  }
  if (!item.id || !mirrorItem.id) {
    return res.status(400).json({ error: 'item 和 mirrorItem 必须包含 id' })
  }

  // 校验 voucher 归属
  if (item.voucher) {
    const valid = validateVoucher(item.voucher, req.userId)
    if (valid === null) {
      return res.status(400).json({ error: 'voucher 凭证路径不合法' })
    }
    item.voucher = valid
  }
  if (mirrorItem.voucher) {
    const valid = validateVoucher(mirrorItem.voucher, req.userId)
    if (valid === null) {
      return res.status(400).json({ error: 'mirrorItem voucher 凭证路径不合法' })
    }
    mirrorItem.voucher = valid
  }

  const insertStmt = db.prepare(`
    INSERT INTO items (id, user_id, scope, category, type, type_label, amount, date, note, target, target_type, linked_id, voucher, voided)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // 事务：两条同时写入，任一失败自动回滚
  const doInsert = db.transaction(() => {
    insertStmt.run(
      item.id, req.userId, scope,
      item.category, item.type, item.typeLabel,
      item.amount, item.date,
      item.note || '', item.target || '', item.targetType || '',
      item.linkedId || null, item.voucher || '', item._voided ? 1 : 0
    )
    insertStmt.run(
      mirrorItem.id, req.userId, mirrorScope,
      mirrorItem.category, mirrorItem.type, mirrorItem.typeLabel,
      mirrorItem.amount, mirrorItem.date,
      mirrorItem.note || '', mirrorItem.target || '', mirrorItem.targetType || '',
      mirrorItem.linkedId || null, mirrorItem.voucher || '', mirrorItem._voided ? 1 : 0
    )
  })

  try {
    doInsert()
    res.json({ success: true, id: item.id, mirrorId: mirrorItem.id })
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(409).json({ error: '账单 id 已存在' })
    }
    console.error('联动写入失败:', err.message)
    res.status(500).json({ error: '联动写入失败' })
  }
})

module.exports = { items: router }
