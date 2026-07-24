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
  async onLoad() {
    // 首次启动引导检测
    if (wx.getStorageSync('tapVolume') === '') wx.setStorageSync('tapVolume', 1)
    if (wx.getStorageSync('tapVibration') === '') wx.setStorageSync('tapVibration', 1)
    if (!wx.getStorageSync('guideCompleted')) {
      this.setData({ showGuide: true, guideStep: 0 })
    }
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    const mm = m < 10 ? '0' + m : String(m)
    const years = []
    for (let i = 2020; i <= y; i++) years.push(String(i)) // 只到当前年，季度选择器不出现未来年份
    const yearIdx = years.indexOf(String(y))
    this.setData({
      reportPickerDate: `${y}-${mm}`,
      reportQuarterIndex: Math.floor((m - 1) / 3),
      'reportQuarterRange[0]': years,
      reportQuarterMultiIndex: [yearIdx, Math.floor((m - 1) / 3)],
      reportSelectedYear: y,
      detailQuarterMultiIndex: [yearIdx, Math.floor((m - 1) / 3)],
      detailSelectedYear: y,
      exportPickerDate: `${y}-${mm}`,
      exportDateText: `${y}年${mm}月`,
      exportQuarterMultiIndex: [yearIdx, Math.floor((m - 1) / 3)],
      exportSelectedYear: y,
    })
    // 初始化多语言
    const lang = api.getSetting('appLanguage') || 'zh-CN'
    this._applyLanguage(lang)
    // 初始化深色模式
    const darkMode = api.getSetting('appDarkMode') || 'system'
    let isDark = false
    if (darkMode === 'system') {
      isDark = (wx.getSystemInfoSync().theme === 'dark')
    } else {
      isDark = (darkMode === 'dark')
    }
    this.setData({ isDarkMode: isDark })
    this._initTabletScale()
    const savedUser = api.getUserInfo()
    const hasProfile = savedUser && savedUser.nickName && savedUser.nickName !== '新用户' && savedUser.avatarUrl
    if (savedUser) {
      this.setData({ isLoggedIn: true, userInfo: savedUser })
      this._refreshAvatarDisplay(savedUser)
    }

    // 引导检测
    if (!wx.getStorageSync('guideCompleted')) {
      // 未完成引导 → 从头开始
      this.setData({ showGuide: true, guideStep: 0 })
    } else if (savedUser && !hasProfile) {
      // 已登录但资料不完整 → 强制操作引导
      wx.removeStorageSync('guideCompleted')
      this.setData({ _isNewUser: true, showGuide: false })
      this._startSpotlight('tutorial')
    }

    // E2E 加密初始化：检测本地密钥状态 + 尝试从服务端恢复
    await this._initCrypto()

    // 同步公司显示数据到「我的」页
    this._syncCompanyDisplayData()

    api.migrate()
    const savedPCats = api.getCategories('personal')
    const savedCCats = api.getCategories('company')
    if (savedPCats && savedPCats.length) this.setData({ personalCategories: savedPCats })
    if (savedCCats && savedCCats.length) this.setData({ companyCategories: savedCCats })
    this.updateReportDate()
    this.updateDetailDate()
    this._updateReportSummary()
    this.initDetailItems()
    this.initSettleItems()
    this._syncOverviewCards()
    this.updateNotifyBadge()
    if (!api.getSetting('auditCleaned')) {
      api.removeAuditList()
      api.saveSetting('auditCleaned', true)
    }
    this.updateAuditBadge()
    this._throttledSync()
  },


  _initTabletScale() {
    const info = wx.getSystemInfoSync()
    const tw = info.windowWidth
    if (tw < 600) return
    this.setData({ isTablet: true })
  },

  onShow() {
    this._syncCompanyDisplayData()
    this._proactiveRefresh()
    this._throttledSync()
    if (this.data.isLoggedIn && !this._recordAuthRequested) {
      this._recordAuthRequested = true
      wx.authorize({ scope: 'scope.record' }).catch(() => {})
    }
    // 记账 tab 按钮 → 打开记账弹窗
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar()._bookTapHandler = () => {
        this.onBookEntry({ currentTarget: { dataset: { type: 'expense' } } })
      }
    }
  },

  // 页面恢复时主动续期 access token，避免 401 风暴
  _proactiveRefresh() {
    // 节流：10 分钟内只主动续一次
    var now = Date.now()
    if (now - (this._lastProactiveRefresh || 0) < 10 * 60 * 1000) return
    this._lastProactiveRefresh = now
    api.refreshAccessToken().catch(function () {})
  },

  // 进页面节流同步：以后端为准刷新本地缓存（30s 内最多一次）
  async _throttledSync() {
    if (this.data.showConflictPanel) return
    // 延迟刷新避免页面切换动画期间 setData 抢帧
    setTimeout(() => {
      this.initDetailItems()
      this.initSettleItems()
    }, 50)
    if (Date.now() - (this._lastSyncAt || 0) < 30000) return
    this._lastSyncAt = Date.now()
    try {
      var result = await api.syncFromCloud()
      if (result && result.hasConflicts) {
        this._handleSyncResult(result)
        return
      }
    } catch (e) {}
    this.initDetailItems()
    this.initSettleItems()
    const su = api.getUserInfo()
    if (su) this.setData({ userInfo: su })
    this._refreshAvatarDisplay(su)
    this._syncCompanyDisplayData()
    // 静默刷新 VIP 状态
    api.getVipStatus().then(function (s) { this.setData({ vipStatus: s, vipTrialDays: this._computeTrialDays(s), vipExpiresText: this._formatVipExpiry(s) }); this._checkEncryptionTierAlignment() }.bind(this)).catch(function () {})
    // 公司可见性可能因云端同步到的 companyInfo 改变 → 仅变化时重建简览卡（避免每次重绘图表）
    const ci = api.getCompanyInfo()
    const canSeeCompany = !!(ci && ci.companyRole === 'boss' && ci.companyUid)
    if (canSeeCompany !== this.data.canSeeCompanyLedger) {
      this._syncOverviewCards()
    } else {
      this._calcOverviewData()
    }
    if (this.data.showLedgerPage) {
      this.setData(this._ledgerData(this.data.ledgerScope))
    }
    this.updateNotifyBadge()
    this.updateAuditBadge()
  },

  // ---- 冲突解决面板 ----

  /** syncFromCloud 返回冲突时打开面板 */
  _handleSyncResult(result) {
    if (!result || !result.conflicts || !result.conflicts.length) return
    this.setData({
      showConflictPanel: true,
      conflicts: result.conflicts,
      conflictIndex: 0
    })
  },

  /** 用户对单个冲突做出裁决（保留本地/云端） */
  onConflictResolve(e) {
    playTap()
    var ds = e.currentTarget.dataset
    var id = ds.id
    var resolution = ds.resolution
    var conflicts = this.data.conflicts.slice()
    for (var i = 0; i < conflicts.length; i++) {
      if (conflicts[i].id === id) {
        conflicts[i].resolution = resolution
        break
      }
    }
    this.setData({ conflicts: conflicts })
  },

  /** 上一个冲突 */
  onConflictPrev() {
    playTap()
    if (this.data.conflictIndex <= 0) return
    this.setData({ conflictIndex: this.data.conflictIndex - 1 })
  },

  /** 下一个冲突 */
  onConflictNext() {
    playTap()
    if (this.data.conflictIndex >= this.data.conflicts.length - 1) return
    this.setData({ conflictIndex: this.data.conflictIndex + 1 })
  },

  /** 应用所有裁决，完成同步 */
  async onConflictDismiss() {
    var conflicts = this.data.conflicts
    // 检查是否全部已裁决
    var unresolved = conflicts.filter(function (c) { return !c.resolution })
    if (unresolved.length > 0) {
      wx.showToast({ title: '请为所有冲突选择保留版本', icon: 'none' })
      return
    }
    this.setData({ conflictResolving: true })
    try {
      var resolutions = conflicts.map(function (c) {
        return {
          id: c.id,
          scope: c.scope,
          resolution: c.resolution,
          resolvedItem: c.resolution === 'server' || c.resolution === 'server_voided_accept'
            ? c.serverVersion
            : c.localVersion
        }
      })
      await api.resolveConflicts(resolutions)
      wx.showToast({ title: '冲突已解决', icon: 'success' })
      this.setData({
        showConflictPanel: false,
        conflicts: [],
        conflictIndex: 0,
        conflictResolving: false
      })
      // 刷新数据
      this.initDetailItems()
      this.initSettleItems()
      this._syncOverviewCards()
    } catch (e) {
      this.setData({ conflictResolving: false })
      wx.showToast({ title: '同步失败，请重试', icon: 'none' })
    }
  },

  // ---- 资料设置（昵称/头像）+ 头像显示 ----
  // /voucher 私有头像需带 token 下成本地路径，<image> 才能渲染（裸 URL 会 401）
  async _refreshAvatarDisplay(userInfo) {
    const u = userInfo || this.data.userInfo
    if (!u || !u.avatarUrl) {
      this.setData({ avatarDisplay: '' })
      return
    }
    if (/^https?:\/\//.test(u.avatarUrl)) {
      try {
        const p = await api.downloadAuthedImage(u.avatarUrl)
        this.setData({ avatarDisplay: p })
      } catch (e) {
        this.setData({ avatarDisplay: '' })
      }
    } else {
      this.setData({ avatarDisplay: u.avatarUrl })
    }
  },

  onProfileNameInput(e) {
    this.setData({ profileName: e.detail.value })
  },

  onChooseAvatar() {
    playTap()
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const f = res.tempFiles && res.tempFiles[0]
        const raw = f && f.tempFilePath
        if (!raw) {
          wx.showToast({ title: '未选到图片', icon: 'none' })
          return
        }
        if (!/\.(jpe?g|png)$/i.test(raw)) {
          wx.showToast({ title: '仅支持 jpg/png 图片', icon: 'none' })
          return
        }
        // 头像压成小图：减小上传体积、降渲染内存。compressImage 在某些环境偶发不回调，
        // 加 3s 超时兜底，超时则改用原图，避免卡住后续流程
        let done = false
        const proceed = (p) => {
          if (done) return
          done = true
          this._uploadAvatar(p)
        }
        const timer = setTimeout(() => proceed(raw), 3000)
        wx.compressImage({
          src: raw,
          quality: 80,
          compressedWidth: 400,
          success: (c) => { clearTimeout(timer); proceed(c.tempFilePath) },
          fail: () => { clearTimeout(timer); proceed(raw) }
        })
      },
      fail: (err) => {
        // 用户主动取消不提示
        if (err && /cancel/i.test(err.errMsg || '')) return
        wx.showToast({ title: '选择图片失败', icon: 'none' })
      }
    })
  },

  // 上传头像小图：预览用本地小图，成功后存 URL
  _uploadAvatar(local) {
    this.setData({ profileAvatarLocal: local, profileUploading: true })
    wx.showLoading({ title: '上传中…', mask: true })
    api.uploadVoucher(local, 'avatar').then((url) => {
      this.setData({ profileAvatarUrl: url, profileUploading: false })
      wx.hideLoading()
      wx.showToast({ title: '头像已上传', icon: 'success' })
    }).catch((e) => {
      this.setData({ profileUploading: false, profileAvatarLocal: '' })
      wx.hideLoading()
      wx.showToast({ title: (e && e.error) || '头像上传失败', icon: 'none' })
    })
  },

  onMyAvatarTap() {
    playTap()
    const cur = this.data.userInfo || {}
    this._profileOpenAt = Date.now()
    this.setData({
      showProfileModal: true,
      profileEditMode: true,
      profileName: cur.nickName || '',
      profileAvatarLocal: this.data.avatarDisplay || '',
      profileAvatarUrl: ''
    })
  },

  onProfileSave() {
    playTap()
    if (this.data.profileUploading) {
      wx.showToast({ title: '头像上传中…', icon: 'none' })
      return
    }
    const isGuide = !this.data.profileEditMode
    const name = (this.data.profileName || '').trim()
    const hasAvatar = this.data.profileAvatarLocal || this.data.profileAvatarUrl
    if (isGuide) {
      if (!name) {
        wx.showToast({ title: '请填写昵称', icon: 'none' })
        return
      }
      if (!hasAvatar) {
        wx.showToast({ title: '请上传头像', icon: 'none' })
        return
      }
    }
    const cur = this.data.userInfo || {}
    const next = {
      nickName: name || cur.nickName,
      avatarUrl: this.data.profileAvatarUrl || cur.avatarUrl || '',
      phone: cur.phone || '',
      updatedAt: cur.updatedAt  // 把服务端时间戳回传，避免 409 冲突
    }
    api.saveUserInfo(next)
    this.setData({
      userInfo: { ...cur, ...next },
      showProfileModal: false,
      avatarDisplay: this.data.profileAvatarLocal || this.data.avatarDisplay
    })
    this._syncOverviewCards(true)
    wx.showToast({ title: '已保存', icon: 'success' })
    if (isGuide) {
      this.setData({ showGuide: false })
      if (this.data._isNewUser && !this._tutorialDone) {
        setTimeout(() => this._startSpotlight('tutorial'), 300)
      } else if (this.data._isNewUser && this._tutorialDone) {
        // 新用户完成引导+教程+资料保存 → 弹隐私声明
        this.setData({ showPrivacyNotice: true })
      }
    }
  },

  onPrivacyNoticeConfirm() {
    if (this._privacyConfirming) return
    this._privacyConfirming = true
    playTap()
    this.setData({ showPrivacyNotice: false })
  },

  onProfileSkip() {
    playTap()
    if (!this.data.profileEditMode) return // 引导模式禁止跳过
    this.setData({ showProfileModal: false })
  },

  onProfileMaskTap() {
    playTap()
    if (!this.data.profileEditMode) return // 引导模式禁止点蒙层关闭
    // 拦截「打开弹窗的同一次点击」穿透到刚渲染的蒙层导致秒关
    if (Date.now() - (this._profileOpenAt || 0) < 350) return
    this.setData({ showProfileModal: false })
  },

  _applyLanguage(lang) {
    const t = getTLang(lang)
    const set = { t }
    // 更新 Tab 栏
    set['tabs[0].text'] = t.tab_detail
    set['tabs[1].text'] = t.tab_report
    set['tabs[2].text'] = t.tab_book
    set['tabs[3].text'] = t.tab_settle
    set['tabs[4].text'] = t.tab_my
    // 更新卡片标题
    set['cardSets[0][0].title'] = t.detail_personal_ledger
    set['cardSets[0][1].title'] = t.detail_company_ledger
    set['cardSets[1][0].title'] = t.report_title
    set['cardSets[2][0].title'] = t.book_income
    set['cardSets[2][1].title'] = t.book_expense
    set['cardSets[2][2].title'] = t.book_transfer
    set['cardSets[3][0].title'] = t.tab_settle
    set['cardSets[4][0].title'] = t.tab_my
    // 更新报表卡片标题
    set['reportCards[0].title'] = t.report_title
    set['reportCards[1].title'] = t.report_title
    set['reportCards[2].title'] = t.report_title
    set['reportCards[3].title'] = t.report_title
    set['reportCards[4].title'] = t.report_title
    set['reportCards[5].title'] = t.report_title
    // 更新报表周期标签
    set['reportPeriods[0]'] = t.detail_period_month
    set['reportPeriods[1]'] = t.detail_period_quarter
    set['reportPeriods[2]'] = t.detail_period_year
    set['reportPeriods[3]'] = t.detail_period_day
    // 季度选项
    set['quarterOptions[0]'] = t.report_quarter_q1
    set['quarterOptions[1]'] = t.report_quarter_q2
    set['quarterOptions[2]'] = t.report_quarter_q3
    set['quarterOptions[3]'] = t.report_quarter_q4
    set['reportQuarterRange[1][0]'] = t.report_quarter_q1
    set['reportQuarterRange[1][1]'] = t.report_quarter_q2
    set['reportQuarterRange[1][2]'] = t.report_quarter_q3
    set['reportQuarterRange[1][3]'] = t.report_quarter_q4
    // 语言标签
    set.settingsLanguageLabel = getLangLabel(lang)
    this.setData(set)
  },

  _syncOverviewCards(skipCharts) {
    const saved = api.getOverviewCards()
    const userInfo = this.data.userInfo
    const companyInfo = api.getCompanyInfo()
    // 仅 boss 且已注册公司可见公司账本卡；无公司 / 员工 → 隐藏
    const canSeeCompany = !!(companyInfo && companyInfo.companyRole === 'boss' && companyInfo.companyUid)
    this.setData({ canSeeCompanyLedger: canSeeCompany })
    const visible = (cards) => cards.filter(c => c.type !== 'overview_company' || canSeeCompany)
    const personalize = (card) => {
      if (card.type === 'overview_personal' && userInfo && userInfo.nickName) {
        card.name = userInfo.nickName + '本人账本'
      } else if (card.type === 'overview_company' && companyInfo && companyInfo.companyName) {
        card.name = companyInfo.companyName + '账本'
      }
      return card
    }
    if (saved && saved.length > 0) {
      const list = visible(saved)
      // boss 已注册公司但自定义卡里没有公司账本 → 补一张，确保公司账本可见
      if (canSeeCompany && !list.some(c => c.type === 'overview_company')) {
        list.push({ id: 'd_company', name: '公司账本', subtitle: '经营收支', span: 2, type: 'overview_company' })
      }
      const enriched = list.map(card => {
        const tpl = this.data.customTemplates.find(t => t.type === card.type)
        return personalize({ ...card, rows: tpl ? tpl.rows : [], hasAvatar: tpl ? tpl.hasAvatar : false, previewStyle: tpl ? tpl.previewStyle : 'overview' })
      })
      this.setData({ overviewCards: enriched, customCards: saved })
    } else {
      // 默认简览：boss 见 个人(1)+公司(2)；无公司/员工 见 个人(1)+个人明细(2)
      const baseCards = canSeeCompany
        ? this.data.defaultOverviewCards
        : [
            { id: 'd_personal', name: '个人账本', subtitle: '日常收支', span: 1, type: 'overview_personal' },
            { id: 'd_detail_personal', name: '个人流水明细', subtitle: '月度 · 季度 · 年度 · 日度', span: 2, type: 'detail_personal' },
          ]
      const enriched = baseCards.map(card => {
        const tpl = this.data.customTemplates.find(t => t.type === card.type)
        return personalize({ ...card, rows: tpl ? tpl.rows : [], hasAvatar: tpl ? tpl.hasAvatar : false, previewStyle: tpl ? tpl.previewStyle : 'overview' })
      })
      this.setData({ overviewCards: enriched, customCards: [] })
    }
    this._calcOverviewData()
    // skipCharts：资料弹窗保存等场景不重绘简览 canvas（真机重绘易崩溃重启）
    if (!skipCharts) setTimeout(() => this._initOverviewCharts(), 400)
  },

  _calcOverviewData() {
    const ym = this.data.overviewMonth || '' // 'YYYY-MM'，按所选月份过滤
    const inMonth = (it) => !ym || (typeof it.date === 'string' && it.date.slice(0, 7) === ym)
    const personalItems = api.getItems('personal').filter(inMonth)
    const companyItems = this.data.canSeeCompanyLedger ? api.getItems('company').filter(inMonth) : []
    const sum = (items, fn) => items.filter(fn).reduce((s, it) => s + parseFloat(it.amount || 0), 0)
    const fmt = (n) => {
      const abs = Math.abs(n)
      const sign = n < 0 ? -1 : 1
      if (abs >= 10000) return (sign * Math.floor(abs / 1000) / 10).toFixed(1) + 'W'
      if (abs >= 1000) return (sign * Math.floor(abs / 100) / 10).toFixed(1) + 'k'
      return n.toFixed(2)
    }

    const incomeOf = (arr) => sum(arr, it => it.typeLabel === '收入')
    const expenseOf = (arr) => sum(arr, it => it.typeLabel === '支出' || it.typeLabel === '垫付')   // 个人口径：垫付算支出
    const realExpenseOf = (arr) => sum(arr, it => it.typeLabel === '支出')                            // 公司总资金口径：只算真实支出
    const receivableOf = (arr) => sum(arr, it => it.typeLabel === '垫付' && it.settleStatus !== 'settled')
    const payableOf = (arr) => sum(arr, it => it.typeLabel === '应付' && it.settleStatus !== 'settled')

    // 个人：收入 / 支出(含垫付) / 结余
    const pIncome = incomeOf(personalItems)
    const pExpense = expenseOf(personalItems)
    const pBalance = pIncome - pExpense

    // 公司四项：总资金=收入−支出(只真实支出)；总负债=应付；净资产=总资金−应付；可支配=总资金−垫付−应付
    const cFunds = incomeOf(companyItems) - realExpenseOf(companyItems)   // 总资金（垫付/应付都不减）
    const cReceivable = receivableOf(companyItems)   // 未结清垫付 = 应收
    const cPayable = payableOf(companyItems)          // 未结清应付 = 总负债
    const cNet = cFunds - cPayable                    // 净资产 = 总资金 − 应付
    const cDisposable = cFunds - cReceivable - cPayable   // 可支配 = 总资金 − 垫付 − 应付

    const pSettle = personalItems.filter(it => (it.typeLabel === '垫付' || it.typeLabel === '应付') && it.settleStatus !== 'settled')
    const cSettle = companyItems.filter(it => (it.typeLabel === '垫付' || it.typeLabel === '应付') && it.settleStatus !== 'settled')

    const cards = this.data.overviewCards.map(card => {
      if (card.type === 'overview_personal') {
        return { ...card, rows: [
          { label: '预算', value: fmt(0), color: 'green' },
          { labels: ['收入', '支出', '结余'], values: [fmt(pIncome), fmt(pExpense), fmt(pBalance)], colors: ['green', 'red', pBalance >= 0 ? 'green' : 'red'], threeCol: true },
        ]}
      }
      if (card.type === 'overview_company') {
        return { ...card, rows: [
          { label: '总资金', value: fmt(cFunds), color: 'green' },
          { label: '总负债', value: fmt(cPayable), color: 'red' },
          { label: '净资产', value: fmt(cNet), color: cNet >= 0 ? 'green' : 'red' },
          { label: '可支配资产', value: fmt(cDisposable), color: cDisposable >= 0 ? 'green' : 'red' },
          { labels: ['应收', '应付'], values: [fmt(cReceivable), fmt(cPayable)], colors: ['green', 'red'], threeCol: true },
        ]}
      }
      if (card.type === 'jieqing_personal') {
        return { ...card, rows: [
          { label: '待结清笔数', value: String(pSettle.length), color: 'red' },
          { label: '待结清总额', value: fmt(sum(pSettle, () => true)), color: 'red' },
        ]}
      }
      if (card.type === 'jieqing_company') {
        return { ...card, rows: [
          { label: '待结清笔数', value: String(cSettle.length), color: 'red' },
          { label: '待结清总额', value: fmt(sum(cSettle, () => true)), color: 'red' },
        ]}
      }
      if (card.type === 'detail_personal') {
        return { ...card, previewItems: this._buildDetailPreview('personal') }
      }
      if (card.type === 'detail_company') {
        return { ...card, previewItems: this._buildDetailPreview('company') }
      }
      return card
    })
    this.setData({ overviewCards: cards })
  },

  onOverviewMonthChange(e) {
    playTap()
    const ym = e.detail.value // 'YYYY-MM'
    this.setData({ overviewMonth: ym, overviewYear: ym.slice(0, 4), overviewMonthNum: ym.slice(5, 7) })
    this._calcOverviewData() // 只重算卡片数字，不重绘简览 canvas（避免真机崩溃重启）
  },
  // 明细简览卡截断预览：取该账本前 4 条真实流水，复用明细页同源数据
  _buildDetailPreview(scope) {
    return api.getItems(scope).slice(0, 4).map(it => ({
      category: it.category,
      typeLabel: it.typeLabel,
      type: it.type,
      note: it.note || '-',
      amount: it.amount,
      dateShort: (it.date || '').slice(5, 10) || it.date || '',
    }))
  },
  _initOverviewCharts() {
    const charts = this.data.overviewCards.filter(c =>
      c.previewStyle === 'chart_line' || c.previewStyle === 'chart_bar' || c.previewStyle === 'chart_pie'
    )
    charts.forEach(card => {
      const prefix = card.previewStyle === 'chart_line' ? 'ovLine_' : card.previewStyle === 'chart_bar' ? 'ovBar_' : 'ovPie_'
      const sel = '#' + prefix + card.id
      const query = wx.createSelectorQuery()
      query.select(sel).fields({ node: true, size: true }).exec((res) => {
        if (!res || !res[0] || !res[0].node) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        let w = res[0].width || 200
        let h = res[0].height || 130
        const dpr = wx.getSystemInfoSync().pixelRatio || 2
        if (w < 10 || h < 10) {
          setTimeout(() => this._initOverviewCharts(), 300)
          return
        }
        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)

        const ovScope = (card.type || '').includes('company') ? 'company' : 'personal'
        const data = this._aggregateChartData(ovScope)
        if (card.previewStyle === 'chart_line') {
          this.drawStockChart(ctx, w, h, data)
        } else if (card.previewStyle === 'chart_bar') {
          this.drawBarChart(ctx, w, h, data)
        } else if (card.previewStyle === 'chart_pie') {
          const pieData = this.generatePieData(ovScope)
          const palette = ['#007aff', '#ff9500', '#af52de', '#34c759', '#ff3b30', '#ffcc00', '#8e8e93']
          const halfW = w / 2
          this.drawPieChart(ctx, halfW, h, pieData.income, palette)
          ctx.save()
          ctx.translate(halfW, 0)
          this.drawPieChart(ctx, halfW, h, pieData.expense, palette)
          ctx.restore()
          ctx.fillStyle = this.data.isDarkMode ? '#aaa' : '#666'
          ctx.font = '10px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('收入', halfW / 2, 12)
          ctx.fillText('支出', halfW * 1.5, 12)
        }
      })
    })
  },

  switchTab(e) {
    playTap()
    const now = Date.now()
    const index = e.currentTarget.dataset.index
    const prevTab = this.data.currentTab
    const wasOverview = this.data.showOverview

    // 正在切换中直接忽略
    if (this.data._switchingTab) return
    if (now - (this._lastSwitchTab || 0) < 250) return
    this._lastSwitchTab = now

    // Tab 0 重复点击（当前在明细页非简览）→ 返回简览页
    if (index === 0 && prevTab === 0 && !wasOverview) {
      this._setTabUI(0, true)
      return
    }
    // Tab 0 重复点击（当前在简览页）→ 进入明细页
    if (index === 0 && prevTab === 0 && wasOverview) {
      this._setTabUI(0, false)
      this._loadTabData(0)
      return
    }

    this._tab0LastTap = 0

    if (index === 4) {
      // Tab 4 重复点击（当前在二级页面）→ 回退到主我的页
      if (prevTab === 4) {
        this._setTabUI(4, false)
        return
      }
      this._onSpotlightAction()
    }
    if (index === 2) {
      this.onBookEntry({ currentTarget: { dataset: { type: 'expense' } } })
      return
    }

    if (index === prevTab) return
    this._setTabUI(index, false)
    this._loadTabData(index)
    // 同步顶部模式色带
    const modeMap = { 0: this.data.detailType, 1: this.data.reportType, 3: this.data.settleType }
    if (modeMap[index] !== undefined) {
      this.setData({ currentMode: modeMap[index] })
    }
  },

  _setTabUI(index, isOverview) {
    this.setData({
      _switchingTab: true,
      currentTab: index, showOverview: isOverview,
      showVipPage: false, vipDetailId: -1, vipSelected: -1,
      showCustomCategory: false, showCompanyShare: false, showExportBill: false,
      showAuditPage: false, showContactPage: false, showSettingsPage: false,
      showNotifyPage: false, notifySwipeId: '', showLedgerPage: false,
      showPrivacyPage: false, showPrivacyPolicyPage: false, showAboutPage: false,
      showLoginPage: false, showCustomOverview: false,
    })
    // 等 wx:if 切完后再允许下一次切换
    setTimeout(() => this.setData({ _switchingTab: false }), 100)
  },

  _loadTabData(index) {
    if (index === 1) {
      setTimeout(() => {
        if (this.data.currentTab === 1) this._refreshReport()
      }, 300)
    } else if (index === 0) {
      setTimeout(() => {
        if (this.data.currentTab === 0) this.initDetailItems()
      }, 50)
    } else if (index === 3) {
      setTimeout(() => {
        if (this.data.currentTab === 3) this.initSettleItems()
      }, 50)
    }
  },

  // ---- Canvas 折线图 ----
  // 从真实记账数据聚合图表数据
  _aggregateChartData(optScope) {
    const scope = optScope || (this.data.reportType === 1 ? 'company' : 'personal')
    const stored = api.getItems(scope)
    if (stored.length === 0) return []

    const period = this.data.reportPeriod
    // Build a map: label -> { income, expense, receivable, payable, net }
    const map = {}

    const addToLabel = (label, item) => {
      if (!map[label]) map[label] = { label, income: 0, expense: 0, receivable: 0, payable: 0, net: 0 }
      const amount = parseFloat(item.amount) || 0
      // 口径对齐 _updateReportSummary：收入=收入，支出=支出+垫付，应付不计入收支
      if (item.typeLabel === '收入') {
        map[label].income += amount
      } else if (item.typeLabel === '支出' || item.typeLabel === '垫付') {
        map[label].expense += amount
      }
      if (item.typeLabel === '垫付') map[label].receivable += amount
      if (item.typeLabel === '应付') map[label].payable += amount
    }

    stored.forEach(item => {
      if (!this._inReportRange(item)) return
      const date = String(item.date || '').slice(0, 10)
      const m = parseInt(date.slice(5, 7))
      const day = parseInt(date.slice(8, 10))
      if (!Number.isFinite(m) || !Number.isFinite(day)) return

      if (period === 0) {
        addToLabel(String(day), item)
      } else if (period === 3) {
        addToLabel(`${m}月${day}日`, item)
      } else if (period === 1) {
        addToLabel(`${m}月`, item)
      } else if (period === 2) {
        const qi = Math.floor((m - 1) / 3)
        const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
        addToLabel(quarters[qi], item)
      }
    })

    const data = Object.values(map)
    data.forEach(d => { d.net = d.income - d.expense })
    // Sort by label
    data.sort((a, b) => {
      const na = parseInt(a.label), nb = parseInt(b.label)
      if (!isNaN(na) && !isNaN(nb)) return na - nb
      return a.label.localeCompare(b.label)
    })
    return data
  },

  }
}

module.exports = createMethods
