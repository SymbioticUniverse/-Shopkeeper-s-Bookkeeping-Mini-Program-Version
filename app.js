// app.js — 小程序入口：冷启动同步 + 全局数据管理
const api = require('./utils/api')

App({
  globalData: {
    lang: 'zh-CN',
    darkMode: 'auto',
  },

  onLaunch() {
    // 设备检测：平板/宽屏 → 横屏布局
    this._detectDevice()
    // 冷启动：先重放离线队列，再同步云端数据
    this._syncFromCloud()
    // 注册网络恢复监听：断网期间的操作会在联网后自动推送
    api._initNetworkListener()
  },

  _detectDevice() {
    try {
      const info = wx.getSystemInfoSync()
      const { windowWidth, windowHeight, model, screenWidth } = info
      // 屏幕物理宽度 >= 768 → iPad/平板
      // 或 model 名含 iPad
      // 或横屏 + 宽度 >= 600（手机横屏也能触发平板布局）
      const isIPad = (model && model.toLowerCase().indexOf('ipad') !== -1)
      const isWideScreen = screenWidth >= 768
      const isTablet = isIPad || isWideScreen
      this.globalData.isTablet = isTablet
      this.globalData._deviceInfo = { windowWidth, windowHeight, model, screenWidth }
    } catch (e) {
      this.globalData.isTablet = false
    }
  },

  async _syncFromCloud() {
    try {
      const token = wx.getStorageSync('authToken')
      if (!token) return

      const result = await api.syncFromCloud()
      if (result && result.synced) {
        console.log('[Chitu] 云同步完成')
      } else if (result && result.hasConflicts) {
        console.log('[Chitu] 发现 ' + (result.conflicts ? result.conflicts.length : 0) + ' 个数据冲突，等待用户处理')
      }
    } catch (e) {
      console.warn('[Chitu] 云同步失败:', e.message)
    }
  }
})
