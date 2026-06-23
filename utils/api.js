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
      // last-write-wins 安全降级：仅当后端已返回 updatedAt(>0) 且本地更新时，
      // 保留本地并反推后端；后端尚未支持时间戳时退回「云端权威」，不破坏跨端同步
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
}
