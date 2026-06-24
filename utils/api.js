/**
 * 数据接口层 — 前后端隔离（混合模式）
 *
 * 前端只调本文件暴露的方法，不直接操作 Storage / 网络。
 * 读操作：从本地 Storage 同步读取（兼容已有调用方）
 * 写操作：先写本地 Storage，再异步推送到后端
 * 认证操作：纯后端，token 存本地
 */

// ==================== 配置 ====================

/** 后端 API 基址（真机调试：电脑局域网 IP，手机需连同一 WiFi；生产环境改为真实域名） */
const BASE_URL = 'http://192.168.1.111:3000/api'

// ==================== Token 管理 ====================

// 401「登录过期」是否已处理（并发请求只触发一次清登录+跳转，登录成功后复位）
let _authExpiredHandling = false

function _getToken() {
  return wx.getStorageSync('authToken') || ''
}

function _setToken(token) {
  if (token) {
    wx.setStorageSync('authToken', token)
    _authExpiredHandling = false // 新会话开始，允许下次过期再次触发
  } else {
    wx.removeStorageSync('authToken')
  }
}

/**
 * 登录过期统一处理：清登录态 + 本地业务数据，提示并回主页重新登录。
 * 防抖：syncFromCloud 会并发多个请求同时 401，只执行一次。
 * 保留设置项（语言/深色模式等设备偏好），不一并清除。
 */
function _handleAuthExpired() {
  if (_authExpiredHandling) return
  _authExpiredHandling = true
  _setToken('')
  const keys = ['userInfo', 'personalItems', 'companyItems',
    'personalCategories', 'companyCategories', 'companyInfo',
    'auditList', 'notifyList', 'feedbackList', 'customOverviewCards',
    'guideCompleted'] // 清掉引导完成标志 → reLaunch 后 onLoad 重新走引导页
  for (const k of keys) wx.removeStorageSync(k)
  wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
  setTimeout(() => {
    wx.reLaunch({ url: '/pages/mingxi/mingxi' })
  }, 800)
}

// ==================== 离线队列 ====================

const OFFLINE_QUEUE_KEY = 'offlineQueue'

function _getQueue() {
  return wx.getStorageSync(OFFLINE_QUEUE_KEY) || []
}

function _saveQueue(queue) {
  _save(OFFLINE_QUEUE_KEY, queue)
}

/** 将一次失败的操作加入离线队列，待网络恢复后重放 */
function _enqueue(action, path, data) {
  const queue = _getQueue()
  queue.push({ id: Date.now(), action, path, data, timestamp: Date.now() })
  _saveQueue(queue)
}

let _networkListenerInited = false

function _initNetworkListener() {
  if (_networkListenerInited) return
  _networkListenerInited = true
  wx.onNetworkStatusChange(function (res) {
    if (res.isConnected) {
      console.log('[API] 网络恢复，开始重放离线队列')
      _replayQueue()
    }
  })
}

/** 重放离线队列：逐条推送到后端，成功的移除，失败的保留等下次 */
async function _replayQueue() {
  const queue = _getQueue()
  if (!queue.length) return
  console.log('[API] 离线队列重放中，共 ' + queue.length + ' 条')
  const remaining = []
  for (let i = 0; i < queue.length; i++) {
    const op = queue[i]
    try {
      await _request(op.action, op.path, op.data)
    } catch (e) {
      remaining.push(op)
    }
  }
  _saveQueue(remaining)
  if (remaining.length === 0) {
    console.log('[API] 离线队列全部重放成功')
  } else {
    console.warn('[API] 离线队列 ' + remaining.length + ' 条重试失败，等待下次网络恢复')
  }
}

/** 标记队列中有待推送的变更，供 syncFromCloud 调用前保护本地数据 */
function _hasPendingQueue() {
  return _getQueue().length > 0
}

// ==================== 网络请求 ====================

/**
 * 封装 wx.request，返回 Promise
 * @param {'GET'|'POST'|'PUT'|'DELETE'} method
 * @param {string} path — 如 '/items?scope=personal'
 * @param {*} data — 请求体（仅 POST/PUT）
 */
function _request(method, path, data) {
  const token = _getToken()
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + path,
      method,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      },
      data: data || undefined,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          console.warn('[API]', method, path, res.statusCode, res.data)
          if (res.statusCode === 401 && token && path !== '/auth/logout') {
            _handleAuthExpired()
          }
          reject(res.data)
        }
      },
      fail(err) {
        console.error('[API]', method, path, '网络错误', err)
        reject(err)
      }
    })
  })
}

/**
 * 后台推送 — 异步写入后端，不阻塞调用方
 * 网络失败时自动入离线队列，等恢复后重放
 */
function _pushBackend(method, path, data) {
  if (!_getToken()) return
  _initNetworkListener()
  return _request(method, path, data).catch(err => {
    // 仅网络错误入队列（业务错误如 400/401 不入队，避免反复失败）
    if (err && (err.errMsg && err.errMsg.indexOf('fail') >= 0 || err.errno)) {
      console.warn('[API] 离线：操作已入队列', method, path)
      _enqueue(method, path, data)
    } else {
      console.warn('[API] 后台推送失败（非网络原因，不入队）', path, err)
    }
  })
}

// ==================== 账单 ====================

function getItems(scope) {
  const key = scope === 'company' ? 'companyItems' : 'personalItems'
  return wx.getStorageSync(key) || []
}

/**
 * 仅写入本地 Storage，不推后端（供 addLinkedItems 等组合函数复用）
 */
function _addItemLocal(scope, item) {
  const key = scope === 'company' ? 'companyItems' : 'personalItems'
  const items = getItems(scope)
  items.unshift(item)
  _save(key, items)
  return item
}

function addItem(scope, item) {
  const stamped = { ...item, _updatedAt: Date.now() }
  _addItemLocal(scope, stamped)
  _pushBackend('POST', '/items', { scope, item: stamped })
  return stamped
}

function updateItem(id, data) {
  const scope = _findScope(id)
  const key = scope === 'company' ? 'companyItems' : 'personalItems'
  const items = wx.getStorageSync(key) || []
  const patched = { ...data, _updatedAt: Date.now() }
  const updated = items.map(it => it.id === id ? { ...it, ...patched } : it)
  _save(key, updated)
  _pushBackend('PUT', '/items/' + id, patched)
}

function removeItem(id) {
  const scope = _findScope(id)
  const key = scope === 'company' ? 'companyItems' : 'personalItems'
  const items = (wx.getStorageSync(key) || []).filter(it => it.id !== id)
  _save(key, items)
  _pushBackend('DELETE', '/items/' + id, { _deletedAt: Date.now() })
}

function addLinkedItems(scope, item, mirrorScope, mirrorItem) {
  // 先写本地 Storage（不推后端，避免重复）
  _addItemLocal(scope, item)
  _addItemLocal(mirrorScope, mirrorItem)
  // 后端联动接口（事务写入，一次推送两条）
  _pushBackend('POST', '/items/linked', { scope, item, mirrorScope, mirrorItem })
}

// ==================== 结清（服务端权威） ====================
// 结清涉及服务端副作用（建自动记录、改镜像、发通知、boss/员工分支），
// 故走专用端点 + await + 重拉，前端不重建逻辑。

/** 结清应付项：PUT /items/:id/settle */
function settleItem(id, settleInfo) {
  return _request('PUT', '/items/' + id + '/settle', settleInfo ? { settleInfo } : {})
}

/** 个人确认垫付到账：POST /items/:id/settle-confirm */
function settleConfirm(id, settleInfo) {
  return _request('POST', '/items/' + id + '/settle-confirm', settleInfo ? { settleInfo } : {})
}

/** 结清后轻量重拉：只覆盖两个 scope 的账单本地缓存（比整包 syncFromCloud 省） */
async function refreshItems() {
  if (!_getToken()) return
  const [p, c] = await Promise.all([
    _request('GET', '/items?scope=personal'),
    _request('GET', '/items?scope=company'),
  ])
  _save('personalItems', p || [])
  _save('companyItems', c || [])
}

// ==================== 分类 ====================

function getCategories(scope) {
  const key = scope === 'company' ? 'companyCategories' : 'personalCategories'
  return wx.getStorageSync(key) || null
}

function saveCategories(scope, list) {
  const key = scope === 'company' ? 'companyCategories' : 'personalCategories'
  _save(key, list)
  _pushBackend('POST', '/categories', { scope, list })
}

// ==================== 公司 ====================

function getCompanyInfo() {
  return wx.getStorageSync('companyInfo') || null
}

function saveCompanyInfo(info) {
  _save('companyInfo', info)
  _pushBackend('POST', '/company', info)
}

async function joinCompany(info) {
  const result = await _request('POST', '/company', info)
  _save('companyInfo', info)
  return result
}

function removeCompanyInfo() {
  wx.removeStorageSync('companyInfo')
  _pushBackend('DELETE', '/company')
}

// ==================== 审核 ====================

function getAuditList() {
  return wx.getStorageSync('auditList') || []
}

function saveAuditList(list) {
  _save('auditList', list)
  _pushBackend('POST', '/audit', list)
}

function removeAuditList() {
  wx.removeStorageSync('auditList')
  _pushBackend('DELETE', '/audit')
}

// ==================== 通知 ====================

function getNotifyList() {
  return wx.getStorageSync('notifyList') || []
}

function saveNotifyList(list) {
  _save('notifyList', list)
  _pushBackend('POST', '/notify', list)
}

// ==================== 反馈 ====================

function getFeedbackList() {
  return wx.getStorageSync('feedbackList') || []
}

function saveFeedbackList(list) {
  _save('feedbackList', list)
  _pushBackend('POST', '/feedback', list)
}

// ==================== 认证（纯后端） ====================

/**
 * 发送短信验证码
 * @returns {Promise<{success: boolean}>}
 */
function sendVerifyCode(phone) {
  return _request('POST', '/auth/send-verify-code', { phone })
}

/**
 * 手机号 + 验证码登录
 * 成功后存储 token + userInfo 到本地，返回含 isNew/hasCompany/companyRole 的完整登录结果
 * @returns {Promise<{nickName: string, avatarUrl: string, token: string, isNew: boolean, hasCompany: boolean, companyRole: string|null}>}
 */
async function loginByPhone(phone, code) {
  const result = await _request('POST', '/auth/login-by-phone', { phone, code })
  _setToken(result.token)
  const userInfo = { nickName: result.nickName, avatarUrl: result.avatarUrl }
  _save('userInfo', userInfo)
  return {
    ...userInfo,
    isNew: result.isNew || false,
    hasCompany: result.hasCompany || false,
    companyRole: result.companyRole || null
  }
}

/**
 * 微信授权登录
 * 成功后存储 token + userInfo 到本地，返回含 isNew/hasCompany/companyRole 的完整登录结果
 * @returns {Promise<{nickName: string, avatarUrl: string, token: string, isNew: boolean, hasCompany: boolean, companyRole: string|null}>}
 */
async function loginByWechat(wxUserInfo) {
  const result = await _request('POST', '/auth/login-by-wechat', wxUserInfo)
  _setToken(result.token)
  const userInfo = { nickName: result.nickName, avatarUrl: result.avatarUrl }
  _save('userInfo', userInfo)
  return {
    ...userInfo,
    isNew: result.isNew || false,
    hasCompany: result.hasCompany || false,
    companyRole: result.companyRole || null
  }
}

/**
 * 退出登录
 * 清除本地 token 和用户信息
 * @returns {Promise}
 */
async function logout() {
  try {
    await _request('POST', '/auth/logout')
  } catch (e) {
    // 即使后端失败也清除本地状态
  }
  _setToken('')
  // 清除全部本地数据，避免换号登录看到残留
  const keys = ['userInfo', 'personalItems', 'companyItems',
    'personalCategories', 'companyCategories', 'companyInfo',
    'auditList', 'notifyList', 'feedbackList', 'customOverviewCards']
  for (const k of keys) {
    wx.removeStorageSync(k)
  }
  // 清除所有设置项（语言、深色模式等）
  const info = wx.getStorageInfoSync()
  for (const k of info.keys) {
    if (k === 'authToken') continue // _setToken 已处理
    wx.removeStorageSync(k)
  }
}

// ==================== 用户 ====================

function getUserInfo() {
  return wx.getStorageSync('userInfo') || null
}

function saveUserInfo(info) {
  // 打上更新时间戳（毫秒），供跨端 last-write-wins 对比；调用方已带 updatedAt 则沿用
  const stamped = { ...info, updatedAt: info.updatedAt || Date.now() }
  _save('userInfo', stamped)
  _pushBackend('POST', '/auth/user-info', stamped)
}

function removeUserInfo() {
  wx.removeStorageSync('userInfo')
  _pushBackend('DELETE', '/auth/user-info')
}

// ==================== 设置 ====================

function getSetting(key) {
  return wx.getStorageSync(key)
}

function saveSetting(key, value) {
  _save(key, value)
  _pushBackend('POST', '/settings', { key, value })
}

function removeSetting(key) {
  wx.removeStorageSync(key)
  _pushBackend('DELETE', '/settings?key=' + encodeURIComponent(key))
}

// ==================== 自定义简览 ====================

function getOverviewCards() {
  return wx.getStorageSync('customOverviewCards') || []
}

function saveOverviewCards(cards) {
  _save('customOverviewCards', cards)
  _pushBackend('POST', '/overview', cards)
}

// ==================== 数据同步 ====================

/**
 * 从后端拉取全量数据到本地 Storage。
 * 1. 先重放离线队列（推送本地变更到服务端）
 * 2. 再拉取服务端数据，与本地合并（本地优先，ID 相同的保留本地版本）
 * 应在登录成功后调用，或 App.onLaunch 时调用。
 * @returns {Promise<{synced: boolean}>}
 */
async function syncFromCloud() {
  if (!_getToken()) return { synced: false }

  // Step 1: 先推送本地离线变更到服务端
  await _replayQueue()

  try {
    // Step 2: 拉取服务端全量数据
    const results = await Promise.allSettled([
      _request('GET', '/items?scope=personal'),
      _request('GET', '/items?scope=company'),
      _request('GET', '/categories?scope=personal'),
      _request('GET', '/categories?scope=company'),
      _request('GET', '/company'),
      _request('GET', '/audit'),
      _request('GET', '/notify'),
      _request('GET', '/feedback'),
      _request('GET', '/auth/user-info'),
      _request('GET', '/overview'),
      _request('GET', '/settings/all'),
    ])

    const [personalItems, companyItems, personalCats, companyCats,
      companyInfo, auditList, notifyList, feedbackList, userInfo, overviewCards, settings
    ] = results

    // Step 3: 合并 items — 本地优先（不覆盖本地已有的记录）
    if (personalItems.status === 'fulfilled' && personalItems.value) {
      _mergeItems('personalItems', personalItems.value)
    }
    if (companyItems.status === 'fulfilled' && companyItems.value) {
      _mergeItems('companyItems', companyItems.value)
    }

    // 其他非事务性数据：云端权威（分类、公司、设置等）
    if (personalCats.status === 'fulfilled' && personalCats.value) {
      _save('personalCategories', personalCats.value)
    }
    if (companyCats.status === 'fulfilled' && companyCats.value) {
      _save('companyCategories', companyCats.value)
    }
    if (companyInfo.status === 'fulfilled' && companyInfo.value) {
      _save('companyInfo', companyInfo.value)
    }
    if (auditList.status === 'fulfilled' && auditList.value) {
      _save('auditList', auditList.value)
    }
    if (notifyList.status === 'fulfilled' && notifyList.value) {
      _save('notifyList', notifyList.value)
    }
    if (feedbackList.status === 'fulfilled' && feedbackList.value) {
      _save('feedbackList', feedbackList.value)
    }
    if (userInfo.status === 'fulfilled' && userInfo.value) {
      const localU = wx.getStorageSync('userInfo') || null
      const remoteU = userInfo.value
      const localTs = (localU && localU.updatedAt) || 0
      const remoteTs = (remoteU && remoteU.updatedAt) || 0
      if (remoteTs > 0 && localTs > remoteTs) {
        _pushBackend('POST', '/auth/user-info', localU)
      } else {
        _save('userInfo', remoteU)
      }
    }
    if (overviewCards.status === 'fulfilled' && overviewCards.value) {
      _save('customOverviewCards', overviewCards.value)
    }
    if (settings.status === 'fulfilled' && settings.value) {
      for (const [key, value] of Object.entries(settings.value)) {
        _save(key, value)
      }
    }

    return { synced: true }
  } catch (err) {
    console.error('[API] 云端同步失败:', err)
    return { synced: false }
  }
}

/**
 * 合并服务端数据到本地：以本地为准。
 * - 本地已有的记录保留（包括离线修改的）
 * - 仅在本地完全没有数据时才用服务端的（首次登录、换设备）
 * - 服务端有而本地没有的记录（其他设备创建的）追加到本地
 */
function _mergeItems(key, remoteItems) {
  const localItems = wx.getStorageSync(key) || []
  if (localItems.length === 0) {
    // 本地空 → 直接用服务端数据（冷启动/换设备）
    _save(key, remoteItems)
    return
  }

  // 本地为主：构建本地 ID 集合
  const localIds = {}
  for (const it of localItems) { localIds[it.id] = true }

  // 服务端有而本地没有的记录 → 追加（可能是其他设备创建的）
  const merged = localItems.slice()
  for (const rit of remoteItems) {
    if (!localIds[rit.id]) {
      merged.push(rit)
    }
  }

  // 按 _updatedAt 降序排列
  merged.sort(function (a, b) { return (b._updatedAt || 0) - (a._updatedAt || 0) })
  _save(key, merged)
}

// ==================== 迁移（一次性） ====================

function migrate() {
  const old = wx.getStorageSync('detailItems')
  if (!old || !old.length) return
  const personal = old.filter(it => (it.scope || 'personal') === 'personal')
  const company = old.filter(it => it.scope === 'company')
  if (personal.length) _save('personalItems', personal)
  if (company.length) _save('companyItems', company)
  wx.removeStorageSync('detailItems')
  // 异步迁移到后端
  if (personal.length || company.length) {
    _pushBackend('POST', '/migrate', { detailItems: old })
  }
}

// ==================== 内部工具 ====================

function _save(key, value) {
  wx.setStorageSync(key, value)
}

function _findScope(id) {
  const p = wx.getStorageSync('personalItems') || []
  if (p.some(it => it.id === id)) return 'personal'
  return 'company'
}

/** 当前后端 origin（去掉 BASE_URL 末尾的 /api） */
function _apiOrigin() {
  return BASE_URL.replace(/\/api\/?$/, '')
}

/**
 * 把绝对图片 URL 的 host 重写成当前后端 host，保留路径。
 * 后端拼图片 URL 时把上传那刻的 host 写死进了库（upload.js req.get('host')），
 * IP/域名一变存量 URL 就连不上；图片始终随后端走，故只需把 host 对齐 BASE_URL。
 */
function _rewriteHost(url) {
  if (!url || !/^https?:\/\//.test(url)) return url
  return url.replace(/^https?:\/\/[^/]+/, _apiOrigin())
}

// ==================== 凭证上传 ====================

/**
 * 上传一张凭证图片，返回可跨端访问的 URL
 * 走 wx.uploadFile（multipart），不走 wx.request（JSON）
 * @param {string} filePath — wx.chooseImage/chooseMedia 返回的 tempFilePath
 * @returns {Promise<string>} — 解析为图片 URL
 */
function uploadVoucher(filePath, type) {
  const token = _getToken()
  // type==='avatar' → 走头像专用通道（后端存 avatar/ 目录、单份覆盖、返回免鉴权 URL）
  const query = type === 'avatar' ? '?type=avatar' : ''
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: BASE_URL + '/upload' + query,
      filePath,
      name: 'file',
      header: {
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      },
      success(res) {
        try {
          const data = JSON.parse(res.data)
          if (data.ok && data.url) {
            resolve(data.url)
          } else {
            reject(data)
          }
        } catch (e) {
          reject(res)
        }
      },
      fail(err) {
        console.error('[API] uploadVoucher 失败', err)
        reject(err)
      }
    })
  })
}

/**
 * 带鉴权头下载图片，返回本地临时路径
 * 用于显示 /voucher/* 这类需 Bearer token 的私有图片：
 * 小程序 <image src> 无法带 Authorization 头，直接引用会 401，
 * 故先用 wx.downloadFile 带头下成本地路径再喂给 <image>。
 * @param {string} url
 * @returns {Promise<string>} 本地临时文件路径
 */
function downloadAuthedImage(url) {
  const token = _getToken()
  url = _rewriteHost(url)
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url,
      header: token ? { 'Authorization': 'Bearer ' + token } : {},
      success(res) {
        if (res.statusCode === 200 && res.tempFilePath) {
          resolve(res.tempFilePath)
        } else {
          console.warn('[API] downloadAuthedImage', res.statusCode)
          reject(res)
        }
      },
      fail(err) {
        console.error('[API] downloadAuthedImage 失败', err)
        reject(err)
      }
    })
  })
}

// ==================== 识别（ASR / OCR） ====================

/**
 * 语音识别 — 上传录音文件，返回识别文本
 * @param {string} tempFilePath — wx.getRecorderManager().stop() 返回的临时文件路径
 * @returns {Promise<string>} — 识别出的文本
 */
function asrRecognize(tempFilePath) {
  const token = _getToken()
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: BASE_URL + '/asr/recognize',
      filePath: tempFilePath,
      name: 'file',
      header: {
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      },
      success(res) {
        try {
          const data = JSON.parse(res.data)
          if (data.ok && typeof data.text === 'string') {
            resolve(data.text)
          } else {
            reject(data)
          }
        } catch (e) {
          reject(res)
        }
      },
      fail(err) {
        console.error('[API] asrRecognize 失败', err)
        reject(err)
      }
    })
  })
}

/**
 * 凭证图片识别（OCR）— 提交图片 URL，返回结构化记账字段
 * @param {string} imageUrl — 图片 URL（先通过 uploadVoucher 上传获得）
 * @returns {Promise<{ amount: string, category: string, note: string, date: string }>}
 */
function ocrParse(imageUrl) {
  return _request('POST', '/ocr/parse', { imageUrl }).then(function (data) {
    if (data && data.ok) {
      return { amount: data.amount || '', category: data.category || '', note: data.note || '', date: data.date || '' }
    }
    throw data
  })
}

// 上传标注数据集（内部使用，不面向用户）
// 方式一：JSON 上传
function learnUpload(type, records) {
  return _request('POST', '/learn/upload', { type: type, records: records }).then(function (data) {
    if (data && data.ok) {
      return {
        totalRows: data.totalRows || 0,
        correctionsAdded: data.correctionsAdded || 0,
        itemCategoryMappingsAdded: data.itemCategoryMappingsAdded || 0,
        patternsLearned: data.patternsLearned || 0
      }
    }
    throw data
  })
}

// 方式二：CSV 文件上传（推荐）
function learnUploadCsv(filePath) {
  var token = _getToken()
  return new Promise(function (resolve, reject) {
    wx.uploadFile({
      url: BASE_URL + '/learn/upload-csv',
      filePath: filePath,
      name: 'file',
      header: { 'Authorization': 'Bearer ' + token },
      formData: { type: 'asr_structured' },
      success: function (res) {
        try {
          var data = JSON.parse(res.data)
          if (data && data.ok) {
            resolve({
              totalRows: data.totalRows || 0,
              correctionsAdded: data.correctionsAdded || 0,
              itemCategoryMappingsAdded: data.itemCategoryMappingsAdded || 0,
              patternsLearned: data.patternsLearned || 0
            })
          } else {
            reject(data)
          }
        } catch (e) { reject(res) }
      },
      fail: function (err) {
        console.error('[API] learnUploadCsv 失败', err)
        reject(err)
      }
    })
  })
}

// ==================== 导出 ====================

module.exports = {
  getItems,
  addItem,
  updateItem,
  removeItem,
  addLinkedItems,
  settleItem,
  settleConfirm,
  refreshItems,

  getCategories,
  saveCategories,

  getCompanyInfo,
  saveCompanyInfo,
  joinCompany,
  removeCompanyInfo,

  getAuditList,
  saveAuditList,
  removeAuditList,

  getNotifyList,
  saveNotifyList,

  getFeedbackList,
  saveFeedbackList,

  sendVerifyCode,
  loginByPhone,
  loginByWechat,
  logout,

  getUserInfo,
  saveUserInfo,
  removeUserInfo,

  getSetting,
  saveSetting,
  removeSetting,

  getOverviewCards,
  saveOverviewCards,

  migrate,

  // 凭证上传
  uploadVoucher,
  downloadAuthedImage,

  // 新增：云端同步
  syncFromCloud,

  // ASR 语音识别
  asrRecognize,

  // OCR 凭证识别
  ocrParse,

  // 标注数据集上传（内部）
  learnUpload,
  learnUploadCsv,

  // 离线队列（内部使用，app.js 注册网络监听用）
  _initNetworkListener,
  _replayQueue,
}
