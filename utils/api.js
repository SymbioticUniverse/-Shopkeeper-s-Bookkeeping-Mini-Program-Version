/**
 * 数据接口层 — 前后端隔离
 *
 * 前端只调本文件暴露的方法，不直接操作 Storage / 网络。
 * 当前实现：wx.getStorageSync / wx.setStorageSync（本地）
 * 后端就绪后：替换为 wx.request（云端），前端页面零改动。
 */

// ==================== 账单 ====================

function getItems(scope) {
  const key = scope === 'company' ? 'companyItems' : 'personalItems'
  return wx.getStorageSync(key) || []
}

function addItem(scope, item) {
  const items = getItems(scope)
  items.unshift(item)
  _save(scope === 'company' ? 'companyItems' : 'personalItems', items)
  return item
}

function updateItem(id, data) {
  const scope = _findScope(id)
  const key = scope === 'company' ? 'companyItems' : 'personalItems'
  const items = wx.getStorageSync(key) || []
  const updated = items.map(it => it.id === id ? { ...it, ...data } : it)
  _save(key, updated)
}

function removeItem(id) {
  const scope = _findScope(id)
  const key = scope === 'company' ? 'companyItems' : 'personalItems'
  const items = (wx.getStorageSync(key) || []).filter(it => it.id !== id)
  _save(key, items)
}

function addLinkedItems(scope, item, mirrorScope, mirrorItem) {
  addItem(scope, item)
  addItem(mirrorScope, mirrorItem)
}

// ==================== 分类 ====================

function getCategories(scope) {
  const key = scope === 'company' ? 'companyCategories' : 'personalCategories'
  return wx.getStorageSync(key) || null
}

function saveCategories(scope, list) {
  const key = scope === 'company' ? 'companyCategories' : 'personalCategories'
  _save(key, list)
}

// ==================== 公司 ====================

function getCompanyInfo() {
  return wx.getStorageSync('companyInfo') || null
}

function saveCompanyInfo(info) {
  _save('companyInfo', info)
}

function removeCompanyInfo() {
  wx.removeStorageSync('companyInfo')
}

// ==================== 审核 ====================

function getAuditList() {
  return wx.getStorageSync('auditList') || []
}

function saveAuditList(list) {
  _save('auditList', list)
}

function removeAuditList() {
  wx.removeStorageSync('auditList')
}

// ==================== 通知 ====================

function getNotifyList() {
  return wx.getStorageSync('notifyList') || []
}

function saveNotifyList(list) {
  _save('notifyList', list)
}

// ==================== 反馈 ====================

function getFeedbackList() {
  return wx.getStorageSync('feedbackList') || []
}

function saveFeedbackList(list) {
  _save('feedbackList', list)
}

// ==================== 认证 ====================

function sendVerifyCode(phone) {
  // TODO: 后端实现 — 发送短信验证码
  return { success: true }
}

function loginByPhone(phone, code) {
  // TODO: 后端实现 — 验证手机号+验证码，返回用户信息
  const userInfo = { nickName: phone.slice(0, 3) + '****' + phone.slice(-4), avatarUrl: '' }
  _save('userInfo', userInfo)
  return userInfo
}

function loginByWechat(wxUserInfo) {
  // TODO: 后端实现 — 微信授权登录，返回用户信息
  _save('userInfo', wxUserInfo)
  return wxUserInfo
}

function logout() {
  // TODO: 后端实现 — 注销会话/token
  wx.removeStorageSync('userInfo')
}

// ==================== 用户 ====================

function getUserInfo() {
  return wx.getStorageSync('userInfo') || null
}

function saveUserInfo(info) {
  _save('userInfo', info)
}

function removeUserInfo() {
  wx.removeStorageSync('userInfo')
}

// ==================== 设置 ====================

function getSetting(key) {
  return wx.getStorageSync(key)
}

function saveSetting(key, value) {
  _save(key, value)
}

function removeSetting(key) {
  wx.removeStorageSync(key)
}

// ==================== 自定义简览 ====================

function getOverviewCards() {
  return wx.getStorageSync('customOverviewCards') || []
}

function saveOverviewCards(cards) {
  _save('customOverviewCards', cards)
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
}
