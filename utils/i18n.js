// 多语言翻译表
const translations = {
  // 顶部 Tab
  tab_detail:       { 'zh-CN': '明细',     'zh-TW': '明細',     'ja-JP': '明細',     'en-US': 'Details' },
  tab_report:       { 'zh-CN': '报表',     'zh-TW': '報表',     'ja-JP': 'レポート', 'en-US': 'Reports' },
  tab_book:         { 'zh-CN': '记账',     'zh-TW': '記賬',     'ja-JP': '記帳',     'en-US': 'Book' },
  tab_settle:       { 'zh-CN': '结清',     'zh-TW': '結清',     'ja-JP': '精算',     'en-US': 'Settle' },
  tab_my:           { 'zh-CN': '我的',     'zh-TW': '我的',     'ja-JP': 'マイ',     'en-US': 'My' },

  // 记账页
  book_income:      { 'zh-CN': '收入',     'zh-TW': '收入',     'ja-JP': '収入',     'en-US': 'Income' },
  book_expense:     { 'zh-CN': '支出',     'zh-TW': '支出',     'ja-JP': '支出',     'en-US': 'Expense' },
  book_transfer:    { 'zh-CN': '转账',     'zh-TW': '轉賬',     'ja-JP': '振替',     'en-US': 'Transfer' },

  // 结清页
  settle_personal:  { 'zh-CN': '个人',     'zh-TW': '個人',     'ja-JP': '個人',     'en-US': 'Personal' },
  settle_company:   { 'zh-CN': '公司',     'zh-TW': '公司',     'ja-JP': '会社',     'en-US': 'Company' },
  settle_type:      { 'zh-CN': '类型',     'zh-TW': '類型',     'ja-JP': 'タイプ',   'en-US': 'Type' },
  settle_amount:    { 'zh-CN': '金额',     'zh-TW': '金額',     'ja-JP': '金額',     'en-US': 'Amount' },

  // 明细页
  detail_period_month:  { 'zh-CN': '月度', 'zh-TW': '月度', 'ja-JP': '月次', 'en-US': 'Monthly' },
  detail_period_quarter:{ 'zh-CN': '季度', 'zh-TW': '季度', 'ja-JP': '四半期', 'en-US': 'Quarterly' },
  detail_period_year:   { 'zh-CN': '年度', 'zh-TW': '年度', 'ja-JP': '年次', 'en-US': 'Yearly' },
  detail_period_day:    { 'zh-CN': '日度', 'zh-TW': '日度', 'ja-JP': '日次', 'en-US': 'Daily' },
  detail_date:      { 'zh-CN': '日期',     'zh-TW': '日期',     'ja-JP': '日付',     'en-US': 'Date' },
  detail_personal_ledger: { 'zh-CN': '个人账本', 'zh-TW': '個人賬本', 'ja-JP': '個人帳簿', 'en-US': 'Personal Ledger' },
  detail_company_ledger:  { 'zh-CN': '公司账本', 'zh-TW': '公司賬本', 'ja-JP': '会社帳簿', 'en-US': 'Company Ledger' },
  detail_void:      { 'zh-CN': '作废',     'zh-TW': '作廢',     'ja-JP': '無効',     'en-US': 'Void' },
  detail_restore:   { 'zh-CN': '恢复',     'zh-TW': '恢復',     'ja-JP': '復元',     'en-US': 'Restore' },
  detail_remark:    { 'zh-CN': '备注',     'zh-TW': '備註',     'ja-JP': '備考',     'en-US': 'Notes' },
  detail_confirm:   { 'zh-CN': '确认',     'zh-TW': '確認',     'ja-JP': '確認',     'en-US': 'Confirm' },
  detail_cancel:    { 'zh-CN': '取消',     'zh-TW': '取消',     'ja-JP': '取消',     'en-US': 'Cancel' },
  detail_save:      { 'zh-CN': '保存',     'zh-TW': '保存',     'ja-JP': '保存',     'en-US': 'Save' },
  detail_delete:    { 'zh-CN': '删除',     'zh-TW': '刪除',     'ja-JP': '削除',     'en-US': 'Delete' },

  // 报表页
  report_title:     { 'zh-CN': '报表',     'zh-TW': '報表',     'ja-JP': 'レポート', 'en-US': 'Reports' },
  report_income_expense_bar: { 'zh-CN': '收入 / 支出柱状图', 'zh-TW': '收入 / 支出柱狀圖', 'ja-JP': '収入/支出グラフ', 'en-US': 'Income / Expense Chart' },
  report_income_source:     { 'zh-CN': '收入来源',   'zh-TW': '收入來源',   'ja-JP': '収入源',   'en-US': 'Income Source' },
  report_expense_category:  { 'zh-CN': '支出类别',   'zh-TW': '支出類別',   'ja-JP': '支出項目', 'en-US': 'Expense Category' },
  report_quarter_q1:   { 'zh-CN': '1季度',   'zh-TW': '1季度',   'ja-JP': 'Q1',   'en-US': 'Q1' },
  report_quarter_q2:   { 'zh-CN': '2季度',   'zh-TW': '2季度',   'ja-JP': 'Q2',   'en-US': 'Q2' },
  report_quarter_q3:   { 'zh-CN': '3季度',   'zh-TW': '3季度',   'ja-JP': 'Q3',   'en-US': 'Q3' },
  report_quarter_q4:   { 'zh-CN': '4季度',   'zh-TW': '4季度',   'ja-JP': 'Q4',   'en-US': 'Q4' },

  // 自定义简览页
  custom_overview_title:   { 'zh-CN': '自定义简览页', 'zh-TW': '自定義簡覽頁', 'ja-JP': 'カスタム概要', 'en-US': 'Custom Overview' },
  custom_overview_sub:     { 'zh-CN': '新简览',       'zh-TW': '新簡覽',       'ja-JP': '新概要',       'en-US': 'New Overview' },
  custom_overview_back:    { 'zh-CN': '返回简览页',   'zh-TW': '返回簡覽頁',   'ja-JP': '概要に戻る',   'en-US': 'Back to Overview' },
  custom_overview_span1:   { 'zh-CN': '占 1 格',      'zh-TW': '佔 1 格',      'ja-JP': '1マス',        'en-US': '1 Cell' },
  custom_overview_span2:   { 'zh-CN': '占 2 格',      'zh-TW': '佔 2 格',      'ja-JP': '2マス',        'en-US': '2 Cells' },
  custom_tpl_drop:         { 'zh-CN': '拖放卡片到卡槽', 'zh-TW': '拖放卡片到卡槽', 'ja-JP': 'カードをドロップ', 'en-US': 'Drop Card to Slot' },
  custom_popup_title:      { 'zh-CN': '拖入卡槽',     'zh-TW': '拖入卡槽',     'ja-JP': 'スロットに挿入', 'en-US': 'Drag to Slot' },
  custom_popup_hint:       { 'zh-CN': '拖拽下方卡片到目标槽位', 'zh-TW': '拖拽下方卡片到目標槽位', 'ja-JP': 'カードをスロットにドラッグ', 'en-US': 'Drag card to target slot' },

  // 自定义分类页
  custom_cat_title:    { 'zh-CN': '自定义分类', 'zh-TW': '自定義分類', 'ja-JP': 'カスタム分類', 'en-US': 'Custom Category' },
  custom_cat_sub:      { 'zh-CN': '新分类',     'zh-TW': '新分類',     'ja-JP': '新分類',       'en-US': 'New Category' },
  custom_cat_personal: { 'zh-CN': '个人分类',   'zh-TW': '個人分類',   'ja-JP': '個人分類',     'en-US': 'Personal Category' },
  custom_cat_company:  { 'zh-CN': '公司分类',   'zh-TW': '公司分類',   'ja-JP': '会社分類',     'en-US': 'Company Category' },
  custom_cat_add:      { 'zh-CN': '添加分类',   'zh-TW': '添加分類',   'ja-JP': '分類追加',     'en-US': 'Add Category' },
  custom_cat_name:     { 'zh-CN': '名称',       'zh-TW': '名稱',       'ja-JP': '名前',         'en-US': 'Name' },
  custom_cat_emoji:    { 'zh-CN': '图标',       'zh-TW': '圖標',       'ja-JP': 'アイコン',     'en-US': 'Icon' },

  // 我的页
  my_login_register:  { 'zh-CN': '登录/注册',  'zh-TW': '登錄/註冊',  'ja-JP': 'ログイン',     'en-US': 'Login / Register' },
  my_login_text:      { 'zh-CN': '登录 / 注册', 'zh-TW': '登錄 / 註冊', 'ja-JP': 'ログイン / 登録', 'en-US': 'Login / Register' },

  // VIP 页
  vip_title:          { 'zh-CN': '升级为VIP',   'zh-TW': '升級為VIP',  'ja-JP': 'VIPにアップグレード', 'en-US': 'Upgrade to VIP' },
  vip_sub:            { 'zh-CN': '畅享更多高级功能', 'zh-TW': '暢享更多高級功能', 'ja-JP': 'より多くの機能を楽しむ', 'en-US': 'Enjoy more advanced features' },
  vip_contact:        { 'zh-CN': '联系我们',     'zh-TW': '聯繫我們',   'ja-JP': 'お問い合わせ', 'en-US': 'Contact Us' },
  vip_subscribe:      { 'zh-CN': '升级订阅版',   'zh-TW': '升級訂閱版', 'ja-JP': 'サブスクリプション', 'en-US': 'Subscribe' },
  vip_confirm_sub:    { 'zh-CN': '确认订阅',     'zh-TW': '確認訂閱',   'ja-JP': '購読確認',     'en-US': 'Confirm Subscription' },

  // 我的页图标行
  my_link_company:    { 'zh-CN': '链接公司',   'zh-TW': '鏈接公司',   'ja-JP': '会社リンク',   'en-US': 'Link Company' },
  my_invite_employee: { 'zh-CN': '邀请员工',   'zh-TW': '邀請員工',   'ja-JP': '従業員招待',   'en-US': 'Invite Employee' },
  my_audit:           { 'zh-CN': '审核',       'zh-TW': '審核',       'ja-JP': '審査',         'en-US': 'Audit' },
  my_notify:          { 'zh-CN': '通知',       'zh-TW': '通知',       'ja-JP': '通知',         'en-US': 'Notifications' },

  // 链接公司 - 共享账本
  my_share_ledger:    { 'zh-CN': '链接公司共享同一账本', 'zh-TW': '鏈接公司共享同一賬本', 'ja-JP': '会社と帳簿を共有', 'en-US': 'Share Ledger with Company' },
  my_share_sub:       { 'zh-CN': '随时记账再也不忘', 'zh-TW': '隨時記賬再也不會忘', 'ja-JP': 'いつでも記帳', 'en-US': 'Never forget to bookkeep' },

  // 导出账单
  my_export:          { 'zh-CN': '导出账单',   'zh-TW': '導出賬單',   'ja-JP': '帳票出力',     'en-US': 'Export Bills' },
  my_export_sub:      { 'zh-CN': '一键导出',   'zh-TW': '一鍵導出',   'ja-JP': 'ワンクリック出力', 'en-US': 'One-click Export' },
  export_title:       { 'zh-CN': '导出账单',   'zh-TW': '導出賬單',   'ja-JP': '帳票出力',     'en-US': 'Export Bills' },
  export_from:        { 'zh-CN': '从',         'zh-TW': '從',         'ja-JP': 'から',         'en-US': 'From' },
  export_to:          { 'zh-CN': '到',         'zh-TW': '到',         'ja-JP': 'まで',         'en-US': 'To' },
  export_format:      { 'zh-CN': '导出格式',   'zh-TW': '導出格式',   'ja-JP': '出力形式',     'en-US': 'Format' },
  export_section_personal: { 'zh-CN': '个人总账本', 'zh-TW': '個人總賬本', 'ja-JP': '個人総勘定元帳', 'en-US': 'Personal Ledger' },
  export_section_company:  { 'zh-CN': '公司总账本', 'zh-TW': '公司總賬本', 'ja-JP': '会社総勘定元帳', 'en-US': 'Company Ledger' },
  export_btn:         { 'zh-CN': '一键导出',   'zh-TW': '一鍵導出',   'ja-JP': 'ワンクリック出力', 'en-US': 'Export' },
  export_start_date:  { 'zh-CN': '开始日期',   'zh-TW': '開始日期',   'ja-JP': '開始日',       'en-US': 'Start Date' },
  export_end_date:    { 'zh-CN': '结束日期',   'zh-TW': '結束日期',   'ja-JP': '終了日',       'en-US': 'End Date' },

  // 联系我们
  my_contact:         { 'zh-CN': '联系我们获好礼', 'zh-TW': '聯繫我們獲好禮', 'ja-JP': 'お問い合わせ', 'en-US': 'Contact Us for Gifts' },
  my_contact_sub:     { 'zh-CN': '提意见赠会员', 'zh-TW': '提意見贈會員', 'ja-JP': '意見でVIP進呈', 'en-US': 'Feedback for VIP' },
  contact_title:      { 'zh-CN': '联系我们获好礼', 'zh-TW': '聯繫我們獲好禮', 'ja-JP': 'お問い合わせ', 'en-US': 'Contact Us for Gifts' },
  contact_info_title: { 'zh-CN': '提意见，赠 VIP 会员', 'zh-TW': '提意見，贈 VIP 會員', 'ja-JP': '意見でVIP進呈', 'en-US': 'Submit Feedback, Get VIP' },
  contact_info_desc:  { 'zh-CN': '您的每一条建议我们都认真对待，提交有效反馈即可获赠 VIP 会员体验', 'zh-TW': '您的每一條建議我們都認真對待，提交有效反饋即可獲贈 VIP 會員體驗', 'ja-JP': 'ご意見を真摯に受け止め、有効なフィードバックにはVIP会員権を進呈します', 'en-US': 'We take every suggestion seriously. Submit valid feedback to receive a VIP membership trial.' },
  contact_placeholder:{ 'zh-CN': '请在此输入您的意见或建议...', 'zh-TW': '請在此輸入您的意見或建議...', 'ja-JP': 'ご意見・ご提案を入力してください...', 'en-US': 'Please enter your feedback or suggestions...' },
  contact_submit:     { 'zh-CN': '提交反馈',   'zh-TW': '提交反饋',   'ja-JP': '送信',         'en-US': 'Submit Feedback' },
  contact_other:      { 'zh-CN': '其他联系方式', 'zh-TW': '其他聯繫方式', 'ja-JP': 'その他の連絡先', 'en-US': 'Other Contact Methods' },
  contact_email_label:{ 'zh-CN': '官方邮箱',   'zh-TW': '官方郵箱',   'ja-JP': '公式メール',   'en-US': 'Official Email' },

  // 设置页
  my_settings:        { 'zh-CN': '设置',       'zh-TW': '設置',       'ja-JP': '設定',         'en-US': 'Settings' },
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
  settings_leave_company: { 'zh-CN': '退出公司', 'zh-TW': '退出公司', 'ja-JP': '会社退出',   'en-US': 'Leave Company' },
  settings_leave_hint:    { 'zh-CN': '离开当前公司', 'zh-TW': '離開當前公司', 'ja-JP': '現在の会社を離脱', 'en-US': 'Leave current company' },
  settings_dissolve: { 'zh-CN': '解散公司',   'zh-TW': '解散公司',   'ja-JP': '会社解散',     'en-US': 'Dissolve Company' },
  settings_dissolve_hint: { 'zh-CN': '不可撤销', 'zh-TW': '不可撤銷', 'ja-JP': '取消不可',   'en-US': 'Irreversible' },
  settings_other:     { 'zh-CN': '其他',       'zh-TW': '其他',       'ja-JP': 'その他',       'en-US': 'Other' },
  settings_clear_cache:   { 'zh-CN': '清除缓存', 'zh-TW': '清除緩存', 'ja-JP': 'キャッシュ削除', 'en-US': 'Clear Cache' },
  settings_about:     { 'zh-CN': '关于我们',   'zh-TW': '關於我們',   'ja-JP': 'アプリ情報',   'en-US': 'About' },
  settings_logout:    { 'zh-CN': '退出登录',   'zh-TW': '退出登錄',   'ja-JP': 'ログアウト',   'en-US': 'Log Out' },

  // 深色模式选项
  dark_system:  { 'zh-CN': '跟随系统', 'zh-TW': '跟隨系統', 'ja-JP': 'システム連動', 'en-US': 'Follow System' },
  dark_light:   { 'zh-CN': '浅色模式', 'zh-TW': '淺色模式', 'ja-JP': 'ライトモード', 'en-US': 'Light Mode' },
  dark_dark:    { 'zh-CN': '深色模式', 'zh-TW': '深色模式', 'ja-JP': 'ダークモード', 'en-US': 'Dark Mode' },

  // 语言标签
  lang_zhcn: { 'zh-CN': '简体中文', 'zh-TW': '簡體中文', 'ja-JP': '簡体字中国語', 'en-US': 'Simplified Chinese' },
  lang_zhtw: { 'zh-CN': '繁體中文', 'zh-TW': '繁體中文', 'ja-JP': '繁体字中国語', 'en-US': 'Traditional Chinese' },
  lang_jajp: { 'zh-CN': '日本語',   'zh-TW': '日本語',   'ja-JP': '日本語',       'en-US': 'Japanese' },
  lang_enus: { 'zh-CN': 'English',  'zh-TW': 'English',  'ja-JP': 'English',      'en-US': 'English' },

  // 公司链接页
  company_boss_title:   { 'zh-CN': '我是老板',   'zh-TW': '我是老闆',   'ja-JP': '経営者',     'en-US': 'I am the Boss' },
  company_employee_title: { 'zh-CN': '我是员工', 'zh-TW': '我是員工',   'ja-JP': '従業員',     'en-US': 'I am an Employee' },
  company_create_title: { 'zh-CN': '创建专属 UID', 'zh-TW': '創建專屬 UID', 'ja-JP': 'UIDを作成', 'en-US': 'Create UID' },
  company_name_label:  { 'zh-CN': '公司名称',   'zh-TW': '公司名稱',   'ja-JP': '会社名',       'en-US': 'Company Name' },
  company_boss_label:  { 'zh-CN': 'BOSS 称呼',  'zh-TW': 'BOSS 稱呼',  'ja-JP': 'BOSS名',      'en-US': 'Boss Name' },
  company_uid_label:   { 'zh-CN': 'UID 码',     'zh-TW': 'UID 碼',     'ja-JP': 'UIDコード',   'en-US': 'UID Code' },
  company_phone_label: { 'zh-CN': '手机号',     'zh-TW': '手機號',     'ja-JP': '電話番号',     'en-US': 'Phone' },
  company_code_label:  { 'zh-CN': '验证码',     'zh-TW': '驗證碼',     'ja-JP': '認証コード',   'en-US': 'Code' },
  company_no_company:  { 'zh-CN': '检测到还未创建公司，填写后创建', 'zh-TW': '檢測到還未創建公司，填寫後創建', 'ja-JP': '会社未作成です。入力して作成', 'en-US': 'No company detected. Fill in to create.' },
  company_no_join:     { 'zh-CN': '检测到还未加入公司，填写 UID 后加入', 'zh-TW': '檢測到還未加入公司，填寫 UID 後加入', 'ja-JP': '会社未参加です。UIDを入力して参加', 'en-US': 'No company joined. Enter UID to join.' },
  company_uid_hint:    { 'zh-CN': '注：企业版 UID 才可共享', 'zh-TW': '注：企業版 UID 才可共享', 'ja-JP': '注：企業版UIDのみ共有可能', 'en-US': 'Note: Enterprise UID required for sharing.' },
  company_join_btn:    { 'zh-CN': '一键加入公司', 'zh-TW': '一鍵加入公司', 'ja-JP': '会社に参加', 'en-US': 'Join Company' },
  company_create_btn:  { 'zh-CN': '确认创建',   'zh-TW': '確認創建',   'ja-JP': '作成確認',     'en-US': 'Create' },
  company_create_success: { 'zh-CN': '公司创建成功', 'zh-TW': '公司創建成功', 'ja-JP': '会社作成完了', 'en-US': 'Company Created' },
  company_employee_success_title: { 'zh-CN': '已链接公司', 'zh-TW': '已鏈接公司', 'ja-JP': '会社リンク済', 'en-US': 'Company Linked' },
  company_employee_success_role:  { 'zh-CN': '员工', 'zh-TW': '員工', 'ja-JP': '従業員', 'en-US': 'Employee' },
  company_employee_note_prefix: { 'zh-CN': '注：企业版员工个人记录依旧保存在', 'zh-TW': '注：企業版員工個人記錄依舊保存在', 'ja-JP': '注：従業員の個人記録は', 'en-US': 'Note: Employee personal records are kept in' },
  company_employee_note_local: { 'zh-CN': '本地', 'zh-TW': '本地', 'ja-JP': 'ローカル', 'en-US': 'local' },
  company_employee_note_suffix1: { 'zh-CN': '，不会上传至公司。', 'zh-TW': '，不會上傳至公司。', 'ja-JP': 'に保存され、会社にアップロードされません。', 'en-US': ', not uploaded to the company.' },
  company_employee_note_advance: { 'zh-CN': '个人垫付款、采购款等垫资款将', 'zh-TW': '個人墊付款、採購款等墊資款將', 'ja-JP': '立替金・購買代金などは', 'en-US': 'Personal advances, procurement payments, etc. will be' },
  company_employee_note_to_company: { 'zh-CN': '到公司账本。', 'zh-TW': '到公司賬本。', 'ja-JP': '会社帳簿に計上されます。', 'en-US': 'synced to company ledger.' },
  company_employee_note_confirm: { 'zh-CN': '。公司端结清账单后，你需要确认资金是否到位，再点击', 'zh-TW': '。公司端結清賬單後，你需要確認資金是否到位，再點擊', 'ja-JP': '。会社側が精算後、資金確認の上', 'en-US': '. After the company settles, confirm fund receipt and click' },
  company_employee_note_last: { 'zh-CN': '确认清楚', 'zh-TW': '確認清楚', 'ja-JP': '確認', 'en-US': 'Confirm' },
  company_employee_note_end: { 'zh-CN': '，一旦结清，公司则会认为你已经到账，为了避免后续纠纷，请一定要', 'zh-TW': '，一旦結清，公司則會認為你已經到賬，為了避免後續糾紛，請一定要', 'ja-JP': '。精算後は会社が入金済とみなします。後日のトラブルを避けるため、必ず', 'en-US': '. Once settled, the company assumes payment received. To avoid disputes, please' },
  company_employee_note_direct: { 'zh-CN': '直接同步', 'zh-TW': '直接同步', 'ja-JP': '直接同期', 'en-US': 'Sync Directly' },
  company_boss_sync_hint: { 'zh-CN': '。公司端结清账单后，你需要确认资金是否到位', 'zh-TW': '。公司端結清賬單後，你需要確認資金是否到位', 'ja-JP': '。会社側が精算後、資金確認が必要です', 'en-US': '. After company settles, confirm fund receipt.' },
  company_settle_hint: { 'zh-CN': '* 结清后相关收支将自动转为普通流水', 'zh-TW': '* 結清後相關收支將自動轉為普通流水', 'ja-JP': '* 精算後、関連収支は通常の取引に自動変換', 'en-US': '* After settlement, related entries convert to regular transactions.' },
  company_btn_settle:  { 'zh-CN': '一键全结清', 'zh-TW': '一鍵全結清', 'ja-JP': '一括精算',     'en-US': 'Settle All' },
  company_btn_share:   { 'zh-CN': '一键分享',   'zh-TW': '一鍵分享',   'ja-JP': '共有',         'en-US': 'Share' },

  // 登录页
  login_wx_btn:     { 'zh-CN': '微信一键登录', 'zh-TW': '微信一鍵登錄', 'ja-JP': 'WeChatログイン', 'en-US': 'WeChat Login' },
  login_agreement:  { 'zh-CN': '登录即代表同意《用户协议》和《隐私政策》', 'zh-TW': '登錄即代表同意《用戶協議》和《隱私政策》', 'ja-JP': 'ログインで利用規約とプライバシーポリシーに同意', 'en-US': 'By logging in, you agree to the User Agreement and Privacy Policy.' },
  login_other:      { 'zh-CN': '其他登录方式', 'zh-TW': '其他登錄方式', 'ja-JP': '他のログイン方法', 'en-US': 'Other Login Methods' },

  // 审核页
  audit_title:      { 'zh-CN': '审核',        'zh-TW': '審核',        'ja-JP': '審査',         'en-US': 'Audit' },
  audit_no_data:    { 'zh-CN': '暂无审核',    'zh-TW': '暫無審核',    'ja-JP': '審査なし',     'en-US': 'No pending audits' },
  audit_approve:    { 'zh-CN': '通过',        'zh-TW': '通過',        'ja-JP': '承認',         'en-US': 'Approve' },
  audit_reject:     { 'zh-CN': '拒绝',        'zh-TW': '拒絕',        'ja-JP': '拒否',         'en-US': 'Reject' },
  audit_status_approved: { 'zh-CN': '已通过', 'zh-TW': '已通過', 'ja-JP': '承認済', 'en-US': 'Approved' },
  audit_status_rejected: { 'zh-CN': '已拒绝', 'zh-TW': '已拒絕', 'ja-JP': '拒否済', 'en-US': 'Rejected' },

  // 通知页
  notify_title:     { 'zh-CN': '通知',        'zh-TW': '通知',        'ja-JP': '通知',         'en-US': 'Notifications' },
  notify_no_data:   { 'zh-CN': '暂无通知',    'zh-TW': '暫無通知',    'ja-JP': '通知なし',     'en-US': 'No notifications' },
  notify_delete:    { 'zh-CN': '删除',        'zh-TW': '刪除',        'ja-JP': '削除',         'en-US': 'Delete' },

  // Toast / Modal
  toast_lang_changed:    { 'zh-CN': '语言已切换',    'zh-TW': '語言已切換',    'ja-JP': '言語切替完了',   'en-US': 'Language changed' },
  toast_dark_changed:    { 'zh-CN': '深色模式已切换', 'zh-TW': '深色模式已切換', 'ja-JP': 'モード切替完了', 'en-US': 'Dark mode changed' },
  toast_cache_cleared:   { 'zh-CN': '缓存已清除',    'zh-TW': '緩存已清除',    'ja-JP': 'キャッシュ削除完了', 'en-US': 'Cache cleared' },
  toast_logged_out:      { 'zh-CN': '已退出登录',    'zh-TW': '已退出登錄',    'ja-JP': 'ログアウト完了',  'en-US': 'Logged out' },
  toast_left_company:    { 'zh-CN': '已退出公司',    'zh-TW': '已退出公司',    'ja-JP': '会社退出完了',    'en-US': 'Left company' },
  toast_dissolved:       { 'zh-CN': '公司已解散',    'zh-TW': '公司已解散',    'ja-JP': '会社解散完了',    'en-US': 'Company dissolved' },
  toast_dev:             { 'zh-CN': '功能开发中',    'zh-TW': '功能開發中',    'ja-JP': '開発中',          'en-US': 'Coming soon' },
  toast_feedback_ok:     { 'zh-CN': '感谢您的反馈！VIP 会员已赠送', 'zh-TW': '感謝您的反饋！VIP 會員已贈送', 'ja-JP': 'ご意見ありがとう！VIP進呈', 'en-US': 'Thanks for your feedback! VIP granted.' },
  toast_input_required:  { 'zh-CN': '请输入您的意见或建议', 'zh-TW': '請輸入您的意見或建議', 'ja-JP': 'ご意見を入力してください', 'en-US': 'Please enter your feedback' },
  toast_no_company:      { 'zh-CN': '请先注册公司', 'zh-TW': '請先註冊公司', 'ja-JP': '先に会社登録を', 'en-US': 'Please register a company first' },
  toast_approved:        { 'zh-CN': '已通过',       'zh-TW': '已通過',       'ja-JP': '承認済',       'en-US': 'Approved' },
  toast_rejected:        { 'zh-CN': '已拒绝',       'zh-TW': '已拒絕',       'ja-JP': '拒否済',       'en-US': 'Rejected' },

  // Modal titles / content
  modal_clear_cache_title:   { 'zh-CN': '清除缓存',   'zh-TW': '清除緩存',   'ja-JP': 'キャッシュ削除', 'en-US': 'Clear Cache' },
  modal_clear_cache_content: { 'zh-CN': '确定要清除本地缓存数据吗？', 'zh-TW': '確定要清除本地緩存數據嗎？', 'ja-JP': 'ローカルキャッシュを削除しますか？', 'en-US': 'Clear local cache data?' },
  modal_logout_title:   { 'zh-CN': '退出登录',   'zh-TW': '退出登錄',   'ja-JP': 'ログアウト',   'en-US': 'Log Out' },
  modal_logout_content: { 'zh-CN': '确定要退出当前账号吗？', 'zh-TW': '確定要退出當前賬號嗎？', 'ja-JP': '現在のアカウントからログアウトしますか？', 'en-US': 'Log out of current account?' },
  modal_leave_company_title: { 'zh-CN': '退出公司', 'zh-TW': '退出公司', 'ja-JP': '会社退出', 'en-US': 'Leave Company' },
  modal_leave_company_content: { 'zh-CN': '退出后你将无法查看公司账本，确定退出吗？', 'zh-TW': '退出後將無法查看公司賬本，確定退出嗎？', 'ja-JP': '退出後は会社帳簿を閲覧できません。よろしいですか？', 'en-US': 'You will lose access to company ledger. Confirm?' },
  modal_dissolve_title: { 'zh-CN': '解散公司', 'zh-TW': '解散公司', 'ja-JP': '会社解散', 'en-US': 'Dissolve Company' },
  modal_dissolve_content: { 'zh-CN': '解散后所有员工将无法查看公司账本，此操作不可撤销，确定解散吗？', 'zh-TW': '解散後所有員工將無法查看公司賬本，此操作不可撤銷，確定解散嗎？', 'ja-JP': '解散後は全従業員が会社帳簿を閲覧できなくなります。取消不可、解散しますか？', 'en-US': 'All employees will lose access. This is irreversible. Confirm?' },
};

// 获取翻译
function t(key, lang) {
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang] || entry['zh-CN'] || key;
}

// 获取完整翻译对象 (用于 setData)
function getTLang(lang) {
  const result = {};
  for (const key of Object.keys(translations)) {
    result[key] = t(key, lang);
  }
  return result;
}

// 获取语言显示名
function getLangLabel(lang) {
  const entry = translations[`lang_${lang.replace('-', '').toLowerCase()}`];
  if (entry) return entry[lang] || entry['zh-CN'];
  const map = { 'zh-CN': '简体中文', 'zh-TW': '繁體中文', 'ja-JP': '日本語', 'en-US': 'English' };
  return map[lang] || lang;
}

module.exports = { t, getTLang, getLangLabel, translations };
