function createMethods(dependencies) {
  const {
    api,
    xlsx,
    playTap,
    setVolume,
    getTLang,
    getLangLabel,
    _encryptWithMasterKey,
    _decryptWithMasterKey,
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
          const phone = result.phone || wx.getStorageSync('user_phone') || ''
          this._ensureCryptoReady(phone).then(() => {
          this._initCrypto().then(() => {
            api.syncFromCloud().then((syncResult) => {
              if (syncResult && syncResult.hasConflicts) { this._handleSyncResult(syncResult); return }
              this.initDetailItems()
              this._syncOverviewCards()
              const su = api.getUserInfo()
              if (su) this.setData({ userInfo: su })
              this._refreshAvatarDisplay(su)
              api.getVipStatus().then(function (s) { this.setData({ vipStatus: s, vipTrialDays: this._computeTrialDays(s), vipExpiresText: this._formatVipExpiry(s) }); this._checkEncryptionTierAlignment() }.bind(this)).catch(function () {})
              this.updateNotifyBadge()
              this.updateAuditBadge()
            })
          }).catch(function () {})
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

  // ==================== E2E 加密 ====================

  _getCrypto() {
    try { return require('../../utils/crypto.js') } catch (_) { return null }
  },

  /** 确保主密钥已生成且有效，登录后立即调用。已有有效密钥或服务器有 blob 时跳过（避免覆盖高级安全 blob） */
  _ensureCryptoReady(phone) {
    var crypto = this._getCrypto()
    if (!crypto || !phone) return Promise.resolve()
    var masterKey = crypto.exportMasterKey()
    // 已有有效密钥 → 跳过
    if (masterKey && !/^0+$/.test(masterKey)) return Promise.resolve()
    // 无有效密钥 → 先检查服务器是否有 blob，有则不覆盖（交给 _initCrypto 走恢复流程）
    var that = this
    return crypto.fetchKeyBlob().then(function (result) {
      if (result && result.blob) {
        console.log('[crypto] 服务器已有 blob（tier=' + (result.tier || 'unknown') + '），跳过自动生成')
        return
      }
      // 服务器无 blob → 首次使用，生成并上传
      console.log('[crypto] 首次使用，初始化主密钥...')
      var setupResult = crypto.setupEncryption(phone)
      return crypto.uploadKeyBlob(setupResult.encryptedBlob, setupResult.salt, setupResult.tier).then(function () {
        console.log('[crypto] 主密钥已生成并上传')
      }).catch(function (err) {
        console.error('[crypto] 主密钥上传失败:', err && err.message || err)
      })
    }).catch(function () {
      // 网络错误，不阻塞
      console.warn('[crypto] 无法检查服务器 blob，跳过')
    })
  },

  _initCrypto() {
    var crypto = this._getCrypto()
    if (!crypto) return Promise.resolve()

    // 清理损坏状态：e2e_enabled 标记存在但主密钥丢失
    if (wx.getStorageSync('e2e_enabled') && !wx.getStorageSync('e2e_master_key')) {
      try { wx.removeStorageSync('e2e_enabled') } catch (_) {}
      try { wx.removeStorageSync('e2e_advanced') } catch (_) {}
      console.warn('[crypto] 检测到损坏的加密状态，已自动清理')
    }

    var masterKey = crypto.exportMasterKey()
    var hasKey = !!masterKey

    this.setData({
      encryptionEnabled: hasKey,
      encryptionAdvancedEnabled: hasKey && crypto.isAdvancedSecurityEnabled()
    })

    // 已有主密钥 → 检测是否为零值损坏密钥（旧版 randomBytes bug），是则自动重新生成
    if (hasKey) {
      if (/^0+$/.test(masterKey)) {
        console.warn('[crypto] 检测到损坏的主密钥（全零），自动重新生成')
        var phone = wx.getStorageSync('user_phone') || ''
        if (phone) {
          try {
            var that0 = this
            var setupResult = crypto.setupEncryption(phone)
            crypto.uploadKeyBlob(setupResult.encryptedBlob, setupResult.salt, setupResult.tier).then(function () {
              that0.setData({ encryptionEnabled: true, encryptionAdvancedEnabled: false })
              console.log('[crypto] 主密钥已重新生成，新 blob 已上传')
            }).catch(function (err) {
              console.error('[crypto] 新密钥 blob 上传失败，服务器仍保留旧（可能损坏的）blob:', err && err.message || err)
              that0.setData({ encryptionEnabled: true, encryptionAdvancedEnabled: false })
            })
          } catch (e) {
            console.error('[crypto] 主密钥重新生成失败:', e.message)
          }
        }
      }
      return this._syncCompanyKeys()
    }

    // 未登录 → 无 token，等登录后重试
    if (!wx.getStorageSync('authToken')) return Promise.resolve()

    // 查服务端是否有 blob（不管本地 e2e_enabled，那只是本地标记）
    var that = this
    return crypto.fetchKeyBlob().then(function (result) {
      if (!result || !result.blob) {
        // 服务端无 blob → 首次使用，自动初始化默认加密
        var phone = wx.getStorageSync('user_phone') || ''
        if (phone) {
          return new Promise(function (resolveSetup) {
            try {
              var setupResult = crypto.setupEncryption(phone)
              crypto.uploadKeyBlob(setupResult.encryptedBlob, setupResult.salt, setupResult.tier).then(function () {
                that.setData({ encryptionEnabled: true, encryptionAdvancedEnabled: false })
                console.log('[crypto] 默认加密已自动初始化，blob 已上传')
                resolveSetup()
              }).catch(function (err) {
                console.error('[crypto] 默认加密 blob 上传失败:', err && err.message || err)
                console.warn('[crypto] 默认加密已初始化但 blob 上传失败')
                that.setData({ encryptionEnabled: true, encryptionAdvancedEnabled: false })
                resolveSetup()
              })
            } catch (e) {
              console.error('[crypto] 自动初始化加密失败，但主密钥已生成可用:', e.message)
              // 主密钥已成功生成并保存，加密可正常工作，仅恢复 blob 上传失败
              that.setData({ encryptionEnabled: true, encryptionAdvancedEnabled: false })
              resolveSetup()
            }
          }).then(function () { return that._syncCompanyKeys() })
        }
        // dev 模式无手机号 → 跳过
        return
      }

      // 服务端有 blob → 尝试恢复，失败则静默重新初始化（个人端加密不阻断）
      return new Promise(function (resolveRecover) {
        function _doRecover(phone) {
          if (result.tier === 'advanced') {
            // 服务器有高级 blob，标记以供设置页显示"恢复高级安全"入口
            that.setData({ settingsHasAdvancedBlob: true })
            that._showAdvancedKeyInput(function (advancedKey) {
              if (!advancedKey) {
                console.warn('[crypto] 高级密钥恢复已取消，跳过初始化')
                resolveRecover()
                return
              }
              var ok = crypto.recoverMasterKeyAdvanced(phone, advancedKey, result.blob, result.salt)
              if (ok) {
                that.setData({ encryptionEnabled: true, encryptionAdvancedEnabled: true, settingsHasAdvancedBlob: false })
                console.log('[crypto] 密钥已恢复')
              } else {
                wx.showToast({ title: '密钥不正确', icon: 'none' })
              }
              resolveRecover()
            })
          } else {
            var ok = crypto.recoverMasterKey(phone, result.blob, result.salt)
            if (ok) {
              // 检查恢复出的密钥是否损坏（全零），是则自动重新初始化
              if (/^0+$/.test(crypto.exportMasterKey())) {
                console.warn('[crypto] 从服务器恢复的密钥为全零，重新初始化')
                _reinitCrypto(phone)
              } else {
                that.setData({ encryptionEnabled: true, encryptionAdvancedEnabled: false })
              }
            } else {
              // 恢复失败 → 静默重新初始化（个人端不卡用户）
              _reinitCrypto(phone)
            }
            resolveRecover()
          }
        }

        // 恢复失败时：清旧 blob，重新初始化，不弹 toast
        function _reinitCrypto(phone) {
          console.warn('[crypto] 恢复失败，自动重新初始化加密')
          try {
            var setupResult = crypto.setupEncryption(phone)
            crypto.uploadKeyBlob(setupResult.encryptedBlob, setupResult.salt, setupResult.tier || 'personal').catch(function () {})
          } catch (_) {}
          that.setData({ encryptionEnabled: true, encryptionAdvancedEnabled: false })
        }

        var cachedPhone = wx.getStorageSync('user_phone') || ''
        if (cachedPhone) {
          _doRecover(cachedPhone)
        } else {
          // 无缓存手机号 → 不弹窗，跳过恢复，等下次登录自动初始化
          console.warn('[crypto] 无缓存手机号，跳过恢复')
          resolveRecover()
        }
      }).then(function () { return that._syncCompanyKeys() })
    }).catch(function (err) {
      console.warn('[crypto] fetchKeyBlob 失败，加密初始化推迟:', (err && err.message) || err)
    })
  },

  /** 同步公司加密密钥状态 */
  _syncCompanyKeys() {
    var crypto = this._getCrypto()
    if (!crypto) return Promise.resolve()

    var ci = api.getCompanyInfo()
    if (!ci || !ci.companyUid) {
      // 未加入公司 → 清除旧密钥
      crypto.clearCompanyKeys()
      this.setData({ encryptionCompanyKeyReady: false, encryptionCompanyIsBoss: false })
      return Promise.resolve()
    }

    var isBoss = ci.companyRole === 'boss'
    var hasPriv = crypto.getCompanyPrivateKey()
    var hasPub = crypto.getCompanyPublicKey()

    // 已有密钥 → 检查是否就绪
    if (isBoss && hasPriv) {
      this.setData({ encryptionCompanyKeyReady: true, encryptionCompanyIsBoss: true })
      return Promise.resolve()
    }
    if (!isBoss && hasPub) {
      this.setData({ encryptionCompanyKeyReady: true, encryptionCompanyIsBoss: false })
      return Promise.resolve()
    }

    var that = this

    if (isBoss) {
      // 老板缺失私钥 → 尝试从服务端恢复
      return api.fetchCompanyEncryptedPrivateKey().then(function (result) {
        if (result && result.encrypted_private_key) {
          var masterKey = crypto.exportMasterKey()
          if (!masterKey) {
            console.warn('[crypto] 公司私钥备份存在但本地无主密钥，无法解密')
            that.setData({ encryptionCompanyKeyReady: false, encryptionCompanyIsBoss: true })
            return
          }
          try {
            var privHex = _decryptWithMasterKey(crypto, result.encrypted_private_key)
            crypto.setCompanyPrivateKey(privHex)
            if (result.key_id) {
              crypto.setCompanyPublicKey(result.public_key || '', result.key_id)
            }
            that.setData({ encryptionCompanyKeyReady: true, encryptionCompanyIsBoss: true })
            console.log('[crypto] 公司私钥已从服务端恢复')
          } catch (e) {
            console.error('[crypto] 公司私钥恢复失败:', e.message)
            that.setData({ encryptionCompanyKeyReady: false, encryptionCompanyIsBoss: true })
          }
        } else {
          // 新创建的公司在等后端部署 → 暂时标记未就绪
          that.setData({ encryptionCompanyKeyReady: false, encryptionCompanyIsBoss: true })
        }
      }).catch(function () {
        that.setData({ encryptionCompanyKeyReady: false, encryptionCompanyIsBoss: true })
      })
    } else {
      // 员工缺失公钥 → 从服务端获取
      return api.fetchCompanyPublicKey(ci.companyUid).then(function (result) {
        if (result && result.public_key) {
          crypto.setCompanyPublicKey(result.public_key, result.key_id || '')
          that.setData({ encryptionCompanyKeyReady: true, encryptionCompanyIsBoss: false })
        } else {
          that.setData({ encryptionCompanyKeyReady: false, encryptionCompanyIsBoss: false })
        }
      }).catch(function () {
        that.setData({ encryptionCompanyKeyReady: false, encryptionCompanyIsBoss: false })
      })
    }
  },

  /** 设置页手动触发公司密钥重新生成 */
  onRegenerateCompanyKeys() {
    var that = this
    this._showCustomModal({
      title: '重新生成公司密钥',
      content: '将重新生成公司加密密钥对。\n\n旧数据若用旧密钥加密将无法解密。',
      confirm: '确定',
      cancel: '取消',
      cb: function (confirmed) {
        if (confirmed) {
          wx.showLoading({ title: '生成中...' })
          that._setupBossCompanyKeys()
          wx.hideLoading()
          wx.showToast({ title: '密钥已重新生成', icon: 'success' })
        }
      }
    })
  },

  /** 老板创建公司后，生成本地密钥对并初始化企业加密 */
  _setupBossCompanyKeys() {
    var crypto = this._getCrypto()
    if (!crypto) return

    var ecc = null
    try { ecc = require('../../vendor/noble-ecc.js') } catch (e) {}
    if (!ecc) {
      console.warn('[crypto] ECC 模块未加载，跳过公司加密初始化')
      return
    }

    try {
      // 客户端生成 secp256k1 密钥对（私钥永不离客户端）
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

      // 存储私钥到本地
      crypto.setCompanyPrivateKey(privHex)
      crypto.setCompanyPublicKey(pubHex, '')

      this.setData({ encryptionCompanyKeyReady: true, encryptionCompanyIsBoss: true })
      console.log('[crypto] 公司加密密钥对已生成')

      // 上传公钥到服务端（员工加入时自动获取）
      api.uploadCompanyPublicKey(pubHex, '').catch(function () {
        console.warn('[crypto] 公司公钥上传失败，后续重试')
      })

      // 加密私钥后上传服务端备份（用主密钥加密）
      var masterKey = crypto.exportMasterKey()
      if (masterKey) {
        var encPrivHex = _encryptWithMasterKey(crypto, privHex)
        api.uploadCompanyEncryptedPrivateKey(encPrivHex, '').catch(function () {
          console.warn('[crypto] 公司私钥备份上传失败，后续重试')
        })
      }
    } catch (e) {
      console.error('[crypto] 公司密钥对生成失败:', e.message)
      wx.showToast({ title: '密钥生成失败：' + (e.message || '未知错误'), icon: 'none', duration: 3000 })
    }
  },

  /** 刷新公司加密状态到 UI */
  _refreshCompanyEncryptionState() {
    var crypto = this._getCrypto()
    if (!crypto) return
    var ci = api.getCompanyInfo()
    if (!ci || !ci.companyUid) {
      this.setData({ encryptionCompanyKeyReady: false, encryptionCompanyIsBoss: false })
      return
    }
    this.setData({
      encryptionCompanyIsBoss: ci.companyRole === 'boss',
      encryptionCompanyKeyReady: ci.companyRole === 'boss'
        ? !!crypto.getCompanyPrivateKey()
        : !!crypto.getCompanyPublicKey()
    })
  },

  /** 换设备恢复时，手机号未缓存 → 弹窗让用户输入 */
  _promptPhoneForRecovery(callback) {
    wx.showModal({
      title: '请输入注册手机号以恢复加密数据',
      editable: true,
      placeholderText: '请输入手机号',
      confirmText: '确定',
      cancelText: '取消',
      success: function (res) {
        if (!res.confirm) { callback(''); return }
        var phone = (res.content || '').trim()
        callback(phone)
      }
    })
  },

  /** 刷新加密状态到 UI */
  _refreshEncryptionState() {
    var crypto = this._getCrypto()
    if (!crypto) return
    var hasKey = !!crypto.exportMasterKey()
    this.setData({
      encryptionEnabled: hasKey,
      encryptionAdvancedEnabled: hasKey && crypto.isAdvancedSecurityEnabled()
    })
    this._refreshCompanyEncryptionState()
  },

  /** VIP 过期/续费时自动对齐加密 tier */
  _checkEncryptionTierAlignment() {
    var crypto = this._getCrypto()
    if (!crypto) return
    var masterKey = crypto.exportMasterKey()
    if (!masterKey) return

    var isAdvanced = crypto.isAdvancedSecurityEnabled()
    var isVip = api.isVip()
    var phone = wx.getStorageSync('user_phone') || ''
    if (!phone) return

    var that = this

    if (isAdvanced && !isVip) {
      // VIP 过期 → 自动降级 blob 到 personal
      try {
        var result = crypto.downgradeToPersonal(phone)
        crypto.uploadKeyBlob(result.encryptedBlob, result.salt, result.tier).then(function () {
          wx.setStorageSync('e2e_advanced', false)
          wx.setStorageSync('e2e_advanced_downgraded', true)
          that.setData({ encryptionAdvancedEnabled: false })
          console.log('[crypto] VIP 过期，已自动降级为默认加密')
        }).catch(function () {
          // 上传失败 → 保持本地高级标记不变，下次对齐检查会重试
          console.warn('[crypto] VIP 过期降级 blob 上传失败，下次重试')
        })
      } catch (e) {
        console.error('[crypto] VIP 过期自动降级失败:', e.message)
      }
      return
    }

    if (!isAdvanced && isVip && wx.getStorageSync('e2e_advanced_downgraded')) {
      // VIP 续费 → 提示用户恢复高级安全
      wx.showModal({
        title: 'VIP 已恢复',
        content: '检测到您之前开启了高级安全加密，是否恢复？',
        confirmText: '恢复',
        cancelText: '暂不',
        success: function (res) {
          if (res.confirm) {
            that._enableAdvancedSecurity()
          }
          // 无论是否恢复，清除降级标记（不反复提示）
          wx.removeStorageSync('e2e_advanced_downgraded')
        }
      })
    }
  },

  /** 点击「数据加密」— 加密为默认开启，不可关闭 */
  _onEncryptionTap() {
    var crypto = this._getCrypto()
    console.log('[encryption] _onEncryptionTap 调用, crypto=', !!crypto)
    if (!crypto) {
      wx.showToast({ title: '加密模块加载失败', icon: 'none' })
      return
    }
    var that = this
    var vipStatus = wx.getStorageSync('vipStatus') || null
    var isEnterpriseVip = !!(vipStatus && vipStatus.vipLevel >= 2)
    var hasCompany = !!api.getCompanyInfo()
    console.log('[encryption] vip=', isEnterpriseVip, 'hasCompany=', hasCompany)
    var isAdvanced = crypto.isAdvancedSecurityEnabled()
    var isBoss = crypto.isCompanyBoss()
    var itemList = ['导出主密钥（备份）']

    if (isEnterpriseVip && hasCompany) {
      itemList.unshift(isAdvanced ? '关闭高级安全' : '开启高级安全（28位密钥）')
    } else {
      var tip = !isEnterpriseVip ? '开启高级安全（需企业VIP）' : '开启高级安全（需创建公司）'
      itemList.unshift(tip)
    }
    if (isBoss) {
      itemList.push('导出公司私钥（备份）')
    }

    console.log('[encryption] customSheet items:', JSON.stringify(itemList))
    this.setData({ showEncryptionSheet: true, encryptionSheetItems: itemList, encryptionSheetTapIndex: -1 })
  },

  /** 加密弹窗 - 点击选项 */
  onEncryptionSheetTap(e) {
    var index = e.currentTarget.dataset.idx
    var label = this.data.encryptionSheetItems[index]
    console.log('[encryption] 点击选项:', label, 'index:', index)
    var that = this
    this.setData({ showEncryptionSheet: false, encryptionSheetTapIndex: index })

    // 延迟执行，等弹窗关闭动画
    setTimeout(function () {
      console.log('[encryption] 延迟执行:', label)
      switch (label) {
        case '开启高级安全（28位密钥）':
          that._enableAdvancedSecurity()
          break
        case '关闭高级安全':
          that._disableAdvancedSecurity()
          break
        case '开启高级安全（需企业VIP）':
          wx.showModal({
            title: '企业VIP功能',
            content: '高级安全加密需要企业VIP + 创建公司后才能使用。',
            showCancel: false,
            confirmText: '知道了'
          })
          break
        case '开启高级安全（需创建公司）':
          wx.showModal({
            title: '需创建公司',
            content: '高级安全加密需要先创建或加入一个公司。',
            showCancel: false,
            confirmText: '知道了'
          })
          break
        case '导出主密钥（备份）':
          that._exportMasterKey()
          break
        case '导出公司私钥（备份）':
          that._exportCompanyPrivateKey()
          break
      }
    }, 200)
  },

  /** 加密弹窗 - 关闭 */
  onEncryptionSheetClose() {
    this.setData({ showEncryptionSheet: false })
  },

  noop() {},

  /** 自定义 Modal — 替代 wx.showModal（真机不渲染） */
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
    // 输入框模式：校验密钥长度
    if (this.data.customModalShowInput) {
      var key = (inputVal || '').trim()
      if (key.length < 28) {
        wx.showToast({ title: '密钥格式不正确（需28位）', icon: 'none' })
        return
      }
    }
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

  /** 开启高级安全（企业用户） */
  _enableAdvancedSecurity() {
    console.log('[encryption] _enableAdvancedSecurity 调用')
    var crypto = this._getCrypto()
    if (!crypto) {
      wx.showToast({ title: '加密模块未就绪，请重试', icon: 'none' })
      return
    }
    var that = this

    // 第1步：警告
    this._showCustomModal({
      title: '⚠️ 开启高级安全（1/2）',
      content: '将生成 28 位高级安全密钥。\n\n此密钥丢失后永久无法恢复！\n公司加密数据将永远无法解密！！',
      confirm: '我已知晓，下一步',
      cancel: '取消',
      cb: function (confirmed) {
        if (!confirmed) return

        // 用户确认后才生成密钥
        var advancedKey = crypto.generateAdvancedKey()
        wx.setClipboardData({ data: advancedKey })

        // 第2步：展示密钥
        that._showCustomModal({
          title: '⚠️ 保存密钥（2/2）',
          content: '以下 28 位密钥已复制到剪贴板，请立即保存到安全的地方：\n\n' + advancedKey,
          confirm: '已保存，确认开启',
          cancel: '取消',
          cb: function (confirmed2) {
            if (!confirmed2) {
              wx.showToast({ title: '高级安全开启失败，密钥已丢弃', icon: 'none', duration: 2500 })
              return
            }

            var phone = wx.getStorageSync('user_phone') || ''
            if (!phone) {
              wx.showToast({ title: '请先绑定手机号', icon: 'none' })
              return
            }
            wx.showLoading({ title: '开启高级安全...' })
            try {
              var result = crypto.enableAdvancedSecurity(phone, advancedKey)
              crypto.uploadKeyBlob(result.encryptedBlob, result.salt, result.tier).then(function () {
                wx.hideLoading()
                wx.setStorageSync('e2e_advanced', true)
                wx.removeStorageSync('e2e_advanced_downgraded')
                that.setData({ encryptionAdvancedEnabled: true, settingsHasAdvancedBlob: false })
                wx.showToast({ title: '高级安全已开启', icon: 'success' })
              }).catch(function () {
                wx.hideLoading()
                wx.showToast({ title: '上传失败，请重试', icon: 'none' })
              })
            } catch (e) {
              wx.hideLoading()
              wx.showToast({ title: '操作失败: ' + e.message, icon: 'none' })
            }
          }
        })
      }
    })
  },

  /** 关闭高级安全 */
  _disableAdvancedSecurity() {
    var crypto = this._getCrypto()
    if (!crypto) return
    var that = this

    this._showCustomModal({
      title: '输入高级安全密钥以验证身份',
      content: '',
      showInput: true,
      placeholder: '请输入28位密钥',
      confirm: '验证',
      cancel: '取消',
      cb: function (confirmed, inputVal) {
        if (!confirmed || !inputVal) return
        var key = (inputVal || '').trim()
        if (!crypto.isValidAdvancedKey(key)) {
          wx.showToast({ title: '密钥格式不正确（需28位）', icon: 'none' })
          return
        }

        var phone = wx.getStorageSync('user_phone') || ''
        if (!phone) {
          wx.showToast({ title: '请先绑定手机号', icon: 'none' })
          return
        }
        wx.showLoading({ title: '切换默认模式...' })
        try {
          var result = crypto.disableAdvancedSecurity(phone, key)
          crypto.uploadKeyBlob(result.encryptedBlob, result.salt, result.tier).then(function () {
            wx.hideLoading()
            wx.setStorageSync('e2e_advanced', false)
            wx.removeStorageSync('e2e_advanced_downgraded')
            that.setData({ encryptionAdvancedEnabled: false })
            wx.showToast({ title: '已切回默认模式', icon: 'success' })
          }).catch(function () {
            wx.hideLoading()
            wx.showToast({ title: '上传失败，请重试', icon: 'none' })
          })
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '密钥不正确', icon: 'none' })
        }
      }
    })
  },

  /** 导出主密钥 */
  _exportMasterKey() {
    var crypto = this._getCrypto()
    if (!crypto) return
    var masterKey = crypto.exportMasterKey()
    if (!masterKey) {
      wx.showToast({ title: '无主密钥', icon: 'none' })
      return
    }
    if (/^0+$/.test(masterKey)) {
      wx.showModal({
        title: '密钥异常',
        content: '主密钥校验失败，可能因版本兼容问题导致。\n\n请重启小程序，系统将自动修复。',
        showCancel: false,
        confirmText: '知道了'
      })
      return
    }
    wx.setClipboardData({ data: masterKey })
    wx.showModal({
      title: '主密钥已复制',
      content: '密钥已复制到剪贴板，请妥善保存。\n\n任何人拿到此密钥都可解密您的账单数据，请勿泄露。',
      showCancel: false,
      confirmText: '知道了'
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

  /** 手动导入主密钥 */
  _importMasterKeyDialog() {
    var crypto = this._getCrypto()
    if (!crypto) return
    var that = this
    wx.showModal({
      title: '导入主密钥（64位hex）',
      editable: true,
      placeholderText: '请输入64位hex密钥',
      confirmText: '导入',
      cancelText: '取消',
      success: function (res) {
        if (!res.confirm || !res.content) return
        var hex = (res.content || '').trim()
        try {
          crypto.importMasterKey(hex)
          that.setData({ encryptionEnabled: true })
          wx.showToast({ title: '密钥已导入', icon: 'success' })
        } catch (e) {
          wx.showToast({ title: '密钥格式不正确', icon: 'none' })
        }
      }
    })
  },

  /** 显示高级安全密钥输入框 */
  _showAdvancedKeyInput(callback) {
    this._showCustomModal({
      title: '高级安全 — 请输入28位密钥',
      content: '',
      showInput: true,
      placeholder: '输入28位密钥以恢复数据',
      confirm: '确定',
      cancel: '取消',
      cb: function (confirmed, inputVal) {
        if (!confirmed) { callback(''); return }
        callback((inputVal || '').trim())
      }
    })
  },

  /** 手动触发高级密钥恢复（设置页入口 / 点击加密账单） */
  promptAdvancedKeyRecovery() {
    var crypto = this._getCrypto()
    if (!crypto) { wx.showToast({ title: '加密模块未加载', icon: 'none' }); return }
    var phone = wx.getStorageSync('user_phone') || ''
    if (!phone) { wx.showToast({ title: '请先绑定手机号', icon: 'none' }); return }
    var that = this
    crypto.fetchKeyBlob().then(function (result) {
      if (!result || !result.blob || result.tier !== 'advanced') {
        wx.showToast({ title: '未开启高级安全', icon: 'none' })
        return
      }
      that._showAdvancedKeyInput(function (advancedKey) {
        if (!advancedKey) return
        var ok = crypto.recoverMasterKeyAdvanced(phone, advancedKey, result.blob, result.salt)
        if (ok) {
          that.setData({ encryptionEnabled: true, encryptionAdvancedEnabled: true, settingsHasAdvancedBlob: false })
          // 重新解密已加载的数据
          that.initDetailItems()
          that._syncOverviewCards()
          wx.showToast({ title: '密钥已恢复', icon: 'success' })
        } else {
          wx.showToast({ title: '密钥不正确', icon: 'none' })
        }
      })
    }).catch(function () {
      wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
    })
  },

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
