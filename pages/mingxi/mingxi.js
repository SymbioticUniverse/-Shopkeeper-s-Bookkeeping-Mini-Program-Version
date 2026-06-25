const api = require('../../utils/api')
const xlsx = require('../../utils/xlsx')

// 多语言翻译表
const LANG_TABLE = {
  tab_detail:       { 'zh-CN': '明细',     'zh-TW': '明細',     'ja-JP': '明細',     'en-US': 'Details' },
  tab_report:       { 'zh-CN': '报表',     'zh-TW': '報表',     'ja-JP': 'レポート', 'en-US': 'Reports' },
  tab_book:         { 'zh-CN': '记账',     'zh-TW': '記賬',     'ja-JP': '記帳',     'en-US': 'Book' },
  tab_settle:       { 'zh-CN': '结清',     'zh-TW': '結清',     'ja-JP': '精算',     'en-US': 'Settle' },
  tab_my:           { 'zh-CN': '我的',     'zh-TW': '我的',     'ja-JP': 'マイ',     'en-US': 'My' },
  my_login_register:  { 'zh-CN': '登录/注册',  'zh-TW': '登錄/註冊',  'ja-JP': 'ログイン',     'en-US': 'Login / Register' },
  my_login_text:      { 'zh-CN': '登录 / 注册', 'zh-TW': '登錄 / 註冊', 'ja-JP': 'ログイン / 登録', 'en-US': 'Login / Register' },
  vip_title:          { 'zh-CN': '升级为VIP',   'zh-TW': '升級為VIP',  'ja-JP': 'VIPにアップグレード', 'en-US': 'Upgrade to VIP' },
  vip_sub:            { 'zh-CN': '畅享更多高级功能', 'zh-TW': '暢享更多高級功能', 'ja-JP': 'より多くの機能を楽しむ', 'en-US': 'Enjoy more advanced features' },
  vip_subscribe:      { 'zh-CN': '升级订阅版',   'zh-TW': '升級訂閱版', 'ja-JP': 'サブスクリプション', 'en-US': 'Subscribe' },
  my_link_company:    { 'zh-CN': '链接公司',   'zh-TW': '鏈接公司',   'ja-JP': '会社リンク',   'en-US': 'Link Company' },
  my_invite_employee: { 'zh-CN': '邀请员工',   'zh-TW': '邀請員工',   'ja-JP': '従業員招待',   'en-US': 'Invite Employee' },
  my_audit:           { 'zh-CN': '审核',       'zh-TW': '審核',       'ja-JP': '審査',         'en-US': 'Audit' },
  my_notify:          { 'zh-CN': '通知',       'zh-TW': '通知',       'ja-JP': '通知',         'en-US': 'Notifications' },
  my_share_ledger:    { 'zh-CN': '链接公司共享同一账本', 'zh-TW': '鏈接公司共享同一賬本', 'ja-JP': '会社と帳簿を共有', 'en-US': 'Share Ledger with Company' },
  my_share_sub:       { 'zh-CN': '随时记账再也不忘', 'zh-TW': '隨時記賬再也不會忘', 'ja-JP': 'いつでも記帳', 'en-US': 'Never forget to bookkeep' },
  my_export:          { 'zh-CN': '导出账单',   'zh-TW': '導出賬單',   'ja-JP': '帳票出力',     'en-US': 'Export Bills' },
  my_export_sub:      { 'zh-CN': '一键导出',   'zh-TW': '一鍵導出',   'ja-JP': 'ワンクリック出力', 'en-US': 'One-click Export' },
  my_contact:         { 'zh-CN': '联系我们获好礼', 'zh-TW': '聯繫我們獲好禮', 'ja-JP': 'お問い合わせ', 'en-US': 'Contact Us for Gifts' },
  my_contact_sub:     { 'zh-CN': '提意见赠会员', 'zh-TW': '提意見贈會員', 'ja-JP': '意見でVIP進呈', 'en-US': 'Feedback for VIP' },
  my_settings:        { 'zh-CN': '设置',       'zh-TW': '設置',       'ja-JP': '設定',         'en-US': 'Settings' },
  custom_overview_title:   { 'zh-CN': '自定义简览页', 'zh-TW': '自定義簡覽頁', 'ja-JP': 'カスタム概要', 'en-US': 'Custom Overview' },
  custom_overview_sub:     { 'zh-CN': '新简览',       'zh-TW': '新簡覽',       'ja-JP': '新概要',       'en-US': 'New Overview' },
  custom_cat_title:    { 'zh-CN': '自定义分类', 'zh-TW': '自定義分類', 'ja-JP': 'カスタム分類', 'en-US': 'Custom Category' },
  custom_cat_sub:      { 'zh-CN': '新分类',     'zh-TW': '新分類',     'ja-JP': '新分類',       'en-US': 'New Category' },
  export_title:       { 'zh-CN': '导出账单',   'zh-TW': '導出賬單',   'ja-JP': '帳票出力',     'en-US': 'Export Bills' },
  audit_title:      { 'zh-CN': '审核',        'zh-TW': '審核',        'ja-JP': '審査',         'en-US': 'Audit' },
  notify_title:     { 'zh-CN': '通知',        'zh-TW': '通知',        'ja-JP': '通知',         'en-US': 'Notifications' },
  contact_title:      { 'zh-CN': '联系我们获好礼', 'zh-TW': '聯繫我們獲好禮', 'ja-JP': 'お問い合わせ', 'en-US': 'Contact Us for Gifts' },
  contact_info_title: { 'zh-CN': '提意见，赠 VIP 会员', 'zh-TW': '提意見，贈 VIP 會員', 'ja-JP': '意見でVIP進呈', 'en-US': 'Submit Feedback, Get VIP' },
  contact_info_desc:  { 'zh-CN': '您的每一条建议我们都认真对待，提交有效反馈即可获赠 VIP 会员体验', 'zh-TW': '您的每一條建議我們都認真對待，提交有效反饋即可獲贈 VIP 會員體驗', 'ja-JP': 'ご意見を真摯に受け止め、有効なフィードバックにはVIP会員権を進呈します', 'en-US': 'We take every suggestion seriously. Submit valid feedback to receive a VIP membership trial.' },
  contact_placeholder:{ 'zh-CN': '请在此输入您的意见或建议...', 'zh-TW': '請在此輸入您的意見或建議...', 'ja-JP': 'ご意見・ご提案を入力してください...', 'en-US': 'Please enter your feedback or suggestions...' },
  contact_submit:     { 'zh-CN': '提交反馈',   'zh-TW': '提交反饋',   'ja-JP': '送信',         'en-US': 'Submit Feedback' },
  contact_other:      { 'zh-CN': '其他联系方式', 'zh-TW': '其他聯繫方式', 'ja-JP': 'その他の連絡先', 'en-US': 'Other Contact Methods' },
  contact_email_label:{ 'zh-CN': '官方邮箱',   'zh-TW': '官方郵箱',   'ja-JP': '公式メール',   'en-US': 'Official Email' },
  settings_title:     { 'zh-CN': '设置',       'zh-TW': '設置',       'ja-JP': '設定',         'en-US': 'Settings' },
  settings_general:   { 'zh-CN': '通用',       'zh-TW': '通用',       'ja-JP': '一般',         'en-US': 'General' },
  settings_language:  { 'zh-CN': '语言',       'zh-TW': '語言',       'ja-JP': '言語',         'en-US': 'Language' },
  settings_darkmode:  { 'zh-CN': '深色模式',   'zh-TW': '深色模式',   'ja-JP': 'ダークモード', 'en-US': 'Dark Mode' },
  settings_privacy:   { 'zh-CN': '隐私与安全', 'zh-TW': '隱私與安全', 'ja-JP': 'プライバシー', 'en-US': 'Privacy & Security' },
  settings_privacy_item:  { 'zh-CN': '隐私设置', 'zh-TW': '隱私設置', 'ja-JP': 'プライバシー設定', 'en-US': 'Privacy Settings' },
  settings_security:  { 'zh-CN': '账号安全',   'zh-TW': '賬號安全',   'ja-JP': 'セキュリティ', 'en-US': 'Account Security' },
  settings_ledger:    { 'zh-CN': '修改公司关系', 'zh-TW': '修改公司關係', 'ja-JP': '会社関係変更', 'en-US': 'Modify Company' },
  settings_ledger_personal: { 'zh-CN': '个人账本', 'zh-TW': '個人賬本', 'ja-JP': '個人帳簿', 'en-US': 'Personal Ledger' },
  settings_ledger_personal_val: { 'zh-CN': '请先注册或加入公司', 'zh-TW': '請先註冊或加入公司', 'ja-JP': '登録または会社に参加してください', 'en-US': 'Register or Join a Company' },
  settings_rechoose_company: { 'zh-CN': '重新选择公司', 'zh-TW': '重新選擇公司', 'ja-JP': '会社を再選択', 'en-US': 'Re-choose Company' },
  settings_rechoose_hint:    { 'zh-CN': '更换绑定的公司', 'zh-TW': '更換綁定的公司', 'ja-JP': '会社を変更', 'en-US': 'Switch company' },
  settings_dissolve: { 'zh-CN': '解散公司',   'zh-TW': '解散公司',   'ja-JP': '会社解散',     'en-US': 'Dissolve Company' },
  settings_dissolve_hint: { 'zh-CN': '不可撤销', 'zh-TW': '不可撤銷', 'ja-JP': '取消不可',   'en-US': 'Irreversible' },
  settings_other:     { 'zh-CN': '其他',       'zh-TW': '其他',       'ja-JP': 'その他',       'en-US': 'Other' },
  settings_clear_cache:   { 'zh-CN': '清除缓存', 'zh-TW': '清除緩存', 'ja-JP': 'キャッシュ削除', 'en-US': 'Clear Cache' },
  settings_about:     { 'zh-CN': '关于我们',   'zh-TW': '關於我們',   'ja-JP': 'アプリ情報',   'en-US': 'About' },
  settings_logout:    { 'zh-CN': '退出登录',   'zh-TW': '退出登錄',   'ja-JP': 'ログアウト',   'en-US': 'Log Out' },
  detail_personal_ledger: { 'zh-CN': '个人账本', 'zh-TW': '個人賬本', 'ja-JP': '個人帳簿', 'en-US': 'Personal Ledger' },
  detail_company_ledger:  { 'zh-CN': '公司账本', 'zh-TW': '公司賬本', 'ja-JP': '会社帳簿', 'en-US': 'Company Ledger' },
  report_title:     { 'zh-CN': '报表',     'zh-TW': '報表',     'ja-JP': 'レポート', 'en-US': 'Reports' },
  book_income:      { 'zh-CN': '收入',     'zh-TW': '收入',     'ja-JP': '収入',     'en-US': 'Income' },
  book_expense:     { 'zh-CN': '支出',     'zh-TW': '支出',     'ja-JP': '支出',     'en-US': 'Expense' },
  book_transfer:    { 'zh-CN': '转账',     'zh-TW': '轉賬',     'ja-JP': '振替',     'en-US': 'Transfer' },
  detail_period_month:  { 'zh-CN': '月度', 'zh-TW': '月度', 'ja-JP': '月次', 'en-US': 'Monthly' },
  detail_period_quarter:{ 'zh-CN': '季度', 'zh-TW': '季度', 'ja-JP': '四半期', 'en-US': 'Quarterly' },
  detail_period_year:   { 'zh-CN': '年度', 'zh-TW': '年度', 'ja-JP': '年次', 'en-US': 'Yearly' },
  detail_period_day:    { 'zh-CN': '日度', 'zh-TW': '日度', 'ja-JP': '日次', 'en-US': 'Daily' },
  report_quarter_q1:   { 'zh-CN': '1季度',   'zh-TW': '1季度',   'ja-JP': 'Q1',   'en-US': 'Q1' },
  report_quarter_q2:   { 'zh-CN': '2季度',   'zh-TW': '2季度',   'ja-JP': 'Q2',   'en-US': 'Q2' },
  report_quarter_q3:   { 'zh-CN': '3季度',   'zh-TW': '3季度',   'ja-JP': 'Q3',   'en-US': 'Q3' },
  report_quarter_q4:   { 'zh-CN': '4季度',   'zh-TW': '4季度',   'ja-JP': 'Q4',   'en-US': 'Q4' },
  lang_zhcn: { 'zh-CN': '简体中文', 'zh-TW': '簡體中文', 'ja-JP': '簡体字中国語', 'en-US': 'Simplified Chinese' },
  lang_zhtw: { 'zh-CN': '繁體中文', 'zh-TW': '繁體中文', 'ja-JP': '繁体字中国語', 'en-US': 'Traditional Chinese' },
  lang_jajp: { 'zh-CN': '日本語',   'zh-TW': '日本語',   'ja-JP': '日本語',       'en-US': 'Japanese' },
  lang_enus: { 'zh-CN': 'English',  'zh-TW': 'English',  'ja-JP': 'English',      'en-US': 'English' },
  dark_system:  { 'zh-CN': '跟随系统', 'zh-TW': '跟隨系統', 'ja-JP': 'システム連動', 'en-US': 'Follow System' },
  dark_light:   { 'zh-CN': '浅色模式', 'zh-TW': '淺色模式', 'ja-JP': 'ライトモード', 'en-US': 'Light Mode' },
  dark_dark:    { 'zh-CN': '深色模式', 'zh-TW': '深色模式', 'ja-JP': 'ダークモード', 'en-US': 'Dark Mode' },
  toast_lang_changed:    { 'zh-CN': '语言已切换',    'zh-TW': '語言已切換',    'ja-JP': '言語切替完了',   'en-US': 'Language changed' },
  toast_dev:             { 'zh-CN': '功能开发中',    'zh-TW': '功能開發中',    'ja-JP': '開発中',          'en-US': 'Coming soon' },
  toast_feedback_ok:     { 'zh-CN': '感谢您的反馈！VIP 会员已赠送', 'zh-TW': '感謝您的反饋！VIP 會員已贈送', 'ja-JP': 'ご意見ありがとう！VIP進呈', 'en-US': 'Thanks for your feedback! VIP granted.' },
  toast_input_required:  { 'zh-CN': '请输入您的意见或建议', 'zh-TW': '請輸入您的意見或建議', 'ja-JP': 'ご意見を入力してください', 'en-US': 'Please enter your feedback' },
  toast_no_company:      { 'zh-CN': '请先注册公司', 'zh-TW': '請先註冊公司', 'ja-JP': '先に会社登録を', 'en-US': 'Please register a company first' },
  toast_approved:        { 'zh-CN': '已通过',       'zh-TW': '已通過',       'ja-JP': '承認済',       'en-US': 'Approved' },
  toast_rejected:        { 'zh-CN': '已拒绝',       'zh-TW': '已拒絕',       'ja-JP': '拒否済',       'en-US': 'Rejected' },
  toast_logged_out:      { 'zh-CN': '已退出登录',    'zh-TW': '已退出登錄',    'ja-JP': 'ログアウト完了',  'en-US': 'Logged out' },
  toast_left_company:    { 'zh-CN': '已退出公司',    'zh-TW': '已退出公司',    'ja-JP': '会社退出完了',    'en-US': 'Left company' },
  toast_dissolved:       { 'zh-CN': '公司已解散',    'zh-TW': '公司已解散',    'ja-JP': '会社解散完了',    'en-US': 'Company dissolved' },
  toast_cache_cleared:   { 'zh-CN': '缓存已清除',    'zh-TW': '緩存已清除',    'ja-JP': 'キャッシュ削除完了', 'en-US': 'Cache cleared' },
  modal_clear_cache_title:   { 'zh-CN': '清除缓存',   'zh-TW': '清除緩存',   'ja-JP': 'キャッシュ削除', 'en-US': 'Clear Cache' },
  modal_clear_cache_content: { 'zh-CN': '确定要清除本地缓存数据吗？', 'zh-TW': '確定要清除本地緩存數據嗎？', 'ja-JP': 'ローカルキャッシュを削除しますか？', 'en-US': 'Clear local cache data?' },
  modal_logout_title:   { 'zh-CN': '退出登录',   'zh-TW': '退出登錄',   'ja-JP': 'ログアウト',   'en-US': 'Log Out' },
  modal_logout_content: { 'zh-CN': '确定要退出当前账号吗？', 'zh-TW': '確定要退出當前賬號嗎？', 'ja-JP': '現在のアカウントからログアウトしますか？', 'en-US': 'Log out of current account?' },
  modal_leave_company_title: { 'zh-CN': '退出公司', 'zh-TW': '退出公司', 'ja-JP': '会社退出', 'en-US': 'Leave Company' },
  modal_leave_company_content: { 'zh-CN': '退出后你将无法查看公司账本，确定退出吗？', 'zh-TW': '退出後將無法查看公司賬本，確定退出嗎？', 'ja-JP': '退出後は会社帳簿を閲覧できません。よろしいですか？', 'en-US': 'You will lose access to company ledger. Confirm?' },
  modal_dissolve_title: { 'zh-CN': '解散公司', 'zh-TW': '解散公司', 'ja-JP': '会社解散', 'en-US': 'Dissolve Company' },
  modal_dissolve_content: { 'zh-CN': '解散后所有员工将无法查看公司账本，此操作不可撤销，确定解散吗？', 'zh-TW': '解散後所有員工將無法查看公司賬本，此操作不可撤銷，確定解散嗎？', 'ja-JP': '解散後は全従業員が会社帳簿を閲覧できなくなります。取消不可、解散しますか？', 'en-US': 'All employees will lose access. This is irreversible. Confirm?' },
  notify_no_data:   { 'zh-CN': '暂无通知',    'zh-TW': '暫無通知',    'ja-JP': '通知なし',     'en-US': 'No notifications' },
  notify_delete:    { 'zh-CN': '删除',        'zh-TW': '刪除',        'ja-JP': '削除',         'en-US': 'Delete' },
  audit_no_data:    { 'zh-CN': '暂无审核',    'zh-TW': '暫無審核',    'ja-JP': '審査なし',     'en-US': 'No pending audits' },
  audit_approve:    { 'zh-CN': '通过',        'zh-TW': '通過',        'ja-JP': '承認',         'en-US': 'Approve' },
  audit_reject:     { 'zh-CN': '拒绝',        'zh-TW': '拒絕',        'ja-JP': '拒否',         'en-US': 'Reject' },
  audit_status_approved: { 'zh-CN': '已通过', 'zh-TW': '已通過', 'ja-JP': '承認済', 'en-US': 'Approved' },
  audit_status_rejected: { 'zh-CN': '已拒绝', 'zh-TW': '已拒絕', 'ja-JP': '拒否済', 'en-US': 'Rejected' },
  login_wx_btn:     { 'zh-CN': '微信一键登录', 'zh-TW': '微信一鍵登錄', 'ja-JP': 'WeChatログイン', 'en-US': 'WeChat Login' },
  login_agreement:  { 'zh-CN': '登录即代表同意《用户协议》和《隐私政策》', 'zh-TW': '登錄即代表同意《用戶協議》和《隱私政策》', 'ja-JP': 'ログインで利用規約とプライバシーポリシーに同意', 'en-US': 'By logging in, you agree to the User Agreement and Privacy Policy.' },
  login_other:      { 'zh-CN': '其他登录方式', 'zh-TW': '其他登錄方式', 'ja-JP': '他のログイン方法', 'en-US': 'Other Login Methods' },
  company_boss_title:   { 'zh-CN': '我是老板',   'zh-TW': '我是老闆',   'ja-JP': '経営者',     'en-US': 'I am the Boss' },
  company_employee_title: { 'zh-CN': '我是员工', 'zh-TW': '我是員工',   'ja-JP': '従業員',     'en-US': 'I am an Employee' },
  company_name_label:  { 'zh-CN': '公司名称',   'zh-TW': '公司名稱',   'ja-JP': '会社名',       'en-US': 'Company Name' },
  company_uid_label:   { 'zh-CN': 'UID 码',     'zh-TW': 'UID 碼',     'ja-JP': 'UIDコード',   'en-US': 'UID Code' },
  company_join_btn:    { 'zh-CN': '一键加入公司', 'zh-TW': '一鍵加入公司', 'ja-JP': '会社に参加', 'en-US': 'Join Company' },
  company_create_btn:  { 'zh-CN': '确认创建',   'zh-TW': '確認創建',   'ja-JP': '作成確認',     'en-US': 'Create' },
  company_employee_success_title: { 'zh-CN': '已链接公司', 'zh-TW': '已鏈接公司', 'ja-JP': '会社リンク済', 'en-US': 'Company Linked' },
  company_employee_success_role:  { 'zh-CN': '员工', 'zh-TW': '員工', 'ja-JP': '従業員', 'en-US': 'Employee' },
  export_from:        { 'zh-CN': '从',         'zh-TW': '從',         'ja-JP': 'から',         'en-US': 'From' },
  export_to:          { 'zh-CN': '到',         'zh-TW': '到',         'ja-JP': 'まで',         'en-US': 'To' },
  export_format:      { 'zh-CN': '导出格式',   'zh-TW': '導出格式',   'ja-JP': '出力形式',     'en-US': 'Format' },
  export_section_personal: { 'zh-CN': '个人总账本', 'zh-TW': '個人總賬本', 'ja-JP': '個人総勘定元帳', 'en-US': 'Personal Ledger' },
  export_section_company:  { 'zh-CN': '公司总账本', 'zh-TW': '公司總賬本', 'ja-JP': '会社総勘定元帳', 'en-US': 'Company Ledger' },
  export_btn:         { 'zh-CN': '一键导出',   'zh-TW': '一鍵導出',   'ja-JP': 'ワンクリック出力', 'en-US': 'Export' },
  settle_personal:  { 'zh-CN': '个人',     'zh-TW': '個人',     'ja-JP': '個人',     'en-US': 'Personal' },
  settle_company:   { 'zh-CN': '公司',     'zh-TW': '公司',     'ja-JP': '会社',     'en-US': 'Company' },
}
function getTLang(lang) {
  const r = {}
  for (const k of Object.keys(LANG_TABLE)) {
    r[k] = (LANG_TABLE[k][lang] || LANG_TABLE[k]['zh-CN'] || k)
  }
  return r
}
function getLangLabel(lang) {
  const map = { 'zh-CN': '简体中文', 'zh-TW': '繁體中文', 'ja-JP': '日本語', 'en-US': 'English' }
  return map[lang] || '简体中文'
}

Page({
  data: {
    t: {},
    showHeader: true,
    showOverview: true, // 简览页 vs 明细页
    isDarkMode: false, // 深色模式
    currentTab: 0,
    tabSlideDir: '',
    tabs: [
      { text: '明细', icon: '/assets/icons/mingxi.png' },
      { text: '报表', icon: '/assets/icons/baobiao.png' },
      { text: '记账', icon: '/assets/icons/jizhang.png' },
      { text: '结清', icon: '/assets/icons/jieqing.png' },
      { text: '我的', icon: '/assets/icons/wode.png' },
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
    reportSummary: { income: '0.00', expense: '0.00', balance: '0.00', balanceNeg: false, incomeCats: [], expenseCats: [], proUnlocked: true, empty: true }, // 报表筛选汇总：总收入/支出/结余 + 分类拆解；proUnlocked 预留鉴权钩子
    reportChartType: 0, // 报表图表三合一：0=折线 1=柱状 2=饼图，点击切换共用同一区域
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
    maxDate: (function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) })(), // 图表/明细日期选择器上限：今天，禁止选未来
    detailDateText: '2026年06月',
    detailItems: [],
    detailGroups: [],
    // 弹窗 & 滑动
    modalItem: null,
    modalFrom: '',
    modalIsPersonal: true,
    modalEdit: {},
    // 记账弹窗
    showBookPopup: false,
    bookForm: { type: 'expense', amount: '', category: '', date: '', note: '', target: '', targetType: 'external' },
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
    // 登录状态
    isLoggedIn: false,
    userInfo: null,
    avatarDisplay: '',          // 头像实际显示路径（本地临时/带头下载到本地），优先于 userInfo.avatarUrl
    showProfileModal: false,    // 资料设置弹窗（新用户引导 + 我的页编辑共用）
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
    employeeUid: '',
    // 首次引导
    showGuide: false,
    guideStep: 0,
    guideRole: '',
    loginPhone: '',
    loginCode: '',
    loginCodeSending: false,
    loginCodeCountdown: 0,
    showCustomOverview: false,
    showCustomCategory: false, // 自定义分类页
    showExportBill: false, // 导出账单页
    // AI 对话
    showAiChat: false,
    aiMessages: [],
    aiInputText: '',
    aiThinking: false,
    aiScrollTop: 0,
    aiVoiceMode: true,
    aiRecording: false,
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
    auditList: [],
    notifyList: [],
    hasPendingAudit: false,
    notifySwipeId: '',
    notifyTouchStartX: 0,
    notifyTouchStartY: 0,
    hasUnreadNotify: false,
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
    personalCategories: [
      { id: 'p_1', name: '餐饮', emoji: '🍽', inOut: 'out' },
      { id: 'p_2', name: '交通', emoji: '🚗', inOut: 'out' },
      { id: 'p_3', name: '购物', emoji: '🛍', inOut: 'out' },
      { id: 'p_4', name: '娱乐', emoji: '🎮', inOut: 'out' },
      { id: 'p_5', name: '工资', emoji: '💰', inOut: 'in' },
      { id: 'p_6', name: '兼职', emoji: '💼', inOut: 'in' },
      { id: 'p_7', name: '投资', emoji: '📈', inOut: 'in' },
      { id: 'p_8', name: '租金', emoji: '🏠', inOut: 'in' },
      { id: 'p_9', name: '通讯', emoji: '📱', inOut: 'out' },
      { id: 'p_10', name: '医疗', emoji: '🏥', inOut: 'out' },
      { id: 'p_11', name: '外卖', emoji: '🛵', inOut: 'out' },
      { id: 'p_12', name: '打车', emoji: '🚕', inOut: 'out' },
      { id: 'p_13', name: '零食', emoji: '🍿', inOut: 'out' },
      { id: 'p_14', name: '快递', emoji: '📦', inOut: 'out' },
      { id: 'p_15', name: '水电', emoji: '💡', inOut: 'out' },
      { id: 'p_16', name: '奖金', emoji: '🎁', inOut: 'in' },
      { id: 'p_17', name: '稿费', emoji: '✍', inOut: 'in' },
	      { id: 'p_18', name: '理财', emoji: '💎', inOut: 'in' },
{ id: 'p_19', name: '服装', emoji: '👗', inOut: 'out' },
	      { id: 'p_20', name: '美妆', emoji: '💄', inOut: 'out' },
	      { id: 'p_21', name: '宠物', emoji: '🐱', inOut: 'out' },
	      { id: 'p_22', name: '运动', emoji: '⚽', inOut: 'out' },
	      { id: 'p_23', name: '旅行', emoji: '🧳', inOut: 'out' },
	      { id: 'p_24', name: '游戏', emoji: '🎲', inOut: 'out' },
	      { id: 'p_25', name: '电影', emoji: '🎬', inOut: 'out' },
	      { id: 'p_26', name: '摄影', emoji: '📷', inOut: 'out' },
	      { id: 'p_27', name: '音乐', emoji: '🎵', inOut: 'out' },
	      { id: 'p_28', name: '画画', emoji: '🎨', inOut: 'out' },
	      { id: 'p_29', name: '烘焙', emoji: '🍰', inOut: 'out' },
	      { id: 'p_30', name: '养花', emoji: '🌷', inOut: 'out' },
	      { id: 'p_31', name: '红包', emoji: '🧧', inOut: 'in' },
	      { id: 'p_32', name: '退款', emoji: '↩', inOut: 'in' },
	      { id: 'p_33', name: '中奖', emoji: '🎯', inOut: 'in' },
	      { id: 'p_34', name: '礼金', emoji: '🎀', inOut: 'in' },
	      { id: 'p_35', name: '报销', emoji: '🧾', inOut: 'in' },
	      { id: 'p_36', name: '补贴', emoji: '🪙', inOut: 'in' },
	      { id: 'p_37', name: '代购', emoji: '🛒', inOut: 'payForward' },
	      { id: 'p_38', name: '垫餐', emoji: '🍱', inOut: 'payForward' },
	      { id: 'p_39', name: '垫车费', emoji: '🚕', inOut: 'payForward' },
	      { id: 'p_40', name: '垫物料', emoji: '📦', inOut: 'payForward' },
	      { id: 'p_41', name: '借款', emoji: '💰', inOut: 'payable' },
	      { id: 'p_42', name: '欠款', emoji: '📝', inOut: 'payable' },
	      { id: 'p_43', name: '分期', emoji: '🔄', inOut: 'payable' },
	      { id: 'p_44', name: '赊账', emoji: '🧾', inOut: 'payable' },
	      { id: 'p_45', name: '饮品', emoji: '🧋', inOut: 'out' },
	      { id: 'p_46', name: '住房', emoji: '🏠', inOut: 'out' },
	      { id: 'p_47', name: '人情', emoji: '🧧', inOut: 'out' },
	      { id: 'p_48', name: '办公', emoji: '🖊', inOut: 'out' },
	      { id: 'p_49', name: '金融', emoji: '🏦', inOut: 'out' },
    ],
    companyCategories: [
      { id: 'c_1', name: '采购', emoji: '📋', inOut: 'out' },
      { id: 'c_2', name: '回款', emoji: '💵', inOut: 'in' },
      { id: 'c_3', name: '差旅', emoji: '✈', inOut: 'out' },
      { id: 'c_4', name: '营收', emoji: '🏢', inOut: 'in' },
      { id: 'c_5', name: '招待', emoji: '🍷', inOut: 'out' },
      { id: 'c_6', name: '融资', emoji: '💳', inOut: 'in' },
      { id: 'c_7', name: '租金', emoji: '🏗', inOut: 'out' },
      { id: 'c_8', name: '分红', emoji: '💸', inOut: 'in' },
      { id: 'c_9', name: '物料', emoji: '📦', inOut: 'out' },
      { id: 'c_10', name: '物流', emoji: '🚚', inOut: 'out' },
      { id: 'c_11', name: '税费', emoji: '📊', inOut: 'out' },
      { id: 'c_12', name: '咨询', emoji: '🗣', inOut: 'in' },
      { id: 'c_13', name: '维修', emoji: '🔧', inOut: 'out' },
      { id: 'c_14', name: '软件', emoji: '💻', inOut: 'out' },
      { id: 'c_15', name: '保险', emoji: '🛡', inOut: 'out' },
      { id: 'c_16', name: '广告', emoji: '📢', inOut: 'out' },
      { id: 'c_17', name: '利息', emoji: '🏦', inOut: 'in' },
      { id: 'c_18', name: '培训', emoji: '📚', inOut: 'in' },
{ id: 'c_19', name: '办公用品', emoji: '🖊', inOut: 'out' },
	      { id: 'c_20', name: '房租', emoji: '🏢', inOut: 'out' },
	      { id: 'c_21', name: '水电物业', emoji: '🔌', inOut: 'out' },
	      { id: 'c_22', name: '快递物流', emoji: '📮', inOut: 'out' },
	      { id: 'c_23', name: '团建', emoji: '🎉', inOut: 'out' },
	      { id: 'c_24', name: '招聘', emoji: '👔', inOut: 'out' },
	      { id: 'c_25', name: '外包', emoji: '🤝', inOut: 'out' },
	      { id: 'c_26', name: '服务器', emoji: '🖥', inOut: 'out' },
	      { id: 'c_27', name: '域名', emoji: '🌐', inOut: 'out' },
	      { id: 'c_28', name: '认证', emoji: '✅', inOut: 'out' },
	      { id: 'c_29', name: '打印', emoji: '🖨', inOut: 'out' },
	      { id: 'c_30', name: '保洁', emoji: '🧹', inOut: 'out' },
	      { id: 'c_31', name: '合同款', emoji: '📝', inOut: 'in' },
	      { id: 'c_32', name: '项目款', emoji: '📐', inOut: 'in' },
	      { id: 'c_33', name: '服务费', emoji: '⚙', inOut: 'in' },
	      { id: 'c_34', name: '佣金', emoji: '🤲', inOut: 'in' },
	      { id: 'c_35', name: '赞助', emoji: '🎗', inOut: 'in' },
	      { id: 'c_36', name: '政府补贴', emoji: '🏛', inOut: 'in' },
	      { id: 'c_37', name: '差旅垫付', emoji: '✈', inOut: 'payForward' },
	      { id: 'c_38', name: '采购垫付', emoji: '📋', inOut: 'payForward' },
	      { id: 'c_39', name: '办公垫付', emoji: '🖥', inOut: 'payForward' },
	      { id: 'c_40', name: '接待垫付', emoji: '🍷', inOut: 'payForward' },
	      { id: 'c_41', name: '货款', emoji: '📦', inOut: 'payable' },
	      { id: 'c_42', name: '工程款', emoji: '🏗', inOut: 'payable' },
	      { id: 'c_43', name: '服务费', emoji: '⚙', inOut: 'payable' },
	      { id: 'c_44', name: '租赁款', emoji: '🔑', inOut: 'payable' },
    ],
  },

  onLoad() {
    // 首次启动引导检测
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
    const savedUser = api.getUserInfo()
    if (savedUser) {
      this.setData({ isLoggedIn: true, userInfo: savedUser })
      this._refreshAvatarDisplay(savedUser)
    }
    api.migrate()
    const savedPCats = api.getCategories('personal')
    const savedCCats = api.getCategories('company')
    if (savedPCats && savedPCats.length) this.setData({ personalCategories: savedPCats })
    if (savedCCats && savedCCats.length) this.setData({ companyCategories: savedCCats })
    this.updateReportDate()
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

  onShow() {
    this._throttledSync()
    // 预请求麦克风权限，避免首次语音使用时弹窗打断体验
    if (this.data.isLoggedIn && !this._recordAuthRequested) {
      this._recordAuthRequested = true
      wx.authorize({ scope: 'scope.record' }).catch(() => {})
    }
  },

  // 进页面节流同步：以后端为准刷新本地缓存（30s 内最多一次）
  async _throttledSync() {
    if (this.data.showConflictPanel) return
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
    // 静默刷新 VIP 状态
    api.getVipStatus().then(function (s) { this.setData({ vipStatus: s, vipTrialDays: this._computeTrialDays(s) }) }.bind(this)).catch(function () {})
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
    if (this.data.conflictIndex <= 0) return
    this.setData({ conflictIndex: this.data.conflictIndex - 1 })
  },

  /** 下一个冲突 */
  onConflictNext() {
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
          resolvedItem: c.resolution === 'server' || c.resolution === 'restore'
            ? c.serverVersion
            : c.localVersion
        }
      })
      await api.resolveConflicts(resolutions)
      wx.showToast({ title: '冲突已解决', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '同步失败，请重试', icon: 'none' })
    }
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
    if (this.data.profileUploading) {
      wx.showToast({ title: '头像上传中…', icon: 'none' })
      return
    }
    const cur = this.data.userInfo || {}
    const name = (this.data.profileName || '').trim()
    const next = {
      nickName: name || cur.nickName,
      avatarUrl: this.data.profileAvatarUrl || cur.avatarUrl || ''
    }
    api.saveUserInfo(next)
    this.setData({
      userInfo: { ...cur, ...next },
      showProfileModal: false,
      avatarDisplay: this.data.profileAvatarLocal || this.data.avatarDisplay
    })
    // 仅刷新卡名（昵称变化），不重绘简览 canvas，避免真机崩溃重启
    this._syncOverviewCards(true)
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  onProfileSkip() {
    this.setData({ showProfileModal: false })
  },

  onProfileMaskTap() {
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
    const personalItems = api.getItems('personal').filter(it => !it._voided && inMonth(it))
    const companyItems = api.getItems('company').filter(it => !it._voided && inMonth(it))
    const sum = (items, fn) => items.filter(fn).reduce((s, it) => s + parseFloat(it.amount || 0), 0)
    // 金额缩写：千用 k、万用 W，最多 3 位小数
    const fmt = (n) => {
      if (n >= 10000) return +(n / 10000).toFixed(3) + 'W'
      if (n >= 1000) return +(n / 1000).toFixed(3) + 'k'
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
    const index = e.currentTarget.dataset.index
    const prevTab = this.data.currentTab
    const wasOverview = this.data.showOverview
    let dir = ''
    if (index === 2) {
      // 报表 canvas 是原生组件，记账弹窗打开时已被 wx:if 移除、不再穿透盖住弹窗，故无需先跳明细页规避
      this.onBookEntry({ currentTarget: { dataset: { type: 'expense' } } })
      return
    }
    if (wasOverview) {
      dir = 'slide-right'
    } else if (index !== prevTab) {
      dir = index > prevTab ? 'slide-right' : 'slide-left'
    }
    this.setData({
      currentTab: index, showOverview: false, tabSlideDir: dir,
      // 切 tab 时复位"我的"区域全部子页 + 自定义简览状态，避免再次进入"我的"停留在旧子页
      showVipPage: false, vipDetailId: -1, vipSelected: -1,
      showCustomCategory: false, showCompanyShare: false, showExportBill: false,
      showAuditPage: false, showContactPage: false, showSettingsPage: false,
      showNotifyPage: false, notifySwipeId: '', showLedgerPage: false,
      showPrivacyPage: false, showPrivacyPolicyPage: false, showAboutPage: false,
      showLoginPage: false, showCustomOverview: false,
    })
    if (dir) setTimeout(() => this.setData({ tabSlideDir: '' }), 400)
    if (index === 1) {
      setTimeout(() => {
        this._refreshReport()
      }, 300)
    }
    if (index === 0) {
      this.initDetailItems()
    }
    if (index === 3) {
      this.initSettleItems()
    }
  },

  // ---- Canvas 折线图 ----
  // 从真实记账数据聚合图表数据
  _aggregateChartData(optScope) {
    const scope = optScope || (this.data.reportType === 1 ? 'company' : 'personal')
    const stored = api.getItems(scope)
    if (stored.length === 0) return []

    const period = this.data.reportPeriod
    const now = new Date()
    const thisMonth = now.getMonth() + 1
    const thisYear = now.getFullYear()

    // Build a map: label -> { income, expense, receivable, payable, net }
    const map = {}

    const addToLabel = (label, item) => {
      if (!map[label]) map[label] = { label, income: 0, expense: 0, receivable: 0, payable: 0, net: 0 }
      const amount = parseFloat(item.amount) || 0
      if (item.type === 'in') {
        map[label].income += amount
      } else {
        map[label].expense += amount
      }
      if (item.typeLabel === '垫付') map[label].receivable += amount
      if (item.typeLabel === '应付') map[label].payable += amount
    }

    stored.forEach(item => {
      const d = new Date(item.date)
      if (isNaN(d.getTime())) return
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const day = d.getDate()

      if (period === 0 || period === 3) {
        // 月度/日度: 按天聚合
        const pickerDate = this.data.reportPickerDate || `${thisYear}-${String(thisMonth).padStart(2, '0')}`
        const [py, pm] = pickerDate.split('-').map(Number)
        if (y === py && m === pm) {
          addToLabel(String(day), item)
        }
      } else if (period === 1) {
        // 季度: 按月聚合
        const pickerDate = this.data.reportPickerDate || `${thisYear}-${String(thisMonth).padStart(2, '0')}`
        const [qy] = pickerDate.split('-').map(Number)
        const qStart = Math.floor((thisMonth - 1) / 3) * 3 + 1
        if (y === qy && m >= qStart && m <= qStart + 2) {
          addToLabel(`${m}月`, item)
        }
      } else if (period === 2) {
        // 年度: 按季度聚合
        const pickerDate = this.data.reportPickerDate || String(thisYear)
        const [ay] = pickerDate.split('-').map(Number)
        if (y === ay) {
          const qi = Math.floor((m - 1) / 3)
          const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
          addToLabel(quarters[qi], item)
        }
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

      ctx.fillStyle = '#00d042'
      ctx.fillRect(cx - blockW / 2, fy - gH, blockW, gH)

      ctx.fillStyle = '#ed2e2e'
      ctx.fillRect(cx - blockW / 2, fy, blockW, rH)

      ctx.fillStyle = C.dot
      ctx.beginPath()
      ctx.arc(cx, fy, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Legend
    const lx = ml, ly = 10
    ctx.fillStyle = '#00d042'
    ctx.fillRect(lx, ly, 8, 8)
    ctx.fillStyle = C.text
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('收入', lx + 12, ly + 8)

    ctx.fillStyle = '#ed2e2e'
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
      const netColor = pt.net >= 0 ? '#00d042' : '#ed2e2e'
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
        { label: '收入', val: pt.income, color: '#00d042' },
        { label: '支出', val: pt.expense, color: '#ed2e2e' },
        { label: '应收', val: pt.receivable, color: '#00d042' },
        { label: '应付', val: pt.payable, color: '#ed2e2e' },
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
    ctx.fillStyle = C.text
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('收入', lx + 12, ly + 8)
    ctx.fillStyle = '#ed2e2e'
    ctx.fillRect(lx + 52, ly, 8, 8)
    ctx.fillText('支出', lx + 64, ly + 8)
  },

  // ---- 饼状图 ----
  generatePieData(optScope) {
    const scope = optScope || (this.data.reportType === 1 ? 'company' : 'personal')
    const stored = api.getItems(scope)
    if (stored.length === 0) return { income: [], expense: [] }

    const period = this.data.reportPeriod
    const now = new Date()
    const thisMonth = now.getMonth() + 1
    const thisYear = now.getFullYear()

    // Filter items by scope and period, then aggregate by category
    const incomeMap = {}
    const expenseMap = {}

    const pickerDate = this.data.reportPickerDate || `${thisYear}-${String(thisMonth).padStart(2, '0')}`

    stored.forEach(item => {

      const d = new Date(item.date)
      if (isNaN(d.getTime())) return
      const y = d.getFullYear()
      const m = d.getMonth() + 1

      let inPeriod = false
      if (period === 0 || period === 3) {
        const [py, pm] = pickerDate.split('-').map(Number)
        if (y === py && m === pm) inPeriod = true
      } else if (period === 1) {
        const [qy] = pickerDate.split('-').map(Number)
        const qStart = Math.floor((thisMonth - 1) / 3) * 3 + 1
        if (y === qy && m >= qStart && m <= qStart + 2) inPeriod = true
      } else if (period === 2) {
        const [ay] = pickerDate.split('-').map(Number)
        if (y === ay) inPeriod = true
      }

      if (!inPeriod) return

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
    const ranged = (api.getItems(scope) || []).filter(it => !it._voided && this._inReportRange(it))
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

    this.setData({
      reportSummary: {
        income: income.toFixed(2),
        expense: expense.toFixed(2),
        balance: balance.toFixed(2),
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
    if (this.data.reportType === 0 && !api.getCompanyInfo()) {
      wx.showToast({ title: '请先注册公司', icon: 'none' })
      return
    }
    const { currentReportCard, reportCards } = this.data
    const card = reportCards[currentReportCard]
    const next = card.col === 0 ? currentReportCard + 1 : currentReportCard - 1
    this.setData({
      currentReportCard: next,
      reportType: next % 2,
    })
    this._refreshReport()
  },

  // 切换报表周期
  switchReportPeriod(e) {
    const period = parseInt(e.currentTarget.dataset.period)
    this.setData({ reportPeriod: period })
    this.updateReportDate()
    this._refreshReport()
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
    this._refreshReport()
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
    if (this.data.settleType === 0 && !api.getCompanyInfo()) {
      wx.showToast({ title: '请先注册公司', icon: 'none' })
      return
    }
    this.setData({ settleType: this.data.settleType === 0 ? 1 : 0 })
    this.initSettleItems()
  },

  onSettleAll() {
    const items = this.data.settleItems
    const settleable = items.filter(it =>
      it.typeLabel === '应付' || (it.typeLabel === '垫付' && it.settleStatus === 'company_settled')
    )
    if (!settleable.length) {
      wx.showToast({ title: '没有可结清的项目', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认结清',
      content: `将结清 ${settleable.length} 笔账单并自动生成对账记录，确定吗？`,
      success: async (res) => {
        if (!res.confirm) return
        let failed = 0
        for (const item of settleable) {
          try {
            if (item.typeLabel === '应付') {
              await api.settleItem(item.id)
            } else {
              await api.settleConfirm(item.id)
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
          title: failed ? `完成，${failed} 笔失败` : '已全部结清',
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
        api.updateItem(modalItem.id, { category: modalEdit.category, amount: modalEdit.amount, note: modalEdit.note })
        const itemsKey = modalFrom === 'settle' ? 'settleItems' : 'detailItems'
        const updated = this.data[itemsKey].map(item => {
          if (item.id === modalItem.id) return { ...item, category: modalEdit.category, amount: modalEdit.amount, note: modalEdit.note }
          return { ...item }
        })
        this.setData({ [itemsKey]: updated, modalItem: null })
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
    const type = e.currentTarget.dataset.type
    const now = new Date()
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const typeLabelMap = { income: '收入', expense: '支出', payForward: '垫付', payable: '应付' }
    const td = this._getBookTargetDefaults(this.data.bookScope, type)
    this.setData({
      showBookPopup: true,
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
  },

  onBookScopeToggle(e) {
    const scope = e.currentTarget.dataset.scope
    if (scope === 'company' && !api.getCompanyInfo()) {
      wx.showToast({ title: '请先注册公司', icon: 'none' })
      return
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

  onBookClose() {
    if (this.data.showBookCatPanel) {
      this.setData({ showBookCatPanel: false })
    } else {
      this.setData({ showBookPopup: false, bookPhoto: '' })
      this._redrawReportCharts()
    }
  },

  onBookTypeSelect(e) {
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
  },

  onBookCatSelect(e) {
    this.setData({ 'bookForm.category': e.currentTarget.dataset.cat })
  },

  onBookOpenCatPanel() {
    this.refreshBookCatPanel()
    this.setData({ showBookCatPanel: true })
  },

  refreshBookCatPanel() {
    const scope = this.data.bookScope
    const type = this.data.bookForm.type
    const source = scope === 'personal' ? this.data.personalCategories : this.data.companyCategories
    const inOut = { income: 'in', expense: 'out', payForward: 'payForward', payable: 'payable' }[type] || 'out'
    this.setData({ bookCatPanelData: source.filter(item => item.inOut === inOut) })
  },

  onBookCatPanelSelect(e) {
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
    this.setData({ 'bookForm.date': e.detail.value })
  },

  onBookSave() {
    const { type, amount, category, date, note, target, targetType } = this.data.bookForm
    if (!amount || parseFloat(amount) <= 0) {
      wx.showToast({ title: '请输入金额', icon: 'none' })
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
    let voucher = ''
    if (this.data.bookPhoto) {
      try { voucher = wx.getFileSystemManager().saveFileSync(this.data.bookPhoto) }
      catch (e) { voucher = this.data.bookPhoto }
    }
    const typeLabelMap = { income: '收入', expense: '支出', payForward: '垫付', payable: '应付' }
    const itemType = type === 'income' ? 'in' : 'out'
    const newItem = {
      id: Date.now(),
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
    const scope = this.data.bookScope

    // 内部对象 + 垫付/应付 → 联动对面 scope
    if (targetType === 'internal' && (type === 'payForward' || type === 'payable')) {
      const mirrorScope = scope === 'personal' ? 'company' : 'personal'
      const mirrorTypeLabel = type === 'payForward' ? '应付' : '垫付'
      const mirrorType = mirrorTypeLabel === '应付' ? 'out' : 'in'
      const mirrorItem = {
        id: Date.now() + 1,
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

    var _items2497 = this._buildDetailList(scope, api.getItems(scope))
this.setData({ detailItems: _items2497, detailGroups: this._buildDetailGroups(_items2497), showBookPopup: false, bookPhoto: '' })
    this._calcOverviewData()
    wx.showToast({ title: '记账成功', icon: 'success' })
    this._redrawReportCharts()
  },

  onModalClose() {
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
    const id = e.currentTarget.dataset.id
    const from = e.currentTarget.dataset.from || 'detail'
    const itemsKey = from === 'settle' ? 'settleItems' : 'detailItems'
    const found = this.data[itemsKey].find(item => item.id === id)
    if (!found) return

    if (found.typeLabel === '垫付') {
      if (found.settleStatus === 'company_settled') {
        this.onBillConfirmSettle(e)
      } else {
        wx.showToast({ title: '请等待对方结清应付款', icon: 'none' })
      }
      return
    }
    if (found.typeLabel !== '应付') return

    wx.showModal({
      title: '确认结清',
      content: '结清后将自动生成对账记录，确定吗？',
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
      wx.showToast({ title: '结清失败，请重试', icon: 'none' })
      return false
    }

    if (!skipRefresh) {
      await api.refreshItems()
      this.initSettleItems()
      this.initDetailItems()
      this.setData({ modalItem: null })
      this._calcOverviewData()
      wx.showToast({ title: '已结清', icon: 'success' })
    }
    return true
  },

  onBillConfirmSettle(e) {
    const id = e.currentTarget.dataset.id
    const from = e.currentTarget.dataset.from || 'settle'
    const itemsKey = from === 'settle' ? 'settleItems' : 'detailItems'
    const found = this.data[itemsKey].find(item => item.id === id)
    if (!found || found.settleStatus !== 'company_settled') return

    wx.showModal({
      title: '确认到账',
      content: '确认资金已到账？一旦确认将视为结清。',
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
        wx.showToast({ title: '已确认到账', icon: 'success' })
      },
    })
  },

  onBillDelete(e) {
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
    this._syncOverviewCards()
    this.setData({ showOverview: true, showCustomOverview: false, showCustomCategory: false, tabSlideDir: 'slide-left' })
    setTimeout(() => this.setData({ tabSlideDir: '' }), 400)
  },

  // ---- 明细 ----
  switchDetailType() {
    if (this.data.detailType === 0 && !api.getCompanyInfo()) {
      wx.showToast({ title: '请先注册公司', icon: 'none' })
      return
    }
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

  // 明细列表预处理：① 按分类名附分类 emoji（_icon，未知回退 📌）② 排序：日期倒序为主（新日期在前），同一天内按 id（前端记账=Date.now() 毫秒时间戳）倒序，到毫秒严格
  // 顶部搜索：匹配明细的全字段（日期/类型/分类/对象/金额/备注/状态），大小写不敏感
  _matchSearch(it, q) {
    if (!q) return true
    const status = it._voided ? '已作废'
      : (it.settleStatus === 'settled' || it.settleStatus === 'company_settled') ? '已结清' : ''
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

  // 详情弹窗用的完整时间（到秒）：前端记账 id=Date.now()，直接取其时分秒；后端自动结清记录从 settleInfo 解析到分钟；都没有则只显示日期
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
    this.setData({ settleItems: filtered.map(item => ({ ...item })) })
  },

  // ---- 自定义分类 ----
  onCustomCategoryEntry() {
    this.setData({ showCustomCategory: true })
  },

  onCustomCategoryBack() {
    this.setData({ showCustomCategory: false })
  },

  // ---- 导出账单 ----
  // ---- 我的页图标入口 ----
  // ---- 账本页数据 ----
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
    this.setData({ showLedgerPage: true, ledgerScope: 'personal', ...this._ledgerData('personal') })
  },

  onGotoCompanyLedger() {
    const ci = api.getCompanyInfo()
    if (!(ci && ci.companyRole === 'boss' && ci.companyUid)) {
      wx.showToast({ title: '公司账本仅企业管理员可见', icon: 'none' })
      return
    }
    this.setData({ showLedgerPage: true, ledgerScope: 'company', ...this._ledgerData('company') })
  },

  onLedgerBack() {
    this.setData({ showLedgerPage: false })
  },

  // 往来款下钻 → 结清 Tab（对齐当前账本范围）
  onLedgerGotoSettle() {
    this.setData({ settleType: this.data.ledgerScope === 'company' ? 1 : 0 })
    this.switchTab({ currentTarget: { dataset: { index: 3 } } })
    this.initSettleItems()
  },

  onLedgerBudgetInput(e) {
    this.setData({ ledgerBudgetInput: e.detail.value })
  },

  onLedgerBudgetSave() {
    const scope = this.data.ledgerScope
    const val = parseFloat(this.data.ledgerBudgetInput)
    if (isNaN(val) || val < 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    api.saveSetting('budget_' + scope, val)
    this.setData(this._ledgerData(scope))
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  // 简览卡片点击：个人/公司账本卡 → 账本页；图表卡 → 报表页；其余卡 → 明细页
  onOverviewCardTap(e) {
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
    const saved = api.getCompanyInfo()
    if (!saved || saved.companyRole !== 'boss' || !saved.companyUid) {
      wx.showToast({ title: '请先注册公司', icon: 'none' })
    }
    const list = api.getAuditList()
    this.setData({ showAuditPage: true, auditList: list })
  },

  onAuditBack() {
    this.setData({ showAuditPage: false })
  },

  onAuditApprove(e) {
    const { id } = e.currentTarget.dataset
    const list = this.data.auditList.map(item => item.id === id ? { ...item, status: 'approved' } : item)
    api.saveAuditList(list)
    this.setData({ auditList: list })
    this.updateAuditBadge()
    const notifyList = api.getNotifyList()
    notifyList.unshift({ id: Date.now(), text: '审核通过加入公司', time: new Date().toLocaleDateString(), read: false })
    api.saveNotifyList(notifyList)
    this.updateNotifyBadge()
    wx.showToast({ title: '已通过', icon: 'success' })
  },

  onAuditReject(e) {
    const { id } = e.currentTarget.dataset
    const list = this.data.auditList.map(item => item.id === id ? { ...item, status: 'rejected' } : item)
    api.saveAuditList(list)
    this.setData({ auditList: list })
    this.updateAuditBadge()
    wx.showToast({ title: '已拒绝', icon: 'none' })
  },

  updateAuditBadge() {
    const list = api.getAuditList()
    const hasPending = list.some(item => item.status === 'pending')
    this.setData({ hasPendingAudit: hasPending })
  },

  onNotifyEntry() {
    const list = api.getNotifyList()
    this.setData({ showNotifyPage: true, notifyList: list })
  },

  onNotifyBack() {
    this.setData({ showNotifyPage: false, notifySwipeId: '' })
    this.updateNotifyBadge()
  },

  onNotifyRead(e) {
    const { id } = e.currentTarget.dataset
    const list = this.data.notifyList.map(item => item.id === id ? { ...item, read: true } : item)
    api.saveNotifyList(list)
    this.setData({ notifyList: list })
    this.updateNotifyBadge()
  },

  updateNotifyBadge() {
    const list = api.getNotifyList()
    const hasUnread = list.some(item => !item.read)
    this.setData({ hasUnreadNotify: hasUnread })
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

  onNotifyDelete(e) {
    const { id } = e.currentTarget.dataset
    const list = this.data.notifyList.filter(item => item.id !== id)
    api.saveNotifyList(list)
    this.setData({ notifyList: list, notifySwipeId: '' })
  },

  onExportBillEntry() {
    this.setData({ currentTab: 4, showOverview: false, showExportBill: true })
  },

  onExportBillBack() {
    this.setData({ showExportBill: false })
  },

  onExportPersonal() {
    if (this.data.exportFormatOptions[this.data.exportFormatIndex] !== '.EXCEL') {
      wx.showToast({ title: 'PDF 即将支持，请先选 .EXCEL', icon: 'none' })
      return
    }
    var usage = api.checkUsage('export')
    if (!usage.allowed) {
      wx.showToast({ title: '本月导出次数已用完（' + usage.used + '/' + usage.limit + '），请升级 VIP', icon: 'none' })
      return
    }
    const nick = (this.data.userInfo && this.data.userInfo.nickName) || '个人'
    this._exportBillXlsx('personal', nick, false, '账本')
    api.incrementUsage('export')
  },

  onExportCompany() {
    if (this.data.exportFormatOptions[this.data.exportFormatIndex] !== '.EXCEL') {
      wx.showToast({ title: 'PDF 即将支持，请先选 .EXCEL', icon: 'none' })
      return
    }
    var usage = api.checkUsage('export')
    if (!usage.allowed) {
      wx.showToast({ title: '本月导出次数已用完（' + usage.used + '/' + usage.limit + '），请升级 VIP', icon: 'none' })
      return
    }
    const name = (api.getCompanyInfo && (api.getCompanyInfo() || {}).companyName) || '公司'
    this._exportBillXlsx('company', name, true, '账单表')
    api.incrementUsage('export')
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
      return (Number(b.id) || 0) - (Number(a.id) || 0)
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
      : (it.settleStatus === 'settled' || it.settleStatus === 'company_settled') ? '已结清' : '正常'
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
    this.setData({ showContactPage: true, contactFeedback: '' })
  },

  onContactBack() {
    this.setData({ showContactPage: false })
  },

  onContactInput(e) {
    this.setData({ contactFeedback: e.detail.value })
  },

  onContactSubmit() {
    const text = (this.data.contactFeedback || '').trim()
    if (!text) {
      wx.showToast({ title: '请输入您的意见或建议', icon: 'none' })
      return
    }
    // 存储反馈
    const feedbackList = api.getFeedbackList()
    feedbackList.unshift({ id: Date.now(), text, time: new Date().toLocaleString() })
    api.saveFeedbackList(feedbackList)
    wx.showToast({ title: '感谢您的反馈！VIP 会员已赠送', icon: 'success' })
    this.setData({ contactFeedback: '' })
  },

  onSettingsEntry() {
    const saved = api.getCompanyInfo()
    const ledgerRole = saved && saved.companyRole ? saved.companyRole : 'personal'
    const lang = api.getSetting('appLanguage') || 'zh-CN'
    const langLabel = getLangLabel(lang)
    const darkMode = api.getSetting('appDarkMode') || 'system'
    const darkLabels = { system: this.data.t.dark_system || '跟随系统', light: this.data.t.dark_light || '浅色模式', dark: this.data.t.dark_dark || '深色模式' }
    const darkLabel = darkLabels[darkMode] || '跟随系统'
    const storageInfo = wx.getStorageInfoSync()
    const cacheSize = (storageInfo.currentSize / 1024).toFixed(1) + 'MB'
    this._applyLanguage(lang)
    this.setData({ showSettingsPage: true, settingsLedgerRole: ledgerRole, settingsLanguage: lang, settingsLanguageLabel: langLabel, settingsDarkMode: darkMode, settingsDarkModeLabel: darkLabel, cacheSize })
  },

  onSettingsBack() {
    this.setData({ showSettingsPage: false })
  },

  onPrivacyBack() {
    this.setData({ showPrivacyPage: false })
  },

  onPrivacyToggle(e) {
    const { key } = e.currentTarget.dataset
    const field = key === 'allowAnalytics' ? 'privacyAllowAnalytics' : 'privacyAllowCrashReport'
    const val = !this.data[field]
    this.setData({ [field]: val })
    api.saveSetting(`privacy_${key}`, val)
    wx.showToast({ title: val ? '已开启' : '已关闭', icon: 'success' })
  },

  onPrivacyClearData() {
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
    wx.showToast({ title: '数据导出功能开发中', icon: 'none' })
  },

  onPrivacyPolicyView() {
    this.setData({ showPrivacyPolicyPage: true })
  },

  onPrivacyPolicyBack() {
    this.setData({ showPrivacyPolicyPage: false })
  },

  onAboutBack() {
    this.setData({ showAboutPage: false })
  },

  onSettingsTap(e) {
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
        wx.showToast({ title: '账号安全开发中', icon: 'none' })
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
          success: (res) => {
            if (res.confirm) {
              api.removeCompanyInfo()
              this.setData({ showSettingsPage: false, showCompanyShare: true, companyShareStep: 1, companyRole: 'employee', employeeUid: '' })
              wx.showToast({ title: '请重新选择公司', icon: 'none' })
            }
          }
        })
        break
      case 'dissolveCompany':
        wx.showModal({
          title: '解散公司',
          content: '解散后所有员工将无法查看公司账本，此操作不可撤销，确定解散吗？',
          success: (res) => {
            if (res.confirm) {
              api.removeCompanyInfo()
              api.removeAuditList()
              this.setData({ settingsLedgerRole: 'personal', showSettingsPage: false, hasPendingAudit: false })
              wx.showToast({ title: '公司已解散', icon: 'success' })
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
              // 保留的用户设置
              const lang = api.getSetting('appLanguage')
              const darkMode = api.getSetting('appDarkMode')
              const userInfo = api.getUserInfo()
              const companyInfo = api.getCompanyInfo()
              const privacyAnalytics = api.getSetting('privacy_allowAnalytics')
              const privacyCrash = api.getSetting('privacy_allowCrashReport')
              wx.clearStorageSync()
              // 恢复用户设置
              if (lang) api.saveSetting('appLanguage', lang)
              if (darkMode) api.saveSetting('appDarkMode', darkMode)
              if (userInfo) api.saveUserInfo(userInfo)
              if (companyInfo) api.saveCompanyInfo(companyInfo)
              if (privacyAnalytics !== undefined) api.saveSetting('privacy_allowAnalytics', privacyAnalytics)
              if (privacyCrash !== undefined) api.saveSetting('privacy_allowCrashReport', privacyCrash)
              wx.showToast({ title: '缓存已清除', icon: 'success' })
              // 刷新明细列表等数据
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
      case 'logout':
        wx.showModal({
          title: '退出登录',
          content: '确定要退出当前账号吗？',
          success: (res) => {
            if (res.confirm) {
              api.logout()
              this.setData({ isLoggedIn: false, userInfo: null, showSettingsPage: false })
              wx.showToast({ title: '已退出登录', icon: 'success' })
            }
          }
        })
        break
    }
  },

  onExportPeriodTap(e) {
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
    this.setData({ exportFormatIndex: parseInt(e.detail.value) })
  },

  onExportPickerChange(e) {
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
    const { column, value } = e.detail
    if (column === 0) {
      const year = this.data.reportQuarterRange[0][value]
      this.setData({ exportSelectedYear: parseInt(year) })
    }
  },

  // 季度多列：确认
  onExportQuarterChange(e) {
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
    const { key } = e.currentTarget.dataset
    const items = this.data.exportPersonalItems.map(item =>
      item.key === key ? { ...item, checked: !item.checked } : item
    )
    const all = items.every(i => i.checked)
    this.setData({ exportPersonalItems: items, exportPersonalAll: all })
  },

  onExportCompanyToggle(e) {
    const { key } = e.currentTarget.dataset
    const items = this.data.exportCompanyItems.map(item =>
      item.key === key ? { ...item, checked: !item.checked } : item
    )
    const all = items.every(i => i.checked)
    this.setData({ exportCompanyItems: items, exportCompanyAll: all })
  },

  onExportPersonalAllToggle() {
    const all = !this.data.exportPersonalAll
    const items = this.data.exportPersonalItems.map(item => ({ ...item, checked: all }))
    this.setData({ exportPersonalAll: all, exportPersonalItems: items })
  },

  onExportCompanyAllToggle() {
    const all = !this.data.exportCompanyAll
    const items = this.data.exportCompanyItems.map(item => ({ ...item, checked: all }))
    this.setData({ exportCompanyAll: all, exportCompanyItems: items })
  },

  onCompanyShareEntry() {
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
    const step = this.data.companyShareStep
    if (step === 2) {
      this.setData({ showCompanyShare: false })
    } else if (step === 1) {
      this.setData({ companyShareStep: 0 })
    } else {
      this.setData({ showCompanyShare: false })
    }
  },

  onBossTap() {
    this.setData({ companyShareStep: 1, companyRole: 'boss', companyUid: '', companyName: '', companyBossTitle: '' })
  },

  onEmployeeTap() {
    this.setData({ companyShareStep: 1, companyRole: 'employee', employeeUid: '' })
  },

  onEmployeeUidInput(e) {
    this.setData({ employeeUid: e.detail.value })
  },

  onEmployeeJoin() {
    const { employeeUid } = this.data
    if (!employeeUid.trim()) {
      wx.showToast({ title: '请输入公司 UID 码', icon: 'none' })
      return
    }
    const info = { companyUid: employeeUid.trim(), companyRole: 'employee' }
    api.joinCompany(info).then(() => {
      wx.showToast({ title: '已提交申请，等待审核', icon: 'success' })
      this.setData({ companyShareStep: 2 })
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
    const uid = 'UID' + Date.now().toString(36).toUpperCase().slice(-8)
    this.setData({ companyUid: uid })
  },

  onCompanyCreate() {
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
    api.saveCompanyInfo(info)
    this._syncOverviewCards()
    wx.showToast({ title: '创建成功', icon: 'success' })
    this.setData({ companyShareStep: 2, companyName: info.companyName, companyBossTitle: info.companyBossTitle, companyUid: info.companyUid })
  },

  onShareCompany() {
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

  onCatTabChange(e) {
    const { scope, tab } = e.currentTarget.dataset
    if (scope === 'personal') {
      this.setData({ catTabPersonal: tab })
    } else {
      this.setData({ catTabCompany: tab })
    }
  },

  onAddCategory(e) {
    const { scope } = e.currentTarget.dataset
    this.setData({
      showCatModal: true,
      catModalScope: scope,
      catModalName: '',
      catModalEmoji: '📌',
    })
  },

  onCatModalClose() {
    this.setData({ showCatModal: false })
  },

  onCatModalNameInput(e) {
    this.setData({ catModalName: e.detail.value })
  },

  onCatModalPickEmoji(e) {
    this.setData({ catModalEmoji: e.currentTarget.dataset.emoji })
  },

  onCatModalConfirm() {
    const { catModalScope, catModalName, catModalEmoji } = this.data
    const name = catModalName.trim()
    if (!name) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' })
      return
    }
    const key = catModalScope === 'personal' ? 'personalCategories' : 'companyCategories'
    const list = this.data[key]
    const prefix = catModalScope === 'personal' ? 'p' : 'c'
    const maxNum = list.reduce((m, item) => {
      const n = parseInt(item.id.split('_')[1])
      return n > m ? n : m
    }, 0)
    const currentTab = catModalScope === 'personal' ? this.data.catTabPersonal : this.data.catTabCompany
    const newItem = {
      id: `${prefix}_${maxNum + 1}`,
      name,
      emoji: catModalEmoji,
      inOut: currentTab,
    }
    const newList = [...list, newItem]
    this.setData({
      [key]: newList,
      showCatModal: false,
    })
    api.saveCategories(catModalScope, newList)
    wx.showToast({ title: '已添加', icon: 'success' })
  },

  onDeleteCategory(e) {
    const { id, scope } = e.currentTarget.dataset
    const that = this
    wx.showModal({
      title: '删除分类',
      content: '确定删除此分类吗？',
      success(res) {
        if (!res.confirm) return
        const key = scope === 'personal' ? 'personalCategories' : 'companyCategories'
        const updated = that.data[key].filter(item => item.id !== id)
        that.setData({ [key]: updated })
        api.saveCategories(scope, updated)
        wx.showToast({ title: '已删除', icon: 'success' })
      },
    })
  },

  // ---- 自定义简览页 ----
  onCustomOverviewEntry() {
    const saved = api.getOverviewCards()
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
    api.saveOverviewCards(this.data.customCards)
    this.setData({ showCustomOverview: false, showOverview: false, currentTab: 4, tabSlideDir: 'slide-right' })
    setTimeout(() => this.setData({ tabSlideDir: '' }), 400)
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

  // ---- 槽位拖放对话框（长按 300ms 触发，短滑正常滚动） ----
  onTemplateTouchStart(e) {
    const templateId = e.currentTarget.dataset.id
    const template = this.data.customTemplates.find(t => t.id === templateId)
    if (!template) return
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (!touch) return
    // 记录起始位置，启动长按计时器
    this._dragPending = {
      template,
      startX: touch.clientX,
      startY: touch.clientY,
      timer: setTimeout(() => {
        if (!this._dragPending) return
        this._startDrag(this._dragPending.template, touch)
        this._dragPending = null
      }, 300),
    }
  },

  _startDrag(template, touch) {
    const src = this.data.customCards.length > 0
      ? this.data.customCards
      : this.data.defaultOverviewCards
    const existing = [...src].sort((a, b) => (a.y || 0) - (b.y || 0))
    const slotCards = [null, null, null]
    for (let i = 0; i < Math.min(existing.length, 3); i++) {
      slotCards[i] = existing[i]
    }
    this.setData({
      draggingTemplate: template,
      slotCards,
      slotLayout: this._buildSlotLayout(slotCards),
      slotHover: -1,
      'dragFloat.visible': true,
      'dragFloat.x': touch.clientX - 50,
      'dragFloat.y': touch.clientY - 40,
      'dragFloat.name': template.name,
      'dragFloat.subtitle': template.subtitle || '',
      showSlotModal: false,
    })
  },

  onDragOverlayMove(e) {
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (!touch) return
    // 长按计时器未触发：检查是否移动超过阈值 → 取消长按（正常滚动）
    if (this._dragPending) {
      const dx = Math.abs(touch.clientX - this._dragPending.startX)
      const dy = Math.abs(touch.clientY - this._dragPending.startY)
      if (dx > 10 || dy > 10) {
        clearTimeout(this._dragPending.timer)
        this._dragPending = null
      }
      return
    }
    // 拖拽已激活：更新浮动卡片位置
    if (!this.data.dragFloat.visible) return
    const x = touch.clientX - 50
    const y = touch.clientY - 40
    const showModal = this.data.showSlotModal || y > 120
    let hover = -1
    if (showModal) {
      hover = this._calcSlotHover(touch.clientX, touch.clientY)
    }
    this.setData({
      'dragFloat.x': x,
      'dragFloat.y': y,
      showSlotModal: showModal,
      slotHover: hover,
    })
    if (showModal) {
      this._slotRects = []
      wx.createSelectorQuery().selectAll('.slot-item').boundingClientRect((rects) => {
        if (rects && rects.length) this._slotRects = rects
      }).exec()
    }
  },

  _calcSlotHover(clientX, clientY) {
    const layout = this.data.slotLayout
    if (!layout.length || !this._slotRects || !this._slotRects.length) return -1
    for (let i = 0; i < this._slotRects.length; i++) {
      const r = this._slotRects[i]
      if (r && clientX >= r.left && clientX <= r.right &&
          clientY >= r.top && clientY <= r.bottom) {
        return layout[i] ? layout[i].index : -1
      }
    }
    return -1
  },

  onDragOverlayEnd(e) {
    // 长按计时器未触发 → 取消（短按/轻触）
    if (this._dragPending) {
      clearTimeout(this._dragPending.timer)
      this._dragPending = null
      return
    }
    // 拖拽已激活：处理松手放置
    const { slotHover, slotCards, draggingTemplate, showSlotModal } = this.data
    const touch = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0])
    let hover = slotHover
    if (showSlotModal && touch) {
      hover = this._calcSlotHover(touch.clientX, touch.clientY)
    }
    if (hover >= 0 && draggingTemplate && showSlotModal) {
      const newCard = {
        id: `c_${Date.now()}`,
        templateId: draggingTemplate.id,
        name: draggingTemplate.name,
        subtitle: draggingTemplate.subtitle,
        type: draggingTemplate.type,
        span: draggingTemplate.span,
        x: 0,
        y: hover * 120,
      }
      const updated = [...slotCards]
      updated[hover] = newCard
      if (newCard.span >= 2 && hover < 2) {
        updated[hover + 1] = null
      }
      if (hover > 0 && updated[hover - 1] && (updated[hover - 1].span || 1) >= 2) {
        updated[hover - 1] = null
      }
      for (let i = 0; i < 3; i++) {
        if (i !== hover && updated[i] && updated[i].id === newCard.id) {
          updated[i] = null
        }
      }
      this.setData({
        slotCards: updated,
        slotLayout: this._buildSlotLayout(updated),
        slotHover: -1,
        'dragFloat.visible': false,
      })
    } else {
      const empty = [null, null, null]
      this.setData({
        'dragFloat.visible': false,
        showSlotModal: false,
        draggingTemplate: null,
        slotCards: empty,
        slotLayout: this._buildSlotLayout(empty),
        slotHover: -1,
      })
    }
  },

  _buildSlotLayout(slotCards) {
    const layout = []
    const max = slotCards.length
    let i = 0
    while (i < max) {
      const card = slotCards[i]
      const span = card ? Math.min(card.span || 1, max - i) : 1
      layout.push({ card: slotCards[i], height: span, index: i })
      i += span
    }
    return layout
  },

  onSlotConfirm() {
    const { slotCards } = this.data
    const ordered = []
    for (let i = 0; i < 3; i++) {
      if (slotCards[i]) {
        ordered.push({ ...slotCards[i], y: i * 120, x: 0 })
      }
    }
    api.saveOverviewCards(ordered)
    const colW = (this._grid && this._grid.colWidth) || 100
    const editCardWidths = ordered.map(c => Math.round(colW * (c.span || 1)))
    const enriched = ordered.map(card => {
      const tpl = this.data.customTemplates.find(t => t.type === card.type)
      return { ...card, rows: tpl ? tpl.rows : [], hasAvatar: tpl ? tpl.hasAvatar : false, previewStyle: tpl ? tpl.previewStyle : 'overview' }
    })
    const empty = [null, null, null]
    this.setData({
      customCards: ordered,
      overviewCards: enriched,
      editCardWidths,
      showSlotModal: false,
      draggingTemplate: null,
      slotCards: empty,
      slotLayout: this._buildSlotLayout(empty),
      slotHover: -1,
      'dragFloat.visible': false,
    })
  },

  onSlotCancel() {
    const empty = [null, null, null]
    this.setData({
      showSlotModal: false,
      draggingTemplate: null,
      slotCards: empty,
      slotLayout: this._buildSlotLayout(empty),
      slotHover: -1,
      'dragFloat.visible': false,
    })
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

  // ---- 登录/注册 ----
  onLoginEntry() {
    this.setData({ showLoginPage: true })
  },

  onLoginBack() {
    this.setData({ showLoginPage: false })
  },

  onLoginPhoneInput(e) {
    this.setData({ loginPhone: e.detail.value })
  },

  onLoginCodeInput(e) {
    this.setData({ loginCode: e.detail.value })
  },

  onSendCode() {
    if (this.data.loginCodeSending) return
    const phone = this.data.loginPhone
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    api.sendVerifyCode(phone)
    this.setData({ loginCodeSending: true, loginCodeCountdown: 60 })
    wx.showToast({ title: '验证码已发送', icon: 'success' })
    const timer = setInterval(() => {
      const count = this.data.loginCodeCountdown - 1
      if (count <= 0) {
        clearInterval(timer)
        this.setData({ loginCodeSending: false, loginCodeCountdown: 0 })
      } else {
        this.setData({ loginCodeCountdown: count })
      }
    }, 1000)
  },

  onPhoneLogin() {
    const { loginPhone, loginCode } = this.data
    if (!/^1[3-9]\d{9}$/.test(loginPhone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (loginCode.length !== 6) {
      wx.showToast({ title: '请输入6位验证码', icon: 'none' })
      return
    }
    api.loginByPhone(loginPhone, loginCode).then(result => {
      const userInfo = { nickName: result.nickName, avatarUrl: result.avatarUrl }
      this.setData({ isLoggedIn: true, userInfo, showLoginPage: false, loginPhone: '', loginCode: '' })
      // 用后端 isNew 替代前端脱敏手机号启发式判定
      if (result.isNew) {
        this.setData({ showProfileModal: true, profileEditMode: false, profileName: '', profileAvatarLocal: '', profileAvatarUrl: '' })
      } else {
        this._refreshAvatarDisplay(userInfo)
      }
      wx.showToast({ title: '登录成功', icon: 'success' })
      // 登录后从云端同步数据（异步，不阻塞后续操作）
      api.syncFromCloud().then((result) => {
        if (result && result.hasConflicts) { this._handleSyncResult(result); return }
        this.initDetailItems()
        // 后端权威 companyInfo 落地后重建简览卡：boss 此时才会出现公司账本
        this._syncOverviewCards()
        // 把拉到的最新 userInfo 刷到页面 + 重新加载头像（跨端改了头像/昵称这里才更新）
        const su = api.getUserInfo()
        if (su) this.setData({ userInfo: su })
        this._refreshAvatarDisplay(su)
        // 登录后拉取 VIP 状态
        api.getVipStatus().then(function (s) { this.setData({ vipStatus: s, vipTrialDays: this._computeTrialDays(s) }) }.bind(this)).catch(function () {})
      })
    }).catch(() => {
      wx.showToast({ title: '登录失败', icon: 'none' })
    })
  },

  onWxLogin(e) {
    if (e.detail.userInfo) {
      api.loginByWechat(e.detail.userInfo).then(result => {
        const userInfo = { nickName: result.nickName, avatarUrl: result.avatarUrl }
        this.setData({ isLoggedIn: true, userInfo, showLoginPage: false })
        if (result.isNew) {
          this.setData({ showProfileModal: true, profileEditMode: false, profileName: '', profileAvatarLocal: '', profileAvatarUrl: '' })
        } else {
          this._refreshAvatarDisplay(userInfo)
        }
        wx.showToast({ title: '登录成功', icon: 'success' })
        // 登录后从云端同步数据（异步，不阻塞后续操作）
        api.syncFromCloud().then((result) => {
        if (result && result.hasConflicts) { this._handleSyncResult(result); return }
          this.initDetailItems()
          // 后端权威 companyInfo 落地后重建简览卡：boss 此时才会出现公司账本
          this._syncOverviewCards()
          // 把拉到的最新 userInfo 刷到页面 + 重新加载头像（跨端改了头像/昵称这里才更新）
          const su = api.getUserInfo()
          if (su) this.setData({ userInfo: su })
          this._refreshAvatarDisplay(su)
          // 登录后拉取 VIP 状态
          api.getVipStatus().then(function (s) { this.setData({ vipStatus: s, vipTrialDays: this._computeTrialDays(s) }) }.bind(this)).catch(function () {})
        })
      }).catch(() => {
        wx.showToast({ title: '登录失败', icon: 'none' })
      })
    } else {
      wx.showToast({ title: '授权已取消', icon: 'none' })
    }
  },

  onLogout() {
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
            })
            // 清除全部本地数据，防止换号残留
            wx.clearStorageSync()
            wx.showToast({ title: '已退出登录', icon: 'none' })
          })
        }
      }
    })
  },

  // ========== 首次引导 ==========
  onGuideNext() {
    this.setData({ guideStep: this.data.guideStep + 1 })
  },

  onGuideSkipLogin() {
    this.setData({ loginPhone: '1031', loginCode: '1031' })
    wx.showToast({ title: '已填入开发凭证', icon: 'none' })
  },

  onGuideBack() {
    this.setData({ guideStep: 2, guideRole: '' })
  },

  onGuideRole(e) {
    const role = e.currentTarget.dataset.role
    this.setData({ guideRole: role, guideStep: 3 })
    if (role === 'boss') {
      const uid = 'UID' + Date.now().toString(36).toUpperCase().slice(-8)
      this.setData({ companyUid: uid })
    }
  },

  onGuidePhoneLogin() {
    const { loginPhone, loginCode } = this.data

    if (loginPhone === '1031' && loginCode === '1031') {
      const devUser = { nickName: '开发者', avatarUrl: '', phone: '1031' }
      wx.setStorageSync('userInfo', devUser)
      this.setData({ isLoggedIn: true, userInfo: devUser, guideStep: 2, loginPhone: '', loginCode: '' })
      wx.showToast({ title: '开发登录成功', icon: 'success' })
      return
    }

    if (!/^1[3-9]\d{9}$/.test(loginPhone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (loginCode.length !== 6) {
      wx.showToast({ title: '请输入6位验证码', icon: 'none' })
      return
    }
    api.loginByPhone(loginPhone, loginCode).then(async result => {
      const userInfo = { nickName: result.nickName, avatarUrl: result.avatarUrl }
      this.setData({ isLoggedIn: true, userInfo, loginPhone: '', loginCode: '' })
      if (result.isNew) {
        this.setData({ showProfileModal: true, profileEditMode: false, profileName: '', profileAvatarLocal: '', profileAvatarUrl: '' })
      } else {
        this._refreshAvatarDisplay(userInfo)
      }
      wx.showToast({ title: '登录成功', icon: 'success' })
      // 异步同步云端数据（不阻塞身份判定）
      api.syncFromCloud().then((result) => {
        if (result && result.hasConflicts) { this._handleSyncResult(result); return }
        const ci = api.getCompanyInfo()
        if (ci && ci.companyUid) this.setData({ companyUid: ci.companyUid })
        this.initDetailItems()
        // 后端权威 companyInfo 落地后重建简览卡：boss 此时才会出现公司账本
        this._syncOverviewCards()
        // 把拉到的最新 userInfo 刷到页面 + 重新加载头像（跨端改了头像/昵称这里才更新）
        const su = api.getUserInfo()
        if (su) this.setData({ userInfo: su })
        this._refreshAvatarDisplay(su)
      })
      // 同一账号：后端已返回 hasCompany → 跳过身份引导，老用户不再被重复询问
      if (result.hasCompany) {
        this.onGuideComplete()
      } else {
        this.setData({ guideStep: 2 })
      }
    }).catch(() => {
      wx.showToast({ title: '登录失败', icon: 'none' })
    })
  },

  onGuideWxLogin(e) {
    if (e.detail.userInfo) {
      api.loginByWechat(e.detail.userInfo).then(async result => {
        const userInfo = { nickName: result.nickName, avatarUrl: result.avatarUrl }
        this.setData({ isLoggedIn: true, userInfo })
        if (result.isNew) {
          this.setData({ showProfileModal: true, profileEditMode: false, profileName: '', profileAvatarLocal: '', profileAvatarUrl: '' })
        } else {
          this._refreshAvatarDisplay(userInfo)
        }
        wx.showToast({ title: '登录成功', icon: 'success' })
        // 异步同步云端数据（不阻塞身份判定）
        api.syncFromCloud().then((result) => {
        if (result && result.hasConflicts) { this._handleSyncResult(result); return }
          const ci = api.getCompanyInfo()
          if (ci && ci.companyUid) this.setData({ companyUid: ci.companyUid })
          this.initDetailItems()
          // 后端权威 companyInfo 落地后重建简览卡：boss 此时才会出现公司账本
          this._syncOverviewCards()
          // 把拉到的最新 userInfo 刷到页面 + 重新加载头像（跨端改了头像/昵称这里才更新）
          const su = api.getUserInfo()
          if (su) this.setData({ userInfo: su })
          this._refreshAvatarDisplay(su)
        })
        if (result.hasCompany) {
          this.onGuideComplete()
        } else {
          this.setData({ guideStep: 2 })
        }
      }).catch(() => {
        wx.showToast({ title: '登录失败', icon: 'none' })
      })
    } else {
      wx.showToast({ title: '授权已取消', icon: 'none' })
    }
  },

  onGuideCompanyCreate() {
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
    api.saveCompanyInfo(info)
    wx.showToast({ title: '创建成功', icon: 'success' })
    this.onGuideComplete()
  },

  onGuideEmployeeJoin() {
    const { employeeUid } = this.data
    if (!employeeUid.trim()) {
      wx.showToast({ title: '请输入公司 UID', icon: 'none' })
      return
    }
    const info = { companyUid: employeeUid.trim(), companyRole: 'employee' }
    api.joinCompany(info).then(() => {
      wx.showToast({ title: '已提交申请', icon: 'success' })
      this.onGuideComplete()
    }).catch(() => {
      wx.showToast({ title: '加入失败', icon: 'none' })
    })
  },

  onGuideComplete() {
    wx.setStorageSync('guideCompleted', true)
    this.setData({ showGuide: false })
    this.initDetailItems()
    this._syncOverviewCards()
  },

  // ---- 拓展菜单 ----
  // 报表 canvas 是原生组件，全屏遮罩期间用 wx:if 移除以避免穿透；遮罩关闭后在此重绘
  _redrawReportCharts() {
    var d = this.data
    if (d.currentTab !== 1) return
    if (d.showExpandMenu || d.showCamera || d.scanRecognizing || d.showBookPopup || d.modalItem || d.showAiChat || d.aiRecording || d.searchRecording) return
    setTimeout(() => {
      this._drawCurrentChart()
    }, 300)
  },

  onExpandMenuTap() {
    this.setData({ showExpandMenu: !this.data.showExpandMenu })
    if (!this.data.showExpandMenu) this._redrawReportCharts()
  },

  onExpandMenuItem(e) {
    this.setData({ showExpandMenu: false })
    var action = e.currentTarget.dataset.action
    var _this = this
    if (action === 'scan') {
      this.setData({ showCamera: true })
    } else if (action === 'category') {
      this.setData({ currentTab: 4, showOverview: false })
      this.onCustomCategoryEntry()
    } else if (action === 'ai') {
      var greeting = {
        role: 'ai',
        text: '你好！我是你的 AI 记账助手\n\n试试对我说：\n• "午餐 25"\n• "打车 15 交通"\n• "收到工资 8000"',
        time: this._formatChatTime(new Date())
      }
      this.setData({
        showAiChat: true,
        aiMessages: [greeting],
        aiInputText: '',
        aiThinking: false,
        aiScrollTop: 999999,
        aiVoiceMode: false
      })
    }
  },

  // ---- 顶部搜索 ----
  onHeaderSearchInput(e) {
    this.setData({ searchText: e.detail.value })
    this.initDetailItems() // 输入即时过滤明细列表（setData 后 this.data.searchText 已同步更新）
  },
  onHeaderSearch() {
    // 搜索栏是全局顶栏：点确认跳到明细页(tab 0)并按 searchText 过滤；switchTab 内部会 initDetailItems
    this.switchTab({ currentTarget: { dataset: { index: 0 } } })
  },
  onHeaderSearchVoiceStart() {
    this.setData({ searchRecording: true })
  },
  onHeaderSearchVoiceEnd() {
    if (!this.data.searchRecording) return
    this.setData({ searchRecording: false })
    this._redrawReportCharts()
  },

  // ---- 相机扫描 ----
  onCameraClose() {
    this.setData({ showCamera: false })
    this._redrawReportCharts()
  },

  onCameraShoot() {
    var _this = this
    var ctx = wx.createCameraContext()
    ctx.takePhoto({
      quality: 'high',
      success: function (res) {
        _this.setData({ showCamera: false })
        _this._startScanRecognize(res.tempImagePath)
      },
      fail: function () {
        wx.showToast({ title: '拍照失败', icon: 'none' })
      }
    })
  },

  onCameraAlbum() {
    var _this = this
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sourceType: ['album'], sizeType: ['compressed'],
      success: function (res) {
        var f = res.tempFiles && res.tempFiles[0]
        var photo = f && f.tempFilePath
        if (!photo) return
        _this.setData({ showCamera: false })
        _this._startScanRecognize(photo)
      }
    })
  },

  onCameraError() {
    wx.showModal({
      title: '无法使用相机',
      content: '请在系统设置中允许使用相机，或从相册选择凭证',
      confirmText: '从相册选',
      success: (r) => {
        if (r.confirm) this.onCameraAlbum()
        else this.setData({ showCamera: false })
      }
    })
  },

  // ---- 扫描凭证识别 ----
  _startScanRecognize(photo) {
    this.setData({ scanRecognizing: true, bookPhoto: photo })
    api.uploadVoucher(photo).then((url) => {
      return api.ocrParse(url)
    }).then((result) => {
      if (!result) throw { error: '识别结果为空' }
      this.onBookEntry({ currentTarget: { dataset: { type: 'expense' } } })
      this.setData({
        scanRecognizing: false,
        bookPhoto: photo,
        'bookForm.amount': result.amount || '',
        'bookForm.category': result.category || '',
        'bookForm.note': result.note || ''
      })
    }).catch((err) => {
      this.setData({ scanRecognizing: false })
      var msg = (err && err.error) || (err && err.message) || '识别失败'
      wx.showToast({ title: msg, icon: 'none' })
    })
  },

  onBookPhotoPreview() {
    if (this.data.bookPhoto) wx.previewImage({ urls: [this.data.bookPhoto] })
  },

  onBookPhotoRemove() {
    this.setData({ bookPhoto: '' })
  },

  onVoucherPreview(e) {
    var s = e.currentTarget.dataset.src
    if (s) wx.previewImage({ urls: [s] })
  },

  // ---- AI 对话 ----
  // 语音转文字走后端 ASR，前端只负责录音采集 + 上传。
  _ensureRecorder() {
    if (this._recorder) return this._recorder
    var that = this
    var recorder = wx.getRecorderManager()
    // 注意：WeChat API 是方法调用 .onStop(fn)，不是属性赋值 .onStop = fn
    recorder.onStart(function () {
      console.log('[ASR] 录音已开始')
    })
    recorder.onStop(function (res) {
      console.log('[ASR] 录音已停止 tempFilePath=' + (res.tempFilePath || '空') + ' duration=' + (res.duration || 0))
      that._onRecorderStop(res.tempFilePath)
    })
    recorder.onError(function (err) {
      console.warn('[ASR] 录音错误', JSON.stringify(err))
      that._aiRecognizeFor = ''
      clearTimeout(that._recordTimeout)
      that._recordTimeout = 0
      that.setData({ aiRecording: false })
      wx.showToast({ title: '录音失败，请重试', icon: 'none' })
    })
    // 注册音频帧回调（PCM 格式时需监听，触发静默检测）
    this._recorder = recorder
    return recorder
  },

  _onRecorderStop(tempFilePath) {
    var that = this
    clearTimeout(this._recordTimeout)
    this._recordTimeout = 0
    clearTimeout(this._stopFallback)
    // 防重复调用
    if (this._asrPending) return
    if (!tempFilePath) {
      this._aiRecognizeFor = ''
      this.setData({ aiRecording: false })
      console.log('[ASR] tempFilePath 为空，中止')
      wx.showToast({ title: '没听清，请重试', icon: 'none' })
      return
    }
    console.log('[ASR] 开始上传识别...')
    this._asrPending = true
    api.asrRecognize(tempFilePath).then(function (text) {
      that._asrPending = false
      console.log('[ASR] 识别结果 text=' + (text || '空'))
      that._onRecognizeDone(text)
    }).catch(function (err) {
      that._asrPending = false
      console.warn('[ASR] 识别失败', err)
      that._aiRecognizeFor = ''
      that.setData({ aiRecording: false })
      var msg = (err && err.error) || (err && err.message) || '识别失败'
      wx.showToast({ title: msg, icon: 'none' })
    })
  },

  // forWho: 'tab'=底部长按入口(识别后开对话窗发送) / 'chat'=对话框语音键(识别后填输入框发送)
  _startRecognize(forWho) {
    var that = this
    var recorder = this._ensureRecorder()
    this._aiRecognizeFor = forWho
    this.setData({ aiRecording: true })
    try {
      recorder.start({ format: 'PCM', sampleRate: 16000, numberOfChannels: 1, duration: 15000 })
      console.log('[ASR] recorder.start 已调用 forWho=' + forWho)
    } catch (e) {
      console.warn('[ASR] recorder.start 异常', e)
      this._aiRecognizeFor = ''
      this.setData({ aiRecording: false })
      return false
    }
    // 手动兜底：15s 后强制停止
    this._recordTimeout = setTimeout(function () {
      if (that.data.aiRecording) {
        console.log('[ASR] 15s 兜底超时，强制停止')
        that._stopRecognize()
      }
    }, 15000)
    return true
  },

  _stopRecognize() {
    console.log('[ASR] _stopRecognize 调用')
    var that = this
    clearTimeout(this._recordTimeout)
    this._recordTimeout = 0
    // 立即复位 UI，不等 onStop 回调
    this.setData({ aiRecording: false })
    // 尝试停止录音（真机 onStop 回调触发 → ASR 识别 → 打开对话窗）
    if (this._recorder) {
      try { this._recorder.stop() } catch (e) { console.warn('[ASR] stop 异常', e) }
    }
    // 兜底：onStop 未触发（开发者工具等）时清理内部状态
    clearTimeout(this._stopFallback)
    this._stopFallback = setTimeout(function () {
      if (that._aiRecognizeFor) {
        console.log('[ASR] onStop 未触发，残留清理')
        that._aiRecognizeFor = ''
      }
    }, 500)
  },

  // 识别完成（onStop 异步回调）：按入口分发
  _onRecognizeDone(text) {
    console.log('[ASR] _onRecognizeDone text=' + (text || '空'))
    var who = this._aiRecognizeFor
    this._aiRecognizeFor = ''
    this.setData({ aiRecording: false })
    var t = (text || '').trim()
    if (!t) {
      wx.showToast({ title: '没听清，请再说一次', icon: 'none' })
      return
    }
    if (who === 'chat') {
      this.setData({ aiInputText: t, aiVoiceMode: false })
      setTimeout(this.onAiSend.bind(this), 200)
    } else {
      console.log('[ASR] tab 入口，打开对话窗')
      this._sendAiUserText(t)
    }
  },

  // 打开对话窗 + 把一句用户文本走 _mockAiReply 解析记账
  _sendAiUserText(text) {
    const now = new Date()
    const msgs = []
    if (!this.data.showAiChat || !this.data.aiMessages.length) {
      msgs.push({
        role: 'ai',
        text: '你好！我是你的 AI 记账助手\n\n试试对我说：\n• "午餐 25"\n• "打车 15 交通"\n• "收到工资 8000"',
        time: this._formatChatTime(now)
      })
    } else {
      msgs.push.apply(msgs, this.data.aiMessages)
    }
    msgs.push({ role: 'user', text, time: this._formatChatTime(now) })
    this.setData({
      showAiChat: true,
      aiMessages: msgs,
      aiInputText: '',
      aiThinking: true,
      aiScrollTop: 999999 + (msgs.length - 1)
    })
    setTimeout(() => {
      const reply = this._mockAiReply(text)
      const updated = this.data.aiMessages.slice()
      updated.push(reply)
      this.setData({
        aiMessages: updated,
        aiThinking: false,
        aiScrollTop: 999999 + (updated.length - 1)
      })
    }, 800)
  },

  onTabCenterTouchStart() {
    console.log('[Touch] touchstart')
    var that = this
    this._tabHoldTimer = setTimeout(function () {
      that._tabHoldTimer = 0
      that._isHoldingTab = true
      console.log('[Touch] 判定为长按，打开对话窗 + 开始录音')
      // 打开对话窗
      var greeting = {
        role: 'ai',
        text: '正在聆听…',
        time: that._formatChatTime(new Date())
      }
      that.setData({
        showAiChat: true,
        aiMessages: [greeting],
        aiInputText: '',
        aiThinking: false,
        aiScrollTop: 999999,
        aiVoiceMode: true
      })
      that._startRecognize('tab')
    }, 250)
  },

  onTabCenterTouchEnd() {
    console.log('[Touch] touchend isHolding=' + this._isHoldingTab + ' timer=' + !!this._tabHoldTimer + ' recording=' + this.data.aiRecording)
    if (this._tabHoldTimer) {
      console.log('[Touch] 短按，切tab')
      clearTimeout(this._tabHoldTimer)
      this._tabHoldTimer = 0
      this.switchTab({ currentTarget: { dataset: { index: 2 } } })
    } else if (this._isHoldingTab) {
      console.log('[Touch] 长按松手，停止录音')
      this._isHoldingTab = false
      if (this.data.aiRecording) this._stopRecognize()
    }
  },

  onAiOverlayTouchEnd() {
    // 录音中任意位置松手 → 立即停止
    if (this.data.aiRecording) this._stopRecognize()
  },

  onAiOverlayTap() {
    // 录音中点按遮罩 → 停止录音（不关窗口，等识别结果）
    if (this.data.aiRecording) {
      this._stopRecognize()
    } else {
      this.onAiChatClose()
    }
  },

  onAiChatClose() {
    if (this.data.aiRecording) this._stopRecognize()
    this.setData({ showAiChat: false, aiRecording: false })
    this._redrawReportCharts()
  },

  onAiBillTap(e) {
    const idx = e.currentTarget.dataset.idx
    const msg = this.data.aiMessages[idx]
    if (!msg || !msg.card) return
    var scope = msg.card.scope || this.data.bookScope || 'personal'
    var items = api.getItems(scope)
    var found = null
    if (msg.card.itemId) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === msg.card.itemId) { found = items[i]; break }
      }
    }
    var _aiItems = this._buildDetailList(scope, items)
    this.setData({
      showAiChat: false,
      currentTab: 0,
      showOverview: false,
      detailItems: _aiItems,
      detailGroups: this._buildDetailGroups(_aiItems),
      modalItem: found ? { ...found, _settleText: this._formatSettleText(found), _timeText: this._billTimeText(found), _readonly: !!(found._autoSettle || found.settleStatus === 'settled') } : null,
    })
  },

  onAiInput(e) {
    this.setData({ aiInputText: e.detail.value })
  },

  onAiSend() {
    const text = this.data.aiInputText.trim()
    if (!text || this.data.aiThinking) return

    const msgs = this.data.aiMessages.slice()
    const userMsg = { role: 'user', text, time: this._formatChatTime(new Date()) }
    msgs.push(userMsg)

    this.setData({
      aiMessages: msgs,
      aiInputText: '',
      aiThinking: true,
      aiScrollTop: 999999 + msgs.length
    })

    setTimeout(() => {
      const reply = this._mockAiReply(text)
      const updated = this.data.aiMessages.slice()
      updated.push(reply)
      this.setData({
        aiMessages: updated,
        aiThinking: false,
        aiScrollTop: 999999 + (updated.length - 1)
      })
    }, 800)
  },

  // 关键词驱动弹性解析：7 字段任意语序，缺省智能填充
  _mockAiReply(input) {
    var time = this._formatChatTime(new Date())
    var now = new Date()
    var dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')

    var text = input

    // ---- 时间词自动匹配 ----
    var timeMap = { '今天': 0, '昨天': -1, '前天': -2, '明天': 1, '后天': 2 }
    for (var tk in timeMap) {
      if (text.indexOf(tk) >= 0) {
        var d = new Date(now)
        d.setDate(d.getDate() + timeMap[tk])
        dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
        text = text.replace(tk, '')
        break
      }
    }

    // ---- 1. 提取金额（必须） ----
    var amountMatch = text.match(/(\d+(?:\.\d{1,2})?)/)
    if (!amountMatch) {
      // 尝试中文数字
      var cnNumMap = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'百':100,'千':1000,'万':10000,'零':0,'两':2 }
      var cnMatch = text.match(/[一二三四五六七八九十百千万零两]+/)
      if (!cnMatch) {
        return { role: 'ai', text: '请问金额是多少？', time: time }
      }
      // 简单中文数字转换
      var cnStr = cnMatch[0]
      var cnVal = 0; var tmp = 0
      for (var ci = 0; ci < cnStr.length; ci++) {
        var ch = cnStr[ci]; var v = cnNumMap[ch]
        if (v === 10) { tmp = (tmp || 1) * 10; cnVal += tmp; tmp = 0 }
        else if (v === 100) { tmp = (tmp || 1) * 100; cnVal += tmp; tmp = 0 }
        else if (v === 1000) { tmp = (tmp || 1) * 1000; cnVal += tmp; tmp = 0 }
        else if (v === 10000) { cnVal = (cnVal + (tmp || 0)) * 10000; tmp = 0 }
        else { tmp = v }
      }
      cnVal += tmp
      var amount = cnVal.toFixed(2)
      text = text.replace(cnMatch[0], '')
    } else {
      var amount = parseFloat(amountMatch[1]).toFixed(2)
      text = text.replace(amountMatch[0], '')
    }

    // ---- 2. 收支词（缺省=支出） ----
    var incomeKeys = ['收到', '收入', '赚了', '捡了', '发了', '转入', '报销', '退款', '到账', '转账', '酬劳', '补贴', '津贴', '工资', '薪资', '奖金']
    var isIncome = false
    for (var ii = 0; ii < incomeKeys.length; ii++) {
      if (text.indexOf(incomeKeys[ii]) >= 0) { isIncome = true; break }
    }
    // 动词辅助判定
    if (!isIncome && /发了|收了|报销|到账/.test(text)) isIncome = true
    // 红包：看上下文，"发红包"=支出，"收到红包"=收入
    if (text.indexOf('红包') >= 0) {
      if (/收到.*红包|红包.*收到|给.*我.*红包/.test(text)) isIncome = true
      else if (/发.*红包/.test(text) && !/收到/.test(text)) isIncome = false
    }

    // ---- 3. 主体词（缺省=个人） ----
    var companyKeys = ['公司', '垫付', '应付', '办公', '报销']
    var isCompany = false
    for (var ci2 = 0; ci2 < companyKeys.length; ci2++) {
      if (text.indexOf(companyKeys[ci2]) >= 0) { isCompany = true; break }
    }

    // ---- 4. 分类词 → 预设分类 ----
    var catList = [
      { keys: ['咖啡', '奶茶', '柠檬茶', '可乐', '饮料', '牛奶', '豆浆', '果汁', '奶昔'], cat: '饮品' },
      { keys: ['午餐', '晚餐', '早餐', '外卖', '吃饭', '火锅', '烧烤', '米粉', '面条','面','饺子','盒饭','快餐','麻辣烫','麻辣拌','米线','盖饭','盖浇饭','小吃'], cat: '餐饮' },
      { keys: ['打车', '滴滴', '出租', '地铁', '公交', '加油', '高铁', '火车票', '机票', '停车', '高铁票', '火车','差旅费','交通费'], cat: '交通' },
      { keys: ['水果', '零食', '买菜', '菜', '西瓜', '榴莲', '水果篮', '超市', '购物券','采购'], cat: '购物' },
      { keys: ['话费', '充值', '流量', '宽带'], cat: '通讯' },
      { keys: ['感冒药', '药品', '药', '医院', '诊所', '口罩', '体温计'], cat: '医疗' },
      { keys: ['房租', '租房', '房贷', '物业', '水电费','电费','水费','煤气'], cat: '住房' },
      { keys: ['工资', '薪资', '奖金'], cat: '工资' },
      { keys: ['红包'], cat: '人情' },
      { keys: ['打印纸', '办公用品', '快递费', '快递', '文具','墨盒','硒鼓'], cat: '办公' },
      { keys: ['信用卡还款', '还信用卡', '还款'], cat: '金融' },
      { keys: ['衣服', '裤子', '鞋子', '袜子', '帽子'], cat: '服饰' },
      { keys: ['电影', 'KTV', '唱歌', '旅游', '酒店', '门票'], cat: '娱乐' }
    ]
    var category = ''
    var note = ''
    for (var ci3 = 0; ci3 < catList.length; ci3++) {
      for (var ki = 0; ki < catList[ci3].keys.length; ki++) {
        var kw = catList[ci3].keys[ki]
        var idx = text.indexOf(kw)
        if (idx >= 0) {
          category = catList[ci3].cat
          // 命中的关键词作为备注基础，从文本中移除
          note = kw
          text = text.substring(0, idx) + text.substring(idx + kw.length)
          break
        }
      }
      if (category) break
    }

    // ---- 5. 剩余文本清洗 → 最终备注 ----
    var noiseWords = ['我妈', '我爸', '我', '了个', '给我', '一下', '去了', '然后', '并且', '还有', '对了', '另外', '接着', '再', '今天', '昨天', '明天', '的', '了', '去', '和', '个', '块', '毛', '元']
    var cleanText = text
    for (var ni = 0; ni < noiseWords.length; ni++) {
      cleanText = cleanText.split(noiseWords[ni]).join('')
    }
    // 去掉动词/量词残留
    cleanText = cleanText.replace(/^(记一笔|记|买|花了|付|充|发了|收了|还|报销|给|转)\s*/g, '')
    cleanText = cleanText.trim()

    // 备注优先用分类关键词命中结果，其次用清洗后的剩余文本
    if (!note && cleanText) note = cleanText
    if (note && cleanText && cleanText !== note) note = cleanText || note

    // 无分类且无备注 → 用原始输入的关键部分
    if (!category) category = note || '其他'

    // ---- 动词提取 ----
    var verb = '-'
    var verbList = ['买了', '吃了', '喝了', '付了', '花了', '充了', '打了', '发了', '收了', '给了', '转了', '交了', '缴了',
                    '买', '吃', '喝', '付', '花', '充', '打', '发', '收', '给', '转', '交', '缴',
                    '充值', '报销', '到账', '记一笔', '还了', '还',
                    '买了点', '吃了碗', '喝了杯', '打了辆', '发了封', '收了笔']
    for (var vi = 0; vi < verbList.length; vi++) {
      if (text.indexOf(verbList[vi]) >= 0) { verb = verbList[vi]; break }
    }

    // ---- 6. 组装返回 ----
    return {
      role: 'ai',
      text: '请确认以下记账信息：',
      fields: {
        verb: verb,
        measure: '元',
        subject: isCompany ? '公司' : '个人',
        project: note || input.trim(),
        category: category,
        amount: amount,
        direction: isIncome ? '收入' : '支出'
      },
      card: {
        category: category,
        amount: amount,
        typeLabel: isIncome ? '收入' : '支出',
        type: isIncome ? 'in' : 'out',
        date: dateStr,
        note: note || input.trim(),
        scope: isCompany ? 'company' : 'personal'
      },
      confirmed: undefined, // undefined=待确认, true=已确认, false=已取消
      time: time
    }
  },

  _saveAiRecord(reply) {
    if (!reply.card) return
    var c = reply.card
    var scope = c.scope || this.data.bookScope || 'personal'
    var newItem = {
      id: Date.now(),
      category: c.category,
      type: c.type,
      typeLabel: c.typeLabel,
      scope: scope,
      amount: c.amount,
      date: c.date,
      note: c.note || '',
      target: '',
      targetType: 'external',
    }
    api.addItem(scope, newItem)
    reply.card.itemId = newItem.id
    var _savedItems = this._buildDetailList(scope, api.getItems(scope))
    this.setData({ detailItems: _savedItems, detailGroups: this._buildDetailGroups(_savedItems) })
    this._calcOverviewData()
  },


	  onAiConfirm(e) {
	    const idx = e.currentTarget.dataset.idx
	    const reply = this.data.aiMessages[idx]
	    if (!reply || !reply.card) return
	    this._saveAiRecord(reply)
	    reply.confirmed = true
	    const updated = this.data.aiMessages.slice()
	    updated[idx] = reply
	    this.setData({ aiMessages: updated })
	  },

	  onAiReject(e) {
	    const idx = e.currentTarget.dataset.idx
	    const reply = this.data.aiMessages[idx]
	    if (!reply) return
	    reply.confirmed = false
	    const updated = this.data.aiMessages.slice()
	    updated[idx] = reply
	    updated.push({
	      role: 'ai',
	      text: '识别有误？换个说法再试一次吧',
	      time: this._formatChatTime(new Date())
	    })
	    const lastIdx = updated.length - 1
	    this.setData({
	      aiMessages: updated,
	      aiScrollTop: 999999 + lastIdx
	    })
	  },
  _formatChatTime(d) {
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  },

  onAiToggleMode() {
    this.setData({ aiVoiceMode: !this.data.aiVoiceMode })
  },

  onAiVoiceStart() {
    wx.vibrateShort({ type: 'light' })
    this._startRecognize('chat')
  },

  onAiVoiceEnd() {
    if (!this.data.aiRecording) return
    this._stopRecognize() // 结果在 onStop → _onRecognizeDone('chat')：填输入框并发送
  },

  // ---- VIP 升级 ----
  _computeTrialDays: function (status) {
    if (!status || !status.vipLevel || !status.vipExpiresAt) return 0
    var days = Math.ceil((new Date(status.vipExpiresAt) - new Date()) / 86400000)
    return days > 0 ? days : 0
  },

  onVipEntry() {
    var that = this
    api.getVipStatus().then(function (status) {
      var isFree = !status || status.vipLevel === 0
      var trialDays = that._computeTrialDays(status)
      var offerDays = Math.ceil((new Date('2026-09-25T23:59:59+08:00') - new Date()) / 86400000)
      if (offerDays < 0) offerDays = 0
      that.setData({ showVipPage: true, vipDetailId: -1, vipSelected: -1, vipEnterpriseSeats: 4, vipStatus: status, showTrialBanner: isFree, vipTrialDays: trialDays, trialOfferDays: offerDays })
    }).catch(function () {
      var offerDays = Math.ceil((new Date('2026-09-25T23:59:59+08:00') - new Date()) / 86400000)
      if (offerDays < 0) offerDays = 0
      that.setData({ showVipPage: true, vipDetailId: -1, vipSelected: -1, vipEnterpriseSeats: 4, showTrialBanner: true, vipTrialDays: 0, trialOfferDays: offerDays })
    })
  },

  onActivateTrial() {
    var that = this
    wx.showModal({
      title: '领取免费试用',
      content: '确认领取 3 个月企业版 PRO 试用？到期日 2026-09-25，试用期间导出账单和凭证扫描仍有广告。',
      success: function (res) {
        if (!res.confirm) return
        wx.showLoading({ title: '领取中...' })
        api.activateTrial().then(function (data) {
          wx.hideLoading()
          wx.showToast({ title: data.alreadyVip ? '已是付费会员' : '领取成功！', icon: 'success' })
          // 刷新状态
          api.getVipStatus().then(function (status) {
            that.setData({ vipStatus: status, showTrialBanner: false, vipTrialDays: that._computeTrialDays(status) })
          }).catch(function () {})
        }).catch(function (err) {
          wx.hideLoading()
          wx.showToast({ title: (err && err.error) || '领取失败', icon: 'none' })
        })
      }
    })
  },

  onVipBack() {
    if (this.data.vipDetailId >= 0) {
      this.setData({ vipDetailId: -1, vipSelected: -1, vipEnterpriseSeats: 4 })
    } else {
      this.setData({ showVipPage: false, vipDetailId: -1, vipSelected: -1, vipEnterpriseSeats: 4 })
    }
  },

  onVipThumbTap(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ vipDetailId: id, vipSelected: id, vipEnterpriseSeats: 4 })
  },

  onVipSelect(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ vipSelected: this.data.vipSelected === id ? -1 : id })
  },

  // 企业版席位调节
  onVipSeatsMinus() {
    var s = this.data.vipEnterpriseSeats
    if (s <= 4) return
    this.setData({ vipEnterpriseSeats: s - 1 })
  },
  onVipSeatsPlus() {
    var s = this.data.vipEnterpriseSeats
    if (s >= 20) return
    this.setData({ vipEnterpriseSeats: s + 1 })
  },

  // 企业版价格计算
  _calcEnterprisePrice() {
    var s = this.data.vipEnterpriseSeats
    var card = this.data.vipCards[1] // enterprise
    if (!card || !card.enterpriseSeats) return { monthly: 0, annual: 0, isAnnual: false }
    var es = card.enterpriseSeats
    var monthly = es.basePrice + (s - es.min) * es.pricePerSeat
    var isAnnual = s > es.annualOnlyAbove
    var annual = Math.round(monthly * 12 * es.annualDiscount)
    return { monthly: monthly, annual: annual, isAnnual: isAnnual }
  },

  onVipConfirm() {
    if (this.data.vipSelected < 0) {
      wx.showToast({ title: '请先选择一个套餐', icon: 'none' })
      return
    }
    var card = this.data.vipCards[this.data.vipSelected]
    if (!card) return
    if (card.isContact) {
      wx.showToast({ title: '请联系客服', icon: 'none' })
      return
    }
    var that = this
    var body = { planId: card.id }
    if (card.isEnterprise) {
      body.seats = this.data.vipEnterpriseSeats
      var p = this._calcEnterprisePrice()
      body.isAnnual = p.isAnnual
      body.amount = p.isAnnual ? p.annual : p.monthly
    }
    var content = '确定订阅「' + card.name + '」吗？'
    if (card.isEnterprise) {
      var ep = this._calcEnterprisePrice()
      content = ep.isAnnual
        ? '确定订阅「' + card.name + '」' + this.data.vipEnterpriseSeats + '人 · 年费 ¥' + ep.annual + '（8.8折）吗？'
        : '确定订阅「' + card.name + '」' + this.data.vipEnterpriseSeats + '人 · ¥' + ep.monthly + '/月 吗？'
    }
    wx.showModal({
      title: '确认订阅',
      content: content,
      success: function (res) {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' })
          api.subscribeVip(body.planId).then(function () {
            wx.hideLoading()
            wx.showToast({ title: '订阅成功', icon: 'success' })
            // 刷新页面级 VIP 状态
            api.getVipStatus().then(function (s) {
              that.setData({ showVipPage: false, vipDetailId: -1, vipSelected: -1, vipEnterpriseSeats: 4, vipStatus: s, vipTrialDays: that._computeTrialDays(s) })
            }).catch(function () {
              that.setData({ showVipPage: false, vipDetailId: -1, vipSelected: -1, vipEnterpriseSeats: 4 })
            })
          }).catch(function (err) {
            wx.hideLoading()
            wx.showToast({ title: (err && err.error) || '订阅失败', icon: 'none' })
          })
        }
      },
    })
  },
})
