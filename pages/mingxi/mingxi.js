Page({
  data: {
    showHeader: true,
    showOverview: true, // 简览页 vs 明细页
    currentTab: 0,
    tabs: [
      { text: '明细' },
      { text: '报表' },
      { text: '记账' },
      { text: '结清' },
      { text: '我的' },
    ],
    // 每个 Tab 的卡片集合，span 为占格数 (1/2/3)
    cardSets: [
      // Tab 0: 明细（2+1 布局）
      [
        { id: 'personal', title: '个人账本', span: 2 },
        { id: 'company', title: '公司账本', span: 1 },
      ],
      // Tab 1: 报表（全屏）
      [
        { id: 'report', title: '报表', span: 3 },
      ],
      // Tab 2: 记账（1+1+1 布局）
      [
        { id: 'income', title: '收入', span: 1 },
        { id: 'expense', title: '支出', span: 1 },
        { id: 'transfer', title: '转账', span: 1 },
      ],
      // Tab 3: 结清（全屏）
      [
        { id: 'settle', title: '结清', span: 3 },
      ],
      // Tab 4: 我的（全屏）
      [
        { id: 'my', title: '我的', span: 3 },
      ],
    ],
    // 报表卡片列表
    // 二维布局: 行=尺寸(全/半/小), 列=类型(个人/公司)
    // [0]=个人全屏 [1]=公司全屏 [2]=个人半屏 [3]=公司半屏 [4]=个人小屏 [5]=公司小屏
    reportCards: [
      { id: 'personal_full',  title: '个人流水报表', type: 'personal', size: 'full',  row: 0, col: 0 },
      { id: 'company_full',  title: '公司流水报表', type: 'company',  size: 'full',  row: 0, col: 1 },
      { id: 'personal_half',  title: '个人流水报表', type: 'personal', size: 'half',  row: 1, col: 0 },
      { id: 'company_half',  title: '公司流水报表', type: 'company',  size: 'half',  row: 1, col: 1 },
      { id: 'personal_small', title: '个人流水报表', type: 'personal', size: 'small', row: 2, col: 0 },
      { id: 'company_small', title: '公司流水报表', type: 'company',  size: 'small', row: 2, col: 1 },
    ],
    currentReportCard: 0,
    reportType: 0, // 0=个人, 1=公司
    reportPeriod: 0, // 0=月度, 1=季度, 2=年度, 3=日度
    reportDateText: '2026年06月',
    reportPeriods: ['月度', '季度', '年度', '日度'],
    reportPickerDate: '2026-06',
    reportQuarterIndex: 1,
    quarterOptions: ['1季度', '2季度', '3季度', '4季度'],
    reportQuarterRange: [[], ['1季度', '2季度', '3季度', '4季度']],
    reportQuarterMultiIndex: [6, 1],
    reportSelectedYear: 2026,
    touchStartX: 0,
    touchStartY: 0,
    tooltipVisible: false,
    tooltipX: 0,
    tooltipY: 0,
    tooltipData: { income: 0, expense: 0, receivable: 0, payable: 0 },
    settleType: 0, // 0=个人, 1=公司
    settleItems: [],
    detailType: 0, // 0=个人, 1=公司
    detailPeriod: 0,
    detailPickerDate: '2026-06',
    detailDateText: '2026年06月',
    detailItems: [],
    // 弹窗 & 滑动
    modalItem: null,
    modalFrom: '',
    modalIsPersonal: true,
    modalEdit: {},
    // VIP 升级页
    showVipPage: false,
    showCustomOverview: false,
    customCards: [], // 自定义简览页已添加的卡片列表
    editCardWidths: [], // movable-view 宽度（px），按索引
    editCardHeight: 120, // movable-view 高度（px）
    span1Templates: [], // 占 1 格的模版
    span2Templates: [], // 占 2 格的模版
    overviewSlots: [null, null, null], // 3 列卡槽，每个为 null 或卡片对象
    visibleSlots: [], // 从 overviewSlots 计算出的可见槽位（处理 span 合并。弹窗用，保持列顺序）
    visibleSlotsCompact: [], // 编辑模式用，按 span 分组：span-1 在前，span-2 次之
    hasCustomCards: false, // overviewSlots 中是否有卡片
    showPopup: false,
    ghostDrag: { visible: false, x: 0, y: 0, templateId: '', name: '', slotHover: -1, template: null },
    customTemplates: [
      // === 简览页卡片 ===
      {
        id: 't_personal', span: 1, name: '个人账本', subtitle: '日常收支', source: '简览页',
        type: 'overview_personal', hasAvatar: true,
        rows: [
          { label: '预算', value: '0.00', color: 'green' },
          { labels: ['收入', '支出', '结余'], values: ['0.00', '0.00', '0.00'], colors: ['green', 'red', 'red'], threeCol: true },
        ],
      },
      {
        id: 't_company', span: 2, name: '公司账本', subtitle: '经营收支', source: '简览页',
        type: 'overview_company',
        rows: [
          { label: '公司总资产', value: '0.00', color: 'green' },
          { label: '公司总负债', value: '0.00', color: 'red' },
          { label: '公司净资产', value: '0.00', color: 'green' },
          { label: '可支配资产', value: '0.00', color: 'green' },
          { labels: ['应收', '应出', '未结算'], values: ['0.00', '0.00', '0.00'], colors: ['green', 'red', 'red'], threeCol: true },
        ],
      },
      // === 明细页卡片（个人/公司分开） ===
      {
        id: 't_detail_personal', span: 2, name: '个人流水明细', subtitle: '月度 · 季度 · 年度 · 日度', source: '明细页',
        type: 'detail_personal',
        rows: [
          { label: '本月收入', value: '0.00', color: 'green' },
          { label: '本月支出', value: '0.00', color: 'red' },
          { label: '结余', value: '0.00', color: 'green' },
        ],
      },
      {
        id: 't_detail_company', span: 2, name: '公司流水明细', subtitle: '月度 · 季度 · 年度 · 日度', source: '明细页',
        type: 'detail_company',
        rows: [
          { label: '本月收入', value: '0.00', color: 'green' },
          { label: '本月支出', value: '0.00', color: 'red' },
          { label: '结余', value: '0.00', color: 'green' },
        ],
      },
      {
        id: 't_jieqing_personal', span: 1, name: '个人待结清', subtitle: '垫付 · 应付', source: '明细页',
        type: 'jieqing_personal',
        rows: [
          { label: '待结清笔数', value: '0', color: 'red' },
          { label: '待结清总额', value: '0.00', color: 'red' },
        ],
      },
      {
        id: 't_jieqing_company', span: 1, name: '公司待结清', subtitle: '垫付 · 应付', source: '明细页',
        type: 'jieqing_company',
        rows: [
          { label: '待结清笔数', value: '0', color: 'red' },
          { label: '待结清总额', value: '0.00', color: 'red' },
        ],
      },
    ],
    vipDetailId: -1,
    vipSelected: -1,
    vipCards: [
      {
        id: 0, name: '免费版', tagline: '入门体验 · 基础功能', price: '0', unit: '', discount: '', monthly: '', theme: 'free',
        features: [
          [{ text: '每月至少3次AI调用' }],
          [{ text: '所有模块开放' }],
          [{ text: '可自定义任何模块' }],
          [{ text: '无限的垫付计数次数' }],
          [{ text: '有限的导出次数\n（1次/月）' }],
        ],
        isContact: false,
      },
      {
        id: 1, name: '个人版 · Pro', tagline: '月度 · 无限次数', price: '12', unit: '/月', discount: '', monthly: '',
        features: [
          [{ text: '每月近乎无限的AI调用' }],
          [{ text: '所有模块开放' }],
          [{ text: '可自定义任何模块' }],
          [{ text: '无限的垫付计数次数' }],
          [{ text: '无限的导出次数（不含报表）' }],
          [{ text: '首月限免' }],
        ],
        isContact: false,
      },
      {
        id: 2, name: '个人版 · Ultra', tagline: '年度 · 黄金权益', price: '50', decimal: '.00/年', unit: '', discount: '3.5折', monthly: '折合￥4.2每月', theme: 'ultra',
        features: [
          [{ text: '每年近乎' }, { text: '无限的', strong: true }, { text: 'AI调用' }],
          [{ text: '所有模块开放' }],
          [{ text: '无限的', strong: true }, { text: '垫付计数次数' }],
          [{ text: '无限的', strong: true }, { text: '导出次数\n（不含报表）' }],
          [{ text: '可自定义任何模块' }],
        ],
        isContact: false,
      },
      {
        id: 3, name: '企业版 · Pro', tagline: '月度 · 团队协作', price: '30', decimal: '.00/月', unit: '', discount: '', monthly: '', theme: 'ultra',
        features: [
          [{ text: '企业图表无限次生成导出' }],
          [{ text: '兼具个人版和企业版独有' }],
          [{ text: '企业' }, { text: '报表专属分析', strong: true }],
          [{ text: '提供创建企业' }, { text: '专属码', strong: true }],
          [{ text: '同时对接' }, { text: '至多3名', strong: true }, { text: '员工+1名\nBoss使用' }],
        ],
        isContact: false,
      },
      {
        id: 4, name: '企业版 · Ultra', tagline: '年度 · 黄金权益', price: '288', decimal: '.00/年', unit: '', discount: '8折', monthly: '', theme: 'ultra',
        features: [
          [{ text: '企业图表无限次生成导出' }],
          [{ text: '兼具个人版和企业版独有' }],
          [{ text: '企业' }, { text: '报表专属分析', strong: true }],
          [{ text: '提供创建企业' }, { text: '专属码', strong: true }],
          [{ text: '同时对接' }, { text: '至多3名', strong: true }, { text: '员工+1名\nBoss使用' }],
        ],
        isContact: false,
      },
      {
        id: 5, name: '企业 · 定制版', tagline: '年度 · 小微团队', price: '600', decimal: '.00/年', unit: '', discount: '5折', monthly: '', theme: 'ultra',
        features: [
          [{ text: '企业图表无限次生成导出' }],
          [{ text: '兼具个人版和企业版独有' }],
          [{ text: '企业' }, { text: '报表专属分析', strong: true }],
          [{ text: '提供创建企业' }, { text: '专属码', strong: true }],
          [{ text: '同时对接' }, { text: '小微型公司所有', strong: true }, { text: '\n' }, { text: '员工+Boss（20人以内）', strong: true }],
        ],
        isContact: false,
      },
      {
        id: 6, name: '企业 · 定制Plus版', tagline: '年度 · 不限人次', price: '3600', decimal: '.00/年', unit: '', discount: '', monthly: '', theme: 'ultra',
        features: [
          [{ text: '企业图表无限次生成导出' }],
          [{ text: '兼具个人版和企业版独有' }],
          [{ text: '企业' }, { text: '报表专属分析', strong: true }],
          [{ text: '提供创建企业' }, { text: '专属码', strong: true }],
          [{ text: '同时对接' }, { text: '几乎不限人次的', strong: true }, { text: '\n' }, { text: '员工+Boss', strong: true }],
        ],
        isContact: false,
      },
      {
        id: 7, name: '企业 · 代账', tagline: '定制服务 · 专属客服', price: '', decimal: '', unit: '', discount: '', monthly: '', theme: 'ultra',
        features: [
          [{ text: '企业图表无限次生成导出' }],
          [{ text: '兼具个人版和企业版独有' }],
          [{ text: '企业' }, { text: '报表专属分析', strong: true }],
          [{ text: '提供创建企业' }, { text: '专属码', strong: true }],
          [{ text: '根据企业规模提供定制化\n服务（最简最省）' }],
          [{ text: '专属财务客服' }],
          [{ text: '企业税务服务' }],
        ],
        isContact: true,
      },
    ],
  },

  onLoad() {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    const mm = m < 10 ? '0' + m : String(m)
    const years = []
    for (let i = 2020; i <= 2030; i++) years.push(String(i))
    const yearIdx = years.indexOf(String(y))
    this.setData({
      reportPickerDate: `${y}-${mm}`,
      reportQuarterIndex: Math.floor((m - 1) / 3),
      'reportQuarterRange[0]': years,
      reportQuarterMultiIndex: [yearIdx, Math.floor((m - 1) / 3)],
      reportSelectedYear: y,
    })
    this.updateReportDate()
    this.initDetailItems()
    this.initSettleItems()
  },

  switchTab(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ currentTab: index, showOverview: false })
    if (index === 1) {
      this.initLineChart()
      this.initBarChart()
      this.initPieCharts()
    }
    if (index === 0) {
      this.initDetailItems()
    }
    if (index === 3) {
      this.initSettleItems()
    }
  },

  // ---- Canvas 折线图 ----
  generateMockData() {
    const period = this.data.reportPeriod
    const data = []
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
    const now = new Date()
    const today = now.getDate()
    const thisMonth = now.getMonth() + 1
    const thisYear = now.getFullYear()

    if (period === 0) {
      // 月度: 按当月实际天数，当月截至今
      const pickerDate = this.data.reportPickerDate // "2026-06"
      const [y, m] = pickerDate.split('-').map(Number)
      const daysInMonth = new Date(y, m, 0).getDate()
      const maxDay = (y === thisYear && m === thisMonth) ? today : daysInMonth
      for (let d = 1; d <= maxDay; d++) {
        const inc = rand(200, 3500)
        const exp = rand(100, 3000)
        const recv = rand(0, 2000)
        const pay = rand(0, 2000)
        data.push({ label: String(d), income: inc, expense: exp, receivable: recv, payable: pay, net: inc - exp })
      }
    } else if (period === 1) {
      // 季度: 3个月，当季截至今
      const pickerDate = this.data.reportPickerDate || `${thisYear}-${String(thisMonth).padStart(2, '0')}`
      const [qy, qm] = pickerDate.split('-').map(Number)
      const qStart = Math.floor((thisMonth - 1) / 3) * 3 + 1
      const qMonths = [qStart, qStart + 1, qStart + 2]
      const isCurrent = (qy === thisYear && qStart <= thisMonth)
      for (const mn of qMonths) {
        if (isCurrent && mn > thisMonth) break
        const label = isCurrent ? `${mn}月` : `${qMonths.indexOf(mn) + 1}月`
        const inc = rand(5000, 80000)
        const exp = rand(3000, 70000)
        const recv = rand(0, 30000)
        const pay = rand(0, 30000)
        data.push({ label: `${mn}月`, income: inc, expense: exp, receivable: recv, payable: pay, net: inc - exp })
      }
    } else if (period === 2) {
      // 年度: 4个季度，当年截至今
      const pickerDate = this.data.reportPickerDate || String(thisYear)
      const [ay] = pickerDate.split('-').map(Number)
      const curQuarter = Math.floor((thisMonth - 1) / 3) + 1
      const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
      const maxQ = (ay === thisYear) ? curQuarter : 4
      for (let qi = 0; qi < maxQ; qi++) {
        const inc = rand(20000, 300000)
        const exp = rand(15000, 250000)
        const recv = rand(0, 100000)
        const pay = rand(0, 100000)
        data.push({ label: quarters[qi], income: inc, expense: exp, receivable: recv, payable: pay, net: inc - exp })
      }
    } else {
      // 日度: 与月度一致
      const pickerDate = this.data.reportPickerDate
      const [y, m] = pickerDate.split('-').map(Number)
      const daysInMonth = new Date(y, m, 0).getDate()
      const maxDay = (y === thisYear && m === thisMonth) ? today : daysInMonth
      for (let d = 1; d <= maxDay; d++) {
        const inc = rand(200, 3500)
        const exp = rand(100, 3000)
        const recv = rand(0, 2000)
        const pay = rand(0, 2000)
        data.push({ label: String(d), income: inc, expense: exp, receivable: recv, payable: pay, net: inc - exp })
      }
    }
    return data
  },

  drawStockChart(ctx, w, h, chartData, selectedIdx) {
    const ml = 42, mr = 14, mt = 24, mb = 24
    const pw = w - ml - mr
    const ph = h - mt - mb

    // Background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)

    // Find Y range
    const nets = chartData.map(d => d.net)
    const maxAbs = Math.max(Math.abs(Math.max(...nets)), Math.abs(Math.min(...nets)), 1)
    const yMax = Math.ceil(maxAbs / 1000) * 1000 + 1000
    const yMin = -yMax

    function toX(i) { return ml + (i / (chartData.length - 1)) * pw }
    function toY(v) { return mt + ph / 2 - (v / yMax) * (ph / 2) }
    const zeroY = mt + ph / 2

    // Grid lines + Y labels
    ctx.fillStyle = '#a0a0a0'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'right'
    const steps = 4
    for (let i = 0; i <= steps; i++) {
      const val = yMin + ((yMax - yMin) / steps) * i
      const gy = toY(val)
      ctx.strokeStyle = 'rgba(0,0,0,0.06)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(ml, gy); ctx.lineTo(w - mr, gy); ctx.stroke()
      ctx.fillText((val / 1000).toFixed(1) + 'k', ml - 6, gy + 3)
    }

    // Zero line
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(ml, zeroY); ctx.lineTo(w - mr, zeroY); ctx.stroke()

    // X labels
    ctx.fillStyle = '#a0a0a0'
    ctx.textAlign = 'center'
    const step = Math.max(1, Math.floor(chartData.length / 7))
    for (let i = 0; i < chartData.length; i += step) {
      ctx.fillText(chartData[i].label, toX(i), h - 4)
    }

    // Connecting line
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'
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
    const blockW = Math.max(2, pw / chartData.length * 0.28)
    for (let i = 0; i < chartData.length; i++) {
      const { income, expense, net } = chartData[i]
      const cx = toX(i)
      const fy = toY(net)
      const ratio = income / (income + expense || 1)
      const totalH = Math.min(18, ph * 0.08)
      const gH = Math.max(2, totalH * ratio)
      const rH = Math.max(2, totalH - gH)

      ctx.fillStyle = '#00d042'
      ctx.fillRect(cx - blockW / 2, fy - gH, blockW, gH)

      ctx.fillStyle = '#ed2e2e'
      ctx.fillRect(cx - blockW / 2, fy, blockW, rH)

      ctx.fillStyle = '#333'
      ctx.beginPath()
      ctx.arc(cx, fy, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Legend
    const lx = ml, ly = 10
    ctx.fillStyle = '#00d042'
    ctx.fillRect(lx, ly, 8, 8)
    ctx.fillStyle = '#a0a0a0'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('收入', lx + 12, ly + 8)

    ctx.fillStyle = '#ed2e2e'
    ctx.fillRect(lx + 52, ly, 8, 8)
    ctx.fillText('支出', lx + 64, ly + 8)

    ctx.fillStyle = '#333'
    ctx.beginPath()
    ctx.arc(lx + 104, ly + 4, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#a0a0a0'
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
      ctx.fillStyle = 'rgba(255,255,255,0.96)'
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'
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
      const netColor = pt.net >= 0 ? '#00d042' : '#ed2e2e'
      ctx.fillStyle = '#a0a0a0'
      ctx.fillText('净值', tipX + 8, tipY + 14)
      ctx.fillStyle = netColor
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText('¥' + pt.net, tipX + 50, tipY + 14)
      ctx.font = '10px sans-serif'

      // Divider
      ctx.strokeStyle = 'rgba(0,0,0,0.08)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(tipX + 8, tipY + 20); ctx.lineTo(tipX + tipW - 8, tipY + 20); ctx.stroke()

      const rows = [
        { label: '收入', val: pt.income, color: '#00d042' },
        { label: '支出', val: pt.expense, color: '#ed2e2e' },
        { label: '应收', val: pt.receivable, color: '#00d042' },
        { label: '应付', val: pt.payable, color: '#ed2e2e' },
      ]
      rows.forEach((row, i) => {
        const ry = tipY + 34 + i * 15
        ctx.fillStyle = '#a0a0a0'
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
    const ml = 42, mr = 14, mt = 24, mb = 24
    const pw = w - ml - mr
    const ph = h - mt - mb

    // Background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)

    // Y range
    const maxVal = Math.max(
      Math.max(...chartData.map(d => d.income)),
      Math.max(...chartData.map(d => d.expense)),
      1
    )
    const yMax = Math.ceil(maxVal / 1000) * 1000 + 1000

    const barW = Math.max(3, pw / chartData.length * 0.4)
    const gap = barW * 0.25
    const groupW = barW * 2 + gap
    const padX = groupW / 2
    const usableW = pw - groupW
    const bottomY = mt + ph

    function toX(i) { return ml + padX + (i / Math.max(1, chartData.length - 1)) * usableW }
    function toY(v) { return bottomY - (v / yMax) * ph }

    // Grid lines + Y labels
    ctx.fillStyle = '#a0a0a0'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'right'
    const steps = 4
    for (let i = 0; i <= steps; i++) {
      const val = (yMax / steps) * i
      const gy = toY(val)
      ctx.strokeStyle = 'rgba(0,0,0,0.06)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(ml, gy); ctx.lineTo(w - mr, gy); ctx.stroke()
      ctx.fillText((val / 1000).toFixed(1) + 'k', ml - 6, gy + 3)
    }

    // X labels
    ctx.fillStyle = '#a0a0a0'
    ctx.textAlign = 'center'
    const step = Math.max(1, Math.floor(chartData.length / 7))
    for (let i = 0; i < chartData.length; i += step) {
      ctx.fillText(chartData[i].label, toX(i), h - 4)
    }

    // Vertical dashed separators between groups
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
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
      ctx.fillStyle = '#00d042'
      ctx.fillRect(cx - barW - gap / 2, bottomY - incomeH, barW, incomeH)

      // Expense bar (right side)
      ctx.fillStyle = '#ed2e2e'
      ctx.fillRect(cx + gap / 2, bottomY - expenseH, barW, expenseH)
    }

    // Legend
    const lx = ml, ly = 10
    ctx.fillStyle = '#00d042'
    ctx.fillRect(lx, ly, 8, 8)
    ctx.fillStyle = '#a0a0a0'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('收入', lx + 12, ly + 8)
    ctx.fillStyle = '#ed2e2e'
    ctx.fillRect(lx + 52, ly, 8, 8)
    ctx.fillText('支出', lx + 64, ly + 8)
  },

  // ---- 饼状图 ----
  generatePieData() {
    const data = this._sharedChartData || this.generateMockData()
    const totalIncome = data.reduce((s, d) => s + d.income, 0)
    const totalExpense = data.reduce((s, d) => s + d.expense, 0)

    const TOP_N = 6

    // Power-law distribution: a few big items dominate, long tail of small ones
    const genCatValues = (names, total) => {
      const weights = names.map((_, i) => 1 / (i + 1) * (0.5 + Math.random() * 0.5))
      const sum = weights.reduce((a, b) => a + b, 0)
      return names.map((name, i) => ({
        name,
        value: Math.round(total * weights[i] / sum)
      }))
    }

    const incomeNames = ['工资', '兼职', '投资', '租金', '分红', '稿费', '奖金', '补贴', '退款', '理财']
    const rawIncome = genCatValues(incomeNames, totalIncome)

    const expenseNames = [
      '餐饮', '交通', '购物', '娱乐', '房租', '水电', '通讯', '医疗', '教育', '健身',
      '美容', '宠物', '旅行', '礼金', '数码', '家居', '汽车', '保险', '税费', '快递',
      '零食', '水果', '烟酒', '咖啡', '外卖', '电影', '游戏', '音乐', '阅读', '摄影',
      '母婴', '养老', '捐赠', '维修', '洗衣', '停车', '加油', '公交', '地铁', '打车',
      '酒店', '门票', '签证', '代购', '会员', '存储', '打印', '文具', '绿植', '其他杂项',
    ]
    const rawExpense = genCatValues(expenseNames, totalExpense)

    const topThenOther = (items) => {
      items.sort((a, b) => b.value - a.value)
      const top = items.slice(0, TOP_N)
      const rest = items.slice(TOP_N).reduce((s, it) => s + it.value, 0)
      if (rest > 0) top.push({ name: '其他', value: rest })
      return top
    }

    return {
      income: topThenOther(rawIncome),
      expense: topThenOther(rawExpense),
    }
  },

  drawPieChart(ctx, w, h, segments, colors, selectedIdx) {
    const total = segments.reduce((s, seg) => s + seg.value, 0)
    if (total === 0) return

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
    this.onPieTap(e, 'income')
  },

  onPieExpenseTap(e) {
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

        const chartData = this._sharedChartData || this.generateMockData()

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
    if (!this._chartData || !this._chartLayout) return
    const { ml, pw } = this._chartLayout
    const data = this._chartData
    const touch = e.touches[0]
    if (!touch) return

    let idx = Math.round(((touch.x - ml) / pw) * (data.length - 1))
    idx = Math.max(0, Math.min(data.length - 1, idx))

    // Redraw with tooltip
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
      this.drawStockChart(ctx, w, h, data, idx)
    })

    clearTimeout(this._tooltipTimer)
    this._tooltipTimer = setTimeout(() => {
      const q = this.createSelectorQuery()
      q.select('#lineChart').fields({ node: true, size: true }).exec((res) => {
        if (!res || !res[0] || !res[0].node) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio || 2
        const w = res[0].width || this._chartLayout.w
        const h = res[0].height || this._chartLayout.h
        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)
        this.drawStockChart(ctx, w, h, data)
      })
    }, 3000)
  },

  initLineChart() {
    const query = this.createSelectorQuery()
    query.select('#lineChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        console.log('initLineChart res:', res)
        if (!res || !res[0] || !res[0].node) {
          console.log('no node, retrying...')
          setTimeout(() => this.initLineChart(), 500)
          return
        }
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

            this._sharedChartData = this.generateMockData()
            console.log('Drawing chart with', this._sharedChartData.length, 'points, size:', w, h)
            this.drawStockChart(ctx, w, h, this._sharedChartData)
          }).exec()
          return
        }

        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)

        this._sharedChartData = this.generateMockData()
        console.log('Drawing chart with', this._sharedChartData.length, 'points, size:', w, h)
        this.drawStockChart(ctx, w, h, this._sharedChartData)
      })
  },

  // 切换个人/公司
  switchReportType() {
    const { currentReportCard, reportCards } = this.data
    const card = reportCards[currentReportCard]
    const next = card.col === 0 ? currentReportCard + 1 : currentReportCard - 1
    this.setData({
      currentReportCard: next,
      reportType: next % 2,
    })
  },

  // 切换报表周期
  switchReportPeriod(e) {
    const period = parseInt(e.currentTarget.dataset.period)
    this.setData({ reportPeriod: period })
    this.updateReportDate()
    this.initLineChart()
    this.initBarChart()
    this.initPieCharts()
  },

  // 日期选择器变更（月度/年度/日度）
  onReportPickerChange(e) {
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
    this.initLineChart()
    this.initBarChart()
    this.initPieCharts()
  },

  // 季度多列选择器列变更
  onReportQuarterColumnChange(e) {
    const { column, value } = e.detail
    if (column === 0) {
      const year = this.data.reportQuarterRange[0][value]
      this.setData({ reportSelectedYear: parseInt(year) })
    }
  },

  // 季度多列选择器确认
  onReportQuarterChange(e) {
    const [yearIdx, quarterIdx] = e.detail.value
    const year = this.data.reportQuarterRange[0][yearIdx]
    const quarter = this.data.quarterOptions[quarterIdx]
    this.setData({
      reportQuarterMultiIndex: [yearIdx, quarterIdx],
      reportSelectedYear: parseInt(year),
      reportDateText: `${year}年${quarter}`,
    })
    this.initLineChart()
    this.initBarChart()
    this.initPieCharts()
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
  switchSettleType() {
    this.setData({ settleType: this.data.settleType === 0 ? 1 : 0 })
    this.initSettleItems()
  },

  onSettleAll() {
    wx.showModal({
      title: '确认结清',
      content: '确认一键结清所有垫付资金？此操作不可撤销。',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '已结清', icon: 'success' })
          this.setData({ settleItems: [] })
        }
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

  onBillTap(e) {
    const id = e.currentTarget.dataset.id
    const from = e.currentTarget.dataset.from || 'detail'
    const items = from === 'settle' ? 'settleItems' : 'detailItems'
    const item = this.data[items].find(it => it.id === id)
    if (!item) return
    const isPersonal = from === 'settle' ? this.data.settleType === 0 : this.data.detailType === 0
    this.setData({
      modalItem: item, modalFrom: from, modalIsPersonal: isPersonal,
      modalEdit: { category: item.category, amount: item.amount, note: item.note || '' },
    })
  },

  onModalFieldEdit(e) {
    const field = e.currentTarget.dataset.field
    const val = e.detail.value
    this.setData({ [`modalEdit.${field}`]: val })
  },

  onModalSave() {
    const { modalItem, modalEdit, modalFrom } = this.data
    if (!modalItem || !modalEdit) return
    wx.showModal({
      title: '确认保存',
      content: '确定要保存修改吗？',
      success: (res) => {
        if (!res.confirm) return
        const updateCache = (arr) => {
          const it = arr && arr.find(x => x.id === modalItem.id)
          if (it) { it.category = modalEdit.category; it.amount = modalEdit.amount; it.note = modalEdit.note }
        }
        updateCache(this._personalItems)
        updateCache(this._companyItems)
        const itemsKey = modalFrom === 'settle' ? 'settleItems' : 'detailItems'
        const list = this.data[itemsKey]
        const updated = list.map(item => {
          if (item.id === modalItem.id) return { ...item, category: modalEdit.category, amount: modalEdit.amount, note: modalEdit.note }
          return { ...item }
        })
        this.setData({ [itemsKey]: updated, modalItem: null })
        wx.showToast({ title: '已保存', icon: 'success' })
      },
    })
  },

  nop() {},

  onModalClose() {
    this.setData({ modalItem: null })
  },

  onBillSettle(e) {
    const id = e.currentTarget.dataset.id
    const from = e.currentTarget.dataset.from || 'detail'
    wx.showModal({
      title: '确认结清',
      content: '结清后将视为普通收支，确定吗？',
      success: (res) => {
        if (!res.confirm) return
        const updateCache = (arr) => {
          const it = arr && arr.find(x => x.id === id)
          if (it) { it.typeLabel = it.type === 'in' ? '收入' : '支出'; it._open = false }
        }
        updateCache(this._personalItems)
        updateCache(this._companyItems)

        const itemsKey = from === 'settle' ? 'settleItems' : 'detailItems'
        const list = this.data[itemsKey]
        const updated = list.map(item => {
          if (item.id === id) return { ...item, typeLabel: item.type === 'in' ? '收入' : '支出', _open: false }
          return { ...item }
        })
        this.setData({ [itemsKey]: updated, modalItem: null })
        wx.showToast({ title: '已结清', icon: 'success' })
      },
    })
  },

  onBillDelete(e) {
    const id = e.currentTarget.dataset.id
    const from = e.currentTarget.dataset.from || 'detail'
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
    const id = e.currentTarget.dataset.id
    const from = e.currentTarget.dataset.from || 'detail'
    wx.showModal({
      title: '确认作废',
      content: '作废后仍可取消作废，确定吗？',
      success: (res) => {
        if (!res.confirm) return
        const updateCache = (arr) => {
          const it = arr && arr.find(x => x.id === id)
          if (it) { it._voided = true; it._open = false }
        }
        updateCache(this._personalItems)
        updateCache(this._companyItems)
        const items = from === 'settle' ? 'settleItems' : 'detailItems'
        const list = this.data[items]
        const updated = list.map(item => {
          if (item.id === id) return { ...item, _voided: true, _open: false }
          return { ...item }
        })
        this.setData({ [items]: updated, modalItem: null })
      },
    })
  },

  onBillUnvoid(e) {
    const id = e.currentTarget.dataset.id
    const from = e.currentTarget.dataset.from || 'detail'
    wx.showModal({
      title: '取消作废',
      content: '确定要恢复此记录吗？',
      success: (res) => {
        if (!res.confirm) return
        const updateCache = (arr) => {
          const it = arr && arr.find(x => x.id === id)
          if (it) { it._voided = false; it._open = false }
        }
        updateCache(this._personalItems)
        updateCache(this._companyItems)
        const items = from === 'settle' ? 'settleItems' : 'detailItems'
        const list = this.data[items]
        const updated = list.map(item => {
          if (item.id === id) return { ...item, _voided: false, _open: false }
          return { ...item }
        })
        this.setData({ [items]: updated, modalItem: null })
      },
    })
  },

  _removeItem(id, from) {
    const items = from === 'settle' ? 'settleItems' : 'detailItems'
    const list = this.data[items].filter(item => item.id !== id)
    this.setData({ [items]: list })
  },

  goOverview() {
    // 返回简览页时，若无自定义卡片则清空 visibleSlots 以显示默认布局
    const hasCustom = this.data.overviewSlots.some(s => s !== null)
    this.setData({ showOverview: true, showCustomOverview: false })
    if (!hasCustom) {
      this.setData({ visibleSlots: [], hasCustomCards: false })
    }
  },

  // ---- 明细 ----
  switchDetailType() {
    this.setData({ detailType: this.data.detailType === 0 ? 1 : 0 })
    this.initDetailItems()
  },

  switchDetailPeriod(e) {
    const period = parseInt(e.currentTarget.dataset.period)
    this.setData({ detailPeriod: period })
    this.updateDetailDate()
    this.initDetailItems()
  },

  onDetailPickerChange(e) {
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
    const [yearIdx, quarterIdx] = e.detail.value
    const year = this.data.reportQuarterRange[0][yearIdx]
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

  initDetailItems() {
    const isCompany = this.data.detailType === 1
    const personalPool = [
      { cat: '餐饮', type: 'out', label: '支出' }, { cat: '工资', type: 'in', label: '收入' },
      { cat: '交通', type: 'out', label: '支出' }, { cat: '购物', type: 'out', label: '垫付' },
      { cat: '兼职', type: 'in', label: '收入' }, { cat: '房租', type: 'out', label: '应付' },
      { cat: '投资', type: 'in', label: '收入' }, { cat: '通讯', type: 'out', label: '支出' },
      { cat: '医疗', type: 'out', label: '应付' }, { cat: '奖金', type: 'in', label: '收入' },
      { cat: '外卖', type: 'out', label: '垫付' }, { cat: '打车', type: 'out', label: '支出' },
      { cat: '稿费', type: 'in', label: '收入' }, { cat: '水电', type: 'out', label: '应付' },
      { cat: '理财', type: 'in', label: '收入' }, { cat: '零食', type: 'out', label: '支出' },
      { cat: '快递', type: 'out', label: '垫付' }, { cat: '补贴', type: 'in', label: '垫付' },
      { cat: '娱乐', type: 'out', label: '支出' }, { cat: '股息', type: 'in', label: '收入' },
    ]
    const companyPool = [
      { cat: '采购', type: 'out', label: '垫付' }, { cat: '回款', type: 'in', label: '收入' },
      { cat: '差旅', type: 'out', label: '应付' }, { cat: '营收', type: 'in', label: '收入' },
      { cat: '招待', type: 'out', label: '垫付' }, { cat: '投资', type: 'in', label: '收入' },
      { cat: '租金', type: 'out', label: '应付' }, { cat: '分红', type: 'in', label: '收入' },
      { cat: '物料', type: 'out', label: '支出' }, { cat: '融资', type: 'in', label: '收入' },
      { cat: '物流', type: 'out', label: '垫付' }, { cat: '咨询', type: 'in', label: '收入' },
      { cat: '税费', type: 'out', label: '应付' }, { cat: '补贴', type: 'in', label: '收入' },
      { cat: '维修', type: 'out', label: '支出' }, { cat: '软件', type: 'out', label: '应付' },
      { cat: '保险', type: 'out', label: '支出' }, { cat: '培训', type: 'in', label: '垫付' },
      { cat: '广告', type: 'out', label: '垫付' }, { cat: '利息', type: 'in', label: '收入' },
    ]
    const pool = isCompany ? companyPool : personalPool
    const rand = (min, max) => (Math.random() * (max - min) + min).toFixed(2)
    const minIn = isCompany ? 5000 : 200, maxIn = isCompany ? 50000 : 8000
    const minOut = isCompany ? 500 : 20, maxOut = isCompany ? 20000 : 3000
    const notes = ['午餐AA', '项目奖金', '打车去公司', '', '周末接单', '押一付三',
      '基金分红', '', '挂号检查费', '季度绩效', '晚饭加奶茶', '去机场',
      '投稿收入', '本月电费', '定期理财到期', '', '退货返款', '出差补贴',
      '看电影', '分红到账']
    const items = pool.map((item, i) => ({
      id: i,
      category: item.cat,
      type: item.type,
      typeLabel: item.label,
      amount: item.type === 'in' ? rand(minIn, maxIn) : rand(minOut, maxOut),
      date: `6月${10 + i}日`,
      note: notes[i] || '',
    }))
    items.sort((a, b) => b.date.localeCompare(a.date))
    this.setData({ detailItems: items })
    // 分别缓存
    if (isCompany) this._companyItems = items
    else this._personalItems = items
  },

  initSettleItems() {
    const isCompany = this.data.settleType === 1
    const src = isCompany ? this._companyItems : this._personalItems
    const settled = src ? src.filter(item => item.typeLabel === '垫付' || item.typeLabel === '应付') : []
    if (settled.length > 0) {
      this.setData({ settleItems: settled.map(item => ({ ...item })) })
      return
    }
    // 缓存未命中或过滤为空时，直接生成 mock 数据
    const rand = (min, max) => (Math.random() * (max - min) + min).toFixed(2)
    const pool = isCompany
      ? ['采购', '差旅', '招待', '租金', '物流', '税费', '软件', '广告']
      : ['餐饮', '交通', '购物', '房租', '维修', '快递', '医疗', '数码']
    const baseId = isCompany ? 9000 : 8000
    const items = pool.map((cat, i) => {
      const isIn = i < pool.length / 2
      return {
        id: baseId + i, category: cat, type: isIn ? 'in' : 'out',
        typeLabel: isIn ? '垫付' : '应付',
        amount: rand(isCompany ? 500 : 50, isCompany ? 20000 : 3000),
        date: `6月${10 + i}日`,
        note: '',
      }
    })
    this.setData({ settleItems: items })
  },

  // ---- 自定义简览页 ----
  onCustomOverviewEntry() {
    const saved = wx.getStorageSync('customOverviewCards') || []
    const templates = this.data.customTemplates
    this.setData({
      showCustomOverview: true, showOverview: true,
      customCards: saved,
      span1Templates: templates.filter(t => t.span === 1),
      span2Templates: templates.filter(t => t.span === 2),
      showPopup: false,
      ghostDrag: { visible: false, x: 0, y: 0, templateId: '', name: '', slotHover: -1, template: null },
    })
    setTimeout(() => this._initEditGrid(), 300)
  },

  _initEditGrid() {
    const query = wx.createSelectorQuery()
    query.select('#customEditArea').boundingClientRect()
    query.exec((res) => {
      if (!res || !res[0]) return
      const areaWidth = res[0].width
      const areaHeight = res[0].height
      if (areaWidth <= 0) return
      const colWidth = areaWidth / 3
      this._grid = { areaWidth, areaHeight, colWidth, rowHeight: 120 }
      // 更新已保存卡片的尺寸与位置
      this._refreshCardSizes()
    })
  },

  _refreshCardSizes() {
    const colW = (this._grid && this._grid.colWidth) || 100
    const cards = this.data.customCards
    const widths = cards.map(c => {
      const span = c.span || 1
      return Math.round(colW * span)
    })
    // 确保每张卡片有初始位置
    const updated = cards.map((c, i) => ({
      ...c,
      x: c.x != null ? c.x : 0,
      y: c.y != null ? c.y : i * this._grid.rowHeight,
    }))
    this.setData({ editCardWidths: widths, customCards: updated })
  },

  onExitEditMode() {
    wx.setStorageSync('customOverviewCards', this.data.customCards)
    this.setData({ showCustomOverview: false })
  },

  onAddCustomCard(e) {
    const templateId = e.currentTarget.dataset.id
    const template = this.data.customTemplates.find(t => t.id === templateId)
    if (!template) return
    const rowH = (this._grid && this._grid.rowHeight) || 120
    const colW = (this._grid && this._grid.colWidth) || 100
    const cards = this.data.customCards
    // 计算新卡片位置：放在已有卡片下方
    const maxY = cards.reduce((m, c) => Math.max(m, (c.y || 0) + rowH), 0)
    const newCard = {
      id: `c_${Date.now()}`,
      templateId: template.id,
      name: template.name,
      subtitle: template.subtitle,
      type: template.type,
      span: template.span,
      x: 0,
      y: maxY,
    }
    const customCards = [...cards, newCard]
    const editCardWidths = [...this.data.editCardWidths, Math.round(colW * template.span)]
    this.setData({ customCards, editCardWidths })
  },

  onCardDragChange(e) {
    const index = e.currentTarget.dataset.index
    const { x, y, source } = e.detail
    if (source === 'touch') {
      const cards = [...this.data.customCards]
      cards[index] = { ...cards[index], x, y }
      this.setData({ customCards: cards })
    }
    // 防抖：手指抬起后做网格吸附
    if (this._dragTimer) clearTimeout(this._dragTimer)
    this._dragTimer = setTimeout(() => {
      this._snapCard(index)
    }, 180)
  },

  _snapCard(index) {
    if (!this._grid) return
    const { colWidth, rowHeight } = this._grid
    const cards = [...this.data.customCards]
    const card = { ...cards[index] }
    const span = card.span || 1
    const maxCol = 3 - span
    // 吸附 X
    const targetCol = Math.round(card.x / colWidth)
    const clampedCol = Math.max(0, Math.min(maxCol, targetCol))
    card.x = clampedCol * colWidth
    // 吸附 Y
    card.y = Math.round(card.y / rowHeight) * rowHeight
    card.y = Math.max(0, card.y)
    cards[index] = card
    this.setData({ customCards: cards })
  },

  onRemoveCustomCard(e) {
    const id = e.currentTarget.dataset.id
    const idx = this.data.customCards.findIndex(c => c.id === id)
    if (idx < 0) return
    const customCards = this.data.customCards.filter(c => c.id !== id)
    const editCardWidths = [...this.data.editCardWidths]
    editCardWidths.splice(idx, 1)
    this.setData({ customCards, editCardWidths })
  },

  _refreshVisibleSlots() {
    const overviewSlots = this.data.overviewSlots
    const visible = []
    let i = 0
    while (i < 3) {
      const card = overviewSlots[i]
      if (card) {
        const s = card.span || 1
        visible.push({ card, span: s, col: i, isEmpty: false, spanLabel: s === 1 ? '占1格' : s === 2 ? '占2格' : '占3格' })
        i += s
      } else {
        visible.push({ card: null, span: 1, col: i, isEmpty: true, spanLabel: '占1格' })
        i += 1
      }
    }
    const hasAny = visible.some(v => !v.isEmpty)
    const compact = [...visible].sort((a, b) => {
      if (a.isEmpty && !b.isEmpty) return 1
      if (!a.isEmpty && b.isEmpty) return -1
      if (a.isEmpty && b.isEmpty) return a.col - b.col
      return a.span - b.span
    })
    this.setData({ visibleSlots: visible, visibleSlotsCompact: compact, hasCustomCards: hasAny })
  },

  // ---- 模版点击 → 弹窗 + 拖拽 ----
  onTemplateTap(e) {
    if (this.data.showPopup) return
    const id = e.currentTarget.dataset.id
    if (!id) return
    const template = this.data.customTemplates.find(t => t.id === id)
    if (!template) return

    // 确保 visibleSlots 是最新的
    this._refreshVisibleSlots()

    const sysInfo = wx.getSystemInfoSync()
    const startX = sysInfo.windowWidth / 2 - 90
    const startY = sysInfo.windowHeight / 2 - 50

    this.setData({
      showPopup: true,
      ghostDrag: {
        visible: true,
        x: startX,
        y: startY,
        templateId: id,
        name: template.name,
        slotHover: -1,
        template: template,
      },
    })
  },

  onPopupDragStart(e) {
    if (!this.data.ghostDrag.visible) return
    const touch = e.touches[0]
    this._dragStartX = touch.clientX
    this._dragStartY = touch.clientY
    this._dragMoved = false
    this.setData({
      'ghostDrag.x': touch.clientX - 90,
      'ghostDrag.y': touch.clientY - 50,
    })
  },

  onPopupDragMove(e) {
    if (!this.data.ghostDrag.visible) return
    const touch = e.touches[0]
    const dx = touch.clientX - (this._dragStartX || touch.clientX)
    const dy = touch.clientY - (this._dragStartY || touch.clientY)
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) this._dragMoved = true

    this.setData({
      'ghostDrag.x': touch.clientX - 90,
      'ghostDrag.y': touch.clientY - 50,
    })
    const query = this.createSelectorQuery()
    query.selectAll('.popup-slot').boundingClientRect((rects) => {
      if (!rects) return
      const visibleSlots = this.data.visibleSlots
      let hoverCol = -1
      rects.forEach((rect, i) => {
        if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
            touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
          if (visibleSlots[i]) hoverCol = visibleSlots[i].col
        }
      })
      if (hoverCol !== this.data.ghostDrag.slotHover) {
        this.setData({ 'ghostDrag.slotHover': hoverCol })
      }
    }).exec()
  },

  onPopupDragEnd(e) {
    if (!this.data.ghostDrag.visible) return
    const { template } = this.data.ghostDrag
    const touch = e.changedTouches[0]

    // 如果没有拖动（仅仅是点击遮罩），关闭弹窗
    if (!this._dragMoved) {
      this.setData({
        showPopup: false,
        ghostDrag: { visible: false, x: 0, y: 0, templateId: '', name: '', slotHover: -1, template: null },
      })
      return
    }

    const query = this.createSelectorQuery()
    query.selectAll('.popup-slot').boundingClientRect((rects) => {
      let targetCol = -1
      if (rects) {
        const visibleSlots = this.data.visibleSlots
        rects.forEach((rect, i) => {
          if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
              touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
            if (visibleSlots[i]) targetCol = visibleSlots[i].col
          }
        })
      }

      if (targetCol >= 0 && template) {
        const span = template.span || 1
        if (targetCol + span > 3) {
          wx.showToast({ title: '此处放不下该卡片', icon: 'none', duration: 1500 })
          this.setData({
            showPopup: false,
            ghostDrag: { visible: false, x: 0, y: 0, templateId: '', name: '', slotHover: -1, template: null },
          })
          return
        }
        const newId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        const newCard = {
          id: newId,
          templateId: template.id,
          name: template.name,
          subtitle: template.subtitle,
          type: template.type,
          span: span,
          col: targetCol,
        }

        const overviewSlots = [...this.data.overviewSlots]
        const startCol = targetCol
        const endCol = Math.min(3, startCol + span)
        for (let c = 0; c < 3; c++) {
          const existing = overviewSlots[c]
          if (existing) {
            const eStart = existing.col !== undefined ? existing.col : c
            const eEnd = Math.min(3, eStart + (existing.span || 1))
            if (eStart < endCol && eEnd > startCol) {
              for (let oc = eStart; oc < eEnd; oc++) {
                overviewSlots[oc] = null
              }
            }
          }
        }
        overviewSlots[startCol] = newCard

        this.setData({
          overviewSlots,
          showPopup: false,
          ghostDrag: { visible: false, x: 0, y: 0, templateId: '', name: '', slotHover: -1, template: null },
        })
        this._refreshVisibleSlots()
      } else {
        this.setData({
          showPopup: false,
          ghostDrag: { visible: false, x: 0, y: 0, templateId: '', name: '', slotHover: -1, template: null },
        })
      }
    }).exec()
  },

  onPopupClose() {
    this.setData({
      showPopup: false,
      ghostDrag: { visible: false, x: 0, y: 0, templateId: '', name: '', slotHover: -1, template: null },
    })
  },

  // ---- VIP 升级 ----
  onVipEntry() {
    this.setData({ showVipPage: true, vipDetailId: -1, vipSelected: -1 })
  },

  onVipBack() {
    if (this.data.vipDetailId >= 0) {
      this.setData({ vipDetailId: -1, vipSelected: -1 })
    } else {
      this.setData({ showVipPage: false, vipDetailId: -1, vipSelected: -1 })
    }
  },

  onVipThumbTap(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ vipDetailId: id, vipSelected: id })
  },

  onVipSelect(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ vipSelected: this.data.vipSelected === id ? -1 : id })
  },

  onVipConfirm() {
    if (this.data.vipSelected < 0) {
      wx.showToast({ title: '请先选择一个套餐', icon: 'none' })
      return
    }
    const card = this.data.vipCards[this.data.vipSelected]
    if (card.isContact) {
      wx.showToast({ title: '请联系客服', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认订阅',
      content: `确定订阅「${card.name}」吗？`,
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '订阅成功', icon: 'success' })
          this.setData({ showVipPage: false, vipDetailId: -1, vipSelected: -1 })
        }
      },
    })
  },
})
