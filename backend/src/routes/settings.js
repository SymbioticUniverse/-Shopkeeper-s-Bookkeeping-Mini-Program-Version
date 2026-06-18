/**
 * 设置路由 — 按 key 读写用户设置项
 */
const express = require('express')
const { db } = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// ==================== 读取设置 ====================

router.get('/', requireAuth, (req, res) => {
  const { key } = req.query
  if (!key) {
    return res.status(400).json({ error: '缺少 key 参数' })
  }

  const row = db.prepare(`
    SELECT value FROM user_settings
    WHERE user_id = ? AND key = ?
  `).get(req.userId, key)

  if (!row) {
    // 未设置过，返回 null（前端视为无值）
    return res.json(null)
  }

  // 尝试还原类型（布尔值/数字/字符串）
  res.json(parseValue(row.value))
})

// ==================== 保存设置 ====================

router.post('/', requireAuth, (req, res) => {
  const { key, value } = req.body || {}
  if (key === undefined || key === null) {
    return res.status(400).json({ error: '缺少 key 参数' })
  }

  const strValue = JSON.stringify(value)
  db.prepare(`
    INSERT INTO user_settings (user_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(req.userId, key, strValue)

  res.json({ success: true })
})

// ==================== 删除设置 ====================

router.delete('/', requireAuth, (req, res) => {
  const { key } = req.query
  if (!key) {
    return res.status(400).json({ error: '缺少 key 参数' })
  }

  db.prepare('DELETE FROM user_settings WHERE user_id = ? AND key = ?')
    .run(req.userId, key)

  res.json({ success: true })
})

// ==================== 工具函数 ====================

/** 将 JSON 字符串还原为原始类型 */
function parseValue(raw) {
  if (raw === null || raw === undefined) return undefined
  try {
    const parsed = JSON.parse(raw)
    // JSON.parse('"hello"') → 'hello'，需要特殊处理
    // 如果解析出的类型和原始字符串一致（非 JSON 包裹），直接返回原始值
    return parsed
  } catch (e) {
    return raw
  }
}

module.exports = { settings: router }
