// app.js — 小程序入口：冷启动同步 + 全局数据管理
const api = require('./utils/api')

App({
  globalData: {
    lang: 'zh-CN',
    darkMode: 'auto',
  },

  onLaunch() {
    // 冷启动时从云端同步数据（已登录用户）
    this._syncFromCloud()
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
