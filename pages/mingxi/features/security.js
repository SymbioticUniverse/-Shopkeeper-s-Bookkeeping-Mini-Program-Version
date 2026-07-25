function createMethods(dependencies) {
  const {
    api,
    xlsx,
    playTap,
    setVolume,
    getTLang,
    getLangLabel,
  } = dependencies

  return {
  onLoginEntry() {
    playTap()
    this.setData({ showLoginPage: true })
    this._onSpotlightAction()
  },

  onLoginBack() {
    playTap()
    this.setData({ showLoginPage: false })
  },

  onWxLogin() {
    playTap()
    wx.login({
      success: (loginRes) => {
        if (!loginRes.code) {
          wx.showToast({ title: '登录失败', icon: 'none' })
          return
        }
        api.loginByWechat({ code: loginRes.code }).then(result => {
          const userInfo = { nickName: result.nickName, avatarUrl: result.avatarUrl, updatedAt: result.updatedAt }
          if (result.phone) wx.setStorageSync('user_phone', result.phone)
          this.setData({ isLoggedIn: true, userInfo, showLoginPage: false })
          if (result.isNew) {
            wx.removeStorageSync('guideCompleted')
            this.setData({ _isNewUser: true, showGuide: false })
            this._startSpotlight('tutorial')
          } else {
            this._refreshAvatarDisplay(userInfo)
          }
          wx.showToast({ title: '登录成功', icon: 'success' })
          // 登录后同步数据 + 检查公司加密状态
          Promise.resolve()
            .then(() => api.syncFromCloud())
            .then((syncResult) => {
              if (syncResult && syncResult.hasConflicts) { this._handleSyncResult(syncResult); return }
              this.initDetailItems()
              this._syncOverviewCards()
              const su = api.getUserInfo()
              if (su) this.setData({ userInfo: su })
              this._refreshAvatarDisplay(su)
              api.getVipStatus().then(function (s) { this.setData({ vipStatus: s, vipTrialDays: this._computeTrialDays(s), vipExpiresText: this._formatVipExpiry(s) }) }.bind(this)).catch(function () {})
              this.updateNotifyBadge()
              this.updateAuditBadge()
            })
            .then(() => this._syncCompanyKeys())
            .catch(function (err) {
              console.error('[security] 登录后初始化失败:', err)
            })
        }).catch((err) => {
          const msg = (err && err.error) || '登录失败'
          wx.showToast({ title: msg, icon: 'none', duration: 3000 })
        })
      },
      fail: () => {
        wx.showToast({ title: '登录失败', icon: 'none' })
      }
    })
  },

  // ==================== 企业加密 ====================

  _getCrypto() {
    try { return require('../../../utils/crypto.js') } catch (_) { return null }
  },

  /** 同步公司加密密钥状态 */
  _syncCompanyKeys() {
    var crypto = this._getCrypto()
    if (!crypto) return Promise.resolve()

    var ci = api.getCompanyInfo()
    if (!ci || !ci.companyUid) {
      crypto.clearCompanyKeys()
      this.setData({ encryptionCompanyKeyReady: false, encryptionCompanyIsBoss: false, encryptionCompanyServerHasKeys: false })
      return Promise.resolve()
    }

    var isBoss = ci.companyRole === 'boss'
    var hasPriv = crypto.getCompanyPrivateKey()
    var hasPub = crypto.getCompanyPublicKey()

    if (isBoss && hasPriv && hasPub) {
      this.setData({ encryptionCompanyKeyReady: true, encryptionCompanyIsBoss: true, encryptionCompanyServerHasKeys: true })
      return Promise.resolve()
    }
    if (!isBoss && hasPub) {
      this.setData({ encryptionCompanyKeyReady: true, encryptionCompanyIsBoss: false, encryptionCompanyServerHasKeys: true })
      return Promise.resolve()
    }

    var that = this

    if (isBoss) {
      return api.fetchCompanyEncryptedPrivateKey().then(function (result) {
        if (result && result.encrypted_private_key) {
          that.setData({ encryptionCompanyKeyReady: false, encryptionCompanyIsBoss: true, encryptionCompanyServerHasKeys: true })
          console.log('[crypto] 公司私钥备份存在，需输入恢复密钥')
        } else {
          that.setData({ encryptionCompanyKeyReady: false, encryptionCompanyIsBoss: true, encryptionCompanyServerHasKeys: false })
        }
      }).catch(function (privateError) {
        if (!privateError || privateError.statusCode !== 404) {
          that.setData({ encryptionCompanyKeyReady: false, encryptionCompanyIsBoss: true, encryptionCompanyServerHasKeys: false })
          return
        }
        return api.fetchCompanyPublicKey(ci.companyUid).then(function (publicResult) {
          if (publicResult && publicResult.public_key) {
            crypto.setCompanyPublicKey(publicResult.public_key, publicResult.key_id || '')
            that.setData({ encryptionCompanyKeyReady: false, encryptionCompanyIsBoss: true, encryptionCompanyServerHasKeys: true })
          } else {
            that.setData({ encryptionCompanyKeyReady: false, encryptionCompanyIsBoss: true, encryptionCompanyServerHasKeys: false })
          }
        }).catch(function (publicError) {
          if (publicError && publicError.statusCode === 404) {
            // 服务端无密钥 → boss 尚未开启加密，等待主动触发
            that.setData({ encryptionCompanyKeyReady: false, encryptionCompanyIsBoss: true, encryptionCompanyServerHasKeys: false })
            return
          }
          that.setData({ encryptionCompanyKeyReady: false, encryptionCompanyIsBoss: true, encryptionCompanyServerHasKeys: false })
        })
      })
    } else {
      return api.fetchCompanyPublicKey(ci.companyUid).then(function (result) {
        if (result && result.public_key) {
          crypto.setCompanyPublicKey(result.public_key, result.key_id || '')
          that.setData({ encryptionCompanyKeyReady: true, encryptionCompanyIsBoss: false, encryptionCompanyServerHasKeys: true })
        } else {
          that.setData({ encryptionCompanyKeyReady: false, encryptionCompanyIsBoss: false, encryptionCompanyServerHasKeys: false })
        }
      }).catch(function () {
        that.setData({ encryptionCompanyKeyReady: false, encryptionCompanyIsBoss: false, encryptionCompanyServerHasKeys: false })
      })
    }
  },

  /** 设置页手动触发公司密钥重新生成 */
  onRegenerateCompanyKeys() {
    wx.showModal({
      title: '暂不支持密钥轮换',
      content: '为避免历史公司账单永久无法解密，当前版本禁止直接覆盖公司密钥。后续将通过带版本号的密钥轮换完成。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  /** 老板创建公司后，生成本地密钥对并初始化企业加密 */
  async _setupBossCompanyKeys(serverConfirmedEmpty) {
    var crypto = this._getCrypto()
    if (!crypto) throw new Error('加密模块未加载')
    if (crypto.getCompanyPrivateKey() || crypto.getCompanyPublicKey()) {
      if (crypto.getCompanyPrivateKey() && crypto.getCompanyPublicKey()) {
        this._refreshCompanyEncryptionState()
        return
      }
      if (!serverConfirmedEmpty) throw new Error('公司密钥状态不完整，禁止自动覆盖')
      crypto.clearCompanyKeys()
    }

    var ecc = null
    try { ecc = require('../../../vendor/noble-ecc.js') } catch (e) {}
    if (!ecc) {
      console.warn('[crypto] ECC 模块未加载，跳过公司加密初始化')
      throw new Error('ECC 加密模块未加载')
    }

    try {
      // 客户端生成 secp256k1 密钥对
      var privBytes = ecc.randomPrivateKey()
      var pubBytes = ecc.getPublicKey(privBytes, true)
      var privHex = ''
      for (var i = 0; i < privBytes.length; i++) {
        privHex += (privBytes[i] < 16 ? '0' : '') + privBytes[i].toString(16)
      }
      var pubHex = ''
      for (var j = 0; j < pubBytes.length; j++) {
        pubHex += (pubBytes[j] < 16 ? '0' : '') + pubBytes[j].toString(16)
      }

      var keyId = 'ck_' + api.generateId().slice(0, 20)

      // 生成恢复密钥 + 加密私钥备份
      var recoveryKey = crypto.generateCompanyRecoveryKey()
      var backup = crypto.encryptCompanyPrivateKey(privHex, recoveryKey)

      // 原子写入公钥 + 加密私钥备份
      await api.uploadCompanyKeys(pubHex, backup.encryptedBlob, keyId, backup.salt)
      crypto.setCompanyPrivateKey(privHex)
      crypto.setCompanyPublicKey(pubHex, keyId)
      this.setData({ encryptionCompanyKeyReady: true, encryptionCompanyIsBoss: true, encryptionCompanyServerHasKeys: true })

      // 展示恢复密钥
      wx.setClipboardData({ data: recoveryKey })
      wx.showModal({
        title: '请保存公司恢复密钥',
        content: '28 位恢复密钥已复制到剪贴板。\n\n换设备时必须输入此密钥才能解密公司账单。\n服务端无法解密或找回它，请妥善保存！',
        showCancel: false,
        confirmText: '我已保存'
      })
      console.log('[crypto] 公司加密密钥对已生成并完成备份')
    } catch (e) {
      console.error('[crypto] 公司密钥对生成失败:', e.message)
      this.setData({ encryptionCompanyKeyReady: false, encryptionCompanyIsBoss: true, encryptionCompanyServerHasKeys: false })
      throw e
    }
  },

  /** 换设备恢复公司私钥 */
  _recoverCompanyKeys(recoveryKey) {
    var crypto = this._getCrypto()
    if (!crypto) throw new Error('加密模块未加载')

    var that = this
    return api.fetchCompanyEncryptedPrivateKey().then(function (result) {
      if (!result || !result.encrypted_private_key) {
        throw new Error('服务端无公司私钥备份')
      }
      var privHex = crypto.decryptCompanyPrivateKey(
        result.encrypted_private_key,
        recoveryKey,
        result.salt || result.key_salt || ''
      )
      crypto.setCompanyPrivateKey(privHex)
      if (result.public_key) {
        crypto.setCompanyPublicKey(result.public_key, result.key_id || '')
      }
      that.setData({ encryptionCompanyKeyReady: true, encryptionCompanyIsBoss: true, encryptionCompanyServerHasKeys: true })
      wx.showToast({ title: '公司密钥已恢复', icon: 'success' })
      console.log('[crypto] 公司私钥已从服务端恢复')
    })
  },

  /** 刷新公司加密状态到 UI */
  _refreshCompanyEncryptionState() {
    var crypto = this._getCrypto()
    if (!crypto) return
    var ci = api.getCompanyInfo()
    if (!ci || !ci.companyUid) {
      this.setData({ encryptionCompanyKeyReady: false, encryptionCompanyIsBoss: false, encryptionCompanyServerHasKeys: false })
      return
    }
    this.setData({
      encryptionCompanyIsBoss: ci.companyRole === 'boss',
      encryptionCompanyKeyReady: ci.companyRole === 'boss'
        ? !!(crypto.getCompanyPrivateKey() && crypto.getCompanyPublicKey())
        : !!crypto.getCompanyPublicKey()
    })
  },

  /** 导出公司私钥（仅老板） */
  _exportCompanyPrivateKey() {
    var crypto = this._getCrypto()
    if (!crypto) return
    var privKey = crypto.getCompanyPrivateKey()
    if (!privKey) {
      wx.showToast({ title: '无公司私钥', icon: 'none' })
      return
    }
    wx.setClipboardData({ data: privKey })
    wx.showModal({
      title: '公司私钥已复制',
      content: '公司私钥已复制到剪贴板，请妥善保存。\n\n丢失后无法解密公司账本数据，公司必须重建。\n\n请勿泄露给任何人（包括员工）。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // ==================== 自定义 Modal ====================

  _showCustomModal(opts) {
    this._customModalCb = opts.cb || null
    this.setData({
      showCustomModal: true,
      customModalTitle: opts.title || '',
      customModalContent: opts.content || '',
      customModalConfirm: opts.confirm || '确认',
      customModalCancel: opts.cancel || '取消',
      customModalShowInput: !!opts.showInput,
      customModalPlaceholder: opts.placeholder || '',
      customModalInputValue: '',
    })
  },

  _hideCustomModal() {
    this.setData({ showCustomModal: false, customModalInputValue: '' })
    this._customModalCb = null
  },

  onCustomModalConfirm() {
    var cb = this._customModalCb
    var inputVal = this.data.customModalInputValue
    this._hideCustomModal()
    if (cb) cb(true, inputVal)
  },

  onCustomModalCancel() {
    var cb = this._customModalCb
    this._hideCustomModal()
    if (cb) cb(false)
  },

  onCustomModalInput(e) {
    this.setData({ customModalInputValue: e.detail.value })
  },

  noop() {},

  // ==================== 登出 ====================

  onLogout() {
    playTap()
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          api.logout().then(() => {
            this.setData({
              isLoggedIn: false,
              userInfo: null,
              detailItems: [],
              detailGroups: [],
              settleItems: [],
              showGuide: true,
              guideStep: 0,
            })
            wx.clearStorageSync()
            wx.showToast({ title: '已退出登录', icon: 'none' })
          })
        }
      }
    })
  },

  // ========== 聚光引导（product tour） ==========
  }
}

module.exports = createMethods
