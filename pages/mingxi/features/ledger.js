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
  _ledgerData(scope) {
    const items = api.getItems(scope).filter(it => !it._voided)
    const ym = this.data.overviewMonth || ''
    const prefix = ym.slice(0, 7) // YYYY-MM
    const [y, m] = prefix ? prefix.split('-') : [String(new Date().getFullYear()), String(new Date().getMonth() + 1).padStart(2, '0')]
    const monthItems = items.filter(it => (it.date || '').slice(0, 7) === prefix)
    const sumBy = (arr, fn) => arr.filter(fn).reduce((s, it) => s + parseFloat(it.amount || 0), 0)
    // 本月：收入=收入；支出=支出+垫付（已出账）；应付不计入显示支出，但计入预算占用
    const inc = sumBy(monthItems, it => it.typeLabel === '收入')
    const exp = sumBy(monthItems, it => it.typeLabel === '支出' || it.typeLabel === '垫付')
    const monthPayable = sumBy(monthItems, it => it.typeLabel === '应付' && it.settleStatus !== 'settled')
    const budget = parseFloat(api.getSetting('budget_' + scope) || 0) || 0
    const budgetUsed = exp + monthPayable   // 预算占用 = 已出账支出 + 应付（已承诺）
    const remain = budget - budgetUsed
    // 往来款：未结清的垫付(应收) / 应付
    const recvArr = items.filter(it => it.typeLabel === '垫付' && it.settleStatus !== 'settled')
    const payArr = items.filter(it => it.typeLabel === '应付' && it.settleStatus !== 'settled')
    const recv = recvArr.reduce((s, it) => s + parseFloat(it.amount || 0), 0)
    const pay = payArr.reduce((s, it) => s + parseFloat(it.amount || 0), 0)
    const net = recv - pay
    // 公司四项资产口径：总资金=收入−真实支出(不含垫付/应付)；总负债=应付；净资产=总资金−应付；可支配=总资金−垫付−应付
    const funds = sumBy(items, it => it.typeLabel === '收入') - sumBy(items, it => it.typeLabel === '支出')
    const netAssets = funds - pay
    const disposable = funds - recv - pay
    return {
      ledgerBudget: budget,
      ledgerBudgetInput: budget > 0 ? String(budget) : '',
      ledgerMonthLabel: `${y}年${m}月`,
      ledgerMonthIncome: inc.toFixed(2),
      ledgerMonthExpense: exp.toFixed(2),
      ledgerMonthBalance: (inc - exp).toFixed(2),
      ledgerMonthBalancePos: (inc - exp) >= 0,
      ledgerBudgetUsed: budgetUsed.toFixed(2),
      ledgerBudgetUsedPct: budget > 0 ? Math.min(100, Math.round(budgetUsed / budget * 100)) : 0,
      ledgerOverBudget: budget > 0 && remain < 0,
      ledgerBudgetRemainText: budget > 0 ? (remain >= 0 ? `剩余 ¥${remain.toFixed(2)}` : `超支 ¥${(-remain).toFixed(2)}`) : '未设置预算',
      ledgerReceivable: recv.toFixed(2),
      ledgerPayable: pay.toFixed(2),
      ledgerNet: net.toFixed(2),
      ledgerNetPos: net >= 0,
      ledgerReceivableCount: recvArr.length,
      ledgerPayableCount: payArr.length,
      ledgerFunds: funds.toFixed(2),
      ledgerLiability: pay.toFixed(2),
      ledgerNetAssets: netAssets.toFixed(2),
      ledgerNetAssetsPos: netAssets >= 0,
      ledgerDisposable: disposable.toFixed(2),
      ledgerDisposablePos: disposable >= 0,
    }
  },

  onGotoPersonalLedger() {
    playTap()
    this.setData({ showLedgerPage: true, ledgerScope: 'personal', ...this._ledgerData('personal') })
  },

  onGotoCompanyLedger() {
    playTap()
    const ci = api.getCompanyInfo()
    if (!(ci && ci.companyRole === 'boss' && ci.companyUid)) {
      wx.showToast({ title: '公司账本仅企业管理员可见', icon: 'none' })
      return
    }
    this.setData({ showLedgerPage: true, ledgerScope: 'company', ...this._ledgerData('company') })
  },

  /** 引导中：展示账本演示数据 */
  _showLedgerDemo() {
    this.setData({
      ledgerMonthIncome: '12,500.00',
      ledgerMonthExpense: '3,200.00',
      ledgerMonthBalance: '9,300.00',
      ledgerMonthBalancePos: true,
      ledgerReceivable: '5,000.00',
      ledgerPayable: '1,500.00',
      ledgerNet: '3,500.00',
      ledgerNetPos: true,
      ledgerReceivableCount: 2,
      ledgerPayableCount: 1,
    })
  },

  _clearLedgerDemo() {
    this.setData({
      ledgerMonthIncome: '0.00',
      ledgerMonthExpense: '0.00',
      ledgerMonthBalance: '0.00',
      ledgerMonthBalancePos: true,
      ledgerReceivable: '0.00',
      ledgerPayable: '0.00',
      ledgerNet: '0.00',
      ledgerNetPos: true,
      ledgerReceivableCount: 0,
      ledgerPayableCount: 0,
    })
  },

  onLedgerBack() {
    playTap()
    this._onSpotlightAction()
    this.setData({ showLedgerPage: false })
  },

  // 往来款下钻 → 结清 Tab（对齐当前账本范围）
  onLedgerGotoSettle() {
    playTap()
    this.setData({ settleType: this.data.ledgerScope === 'company' ? 1 : 0 })
    this.switchTab({ currentTarget: { dataset: { index: 3 } } })
    this.initSettleItems()
  },

  onLedgerBudgetInput(e) {
    this.setData({ ledgerBudgetInput: e.detail.value })
  },

  onLedgerBudgetSave() {
    playTap()
    const scope = this.data.ledgerScope
    const val = parseFloat(this.data.ledgerBudgetInput)
    if (isNaN(val) || val < 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    api.saveSetting('budget_' + scope, val)
    this.setData(this._ledgerData(scope))
    wx.showToast({ title: '已保存', icon: 'success' })
    this._onSpotlightAction()
  },

  // 简览卡片点击：个人/公司账本卡 → 账本页；图表卡 → 报表页；其余卡 → 明细页
  onOverviewCardTap(e) {
    playTap()
    this._onSpotlightAction()
    const { type } = e.currentTarget.dataset
    if (type === 'overview_personal') {
      this.setData({ showOverview: false, currentTab: 4, showLedgerPage: true, ledgerScope: 'personal', ...this._ledgerData('personal') })
      return
    }
    if (type === 'overview_company') {
      const ci = api.getCompanyInfo()
      if (!(ci && ci.companyRole === 'boss' && ci.companyUid)) {
        wx.showToast({ title: '公司账本仅企业管理员可见', icon: 'none' })
        return
      }
      this.setData({ showOverview: false, currentTab: 4, showLedgerPage: true, ledgerScope: 'company', ...this._ledgerData('company') })
      return
    }
    if (type && type.indexOf('report_') === 0) {
      this.switchTab({ currentTarget: { dataset: { index: 1 } } })
      return
    }
    this.switchTab({ currentTarget: { dataset: { index: 0 } } })
  },

  onAuditEntry() {
    playTap()
    const saved = api.getCompanyInfo()
    if (!saved || saved.companyRole !== 'boss' || !saved.companyUid) {
      wx.showToast({ title: '请先注册公司', icon: 'none' })
      return
    }
    const list = api.getAuditList()
    this.setData({ showAuditPage: true, auditList: list })
  },

  onAuditBack() {
    playTap()
    this.setData({ showAuditPage: false })
  },

  async onAuditApprove(e) {
    playTap()
    const { id } = e.currentTarget.dataset
    const list = this.data.auditList.map(item => item.id === id ? { ...item, status: 'approved' } : item)
    const result = await api.saveAuditList(list)
    if (result && result.failed) return
    this.setData({ auditList: list })
    this.updateAuditBadge()
    const notifyList = api.getNotifyList()
    notifyList.unshift({ id: api.generateId(), text: '审核通过加入公司', time: new Date().toLocaleDateString(), read: false })
    await api.saveNotifyList(notifyList)
    this.updateNotifyBadge()
    wx.showToast({ title: '已通过', icon: 'success' })
  },

  async onAuditReject(e) {
    playTap()
    const { id } = e.currentTarget.dataset
    const list = this.data.auditList.map(item => item.id === id ? { ...item, status: 'rejected' } : item)
    const result = await api.saveAuditList(list)
    if (result && result.failed) return
    this.setData({ auditList: list })
    this.updateAuditBadge()
    wx.showToast({ title: '已拒绝', icon: 'none' })
  },

  updateAuditBadge() {
    const list = api.getAuditList()
    const hasPending = list.some(item => item.status === 'pending')
    const hasUnread = api.getNotifyList().some(item => !item.read)
    this.setData({ hasPendingAudit: hasPending, hasMyTabBadge: hasPending || hasUnread })
  },

  _formatNotifyTime(t) {
    if (!t) return ''
    // ISO 8601 format from server: 2026-07-20T08:19:33.682Z
    // toLocaleDateString from client: 2026/7/20
    if (typeof t === 'string' && t.indexOf('T') !== -1) {
      var d = new Date(t)
      if (isNaN(d.getTime())) return t
      var month = d.getMonth() + 1
      var day = d.getDate()
      var hours = d.getHours().toString().padStart(2, '0')
      var mins = d.getMinutes().toString().padStart(2, '0')
      return d.getFullYear() + '/' + month + '/' + day + ' ' + hours + ':' + mins
    }
    return t
  },

  onNotifyEntry() {
    playTap()
    var list = api.getNotifyList()
    var self = this
    list = list.map(function (item) {
      return { ...item, _timeText: self._formatNotifyTime(item.time) }
    })
    this.setData({ showNotifyPage: true, notifyList: list })
  },

  onNotifyBack() {
    playTap()
    this.setData({ showNotifyPage: false, notifySwipeId: '' })
    this.updateNotifyBadge()
  },

  async onNotifyRead(e) {
    playTap()
    const { id } = e.currentTarget.dataset
    try {
      await api.markNotificationRead(id)
    } catch (error) {
      wx.showToast({ title: '标记已读失败，请重试', icon: 'none' })
      return
    }
    const list = this.data.notifyList.map(item => item.id === id ? { ...item, read: true } : item)
    this.setData({ notifyList: list })
    this.updateNotifyBadge()
  },

  updateNotifyBadge() {
    const list = api.getNotifyList()
    const hasUnread = list.some(item => !item.read)
    const hasPending = api.getAuditList().some(item => item.status === 'pending')
    this.setData({ hasUnreadNotify: hasUnread, hasMyTabBadge: hasUnread || hasPending })
  },

  onNotifyTouchStart(e) {
    const t = e.touches[0]
    this.setData({ notifyTouchStartX: t.clientX, notifyTouchStartY: t.clientY, notifySwipeId: '' })
  },

  onNotifyTouchMove(e) {
    const t = e.touches[0]
    const dx = t.clientX - this.data.notifyTouchStartX
    const dy = t.clientY - this.data.notifyTouchStartY
    if (Math.abs(dx) > Math.abs(dy) && dx < -40) {
      this.setData({ notifySwipeId: e.currentTarget.dataset.id })
    }
  },

  onNotifyTouchEnd() {
    // keep swiped open
  },

  async onNotifyDelete(e) {
    playTap()
    const { id } = e.currentTarget.dataset
    try {
      await api.deleteNotification(id)
    } catch (error) {
      wx.showToast({ title: '删除失败，请重试', icon: 'none' })
      return
    }
    const list = this.data.notifyList.filter(item => item.id !== id)
    this.setData({ notifyList: list, notifySwipeId: '' })
    this.updateNotifyBadge()
  },

  onExportBillEntry() {
    playTap()
    this.setData({ currentTab: 4, showOverview: false, showExportBill: true })
  },

  onExportBillBack() {
    playTap()
    this.setData({ showExportBill: false })
  },

  async onExportPersonal() {
    playTap()
    if (this.data.exportFormatOptions[this.data.exportFormatIndex] !== '.EXCEL') {
      wx.showToast({ title: 'PDF 即将支持，请先选 .EXCEL', icon: 'none' })
      return
    }
    var usage = api.checkUsage('export')
    if (!usage.allowed) {
      this._showVipLimitDialog('export')
      return
    }
    try {
      await api.incrementUsage('export')
    } catch (err) {
      if (err && (err.statusCode === 402 || err.error === 'export_limit_exhausted')) {
        this._showVipLimitDialog('export')
      } else {
        wx.showToast({ title: '暂时无法校验导出额度，请稍后重试', icon: 'none' })
      }
      return
    }
    const nick = (this.data.userInfo && this.data.userInfo.nickName) || '个人'
    this._exportBillXlsx('personal', nick, false, '账本')
  },

  async onExportCompany() {
    playTap()
    if (this.data.exportFormatOptions[this.data.exportFormatIndex] !== '.EXCEL') {
      wx.showToast({ title: 'PDF 即将支持，请先选 .EXCEL', icon: 'none' })
      return
    }
    var usage = api.checkUsage('export')
    if (!usage.allowed) {
      this._showVipLimitDialog('export')
      return
    }
    try {
      await api.incrementUsage('export')
    } catch (err) {
      if (err && (err.statusCode === 402 || err.error === 'export_limit_exhausted')) {
        this._showVipLimitDialog('export')
      } else {
        wx.showToast({ title: '暂时无法校验导出额度，请稍后重试', icon: 'none' })
      }
      return
    }
    const name = (api.getCompanyInfo && (api.getCompanyInfo() || {}).companyName) || '公司'
    this._exportBillXlsx('company', name, true, '账单表')
  },

  // 导出范围判定：口径同 _inReportRange，用导出页自己的时间状态
  _inExportRange(it) {
    const date = (it && it.date ? String(it.date) : '').slice(0, 10)
    if (!date) return false
    const { exportPeriod, exportPickerDate } = this.data
    if (exportPeriod === 0) return date.slice(0, 7) === exportPickerDate
    if (exportPeriod === 2) return date.slice(0, 4) === String(exportPickerDate).slice(0, 4)
    if (exportPeriod === 3) return date === exportPickerDate
    const y = this.data.exportSelectedYear
    const q = (this.data.exportQuarterMultiIndex || [0, 0])[1]
    if (parseInt(date.slice(0, 4)) !== parseInt(y)) return false
    const mo = parseInt(date.slice(5, 7))
    return mo >= q * 3 + 1 && mo <= q * 3 + 3
  },

  // 上期匹配器（环比用）：返回 { label, test }，上期=紧邻的同粒度区间（月→上月/季→上季/年→上年/日→前一天）
  _prevExportMatcher() {
    const { exportPeriod, exportPickerDate } = this.data
    const pad = n => String(n).padStart(2, '0')
    if (exportPeriod === 0) {
      const [y, m] = String(exportPickerDate || '').split('-').map(Number)
      let py = y, pm = (m || 1) - 1
      if (pm < 1) { pm = 12; py -= 1 }
      const ym = `${py}-${pad(pm)}`
      return { label: `${py}年${pad(pm)}月`, test: it => (it.date || '').slice(0, 7) === ym }
    }
    if (exportPeriod === 2) {
      const y = parseInt(String(exportPickerDate).slice(0, 4)) - 1
      return { label: `${y}年`, test: it => (it.date || '').slice(0, 4) === String(y) }
    }
    if (exportPeriod === 3) {
      const [yy, mm, dd] = String(exportPickerDate || '').split('-').map(Number)
      const d = new Date(yy, (mm || 1) - 1, (dd || 1))
      d.setDate(d.getDate() - 1)
      const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      return { label: `${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(d.getDate())}日`, test: it => (it.date || '').slice(0, 10) === ds }
    }
    // 季度：上季（Q1 的上季为上一年 Q4）
    let y = parseInt(this.data.exportSelectedYear)
    let q = (this.data.exportQuarterMultiIndex || [0, 0])[1] - 1
    if (q < 0) { q = 3; y -= 1 }
    return {
      label: `${y}年${this.data.quarterOptions[q]}`,
      test: it => {
        if (parseInt((it.date || '').slice(0, 4)) !== y) return false
        const mo = parseInt((it.date || '').slice(5, 7))
        return mo >= q * 3 + 1 && mo <= q * 3 + 3
      },
    }
  },

  // 账本 Excel 导出：多 sheet —— ①总表(明细,含作废并标注) ②报表(按分类,排除作废,口径同报表页)；
  // withYoY=true 再加一张 ③环比报表(收入段+支出段,本期 vs 上期,含分类与涨跌)。公司账本用 withYoY。
  // 数据=对应账单明细(排除自动对账记录 _autoSettle)+导出页所选时间范围；文件名=ownerName+时间+fileSuffix.xlsx
  _exportBillXlsx(scope, ownerName, withYoY, fileSuffix) {
    const all = api.getItems(scope).filter(it => !it._autoSettle)
    const rows = all.filter(it => this._inExportRange(it)).sort((a, b) => {
      const da = (a.date || '').slice(0, 10), db = (b.date || '').slice(0, 10)
      if (da !== db) return da < db ? 1 : -1
      return String(b.id).localeCompare(String(a.id))
    })
    if (!rows.length) {
      wx.showToast({ title: '该时间范围暂无账单', icon: 'none' })
      return
    }
    const round2 = n => Math.round(n * 100) / 100
    const S = xlsx.STYLE
    // 整行套色带：用于「收入」「支出」分段标题，跨 cols 列填同一底色
    const band = (text, style, cols) => {
      const r = [{ v: text, s: style }]
      for (let i = 1; i < cols; i++) r.push({ v: '', s: style })
      return r
    }
    const head = arr => arr.map(v => ({ v, s: S.HEAD }))

    // ① 总表（明细）：按日期分组，组首插一条蓝色日期带「笼罩」当组明细
    //   月报表/日报表 → 按天分组(YYYY-MM-DD)；季度/年度报表 → 按月分组(YYYY-MM)。rows 已按日期降序，故组首=区间末
    const statusOf = it => it._voided ? '已作废'
      : (it.settleStatus === 'settled') ? '已结清'
      : (it.settleStatus === 'pending_confirm' || it.settleStatus === 'company_settled') ? '待确认' : '正常'
    const byMonth = this.data.exportPeriod === 1 || this.data.exportPeriod === 2
    const dateKey = it => {
      const d = (it.date || '').slice(0, 10)
      return byMonth ? d.slice(0, 7) : d
    }
    const COLS1 = 7
    const sheet1 = [head(['日期', '类型', '分类', '对象', '金额', '状态', '备注'])]
    let lastKey = null
    rows.forEach(it => {
      const k = dateKey(it)
      if (k && k !== lastKey) {
        sheet1.push(band(k, S.DATE, COLS1))
        lastKey = k
      }
      sheet1.push([it.date || '', it.typeLabel || '', it.category || '', it.target || '',
        round2(parseFloat(it.amount) || 0), statusOf(it), it.note || ''])
    })

    // 聚合口径（排除作废）：收入=收入，支出=支出+垫付
    const isIncome = it => it.typeLabel === '收入'
    const isExpense = it => it.typeLabel === '支出' || it.typeLabel === '垫付'
    const aggregate = items => {
      const inc = {}, exp = {}
      let income = 0, expense = 0
      items.filter(it => !it._voided).forEach(it => {
        const amt = parseFloat(it.amount) || 0
        const name = it.category || '未分类'
        if (isIncome(it)) { income += amt; (inc[name] = inc[name] || { count: 0, amount: 0 }).count++; inc[name].amount += amt }
        else if (isExpense(it)) { expense += amt; (exp[name] = exp[name] || { count: 0, amount: 0 }).count++; exp[name].amount += amt }
      })
      return { income, expense, inc, exp }
    }

    // ② 报表（按分类）—— 收入段（绿）/ 支出段（红）上下分开，各带分段色带 + 表头 + 合计
    const cur = aggregate(rows)
    const catRows = (map, total) => Object.keys(map).map(name => ({
      name, count: map[name].count, amount: map[name].amount,
      pct: total > 0 ? Math.round(map[name].amount / total * 100) : 0,
    })).sort((a, b) => b.amount - a.amount)
    const incomeCats = catRows(cur.inc, cur.income)
    const expenseCats = catRows(cur.exp, cur.expense)
    const COLS2 = 4
    const sheet2 = []
    sheet2.push(band('收入报表', S.INCOME, COLS2))
    sheet2.push(head(['分类', '笔数', '金额', '占比']))
    incomeCats.forEach(c => sheet2.push([c.name, c.count, round2(c.amount), c.pct + '%']))
    sheet2.push([{ v: '收入合计', s: S.HEAD }, { v: incomeCats.reduce((s, c) => s + c.count, 0), s: S.HEAD }, { v: round2(cur.income), s: S.HEAD }, { v: (cur.income > 0 ? 100 : 0) + '%', s: S.HEAD }])
    sheet2.push([])
    sheet2.push(band('支出报表', S.EXPENSE, COLS2))
    sheet2.push(head(['分类', '笔数', '金额', '占比']))
    expenseCats.forEach(c => sheet2.push([c.name, c.count, round2(c.amount), c.pct + '%']))
    sheet2.push([{ v: '支出合计', s: S.HEAD }, { v: expenseCats.reduce((s, c) => s + c.count, 0), s: S.HEAD }, { v: round2(cur.expense), s: S.HEAD }, { v: (cur.expense > 0 ? 100 : 0) + '%', s: S.HEAD }])
    sheet2.push([])
    sheet2.push([{ v: '结余', s: S.HEAD }, '', { v: round2(cur.income - cur.expense), s: S.HEAD }, ''])

    const sheets = [
      { name: '总表', rows: sheet1 },
      { name: '报表', rows: sheet2 },
    ]

    // ③ 环比报表（公司账本）：本期 vs 上期，收入段 + 支出段同一张表，含分类与涨跌
    if (withYoY) {
      const pm = this._prevExportMatcher()
      const prev = aggregate(all.filter(it => pm.test(it)))
      const yoy = (c, p) => {
        if (!p && !c) return '—'
        if (!p) return '新增'
        const r = (c - p) / p * 100
        if (Math.abs(r) < 0.05) return '持平'
        return (r > 0 ? '上升 ' : '下降 ') + Math.abs(r).toFixed(1) + '%'
      }
      const amtOf = (map, name) => (map[name] ? map[name].amount : 0)
      const union = (a, b) => {
        const set = {}
        Object.keys(a).forEach(k => { set[k] = 1 }); Object.keys(b).forEach(k => { set[k] = 1 })
        return Object.keys(set).sort((x, y) => (amtOf(a, y) - amtOf(a, x)) || (amtOf(b, y) - amtOf(b, x)))
      }
      const sheet3 = []
      sheet3.push(band(`收入环比（对比${pm.label}）`, S.INCOME, 4))
      sheet3.push(head(['项目', '上期', '本期', '环比']))
      sheet3.push([{ v: '总收入', s: S.HEAD }, { v: round2(prev.income), s: S.HEAD }, { v: round2(cur.income), s: S.HEAD }, { v: yoy(cur.income, prev.income), s: S.HEAD }])
      union(cur.inc, prev.inc).forEach(name => sheet3.push([name, round2(amtOf(prev.inc, name)), round2(amtOf(cur.inc, name)), yoy(amtOf(cur.inc, name), amtOf(prev.inc, name))]))
      sheet3.push([])
      sheet3.push(band(`支出环比（对比${pm.label}）`, S.EXPENSE, 4))
      sheet3.push(head(['项目', '上期', '本期', '环比']))
      sheet3.push([{ v: '总支出', s: S.HEAD }, { v: round2(prev.expense), s: S.HEAD }, { v: round2(cur.expense), s: S.HEAD }, { v: yoy(cur.expense, prev.expense), s: S.HEAD }])
      union(cur.exp, prev.exp).forEach(name => sheet3.push([name, round2(amtOf(prev.exp, name)), round2(amtOf(cur.exp, name)), yoy(amtOf(cur.exp, name), amtOf(prev.exp, name))]))
      sheets.push({ name: '环比报表', rows: sheet3 })
    }

    let buffer
    try {
      buffer = xlsx.buildXlsx(sheets)
    } catch (e) {
      wx.showToast({ title: '生成表格失败', icon: 'none' })
      return
    }
    const time = String(this.data.exportDateText || '').replace(/[\\/:*?"<>|]/g, '')
    const safeOwner = String(ownerName || '个人').replace(/[\\/:*?"<>|]/g, '')
    const filePath = `${wx.env.USER_DATA_PATH}/${safeOwner}${time}${fileSuffix || '账本'}.xlsx`
    try {
      wx.getFileSystemManager().writeFileSync(filePath, buffer)
    } catch (e) {
      wx.showToast({ title: '生成文件失败', icon: 'none' })
      return
    }
    wx.openDocument({
      filePath,
      fileType: 'xlsx',
      showMenu: true,
      fail: () => wx.showToast({ title: '打开文件失败', icon: 'none' }),
    })
  },

  onContactEntry() {
    playTap()
    this.setData({ showContactPage: true, contactFeedback: '' })
  },

  onContactBack() {
    playTap()
    this.setData({ showContactPage: false })
  },

  onContactInput(e) {
    this.setData({ contactFeedback: e.detail.value })
  },

  async onContactSubmit() {
    playTap()
    const text = (this.data.contactFeedback || '').trim()
    if (!text) {
      wx.showToast({ title: '请输入您的意见或建议', icon: 'none' })
      return
    }
    // 存储反馈
    const feedbackList = api.getFeedbackList()
    feedbackList.unshift({ id: api.generateId(), text, time: new Date().toLocaleString() })
    const result = await api.saveFeedbackList(feedbackList)
    if (result && result.failed) return
    wx.showToast({ title: '感谢您的反馈！', icon: 'success' })
    this.setData({ contactFeedback: '' })
  },

  }
}

module.exports = createMethods
