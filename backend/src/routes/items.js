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
const crypto = require('crypto')
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
    settleStatus: row.settleStatus ?? undefined,
    settleInfo: row.settleInfo ?? undefined,
    _autoSettle: row._autoSettle === 1,
    _voided: row.voided === 1
  }
}

/** 检查 item 是否属于当前用户 */
function checkOwnership(userId, id) {
  return db.prepare('SELECT id, scope FROM items WHERE id = ? AND user_id = ?').get(id, userId)
}

/** 校验 linkedId 合法：存在且属于当前用户。拒绝 0（非合法 id） */
function validateLinkedId(userId, linkedId) {
  if (linkedId === null || linkedId === undefined || linkedId === '') return true
  if (!Number.isFinite(linkedId) || linkedId <= 0) return false
  const row = db.prepare('SELECT id FROM items WHERE id = ? AND user_id = ?').get(linkedId, userId)
  return !!row
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

  // 校验 amount 类型（拒绝 NaN、非数字、负数）
  const amt = Number(item.amount)
  if (item.amount === undefined || item.amount === null || !Number.isFinite(amt) || amt < 0) {
    return res.status(400).json({ error: 'amount 必须为非负数字' })
  }
  item.amount = amt

  // 校验 note 长度（≤2000 字符）
  if (item.note && item.note.length > 2000) {
    return res.status(400).json({ error: 'note 不能超过 2000 字符' })
  }

  // 校验 linkedId 归属
  if (item.linkedId && !validateLinkedId(req.userId, item.linkedId)) {
    return res.status(400).json({ error: 'linkedId 指向的账单不存在或不属于当前用户' })
  }

  try {
    db.prepare(`
      INSERT INTO items (id, user_id, scope, category, type, type_label, amount, date, note, target, target_type, linked_id, voucher, voided, settleStatus, settleInfo, _autoSettle)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      item._voided ? 1 : 0,
      item.settleStatus || null,
      item.settleInfo || null,
      item._autoSettle ? 1 : 0
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
    // 校验 typeLabel 与 type 一致性：如果同时传了 type，以 type 为准；
    // 如果未传 type，以 DB 中已有的 type 为准验证
    let effectiveType = data.type
    if (effectiveType === undefined) {
      const row = db.prepare('SELECT type FROM items WHERE id = ?').get(id)
      effectiveType = row ? row.type : null
    }
    if (effectiveType === 'in' && !data.typeLabel.includes('收入')) {
      return res.status(400).json({ error: 'typeLabel 与 type 不匹配：收入类账单 typeLabel 应包含"收入"' })
    }
    if (effectiveType === 'out' && !data.typeLabel.includes('支出')) {
      return res.status(400).json({ error: 'typeLabel 与 type 不匹配：支出类账单 typeLabel 应包含"支出"' })
    }
    setClauses.push('type_label = ?')
    params.push(data.typeLabel)
  }
  if (data.amount !== undefined) {
    const amt = Number(data.amount)
    if (!Number.isFinite(amt) || amt < 0) {
      return res.status(400).json({ error: 'amount 必须为非负数字' })
    }
    setClauses.push('amount = ?')
    params.push(amt)
  }
  if (data.date !== undefined) {
    setClauses.push('date = ?')
    params.push(data.date)
  }
  if (data.note !== undefined) {
    if (data.note && data.note.length > 2000) {
      return res.status(400).json({ error: 'note 不能超过 2000 字符' })
    }
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
    // 校验 linkedId 归属
    if (data.linkedId !== null && !validateLinkedId(req.userId, data.linkedId)) {
      return res.status(400).json({ error: 'linkedId 指向的账单不存在或不属于当前用户' })
    }
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
  if (data.settleStatus !== undefined) {
    setClauses.push('settleStatus = ?')
    params.push(data.settleStatus)
  }
  if (data.settleInfo !== undefined) {
    setClauses.push('settleInfo = ?')
    params.push(data.settleInfo)
  }
  if (data._autoSettle !== undefined) {
    setClauses.push('_autoSettle = ?')
    params.push(data._autoSettle ? 1 : 0)
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

  // 拒绝删除系统自动结清记录（_autoSettle=true）
  const itemCheck = db.prepare('SELECT id, _autoSettle FROM items WHERE id = ?').get(id)
  if (itemCheck && itemCheck._autoSettle === 1) {
    return res.status(403).json({ error: '系统自动结清记录不可手动删除' })
  }

  // 先查出所有将被删除的 item 的 voucher，用于清理磁盘文件
  const toDelete = db.transaction(() => {
    // 获取当前 item
    const item = db.prepare('SELECT id, voucher, linked_id FROM items WHERE id = ?').get(id)
    const linkedId = item ? item.linked_id : null

    // 收集所有将被删除的 id 及其 voucher
    const deletedSet = new Set()
    deletedSet.add(id)
    const vouchersToClean = []
    if (item && item.voucher) {
      vouchersToClean.push({ id: item.id, voucher: item.voucher })
    }

    // 级联镜像
    if (linkedId) {
      const mirror = db.prepare('SELECT id, voucher FROM items WHERE id = ?').get(linkedId)
      if (mirror && !deletedSet.has(mirror.id)) {
        deletedSet.add(mirror.id)
        if (mirror.voucher) {
          vouchersToClean.push({ id: mirror.id, voucher: mirror.voucher })
        }
      }
    }
    // linked_id 指向本记录的镜像（限制同用户，防跨用户级联误删）
    const reverseMirrors = db.prepare('SELECT id, voucher FROM items WHERE linked_id = ? AND user_id = ?').all(id, req.userId)
    for (const m of reverseMirrors) {
      if (!deletedSet.has(m.id)) {
        deletedSet.add(m.id)
        if (m.voucher) {
          vouchersToClean.push({ id: m.id, voucher: m.voucher })
        }
      }
    }

    // 执行删除
    for (const did of deletedSet) {
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

  // 校验 amount
  const amt1 = Number(item.amount)
  const amt2 = Number(mirrorItem.amount)
  if (!Number.isFinite(amt1) || amt1 < 0) {
    return res.status(400).json({ error: 'item.amount 必须为非负数字' })
  }
  if (!Number.isFinite(amt2) || amt2 < 0) {
    return res.status(400).json({ error: 'mirrorItem.amount 必须为非负数字' })
  }
  item.amount = amt1
  mirrorItem.amount = amt2

  // 校验 note 长度（≤2000 字符）
  if (item.note && item.note.length > 2000) {
    return res.status(400).json({ error: 'item.note 不能超过 2000 字符' })
  }
  if (mirrorItem.note && mirrorItem.note.length > 2000) {
    return res.status(400).json({ error: 'mirrorItem.note 不能超过 2000 字符' })
  }

  // 校验 linkedId 归属
  if (item.linkedId && !validateLinkedId(req.userId, item.linkedId)) {
    return res.status(400).json({ error: 'item.linkedId 指向的账单不存在或不属于当前用户' })
  }
  if (mirrorItem.linkedId && !validateLinkedId(req.userId, mirrorItem.linkedId)) {
    return res.status(400).json({ error: 'mirrorItem.linkedId 指向的账单不存在或不属于当前用户' })
  }

  // 防止 item.id 与 mirrorItem.id 相同，造成主键冲突
  if (item.id === mirrorItem.id) {
    return res.status(409).json({ error: '账单 id 冲突：item.id 与 mirrorItem.id 相同' })
  }

  const insertStmt = db.prepare(`
    INSERT INTO items (id, user_id, scope, category, type, type_label, amount, date, note, target, target_type, linked_id, voucher, voided, settleStatus, settleInfo, _autoSettle)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // 事务：两条同时写入，任一失败自动回滚
  const doInsert = db.transaction(() => {
    insertStmt.run(
      item.id, req.userId, scope,
      item.category, item.type, item.typeLabel,
      item.amount, item.date,
      item.note || '', item.target || '', item.targetType || '',
      item.linkedId || null, item.voucher || '', item._voided ? 1 : 0,
      item.settleStatus || null, item.settleInfo || null, item._autoSettle ? 1 : 0
    )
    insertStmt.run(
      mirrorItem.id, req.userId, mirrorScope,
      mirrorItem.category, mirrorItem.type, mirrorItem.typeLabel,
      mirrorItem.amount, mirrorItem.date,
      mirrorItem.note || '', mirrorItem.target || '', mirrorItem.targetType || '',
      mirrorItem.linkedId || null, mirrorItem.voucher || '', mirrorItem._voided ? 1 : 0,
      mirrorItem.settleStatus || null, mirrorItem.settleInfo || null, mirrorItem._autoSettle ? 1 : 0
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

// ==================== 结清 — 事务性结清应付项 ====================

/**
 * PUT /api/items/:id/settle
 * 公司结清应付项（Case A/B）或 个人结清应付项（Case C）
 * 同一事务内完成：更新 + 创建自动对账记录 + 镜像联动
 */
router.put('/:id/settle', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const { settleInfo } = req.body || {}
  const settleTime = settleInfo || (() => {
    const d = new Date()
    return `${d.getFullYear()}年${String(d.getMonth()+1).padStart(2,'0')}月${String(d.getDate()).padStart(2,'0')}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  })()

  // 检查归属
  const existing = checkOwnership(req.userId, id)
  if (!existing) {
    return res.status(404).json({ error: '账单不存在' })
  }

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id)

  // 幂等性：已结清的项直接返回成功
  if (item.settleStatus === 'settled') {
    return res.json({ ok: true, idempotent: true })
  }

  // 只允许结清应付项
  if (item.type_label !== '应付') {
    return res.status(400).json({ error: '仅结清应付项可通过此接口操作' })
  }

  const settleScope = item.scope
  const today = new Date().toISOString().slice(0, 10)
  const now = Date.now()

  // 查找镜像（垫付项）
  const mirrorItem = item.linked_id
    ? db.prepare('SELECT * FROM items WHERE id = ?').get(item.linked_id)
    : db.prepare('SELECT * FROM items WHERE linked_id = ? AND user_id = ?').get(id, req.userId)

  // 判断是否为 boss
  const member = db.prepare(`
    SELECT role FROM company_members
    WHERE user_id = ? AND status = 'approved'
  `).get(req.userId)
  const isBoss = member && member.role === 'boss'

  const autoIds = []
  const insertedItems = []

  try {
    db.transaction(() => {
      if (settleScope === 'company') {
        // Case A/B: 公司结清应付
        const settleInfoStr = settleTime + ' 由[应付]结清'
        db.prepare(`UPDATE items SET settleStatus = 'settled', settleInfo = ? WHERE id = ?`)
          .run(settleInfoStr, id)

        // 创建公司支出自动记录
        const cExpId = now + 10
        db.prepare(`
          INSERT INTO items (id, user_id, scope, category, type, type_label, amount, date, note, target, target_type, settleInfo, _autoSettle)
          VALUES (?, ?, 'company', ?, 'out', '支出', ?, ?, '', ?, ?, ?, 1)
        `).run(
          cExpId, req.userId,
          item.category, item.amount, today,
          item.target || '', item.target_type || 'internal',
          settleInfoStr
        )
        autoIds.push(cExpId)
        insertedItems.push({ id: cExpId, scope: 'company', type: 'out', typeLabel: '支出' })

        // 处理镜像（个人垫付）
        if (mirrorItem && mirrorItem.user_id === req.userId) {
          if (isBoss) {
            const pSettleInfo = settleTime + ' 由[垫付]结清'
            db.prepare(`UPDATE items SET settleStatus = 'settled', settleInfo = ?, type_label = '支出' WHERE id = ?`)
              .run(pSettleInfo, mirrorItem.id)

            const pIncId = now + 11
            db.prepare(`
              INSERT INTO items (id, user_id, scope, category, type, type_label, amount, date, note, target, target_type, settleInfo, _autoSettle)
              VALUES (?, ?, 'personal', ?, 'in', '收入', ?, ?, '', ?, ?, ?, 1)
            `).run(
              pIncId, req.userId,
              mirrorItem.category, mirrorItem.amount, today,
              mirrorItem.target || '', mirrorItem.target_type || 'internal',
              pSettleInfo
            )
            autoIds.push(pIncId)
            insertedItems.push({ id: pIncId, scope: 'personal', type: 'in', typeLabel: '收入' })
          } else {
            db.prepare(`UPDATE items SET settleStatus = 'company_settled' WHERE id = ?`)
              .run(mirrorItem.id)

            // 创建通知（非 boss 场景）
            const notifyId = crypto.randomInt(1, 2147483647)
            db.prepare(`
              INSERT INTO notifications (id, user_id, text, time, read, source, type, target_user_id, item_id)
              VALUES (?, ?, ?, datetime('now'), 0, 'system', 'settle_pending', ?, ?)
            `).run(
              notifyId, req.userId,
              `公司已结清您的垫付款 ¥${Number(item.amount).toFixed(2)}，请确认到账`,
              req.userId,
              mirrorItem.id
            )
          }
        }
      } else {
        // Case C: 个人结清应付
        const settleInfoStr = settleTime + ' 由[应付]结清'
        db.prepare(`UPDATE items SET settleStatus = 'settled', settleInfo = ? WHERE id = ?`)
          .run(settleInfoStr, id)

        // 创建个人支出自动记录
        const pExpId = now + 10
        db.prepare(`
          INSERT INTO items (id, user_id, scope, category, type, type_label, amount, date, note, target, target_type, settleInfo, _autoSettle)
          VALUES (?, ?, 'personal', ?, 'out', '支出', ?, ?, '', ?, ?, ?, 1)
        `).run(
          pExpId, req.userId,
          item.category, item.amount, today,
          item.target || '', item.target_type || 'internal',
          settleInfoStr
        )
        autoIds.push(pExpId)
        insertedItems.push({ id: pExpId, scope: 'personal', type: 'out', typeLabel: '支出' })

        // 更新公司镜像
        if (mirrorItem && mirrorItem.user_id === req.userId) {
          const cSettleInfo = settleTime + ' 由[垫付]结清'
          db.prepare(`UPDATE items SET settleStatus = 'settled', settleInfo = ?, type_label = '收入' WHERE id = ?`)
            .run(cSettleInfo, mirrorItem.id)

          const cIncId = now + 11
          db.prepare(`
            INSERT INTO items (id, user_id, scope, category, type, type_label, amount, date, note, target, target_type, settleInfo, _autoSettle)
            VALUES (?, ?, 'company', ?, 'in', '收入', ?, ?, '', ?, ?, ?, 1)
          `).run(
            cIncId, req.userId,
            mirrorItem.category, mirrorItem.amount, today,
            mirrorItem.target || '', mirrorItem.target_type || 'internal',
            cSettleInfo
          )
          autoIds.push(cIncId)
          insertedItems.push({ id: cIncId, scope: 'company', type: 'in', typeLabel: '收入' })
        }
      }
    })()
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(409).json({ error: '自动结清记录 id 冲突，请重试' })
    }
    console.error('结清事务失败:', err.message)
    return res.status(500).json({ error: '结清事务失败' })
  }

  res.json({ ok: true, autoItems: insertedItems })
})

// ==================== 结清确认 — 个人确认垫付项到账 ====================

/**
 * POST /api/items/:id/settle-confirm
 * 个人确认垫付项到账（仅 settleStatus === 'company_settled' 的项可操作）
 */
router.post('/:id/settle-confirm', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const { settleInfo } = req.body || {}
  const settleTime = settleInfo || (() => {
    const d = new Date()
    return `${d.getFullYear()}年${String(d.getMonth()+1).padStart(2,'0')}月${String(d.getDate()).padStart(2,'0')}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  })()

  // 检查归属
  const existing = checkOwnership(req.userId, id)
  if (!existing) {
    return res.status(404).json({ error: '账单不存在' })
  }

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id)

  // 校验状态必须是 company_settled
  if (item.settleStatus !== 'company_settled') {
    return res.status(400).json({ error: '当前账单状态不支持确认结清操作' })
  }

  // 只允许垫付项
  if (item.type_label !== '垫付') {
    return res.status(400).json({ error: '仅垫付项可确认到账' })
  }

  const today = new Date().toISOString().slice(0, 10)
  const now = Date.now()
  const settleInfoStr = settleTime + ' 由[垫付]结清'

  try {
    db.transaction(() => {
      // 更新垫付项
      db.prepare(`UPDATE items SET settleStatus = 'settled', settleInfo = ?, type_label = '支出' WHERE id = ?`)
        .run(settleInfoStr, id)

      // 创建个人收入自动记录
      const pIncId = now + 10
      db.prepare(`
        INSERT INTO items (id, user_id, scope, category, type, type_label, amount, date, note, target, target_type, settleInfo, _autoSettle)
        VALUES (?, ?, 'personal', ?, 'in', '收入', ?, ?, '', ?, ?, ?, 1)
      `).run(
        pIncId, req.userId,
        item.category, item.amount, today,
        item.target || '', item.target_type || 'internal',
        settleInfoStr
      )
    })()
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(409).json({ error: '自动结清记录 id 冲突，请重试' })
    }
    console.error('确认结清事务失败:', err.message)
    return res.status(500).json({ error: '确认结清事务失败' })
  }

  res.json({ ok: true })
})

module.exports = { items: router }
