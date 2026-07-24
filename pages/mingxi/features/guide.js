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
  _startSpotlight(type) {
    const keyMap = { first: 'spotlightFirstSteps', tutorial: 'spotlightTutorialSteps', role: 'spotlightRoleSteps' }
    const stepsKey = keyMap[type] || 'spotlightTutorialSteps'
    const steps = this.data[stepsKey] || []
    const firstCfg = steps[0] || {}
    const setup = {}
    if (firstCfg.autoSwitchTab != null) {
      this._setTabUI(firstCfg.autoSwitchTab, false)
      this._loadTabData(firstCfg.autoSwitchTab)
    }
    if (firstCfg.autoShowCompanyShare) {
      setup.showCompanyShare = true
      setup.companyShareStep = 0
    }
    this.setData({
      showSpotlightGuide: true,
      spotlightType: type,
      spotlightStep: 0,
      spotlightTotalSteps: steps.length,
      spotlightStepConfig: firstCfg,
      spotlightTargetRect: null,
      showBookPopup: false,   // 确保引导期间弹窗状态干净
      ...setup,
    })
    // 延迟计算第一个目标的 rect
    const delay = firstCfg.autoSwitchTab != null ? 500 : 350
    setTimeout(() => this._calcSpotlightTargetRect(), delay)
  },

  _advanceSpotlight() {
    const next = this.data.spotlightStep + 1
    const keyMap = { first: 'spotlightFirstSteps', tutorial: 'spotlightTutorialSteps', role: 'spotlightRoleSteps' }
    const stepsKey = keyMap[this.data.spotlightType] || 'spotlightTutorialSteps'
    const steps = this.data[stepsKey] || []
    if (next >= steps.length) {
      this._completeSpotlight()
      return
    }
    const cfg = steps[next] || {}
    // 如果步骤需要自动切换到指定 tab
    if (cfg.autoSwitchTab != null) {
      this._setTabUI(cfg.autoSwitchTab, false)
      this._loadTabData(cfg.autoSwitchTab)
      this.setData({ showLedgerPage: false })  // 关闭账本页，切到 tab 内容
    }
    // 账本页滚动定位
    if (cfg.scrollTo) {
      this.setData({ ledgerScrollTo: cfg.scrollTo })
      setTimeout(() => this.setData({ ledgerScrollTo: '' }), 600)
    }
    // 演示数据
    if (cfg.setupDemo) {
      this._showLedgerDemo()
    }
    // 关闭分类面板（如从垫付引导到多笔记账引导）
    if (cfg.closeBookCatPanel) {
      this.setData({ showBookCatPanel: false })
    }
    // 自动打开公司身份选择卡片
    const setup = {}
    if (cfg.autoShowCompanyShare) {
      setup.showCompanyShare = true
      setup.companyShareStep = 0
    }
    // 自动打开记账弹窗
    if (cfg.autoOpenBook) {
      const now = new Date()
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const td = this._getBookTargetDefaults('personal', 'expense')
      this.setData({
        showBookPopup: true,
        bookPhoto: '',
        'bookForm.type': 'expense',
        'bookForm.amount': '',
        'bookForm.category': '',
        'bookForm.date': date,
        'bookForm.note': '',
        'bookForm.target': td.target,
        'bookForm.targetType': td.targetType,
        bookTypeLabel: '支出',
        bookScope: 'personal',
        bookScopeLabel: '个人',
      })
      // 记账弹窗需要渲染时间，延迟计算 rect
    }
    this.setData({
      spotlightStep: next,
      spotlightStepConfig: cfg,
      spotlightTargetRect: null,
      ...setup,
    })
    // welcome 页不需要计算 rect
    if (cfg.type !== 'welcome') {
      // 带 autoSwitchTab 的步骤延迟更久，等 tab 切换渲染完成
      const delay = cfg.autoSwitchTab != null ? 500 : (cfg.autoOpenBook ? 450 : (cfg.scrollTo ? 600 : 350))
      setTimeout(() => this._calcSpotlightTargetRect(), delay)
    }
  },

  _calcSpotlightTargetRect() {
    const cfg = this.data.spotlightStepConfig
    if (!cfg || !cfg.targetSelector) return
    const query = wx.createSelectorQuery()
    query.select(cfg.targetSelector).boundingClientRect((rect) => {
      if (rect && rect.width > 0) {
        this.setData({ spotlightTargetRect: rect })
      }
    }).exec()
  },

  onSpotlightNext() {
    playTap()
    this._advanceSpotlight()
  },

  onSpotlightSkip() {
    playTap()
    this._completeSpotlight()
  },

  onSpotlightWelcomeNext() {
    playTap()
    this._advanceSpotlight()
  },

  onSpotlightIntroNext() {
    playTap()
    this._advanceSpotlight()
  },

  _completeSpotlight() {
    const type = this.data.spotlightType
    if (type === 'tutorial') {
      this._tutorialDone = true
      this._clearLedgerDemo()
      // 教程结束 → 回到登录引导角色选择
      this.setData({
        showSpotlightGuide: false,
        spotlightType: '',
        spotlightStep: 0,
        spotlightStepConfig: {},
        spotlightTargetRect: null,
        showBookPopup: false,
        showBookCatPanel: false,
        showGuide: true,
        guideStep: 2,
      })
    } else {
      this.setData({
        showSpotlightGuide: false,
        spotlightType: '',
        spotlightStep: 0,
        spotlightStepConfig: {},
        spotlightTargetRect: null,
      })
    }
  },

  /** 页面侧调用：用户操作了被引导的目标元素，推进引导 */
  _onSpotlightAction() {
    const cfg = this.data.spotlightStepConfig
    if (this.data.showSpotlightGuide && cfg && cfg.showNext === false) {
      this._advanceSpotlight()
    }
  },

  // ========== 首次引导 ==========
  onGuideNext() {
    playTap()
    this.setData({ guideStep: this.data.guideStep + 1 })
  },

  onToggleDarkMode() {
    playTap()
    const next = !this.data.isDarkMode
    const mode = next ? 'dark' : 'light'
    api.saveSetting('appDarkMode', mode)
    this.setData({ isDarkMode: next })
  },

  onGuideSkipLogin() {
    playTap()
    // 调试器后门：跳过登录，继续引导流程
    this.setData({ guideStep: 2, guideRole: '' })
  },

  onGuideBack() {
    playTap()
    this.setData({ guideStep: 2, guideRole: '' })
  },

  onGuideRole(e) {
    playTap()
    const role = e.currentTarget.dataset.role
    this.setData({ guideRole: role, guideStep: 3 })
    if (role === 'boss') {
      const uid = 'UID' + Date.now().toString(36).toUpperCase().slice(-8)
      this.setData({ companyUid: uid })
    }
  },

  // 开发工具兜底：普通微信登录（getRealtimePhoneNumber 在模拟器中不触发）
  _devLoginFallback() {
    playTap()
    var sys = wx.getSystemInfoSync()
    if (sys.platform !== 'devtools') return  // 真机不触发，留给 getRealtimePhoneNumber

    var that = this
    wx.login({
      success: function(loginRes) {
        if (!loginRes.code) {
          wx.showToast({ title: '登录失败，请重试', icon: 'none' })
          return
        }
        api.loginByWechat({ code: loginRes.code }).then(function(result) {
          var userInfo = { nickName: result.nickName, avatarUrl: result.avatarUrl, updatedAt: result.updatedAt }
          if (result.phone) wx.setStorageSync('user_phone', result.phone)
          that.setData({ isLoggedIn: true, userInfo: userInfo, showLoginPage: false, showGuide: false })
          if (result.isNew) {
            wx.removeStorageSync('guideCompleted')
            that.setData({ _isNewUser: true, showGuide: false })
            that._startSpotlight('tutorial')
          } else {
            that._refreshAvatarDisplay(userInfo)
          }
          wx.showToast({ title: '登录成功（开发模式）', icon: 'success' })
          // 登录后立即确保主密钥存在且有效，完成后再同步
          that._ensureCryptoReady(result.phone).then(function () {
          that._initCrypto().then(function () {
          api.syncFromCloud().then(function(syncResult) {
            if (syncResult && syncResult.hasConflicts) { that._handleSyncResult(syncResult); return }
            that.initDetailItems()
            that._syncOverviewCards()
            var su = api.getUserInfo()
            if (su) that.setData({ userInfo: su })
            that._refreshAvatarDisplay(su)
            api.getVipStatus().then(function(s) { that.setData({ vipStatus: s, vipTrialDays: that._computeTrialDays(s), vipExpiresText: that._formatVipExpiry(s) }); that._checkEncryptionTierAlignment() }).catch(function() {})
            that.updateNotifyBadge()
            that.updateAuditBadge()
          })
          })
          })
        }).catch(function(err) {
          console.error('[微信登录] 开发模式登录失败:', JSON.stringify(err))
          var msg = (err && err.error) || '登录失败'
          wx.showToast({ title: msg, icon: 'none', duration: 3000 })
        })
      },
      fail: function() {
        wx.showToast({ title: '登录失败，请重试', icon: 'none' })
      }
    })
  },

  // 微信手机号实时验证回调（getRealtimePhoneNumber）
  onGetRealtimePhoneNumber(e) {
    playTap()
    var phoneCode = (e.detail || {}).code
    if (!phoneCode) {
      console.log('[微信手机号] 获取失败, errMsg:', e.detail.errMsg, 'errno:', e.detail.errno)
      wx.showToast({ title: '获取手机号失败，请重试', icon: 'none' })
      return
    }
    // 同时调用 wx.login 获取用户标识 code
    var that = this
    wx.login({
      success: function(loginRes) {
        if (!loginRes.code) {
          wx.showToast({ title: '登录失败，请重试', icon: 'none' })
          return
        }
        console.log('[微信手机号] phoneCode 已获取, 开始登录...')
        api.loginByWechatPhone(loginRes.code, phoneCode).then(function(result) {
          var userInfo = { nickName: result.nickName, avatarUrl: result.avatarUrl, updatedAt: result.updatedAt }
          // 存储手机号用于 E2E 加密
          if (result.phone) wx.setStorageSync('user_phone', result.phone)
          that.setData({ isLoggedIn: true, userInfo: userInfo, showLoginPage: false, showGuide: false })
          if (result.isNew) {
            wx.removeStorageSync('guideCompleted')
            that.setData({ _isNewUser: true, showGuide: false })
            that._startSpotlight('tutorial')
          } else {
            that._refreshAvatarDisplay(userInfo)
          }
          wx.showToast({ title: '登录成功', icon: 'success' })
          // 登录后立即确保主密钥存在且有效（非全零），完成后再同步
          that._ensureCryptoReady(result.phone).then(function () {
          that._initCrypto().then(function () {
            api.syncFromCloud().then(function(syncResult) {
            if (syncResult && syncResult.hasConflicts) { that._handleSyncResult(syncResult); return }
            that.initDetailItems()
            that._syncOverviewCards()
            var su = api.getUserInfo()
            if (su) that.setData({ userInfo: su })
            that._refreshAvatarDisplay(su)
            api.getVipStatus().then(function(s) { that.setData({ vipStatus: s, vipTrialDays: that._computeTrialDays(s), vipExpiresText: that._formatVipExpiry(s) }); that._checkEncryptionTierAlignment() }).catch(function() {})
            that.updateNotifyBadge()
            that.updateAuditBadge()
          })
          })
          })
        }).catch(function(err) {
          console.error('[微信手机号] 登录请求失败:', JSON.stringify(err))
          var msg = (err && err.error) || '登录失败'
          wx.showToast({ title: msg, icon: 'none', duration: 3000 })
        })
      },
      fail: function() {
        wx.showToast({ title: '登录失败，请重试', icon: 'none' })
      }
    })
  },

  onGuideWxLogin() {
    // 已被 getRealtimePhoneNumber 替代，作为兜底
    playTap()
    wx.showToast({ title: '请点击上方微信登录按钮', icon: 'none' })
  },

  async onGuideCompanyCreate() {
    playTap()
    const { companyUid, companyName, companyBossTitle } = this.data
    if (!companyUid) {
      wx.showToast({ title: '请先生成 UID', icon: 'none' })
      return
    }
    if (!companyName.trim()) {
      wx.showToast({ title: '请输入公司名称', icon: 'none' })
      return
    }
    const info = { companyUid, companyName: companyName.trim(), companyBossTitle: companyBossTitle.trim() || 'BOSS', companyRole: 'boss' }
    wx.showLoading({ title: '创建中...' })
    try {
      await api.createCompany(info)
      await this._setupBossCompanyKeys()
      wx.showToast({ title: '创建成功', icon: 'success' })
      this.onGuideComplete()
    } catch (e) {
      wx.showToast({ title: (e && e.error) || '创建失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onGuideEmployeeJoin() {
    playTap()
    const { employeeUid } = this.data
    if (!employeeUid.trim()) {
      wx.showToast({ title: '请输入公司 UID', icon: 'none' })
      return
    }
    const info = { companyUid: employeeUid.trim(), companyRole: 'employee' }
    var that = this
    api.joinCompany(info).then(() => {
      wx.showToast({ title: '已提交申请', icon: 'success' })
      that._syncCompanyKeys()
      that.onGuideComplete()
    }).catch(() => {
      wx.showToast({ title: '加入失败', icon: 'none' })
    })
  },

  onGuideComplete() {
    playTap()
    wx.setStorageSync('guideCompleted', true)
    this.setData({ showGuide: false })
    this.initDetailItems()
    this._syncOverviewCards()
    // 新用户完成引导 → 弹资料完善弹窗
    if (this.data._isNewUser) {
      setTimeout(() => {
        this.setData({
          showProfileModal: true,
          profileEditMode: false,
          profileName: this.data.profileName || '',
          profileAvatarLocal: '',
          profileAvatarUrl: this.data.profileAvatarUrl || '',
        })
      }, 500)
    }
    // 引导完成 → 语音记账操作提示
    if (!wx.getStorageSync('voiceTipShown')) {
      setTimeout(() => this.setData({ showVoiceTip: true }), 600)
    }
  },

  onVoiceTipDismiss() {
    playTap()
    wx.setStorageSync('voiceTipShown', true)
    this.setData({ showVoiceTip: false })
  },

  /** 弹出 VIP 专享额度弹窗 */
  _showVipLimitDialog(type) {
    var label = type === 'asr' ? '语音记账' : (type === 'ocr' ? '凭证扫描' : (type === 'export' ? '账单导出' : '该'))
    wx.showModal({
      title: '会员专享额度',
      content: label + '免费额度已用完。测试期间可免费领取 VIP 会员，畅享不限次使用。',
      confirmText: '领取会员',
      cancelText: '暂不领取',
      success: (res) => {
        if (res.confirm) this.onVipEntry()
      }
    })
  },

  // ========== 操作教程（虚拟账本演示） ==========
  onOpGuideNext() {
    playTap()
    var next = this.data.opGuideStep + 1
    if (next >= 7) { this.onOpGuideComplete(); return }
    this.setData({ opGuideStep: next })
  },
  onOpGuidePrev() {
    playTap()
    if (this.data.opGuideStep > 0) this.setData({ opGuideStep: this.data.opGuideStep - 1 })
  },
  onOpGuideSkip() {
    playTap()
    this.onOpGuideComplete()
  },
  onOpGuideComplete() {
    playTap()
    var after = this.data._opGuideAfter
    if (after === 'role') {
      // 先切步再关教程，避免闪过登录页
      this.setData({ guideStep: 2, showOpGuide: false, _opGuideAfter: '' })
    } else {
      this.setData({ showOpGuide: false, _opGuideAfter: '' })
    }
  },

  // ---- 拓展菜单 ----
  // 报表 canvas 是原生组件，全屏遮罩期间用 wx:if 移除以避免穿透；遮罩关闭后在此重绘
  }
}

module.exports = createMethods
