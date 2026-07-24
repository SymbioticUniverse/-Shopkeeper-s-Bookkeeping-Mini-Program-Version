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
  switchSettleType() {
    playTap()
    if (this.data.settleType === 0) {
      const ci = api.getCompanyInfo()
      if (!(ci && ci.companyRole === 'boss' && ci.companyUid)) {
        wx.showToast({ title: '公司账本仅企业管理员可见', icon: 'none' })
        return
      }
    }
    const nextSettleType = this.data.settleType === 0 ? 1 : 0
    this.setData({ settleType: nextSettleType, currentMode: nextSettleType })
    this.initSettleItems()
  },

  onSettleAll() {
    playTap()
    const items = this.data.settleItems
    const ci = api.getCompanyInfo()
    const isBoss = !!(ci && ci.companyRole === 'boss')
    const isPending = s => s === 'pending_confirm' || s === 'company_settled'

    const settleable = items.filter(it => {
      // 垫付 + pending → 确认到账（owner）
      if (it.typeLabel === '垫付' && isPending(it.settleStatus)) return true
      // 应付 + pending → boss 确认收款
      if (it.typeLabel === '应付' && isPending(it.settleStatus)) return isBoss
      // 垫付 + 无状态 → boss 发起
      if (it.typeLabel === '垫付' && !it.settleStatus) return isBoss
      // 应付 + 无状态 → 发起
      if (it.typeLabel === '应付' && !it.settleStatus) return true
      return false
    })
    if (!settleable.length) {
      wx.showToast({ title: '没有可操作的结清项目', icon: 'none' })
      return
    }
    wx.showModal({
      title: '批量结清',
      content: `将对 ${settleable.length} 笔账单执行结清操作，确定吗？`,
      success: async (res) => {
        if (!res.confirm) return
        let failed = 0
        for (const item of settleable) {
          try {
            if (isPending(item.settleStatus)) {
              await api.settleConfirm(item.id)
            } else {
              await api.settleItem(item.id)
            }
          } catch (e) {
            failed++
          }
        }
        await api.refreshItems()
        this.initSettleItems()
        this.initDetailItems()
        this._calcOverviewData()
        wx.showToast({
          title: failed ? `完成，${failed} 笔失败` : '已全部处理',
          icon: failed ? 'none' : 'success',
        })
      },
    })
  },

  // ---- 清单项交互 ----
  onBillTouchStart(e) {
    this._touchStartX = e.touches[0].clientX
    this._touchStartY = e.touches[0].clientY
    this._touchMoved = false
  },

  onBillTouchMove(e) {
    const dx = e.touches[0].clientX - this._touchStartX
    const dy = e.touches[0].clientY - this._touchStartY
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      this._touchMoved = true
    }
  },

  onBillTouchEnd(e) {
    if (!this._touchMoved) return
    const dx = e.changedTouches[0].clientX - this._touchStartX
    const id = e.currentTarget.dataset.id
    const from = e.currentTarget.dataset.from || 'detail'
    const items = from === 'settle' ? 'settleItems' : 'detailItems'
    const list = this.data[items]

    // Close any previously open item
    const updated = list.map(item => {
      if (item._open) item._open = false
      return item
    })

    if (dx < -40) {
      // Swipe left: open
      const target = updated.find(item => item.id === id)
      if (target) target._open = true
    }

    this.setData({ [items]: updated })
  },

  // 结清记录文案：后端写的是「时间 由[垫付]/[应付]结清」，这里把括号里的角色换成真实对象名，更清楚：
  // 占位「公司」→ 真实公司名（自己的/加入链接的，取 companyInfo.companyName）；占位「个人」→ 用户昵称；外部对象→记账时填的名字
  _formatSettleText(item) {
    if (!item) return ''
    const raw = item.settleInfo || ''
    if (!raw) return ''
    let name = (item.target && String(item.target).trim()) || ''
    if (name === '公司') name = (api.getCompanyInfo() || {}).companyName || '公司'
    else if (name === '个人') name = (this.data.userInfo && this.data.userInfo.nickName) || '个人'
    if (!name) return raw
    return raw.replace(/由\s*[\[【][^\]】]*[\]】]\s*结清/, `由 ${name} 结清`)
  },

  onBillTap(e) {
    playTap()
    const id = e.currentTarget.dataset.id
    const from = e.currentTarget.dataset.from || 'detail'
    const items = from === 'settle' ? 'settleItems' : 'detailItems'
    const item = this.data[items].find(it => it.id === id)
    if (!item) return
    const isPersonal = from === 'settle' ? this.data.settleType === 0 : this.data.detailType === 0
    const _open = (voucherLocal) => {
      this.setData({
        modalItem: { ...item, voucher: voucherLocal || item.voucher, _settleText: this._formatSettleText(item), _timeText: this._billTimeText(item), _readonly: !!(item._autoSettle || item.settleStatus === 'settled') }, modalFrom: from, modalIsPersonal: isPersonal,
        modalEdit: { category: item.category, amount: item.amount, note: item.note || '' },
      })
    }
    var v = item.voucher
    if (v && typeof v === 'string' && v.indexOf('http') === 0) {
      var that = this
      api.downloadAuthedImage(v).then(function (local) {
        _open(local)
      }).catch(function () {
        _open(null)
      })
    } else {
      _open(v || null)
    }
  },

  onMultiItemTap(e) {
    playTap()
    const id = e.currentTarget.dataset.id
    const expanded = { ...this.data.expandedMultiIds }
    if (expanded[id]) {
      delete expanded[id]
    } else {
      expanded[id] = true
    }
    this.setData({ expandedMultiIds: expanded })
  },

  onModalFieldEdit(e) {
    playTap()
    const field = e.currentTarget.dataset.field
    const val = e.detail.value
    this.setData({ [`modalEdit.${field}`]: val })
  },

  onModalSave() {
    playTap()
    const { modalItem, modalEdit, modalFrom } = this.data
    if (!modalItem || !modalEdit) return
    wx.showModal({
      title: '确认保存',
      content: '确定要保存修改吗？',
      success: (res) => {
        if (!res.confirm) return
        api.updateItem(modalItem.id, { category: modalEdit.category, amount: modalEdit.amount, note: modalEdit.note })
        const itemsKey = modalFrom === 'settle' ? 'settleItems' : 'detailItems'
        const updated = this.data[itemsKey].map(item => {
          if (item.id === modalItem.id) return { ...item, category: modalEdit.category, amount: modalEdit.amount, note: modalEdit.note }
          return { ...item }
        })
        this.setData({ [itemsKey]: updated, detailGroups: this._buildDetailGroups(updated), modalItem: null })
        this._calcOverviewData()
        wx.showToast({ title: '已保存', icon: 'success' })
      },
    })
  },

  nop() {},

  // ========== 记账弹窗 ==========
  _getBookTargetDefaults(scope, type) {
    // 个人: 收入→公司(内部), 垫付→公司(内部), 支出→外部, 应付→外部
    // 公司: 垫付→个人(内部), 收入→外部, 支出→外部, 应付→外部
    if (scope === 'personal') {
      if (type === 'income' || type === 'payForward') return { targetType: 'internal', target: '公司' }
      return { targetType: 'external', target: '' }
    } else {
      if (type === 'payForward') return { targetType: 'internal', target: '个人' }
      return { targetType: 'external', target: '' }
    }
  },

  onBookEntry(e) {
    playTap()
    const type = e.currentTarget.dataset.type
    const now = new Date()
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const typeLabelMap = { income: '收入', expense: '支出', payForward: '垫付', payable: '应付' }
    const td = this._getBookTargetDefaults(this.data.bookScope, type)
    this.setData({
      showBookPopup: true,
      bookMode: 'normal',
      bookPhoto: '',
      'bookForm.type': type,
      'bookForm.amount': '',
      'bookForm.category': '',
      'bookForm.date': date,
      'bookForm.note': '',
      'bookForm.target': td.target,
      'bookForm.targetType': td.targetType,
      bookTypeLabel: typeLabelMap[type] || '支出',
    })
    this._onSpotlightAction()
  },

  onBookScopeToggle(e) {
    playTap()
    const scope = e.currentTarget.dataset.scope
    if (scope === 'company') {
      if (!api.getCompanyInfo()) {
        wx.showToast({ title: '请先注册公司', icon: 'none' })
        return
      }
      if (!api.isCompanyApproved()) {
        wx.showToast({ title: '您暂时还未加入公司，请申请或通过审核后重试', icon: 'none', duration: 2500 })
        return
      }
    }
    const td = this._getBookTargetDefaults(scope, this.data.bookForm.type)
    this.setData({
      bookScope: scope,
      bookScopeLabel: scope === 'personal' ? '个人' : '公司',
      'bookForm.target': td.target,
      'bookForm.targetType': td.targetType,
    })
    if (this.data.showBookCatPanel) this.refreshBookCatPanel()
  },

  // ========== 多笔记账 ==========
  onBookModeSwitch(e) {
    playTap()
    const mode = e.currentTarget.dataset.mode
    if (mode === 'multi') {
      const now = new Date()
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      this.setData({
        bookMode: mode,
        multiStartDate: date,
        multiEndDate: date,
        multiExpression: '',
        multiResult: '0.00',
        multiCount: 0,
        multiNote: '',
        multiScope: 'personal',
        multiScopeLabel: '个人',
        multiType: 'income',
        multiTypeLabel: '收入',
        multiUseDateRange: false,
      })
      this._onSpotlightAction()
    } else {
      this.setData({ bookMode: mode })
    }
  },

  _calcMulti(expr) {
    if (!expr) return { multiResult: '0.00', multiCount: 0 }
    let clean = expr.replace(/[+\-]+$/, '')
    if (!clean) return { multiResult: '0.00', multiCount: 0 }
    try {
      if (/[^0-9.+\-]/.test(clean)) throw new Error('invalid')
      // 按 + 分组（每组一笔），组内按 - 递减
      const groups = clean.split('+')
      let total = 0
      for (const g of groups) {
        if (!g) continue
        const parts = g.split('-')
        let sub = parseFloat(parts[0]) || 0
        for (let i = 1; i < parts.length; i++) {
          sub -= parseFloat(parts[i]) || 0
        }
        total += sub
      }
      if (!isFinite(total)) throw new Error('invalid')
      const parts = groups.filter(s => s)
      return { multiResult: total.toFixed(2), multiCount: parts.length }
    } catch (_) {
      return {}
    }
  },

  // ASR 多笔记账模式检测：98+23+123、九十八加上六十八、-32-12-345、减三二扣三三买四五
  _detectMultiEntryVoice(text) {
    if (!text) return null
    var t = text.trim()

    // 0) 前导减号修正：-32-12-345 → 32+12+345
    var leadingNeg = false
    if (t[0] === '-') {
      leadingNeg = true
      t = t.slice(1)
    }

    // 1) 纯数学表达式：含 + 或 - 且至少两组数字
    if (/^[\d\s+*/.\-]+$/.test(t) && /[\+\-]/.test(t) && (t.match(/\d+/g) || []).length >= 2) {
      var clean = t.replace(/\s+/g, '').replace(/[*\/]/g, '+')
      // 前导负号 → 全用 + 连接
      if (leadingNeg) clean = clean.replace(/\-/g, '+')
      if (/[\+\-]/.test(clean)) return clean
    }

    // 2) 中文/混合运算符模式
    var hasCNNum = /[一二三四五六七八九十百千万零两廿卅]/.test(t)
    var hasArabicNum = /\d/.test(t)
    // 扩展运算符：加减 + 记账常用动词
    var hasOp = /加[上]?|减[去]?|扣[除]?|买[了]?|花[了]?|付[了]?|交[了]?|缴[了]?|充[了]?|收[了到]?|赚[了]?|入[账]?|和|再|又|跟|与/.test(t)
    if (!hasOp) return null
    if (!hasCNNum && !hasArabicNum) return null

    // 把中文运算符替换为分隔符
    var sepText = t
      .replace(/加上/g, ' + ').replace(/加/g, ' + ')
      .replace(/减去/g, ' - ').replace(/减/g, ' - ')
      .replace(/扣除/g, ' - ').replace(/扣/g, ' - ')
      .replace(/买了/g, ' - ').replace(/买/g, ' - ')
      .replace(/花了/g, ' - ').replace(/花/g, ' - ')
      .replace(/付了/g, ' - ').replace(/付/g, ' - ')
      .replace(/交了/g, ' - ').replace(/交/g, ' - ')
      .replace(/缴了/g, ' - ').replace(/缴/g, ' - ')
      .replace(/充了/g, ' - ').replace(/充/g, ' - ')
      .replace(/收到/g, ' + ').replace(/收了/g, ' + ').replace(/收/g, ' + ')
      .replace(/赚了/g, ' + ').replace(/赚/g, ' + ')
      .replace(/入账/g, ' + ').replace(/入/g, ' + ')
      .replace(/和/g, ' + ')
      .replace(/再/g, ' + ').replace(/又/g, ' + ')
      .replace(/跟/g, ' + ').replace(/与/g, ' + ')

    // 按空格切分
    var tokens = sepText.split(/\s+/)
    var numbers = []
    var operators = []
    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i].trim()
      if (tok === '+' || tok === '-') {
        operators.push(tok)
        continue
      }
      if (!tok) continue
      var n = parseFloat(tok)
      if (isNaN(n) || n <= 0) {
        n = this._cnToInt(tok)
      }
      if (n > 0) {
        numbers.push(n)
      } else if (tok.length > 0 && /[\d一二三四五六七八九十百千万两]/.test(tok)) {
        n = this._cnToInt(tok)
        if (n > 0) numbers.push(n)
      }
    }
    if (numbers.length < 2) return null

    // 拼接表达式：全部用 + 连接，每段数字是一笔独立条目
    var expr = String(numbers[0])
    for (var j = 1; j < numbers.length; j++) {
      expr += '+' + numbers[j]
    }
    if (!/[\+\-]/.test(expr)) return null
    return expr
  },

  // 检测文本中是否有隐式多笔（多个金额无连接词），返回切分后的文本段
  _detectImplicitMulti(text) {
    if (!text) return null
    // 收集所有金额匹配：{ value, start, end }
    var hits = []
    // 中文金额
    var cnRegex = /[一二三四五六七八九十百千万零两廿卅]+[元块]?/g
    var m
    while ((m = cnRegex.exec(text)) !== null) {
      var idx = m.index
      var full = m[0]
      if (full.length === 1 && /^[一二三四五六七八九]$/.test(full)) {
        if ((idx > 0 && text[idx - 1] === '月') || (idx + full.length < text.length && /[月日号]/.test(text[idx + full.length]))) continue
      }
      var n = this._cnToInt(full.replace(/[元块]$/, ''))
      if (n > 0) hits.push({ value: n, start: idx, end: idx + full.length })
    }
    // 阿拉伯数字金额
    var arRegex = /\d+(?:\.\d{1,2})?\s*[元块]?/g
    while ((m = arRegex.exec(text)) !== null) {
      var arIdx = m.index
      var afterChar = arIdx + m[0].length < text.length ? text[arIdx + m[0].length] : ''
      var beforeChar = arIdx > 0 ? text[arIdx - 1] : ''
      if (/[日号月]/.test(afterChar) || /[年月]/.test(beforeChar)) continue
      var an = parseFloat(m[0].replace(/[元块]$/, ''))
      if (an > 0 && an < 1000000) {
        var dup = false
        for (var hi = 0; hi < hits.length; hi++) {
          if (Math.abs(hits[hi].value - an) < 0.01) { dup = true; break }
        }
        if (!dup) hits.push({ value: an, start: arIdx, end: arIdx + m[0].length })
      }
    }
    if (hits.length < 2) return null
    // 按位置排序后切分文本
    hits.sort(function (a, b) { return a.start - b.start })
    var segments = []
    for (var i = 0; i < hits.length; i++) {
      var segStart = i === 0 ? 0 : hits[i - 1].end
      var segEnd = hits[i].end
      segments.push(text.substring(segStart, segEnd).trim())
    }
    return { amounts: hits.map(function (h) { return h.value }), count: hits.length, segments: segments }
  },

  _cnToInt(s) {
    if (!s) return 0
    var CN_DIGIT = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '两': 2 }
    var CN_UNIT = { '十': 10, '廿': 20, '卅': 30, '百': 100, '千': 1000, '万': 10000, '亿': 100000000 }

    // 小数点：三点五 → 3.5
    var dotIdx = s.indexOf('点')
    if (dotIdx >= 0) {
      var intPart = this._cnToInt(s.slice(0, dotIdx))
      var fracStr = s.slice(dotIdx + 1)
      var frac = 0
      for (var fi = 0; fi < fracStr.length; fi++) {
        var fd = CN_DIGIT[fracStr[fi]]
        if (fd === undefined) break
        frac = frac * 10 + fd
      }
      return intPart + frac / Math.pow(10, fracStr.length)
    }

    // 数字缩写：全是 1-9 中文数字没有单位 → 拼接（三二→32，三四五→345）
    var allDigits = true
    for (var ci = 0; ci < s.length; ci++) {
      if (CN_DIGIT[s[ci]] === undefined) { allDigits = false; break }
    }
    if (allDigits && s.length >= 2) {
      var concat = ''
      for (var cj = 0; cj < s.length; cj++) {
        concat += CN_DIGIT[s[cj]]
      }
      return parseInt(concat, 10) || 0
    }

    // 标准中文数字转换
    if (CN_UNIT[s[0]] >= 20) {
      var base = CN_UNIT[s[0]]
      return base + (s.length > 1 ? this._cnToInt(s.slice(1)) : 0)
    }
    var val = 0, seg = 0, lastUnit = 0, sawZeroAfterUnit = false
    for (var i = 0; i < s.length; i++) {
      var dv = CN_DIGIT[s[i]]
      var uv = CN_UNIT[s[i]]
      if (dv === undefined && uv === undefined) return 0
      if (dv === 0) {
        // 零：标记后续数字是个位数（三百零二 → 302，不是 320）
        if (lastUnit >= 100) sawZeroAfterUnit = true
        continue
      }
      var v = uv !== undefined ? uv : dv
      if (v >= 10000) {
        val = (val + (seg || (i === 0 ? 1 : 0))) * v
        seg = 0; lastUnit = v; sawZeroAfterUnit = false
      } else if (v >= 100) {
        seg = (seg || (i === 0 ? 1 : 0)) * v
        val += seg
        seg = 0; lastUnit = v; sawZeroAfterUnit = false
      } else if (v >= 10) {
        seg = (seg || (i === 0 ? 1 : 0)) * v
        lastUnit = v; sawZeroAfterUnit = false
      } else {
        seg += v
      }
    }
    // 补全缩写：三百二 → 320（尾数后无十位单位，自动升位）
    if (seg > 0 && seg < 10 && lastUnit >= 100 && !sawZeroAfterUnit) {
      seg *= (lastUnit / 10)
    }
    return val + seg
  },

  onMultiTypeToggle(e) {
    playTap()
    const type = e.currentTarget.dataset.type
    this.setData({
      multiType: type,
      multiTypeLabel: type === 'income' ? '收入' : '支出',
    })
  },

  onMultiScopeToggle(e) {
    playTap()
    const scope = e.currentTarget.dataset.scope
    if (scope === 'company') {
      if (!api.getCompanyInfo()) {
        wx.showToast({ title: '请先注册公司', icon: 'none' })
        return
      }
      if (!api.isCompanyApproved()) {
        wx.showToast({ title: '您暂时还未加入公司，请申请或通过审核后重试', icon: 'none', duration: 2500 })
        return
      }
    }
    this.setData({
      multiScope: scope,
      multiScopeLabel: scope === 'personal' ? '个人' : '公司',
    })
  },

  onMultiNoteInput(e) {
    this.setData({ multiNote: e.detail.value })
  },

  onMultiStartDateChange(e) {
    playTap()
    this.setData({ multiStartDate: e.detail.value })
  },

  onMultiEndDateChange(e) {
    playTap()
    this.setData({ multiEndDate: e.detail.value })
  },

  onMultiDateRangeToggle() {
    playTap()
    this.setData({ multiUseDateRange: !this.data.multiUseDateRange })
  },

  onMultiSave() {
    try { playTap() } catch (_) {}

    var self = this
    var multiExpression = this.data.multiExpression
    var multiResult = this.data.multiResult
    var multiCount = this.data.multiCount
    var multiNote = this.data.multiNote
    var multiScope = this.data.multiScope
    var multiType = this.data.multiType
    var multiStartDate = this.data.multiStartDate
    var multiEndDate = this.data.multiEndDate
    var multiUseDateRange = this.data.multiUseDateRange

    if (!multiCount || parseFloat(multiResult) <= 0) {
      wx.showToast({ title: '请输入金额', icon: 'none' })
      return
    }
    if (parseFloat(multiResult) >= 10000000) {
      wx.showToast({ title: '合计金额不能超过千万', icon: 'none' })
      return
    }
    var clean = multiExpression.replace(/[+\-]+$/, '')
    var parts = clean.split('+').filter(function (s) { return s })
    var amounts = parts.map(function (s) {
      var subParts = s.split('-')
      var sub = parseFloat(subParts[0]) || 0
      for (var i = 1; i < subParts.length; i++) {
        sub -= parseFloat(subParts[i]) || 0
      }
      return sub
    })
    var validAmounts = amounts.filter(function (a) { return a > 0 })
    if (!validAmounts.length) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }

    try {
      var total = validAmounts.reduce(function (s, a) { return s + parseFloat(a.toFixed(2)) }, 0)
      var today = (new Date().getFullYear()) + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0')
      var itemType = multiType === 'income' ? 'in' : 'out'
      var itemTypeLabel = multiType === 'income' ? '收入' : '支出'
      var td = this._getBookTargetDefaults(multiScope, multiType)
      var item = {
        id: api.generateId(),
        type: itemType,
        typeLabel: itemTypeLabel,
        amount: parseFloat(total.toFixed(2)),
        category: '多笔记账',
        date: today,
        note: multiNote,
        target: td.target,
        targetType: td.targetType,
        scope: multiScope,
        isMulti: true,
        multiItems: validAmounts.map(function (a) { return { amount: parseFloat(a.toFixed(2)) } }),
        multiCount: validAmounts.length,
        multiDateStart: multiStartDate,
        multiDateEnd: multiUseDateRange ? multiEndDate : '',
      }
      api.addItem(multiScope, item)

      this.initDetailItems()
      this._syncOverviewCards()
      this._calcOverviewData()

      wx.showModal({
        title: '记账成功',
        content: '已记 ' + validAmounts.length + ' 笔，共 ¥' + parseFloat(total.toFixed(2)),
        confirmText: '结束记账',
        cancelText: '继续记账',
        success: function (res) {
          if (res.confirm) {
            self.setData({
              showBookPopup: false,
              bookPhoto: '',
              multiExpression: '',
              multiResult: '0.00',
              multiCount: 0,
              multiNote: '',
            })
            self._redrawReportCharts()
          } else {
            self.setData({
              multiExpression: '',
              multiResult: '0.00',
              multiCount: 0,
              multiNote: '',
            })
          }
        }
      })
    } catch (err) {
      wx.showModal({
        title: '保存失败',
        content: err.message || '未知错误',
        showCancel: false
      })
    }
  },

  onBookClose() {
    playTap()
    if (this.data.showBookCatPanel) {
      this.setData({ showBookCatPanel: false })
    } else {
      this.setData({ showBookPopup: false, bookPhoto: '' })
      this._redrawReportCharts()
    }
  },

  onBookTypeSelect(e) {
    playTap()
    const type = e.currentTarget.dataset.type
    const typeLabelMap = { income: '收入', expense: '支出', payForward: '垫付', payable: '应付' }
    const td = this._getBookTargetDefaults(this.data.bookScope, type)
    this.setData({
      'bookForm.type': type,
      'bookForm.category': '',
      'bookForm.target': td.target,
      'bookForm.targetType': td.targetType,
      bookTypeLabel: typeLabelMap[type] || '支出',
    })
    if (this.data.showBookCatPanel) this.refreshBookCatPanel()
    this._onSpotlightAction()
  },

  onBookCatSelect(e) {
    playTap()
    this.setData({ 'bookForm.category': e.currentTarget.dataset.cat })
  },

  onBookOpenCatPanel() {
    playTap()
    this.refreshBookCatPanel()
    this.setData({ showBookCatPanel: true })
    this._onSpotlightAction()
  },

  refreshBookCatPanel() {
    const scope = this.data.bookScope
    const type = this.data.bookForm.type
    const source = scope === 'personal' ? this.data.personalCategories : this.data.companyCategories
    const inOut = { income: 'in', expense: 'out', payForward: 'payForward', payable: 'payable' }[type] || 'out'
    this.setData({ bookCatPanelData: source.filter(item => item.inOut === inOut) })
  },

  onBookCatPanelSelect(e) {
    playTap()
    this.setData({
      'bookForm.category': e.currentTarget.dataset.cat,
      showBookCatPanel: false,
    })
    setTimeout(() => this.onBookTargetTap(), 200)
  },

  onBookAmountInput(e) {
    this.setData({ 'bookForm.amount': e.detail.value })
  },

  onBookKey(e) {
    playTap()
    // 多笔记账模式
    if (this.data.bookMode === 'multi') {
      const key = e.currentTarget.dataset.key
      let expr = this.data.multiExpression || ''
      if (key === 'C') {
        this.setData({ multiExpression: '', multiResult: '0.00', multiCount: 0 })
        return
      }
      if (key === 'del') {
        expr = expr.slice(0, -1)
      } else if (key === '+' || key === '-') {
        if (!expr && key === '+') return
        if (expr && (expr.endsWith('+') || expr.endsWith('-'))) {
          expr = expr.slice(0, -1) + key
        } else {
          expr += key
        }
      } else if (key === '.') {
        const lastNum = expr.split(/[+\-]/).pop()
        if (lastNum.includes('.')) return
        expr += expr ? '.' : '0.'
      } else {
        expr += key
      }
      const update = this._calcMulti(expr)
      update.multiExpression = expr
      this.setData(update)
      return
    }

    // 普通记账模式
    const key = e.currentTarget.dataset.key
    let amount = this.data.bookForm.amount || ''
    if (key === 'del') {
      amount = amount.slice(0, -1)
    } else if (key === '.') {
      if (!amount.includes('.')) {
        amount += amount ? '.' : '0.'
      }
    } else {
      // 限制小数点后两位
      const parts = amount.split('.')
      if (parts.length === 2 && parts[1].length >= 2) return
      // 限制最多9位
      if (amount.replace('.', '').length >= 9) return
      amount += key
    }
    this.setData({ 'bookForm.amount': amount })
  },

  onBookNoteInput(e) {
    this.setData({ 'bookForm.note': e.detail.value })
  },

  onBookTargetTap() {
    playTap()
    const scope = this.data.bookScope
    const type = this.data.bookForm.type
    const defaults = this._getBookTargetDefaults(scope, type)
    const internalName = scope === 'personal' ? '公司' : '个人'

    if (defaults.targetType === 'internal') {
      wx.showActionSheet({
        itemList: [internalName, '外部'],
        success: (res) => {
          if (res.tapIndex === 0) {
            this.setData({ 'bookForm.target': internalName, 'bookForm.targetType': 'internal' })
          } else {
            this.setData({ 'bookForm.target': '外部', 'bookForm.targetType': 'external' })
          }
        }
      })
    } else {
      wx.showActionSheet({
        itemList: ['外部', internalName],
        success: (res) => {
          if (res.tapIndex === 0) {
            this.setData({ 'bookForm.target': '外部', 'bookForm.targetType': 'external' })
          } else {
            this.setData({ 'bookForm.target': internalName, 'bookForm.targetType': 'internal' })
          }
        }
      })
    }
  },

  onBookDateChange(e) {
    playTap()
    this.setData({ 'bookForm.date': e.detail.value })
  },

  onBookSave() {
    try { playTap() } catch (_) {}

    var self = this
    var form = this.data.bookForm || {}
    var type = form.type
    var amount = form.amount
    var category = form.category
    var date = form.date
    var note = form.note
    var target = form.target
    var targetType = form.targetType

    if (!amount || parseFloat(amount) <= 0) {
      wx.showToast({ title: '请输入金额', icon: 'none' })
      return
    }
    if (parseFloat(amount) >= 10000000) {
      wx.showToast({ title: '单笔金额不能超过千万', icon: 'none' })
      return
    }
    if (!category) {
      wx.showToast({ title: '请选择分类', icon: 'none' })
      return
    }
    if ((type === 'payForward' || type === 'payable') && !target) {
      wx.showToast({ title: '请选择对象', icon: 'none' })
      return
    }

    try {
      var voucher = ''
      if (this.data.bookPhoto) {
        try { voucher = wx.getFileSystemManager().saveFileSync(this.data.bookPhoto) }
        catch (e) { voucher = this.data.bookPhoto }
      }
      var typeLabelMap = { income: '收入', expense: '支出', payForward: '垫付', payable: '应付' }
      var itemType = type === 'income' ? 'in' : 'out'
      var newItem = {
        id: api.generateId(),
        category: category,
        type: itemType,
        typeLabel: typeLabelMap[type] || '支出',
        scope: this.data.bookScope,
        amount: parseFloat(amount).toFixed(2),
        date: date,
        note: note || '',
        target: target || '',
        targetType: targetType || 'external',
        voucher: voucher,
      }
      var scope = this.data.bookScope

      if (targetType === 'internal' && (type === 'payForward' || type === 'payable')) {
        var mirrorScope = scope === 'personal' ? 'company' : 'personal'
        var mirrorTypeLabel = type === 'payForward' ? '应付' : '垫付'
        var mirrorType = mirrorTypeLabel === '应付' ? 'out' : 'in'
        var mirrorItem = {
          id: api.generateId(),
          category: category,
          type: mirrorType,
          typeLabel: mirrorTypeLabel,
          scope: mirrorScope,
          amount: parseFloat(amount).toFixed(2),
          date: date,
          note: note || '',
          target: scope === 'personal' ? (this.data.userInfo && this.data.userInfo.nickName || '个人') : ((api.getCompanyInfo() || {}).companyName || '公司'),
          targetType: 'internal',
          linkedId: newItem.id,
        }
        newItem.linkedId = mirrorItem.id
        api.addLinkedItems(scope, newItem, mirrorScope, mirrorItem)
      } else {
        api.addItem(scope, newItem)
      }

      this.initDetailItems()
      this._syncOverviewCards()
      this._calcOverviewData()
      this._onSpotlightAction()

      var _typeLabel = typeLabelMap[type] || '支出'
      var _amountText = parseFloat(amount).toFixed(2)
      wx.showModal({
        title: '记账成功',
        content: _typeLabel + ' ¥' + _amountText,
        confirmText: '结束记账',
        cancelText: '继续记账',
        success: function (res) {
          if (res.confirm) {
            self.setData({ showBookPopup: false, bookPhoto: '' })
            self._redrawReportCharts()
          } else {
            self.setData({
              'bookForm.amount': '',
              'bookForm.note': '',
              'bookForm.category': '',
              bookPhoto: '',
            })
          }
        }
      })
    } catch (err) {
      wx.showModal({
        title: '保存失败',
        content: err.message || '未知错误',
        showCancel: false
      })
    }
  },

  onModalClose() {
    playTap()
    this.setData({ modalItem: null })
  },

  _formatSettleTime() {
    const d = new Date()
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const da = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${y}年${mo}月${da}日 ${h}:${mi}`
  },

  _todayDate() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  },

  onBillSettle(e) {
    playTap()
    const id = e.currentTarget.dataset.id
    const from = e.currentTarget.dataset.from || 'detail'
    const itemsKey = from === 'settle' ? 'settleItems' : 'detailItems'
    const found = this.data[itemsKey].find(item => item.id === id)
    if (!found) return

    const ci = api.getCompanyInfo()
    const isBoss = !!(ci && ci.companyRole === 'boss')
    const isPending = found.settleStatus === 'pending_confirm' || found.settleStatus === 'company_settled'

    // 垫付 + pending → 员工确认到账
    if (found.typeLabel === '垫付' && isPending) {
      this.onBillConfirmSettle(e)
      return
    }

    // 应付 + pending → boss 确认收款
    if (found.typeLabel === '应付' && isPending) {
      if (!isBoss) {
        wx.showToast({ title: '仅公司管理员可确认收款', icon: 'none' })
        return
      }
      this.onBillConfirmSettle(e)
      return
    }

    // 垫付 + 无状态 → boss 发起结清
    if (found.typeLabel === '垫付') {
      if (!isBoss) {
        wx.showToast({ title: '仅公司管理员可发起垫付结清', icon: 'none' })
        return
      }
      wx.showModal({
        title: '发起结清',
        content: '发起后需等待对方确认到账，确定吗？',
        success: async (res) => {
          if (!res.confirm) return
          await this._doSettle(found, from)
        },
      })
      return
    }

    // 应付 + 无状态 → 员工发起结清
    if (found.typeLabel !== '应付') return

    wx.showModal({
      title: '发起结清',
      content: '发起后需等待公司管理员确认，确定吗？',
      success: async (res) => {
        if (!res.confirm) return
        await this._doSettle(found, from)
      },
    })
  },

  async _doSettle(found, from, skipRefresh) {
    // 服务端权威：只把应付 id 交给后端，boss/员工分支、镜像、自动记录、通知全在服务端处理
    try {
      await api.settleItem(found.id)
    } catch (e) {
      wx.showToast({ title: '发起失败，请重试', icon: 'none' })
      return false
    }

    if (!skipRefresh) {
      await api.refreshItems()
      this.initSettleItems()
      this.initDetailItems()
      this.setData({ modalItem: null })
      this._calcOverviewData()
      wx.showToast({ title: '已发起结清，等待对方确认', icon: 'success' })
    }
    return true
  },

  onBillConfirmSettle(e) {
    playTap()
    const id = e.currentTarget.dataset.id
    const from = e.currentTarget.dataset.from || 'settle'
    const itemsKey = from === 'settle' ? 'settleItems' : 'detailItems'
    const found = this.data[itemsKey].find(item => item.id === id)
    const validStatus = found && (found.settleStatus === 'pending_confirm' || found.settleStatus === 'company_settled')
    if (!validStatus) return

    const isPayForward = found.typeLabel === '垫付'
    const title = isPayForward ? '确认到账' : '确认收款'
    const content = isPayForward
      ? '确认资金已到账？一旦确认将视为结清。'
      : '确认已收到该笔款项？一旦确认将视为结清。'

    wx.showModal({
      title,
      content,
      success: async (res) => {
        if (!res.confirm) return
        try {
          await api.settleConfirm(found.id)
        } catch (e) {
          wx.showToast({ title: '确认失败，请重试', icon: 'none' })
          return
        }
        await api.refreshItems()
        this.initSettleItems()
        this.initDetailItems()
        this.setData({ modalItem: null })
        this._calcOverviewData()
        wx.showToast({ title: '已确认结清', icon: 'success' })
      },
    })
  },

  onBillDelete(e) {
    playTap()
    const id = e.currentTarget.dataset.id
    const from = e.currentTarget.dataset.from || 'detail'
    const itemsKey = from === 'settle' ? 'settleItems' : 'detailItems'
    const found = this.data[itemsKey].find(item => item.id === id)
    if (found && found.scope === 'company') {
      wx.showToast({ title: '公司账本记录不可删除', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复',
      success: (res) => {
        if (res.confirm) {
          this._removeItem(id, from)
          this.setData({ modalItem: null })
        }
      },
    })
  },

  onBillVoid(e) {
    playTap()
    const id = e.currentTarget.dataset.id
    const from = e.currentTarget.dataset.from || 'detail'
    wx.showModal({
      title: '确认作废',
      content: '作废后仍可取消作废，确定吗？',
      success: (res) => {
        if (!res.confirm) return
        const itemsKey = from === 'settle' ? 'settleItems' : 'detailItems'
        const found = this.data[itemsKey].find(item => item.id === id)
        // 更新原始记录
        api.updateItem(id, { _voided: true })
        // 级联更新镜像记录
        const mirrorId = found && found.linkedId
        if (mirrorId) {
          api.updateItem(mirrorId, { _voided: true })
        }
        const updated = this.data[itemsKey].map(item => {
          if (item.id === id || item.id === mirrorId) return { ...item, _voided: true, _open: false }
          return { ...item }
        })
        const patch2 = { [itemsKey]: updated, modalItem: null }
        if (itemsKey === 'detailItems') patch2.detailGroups = this._buildDetailGroups(updated)
        this.setData(patch2)
        this._calcOverviewData()
      },
    })
  },

  onBillUnvoid(e) {
    playTap()
    const id = e.currentTarget.dataset.id
    const from = e.currentTarget.dataset.from || 'detail'
    wx.showModal({
      title: '取消作废',
      content: '确定要恢复此记录吗？',
      success: (res) => {
        if (!res.confirm) return
        const itemsKey = from === 'settle' ? 'settleItems' : 'detailItems'
        const found = this.data[itemsKey].find(item => item.id === id)
        // 更新原始记录
        api.updateItem(id, { _voided: false })
        // 级联更新镜像记录
        const mirrorId = found && found.linkedId
        if (mirrorId) {
          api.updateItem(mirrorId, { _voided: false })
        }
        const updated2 = this.data[itemsKey].map(item => {
          if (item.id === id || item.id === mirrorId) return { ...item, _voided: false, _open: false }
          return { ...item }
        })
        const patch2 = { [itemsKey]: updated2, modalItem: null }
        if (itemsKey === 'detailItems') patch2.detailGroups = this._buildDetailGroups(updated2)
        this.setData(patch2)
        this._calcOverviewData()
      },
    })
  },

  _removeItem(id, from) {
    const itemsKey = from === 'settle' ? 'settleItems' : 'detailItems'
    const found = this.data[itemsKey].find(item => item.id === id)
    api.removeItem(id)
    // 级联删除镜像记录
    if (found && found.linkedId) {
      api.removeItem(found.linkedId)
    }
    const list = this.data[itemsKey].filter(item => item.id !== id && item.id !== (found && found.linkedId))
    const patch = { [itemsKey]: list }
    if (itemsKey === 'detailItems') patch.detailGroups = this._buildDetailGroups(list)
    this.setData(patch)
    this._calcOverviewData()
  },

  goOverview() {
    playTap()
    this._syncOverviewCards()
    this.setData({ showOverview: true, showCustomOverview: false, showCustomCategory: false })
  },

  // ---- 明细 ----
  switchDetailType() {
    playTap()
    this._onSpotlightAction()
    if (this.data.detailType === 0) {
      const ci = api.getCompanyInfo()
      if (!(ci && ci.companyRole === 'boss' && ci.companyUid)) {
        wx.showToast({ title: '公司账本仅企业管理员可见', icon: 'none' })
        return
      }
    }
    const nextDetailType = this.data.detailType === 0 ? 1 : 0
    this.setData({ detailType: nextDetailType, currentMode: nextDetailType })
    this.initDetailItems()
  },

  switchDetailPeriod(e) {
    playTap()
    const period = parseInt(e.currentTarget.dataset.period)
    this.setData({ detailPeriod: period })
    this.updateDetailDate()
    this.initDetailItems()
  },

  onDetailPickerChange(e) {
    playTap()
    const val = e.detail.value
    const { detailPeriod } = this.data
    if (detailPeriod === 0) {
      const [y, m] = val.split('-')
      this.setData({ detailPickerDate: val, detailDateText: `${y}年${m}月` })
    } else if (detailPeriod === 2) {
      const m = new Date().getMonth() + 1
      const mm = String(m).padStart(2, '0')
      this.setData({ detailPickerDate: val, detailDateText: `${val}年（截至${mm}月）` })
    } else if (detailPeriod === 3) {
      const [y, m, d] = val.split('-')
      this.setData({ detailPickerDate: val, detailDateText: `${y}年${m}月${d}日` })
    }
    this.initDetailItems()
  },

  onDetailQuarterChange(e) {
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
      reportQuarterMultiIndex: [yearIdx, quarterIdx],
      reportSelectedYear: parseInt(year),
      detailDateText: `${year}年${quarter}`,
    })
    this.initDetailItems()
  },

  updateDetailDate() {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    const d = now.getDate()
    const mm = String(m).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    const quarters = ['1季度', '2季度', '3季度', '4季度']
    const q = quarters[Math.floor((m - 1) / 3)]

    switch (this.data.detailPeriod) {
      case 0: this.setData({ detailPickerDate: `${y}-${mm}`, detailDateText: `${y}年${mm}月` }); break
      case 1: this.setData({ detailDateText: `${y}年${q}` }); break
      case 2: this.setData({ detailPickerDate: `${y}`, detailDateText: `${y}年（截至${mm}月）` }); break
      case 3: this.setData({ detailPickerDate: `${y}-${mm}-${dd}`, detailDateText: `${y}年${mm}月${dd}日` }); break
    }
  },

  // 明细列表预处理：① 按分类名附分类 emoji（_icon，未知回退 📌）② 排序：日期倒序为主（新日期在前），同一天内按 id（UUID 十六进制字符串）倒序
  // 顶部搜索：匹配明细的全字段（日期/类型/分类/对象/金额/备注/状态），大小写不敏感
  _matchSearch(it, q) {
    if (!q) return true
    const status = it._voided ? '已作废'
      : (it.settleStatus === 'settled') ? '已结清'
      : (it.settleStatus === 'pending_confirm' || it.settleStatus === 'company_settled') ? '待确认' : ''
    const hay = [it.date, it.typeLabel, it.category, it.target, it.amount, it.note, status]
      .map(v => (v === null || v === undefined) ? '' : String(v)).join(' ').toLowerCase()
    return hay.indexOf(q) !== -1
  },

  _buildDetailList(scope, items) {
    const cats = api.getCategories(scope) || (scope === 'company' ? this.data.companyCategories : this.data.personalCategories) || []
    const map = {}
    cats.forEach(c => { if (c && c.name) map[c.name] = c.emoji || '' })
    const q = (this.data.searchText || '').trim().toLowerCase()
    return (items || [])
      .filter(it => this._matchSearch(it, q))
      .map(it => ({ ...it, _icon: map[it.category] || '📌' }))
      .sort((a, b) => {
        const da = (a.date || '').slice(0, 10), db2 = (b.date || '').slice(0, 10)
        if (da !== db2) return da < db2 ? 1 : -1
        return (Number(b.id) || 0) - (Number(a.id) || 0)
      })
  },

  _buildDetailGroups(items) {
    var groups = []
    var currentDate = ''
    var currentGroup = null
    for (var i = 0; i < items.length; i++) {
      var item = items[i]
      var dateStr = (item.date || '').slice(0, 10)
      if (dateStr !== currentDate) {
        currentDate = dateStr
        var parts = dateStr.split('-')
        var label = parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日'
        currentGroup = { dateLabel: label, items: [] }
        groups.push(currentGroup)
      }
      currentGroup.items.push(item)
    }
    return groups
  },

  // 详情弹窗用的完整时间（到秒）：从 settleInfo 解析到分钟；没有则只显示日期
  _billTimeText(it) {
    if (!it) return ''
    const d = (it.date || '').slice(0, 10)
    const pad = n => String(n).padStart(2, '0')
    const idn = Number(it.id)
    if (idn >= 1e12) {
      const t = new Date(idn)
      return `${d} ${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`
    }
    const m = it.settleInfo && String(it.settleInfo).match(/(\d{1,2}):(\d{2})/)
    if (m) return `${d} ${pad(Number(m[1]))}:${m[2]}:00`
    return d
  },

  initDetailItems() {
    const scope = this.data.detailType === 1 ? 'company' : 'personal'
    // 明细只展示原始记账：隐藏后端结清生成的自动对账记录（_autoSettle）；统计口径不受影响（仍用 api.getItems 全量）
    const list = api.getItems(scope).filter(it => !it._autoSettle)
    var items = this._buildDetailList(scope, list)
    this.setData({ detailItems: items, detailGroups: this._buildDetailGroups(items) })
  },

  initSettleItems() {
    const scope = this.data.settleType === 1 ? 'company' : 'personal'
    const items = api.getItems(scope)
    const filtered = items.filter(item =>
      (item.typeLabel === '垫付' || item.typeLabel === '应付') &&
      item.settleStatus !== 'settled'
    )
    const ci = api.getCompanyInfo()
    this.setData({
      settleItems: filtered.map(item => ({ ...item })),
      settleIsBoss: !!(ci && ci.companyRole === 'boss')
    })
  },

  // ---- 自定义分类 ----
  onCustomCategoryEntry() {
    playTap()
    this.setData({ showCustomCategory: true })
  },

  onCustomCategoryBack() {
    playTap()
    this.setData({ showCustomCategory: false })
  },

  // ---- 导出账单 ----
  // ---- 我的页图标入口 ----
  // ---- 账本页数据 ----
  }
}

module.exports = createMethods
