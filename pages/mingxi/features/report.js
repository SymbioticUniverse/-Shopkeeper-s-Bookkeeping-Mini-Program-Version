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
  drawStockChart(ctx, w, h, chartData, selectedIdx) {
    const dk = this.data.isDarkMode
    const C = { bg: dk ? '#1e1e2e' : '#fff', text: '#a0a0a0', grid: dk ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', border: dk ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)', line: dk ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.7)', dot: dk ? '#ccc' : '#333', tipBg: dk ? 'rgba(30,30,46,0.96)' : 'rgba(255,255,255,0.96)', sep: dk ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }
    // Background
    ctx.fillStyle = C.bg
    ctx.fillRect(0, 0, w, h)

    if (!chartData || chartData.length === 0) {
      ctx.fillStyle = C.text
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('暂无数据', w / 2, h / 2)
      return
    }

    const ml = 42, mr = 14, mt = 24, mb = 24
    const pw = w - ml - mr
    const ph = h - mt - mb

    // Find Y range (adaptive)
    const nets = chartData.map(d => d.net)
    const rawMax = Math.max(Math.abs(Math.max(...nets)), Math.abs(Math.min(...nets)), 1)
    const mag = Math.pow(10, Math.floor(Math.log10(rawMax)))
    const yMax = Math.ceil(rawMax / mag) * mag
    const yMin = -yMax

    function toX(i) { return ml + (i / Math.max(1, chartData.length - 1)) * pw }
    function toY(v) { return mt + ph / 2 - (v / yMax) * (ph / 2) }
    const zeroY = mt + ph / 2

    // Grid lines + Y labels
    ctx.fillStyle = C.text
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'right'
    const steps = 4
    const fmtY = (v) => {
      const abs = Math.abs(v)
      if (abs >= 10000) return (v / 1000).toFixed(0) + 'k'
      if (abs >= 1000) return (v / 1000).toFixed(1) + 'k'
      return String(Math.round(v))
    }
    for (let i = 0; i <= steps; i++) {
      const val = yMin + ((yMax - yMin) / steps) * i
      const gy = toY(val)
      ctx.strokeStyle = C.grid
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(ml, gy); ctx.lineTo(w - mr, gy); ctx.stroke()
      ctx.fillText(fmtY(val), ml - 6, gy + 3)
    }

    // Zero line
    ctx.strokeStyle = C.border
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(ml, zeroY); ctx.lineTo(w - mr, zeroY); ctx.stroke()

    // X labels
    ctx.fillStyle = C.text
    ctx.textAlign = 'center'
    const step = Math.max(1, Math.floor(chartData.length / 7))
    for (let i = 0; i < chartData.length; i += step) {
      ctx.fillText(chartData[i].label, toX(i), h - 4)
    }

    // Connecting line
    ctx.strokeStyle = C.line
    ctx.lineWidth = 1.2
    ctx.lineJoin = 'round'
    ctx.beginPath()
    for (let i = 0; i < chartData.length; i++) {
      const x = toX(i), y = toY(chartData[i].net)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Blocks + dots
    const blockW = Math.min(6, Math.max(2, pw / chartData.length * 0.28))
    for (let i = 0; i < chartData.length; i++) {
      const { income, expense, net } = chartData[i]
      const cx = toX(i)
      const fy = toY(net)
      const ratio = income / (income + expense || 1)
      const totalH = Math.min(18, ph * 0.08)
      const gH = Math.max(2, totalH * ratio)
      const rH = Math.max(2, totalH - gH)

      ctx.fillStyle = '#ef4444'
      ctx.fillRect(cx - blockW / 2, fy - gH, blockW, gH)

      ctx.fillStyle = '#333333'
      ctx.fillRect(cx - blockW / 2, fy, blockW, rH)

      ctx.fillStyle = C.dot
      ctx.beginPath()
      ctx.arc(cx, fy, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Legend
    const lx = ml, ly = 10
    ctx.fillStyle = '#ef4444'
    ctx.fillRect(lx, ly, 8, 8)
    ctx.fillStyle = C.text
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('收入', lx + 12, ly + 8)

    ctx.fillStyle = '#333333'
    ctx.fillRect(lx + 52, ly, 8, 8)
    ctx.fillText('支出', lx + 64, ly + 8)

    ctx.fillStyle = C.dot
    ctx.beginPath()
    ctx.arc(lx + 104, ly + 4, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = C.text
    ctx.fillText('净值', lx + 112, ly + 8)

    // Tooltip
    if (selectedIdx != null && chartData[selectedIdx]) {
      const pt = chartData[selectedIdx]
      const cx = toX(selectedIdx), cy = toY(pt.net)
      const tipW = 130, tipH = 86
      let tipX = cx + 12, tipY = cy - tipH - 10
      // Keep within bounds horizontally
      if (tipX + tipW > w - mr) tipX = cx - tipW - 12
      if (tipX < ml) tipX = cx + 12
      // Vertically: prefer above, fallback below, then clamp
      if (tipY < mt) tipY = cy + 14
      if (tipY + tipH > h) tipY = h - tipH - 2
      if (tipY < mt) tipY = mt + 2

      // Tooltip bg
      ctx.fillStyle = C.tipBg
      ctx.strokeStyle = C.border
      ctx.lineWidth = 1
      ctx.beginPath()
      const r = 6
      ctx.moveTo(tipX + r, tipY)
      ctx.lineTo(tipX + tipW - r, tipY)
      ctx.arcTo(tipX + tipW, tipY, tipX + tipW, tipY + r, r)
      ctx.lineTo(tipX + tipW, tipY + tipH - r)
      ctx.arcTo(tipX + tipW, tipY + tipH, tipX + tipW - r, tipY + tipH, r)
      ctx.lineTo(tipX + r, tipY + tipH)
      ctx.arcTo(tipX, tipY + tipH, tipX, tipY + tipH - r, r)
      ctx.lineTo(tipX, tipY + r)
      ctx.arcTo(tipX, tipY, tipX + r, tipY, r)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Tip text
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'left'

      // Net value (prominent)
      const netColor = pt.net >= 0 ? '#ef4444' : '#333333'
      ctx.fillStyle = C.text
      ctx.fillText('净值', tipX + 8, tipY + 14)
      ctx.fillStyle = netColor
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText('¥' + pt.net, tipX + 50, tipY + 14)
      ctx.font = '10px sans-serif'

      // Divider
      ctx.strokeStyle = C.sep
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(tipX + 8, tipY + 20); ctx.lineTo(tipX + tipW - 8, tipY + 20); ctx.stroke()

      const rows = [
        { label: '收入', val: pt.income, color: '#ef4444' },
        { label: '支出', val: pt.expense, color: '#333333' },
        { label: '应收', val: pt.receivable, color: '#ef4444' },
        { label: '应付', val: pt.payable, color: '#333333' },
      ]
      rows.forEach((row, i) => {
        const ry = tipY + 34 + i * 15
        ctx.fillStyle = C.text
        ctx.fillText(row.label, tipX + 8, ry)
        ctx.fillStyle = row.color
        ctx.font = 'bold 10px sans-serif'
        ctx.fillText('¥' + row.val, tipX + 50, ry)
        ctx.font = '10px sans-serif'
      })

      // Highlight dot
      ctx.fillStyle = '#ffd700'
      ctx.beginPath()
      ctx.arc(cx, cy, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // Save for hit testing
    this._chartData = chartData
    this._chartLayout = { ml, pw, w, h }
  },

  // ---- 柱状图 ----
  drawBarChart(ctx, w, h, chartData) {
    const dk = this.data.isDarkMode
    const C = { bg: dk ? '#1e1e2e' : '#fff', text: '#a0a0a0', grid: dk ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', sep: dk ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }
    // Background
    ctx.fillStyle = C.bg
    ctx.fillRect(0, 0, w, h)

    if (!chartData || chartData.length === 0) {
      ctx.fillStyle = C.text
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('暂无数据', w / 2, h / 2)
      return
    }

    const ml = 42, mr = 14, mt = 24, mb = 24
    const pw = w - ml - mr
    const ph = h - mt - mb

    // Y range (adaptive)
    const maxVal = Math.max(
      Math.max(...chartData.map(d => d.income)),
      Math.max(...chartData.map(d => d.expense)),
      1
    )
    const mag = Math.pow(10, Math.floor(Math.log10(maxVal || 1)))
    const yMax = Math.ceil(maxVal / mag) * mag

    const barW = Math.min(8, Math.max(2, pw / chartData.length * 0.4))
    const gap = barW * 0.25
    const groupW = barW * 2 + gap
    const bottomY = mt + ph

    // Fixed group spacing so few data points don't spread across entire width
    const groupSpacing = Math.min(pw / Math.max(1, chartData.length - 1), groupW * 3)
    const totalW = groupSpacing * (chartData.length - 1) + groupW
    const startX = ml + (pw - totalW) / 2 + groupW / 2
    function toX(i) { return startX + i * groupSpacing }
    function toY(v) { return bottomY - (v / yMax) * ph }

    // Grid lines + Y labels
    ctx.fillStyle = C.text
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'right'
    const steps = 4
    const fmtY = (v) => {
      if (v >= 10000) return (v / 1000).toFixed(0) + 'k'
      if (v >= 1000) return (v / 1000).toFixed(1) + 'k'
      return String(Math.round(v))
    }
    for (let i = 0; i <= steps; i++) {
      const val = (yMax / steps) * i
      const gy = toY(val)
      ctx.strokeStyle = C.grid
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(ml, gy); ctx.lineTo(w - mr, gy); ctx.stroke()
      ctx.fillText(fmtY(val), ml - 6, gy + 3)
    }

    // X labels
    ctx.fillStyle = C.text
    ctx.textAlign = 'center'
    const step = Math.max(1, Math.floor(chartData.length / 7))
    for (let i = 0; i < chartData.length; i += step) {
      ctx.fillText(chartData[i].label, toX(i), h - 4)
    }

    // Vertical dashed separators between groups
    ctx.strokeStyle = C.sep
    ctx.lineWidth = 1
    ctx.setLineDash([3, 4])
    for (let i = 1; i < chartData.length; i++) {
      const sx = (toX(i - 1) + toX(i)) / 2
      ctx.beginPath()
      ctx.moveTo(sx, mt)
      ctx.lineTo(sx, bottomY)
      ctx.stroke()
    }
    ctx.setLineDash([])

    // Bars — both rise from bottom
    for (let i = 0; i < chartData.length; i++) {
      const { income, expense } = chartData[i]
      const cx = toX(i)
      const incomeH = Math.max(1, (income / yMax) * ph)
      const expenseH = Math.max(1, (expense / yMax) * ph)

      // Income bar (left side)
      ctx.fillStyle = '#ef4444'
      ctx.fillRect(cx - barW - gap / 2, bottomY - incomeH, barW, incomeH)

      // Expense bar (right side)
      ctx.fillStyle = '#333333'
      ctx.fillRect(cx + gap / 2, bottomY - expenseH, barW, expenseH)
    }

    // Legend
    const lx = ml, ly = 10
    ctx.fillStyle = '#ef4444'
    ctx.fillRect(lx, ly, 8, 8)
    ctx.fillStyle = C.text
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('收入', lx + 12, ly + 8)
    ctx.fillStyle = '#333333'
    ctx.fillRect(lx + 52, ly, 8, 8)
    ctx.fillText('支出', lx + 64, ly + 8)
  },

  // ---- 饼状图 ----
  generatePieData(optScope) {
    const scope = optScope || (this.data.reportType === 1 ? 'company' : 'personal')
    const stored = api.getItems(scope)
    if (stored.length === 0) return { income: [], expense: [] }

    // Filter items by scope and period, then aggregate by category
    const incomeMap = {}
    const expenseMap = {}

    stored.forEach(item => {
      if (!this._inReportRange(item)) return

      const amount = parseFloat(item.amount) || 0
      const cat = item.category || '未分类'

      if (item.type === 'in') {
        incomeMap[cat] = (incomeMap[cat] || 0) + amount
      } else {
        expenseMap[cat] = (expenseMap[cat] || 0) + amount
      }
    })

    const toSegments = (map) => {
      const items = Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) }))
      items.sort((a, b) => b.value - a.value)
      const TOP_N = 6
      const top = items.slice(0, TOP_N)
      const rest = items.slice(TOP_N).reduce((s, it) => s + it.value, 0)
      if (rest > 0) top.push({ name: '其他', value: rest })
      return top
    }

    return {
      income: toSegments(incomeMap),
      expense: toSegments(expenseMap),
    }
  },

  // ===== 报表筛选汇总：总收入/支出/结余 + 分类拆解 =====
  // 预留鉴权接口：分类拆解后期可做成 VIP 能力。现返回 true 表示全部解锁；
  // 接入登录态 / 会员后改为真实判断即可，例如 return !!(api.isVip && api.isVip())
  _canUseProSummary() {
    return api.isVip()
  },

  // 当前报表筛选范围判定：月(YYYY-MM)/年(YYYY)/日(YYYY-MM-DD)看 reportPickerDate；季看 reportSelectedYear + reportQuarterMultiIndex[1]
  _inReportRange(it) {
    const date = (it && it.date ? String(it.date) : '').slice(0, 10)
    if (!date) return false
    const { reportPeriod, reportPickerDate } = this.data
    if (reportPeriod === 0) return date.slice(0, 7) === reportPickerDate
    if (reportPeriod === 2) return date.slice(0, 4) === String(reportPickerDate)
    if (reportPeriod === 3) return date === reportPickerDate
    // 季度
    const y = this.data.reportSelectedYear
    const q = (this.data.reportQuarterMultiIndex || [0, 0])[1]
    if (parseInt(date.slice(0, 4)) !== parseInt(y)) return false
    const mo = parseInt(date.slice(5, 7))
    return mo >= q * 3 + 1 && mo <= q * 3 + 3
  },

  // 口径同简览(_calcOverviewData)：收入=收入；支出=支出+垫付；结余=收入-支出；排除作废
  _updateReportSummary() {
    const scope = this.data.reportType === 1 ? 'company' : 'personal'
    const ranged = (api.getItems(scope) || []).filter(it => this._inReportRange(it))
    const pro = this._canUseProSummary()

    const isIncome = (it) => it.typeLabel === '收入'
    const isExpense = (it) => it.typeLabel === '支出' || it.typeLabel === '垫付'
    const sum = (fn) => ranged.filter(fn).reduce((s, it) => s + (parseFloat(it.amount) || 0), 0)
    const income = sum(isIncome)
    const expense = sum(isExpense)
    const balance = income - expense

    let incomeCats = []
    let expenseCats = []
    if (pro) {
      const cats = api.getCategories(scope) || []
      const emojiOf = {}
      cats.forEach(c => { if (c && c.name) emojiOf[c.name] = c.emoji || '📌' })
      const build = (fn, total) => {
        const map = {}
        ranged.filter(fn).forEach(it => {
          const name = it.category || '未分类'
          map[name] = (map[name] || 0) + (parseFloat(it.amount) || 0)
        })
        return Object.keys(map).map(name => ({
          name,
          emoji: emojiOf[name] || '📌',
          amount: map[name].toFixed(2),
          pct: total > 0 ? Math.round(map[name] / total * 100) : 0
        })).sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
      }
      incomeCats = build(isIncome, income)
      expenseCats = build(isExpense, expense)
    }

    var fmt = function (n) {
      var abs = Math.abs(n)
      var sign = n < 0 ? -1 : 1
      if (abs >= 10000) return (sign * Math.floor(abs / 1000) / 10).toFixed(1) + 'W'
      if (abs >= 1000) return (sign * Math.floor(abs / 100) / 10).toFixed(1) + 'k'
      return n.toFixed(2)
    }

    this.setData({
      reportSummary: {
        income: fmt(income),
        expense: fmt(expense),
        balance: fmt(balance),
        balanceNeg: balance < 0,
        incomeCats,
        expenseCats,
        proUnlocked: pro,
        empty: ranged.length === 0
      }
    })
  },

  // 报表图表三合一：点击切换，折线/柱状/饼图共用同一区域
  switchReportChart(e) {
    playTap()
    const t = parseInt(e.currentTarget.dataset.t)
    if (isNaN(t) || t === this.data.reportChartType) return
    this.setData({ reportChartType: t })
    this._drawCurrentChart()
  },

  // 仅绘制当前选中的那一种图（其它未渲染，避免对不存在的 canvas 反复重试）
  _drawCurrentChart() {
    const t = this.data.reportChartType
    setTimeout(() => {
      if (t === 0) this.initLineChart()
      else if (t === 1) this.initBarChart()
      else this.initPieCharts()
    }, 80)
  },

  // 报表刷新入口：重算汇总 + 重绘当前图
  _refreshReport() {
    this._updateReportSummary()
    this._drawCurrentChart()
  },

  drawPieChart(ctx, w, h, segments, colors, selectedIdx) {
    const dk = this.data.isDarkMode
    // Background
    ctx.fillStyle = dk ? '#1e1e2e' : '#ffffff'
    ctx.fillRect(0, 0, w, h)

    const total = segments.reduce((s, seg) => s + seg.value, 0)
    if (total === 0) {
      ctx.fillStyle = '#a0a0a0'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('暂无数据', w / 2, h / 2)
      return
    }

    const cx = w / 2
    const cy = h / 2
    const r = Math.min(w, h) * 0.38

    // Draw segments
    let startAngle = -Math.PI / 2
    for (let i = 0; i < segments.length; i++) {
      const angle = (segments[i].value / total) * Math.PI * 2
      const endAngle = startAngle + angle
      const midAngle = startAngle + angle / 2
      const midCos = Math.cos(midAngle)
      const midSin = Math.sin(midAngle)

      // Explode selected slice
      let ox = 0, oy = 0
      if (selectedIdx === i) {
        ox = midCos * 6
        oy = midSin * 6
      }

      ctx.beginPath()
      ctx.moveTo(cx + ox, cy + oy)
      ctx.arc(cx + ox, cy + oy, r, startAngle, endAngle)
      ctx.closePath()
      ctx.fillStyle = colors[i]
      ctx.fill()

      // Label inside slice
      const pct = Math.round((segments[i].value / total) * 100)
      let label = segments[i].name
      if (label.length > 3) label = label.slice(0, 2) + '..'
      else if (label.length > 2) label = label.slice(0, 3)

      if (pct >= 5) {
        const innerR = r * 0.5
        const ix = cx + ox + midCos * innerR
        const iy = cy + oy + midSin * innerR
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 9px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, ix, iy - 5)
        ctx.font = '8px sans-serif'
        ctx.fillText(pct + '%', ix, iy + 5)
      }

      startAngle = endAngle
    }

    // Detail box on selection
    if (selectedIdx !== undefined && selectedIdx >= 0) {
      const seg = segments[selectedIdx]
      const pct = Math.round((seg.value / total) * 100)
      const boxW = 140, boxH = 36
      const bx = cx - boxW / 2
      const by = h - boxH - 2

      ctx.fillStyle = 'rgba(0,0,0,0.75)'
      const r2 = 6
      ctx.beginPath()
      ctx.moveTo(bx + r2, by)
      ctx.lineTo(bx + boxW - r2, by)
      ctx.arcTo(bx + boxW, by, bx + boxW, by + r2, r2)
      ctx.lineTo(bx + boxW, by + boxH - r2)
      ctx.arcTo(bx + boxW, by + boxH, bx + boxW - r2, by + boxH, r2)
      ctx.lineTo(bx + r2, by + boxH)
      ctx.arcTo(bx, by + boxH, bx, by + boxH - r2, r2)
      ctx.lineTo(bx, by + r2)
      ctx.arcTo(bx, by, bx + r2, by, r2)
      ctx.closePath()
      ctx.fill()

      ctx.fillStyle = '#fff'
      ctx.font = 'bold 10px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(seg.name + '  ¥' + seg.value.toLocaleString(), cx, by + boxH / 2 - 5)
      ctx.font = '9px sans-serif'
      ctx.fillText('占比 ' + pct + '%', cx, by + boxH / 2 + 7)
    }
  },

  onPieTap(e, pieKey) {
    playTap()
    const data = this._pieData && this._pieData[pieKey]
    if (!data) return
    const { segments, total, cx, cy, r, colors } = data

    const touch = e.touches[0]
    if (!touch) return

    const dx = touch.x - cx
    const dy = touch.y - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > r) {
      // Tapped outside pie — clear selection
      if (this._pieSelected) {
        this._pieSelected = {}
        this.initPieCharts()
      }
      return
    }

    let angle = Math.atan2(dy, dx)
    if (angle < -Math.PI / 2) angle += Math.PI * 2

    // Find which segment
    let accum = -Math.PI / 2
    for (let i = 0; i < segments.length; i++) {
      const segAngle = (segments[i].value / total) * Math.PI * 2
      const segStart = accum
      const segEnd = accum + segAngle

      // Normalize to [0, 2PI]
      let check = angle
      if (check < segStart) check += Math.PI * 2

      if (check >= segStart && check < segEnd) {
        this._pieSelected = { [pieKey]: i }
        this.initPieCharts()
        return
      }
      accum = segEnd
    }
  },

  onPieIncomeTap(e) {
    playTap()
    this.onPieTap(e, 'income')
  },

  onPieExpenseTap(e) {
    playTap()
    this.onPieTap(e, 'expense')
  },

  initPieCharts() {
    const pieData = this.generatePieData()
    const palette = ['#007aff', '#ff9500', '#af52de', '#34c759', '#ff3b30', '#ffcc00', '#8e8e93']
    const selected = this._pieSelected || {}

    this._pieData = this._pieData || {}

    const renderPie = (id, data, key) => {
      const query = this.createSelectorQuery()
      query.select(id).fields({ node: true, size: true }).exec((res) => {
        if (!res || !res[0] || !res[0].node) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        let w = res[0].width || 100
        let h = res[0].height || 100
        const dpr = wx.getSystemInfoSync().pixelRatio || 2

        if (w < 10 || h < 10) {
          setTimeout(() => renderPie(id, data, key), 300)
          return
        }

        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)

        this.drawPieChart(ctx, w, h, data, palette, selected[key])

        // Store for tap handler
        const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.38
        const total = data.reduce((s, d) => s + d.value, 0)
        this._pieData[key] = { segments: data, total, cx, cy, r, colors: palette }
      })
    }

    renderPie('#pieIncome', pieData.income, 'income')
    renderPie('#pieExpense', pieData.expense, 'expense')
  },

  initBarChart() {
    const query = this.createSelectorQuery()
    query.select('#barChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        let w = res[0].width || 300
        let h = res[0].height || 200
        const dpr = wx.getSystemInfoSync().pixelRatio || 2

        const chartData = this._sharedChartData || this._aggregateChartData()

        if (w < 10 || h < 10) {
          const query2 = this.createSelectorQuery()
          query2.select('.report-chart-block').boundingClientRect((rect) => {
            if (rect && rect.width > 10) {
              w = rect.width - 16
              h = rect.height - 24
            }
            canvas.width = w * dpr
            canvas.height = h * dpr
            ctx.scale(dpr, dpr)
            this.drawBarChart(ctx, w, h, chartData)
          }).exec()
          return
        }

        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)
        this.drawBarChart(ctx, w, h, chartData)
      })
  },

  onChartTap(e) {
    playTap()
    if (!this._chartData || !this._chartLayout) return
    const { ml, pw } = this._chartLayout
    const data = this._chartData

    clearTimeout(this._tooltipTimer)

    // If tooltip already showing, dismiss it
    if (this._tooltipIdx != null) {
      this._tooltipIdx = null
      this._redrawStockChart()
      return
    }

    const touch = e.touches[0]
    if (!touch) return

    let idx = Math.round(((touch.x - ml) / pw) * (data.length - 1))
    idx = Math.max(0, Math.min(data.length - 1, idx))

    // Only show if tap is reasonably close to a data point
    const toX = (i) => ml + (i / Math.max(1, data.length - 1)) * pw
    const dist = Math.abs(touch.x - toX(idx))
    const maxDist = pw / Math.max(1, data.length) * 0.6
    if (dist > maxDist) return

    this._tooltipIdx = idx
    this._redrawStockChart(idx)

    this._tooltipTimer = setTimeout(() => {
      this._tooltipIdx = null
      this._redrawStockChart()
    }, 3000)
  },

  _redrawStockChart(idx) {
    const data = this._chartData
    const query = this.createSelectorQuery()
    query.select('#lineChart').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) return
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getSystemInfoSync().pixelRatio || 2
      const w = res[0].width || this._chartLayout.w
      const h = res[0].height || this._chartLayout.h
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.scale(dpr, dpr)
      this.drawStockChart(ctx, w, h, data, idx != null ? idx : undefined)
    })
  },

  initLineChart() {
    clearTimeout(this._tooltipTimer)
    this._tooltipIdx = null
    // 如果图表被浮层隐藏，跳过绘制（等待浮层关闭后再重绘）
    var d = this.data
    if (d.showBookPopup || d.showCamera || d.scanRecognizing || d.showExpandMenu || d.modalItem || d.showChat || d.chatRecording || d.searchRecording) return
    const query = this.createSelectorQuery()
    query.select('#lineChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          this._lineChartRetries = (this._lineChartRetries || 0) + 1
          if (this._lineChartRetries > 8) { this._lineChartRetries = 0; return }
          setTimeout(() => this.initLineChart(), 500)
          return
        }
        this._lineChartRetries = 0
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        let w = res[0].width || 300
        let h = res[0].height || 200
        const dpr = wx.getSystemInfoSync().pixelRatio || 2

        // If size is 0, use parent bounding rect
        if (w < 10 || h < 10) {
          const query2 = this.createSelectorQuery()
          query2.select('.report-chart-block').boundingClientRect((rect) => {
            if (rect && rect.width > 10) {
              w = rect.width - 16
              h = rect.height - 24
            }
            console.log('Using rect size:', w, h)
            canvas.width = w * dpr
            canvas.height = h * dpr
            ctx.scale(dpr, dpr)

            this._sharedChartData = this._aggregateChartData()
            console.log('Drawing chart with', this._sharedChartData.length, 'points, size:', w, h)
            this.drawStockChart(ctx, w, h, this._sharedChartData)
          }).exec()
          return
        }

        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)

        this._sharedChartData = this._aggregateChartData()
        console.log('Drawing chart with', this._sharedChartData.length, 'points, size:', w, h)
        this.drawStockChart(ctx, w, h, this._sharedChartData)
      })
  },

  // 切换个人/公司
  switchReportType() {
    playTap()
    if (this.data.reportType === 0) {
      const ci = api.getCompanyInfo()
      if (!(ci && ci.companyRole === 'boss' && ci.companyUid)) {
        wx.showToast({ title: '公司账本仅企业管理员可见', icon: 'none' })
        return
      }
    }
    const { currentReportCard, reportCards } = this.data
    const card = reportCards[currentReportCard]
    const next = card.col === 0 ? currentReportCard + 1 : currentReportCard - 1
    this.setData({
      currentReportCard: next,
      reportType: next % 2,
      currentMode: next % 2,
    })
    this._refreshReport()
  },

  // 切换报表周期
  switchReportPeriod(e) {
    playTap()
    const period = parseInt(e.currentTarget.dataset.period)
    this.setData({ reportPeriod: period })
    this.updateReportDate()
    this._refreshReport()
  },

  // 日期选择器变更（月度/年度/日度）
  onReportPickerChange(e) {
    playTap()
    const val = e.detail.value
    const { reportPeriod } = this.data
    if (reportPeriod === 0) {
      // 月度: "2026-06"
      const [y, m] = val.split('-')
      this.setData({ reportPickerDate: val })
      this.setData({ reportDateText: `${y}年${m}月` })
    } else if (reportPeriod === 2) {
      // 年度: "2026"
      const m = new Date().getMonth() + 1
      const mm = m < 10 ? '0' + m : String(m)
      this.setData({ reportPickerDate: val })
      this.setData({ reportDateText: `${val}年（截至${mm}月）` })
    } else if (reportPeriod === 3) {
      // 日度: "2026-06-12"
      const [y, m, d] = val.split('-')
      this.setData({ reportPickerDate: val })
      this.setData({ reportDateText: `${y}年${m}月${d}日` })
    }
    this._refreshReport()
  },

  // 季度多列选择器列变更
  onReportQuarterColumnChange(e) {
    playTap()
    const { column, value } = e.detail
    if (column === 0) {
      const year = this.data.reportQuarterRange[0][value]
      this.setData({ reportSelectedYear: parseInt(year) })
    }
  },

  // 季度多列选择器确认
  onReportQuarterChange(e) {
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
      reportDateText: `${year}年${quarter}`,
    })
    this._refreshReport()
  },

  // 根据周期更新日期文案
  updateReportDate() {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    const d = now.getDate()
    const mm = m < 10 ? '0' + m : String(m)
    const dd = d < 10 ? '0' + d : String(d)
    const quarters = ['1季度', '2季度', '3季度', '4季度']
    const q = quarters[Math.floor((m - 1) / 3)]

    let text = ''
    switch (this.data.reportPeriod) {
      case 0: text = `${y}年${mm}月`; this.setData({ reportPickerDate: `${y}-${mm}` }); break
      case 1:
        text = `${y}年${q}`
        this.setData({
          reportQuarterIndex: Math.floor((m - 1) / 3),
          reportQuarterMultiIndex: [this.data.reportQuarterRange[0].indexOf(String(y)), Math.floor((m - 1) / 3)],
          reportSelectedYear: y,
        })
        break
      case 2: text = `${y}年（截至${mm}月）`; this.setData({ reportPickerDate: `${y}` }); break
      case 3: text = `${y}年${mm}月${dd}日`; this.setData({ reportPickerDate: `${y}-${mm}-${dd}` }); break
    }
    this.setData({ reportDateText: text })
  },

  // 报表卡片滑动
  onReportTouchStart(e) {
    this.setData({
      touchStartX: e.touches[0].clientX,
      touchStartY: e.touches[0].clientY,
    })
  },

  onReportTouchEnd(e) {
    const { touchStartX, touchStartY, currentReportCard, reportCards } = this.data
    const dx = e.changedTouches[0].clientX - touchStartX
    const dy = e.changedTouches[0].clientY - touchStartY
    const card = reportCards[currentReportCard]
    let next = currentReportCard

    if (Math.abs(dx) > Math.abs(dy)) {
      // 水平滑动
      if (dx < -30 && card.col === 0) next = currentReportCard + 1
      if (dx > 30 && card.col === 1) next = currentReportCard - 1
    } else {
      // 垂直滑动
      if (dy < -30 && card.row < 2) next = currentReportCard + 2
      if (dy > 30 && card.row > 0) next = currentReportCard - 2
    }

    if (next !== currentReportCard) {
      this.setData({ currentReportCard: next })
    }
  },

  // ---- 结清 ----
  }
}

module.exports = createMethods
