// app.js — 小程序入口：冷启动同步 + 全局数据管理
const api = require('./utils/api')

App({
  globalData: {
    lang: 'zh-CN',
    darkMode: 'auto',
  },

  onLaunch() {
    // 冷启动：先重放离线队列，再同步云端数据
    this._syncFromCloud()
    // 注册网络恢复监听：断网期间的操作会在联网后自动推送
    api._initNetworkListener()
  },

  async _syncFromCloud() {
    try {
      const token = wx.getStorageSync('authToken')
      if (!token) return

      const result = await api.syncFromCloud()
      if (result && result.synced) {
        console.log('[Chitu] 云同步完成')
      }
    } catch (e) {
      console.warn('[Chitu] 云同步失败:', e.message)
    }
  }
})
