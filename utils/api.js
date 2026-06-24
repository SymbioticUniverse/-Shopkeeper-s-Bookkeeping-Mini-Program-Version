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
    'guideCompleted', '_deletedItems', '_syncMeta',
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

// ==================== 脏标记 & 墓碑 & 同步元数据 ====================

const DELETED_ITEMS_KEY = '_deletedItems'
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

/** 在本地数组中查找条目 */
function _findItem(id, scope) {
  var key = scope === 'company' ? 'companyItems' : 'personalItems'
  var items = wx.getStorageSync(key) || []
  for (var i = 0; i < items.length; i++) {
    if (items[i].id === id) return items[i]
  }
  return null
}

// ---- 墓碑（记录本地删除） ----

function _getDeletedItems() {
  return wx.getStorageSync(DELETED_ITEMS_KEY) || []
}

function _saveDeletedItems(list) {
  _save(DELETED_ITEMS_KEY, list)
}

function _addToTombstone(id, scope) {
  var list = _getDeletedItems()
  list.push({ id: id, scope: scope, _deletedAt: Date.now() })
  // 30 天自动清理
  var cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  list = list.filter(function (d) { return d._deletedAt > cutoff })
  _saveDeletedItems(list)
}

function _isInTombstone(id) {
  var list = _getDeletedItems()
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) return true
  }
  return false
}

function _removeFromTombstone(id) {
  var list = _getDeletedItems()
  _saveDeletedItems(list.filter(function (d) { return d.id !== id }))
}

function _cleanOldTombstones() {
  var cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  var list = _getDeletedItems()
  _saveDeletedItems(list.filter(function (d) { return d._deletedAt > cutoff }))
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
  const stamped = { ...item, _updatedAt: Date.now(), _dirty: true, _syncedAt: 0, _lastKnownHash: null }
  _addItemLocal(scope, stamped)
  _pushBackend('POST', '/items', { scope, item: stamped })
  return stamped
}

function updateItem(id, data) {
  const scope = _findScope(id)
  const key = scope === 'company' ? 'companyItems' : 'personalItems'
  const items = wx.getStorageSync(key) || []
  const patched = { ...data, _updatedAt: Date.now(), _dirty: true }
  const updated = items.map(it => it.id === id ? { ...it, ...patched } : it)
  _save(key, updated)
  _pushBackend('PUT', '/items/' + id, patched)
}

function removeItem(id) {
  const scope = _findScope(id)
  const key = scope === 'company' ? 'companyItems' : 'personalItems'
  const items = (wx.getStorageSync(key) || []).filter(it => it.id !== id)
  _save(key, items)
  _addToTombstone(id, scope)
  _pushBackend('DELETE', '/items/' + id, { _deletedAt: Date.now() })
}

function addLinkedItems(scope, item, mirrorScope, mirrorItem) {
  // 先写本地 Storage（不推后端，避免重复）
  _addItemLocal(scope, { ...item, _dirty: true, _syncedAt: 0, _lastKnownHash: null })
  _addItemLocal(mirrorScope, { ...mirrorItem, _dirty: true, _syncedAt: 0, _lastKnownHash: null })
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
    'auditList', 'notifyList', 'feedbackList', 'customOverviewCards',
    '_deletedItems', '_syncMeta', '_pendingConflicts', '_pendingServerData']
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

/**
 * 智能推送：仅推送有变更的账单条目（脏标记），不再全量 POST。
 * - _syncedAt === 0 → POST 新建
 * - _syncedAt > 0  → PUT 更新
 * - 墓碑中有      → DELETE
 */
async function _pushDirtyItems() {
  var personalItems = wx.getStorageSync('personalItems') || []
  var companyItems = wx.getStorageSync('companyItems') || []
  var deletedItems = _getDeletedItems()

  var allItems = []
  for (var i = 0; i < personalItems.length; i++) {
    allItems.push({ item: personalItems[i], scope: 'personal' })
  }
  for (var j = 0; j < companyItems.length; j++) {
    allItems.push({ item: companyItems[j], scope: 'company' })
  }

  // 推送脏条目
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
        // 409 重复 ID 或网络错误 → 保持脏标记，下次重试
      }
    } else {
      // 已同步过的修改 → PUT
      try {
        await _request('PUT', '/items/' + item.id, item)
        _markClean(item.id, scope)
      } catch (e) {
        // 保持脏标记，下次重试
      }
    }
  }

  // 推送墓碑中的删除
  var remainingDeleted = []
  for (var d = 0; d < deletedItems.length; d++) {
    var entry = deletedItems[d]
    try {
      await _request('DELETE', '/items/' + entry.id, { _deletedAt: entry._deletedAt })
      // 成功 → 不移入 remaining
    } catch (e) {
      remainingDeleted.push(entry)
    }
  }
  _saveDeletedItems(remainingDeleted)
}

/**
 * 首次启动兜底：全量推送一次本地账单（保证服务端有数据），
 * 之后切换为脏标记增量模式。
 */
async function _pushAllItemsOnce() {
  var personalItems = wx.getStorageSync('personalItems') || []
  var companyItems = wx.getStorageSync('companyItems') || []

  var promises = []
  for (var i = 0; i < personalItems.length; i++) {
    promises.push(
      _request('POST', '/items', { scope: 'personal', item: personalItems[i] }).catch(function () {})
    )
  }
  for (var j = 0; j < companyItems.length; j++) {
    promises.push(
      _request('POST', '/items', { scope: 'company', item: companyItems[j] }).catch(function () {})
    )
  }
  if (promises.length > 0) {
    await Promise.all(promises)
  }

  // 全部标记为已同步
  ;['personalItems', 'companyItems'].forEach(function (key) {
    var items = wx.getStorageSync(key) || []
    var updated = items.map(function (it) {
      it._dirty = false
      it._syncedAt = Date.now()
      it._lastKnownHash = _hashItemFields(it)
      return it
    })
    _save(key, updated)
  })
}

/** 冲突检测 → 逐条对比本地与云端，返回冲突列表 */
function _detectConflicts(localItems, serverItems, scope) {
  var conflicts = []
  var deletedItems = _getDeletedItems()

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
        // 本地有未推送的变更
        var serverHash = _hashItemFields(sItem)
        if (lItem._lastKnownHash && serverHash !== lItem._lastKnownHash) {
          // 服务端版本与上次同步时的快照不同 → 双方都改了
          conflicts.push({
            id: sItem.id, scope: scope, type: 'modified_both',
            localVersion: lItem, serverVersion: sItem,
            reason: '此项在本地和云端均被修改'
          })
        } else if (!lItem._lastKnownHash) {
          // 本地新建但服务端已有同 ID → ID 冲突
          conflicts.push({
            id: sItem.id, scope: scope, type: 'duplicate_id',
            localVersion: lItem, serverVersion: sItem,
            reason: '本地新建的账单与云端已有账单 ID 冲突'
          })
        }
        // _lastKnownHash 匹配 → 推送已生效，无冲突（下面会清脏标记）
      }
    } else {
      // 本地不存在
      if (_isInTombstone(sItem.id)) {
        conflicts.push({
          id: sItem.id, scope: scope, type: 'resurrection',
          localVersion: null, serverVersion: sItem,
          reason: '此账单已在本地删除，但云端仍有记录'
        })
      }
    }
  }

  // 检查本地脏条目在服务端已不存在
  for (var m = 0; m < localItems.length; m++) {
    var lIt = localItems[m]
    if (lIt._dirty && !serverMap[lIt.id]) {
      conflicts.push({
        id: lIt.id, scope: scope, type: 'local_only',
        localVersion: lIt, serverVersion: null,
        reason: '本地修改的账单在云端已被删除'
      })
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

  var deletedIds = {}
  var deletedItems = _getDeletedItems()
  for (var d = 0; d < deletedItems.length; d++) {
    deletedIds[deletedItems[d].id] = true
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
    if (deletedIds[rIt.id]) continue
    merged.push({
      ...rIt,
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

    _cleanOldTombstones()
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
 * @param {Array} resolutions — [{id, scope, resolution: 'local'|'server'|'keep_deleted'|'restore', resolvedItem}]
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
    } else if (r.resolution === 'keep_deleted') {
      // 保持删除 → 仅清除墓碑
      // 条目已在本地删除，无需操作 items
    } else if (r.resolution === 'restore') {
      // 恢复服务端版本
      items = items.filter(function (it) { return it.id !== r.id })
      if (r.resolvedItem) {
        items.unshift({
          ...r.resolvedItem,
          _dirty: false, _syncedAt: Date.now(),
          _lastKnownHash: _hashItemFields(r.resolvedItem)
        })
      }
    }
    _save(key, items)
    _removeFromTombstone(r.id)
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

  // 冲突检测 & 裁决
  getPendingConflicts,
  resolveConflicts,
}
