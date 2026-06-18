/**
 * 数据接口层 — 前后端隔离（混合模式）
 *
 * 前端只调本文件暴露的方法，不直接操作 Storage / 网络。
 * 读操作：从本地 Storage 同步读取（兼容已有调用方）
 * 写操作：先写本地 Storage，再异步推送到后端
 * 认证操作：纯后端，token 存本地
 */

// ==================== 配置 ====================

/** 后端 API 基址（生产环境改为真实域名） */
const BASE_URL = 'http://localhost:3000/api'

// ==================== Token 管理 ====================

function _getToken() {
  return wx.getStorageSync('authToken') || ''
}

function _setToken(token) {
  if (token) {
    wx.setStorageSync('authToken', token)
  } else {
    wx.removeStorageSync('authToken')
  }
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
 * 无 token 时直接跳过（离线模式）
 */
function _pushBackend(method, path, data) {
  if (!_getToken()) return // 未登录，仅用本地存储
  return _request(method, path, data).catch(err => {
    console.warn('[API] 后台推送失败', path, err)
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
  const result = _addItemLocal(scope, item)
  // 异步推送到后端
  _pushBackend('POST', '/items', { scope, item })
  return result
}

function updateItem(id, data) {
  const scope = _findScope(id)
  const key = scope === 'company' ? 'companyItems' : 'personalItems'
  const items = wx.getStorageSync(key) || []
  const updated = items.map(it => it.id === id ? { ...it, ...data } : it)
  _save(key, updated)
  // 异步推送到后端
  _pushBackend('PUT', '/items/' + id, data)
}

function removeItem(id) {
  const scope = _findScope(id)
  const key = scope === 'company' ? 'companyItems' : 'personalItems'
  const items = (wx.getStorageSync(key) || []).filter(it => it.id !== id)
  _save(key, items)
  // 异步推送到后端
  _pushBackend('DELETE', '/items/' + id)
}

function addLinkedItems(scope, item, mirrorScope, mirrorItem) {
  // 先写本地 Storage（不推后端，避免重复）
  _addItemLocal(scope, item)
  _addItemLocal(mirrorScope, mirrorItem)
  // 后端联动接口（事务写入，一次推送两条）
  _pushBackend('POST', '/items/linked', { scope, item, mirrorScope, mirrorItem })
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
 * 成功后存储 token + userInfo 到本地
 * @returns {Promise<{nickName: string, avatarUrl: string, token: string}>}
 */
async function loginByPhone(phone, code) {
  const result = await _request('POST', '/auth/login-by-phone', { phone, code })
  _setToken(result.token)
  const userInfo = { nickName: result.nickName, avatarUrl: result.avatarUrl }
  _save('userInfo', userInfo)
  return userInfo
}

/**
 * 微信授权登录
 * 成功后存储 token + userInfo 到本地
 * @returns {Promise<{nickName: string, avatarUrl: string, token: string}>}
 */
async function loginByWechat(wxUserInfo) {
  const result = await _request('POST', '/auth/login-by-wechat', wxUserInfo)
  _setToken(result.token)
  const userInfo = { nickName: result.nickName, avatarUrl: result.avatarUrl }
  _save('userInfo', userInfo)
  return userInfo
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
  wx.removeStorageSync('userInfo')
}

// ==================== 用户 ====================

function getUserInfo() {
  return wx.getStorageSync('userInfo') || null
}

function saveUserInfo(info) {
  _save('userInfo', info)
  _pushBackend('POST', '/auth/user-info', info)
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
 * 从后端拉取全量数据到本地 Storage
 * 应在登录成功后调用，或 App.onLaunch 时调用
 * @returns {Promise<{synced: boolean}>}
 */
async function syncFromCloud() {
  if (!_getToken()) return { synced: false }

  try {
    // 并行拉取所有数据
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

    if (personalItems.status === 'fulfilled' && personalItems.value) {
      _save('personalItems', personalItems.value)
    }
    if (companyItems.status === 'fulfilled' && companyItems.value) {
      _save('companyItems', companyItems.value)
    }
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
      _save('userInfo', userInfo.value)
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

// ==================== 导出 ====================

module.exports = {
  getItems,
  addItem,
  updateItem,
  removeItem,
  addLinkedItems,

  getCategories,
  saveCategories,

  getCompanyInfo,
  saveCompanyInfo,
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

  // 新增：云端同步
  syncFromCloud,
}
