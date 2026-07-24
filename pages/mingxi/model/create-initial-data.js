const { getVolume } = require('../../../utils/tapSound')
const {
  DEFAULT_PERSONAL_CATEGORIES,
  DEFAULT_COMPANY_CATEGORIES,
} = require('../../../utils/categories')
const { createTabItems } = require('../../../utils/tab-navigation')

function cloneCategories(categories) {
  return categories.map((category) => Object.assign({}, category))
}

function createInitialData() {
  return {
    t: {},
    showHeader: true,
    showOverview: true, // 简览页 vs 明细页
    isDarkMode: false, // 深色模式
    isTablet: false,
    currentTab: 0,
    _switchingTab: false,
    tabs: createTabItems().map(({ text, icon }) => ({ text, icon })),
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
    reportSummary: { income: '0.00', expense: '0.00', balance: '0.00', balanceNeg: false, incomeCats: [], expenseCats: [], proUnlocked: true, empty: true }, // 报表筛选汇总：总收入/支出/结余 + 分类拆解；proUnlocked 预留鉴权钩子
    reportChartType: 0, // 报表图表三合一：0=折线 1=柱状 2=饼图，点击切换共用同一区域
    touchStartX: 0,
    touchStartY: 0,
    tooltipVisible: false,
    tooltipX: 0,
    tooltipY: 0,
    tooltipData: { income: 0, expense: 0, receivable: 0, payable: 0 },
    settleType: 0, // 0=个人, 1=公司
    settleIsBoss: false,
    settleItems: [],
    detailType: 0, // 0=个人, 1=公司
    currentMode: 0, // 0=个人(蓝) 1=公司(金)，用于顶部模式色带
    detailPeriod: 0,
    detailPickerDate: '2026-06',
    maxDate: (function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) })(), // 图表/明细日期选择器上限：今天，禁止选未来
    detailDateText: '2026年06月',
    detailItems: [],
    detailGroups: [],
    expandedMultiIds: {},
    // 弹窗 & 滑动
    modalItem: null,
    modalFrom: '',
    modalIsPersonal: true,
    modalEdit: {},
    // 记账弹窗
    showBookPopup: false,
    bookMode: 'normal',       // 'normal' | 'multi'
    bookForm: { type: 'expense', amount: '', category: '', date: '', note: '', target: '', targetType: 'external' },
    // 多笔记账
    multiStartDate: '',
    multiEndDate: '',
    multiUseDateRange: false,
    multiExpression: '',
    multiResult: '0.00',
    multiCount: 0,
    multiNote: '',
    multiScope: 'personal',
    multiScopeLabel: '个人',
    multiType: 'income',
    multiTypeLabel: '收入',
    bookPhoto: '',           // 凭证照片本地路径（''=普通记账）
    scanRecognizing: false,  // 识别中 loading
    showCamera: false,       // 自定义相机页
    bookScope: 'personal',
    bookScopeLabel: '个人',
    bookTypeLabel: '支出',
    showBookCatPanel: false,
    bookCatPanelData: [],
    // VIP 升级页
    showVipPage: false,
    showTrialBanner: false,      // 试用领取横幅
    trialOfferDays: 92,          // 距试用截止天数
    vipTrialDays: 0,             // 试用剩余天数（已激活）
    vipStatus: null,             // { vipLevel, vipExpiresAt, usage, limits, isTrial }
    vipExpiresText: '永久有效',   // 预计算：WXML 不支持 .slice() 调用，在 JS 侧格式化
    // 登录状态
    isLoggedIn: false,
    userInfo: null,
    avatarDisplay: '',          // 头像实际显示路径（本地临时/带头下载到本地），优先于 userInfo.avatarUrl
    showProfileModal: false,    // 资料设置弹窗（新用户引导 + 我的页编辑共用）
    showPrivacyNotice: false,   // 测试版隐私声明弹窗
    profileEditMode: false,     // true=我的页编辑（标题/按钮用「编辑/取消」），false=新用户引导（用「完善/跳过」）
    profileName: '',
    profileAvatarLocal: '',     // 弹窗内已选/已传头像的本地预览路径
    profileAvatarUrl: '',       // 弹窗内已上传到服务端的头像 URL
    profileUploading: false,
    showLoginPage: false,
    showCompanyShare: false,
    companyShareStep: 0,
    companyRole: '',
    companyUid: '',
    companyName: '',
    companyBossTitle: '',
    companyStatus: '',  // '' | 'pending' | 'approved'
    employeeUid: '',
    // 首次引导
    showGuide: false,
    guideStep: 0,
    guideRole: '',
    // 操作教程
    showOpGuide: false,
    opGuideStep: 0,
    _opGuideAfter: '',          // 'role'=教程结束后继续选择身份, 'done'=直接结束
    showVoiceTip: false,        // 引导完成后语音记账提示

    ledgerScrollTo: '',            // 账本页 scroll-into-view 定位
    // ===== 聚光引导（product tour，真实界面 + 高亮遮罩）=====
    showSpotlightGuide: false,
    spotlightType: '',           // 'first' | 'tutorial'
    spotlightStep: 0,
    spotlightTotalSteps: 1,
    spotlightStepConfig: {},     // 当前步骤配置（传给组件）
    spotlightTargetRect: null,   // 目标元素 rect（页面侧计算后传入组件）
    // 首次引导：基础登录 + 公司设置（4步）
    spotlightFirstSteps: [
      { type: 'welcome' },
      { type: 'intro' },
      { targetSelector: '.tab-item-mine', holePadding: 10, bubbleTitle: '进入「我的」', bubbleDesc: '先设置你的账户信息', showNext: false, showSkip: true, holeShape: 'rect' },
      { targetSelector: '.my-login-text', holePadding: 12, bubbleTitle: '登录 / 注册', bubbleDesc: '微信一键登录，数据云端同步', showNext: false, showSkip: true, holeShape: 'rect' },
      { targetSelector: '.my-share-entry', holePadding: 10, bubbleTitle: '链接公司账本', bubbleDesc: '创建公司或加入已有公司，开启共享账本', showNext: false, showSkip: true, holeShape: 'rect' },
    ],
    // 角色选择引导：教程结束后进入
    spotlightRoleSteps: [
      { targetSelector: '.company-share-body', autoSwitchTab: 4, autoShowCompanyShare: true, holePadding: 12, bubbleTitle: '选择身份', bubbleDesc: '「我是老板」创建公司，邀请员工加入\n「我是员工」输入 UID 加入已有公司', showNext: false, showSkip: true, holeShape: 'rect' },
    ],
    // 操作教程：登录后展示核心功能
    spotlightTutorialSteps: [
      { targetSelector: '.card', holePadding: 8, bubbleTitle: '简览页', bubbleDesc: '查看个人/公司收支概览\n点击卡片进入个人账本', showNext: false, showSkip: false, holeShape: 'rect' },
      { targetSelector: '.ledger-budget-sec', holePadding: 10, bubbleTitle: '设置月度预算', bubbleDesc: '输入你的月度预算金额\n点击保存', showNext: false, showSkip: false, holeShape: 'rect', scrollTo: 'ledger-budget' },
      { targetSelector: '.ledger-demo-area', holePadding: 10, bubbleTitle: '本月概览 & 往来款', bubbleDesc: '收入 ¥12,500 · 支出 ¥3,200\n应收 ¥5,000 · 应付 ¥1,500\n（演示数据仅供预览）', showNext: true, showSkip: false, nextText: '知道了', holeShape: 'rect', setupDemo: true, scrollTo: 'ledger-overview' },
      { targetSelector: '.custom-cat-back', holePadding: 6, bubbleTitle: '返回简览', bubbleDesc: '看完账本了\n点左上角返回简览', showNext: false, showSkip: false, holeShape: 'rect' },
      { targetSelector: '.report-type-toggle', autoSwitchTab: 0, holePadding: 22, bubbleTitle: '个人 / 公司切换', bubbleDesc: '所有数据都按「个人」和「公司」分开管理\n点击上方切换试试看', showNext: false, showSkip: false, holeShape: 'rect' },
      { targetSelector: '.tab-bar-center-btn', holePadding: 16, bubbleTitle: '点击记账', bubbleDesc: '点击底部记账按钮\n开始记录你的第一笔账', showNext: false, showSkip: false, holeShape: 'rect' },
      { targetSelector: '.book-cat-select', holePadding: 10, bubbleTitle: '选择分类', bubbleDesc: '点击分类栏，为这笔账选择归属类别', showNext: false, showSkip: false, holeShape: 'rect' },
      { targetSelector: '.book-type-tab--payForward', holePadding: 10, bubbleTitle: '选择「垫付」', bubbleDesc: '个人为公司预先垫资\n例如：差旅垫付、采购垫付\n可追踪报销/结清状态', showNext: false, showSkip: false, holeShape: 'rect' },
      { targetSelector: '.book-type-bar', holePadding: 12, bubbleTitle: '垫付的作用', bubbleDesc: '记录个人垫资后，可在「明细」和「结清」中追踪\n公司是否已还款，避免遗漏', showNext: true, showSkip: false, nextText: '下一步', holeShape: 'rect' },
      { targetSelector: '.book-mode-tab--multi', holePadding: 10, bubbleTitle: '多笔记账', bubbleDesc: '支持批量录入多笔金额\n一次保存，自动汇总', showNext: false, showSkip: false, holeShape: 'rect', closeBookCatPanel: true },
      { targetSelector: '.multi-calc-display', holePadding: 14, bubbleTitle: '表达式计算', bubbleDesc: '38+89-20 自动拆为 3 笔\n实时显示笔数和总金额', showNext: true, showSkip: false, nextText: '开始使用', holeShape: 'rect' },
    ],
    // 自定义分类页
    showCustomCategory: false, // 自定义分类页
    showExportBill: false, // 导出账单页
    // 语音对话
    showChat: false,
    chatMessages: [],
    chatInputText: '',
    chatThinking: false,
    chatScrollTop: 0,
    chatVoiceMode: true,
    chatRecording: false,
    catOptions: ['餐饮', '交通', '购物', '饮品', '人情', '通讯', '医疗', '住房', '工资', '办公', '金融', '服饰', '娱乐', '数码', '其他'],
    typeOptions: ['支出', '收入', '垫付', '应付'],
    targetOptions: ['公司', '个人', '外部'],
    _typeLabelToKey: { '支出': 'expense', '收入': 'income', '垫付': 'payForward', '应付': 'payable' },
    // 冲突解决
    showConflictPanel: false,
    conflicts: [],
    conflictIndex: 0,
    conflictResolving: false,
    showExpandMenu: false, // 拓展菜单
    searchText: '', // 顶部搜索关键词
    searchRecording: false, // 顶部语音搜索录音中
    showAuditPage: false, // 审核页
    showNotifyPage: false, // 通知页
    showContactPage: false, // 联系我们获好礼页
    contactFeedback: '', // 反馈内容
    showSettingsPage: false, // 设置页
    showLedgerPage: false, // 账本页（个人/公司）
    ledgerScope: 'personal', // 当前账本范围: personal/company
    canSeeCompanyLedger: false, // 公司账本入口仅 boss 可见（与简览卡片同逻辑）
    // 账本页：本月概览 + 月度预算
    ledgerBudget: 0,
    ledgerBudgetInput: '',
    ledgerMonthLabel: '',
    ledgerMonthIncome: '0.00',
    ledgerMonthExpense: '0.00',
    ledgerMonthBalance: '0.00',
    ledgerMonthBalancePos: true,
    ledgerBudgetUsed: '0.00',
    ledgerBudgetUsedPct: 0,
    ledgerOverBudget: false,
    ledgerBudgetRemainText: '未设置预算',
    // 账本页：往来款（未结清 应收/应付）
    ledgerReceivable: '0.00',
    ledgerPayable: '0.00',
    ledgerNet: '0.00',
    ledgerNetPos: true,
    ledgerReceivableCount: 0,
    ledgerPayableCount: 0,
    // 账本页：公司资产概览（总资金/总负债/净资产/可支配）
    ledgerFunds: '0.00',
    ledgerLiability: '0.00',
    ledgerNetAssets: '0.00',
    ledgerNetAssetsPos: true,
    ledgerDisposable: '0.00',
    ledgerDisposablePos: true,
    showPrivacyPage: false, // 隐私设置页
    showPrivacyPolicyPage: false, // 隐私政策页
    showAboutPage: false, // 关于我们页
    privacyAllowAnalytics: true,
    privacyAllowCrashReport: true,
    settingsLedgerRole: 'personal', // 当前账本角色: personal/boss/employee
    cacheSize: '0MB',
    settingsLanguage: 'zh-CN', // 语言设置
    settingsLanguageLabel: '简体中文',
    settingsDarkMode: 'system', // 深色模式: system/light/dark
    settingsDarkModeLabel: '跟随系统',
    settingsCompanyStatus: '',
    settingsPhone: '',
    // E2E 加密
    showEncryptionSettings: false,
    encryptionEnabled: false,
    encryptionAdvancedEnabled: false,
    encryptionAdvancedKey: '',
    encryptionAdvancedInput: '',
    // 企业加密
    encryptionCompanyKeyReady: false,
    encryptionCompanyIsBoss: false,
    tapVolumePercent: Math.round(getVolume() * 100),
    tapVibrationLevel: wx.getStorageSync('tapVibration') || 1,
    tapVibrationLabel: ['关闭', '轻度 ~50ms', '中度 ~150ms', '高度 ~200ms', '最高 ~300ms'][wx.getStorageSync('tapVibration') || 1],
    _vibrationLabels: ['关闭', '轻度 ~50ms', '中度 ~150ms', '高度 ~200ms', '最高 ~300ms'],
    auditList: [],
    notifyList: [],
    hasPendingAudit: false,
    settingsHasAdvancedBlob: false,
    showEncryptionSheet: false,
    encryptionSheetItems: [],
    encryptionSheetTapIndex: -1,
    // 自定义 Modal（替代 wx.showModal，真机不渲染）
    showCustomModal: false,
    customModalTitle: '',
    customModalContent: '',
    customModalConfirm: '确认',
    customModalCancel: '取消',
    customModalShowInput: false,
    customModalPlaceholder: '',
    customModalInputValue: '',
    notifySwipeId: '',
    notifyTouchStartX: 0,
    notifyTouchStartY: 0,
    hasUnreadNotify: false,
    hasMyTabBadge: false,
    exportPeriod: 0, // 0月度/1季度/2年度/3日度
    exportFormatOptions: ['.EXCEL', '.PDF'],
    exportFormatIndex: 0,
    exportPickerDate: '', // 月:YYYY-MM 年:YYYY 日:YYYY-MM-DD
    exportDateText: '',
    exportQuarterMultiIndex: [0, 0],
    exportSelectedYear: 2026,
    exportPersonalItems: [
      { key: 'personal_advance', label: '个人垫付款', checked: true },
      { key: 'personal_payable', label: '个人应付款', checked: true },
      { key: 'personal_inout', label: '个人收支款', checked: true },
      { key: 'personal_report', label: '个人报表导出', checked: true },
    ],
    exportCompanyItems: [
      { key: 'company_advance', label: '公司垫付款', checked: true },
      { key: 'company_payable', label: '公司应付款', checked: true },
      { key: 'company_inout', label: '公司收支款', checked: true },
      { key: 'company_report', label: '公司报表导出', checked: true },
    ],
    exportPersonalAll: true,
    exportCompanyAll: true,
    // 添加分类弹窗
    showCatModal: false,
    catModalScope: 'personal',
    catModalName: '',
    catModalEmoji: '📌',
    catEmojiList: ['🍽','🚗','🛍','🎮','💰','💼','📈','🏠','📱','🏥','🛵','🚕','🍿','📦','💡','🎁','✍','💎','👗','💄','🐱','⚽','🧳','🎲','📖','📷','🎵','🎨','🍰','🌷','🧧','↩','🎯','🎀','🧾','🪙','💹','🏘','🅿','🧽','📋','💵','✈','🏢','🍷','💳','🏗','💸','🚚','📊','🗣','🔧','💻','🛡','📢','🏦','📚'],
    customCards: [], // 自定义简览页已添加的卡片列表
    overviewCards: [], // 简览页实际渲染的卡片（从存储同步或默认）
    overviewMonth: (function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) })(), // 简览页所选月份 'YYYY-MM'，默认本月
    overviewYear: (function () { return String(new Date().getFullYear()) })(), // 标题栏「YYYY年」显示
    overviewMonthNum: (function () { return ('0' + (new Date().getMonth() + 1)).slice(-2) })(), // 标题栏「MM」显示
    overviewMonthMax: (function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) })(), // picker 上限：本月，禁止选未来
    defaultOverviewCards: [
      { id: 'd_personal', name: '个人账本', subtitle: '日常收支', span: 1, type: 'overview_personal' },
      { id: 'd_company', name: '公司账本', subtitle: '经营收支', span: 2, type: 'overview_company' },
    ],
    // 槽位拖放对话框
    showSlotModal: false,
    draggingTemplate: null,
    slotCards: [null, null, null],
    slotLayout: [],
    slotHover: -1, // 当前悬停的卡槽索引，-1 = 无
    dragFloat: { visible: false, x: 0, y: 0, name: '', subtitle: '' }, // 拖放中跟随手指的浮动卡片
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
        type: 'overview_personal', previewStyle: 'overview', hasAvatar: true,
        rows: [
          { label: '预算', value: '0.00', color: 'green' },
          { labels: ['收入', '支出', '结余'], values: ['0.00', '0.00', '0.00'], colors: ['green', 'red', 'red'], threeCol: true },
        ],
      },
      {
        id: 't_company', span: 2, name: '公司账本', subtitle: '经营收支', source: '简览页',
        type: 'overview_company', previewStyle: 'overview',
        rows: [
          { label: '总资金', value: '0.00', color: 'green' },
          { label: '总负债', value: '0.00', color: 'red' },
          { label: '净资产', value: '0.00', color: 'green' },
          { label: '可支配资产', value: '0.00', color: 'green' },
          { labels: ['应收', '应付'], values: ['0.00', '0.00'], colors: ['green', 'red'], threeCol: true },
        ],
      },
      // === 明细页卡片（个人/公司分开） ===
      {
        id: 't_detail_personal', span: 2, name: '个人流水明细', subtitle: '月度 · 季度 · 年度 · 日度', source: '明细页',
        type: 'detail_personal', previewStyle: 'detail',
        rows: [
          { label: '本月收入', value: '0.00', color: 'green' },
          { label: '本月支出', value: '0.00', color: 'red' },
          { label: '结余', value: '0.00', color: 'green' },
        ],
      },
      {
        id: 't_detail_company', span: 2, name: '公司流水明细', subtitle: '月度 · 季度 · 年度 · 日度', source: '明细页',
        type: 'detail_company', previewStyle: 'detail',
        rows: [
          { label: '本月收入', value: '0.00', color: 'green' },
          { label: '本月支出', value: '0.00', color: 'red' },
          { label: '结余', value: '0.00', color: 'green' },
        ],
      },
      {
        id: 't_jieqing_personal', span: 1, name: '个人待结清', subtitle: '垫付 · 应付', source: '明细页',
        type: 'jieqing_personal', previewStyle: 'overview',
        rows: [
          { label: '待结清笔数', value: '0', color: 'red' },
          { label: '待结清总额', value: '0.00', color: 'red' },
        ],
      },
      {
        id: 't_jieqing_company', span: 1, name: '公司待结清', subtitle: '垫付 · 应付', source: '明细页',
        type: 'jieqing_company', previewStyle: 'overview',
        rows: [
          { label: '待结清笔数', value: '0', color: 'red' },
          { label: '待结清总额', value: '0.00', color: 'red' },
        ],
      },
      // === 报表页图表卡片（折线图 / 柱状图 / 饼状图 × 个人 / 公司） ===
      // 无 rows，内容由 canvas 直接渲染报表页真实图表
      {
        id: 't_report_line_personal', span: 1, name: '个人折线图', subtitle: '净值趋势 · 个人', source: '报表页',
        type: 'report_line_personal', previewStyle: 'chart_line',
      },
      {
        id: 't_report_line_company', span: 1, name: '公司折线图', subtitle: '净值趋势 · 公司', source: '报表页',
        type: 'report_line_company', previewStyle: 'chart_line',
      },
      {
        id: 't_report_bar_personal', span: 1, name: '个人柱状图', subtitle: '收支对比 · 个人', source: '报表页',
        type: 'report_bar_personal', previewStyle: 'chart_bar',
      },
      {
        id: 't_report_bar_company', span: 1, name: '公司柱状图', subtitle: '收支对比 · 公司', source: '报表页',
        type: 'report_bar_company', previewStyle: 'chart_bar',
      },
      {
        id: 't_report_pie_personal', span: 1, name: '个人饼状图', subtitle: '分类占比 · 个人', source: '报表页',
        type: 'report_pie_personal', previewStyle: 'chart_pie',
      },
      {
        id: 't_report_pie_company', span: 1, name: '公司饼状图', subtitle: '分类占比 · 公司', source: '报表页',
        type: 'report_pie_company', previewStyle: 'chart_pie',
      },
    ],
    vipDetailId: -1,
    vipSelected: -1,
    vipEnterpriseSeats: 4,
    vipCards: [
      {
        id: 1, name: '个人版 PRO', tagline: '单人 · 月付', price: '12', unit: '/月', theme: 'personal',
        features: [
          '无限语音调用',
          '无限凭证扫描上传',
          '云端存储空间',
          '无限导出账单',
          '数据云端保障',
        ],
        isContact: false, isEnterprise: false,
      },
      {
        id: 2, name: '企业版 PRO', tagline: '团队 · 专属可分享 UID', price: '30', unit: '/月起', theme: 'enterprise',
        features: [
          '包含个人版 PRO 全部权益',
          '唯一专属可分享 UID',
          '席位更便宜 · 4 人起步',
          '每增 1 席位 +8 元/月',
          '10 人以上仅提供年费（8.8 折）',
        ],
        enterpriseSeats: { min: 4, max: 20, basePrice: 30, pricePerSeat: 8, annualDiscount: 0.88, annualOnlyAbove: 10 },
        isContact: false, isEnterprise: true,
      },
      {
        id: 3, name: '企业版定制', tagline: '超大团队 · 专属服务', price: '', unit: '', theme: 'custom',
        features: [
          '20 人以上超大团队',
          '专属财务客服',
          '企业税务服务',
          '定制化功能开发',
        ],
        isContact: true, isEnterprise: false,
      },
    ],
    // === 自定义分类 ===
    catTabPersonal: 'out', // 个人分类当前筛选：'in' 收入 / 'out' 支出
    catTabCompany: 'out',  // 公司分类当前筛选
    personalCategories: cloneCategories(DEFAULT_PERSONAL_CATEGORIES),
    companyCategories: cloneCategories(DEFAULT_COMPANY_CATEGORIES),
  }
}

module.exports = { createInitialData }
