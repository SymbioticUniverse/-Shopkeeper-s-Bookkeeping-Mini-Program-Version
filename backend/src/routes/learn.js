/**
 * 学习路由 — 上传标注数据集 / CSV，生成 ASR/OCR 纠错映射
 *
 * 内部使用，需认证。
 *
 * 端点：
 *   POST /api/learn/upload      — JSON 上传（程序调用）
 *   POST /api/learn/upload-csv  — CSV 文件上传（推荐）
 */

const express = require('express')
const router = express.Router()
const multer = require('multer')
const { db } = require('../db')
const { requireAuth } = require('../middleware/auth')

// CSV 解析用临时目录
const upload = multer({ storage: multer.memoryStorage() })

// ==================== 预编译 SQL ====================

const insertCorrection = db.prepare(`
  INSERT OR IGNORE INTO asr_corrections (wrong, correct) VALUES (?, ?)
`)

const insertItemCategory = db.prepare(`
  INSERT OR IGNORE INTO item_category_map (item, category) VALUES (?, ?)
`)

const insertPattern = db.prepare(`
  INSERT OR IGNORE INTO asr_patterns (verb, subject, direction, scope) VALUES (?, ?, ?, ?)
`)

const insertOcrMerchant = db.prepare(`
  INSERT OR REPLACE INTO ocr_merchants (keyword, category, note) VALUES (?, ?, ?)
`)

// ==================== 工具函数 ====================

/**
 * 简单中文文本 diff — 提取错词 → 正确词映射
 *
 * 策略：逐字符 LCS 后提取差异片段。
 * 只输出 2-6 字的短差异对（ASR 典型错误：单字/双字替换）。
 */
function extractCorrections(rawText, correctText) {
  const mappings = []
  if (!rawText || !correctText || rawText === correctText) return mappings

  // 逐字符 LCS
  const m = rawText.length
  const n = correctText.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (rawText[i - 1] === correctText[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // 回溯提取差异片段
  let i = m, j = n
  let rawSeg = '', correctSeg = ''
  const pairs = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && rawText[i - 1] === correctText[j - 1]) {
      // 匹配字符 — 之前的累积差异片段结算
      if (rawSeg || correctSeg) {
        pairs.push({ raw: rawSeg, correct: correctSeg })
        rawSeg = ''
        correctSeg = ''
      }
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      correctSeg = correctText[j - 1] + correctSeg
      j--
    } else {
      rawSeg = rawText[i - 1] + rawSeg
      i--
    }
  }
  if (rawSeg || correctSeg) {
    pairs.push({ raw: rawSeg, correct: correctSeg })
  }

  // 合并相邻的短片段，过滤过短/过长的
  for (const p of pairs) {
    const wrong = p.raw.trim()
    const correct = p.correct.trim()
    if (!wrong && !correct) continue
    if (!wrong || !correct) continue
    if (wrong === correct) continue
    if (wrong.length < 1 || wrong.length > 6) continue
    if (correct.length < 1 || correct.length > 6) continue
    // 过滤纯标点差异
    if (/^[\s，。！？、；：""''（）《》【】,.!?;:'"()]+$/.test(wrong)) continue
    mappings.push({ wrong, correct })
  }

  return mappings
}

/**
 * 从 7 字段拼装正确文本：动词 + 项目词 + 金额 + 量词
 */
function assembleCorrectText(verb, item, amount, measure) {
  const parts = []
  if (verb && verb !== '-') parts.push(verb)
  if (item && item !== '-') parts.push(item)
  if (amount) parts.push(amount)
  if (measure && measure !== '-') parts.push(measure)
  return parts.join('')
}

/**
 * 从 verb 推断 direction：收入动词 → income，其余 → expense
 */
function inferDirection(verb) {
  const incomeVerbs = ['收到', '收入', '发了', '报销', '退款', '进账', '赚了', '收']
  for (const kw of incomeVerbs) {
    if (verb && verb.includes(kw)) return '收入'
  }
  return '支出'
}

// ==================== 内部：处理学习记录 ====================

/**
 * 处理一条 asr_structured 记录，返回新增映射统计
 */
function learnStructuredRecord(record) {
  const stats = { corrections: 0, itemCategories: 0, patterns: 0 }

  const { rawText, verb, measure, subject, item, category, amount, direction, correctText } = record

  // 自动拼装正确文本（如果未提供）
  const finalCorrect = correctText || assembleCorrectText(verb, item, amount, measure)

  // 第一层：错词纠错（diff rawText vs correctText）
  if (rawText && finalCorrect) {
    const mappings = extractCorrections(rawText, finalCorrect)
    for (const m of mappings) {
      const result = insertCorrection.run(m.wrong, m.correct)
      if (result.changes > 0) stats.corrections++
    }
  }

  // 第二层：项目词 → 分类映射
  if (item && item !== '-' && category && category !== '-') {
    const result = insertItemCategory.run(item, category)
    if (result.changes > 0) stats.itemCategories++
  }

  // 第三层：句式模式学习
  if (verb && verb !== '-') {
    const dir = direction || inferDirection(verb)
    const subj = subject === '公司' ? 'company' : 'personal'
    const result = insertPattern.run(verb, subj, dir, subj)
    if (result.changes > 0) stats.patterns++
  }

  return stats
}

/**
 * 处理一条 OCR 学习记录
 */
function learnOcrRecord(record) {
  const stats = { ocrMerchants: 0 }
  const { keyword, correctCategory, correctAmount, correctNote } = record

  if (keyword && correctCategory) {
    const note = correctNote || keyword
    const result = insertOcrMerchant.run(keyword, correctCategory, note)
    if (result.changes > 0) stats.ocrMerchants++
  }

  return stats
}

// ==================== CSV 解析 ====================

/**
 * 解析 CSV 字符串为对象数组
 * 简单实现：支持逗号分隔，双引号括字段
 */
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = parseCSVLine(lines[0])
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length === 0) continue
    const row = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || ''
    }
    rows.push(row)
  }
  return { headers, rows }
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

/**
 * 将 CSV 行转换为 asr_structured record 格式
 * CSV 列：原始识别文本,动词,量词,主体,项目词,分类,金额,收支,正确文本
 */
function csvRowToStructured(row, headers) {
  // 按列名映射（兼容中英文 header）
  const get = (names) => {
    for (const n of names) {
      if (row[n] !== undefined) return row[n]
    }
    // fallback: 按位置
    return ''
  }

  const rawText = get(['原始识别文本', 'rawText', 'raw_text'])
  const verb = get(['动词', 'verb'])
  const measure = get(['量词', 'measure'])
  const subject = get(['主体', 'subject'])
  const item = get(['项目词', 'item'])
  const category = get(['分类', 'category'])
  const amount = get(['金额', 'amount'])
  const direction = get(['收支', 'direction'])
  const correctText = get(['正确文本', 'correctText', 'correct_text'])

  // 如果按列名全空，尝试按位置解析
  if (!rawText && !verb && !item) {
    const vals = headers.map(h => row[h] || '')
    return {
      rawText: vals[0] || '',
      verb: vals[1] || '',
      measure: vals[2] || '',
      subject: vals[3] || '',
      item: vals[4] || '',
      category: vals[5] || '',
      amount: vals[6] || '',
      direction: vals[7] || '',
      correctText: vals[8] || ''
    }
  }

  return { rawText, verb, measure, subject, item, category, amount, direction, correctText }
}

// ==================== 路由 ====================

// 所有 learn 路由需要认证
router.use(requireAuth)

/**
 * POST /api/learn/upload — JSON 格式上传标注数据
 */
router.post('/upload', (req, res) => {
  try {
    const { type, records } = req.body
    if (!type || !records || !Array.isArray(records)) {
      return res.status(400).json({ error: '缺少 type 或 records 参数' })
    }

    const stats = {
      totalRows: records.length,
      correctionsAdded: 0,
      itemCategoryMappingsAdded: 0,
      patternsLearned: 0,
      ocrMappingsAdded: 0
    }

    for (const record of records) {
      if (type === 'asr_structured') {
        const s = learnStructuredRecord(record)
        stats.correctionsAdded += s.corrections
        stats.itemCategoryMappingsAdded += s.itemCategories
        stats.patternsLearned += s.patterns
      } else if (type === 'asr') {
        // 旧版 ASR 格式：{ fileUrl, correctText } — 无 rawText 则跳过 diff
        const s = learnStructuredRecord({
          rawText: record.rawText || '',
          verb: '',
          measure: '',
          subject: '',
          item: '',
          category: '',
          amount: '',
          direction: '',
          correctText: record.correctText
        })
        stats.correctionsAdded += s.corrections
        stats.itemCategoryMappingsAdded += s.itemCategories
        stats.patternsLearned += s.patterns
      } else if (type === 'ocr') {
        const s = learnOcrRecord({
          keyword: record.merchantName || record.keyword || '',
          correctCategory: record.correctCategory,
          correctAmount: record.correctAmount,
          correctNote: record.correctNote || record.merchantName || ''
        })
        stats.ocrMappingsAdded += s.ocrMerchants
      } else {
        return res.status(400).json({ error: `不支持的类型: ${type}` })
      }
    }

    res.json({
      ok: true,
      ...stats
    })
  } catch (e) {
    console.error('[LEARN] upload 失败:', e.message)
    res.status(500).json({ error: '学习数据处理失败: ' + e.message })
  }
})

/**
 * POST /api/learn/upload-csv — CSV 文件上传
 */
router.post('/upload-csv', upload.single('file'), (req, res) => {
  try {
    const file = req.file
    const type = req.body.type || 'asr_structured'

    if (!file) {
      return res.status(400).json({ error: '缺少 file 参数' })
    }

    const csvText = file.buffer.toString('utf-8')
    const { headers, rows } = parseCSV(csvText)

    if (rows.length === 0) {
      return res.status(400).json({ error: 'CSV 文件为空或格式错误' })
    }

    const stats = {
      totalRows: rows.length,
      correctionsAdded: 0,
      itemCategoryMappingsAdded: 0,
      patternsLearned: 0,
      ocrMappingsAdded: 0
    }

    for (const row of rows) {
      if (type === 'asr_structured') {
        const record = csvRowToStructured(row, headers)
        const s = learnStructuredRecord(record)
        stats.correctionsAdded += s.corrections
        stats.itemCategoryMappingsAdded += s.itemCategories
        stats.patternsLearned += s.patterns
      } else if (type === 'asr_longtext') {
        // 长文本模式 — CSV 每行是长文本的一个分句
        const record = csvRowToStructured(row, headers)
        const s = learnStructuredRecord(record)
        stats.correctionsAdded += s.corrections
        stats.itemCategoryMappingsAdded += s.itemCategories
        stats.patternsLearned += s.patterns
      } else {
        return res.status(400).json({ error: `不支持的 CSV 类型: ${type}` })
      }
    }

    res.json({
      ok: true,
      ...stats
    })
  } catch (e) {
    console.error('[LEARN] upload-csv 失败:', e.message)
    res.status(500).json({ error: 'CSV 处理失败: ' + e.message })
  }
})

/**
 * GET /api/learn/corrections — 查询已学习的纠错映射（调试用）
 */
router.get('/corrections', (_req, res) => {
  try {
    const corrections = db.prepare('SELECT * FROM asr_corrections ORDER BY created_at DESC LIMIT 500').all()
    res.json({ ok: true, corrections })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/**
 * GET /api/learn/item-categories — 查询已学习的项目词→分类映射
 */
router.get('/item-categories', (_req, res) => {
  try {
    const mappings = db.prepare('SELECT * FROM item_category_map ORDER BY created_at DESC LIMIT 500').all()
    res.json({ ok: true, mappings })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/**
 * GET /api/learn/patterns — 查询已学习的句式模式
 */
router.get('/patterns', (_req, res) => {
  try {
    const patterns = db.prepare('SELECT * FROM asr_patterns ORDER BY created_at DESC LIMIT 500').all()
    res.json({ ok: true, patterns })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/**
 * GET /api/learn/ocr-merchants — 查询已学习的 OCR 商户映射
 */
router.get('/ocr-merchants', (_req, res) => {
  try {
    const merchants = db.prepare('SELECT * FROM ocr_merchants ORDER BY created_at DESC LIMIT 500').all()
    res.json({ ok: true, merchants })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = { learn: router }
