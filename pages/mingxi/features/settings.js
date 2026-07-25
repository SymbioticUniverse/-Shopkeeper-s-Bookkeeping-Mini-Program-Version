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
  _syncCompanyDisplayData() {
    const saved = api.getCompanyInfo()
    const ledgerRole = saved && saved.companyRole ? saved.companyRole : 'personal'
    const companyStatus = saved && saved.companyStatus ? saved.companyStatus : ''
    this.setData({
      settingsLedgerRole: ledgerRole,
      settingsCompanyStatus: companyStatus,
      companyName: (saved && saved.companyName) || '',
      companyBossTitle: (saved && saved.companyBossTitle) || '',
    })
  },

  onSettingsEntry() {
    playTap()
    const saved = api.getCompanyInfo()
    const ledgerRole = saved && saved.companyRole ? saved.companyRole : 'personal'
    const companyStatus = saved && saved.companyStatus ? saved.companyStatus : ''
    const userInfo = api.getUserInfo()
    const phoneNumber = userInfo && userInfo.phone ? userInfo.phone : ''
    const lang = api.getSetting('appLanguage') || 'zh-CN'
    const langLabel = getLangLabel(lang)
    const darkMode = api.getSetting('appDarkMode') || 'system'
    const darkLabels = { system: this.data.t.dark_system || '跟随系统', light: this.data.t.dark_light || '浅色模式', dark: this.data.t.dark_dark || '深色模式' }
    const darkLabel = darkLabels[darkMode] || '跟随系统'
    const storageInfo = wx.getStorageInfoSync()
    const cacheSize = (storageInfo.currentSize / 1024).toFixed(1) + 'MB'
    this._applyLanguage(lang)
    this.setData({ showSettingsPage: true, settingsLedgerRole: ledgerRole, settingsCompanyStatus: companyStatus, settingsPhone: phoneNumber, settingsLanguage: lang, settingsLanguageLabel: langLabel, settingsDarkMode: darkMode, settingsDarkModeLabel: darkLabel, cacheSize })
    // 打开设置页时刷新公司加密状态（员工可能拿到 boss 新开启的公钥）
    if (ledgerRole !== 'personal') this._syncCompanyKeys()
  },

  onSettingsBack() {
    playTap()
    this.setData({ showSettingsPage: false })
  },

  onTapVolumeChange(e) {
    playTap()
    const pct = e.detail.value
    setVolume(pct / 100)
    this.setData({ tapVolumePercent: pct })
  },

  onTapVibrationChange(e) {
    playTap()
    const level = e.detail.value
    wx.setStorageSync('tapVibration', level)
    this.setData({ tapVibrationLevel: level, tapVibrationLabel: this.data._vibrationLabels[level] })
  },

  onPrivacyBack() {
    playTap()
    this.setData({ showPrivacyPage: false })
  },

  onPrivacyToggle(e) {
    playTap()
    const { key } = e.currentTarget.dataset
    const field = key === 'allowAnalytics' ? 'privacyAllowAnalytics' : 'privacyAllowCrashReport'
    const val = !this.data[field]
    this.setData({ [field]: val })
    api.saveSetting(`privacy_${key}`, val)
    wx.showToast({ title: val ? '已开启' : '已关闭', icon: 'success' })
  },

  onPrivacyClearData() {
    playTap()
    wx.showModal({
      title: '清除数据',
      content: '此操作将清除所有本地记录，包括账目、分类、设置等。数据不可恢复，确定继续吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync()
          this.setData({ showPrivacyPage: false, isLoggedIn: false, userInfo: null })
          wx.showToast({ title: '数据已清除', icon: 'success' })
        }
      }
    })
  },

  onPrivacyExportData() {
    playTap()
    wx.showToast({ title: '数据导出功能开发中', icon: 'none' })
  },

  onPrivacyPolicyView() {
    playTap()
    this.setData({ showPrivacyPolicyPage: true })
  },

  onPrivacyPolicyBack() {
    playTap()
    this.setData({ showPrivacyPolicyPage: false })
  },

  onAboutBack() {
    playTap()
    this.setData({ showAboutPage: false })
  },

  async _recoverOrphanCompanyItems() {
    wx.showLoading({ title: '检查旧账中...' })
    let result
    try {
      result = await api.getOrphanCompanyItems()
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: (e && e.message) || '旧账检查失败', icon: 'none' })
      return
    }
    wx.hideLoading()

    const items = (result && result.items) || []
    const claimable = items.filter(item => item.claimable)
    const blockedCount = Number(result && result.blockedCount) || 0
    if (items.length === 0) {
      wx.showToast({ title: '没有待恢复的旧账', icon: 'success' })
      return
    }
    if (claimable.length === 0) {
      wx.showModal({
        title: '旧账无法自动恢复',
        content: '发现的旧账已通过关联账目确认属于其他公司，未做任何修改。',
        showCancel: false
      })
      return
    }

    const companyInfo = api.getCompanyInfo() || {}
    const companyName = companyInfo.companyName || result.companyUid || '当前公司'
    const blockedText = blockedCount > 0
      ? `\n另有 ${blockedCount} 笔已确认属于其他公司，将保持隔离。`
      : ''
    wx.showModal({
      title: `恢复 ${claimable.length} 笔旧账`,
      content: `这些账目由您创建，但缺少公司归属。仅当它们确实属于“${companyName}”时才可认领；认领后公司管理员可以读取。${blockedText}`,
      confirmText: '确认认领',
      confirmColor: '#07c160',
      success: async (modalResult) => {
        if (!modalResult.confirm) return
        wx.showLoading({ title: '恢复中...' })
        let recoveredCount = 0
        try {
          const ids = claimable.map(item => item.id)
          for (let start = 0; start < ids.length; start += 500) {
            const recovered = await api.claimOrphanCompanyItems(
              ids.slice(start, start + 500),
              result.companyUid || (api.getCompanyInfo() || {}).companyUid
            )
            recoveredCount += Number(recovered && recovered.recovered) || 0
          }
          await api.refreshItems()
          this.initDetailItems()
          this.initSettleItems()
          this.updateReportDate()
          wx.hideLoading()
          wx.showToast({
            title: `已恢复 ${recoveredCount || claimable.length} 笔`,
            icon: 'success'
          })
        } catch (e) {
          if (recoveredCount > 0) {
            try {
              await api.refreshItems()
              this.initDetailItems()
              this.initSettleItems()
              this.updateReportDate()
            } catch (_) { console.warn('[恢复] 刷新失败', _) }
          }
          wx.hideLoading()
          wx.showToast({
            title: recoveredCount > 0
              ? `已恢复 ${recoveredCount} 笔，其余请重试`
              : ((e && e.message) || '恢复失败，请重试'),
            icon: 'none'
          })
        }
      }
    })
  },

  onSettingsTap(e) {
    playTap()
    const { action } = e.currentTarget.dataset
    switch (action) {
      case 'language':
        wx.showActionSheet({
          itemList: ['简体中文', '繁體中文', '日本語', 'English'],
          success: (res) => {
            const langMap = { 0: 'zh-CN', 1: 'zh-TW', 2: 'ja-JP', 3: 'en-US' }
            const code = langMap[res.tapIndex]
            api.saveSetting('appLanguage', code)
            this._applyLanguage(code)
            this.setData({ settingsLanguage: code })
            wx.showToast({ title: getTLang(code).toast_lang_changed, icon: 'success' })
          }
        })
        break
      case 'darkMode':
        wx.showActionSheet({
          itemList: [this.data.t.dark_system, this.data.t.dark_light, this.data.t.dark_dark],
          success: (res) => {
            const modeMap = { 0: 'system', 1: 'light', 2: 'dark' }
            const labelMap = { 0: this.data.t.dark_system, 1: this.data.t.dark_light, 2: this.data.t.dark_dark }
            const mode = modeMap[res.tapIndex]
            api.saveSetting('appDarkMode', mode)
            const dark = mode === 'dark' || (mode === 'system' && wx.getSystemInfoSync().theme === 'dark')
            this.setData({ settingsDarkMode: mode, settingsDarkModeLabel: labelMap[res.tapIndex], isDarkMode: dark })
          }
        })
        break
      case 'privacy':
        this.setData({
          showPrivacyPage: true,
          privacyAllowAnalytics: api.getSetting('privacy_allowAnalytics') !== false,
          privacyAllowCrashReport: api.getSetting('privacy_allowCrashReport') !== false
        })
        break
      case 'security':
        // 非 VIP 用户点击加密入口 → 引导升级
        this.setData({ showSettingsPage: false, showVipPage: true })
        break
      case 'recoverCompanyItems':
        this._recoverOrphanCompanyItems()
        break
      case 'registerOrJoin':
        if (!this.data.isLoggedIn) {
          wx.showModal({
            title: '提示',
            content: '请先注册并登录，再加入公司',
            confirmText: '去注册',
            success: (res) => {
              if (res.confirm) {
                this.setData({ showSettingsPage: false })
                // 回到我的页面，用户可看到登录/注册入口
              }
            }
          })
        } else {
          this.setData({ showSettingsPage: false, showCompanyShare: true, companyShareStep: 0, companyRole: 'employee', employeeUid: '' })
        }
        break
      case 'rechooseCompany':
        wx.showModal({
          title: '重新选择公司',
          content: '将清除当前公司绑定并重新选择，确定继续吗？',
          success: async (res) => {
            if (res.confirm) {
              wx.showLoading({ title: '处理中...' })
              try {
                await api.removeCompanyInfo()
                this._syncCompanyDisplayData()
                this._syncOverviewCards()
                this.initDetailItems()
                this.initSettleItems()
                this.setData({ showSettingsPage: false, showCompanyShare: true, companyShareStep: 1, companyRole: 'employee', employeeUid: '' })
                wx.showToast({ title: '请重新选择公司', icon: 'none' })
              } catch (e) {
                wx.showToast({ title: '退出公司失败，请重试', icon: 'none' })
              } finally {
                wx.hideLoading()
              }
            }
          }
        })
        break
      case 'dissolveCompany':
        wx.showModal({
          title: '解散公司',
          content: '解散后所有员工将无法查看公司账本，此操作不可撤销，确定解散吗？',
          success: async (res) => {
            if (res.confirm) {
              wx.showLoading({ title: '解散中...' })
              try {
                await api.removeCompanyInfo()
                api.removeAuditList()
                this._syncCompanyDisplayData()
                this._syncOverviewCards()
                this.initDetailItems()
                this.initSettleItems()
                this.setData({ settingsLedgerRole: 'personal', showSettingsPage: false, hasPendingAudit: false })
                wx.showToast({ title: '公司已解散', icon: 'success' })
              } catch (e) {
                wx.showToast({ title: '解散失败，请重试', icon: 'none' })
              } finally {
                wx.hideLoading()
              }
            }
          }
        })
        break
      case 'clearCache': {
        const info = wx.getStorageInfoSync()
        const sizeMB = (info.currentSize / 1024).toFixed(1)
        wx.showModal({
          title: '清除缓存',
          content: `当前缓存 ${sizeMB}MB，将清除所有本地账目记录和临时数据（保留语言、深色模式、登录状态等设置）。确定清除吗？`,
          confirmText: '清除',
          success: (res) => {
            if (res.confirm) {
              // 保留的关键数据
              const lang = api.getSetting('appLanguage')
              const darkMode = api.getSetting('appDarkMode')
              const userInfo = api.getUserInfo()
              const companyInfo = api.getCompanyInfo()
              const privacyAnalytics = api.getSetting('privacy_allowAnalytics')
              const privacyCrash = api.getSetting('privacy_allowCrashReport')
              const authToken = wx.getStorageSync('authToken')
              const refreshToken = wx.getStorageSync('refreshToken')
              const companyPriv = wx.getStorageSync('e2e_company_private_key')
              const companyPub = wx.getStorageSync('e2e_company_public_key')
              const companyKeyId = wx.getStorageSync('e2e_company_key_id')
              const vipStatus = wx.getStorageSync('vipStatus')
              wx.clearStorageSync()
              // 先恢复身份与企业加密密钥，再触发任何后台设置同步。
              if (authToken) wx.setStorageSync('authToken', authToken)
              if (refreshToken) wx.setStorageSync('refreshToken', refreshToken)
              if (companyPriv) wx.setStorageSync('e2e_company_private_key', companyPriv)
              if (companyPub) wx.setStorageSync('e2e_company_public_key', companyPub)
              if (companyKeyId) wx.setStorageSync('e2e_company_key_id', companyKeyId)
              if (vipStatus) wx.setStorageSync('vipStatus', vipStatus)

              // 恢复普通设置
              if (lang) api.saveSetting('appLanguage', lang)
              if (darkMode) api.saveSetting('appDarkMode', darkMode)
              if (userInfo) api.saveUserInfo(userInfo)
              if (companyInfo) api.cacheCompanyInfo(companyInfo)
              if (privacyAnalytics !== undefined) api.saveSetting('privacy_allowAnalytics', privacyAnalytics)
              if (privacyCrash !== undefined) api.saveSetting('privacy_allowCrashReport', privacyCrash)
              wx.showToast({ title: '缓存已清除', icon: 'success' })
              // 刷新页面数据
              this.initDetailItems()
              this.initSettleItems()
              this.updateReportDate()
            }
          }
        })
        break
      }
      case 'about':
        this.setData({ showAboutPage: true })
        break
      case 'deactivateLedger': {
        const role = this.data.settingsLedgerRole
        const isBoss = role === 'boss'
        const isEmployee = role === 'employee'
        wx.showModal({
          title: '注销账本',
          content: isBoss
            ? '将清除公司密钥、登录状态和所有本地数据。公司将被解散。\n\n适用于：重置公司账本等场景。\n\n此操作不可撤销，确定继续吗？'
            : '将清除登录状态和本地个人数据。' + (isEmployee ? '公司关系保留。' : '') + '\n\n适用于：重置个人账本等场景。\n\n此操作不可撤销，确定继续吗？',
          confirmText: '确定注销',
          confirmColor: '#fa5151',
          success: async (res) => {
            if (res.confirm) {
              wx.showLoading({ title: '注销中...' })
              let deactivateResult
              try {
                // 后端单事务完成个人账单、联动镜像、公司和密钥标记清理。
                deactivateResult = await api.deactivateLedger()
              } catch (e) {
                console.error('[deactivateLedger] 服务端清理失败:', e)
                wx.hideLoading()
                wx.showToast({ title: '服务端清理失败，未注销账本', icon: 'none' })
                return
              }
              const companyWasDissolved = !!(deactivateResult && deactivateResult.companyDissolved)
              const retainCompany = !!(deactivateResult && deactivateResult.companyRetained)
              // 3. 清空企业加密密钥（仅公司解散时）
              if (companyWasDissolved) { try { require('../../../utils/crypto.js').clearCompanyKeys() } catch (_) {} }
              // 4. 保留用户设置 + 公司信息（员工保公司关系）
              const lang = api.getSetting('appLanguage')
              const darkMode = api.getSetting('appDarkMode')
              const privacyAnalytics = api.getSetting('privacy_allowAnalytics')
              const privacyCrash = api.getSetting('privacy_allowCrashReport')
              const companyInfo = retainCompany ? api.getCompanyInfo() : null
              // 5. 全量清除
              wx.clearStorageSync()
              // 6. 恢复
              if (lang) api.saveSetting('appLanguage', lang)
              if (darkMode) api.saveSetting('appDarkMode', darkMode)
              if (privacyAnalytics !== undefined) api.saveSetting('privacy_allowAnalytics', privacyAnalytics)
              if (privacyCrash !== undefined) api.saveSetting('privacy_allowCrashReport', privacyCrash)
              if (companyInfo) api.cacheCompanyInfo(companyInfo)
              // 7. 重置页面状态
              this.setData({
                isLoggedIn: false,
                userInfo: null,
                showSettingsPage: false,
                showGuide: true,
                guideStep: 0,
                settingsLedgerRole: retainCompany ? 'employee' : 'personal',
                encryptionCompanyIsBoss: false,
                encryptionCompanyKeyReady: false,
                hasPendingAudit: false
              })
              this.initDetailItems()
              wx.hideLoading()
              wx.showToast({ title: '账本已注销', icon: 'success' })
            }
          }
        })
        break
      }
      case 'deleteAccount':
        wx.showModal({
          title: '注销账号',
          content: '将永久删除此账号下的所有数据（账目、分类、公司、密钥等），不可恢复。\n\n确定注销账号吗？',
          confirmText: '确定注销',
          confirmColor: '#fa5151',
          success: (res) => {
            if (res.confirm) {
              wx.showLoading({ title: '注销中...' })
              api.deleteAccount().then(() => {
                wx.hideLoading()
                this.setData({ isLoggedIn: false, userInfo: null, showSettingsPage: false, showGuide: true, guideStep: 0 })
                wx.showToast({ title: '账号已注销', icon: 'success' })
              }).catch(() => {
                wx.hideLoading()
                wx.showToast({ title: '注销失败，请重试', icon: 'none' })
              })
            }
          }
        })
        break
      case 'logout':
        wx.showModal({
          title: '退出登录',
          content: '确定要退出当前账号吗？',
          success: async (res) => {
            if (res.confirm) {
              wx.showLoading({ title: '退出中...' })
              try {
                await api.logout()
                wx.removeStorageSync('guideCompleted')
                this.setData({ isLoggedIn: false, userInfo: null, showSettingsPage: false, showGuide: true, guideStep: 0 })
                wx.showToast({ title: '已退出登录', icon: 'success' })
              } catch (e) {
                wx.showToast({ title: '退出失败，请重试', icon: 'none' })
              } finally {
                wx.hideLoading()
              }
            }
          }
        })
        break
    }
  },

  onExportPeriodTap(e) {
    playTap()
    const period = parseInt(e.currentTarget.dataset.period)
    this.setData({ exportPeriod: period, exportDateText: this._exportDateTextFor(period) })
  },

  // 按当前周期与已选时间，生成导出页时间选择器的显示文案
  _exportDateTextFor(period) {
    if (period === 1) {
      const y = this.data.exportSelectedYear
      const q = this.data.quarterOptions[(this.data.exportQuarterMultiIndex || [0, 0])[1]] || '1季度'
      return `${y}年${q}`
    }
    const [y, m, d] = (this.data.exportPickerDate || '').split('-')
    if (period === 0) return `${y}年${m || '01'}月`
    if (period === 2) return `${y}年`
    return `${y}年${m || '01'}月${d || '01'}日`
  },

  onExportFormatChange(e) {
    playTap()
    this.setData({ exportFormatIndex: parseInt(e.detail.value) })
  },

  onExportPickerChange(e) {
    playTap()
    const val = e.detail.value
    const { exportPeriod } = this.data
    if (exportPeriod === 0) {
      const [y, m] = val.split('-')
      this.setData({ exportPickerDate: val, exportDateText: `${y}年${m}月` })
    } else if (exportPeriod === 2) {
      this.setData({ exportPickerDate: val, exportDateText: `${val}年` })
    } else if (exportPeriod === 3) {
      const [y, m, d] = val.split('-')
      this.setData({ exportPickerDate: val, exportDateText: `${y}年${m}月${d}日` })
    }
  },

  // 季度多列：列变更只记年份
  onExportQuarterColumnChange(e) {
    playTap()
    const { column, value } = e.detail
    if (column === 0) {
      const year = this.data.reportQuarterRange[0][value]
      this.setData({ exportSelectedYear: parseInt(year) })
    }
  },

  // 季度多列：确认
  onExportQuarterChange(e) {
    playTap()
    let [yearIdx, quarterIdx] = e.detail.value
    const year = this.data.reportQuarterRange[0][yearIdx]
    const now = new Date()
    if (parseInt(year) === now.getFullYear()) {
      const curQ = Math.floor(now.getMonth() / 3)
      if (quarterIdx > curQ) { quarterIdx = curQ; wx.showToast({ title: '不能选择未来季度', icon: 'none' }) }
    }
    const quarter = this.data.quarterOptions[quarterIdx]
    this.setData({
      exportQuarterMultiIndex: [yearIdx, quarterIdx],
      exportSelectedYear: parseInt(year),
      exportDateText: `${year}年${quarter}`,
    })
  },

  onExportPersonalToggle(e) {
    playTap()
    const { key } = e.currentTarget.dataset
    const items = this.data.exportPersonalItems.map(item =>
      item.key === key ? { ...item, checked: !item.checked } : item
    )
    const all = items.every(i => i.checked)
    this.setData({ exportPersonalItems: items, exportPersonalAll: all })
  },

  onExportCompanyToggle(e) {
    playTap()
    const { key } = e.currentTarget.dataset
    const items = this.data.exportCompanyItems.map(item =>
      item.key === key ? { ...item, checked: !item.checked } : item
    )
    const all = items.every(i => i.checked)
    this.setData({ exportCompanyItems: items, exportCompanyAll: all })
  },

  onExportPersonalAllToggle() {
    playTap()
    const all = !this.data.exportPersonalAll
    const items = this.data.exportPersonalItems.map(item => ({ ...item, checked: all }))
    this.setData({ exportPersonalAll: all, exportPersonalItems: items })
  },

  onExportCompanyAllToggle() {
    playTap()
    const all = !this.data.exportCompanyAll
    const items = this.data.exportCompanyItems.map(item => ({ ...item, checked: all }))
    this.setData({ exportCompanyAll: all, exportCompanyItems: items })
  },

  onCompanyShareEntry() {
    playTap()
    this._onSpotlightAction()
    const saved = api.getCompanyInfo()
    if (saved) {
      this.setData({
        showCompanyShare: true,
        companyShareStep: 2,
        companyRole: saved.companyRole || 'boss',
        companyUid: saved.companyUid || '',
        companyName: saved.companyName || '',
        companyBossTitle: saved.companyBossTitle || '',
      })
    } else {
      this.setData({ showCompanyShare: true, companyShareStep: 0 })
    }
  },

  onCompanyShareBack() {
    playTap()
    const step = this.data.companyShareStep
    if (step === 2) {
      this._syncCompanyDisplayData()
      this.setData({ showCompanyShare: false })
    } else if (step === 1) {
      this.setData({ companyShareStep: 0 })
    } else {
      this._syncCompanyDisplayData()
      this.setData({ showCompanyShare: false })
    }
  },

  onBossTap() {
    playTap()
    this.setData({ companyShareStep: 1, companyRole: 'boss', companyUid: '', companyName: '', companyBossTitle: '' })
    this._onSpotlightAction()
  },

  onEmployeeTap() {
    playTap()
    this.setData({ companyShareStep: 1, companyRole: 'employee', employeeUid: '' })
    this._onSpotlightAction()
  },

  onEmployeeUidInput(e) {
    this.setData({ employeeUid: e.detail.value })
  },

  onEmployeeJoin() {
    playTap()
    const { employeeUid } = this.data
    if (!employeeUid.trim()) {
      wx.showToast({ title: '请输入公司 UID 码', icon: 'none' })
      return
    }
    const info = { companyUid: employeeUid.trim(), companyRole: 'employee', companyStatus: 'pending' }
    var that = this
    api.joinCompany(info).then(() => {
      wx.showToast({ title: '已提交申请，等待审核', icon: 'success' })
      that.setData({ companyShareStep: 2 })
      that._syncCompanyKeys()
    }).catch(err => {
      wx.showToast({ title: (err && err.error) || '加入失败，请检查 UID', icon: 'none' })
    })
  },

  onCompanyNameInput(e) {
    this.setData({ companyName: e.detail.value })
  },

  onCompanyBossTitleInput(e) {
    this.setData({ companyBossTitle: e.detail.value })
  },

  onCreateUid() {
    playTap()
    const uid = 'UID' + Date.now().toString(36).toUpperCase().slice(-8)
    this.setData({ companyUid: uid })
  },

  async onCompanyCreate() {
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
      this._syncOverviewCards()
      wx.showToast({ title: '创建成功', icon: 'success' })
      this.setData({ companyShareStep: 2, companyName: info.companyName, companyBossTitle: info.companyBossTitle, companyUid: info.companyUid })
    } catch (e) {
      wx.showToast({ title: (e && e.error) || '创建失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onShareCompany() {
    playTap()
    // 占位实现：先做「一键复制 UID」，完整分享功能后续再做
    const uid = this.data.companyUid || ((api.getCompanyInfo() || {}).companyUid) || ''
    if (!uid) {
      wx.showToast({ title: '暂无公司 UID', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: uid,
      success: () => wx.showToast({ title: 'UID 已复制，发给同事即可加入', icon: 'none' }),
      fail: () => wx.showToast({ title: '复制失败', icon: 'none' })
    })
  },

  /** 员工点击刷新加密状态 */
  onRefreshCompanyEncryption() {
    var that = this
    wx.showLoading({ title: '刷新中...' })
    this._syncCompanyKeys().then(function () {
      wx.hideLoading()
      if (that.data.encryptionCompanyKeyReady) {
        wx.showToast({ title: '企业加密已就绪', icon: 'success' })
      } else {
        wx.showToast({ title: '暂未开启，请稍后再试', icon: 'none' })
      }
    }).catch(function () {
      wx.hideLoading()
      wx.showToast({ title: '刷新失败', icon: 'none' })
    })
  },

  /** 老板主动开启企业加密 */
  onEnableCompanyEncryption() {
    var that = this
    wx.showModal({
      title: '开启企业端到端加密',
      content: '将生成 secp256k1 密钥对，公司账单在传输和存储时全程加密，仅持有私钥的设备可解密。\n\n开启后将生成 28 位恢复密钥，请务必妥善保存。',
      confirmText: '立即开启',
      success: function (res) {
        if (res.confirm) {
          wx.showLoading({ title: '生成密钥中...' })
          that._setupBossCompanyKeys().then(function () {
            wx.hideLoading()
          }).catch(function (e) {
            wx.hideLoading()
            wx.showToast({ title: (e && e.message) || '密钥生成失败', icon: 'none' })
          })
        }
      }
    })
  },

  /** 换设备恢复公司私钥 */
  onRecoverCompanyKeys() {
    var that = this
    wx.showModal({
      title: '恢复公司密钥',
      content: '请输入 28 位公司恢复密钥',
      editable: true,
      placeholderText: '输入恢复密钥',
      confirmText: '恢复',
      success: function (res) {
        if (res.confirm && res.content) {
          var key = res.content.trim()
          if (key.length < 20) {
            wx.showToast({ title: '恢复密钥格式不正确', icon: 'none' })
            return
          }
          wx.showLoading({ title: '恢复中...' })
          that._recoverCompanyKeys(key).then(function () {
            wx.hideLoading()
          }).catch(function (e) {
            wx.hideLoading()
            wx.showToast({ title: (e && e.message) || '恢复失败', icon: 'none' })
          })
        }
      }
    })
  },

  _showCompanyEncryptionInfo() {
    wx.showModal({
      title: '企业数据加密',
      content: '企业版专属功能。创建或加入公司后，公司账本数据将通过 secp256k1 ECIES 端到端加密保护。\n\n个人账单数据通过 HTTPS 明文传输，不加密存储。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  }
}

module.exports = createMethods
