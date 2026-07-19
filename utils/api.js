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
const BASE_URL = 'https://symbioticuniverse.xyz/api'

// E2E 加密模块（懒加载，仅加密启用时使用）
var _crypto = null
function _getCrypto() {
  if (_crypto === null) {
    try { _crypto = require('./crypto.js') } catch (e) { _crypto = false }
  }
  return _crypto || null
}

// ==================== ID 生成 ====================

// UUID v7: 48bit 毫秒时间戳前缀（保证时间排序）+ 76bit 随机（不可猜）
function generateId() {
  var ms = Date.now()
  var rand = new Uint8Array(10)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(rand)
  } else {
    for (var i = 0; i < 10; i++) rand[i] = Math.floor(Math.random() * 256)
  }
  var hex = ''
  // timestamp 48bit MSB-first → 时间排序依靠此前缀
  for (var i = 5; i >= 0; i--) {
    hex += ((ms >> (i * 8)) & 0xff).toString(16).padStart(2, '0')
  }
  // version 0x7 + rand[0] low nibble
  hex += (0x70 | (rand[0] & 0x0f)).toString(16)
  hex += rand[1].toString(16).padStart(2, '0')
  // variant 0x80 + rand[2] low 6bit
  hex += (0x80 | (rand[2] & 0x3f)).toString(16)
  hex += rand[3].toString(16).padStart(2, '0')
  for (var i = 4; i < 10; i++) {
    hex += rand[i].toString(16).padStart(2, '0')
  }
  return hex
}

// ==================== Token 管理 ====================

// 401「登录过期」是否已处理（并发请求只触发一次清登录+跳转，登录成功后复位）
let _authExpiredHandling = false

function _getToken() {
  return wx.getStorageSync('authToken') || ''
}

function _getRefreshToken() {
  return wx.getStorageSync('refreshToken') || ''
}

function _setToken(token) {
  if (token) {
    wx.setStorageSync('authToken', token)
    _authExpiredHandling = false
  } else {
    wx.removeStorageSync('authToken')
  }
}

function _setRefreshToken(token) {
  if (token) {
    wx.setStorageSync('refreshToken', token)
  } else {
    wx.removeStorageSync('refreshToken')
  }
}

/**
 * 登录过期统一处理：清登录态 + 本地业务数据，提示并回主页重新登录。
 * 防抖：syncFromCloud 会并发多个请求同时 401，只执行一次。
 * 保留设置项（语言/深色模式等设备偏好），不一并清除。
 */
// ==================== 静默换证 ====================

// 换证锁：并发 401 只触发一次 refresh 请求
let _refreshPromise = null

async function _tryRefreshAccessToken() {
  const refreshToken = _getRefreshToken()
  if (!refreshToken) return null

  // 已经有正在进行的 refresh，复用其结果
  if (_refreshPromise) return _refreshPromise

  _refreshPromise = (async () => {
    try {
      const result = await new Promise((resolve, reject) => {
        wx.request({
          url: BASE_URL + '/auth/refresh',
          method: 'POST',
          header: { 'Content-Type': 'application/json' },
          data: { refreshToken },
          success(r) {
            if (r.statusCode >= 200 && r.statusCode < 300 && r.data && r.data.token) {
              resolve(r.data)
            } else {
              reject(r.data)
            }
          },
          fail: reject
        })
      })
      _setToken(result.token)
      _setRefreshToken(result.refreshToken)
      console.log('[API] access token 已静默刷新')
      return result.token
    } catch (e) {
      console.warn('[API] refresh token 换证失败:', e)
      _setToken('')
      _setRefreshToken('')
      return null
    } finally {
      _refreshPromise = null
    }
  })()

  return _refreshPromise
}

function _handleAuthExpired() {
  if (_authExpiredHandling) return
  _authExpiredHandling = true
  _setToken('')
  _setRefreshToken('')
  const keys = ['userInfo', 'personalItems', 'companyItems',
    'personalCategories', 'companyCategories', 'companyInfo',
    'auditList', 'notifyList', 'feedbackList', 'customOverviewCards',
    'guideCompleted', '_syncMeta',
    '_pendingConflicts', '_pendingServerData']
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
  queue.push({ id: generateId(), action, path, data, timestamp: Date.now() })
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

// ==================== 脏标记 & 同步元数据 ====================

const SYNC_META_KEY = '_syncMeta'
const PENDING_CONFLICTS_KEY = '_pendingConflicts'
const PENDING_SERVER_DATA_KEY = '_pendingServerData'

/** 计算条目业务字段哈希（排除元数据字段），用于冲突对比 */
function _hashItemFields(item) {
  if (!item) return null
  var o = {}
  var keys = ['category', 'type', 'typeLabel', 'amount', 'date', 'note', 'target', 'targetType', 'voucher', '_voided']
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i]
    if (item[k] !== undefined) o[k] = item[k]
  }
  return JSON.stringify(o)
}

/** 标记条目脏（本地有未推送变更） */
function _markDirty(id, scope) {
  var key = scope === 'company' ? 'companyItems' : 'personalItems'
  var items = wx.getStorageSync(key) || []
  var updated = items.map(function (it) {
    if (it.id === id) { it._dirty = true; it._updatedAt = Date.now() }
    return it
  })
  _save(key, updated)
}

/** 推送成功后清除脏标记，记录已同步哈希 */
function _markClean(id, scope) {
  var key = scope === 'company' ? 'companyItems' : 'personalItems'
  var items = wx.getStorageSync(key) || []
  var updated = items.map(function (it) {
    if (it.id === id) {
      it._dirty = false
      it._syncedAt = Date.now()
      it._lastKnownHash = _hashItemFields(it)
    }
    return it
  })
  _save(key, updated)
}

// ---- 同步元数据 ----

function _getSyncMeta() {
  return wx.getStorageSync(SYNC_META_KEY) || { lastSyncAt: 0, initialized: false }
}

function _saveSyncMeta(meta) {
  _save(SYNC_META_KEY, meta)
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
          if (res.statusCode === 401 && token && path !== '/auth/logout' && path !== '/auth/refresh') {
            // 尝试静默换证，成功后重试原请求
            _tryRefreshAccessToken().then(newToken => {
              if (newToken) {
                // 用新 token 重试
                wx.request({
                  url: BASE_URL + path,
                  method,
                  header: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + newToken
                  },
                  data: data || undefined,
                  success(retryRes) {
                    if (retryRes.statusCode >= 200 && retryRes.statusCode < 300) {
                      resolve(retryRes.data)
                    } else {
                      console.warn('[API] 换证后重试仍失败', method, path, retryRes.statusCode)
                      reject(retryRes.data)
                    }
                  },
                  fail(err) {
                    console.error('[API] 换证后重试网络错误', method, path, err)
                    reject(err)
                  }
                })
              } else {
                // refresh 也过期 → 真正踢下线
                _handleAuthExpired()
                reject(res.data)
              }
            })
          } else if (res.statusCode === 401 && token && path !== '/auth/logout' && path === '/auth/refresh') {
            // refresh 接口本身返回 401 → 直接踢下线
            _handleAuthExpired()
            reject(res.data)
          } else {
            reject(res.data)
          }
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
  const items = wx.getStorageSync(key) || []
  // 过滤已软删除的条目（append-only 策略）
  var result = []
  for (var i = 0; i < items.length; i++) {
    if (!items[i]._voided) result.push(items[i])
  }
  return result
}

/**
 * 仅写入本地 Storage，不推后端（供 addLinkedItems 等组合函数复用）
 */
function _addItemLocal(scope, item) {
  const key = scope === 'company' ? 'companyItems' : 'personalItems'
  // 直接读原始存储（不过滤 _voided），避免保存时丢失软删除条目
  const items = wx.getStorageSync(key) || []
  items.unshift(item)
  _save(key, items)
  return item
}

function addItem(scope, item) {
  const stamped = { ...item, _updatedAt: Date.now(), _dirty: true, _syncedAt: 0, _lastKnownHash: null }
  _addItemLocal(scope, stamped)

  // E2E：推送到服务端前加密
  var pushItem = stamped
  var crypto = _getCrypto()
  if (crypto && crypto.isEncryptionEnabled()) {
    pushItem = crypto.encryptItem(stamped)
  }

  // 立即推送到云端，成功/409 则清脏标记，网络失败入离线队列待重试
  _request('POST', '/items', { scope, item: pushItem }).then(function () {
    _markClean(stamped.id, scope)
  }).catch(function (err) {
    if (err && err.existingItem) {
      // 409：服务端已有同 ID 记录 → 静默标记已同步（本次或上次推送已生效）
      _markClean(stamped.id, scope)
      return
    }
    // 网络错误 → 保持 _dirty，入离线队列
    if (err && (err.errMsg && err.errMsg.indexOf('fail') >= 0 || err.errno)) {
      _initNetworkListener()
      _enqueue('POST', '/items', { scope, item: pushItem })
    }
  })
  return stamped
}

function updateItem(id, data) {
  const scope = _findScope(id)
  const key = scope === 'company' ? 'companyItems' : 'personalItems'
  const items = wx.getStorageSync(key) || []
  const patched = { ...data, _updatedAt: Date.now(), _dirty: true }
  const updated = items.map(it => it.id === id ? { ...it, ...patched } : it)
  _save(key, updated)

  // E2E：推送到服务端前加密
  var pushData = patched
  var crypto = _getCrypto()
  if (crypto && crypto.isEncryptionEnabled()) {
    // 需要带原始 item 的敏感字段用于加密（patched 可能只含部分字段）
    var fullItem = updated.find(function (it) { return it.id === id })
    pushData = crypto.encryptItem(fullItem || patched)
  }

  _pushBackend('PUT', '/items/' + id, pushData)
}

async function removeItem(id) {
  const scope = _findScope(id)
  const key = scope === 'company' ? 'companyItems' : 'personalItems'
  const items = wx.getStorageSync(key) || []
  const item = items.find(it => it.id === id)

  if (!item) return

  // 从未同步过的条目 → 直接移除，并提醒用户
  if (!item._syncedAt) {
    _save(key, items.filter(it => it.id !== id))
    wx.showToast({ title: '该记录尚未同步到云端，删除后无法恢复', icon: 'none', duration: 2500 })
    return
  }

  // 已同步过的条目 → 软删除（append-only 策略：只增不减）
  const updated = items.map(it =>
    it.id === id ? { ...it, _voided: true, _dirty: true, _updatedAt: Date.now() } : it
  )
  _save(key, updated)

  try {
    await _request('PUT', '/items/' + id, { _voided: true })
    _markClean(id, scope)
  } catch (err) {
    if (err && (err.errMsg && err.errMsg.indexOf('fail') >= 0 || err.errno)) {
      _initNetworkListener()
      _enqueue('PUT', '/items/' + id, { _voided: true })
      wx.showToast({ title: '删除暂未同步，网络恢复后自动处理', icon: 'none', duration: 2000 })
    }
  }
}

function addLinkedItems(scope, item, mirrorScope, mirrorItem) {
  // 先写本地 Storage
  var stamped = { ...item, _dirty: true, _syncedAt: 0, _lastKnownHash: null }
  var mirrorStamped = { ...mirrorItem, _dirty: true, _syncedAt: 0, _lastKnownHash: null }
  _addItemLocal(scope, stamped)
  _addItemLocal(mirrorScope, mirrorStamped)

  // E2E：推送到服务端前加密
  var pushItem = stamped
  var pushMirror = mirrorStamped
  var crypto = _getCrypto()
  if (crypto && crypto.isEncryptionEnabled()) {
    pushItem = crypto.encryptItem(stamped)
    pushMirror = crypto.encryptItem(mirrorStamped)
  }

  // 后端联动接口（事务写入，一次推送两条）
  _request('POST', '/items/linked', { scope, item: pushItem, mirrorScope, mirrorItem: pushMirror }).then(function () {
    _markClean(stamped.id, scope)
    _markClean(mirrorStamped.id, mirrorScope)
  }).catch(function (err) {
    // 网络错误 → 保持 _dirty，入离线队列
    if (err && (err.errMsg && err.errMsg.indexOf('fail') >= 0 || err.errno)) {
      _initNetworkListener()
      _enqueue('POST', '/items/linked', { scope, item: pushItem, mirrorScope, mirrorItem: pushMirror })
    }
  })
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
  _setRefreshToken(result.refreshToken)
  const userInfo = { nickName: result.nickName, avatarUrl: result.avatarUrl, updatedAt: result.updatedAt }
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
  _setRefreshToken(result.refreshToken)
  const userInfo = { nickName: result.nickName, avatarUrl: result.avatarUrl, updatedAt: result.updatedAt }
  _save('userInfo', userInfo)
  return {
    ...userInfo,
    isNew: result.isNew || false,
    hasCompany: result.hasCompany || false,
    companyRole: result.companyRole || null
  }
}

/**
 * 微信手机号一键登录
 * @param {string} wxCode - wx.login 返回的 code
 * @param {string} phoneCode - getPhoneNumber 按钮返回的 code
 */
async function loginByWechatPhone(wxCode, phoneCode) {
  console.log('[API] loginByWechatPhone 发起请求, wxCode 长度:', wxCode ? wxCode.length : 0, ', phoneCode 长度:', phoneCode ? phoneCode.length : 0)
  const result = await _request('POST', '/auth/login-by-wechat-phone', { code: wxCode, phoneCode })
  _setToken(result.token)
  _setRefreshToken(result.refreshToken)
  const userInfo = { nickName: result.nickName, avatarUrl: result.avatarUrl, updatedAt: result.updatedAt }
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
  _setRefreshToken('')
  // 清除全部本地数据，避免换号登录看到残留
  const keys = ['userInfo', 'personalItems', 'companyItems',
    'personalCategories', 'companyCategories', 'companyInfo',
    'auditList', 'notifyList', 'feedbackList', 'customOverviewCards',
    '_syncMeta', '_pendingConflicts', '_pendingServerData']
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
  const stamped = { ...info, updatedAt: info.updatedAt || Date.now() }
  _save('userInfo', stamped)
  if (!_getToken()) return
  _initNetworkListener()
  _request('POST', '/auth/user-info', stamped).then(function (result) {
    // 用服务端返回的 updatedAt 覆写本地，保证下次保存时间戳一致
    if (result && result.updatedAt) {
      var cur = getUserInfo()
      if (cur) { cur.updatedAt = result.updatedAt; _save('userInfo', cur) }
    }
  }).catch(function (err) {
    // 409 冲突：服务端时间戳更新了，用其时间戳重试一次
    if (err && err.serverUpdatedAt) {
      var retry = { ...stamped, updatedAt: err.serverUpdatedAt }
      return _request('POST', '/auth/user-info', retry).then(function (r) {
        if (r && r.updatedAt) {
          var cur = getUserInfo()
          if (cur) { cur.updatedAt = r.updatedAt; _save('userInfo', cur) }
        }
      }).catch(function (e2) {
        console.warn('[API] 保存用户信息重试失败', e2)
      })
    }
    if (err && (err.errMsg && err.errMsg.indexOf('fail') >= 0 || err.errno)) {
      console.warn('[API] 离线：操作已入队列', 'POST', '/auth/user-info')
      _enqueue('POST', '/auth/user-info', stamped)
    } else {
      console.warn('[API] 后台推送失败（非网络原因，不入队）', '/auth/user-info', err)
    }
  })
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

/**
 * 智能推送：仅推送有变更的账单条目（脏标记），不再全量 POST。
 * - _syncedAt === 0 → POST 新建
 * - _syncedAt > 0  → PUT 更新（含软删除 _voided）
 */
async function _pushDirtyItems() {
  var personalItems = wx.getStorageSync('personalItems') || []
  var companyItems = wx.getStorageSync('companyItems') || []

  var allItems = []
  for (var i = 0; i < personalItems.length; i++) {
    allItems.push({ item: personalItems[i], scope: 'personal' })
  }
  for (var j = 0; j < companyItems.length; j++) {
    allItems.push({ item: companyItems[j], scope: 'company' })
  }

  for (var k = 0; k < allItems.length; k++) {
    var entry = allItems[k]
    var item = entry.item
    var scope = entry.scope
    if (!item._dirty) continue

    if (!item._syncedAt) {
      // 新建条目 → POST
      try {
        await _request('POST', '/items', { scope: scope, item: item })
        _markClean(item.id, scope)
      } catch (e) {
        if (e && e.existingItem) {
          _markClean(item.id, scope)
        }
      }
    } else {
      // 已同步过的修改 → PUT（含软删除 _voided）
      try {
        await _request('PUT', '/items/' + item.id, item)
        _markClean(item.id, scope)
      } catch (e) {
        // 保持脏标记，下次重试
      }
    }
  }
}

/**
 * 首次启动兜底：全量推送一次本地账单（保证服务端有数据），
 * 之后切换为脏标记增量模式。
 */
async function _pushAllItemsOnce() {
  var personalItems = wx.getStorageSync('personalItems') || []
  var companyItems = wx.getStorageSync('companyItems') || []

  // 逐条推送，记录成功/失败，只对成功的清脏标记
  async function pushAll(scope, items) {
    for (var i = 0; i < items.length; i++) {
      if (items[i]._voided) continue // 软删除条目不推送到服务端
      try {
        await _request('POST', '/items', { scope: scope, item: items[i] })
        _markClean(items[i].id, scope)
      } catch (e) {
        // 409：服务端已有 → 也清脏
        if (e && e.existingItem) {
          _markClean(items[i].id, scope)
        }
      }
    }
  }

  await pushAll('personal', personalItems)
  await pushAll('company', companyItems)
}

/** 冲突检测 → 逐条对比本地与云端，返回冲突列表 */
function _detectConflicts(localItems, serverItems, scope) {
  var conflicts = []

  var localMap = {}
  for (var i = 0; i < localItems.length; i++) {
    localMap[localItems[i].id] = localItems[i]
  }

  var serverMap = {}
  for (var j = 0; j < serverItems.length; j++) {
    serverMap[serverItems[j].id] = serverItems[j]
  }

  // 遍历服务端条目
  for (var k = 0; k < serverItems.length; k++) {
    var sItem = serverItems[k]
    var lItem = localMap[sItem.id]

    if (lItem) {
      if (lItem._dirty) {
        var serverHash = _hashItemFields(sItem)
        if (lItem._lastKnownHash && serverHash !== lItem._lastKnownHash) {
          conflicts.push({
            id: sItem.id, scope: scope, type: 'modified_both',
            localVersion: lItem, serverVersion: sItem,
            reason: '此项在本地和云端均被修改'
          })
        } else if (!lItem._lastKnownHash) {
          conflicts.push({
            id: sItem.id, scope: scope, type: 'duplicate_id',
            localVersion: lItem, serverVersion: sItem,
            reason: '本地新建的账单与云端已有账单 ID 冲突'
          })
        }
      }
      // 服务端软删除的条目 → 本地未标记删除 → 需同步删除
      if (sItem._voided && !lItem._voided) {
        conflicts.push({
          id: sItem.id, scope: scope, type: 'server_voided',
          localVersion: lItem, serverVersion: sItem,
          reason: '此账单在云端已被删除（多端同步）'
        })
      }
    }
    // 服务端有而本地没有 → 正常新增，无冲突（append-only 不会丢数据）
  }

  // 检查本地脏条目在服务端已不存在（append-only 不应发生，但保留检测）
  for (var m = 0; m < localItems.length; m++) {
    var lIt = localItems[m]
    if (lIt._dirty && !serverMap[lIt.id]) {
      if (lIt._syncedAt > 0) {
        conflicts.push({
          id: lIt.id, scope: scope, type: 'local_only',
          localVersion: lIt, serverVersion: null,
          reason: '本地修改的账单在云端已被删除'
        })
      }
    }
  }

  return conflicts
}

/**
 * 合并服务端数据到本地（v2 — 带冲突检测）。
 * 非冲突条目正常合并，冲突条目搁置，返回冲突列表。
 */
function _mergeItems(key, remoteItems) {
  var scope = key === 'personalItems' ? 'personal' : 'company'
  var localItems = wx.getStorageSync(key) || []

  // E2E：解密服务端数据
  var crypto = _getCrypto()
  if (crypto && crypto.isEncryptionEnabled()) {
    remoteItems = remoteItems.map(function (it) {
      return crypto.decryptItem(it)
    })
  }

  if (localItems.length === 0) {
    // 本地空 → 服务端数据为准
    _save(key, remoteItems.map(function (it) {
      return { ...it, _dirty: false, _syncedAt: Date.now(), _lastKnownHash: _hashItemFields(it) }
    }))
    return { conflicts: [] }
  }

  var conflicts = _detectConflicts(localItems, remoteItems, scope)
  var conflictIds = {}
  for (var c = 0; c < conflicts.length; c++) {
    conflictIds[conflicts[c].id] = true
  }

  // 构建服务端 ID 集合
  var serverIds = {}
  for (var s = 0; s < remoteItems.length; s++) {
    serverIds[remoteItems[s].id] = true
  }

  var merged = []
  var seenIds = {}

  // Pass 1：保留本地条目（冲突条目除外，服务端已删的脏条目除外）
  for (var i = 0; i < localItems.length; i++) {
    var it = localItems[i]
    if (conflictIds[it.id]) continue
    // 本地有但服务端没有 → 保留本地（可能是新建未推送，或服务端删了但本地不脏）
    merged.push(it)
    seenIds[it.id] = true
  }

  // Pass 2：服务端有而本地没有 → 追加（排除墓碑和冲突）
  for (var j = 0; j < remoteItems.length; j++) {
    var rIt = remoteItems[j]
    if (seenIds[rIt.id]) continue
    if (conflictIds[rIt.id]) continue
    merged.push({
      ...rIt,
      _updatedAt: rIt.updatedAt || 0,
      _dirty: false,
      _syncedAt: Date.now(),
      _lastKnownHash: _hashItemFields(rIt)
    })
    seenIds[rIt.id] = true
  }

  // 按 _updatedAt 降序
  merged.sort(function (a, b) { return (b._updatedAt || 0) - (a._updatedAt || 0) })
  _save(key, merged)

  return { conflicts: conflicts }
}

/** 非条目数据合并（分类、公司、设置等 — 云端权威） */
function _finalizeNonItemMerge(results) {
  var personalCats = results.personalCats
  var companyCats = results.companyCats
  var companyInfo = results.companyInfo
  var auditList = results.auditList
  var notifyList = results.notifyList
  var feedbackList = results.feedbackList
  var userInfo = results.userInfo
  var overviewCards = results.overviewCards
  var settings = results.settings

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
    var localU = wx.getStorageSync('userInfo') || null
    var remoteU = userInfo.value
    var localTs = (localU && localU.updatedAt) || 0
    var remoteTs = (remoteU && remoteU.updatedAt) || 0
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
    var keys = Object.keys(settings.value)
    for (var i = 0; i < keys.length; i++) {
      _save(keys[i], settings.value[keys[i]])
    }
  }
}

// ==================== 数据同步 ====================

/**
 * 双向安全同步（v2 — 脏标记 + 冲突检测）：
 * 1. 首次启动全量推送兜底（保证服务端有数据）→ 后续只推脏条目
 * 2. 重放离线队列
 * 3. 拉取服务端数据 → 合并时检测冲突
 * 4. 有冲突则搁置并返回 {hasConflicts: true}，等用户裁决
 *
 * 应在登录成功后调用，或 App.onLaunch 时调用。
 * @returns {Promise<{synced: boolean, hasConflicts?: boolean, conflicts?: Array}>}
 */
async function syncFromCloud() {
  if (!_getToken()) return { synced: false }

  var meta = _getSyncMeta()

  // Step 1a: 首次启动全量推送兜底，之后只推脏条目
  if (!meta.initialized) {
    await _pushAllItemsOnce()
    meta.initialized = true
    _saveSyncMeta(meta)
  } else {
    await _pushDirtyItems()
  }

  // Step 1b: 重放离线队列
  await _replayQueue()

  try {
    // Step 2: 拉取服务端全量数据
    var results = await Promise.allSettled([
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

    var personalItems = results[0]
    var companyItems = results[1]
    var personalCats = results[2]
    var companyCats = results[3]
    var companyInfo = results[4]
    var auditList = results[5]
    var notifyList = results[6]
    var feedbackList = results[7]
    var userInfo = results[8]
    var overviewCards = results[9]
    var settings = results[10]

    // Step 3: 合并条目（带冲突检测）
    var allConflicts = []

    if (personalItems.status === 'fulfilled' && personalItems.value) {
      var pResult = _mergeItems('personalItems', personalItems.value)
      allConflicts = allConflicts.concat(pResult.conflicts || [])
    }
    if (companyItems.status === 'fulfilled' && companyItems.value) {
      var cResult = _mergeItems('companyItems', companyItems.value)
      allConflicts = allConflicts.concat(cResult.conflicts || [])
    }

    // 有冲突 → 搁置非条目数据，等用户裁决后完成
    if (allConflicts.length > 0) {
      _save(PENDING_SERVER_DATA_KEY, {
        personalCats: personalCats, companyCats: companyCats,
        companyInfo: companyInfo, auditList: auditList,
        notifyList: notifyList, feedbackList: feedbackList,
        userInfo: userInfo, overviewCards: overviewCards, settings: settings
      })
      _save(PENDING_CONFLICTS_KEY, allConflicts)
      return { synced: false, hasConflicts: true, conflicts: allConflicts }
    }

    // 无冲突 → 正常完成合并
    _finalizeNonItemMerge({
      personalCats: personalCats, companyCats: companyCats,
      companyInfo: companyInfo, auditList: auditList,
      notifyList: notifyList, feedbackList: feedbackList,
      userInfo: userInfo, overviewCards: overviewCards, settings: settings
    })

    meta.lastSyncAt = Date.now()
    _saveSyncMeta(meta)
    wx.removeStorageSync(PENDING_CONFLICTS_KEY)
    wx.removeStorageSync(PENDING_SERVER_DATA_KEY)

    return { synced: true }
  } catch (err) {
    console.error('[API] 云端同步失败:', err)
    return { synced: false }
  }
}

/** 获取待解决的冲突列表 */
function getPendingConflicts() {
  return wx.getStorageSync(PENDING_CONFLICTS_KEY) || []
}

/**
 * 应用用户冲突裁决，完成同步。
 * @param {Array} resolutions — [{id, scope, resolution: 'local'|'server'|'server_voided_accept'|'server_voided_restore', resolvedItem}]
 */
async function resolveConflicts(resolutions) {
  for (var i = 0; i < resolutions.length; i++) {
    var r = resolutions[i]
    var key = r.scope === 'company' ? 'companyItems' : 'personalItems'
    var items = wx.getStorageSync(key) || []

    if (r.resolution === 'local') {
      // 保留本地 → 标记脏，下次推送覆盖服务端
      items = items.map(function (it) {
        if (it.id === r.id) { it._dirty = true; it._lastKnownHash = null }
        return it
      })
    } else if (r.resolution === 'server') {
      // 保留服务端 → 替换本地
      items = items.filter(function (it) { return it.id !== r.id })
      if (r.resolvedItem) {
        items.push({
          ...r.resolvedItem,
          _dirty: false, _syncedAt: Date.now(),
          _lastKnownHash: _hashItemFields(r.resolvedItem)
        })
      }
    } else if (r.resolution === 'server_voided_accept') {
      // 接受云端删除 → 本地也标记软删除
      items = items.map(function (it) {
        if (it.id === r.id) { it._voided = true; it._dirty = false; it._lastKnownHash = _hashItemFields(r.resolvedItem || it) }
        return it
      })
    } else if (r.resolution === 'server_voided_restore') {
      // 拒绝云端删除 → 保留本地，标记脏，下次推送覆盖服务端
      items = items.map(function (it) {
        if (it.id === r.id) { it._voided = false; it._dirty = true; it._lastKnownHash = null }
        return it
      })
    }
    _save(key, items)
  }

  // 清除待处理冲突
  wx.removeStorageSync(PENDING_CONFLICTS_KEY)

  // 应用搁置的非条目数据
  var pending = wx.getStorageSync(PENDING_SERVER_DATA_KEY)
  if (pending) {
    _finalizeNonItemMerge(pending)
    wx.removeStorageSync(PENDING_SERVER_DATA_KEY)
  }

  // 更新同步元数据
  var meta = _getSyncMeta()
  meta.lastSyncAt = Date.now()
  _saveSyncMeta(meta)

  // 推送冲突裁决结果
  await _pushDirtyItems()
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
  const query = type === 'avatar' ? '?type=avatar' : ''
  return new Promise(function (resolve, reject) {
    wx.compressImage({
      src: filePath,
      quality: 60,
      success: function (res) {
        _checkAndUpload(res.tempFilePath)
      },
      fail: function () {
        _checkAndUpload(filePath)
      }
    })

    function _checkAndUpload(path) {
      wx.getFileSystemManager().getFileInfo({
        filePath: path,
        success: function (info) {
          if (info.size >= 1800000) {
            reject({ error: 'file_too_large', size: info.size })
            return
          }
          _doUpload(path)
        },
        fail: function () {
          _doUpload(path)
        }
      })
    }

    function _doUpload(path, retryToken) {
      var token = retryToken || _getToken()
      wx.uploadFile({
        url: BASE_URL + '/upload' + query,
        filePath: path,
        name: 'file',
        header: { ...(token ? { 'Authorization': 'Bearer ' + token } : {}) },
        success: function (res) {
          if (res.statusCode === 401 && !retryToken && _getRefreshToken()) {
            // token 过期，静默换证后重试
            _tryRefreshAccessToken().then(function (newToken) {
              if (newToken) { _doUpload(path, newToken) }
              else { reject(res.data || { error: '登录已过期' }) }
            })
            return
          }
          try {
            var data = JSON.parse(res.data)
            if (data.ok && data.url) { resolve(data.url) }
            else { reject(data) }
          } catch (e) { reject(res) }
        },
        fail: function (err) {
          var errMsg = (err && (err.errMsg || err.message)) || ''
          if (errMsg.indexOf('80051') !== -1) {
            reject({ error: 'file_too_large' })
          } else {
            reject(err)
          }
        }
      })
    }
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
  url = _rewriteHost(url)
  return new Promise((resolve, reject) => {
    _download(url)
    function _download(u, retryToken) {
      var token = retryToken || _getToken()
      wx.downloadFile({
        url: u,
        header: token ? { 'Authorization': 'Bearer ' + token } : {},
        success(res) {
          if (res.statusCode === 401 && !retryToken && _getRefreshToken()) {
            _tryRefreshAccessToken().then(function (newToken) {
              if (newToken) { _download(u, newToken) }
              else { reject(res) }
            })
            return
          }
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
    }
  })
}

// ==================== 识别（ASR / OCR） ====================

/**
 * 语音识别 — 上传录音文件，返回识别文本
 * @param {string} tempFilePath — wx.getRecorderManager().stop() 返回的临时文件路径
 * @returns {Promise<string>} — 识别出的文本
 */
function asrRecognize(tempFilePath) {
  var usage = checkUsage('asr')
  if (!usage.allowed) {
    return Promise.reject({ error: 'usage_limit', type: 'asr', limit: usage.limit, used: usage.used })
  }
  return new Promise(function (resolve, reject) {
    _upload(tempFilePath)
    function _upload(path, retryToken) {
      var token = retryToken || _getToken()
      wx.uploadFile({
        url: BASE_URL + '/asr/recognize',
        filePath: path,
        name: 'file',
        header: token ? { 'Authorization': 'Bearer ' + token } : {},
        success: function (res) {
          if (res.statusCode === 401 && !retryToken && _getRefreshToken()) {
            _tryRefreshAccessToken().then(function (newToken) {
              if (newToken) { _upload(path, newToken) }
              else { reject({ error: '登录已过期' }) }
            })
            return
          }
          var data
          if (typeof res.data === 'string') {
            try { data = JSON.parse(res.data) } catch (e) { reject({ error: '服务响应异常' }); return }
          } else {
            data = res.data || {}
          }
          if (data.ok && typeof data.text === 'string') {
            resolve(data.text)
          } else {
            reject(data && data.error ? data : { error: '识别失败', raw: data })
          }
        },
        fail: function (err) {
          console.error('[API] asrRecognize 网络失败', err)
          reject({ error: (err && err.errMsg) || '网络异常，请检查后端服务' })
        }
      })
    }
  })
}

/**
 * 凭证图片识别（OCR）— 提交图片 URL，返回结构化记账字段
 * @param {string} imageUrl — 图片 URL（先通过 uploadVoucher 上传获得）
 * @returns {Promise<{ amount: string, category: string, note: string, date: string }>}
 */
function ocrParse(imageUrl) {
  var usage = checkUsage('ocr')
  if (!usage.allowed) {
    return Promise.reject({ error: 'usage_limit', type: 'ocr', limit: usage.limit, used: usage.used })
  }
  return _request('POST', '/ocr/parse', { imageUrl }).then(function (data) {
    if (data && data.ok) {
      // 多笔（NEW）：后端返回 items 数组
      if (Array.isArray(data.items) && data.items.length) {
        return { items: data.items.map(function (it) {
          return { amount: it.amount || '', category: it.category || '', note: it.note || '', date: it.date || '' }
        })}
      }
      // 单笔（兼容旧版）
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

/**
 * 语音记账原始日志上报（测试期收集训练数据）
 * @param {string} rawText ASR 识别原文
 * @param {object} parsedJson 解析结果
 */
function voiceLog(rawText, parsedJson) {
  return _request('POST', '/learn/voice-log', {
    rawText: rawText,
    parsedJson: parsedJson || {}
  }).catch(function () { /* 静默失败，不影响主流程 */ })
}

// ==================== 公开训练库（测试期共享纠正数据） ====================

var BASE_URL_PUBLIC = (BASE_URL || '').replace('/api', '/api/public')

/**
 * 获取公开训练库中的全部纠错映射
 * @returns {Promise<{ corrections: Array<{wrong, correct}> }>}
 */
function publicGetCorrections() {
  return new Promise(function (resolve) {
    wx.request({
      url: (BASE_URL_PUBLIC || BASE_URL) + '/corrections',
      method: 'GET',
      timeout: 5000,
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.ok) {
          resolve(res.data.corrections || [])
        } else {
          resolve([])
        }
      },
      fail: function () { resolve([]) }
    })
  })
}

/**
 * 向公开训练库提交一条纠错映射
 * @param {string} wrong - 错词
 * @param {string} correct - 正确词
 */
function publicAddCorrection(wrong, correct) {
  return new Promise(function (resolve) {
    if (!wrong || !correct || wrong === correct) { resolve(false); return }
    wx.request({
      url: (BASE_URL_PUBLIC || BASE_URL) + '/correction',
      method: 'POST',
      data: { wrong: wrong, correct: correct },
      timeout: 5000,
      success: function () { resolve(true) },
      fail: function () { resolve(false) }
    })
  })
}

/**
 * 批量提交纠错映射到公开训练库
 * @param {Array<{wrong: string, correct: string}>} pairs
 */
function publicAddCorrectionsBatch(pairs) {
  return new Promise(function (resolve) {
    if (!pairs || !pairs.length) { resolve(0); return }
    wx.request({
      url: (BASE_URL_PUBLIC || BASE_URL) + '/corrections/batch',
      method: 'POST',
      data: { pairs: pairs },
      timeout: 5000,
      success: function (res) {
        resolve(res.data && res.data.inserted ? res.data.inserted : 0)
      },
      fail: function () { resolve(0) }
    })
  })
}

/**
 * 提交字段级纠错映射到公开训练库
 * @param {Array<{field: string, wrong: string, correct: string, rawText: string}>} corrections
 */
function publicAddFieldCorrections(corrections) {
  return new Promise(function (resolve) {
    if (!corrections || !corrections.length) { resolve(0); return }
    wx.request({
      url: (BASE_URL_PUBLIC || BASE_URL) + '/corrections/field',
      method: 'POST',
      data: { corrections: corrections },
      timeout: 5000,
      success: function (res) {
        resolve(res.data && res.data.inserted ? res.data.inserted : 0)
      },
      fail: function () { resolve(0) }
    })
  })
}

// ==================== VIP 订阅与用量 ====================

/** 本地缓存键 */
const VIP_STATUS_KEY = 'vipStatus'

/**
 * 获取 VIP 状态（含用量），结果缓存到本地
 * @returns {Promise<{ vipLevel, vipExpiresAt, usage, limits }>}
 */
function getVipStatus() {
  return _request('GET', '/vip/status').then(function (data) {
    wx.setStorageSync(VIP_STATUS_KEY, data)
    return data
  })
}

/**
 * 订阅 VIP 套餐
 * @param {number} planId — 套餐 ID（0-7）
 * @returns {Promise<{ ok, vipLevel, vipExpiresAt }>}
 */
function subscribeVip(planId) {
  return _request('POST', '/vip/subscribe', { planId }).then(function (data) {
    // 订阅成功后刷新缓存
    getVipStatus().catch(function () {})
    return data
  })
}

/**
 * 激活全民免费试用（企业版 PRO 3 个月）
 * @returns {Promise<{ ok, vipLevel, vipExpiresAt, isTrial, alreadyVip }>}
 */
function activateTrial() {
  return _request('POST', '/vip/activate-trial').then(function (data) {
    getVipStatus().catch(function () {})
    return data
  })
}

/**
 * 同步检查用量是否超限（从本地缓存读取，无网络请求）
 * @param {'asr'|'ocr'|'export'} type
 * @returns {{ allowed: boolean, used: number, limit: number }}
 */
function checkUsage(type) {
  var status = wx.getStorageSync(VIP_STATUS_KEY)
  if (!status || !status.usage || !status.limits) {
    return { allowed: true, used: 0, limit: -1 }
  }
  var limit = status.limits[type]
  if (limit === -1) return { allowed: true, used: status.usage[type] || 0, limit: -1 }
  var used = status.usage[type] || 0
  return { allowed: used < limit, used: used, limit: limit }
}

/** 当前是否为付费 VIP（未过期） */
function isVip() {
  var status = wx.getStorageSync(VIP_STATUS_KEY)
  return !!(status && status.vipLevel > 0)
}

/** 获取当前 VIP 等级 */
function getVipLevel() {
  var status = wx.getStorageSync(VIP_STATUS_KEY)
  return status ? status.vipLevel : 0
}

/**
 * 记录一次用量（用于纯前端操作如导出，需主动上报）
 * @param {'asr'|'ocr'|'export'} type
 */
function incrementUsage(type) {
  return _request('POST', '/vip/usage', { type }).then(function () {
    // 更新本地缓存
    var status = wx.getStorageSync(VIP_STATUS_KEY)
    if (status && status.usage && typeof status.usage[type] === 'number') {
      status.usage[type]++
      wx.setStorageSync(VIP_STATUS_KEY, status)
    }
  }).catch(function () {})
}

// ==================== 导出 ====================

module.exports = {
  generateId,

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
  loginByWechatPhone,
  logout,

  isE2EEnabled: function () {
    var crypto = _getCrypto()
    return !!(crypto && crypto.isEncryptionEnabled())
  },

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
  voiceLog,

  // 公开训练库
  publicGetCorrections,
  publicAddCorrection,
  publicAddCorrectionsBatch,
  publicAddFieldCorrections,

  // 离线队列（内部使用，app.js 注册网络监听用）
  _initNetworkListener,
  _replayQueue,

  // 冲突检测 & 裁决
  getPendingConflicts,
  resolveConflicts,

  // VIP 订阅与用量
  getVipStatus,
  subscribeVip,
  activateTrial,
  checkUsage,
  isVip,
  getVipLevel,
  incrementUsage,
}
