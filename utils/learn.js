/**
 * 学习模块 — 客户端本地提取纠错映射，匿名化上传训练数据
 *
 * ===== 正式版移除说明 =====
 * 删除本文件即可，在 mingxi.js 中删除/注释一行调用：
 *   var learn = require('../../utils/learn.js'); learn.learnFromItem(item);
 * 后端 voiceLog + learn 路由保留不动（不调用就无害）
 */

var LEARN_QUEUE = []
var UPLOAD_TIMER = null
var UPLOAD_INTERVAL = 30000 // 30 秒批量上传
var MAX_QUEUE_SIZE = 50

/**
 * 简单中文文本 LCS diff — 提取错词 → 正确词映射
 * 与后端 learn.js extractCorrections 同逻辑
 */
function _extractCorrections(rawText, correctText) {
  var mappings = []
  if (!rawText || !correctText || rawText === correctText) return mappings

  var m = rawText.length
  var n = correctText.length
  var dp = []
  for (var i = 0; i <= m; i++) {
    dp[i] = []
    for (var j = 0; j <= n; j++) { dp[i][j] = 0 }
  }
  for (var i = 1; i <= m; i++) {
    for (var j = 1; j <= n; j++) {
      if (rawText[i - 1] === correctText[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  var i = m, j = n
  var rawSeg = '', correctSeg = ''
  var pairs = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && rawText[i - 1] === correctText[j - 1]) {
      if (rawSeg || correctSeg) {
        pairs.push({ raw: rawSeg, correct: correctSeg })
        rawSeg = ''
        correctSeg = ''
      }
      i--; j--
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

  for (var p = 0; p < pairs.length; p++) {
    var wrong = pairs[p].raw.trim()
    var correct = pairs[p].correct.trim()
    if (!wrong || !correct) continue
    if (wrong === correct) continue
    if (wrong.length < 1 || wrong.length > 6) continue
    if (correct.length < 1 || correct.length > 6) continue
    if (/^[\s，。！？、；：""''（）《》【】,.!?;:'"()]+$/.test(wrong)) continue
    mappings.push({ wrong: wrong, correct: correct })
  }

  return mappings
}

/**
 * 推断收支方向
 */
function _inferDirection(verb) {
  var incomeVerbs = ['收到', '收入', '发了', '报销', '退款', '进账', '赚了', '收']
  for (var i = 0; i < incomeVerbs.length; i++) {
    if (verb && verb.indexOf(incomeVerbs[i]) >= 0) return '收入'
  }
  return '支出'
}

/**
 * 拼装正确文本
 */
function _assembleCorrectText(verb, item, amount, measure, date) {
  var parts = []
  if (date && date !== '-' && date !== '今天') parts.push(date)
  if (verb && verb !== '-') parts.push(verb)
  if (item && item !== '-') parts.push(item)
  if (amount) parts.push(amount)
  if (measure && measure !== '-') parts.push(measure)
  return parts.join('')
}

/**
 * 从一条账单 item 提取学习数据
 * 在 addItem 成功后调用
 */
function learnFromItem(item) {
  var verb = item.verb || ''
  var itemName = item.note || item.item || ''
  var category = item.category || ''
  var amount = item.amount ? String(item.amount) : ''
  var measure = item.measure || (item.type === 'income' ? '元' : '')
  var date = item.date || ''
  var rawText = item.rawText || ''

  // 如果没有原始语音文本，从 item 字段拼装
  var correctText = _assembleCorrectText(verb, itemName, amount, measure, date)

  if (!rawText && !correctText) return

  var record = {
    rawText: rawText || correctText,
    verb: verb,
    measure: measure,
    subject: item.scope === 'company' ? '公司' : '个人',
    item: itemName,
    category: category,
    amount: amount,
    direction: item.typeLabel || _inferDirection(verb),
    correctText: correctText
  }

  LEARN_QUEUE.push({ type: 'asr_structured', record: record })
  _scheduleUpload()
}

/**
 * 从语音记账结果提取学习数据
 * 在语音记账成功后调用
 */
function learnFromVoice(rawText, parsed) {
  if (!rawText || !parsed) return

  var record = {
    rawText: rawText,
    verb: parsed.verb || '',
    measure: parsed.measure || '元',
    subject: parsed.scope === 'company' ? '公司' : '个人',
    item: parsed.note || parsed.item || '',
    category: parsed.category || '',
    amount: parsed.amount ? String(parsed.amount) : '',
    direction: parsed.typeLabel || _inferDirection(parsed.verb),
    correctText: ''
  }

  // 如果有纠错结果
  if (parsed.correction && parsed.correctedText) {
    record.correctText = parsed.correctedText
  } else {
    record.correctText = _assembleCorrectText(
      record.verb, record.item, record.amount, record.measure, ''
    )
  }

  LEARN_QUEUE.push({ type: 'asr_structured', record: record })
  _scheduleUpload()
}

/**
 * 批量上传学习数据到服务端
 */
function _scheduleUpload() {
  if (LEARN_QUEUE.length >= MAX_QUEUE_SIZE) {
    _flushUpload()
    return
  }
  if (UPLOAD_TIMER) return
  UPLOAD_TIMER = setTimeout(function () {
    _flushUpload()
  }, UPLOAD_INTERVAL)
}

function _flushUpload() {
  if (UPLOAD_TIMER) { clearTimeout(UPLOAD_TIMER); UPLOAD_TIMER = null }
  if (LEARN_QUEUE.length === 0) return

  var batch = LEARN_QUEUE.slice()
  LEARN_QUEUE = []

  var token = ''
  try { token = wx.getStorageSync('authToken') || '' } catch (e) {}
  var baseUrl = 'https://symbioticuniverse.xyz/api'
  try { baseUrl = wx.getStorageSync('api_base_url') || baseUrl } catch (e) {}

  wx.request({
    url: baseUrl + '/learn/upload',
    method: 'POST',
    header: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    data: { type: 'asr_structured', records: batch.map(function (b) { return b.record }) },
    success: function () {},
    fail: function (err) {
      // 失败时放回队列
      LEARN_QUEUE = batch.concat(LEARN_QUEUE)
      if (LEARN_QUEUE.length > 200) { LEARN_QUEUE = LEARN_QUEUE.slice(0, 100) }
    }
  })
}

/**
 * 手动触发上传（页面卸载时调用）
 */
function flushNow() {
  _flushUpload()
}

module.exports = {
  learnFromItem: learnFromItem,
  learnFromVoice: learnFromVoice,
  flushNow: flushNow
}
