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
  _redrawReportCharts() {
    var d = this.data
    if (d.currentTab !== 1) return
    if (d.showExpandMenu || d.showCamera || d.scanRecognizing || d.showBookPopup || d.modalItem || d.showChat || d.chatRecording || d.searchRecording) return
    setTimeout(() => {
      this._drawCurrentChart()
    }, 300)
  },

  onExpandMenuTap() {
    playTap()
    this.setData({ showExpandMenu: !this.data.showExpandMenu })
    if (!this.data.showExpandMenu) this._redrawReportCharts()
  },

  onExpandMenuItem(e) {
    playTap()
    this.setData({ showExpandMenu: false })
    var action = e.currentTarget.dataset.action
    var _this = this
    if (action === 'scan') {
      this.setData({ showCamera: true })
    } else if (action === 'category') {
      this.setData({ currentTab: 4, showOverview: false })
      this.onCustomCategoryEntry()
    } else if (action === 'chat') {
      var greeting = {
        role: 'assistant',
        text: '你好！我是你的 语音记账助手\n\n试试对我说：\n• "午餐 25"\n• "打车 15 交通"\n• "收到工资 8000"',
        time: this._formatChatTime(new Date())
      }
      this.setData({
        showChat: true,
        chatMessages: [greeting],
        chatInputText: '',
        chatThinking: false,
        chatScrollTop: 999999,
        chatVoiceMode: false
      })
    }
  },

  // ---- 顶部搜索 ----
  onHeaderSearchInput(e) {
    this.setData({ searchText: e.detail.value })
    this.initDetailItems() // 输入即时过滤明细列表（setData 后 this.data.searchText 已同步更新）
  },
  onHeaderSearch() {
    playTap()
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
    playTap()
    this.setData({ showCamera: false })
    this._redrawReportCharts()
  },

  onCameraShoot() {
    playTap()
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
    playTap()
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
    // OCR 临时图在识别完成后由服务端立即删除，不作为云端凭证长期保存。
    api.uploadVoucher(photo, 'ocr').then((url) => {
      return api.ocrParse(url)
    }).then((result) => {
      if (!result) throw { error: '识别结果为空' }
      this.setData({ scanRecognizing: false })
      // 多笔：打开 语音对话窗，卡片队列逐条确认
      if (result.items && result.items.length > 1) {
        this._openOcrReview(result.items, photo)
        return
      }
      // 单笔（兼容旧格式或 items[0]）：走原有弹窗流程
      var item = result.items ? result.items[0] : result
      this.onBookEntry({ currentTarget: { dataset: { type: 'expense' } } })
      this.setData({
        bookPhoto: photo,
        'bookForm.amount': item.amount || '',
        'bookForm.category': item.category || '',
        'bookForm.note': item.note || '',
        'bookForm.date': item.date || this.data.bookForm.date
      })
    }).catch((err) => {
      this.setData({ scanRecognizing: false })
      if ((err && err.error) === 'usage_limit') {
        this._showVipLimitDialog('ocr')
      } else {
        var msg = (err && err.error) || (err && err.message) || (err && err.errMsg) || '识别失败'
        wx.showToast({ title: msg, icon: 'none' })
      }
    })
  },

  // OCR 多笔结果 → 语音卡片队列确认
  _openOcrReview(items, photo) {
    var that = this
    var now = new Date()
    var time = this._formatChatTime(now)
    var scope = this.data.bookScope || 'personal'
    var msgs = []

    // 欢迎语
    msgs.push({
      role: 'assistant',
      text: '识别到 ' + items.length + ' 笔账单，请逐笔确认：',
      time: time
    })

    // 每笔 OCR 结果构造为一张待确认卡片
    for (var i = 0; i < items.length; i++) {
      var it = items[i]
      var absAmt = parseFloat(it.amount).toFixed(2) || '0.00'
      var isIncome = it.type === 'income'
      var cat = it.category || '其他'
      var catIdx = this.data.catOptions.indexOf(cat)
      if (catIdx < 0) catIdx = this.data.catOptions.length - 1
      var typeLabel = isIncome ? '收入' : '支出'
      var typeIdx = this._typeIdxFromLabel(typeLabel)
      var typeKey = this.data._typeLabelToKey[typeLabel] || 'expense'
      var td = this._getBookTargetDefaults(scope, typeKey)
      var targetIdx = td.target ? this.data.targetOptions.indexOf(td.target) : 2
      if (targetIdx < 0) targetIdx = 2
      msgs.push({
        role: 'assistant',
        text: '第 ' + (i + 1) + ' 笔',
        card: {
          category: cat,
          amount: absAmt,
          typeLabel: typeLabel,
          type: isIncome ? 'in' : 'out',
          date: it.date || (now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')),
          note: it.note || '',
          scope: scope,
          target: td.target,
          targetType: td.targetType
        },
        confirmed: undefined,
        _ocrIndex: i,
        _catIdx: catIdx,
        _typeIdx: typeIdx,
        _targetIdx: targetIdx,
        time: time
      })
    }

    this.setData({
      showChat: true,
      chatMessages: msgs,
      chatInputText: '',
      chatThinking: false,
      chatVoiceMode: false,
      chatScrollTop: 999999
    })
  },

  onBookPhotoPreview() {
    playTap()
    if (this.data.bookPhoto) wx.previewImage({ urls: [this.data.bookPhoto] })
  },

  onBookPhotoRemove() {
    playTap()
    this.setData({ bookPhoto: '' })
  },

  onVoucherPreview(e) {
    playTap()
    var s = e.currentTarget.dataset.src
    if (s) wx.previewImage({ urls: [s] })
  },

  // ---- 语音对话 ----
  // 语音转文字走后端 ASR，前端只负责录音采集 + 上传。
  _ensureRecorder() {
    if (this._recorder) return this._recorder
    var that = this
    var recorder = wx.getRecorderManager()
    // 注意：WeChat API 是方法调用 .onStop(fn)，不是属性赋值 .onStop = fn
    recorder.onStart(function () {
      console.log('[ASR] 录音已开始')
      that._recorderBusy = true
    })
    recorder.onStop(function (res) {
      that._recorderBusy = false
      that._onRecorderStop(res.tempFilePath)
    })
    recorder.onError(function (err) {
      console.warn('[ASR] 录音错误', JSON.stringify(err))
      that._recorderBusy = false
      var errMsg = (err && err.errMsg) || ''
      that._chatRecognizeFor = ''
      clearTimeout(that._recordTimeout)
      that._recordTimeout = 0
      that.setData({ chatRecording: false })
      if (errMsg.indexOf('auth') >= 0 || errMsg.indexOf('permission') >= 0 || errMsg.indexOf('deny') >= 0) {
        wx.showModal({
          title: '麦克风未授权',
          content: '请在设置中开启麦克风权限',
          confirmText: '去设置',
          success: function (m) { if (m.confirm) wx.openSetting() }
        })
      } else {
        wx.showToast({ title: '录音失败，请重试', icon: 'none' })
      }
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
      this._chatRecognizeFor = ''
      this.setData({ chatRecording: false })
      console.log('[ASR] tempFilePath 为空，中止')
      wx.showToast({ title: '没听清，请重试', icon: 'none' })
      return
    }
    console.log('[ASR] 开始上传识别...')
    this._asrPending = true
    api.asrRecognize(tempFilePath).then(function (text) {
      that._asrPending = false
      that._onRecognizeDone(text)
    }).catch(function (err) {
      that._asrPending = false
      console.warn('[ASR] 识别失败', err)
      that._chatRecognizeFor = ''
      that.setData({ chatRecording: false })
      if ((err && err.error) === 'usage_limit') {
        that._showVipLimitDialog('asr')
      } else {
        var msg = (err && err.error) || (err && err.message) || (err && err.errMsg) || '识别失败'
        wx.showToast({ title: msg, icon: 'none' })
      }
    })
  },

  // forWho: 'tab'=底部长按入口(识别后开对话窗发送) / 'chat'=对话框语音键(识别后填输入框发送)
  _startRecognize(forWho) {
    var that = this
    // 录音器忙保护：底层 stop 是异步的，onStop/onError 回调未返回前拒绝新录音
    if (this._recorderBusy) {
      console.log('[ASR] 录音器忙，拒绝重复启动 forWho=' + forWho)
      wx.showToast({ title: '请稍后再试', icon: 'none' })
      return
    }
    var recorder = this._ensureRecorder()
    this._chatRecognizeFor = forWho
    this.setData({ chatRecording: true })
    // 先检查录音权限，未授权则引导去设置页
    wx.getSetting({
      success: function (s) {
        if (s.authSetting['scope.record'] === false) {
          that._chatRecognizeFor = ''
          that.setData({ chatRecording: false })
          wx.showModal({
            title: '需要录音权限',
            content: '请在设置中开启麦克风权限，否则无法语音记账',
            confirmText: '去设置',
            success: function (m) {
              if (m.confirm) wx.openSetting()
            }
          })
          return
        }
        that._doStartRecord(recorder, forWho)
      },
      fail: function () {
        that._doStartRecord(recorder, forWho)
      }
    })
  },

  _doStartRecord(recorder, forWho) {
    var that = this
    if (this._recorderBusy) {
      console.log('[ASR] _doStartRecord 录音器忙，取消')
      return false
    }
    try {
      recorder.start({ format: 'PCM', sampleRate: 16000, numberOfChannels: 1, duration: 15000 })
      console.log('[ASR] recorder.start 已调用 forWho=' + forWho)
    } catch (e) {
      console.warn('[ASR] recorder.start 异常', e)
      this._chatRecognizeFor = ''
      this.setData({ chatRecording: false })
      return false
    }
    // 手动兜底：15s 后强制停止
    this._recordTimeout = setTimeout(function () {
      if (that.data.chatRecording) {
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
    this.setData({ chatRecording: false })
    // 尝试停止录音（真机 onStop 回调触发 → ASR 识别 → 打开对话窗）
    if (this._recorder) {
      try { this._recorder.stop() } catch (e) { console.warn('[ASR] stop 异常', e) }
    }
    // 兜底：onStop 未触发（开发者工具等）时清理内部状态
    clearTimeout(this._stopFallback)
    this._stopFallback = setTimeout(function () {
      if (that._chatRecognizeFor) {
        console.log('[ASR] onStop 未触发，残留清理')
        that._chatRecognizeFor = ''
      }
      that._recorderBusy = false
    }, 500)
  },

  // 识别完成（onStop 异步回调）：按入口分发
  _onRecognizeDone(text) {
    var who = this._chatRecognizeFor
    this._chatRecognizeFor = ''
    this.setData({ chatRecording: false })
    // 未通过审核的员工不能记公司账
    if (this.data.bookScope === 'company' && !api.isCompanyApproved()) {
      wx.showToast({ title: '您暂时还未加入公司，请申请或通过审核后重试', icon: 'none', duration: 2500 })
      return
    }
    var t = (text || '').trim()
    if (!t) {
      wx.showToast({ title: '没听清，请再说一次', icon: 'none' })
      return
    }
    // 语音使用计数 — 每 3 次提示领取会员
    var count = (wx.getStorageSync('_asrUseCount') || 0) + 1
    wx.setStorageSync('_asrUseCount', count)
    if (count % 3 === 0) {
      wx.showModal({
        title: '语音记账',
        content: '测试期间可免费领取 VIP 会员，畅享不限次语音记账、凭证扫描等高级功能。',
        confirmText: '领取会员',
        cancelText: '稍后再说',
        success: (res) => { if (res.confirm) this.onVipEntry() }
      })
    }
    if (who === 'chat') {
      this.setData({ chatInputText: t })
      setTimeout(this.onChatSend.bind(this), 200)
    } else {
      console.log('[ASR] tab 入口，打开对话窗')
      this._sendAiUserText(t)
    }
  },

  // 打开对话窗 + 把一句用户文本走 _mockAiReply 解析记账
  _sendAiUserText(text) {
    const now = new Date()
    const msgs = []
    if (!this.data.showChat || !this.data.chatMessages.length) {
      // 首次打开聊天时，同步用户自定义分类到选择器
      this._syncChatCatOptions()
      msgs.push({
        role: 'assistant',
        text: '你好！我是你的 语音记账助手\n\n试试对我说：\n• "午餐 25"\n• "打车 15 交通"\n• "收到工资 8000"',
        time: this._formatChatTime(now)
      })
    } else {
      msgs.push.apply(msgs, this.data.chatMessages)
    }
    msgs.push({ role: 'user', text, time: this._formatChatTime(now) })

    // ---- 多笔记账语音检测 ----
    var multiExpr = this._detectMultiEntryVoice(text)
    if (multiExpr) {
      const result = this._calcMulti(multiExpr)
      if (result.multiCount >= 2) {
        const date = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
        this.setData({
          showChat: true,
          chatMessages: msgs,
          chatInputText: '',
          chatThinking: false,
          chatScrollTop: 999999 + (msgs.length - 1),
          showBookPopup: true,
          bookMode: 'multi',
          multiExpression: multiExpr,
          multiResult: result.multiResult,
          multiCount: result.multiCount,
          multiStartDate: date,
          multiEndDate: date,
          multiNote: '',
          multiScope: 'personal',
          multiScopeLabel: '个人',
          multiType: 'expense',
          multiTypeLabel: '支出',
          multiUseDateRange: false,
        })
        return
      }
    }

    // ---- 隐式多笔 ----
    var imp_ocr = this._detectImplicitMulti(text)
    if (imp_ocr && imp_ocr.count >= 2) {
      for (var si = 0; si < imp_ocr.segments.length; si++) {
        const reply = this._mockAiReply(imp_ocr.segments[si])
        if (reply.card) {
          reply.card._impIdx = si + 1
          reply.card._impTotal = imp_ocr.segments.length
        }
        msgs.push(reply)
      }
      this.setData({
        showChat: true,
        chatMessages: msgs,
        chatInputText: '',
        chatThinking: false,
        chatScrollTop: 999999 + (msgs.length - 1)
      })
      return
    }

    this.setData({
      showChat: true,
      chatMessages: msgs,
      chatInputText: '',
      chatThinking: true,
      chatScrollTop: 999999 + (msgs.length - 1)
    })
    setTimeout(() => {
      const reply = this._mockAiReply(text)
      const updated = this.data.chatMessages.slice()
      updated.push(reply)
      this.setData({
        chatMessages: updated,
        chatThinking: false,
        chatScrollTop: 999999 + (updated.length - 1)
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
        role: 'assistant',
        text: '正在聆听…',
        time: that._formatChatTime(new Date())
      }
      that.setData({
        showChat: true,
        chatMessages: [greeting],
        chatInputText: '',
        chatThinking: false,
        chatScrollTop: 999999,
        chatVoiceMode: true
      })
      that._startRecognize('tab')
    }, 250)
  },

  onTabCenterTouchEnd() {
    console.log('[Touch] touchend isHolding=' + this._isHoldingTab + ' timer=' + !!this._tabHoldTimer + ' recording=' + this.data.chatRecording)
    if (this._tabHoldTimer) {
      console.log('[Touch] 短按，切tab')
      clearTimeout(this._tabHoldTimer)
      this._tabHoldTimer = 0
      this.switchTab({ currentTarget: { dataset: { index: 2 } } })
    } else if (this._isHoldingTab) {
      console.log('[Touch] 长按松手，停止录音')
      this._isHoldingTab = false
      if (this.data.chatRecording) this._stopRecognize()
    }
  },

  onChatOverlayTouchEnd() {
    // 录音中任意位置松手 → 立即停止
    if (this.data.chatRecording) this._stopRecognize()
  },

  onChatOverlayTap() {
    playTap()
    // 录音中点按遮罩 → 停止录音（不关窗口，等识别结果）
    if (this.data.chatRecording) {
      this._stopRecognize()
    } else {
      this.onAiChatClose()
    }
  },

  onAiChatClose() {
    playTap()
    if (this.data.chatRecording) this._stopRecognize()
    this.setData({ showChat: false, chatRecording: false })
    this._redrawReportCharts()
  },

  onAiBillTap(e) {
    playTap()
    const idx = e.currentTarget.dataset.idx
    const msg = this.data.chatMessages[idx]
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
      showChat: false,
      currentTab: 0,
      showOverview: false,
      detailItems: _aiItems,
      detailGroups: this._buildDetailGroups(_aiItems),
      modalItem: found ? { ...found, _settleText: this._formatSettleText(found), _timeText: this._billTimeText(found), _readonly: !!(found._autoSettle || found.settleStatus === 'settled') } : null,
    })
  },

  onChatInput(e) {
    this.setData({ chatInputText: e.detail.value })
  },

  onChatSend() {
    playTap()
    // 未通过审核的员工不能记公司账
    if (this.data.bookScope === 'company' && !api.isCompanyApproved()) {
      wx.showToast({ title: '您暂时还未加入公司，请申请或通过审核后重试', icon: 'none', duration: 2500 })
      return
    }
    const text = this.data.chatInputText.trim()
    if (!text || this.data.chatThinking) return

    const msgs = this.data.chatMessages.slice()
    const userMsg = { role: 'user', text, time: this._formatChatTime(new Date()) }
    msgs.push(userMsg)

    this.setData({
      chatMessages: msgs,
      chatInputText: '',
      chatThinking: true,
      chatScrollTop: 999999 + msgs.length
    })

    // ---- 多笔记账检测 ----
    var multiExpr = this._detectMultiEntryVoice(text)
    if (multiExpr) {
      const result = this._calcMulti(multiExpr)
      if (result.multiCount >= 2) {
        const now = new Date()
        const date = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
        this.setData({
          chatThinking: false,
          showBookPopup: true,
          bookMode: 'multi',
          multiExpression: multiExpr,
          multiResult: result.multiResult,
          multiCount: result.multiCount,
          multiStartDate: date,
          multiEndDate: date,
          multiNote: '',
          multiScope: 'personal',
          multiScopeLabel: '个人',
          multiType: 'expense',
          multiTypeLabel: '支出',
          multiUseDateRange: false,
        })
        return
      }
    }

    // ---- 隐式多笔：每段独立解析，生成多张卡片 ----
    var imp = this._detectImplicitMulti(text)
    if (imp && imp.count >= 2) {
      const updated = this.data.chatMessages.slice()
      for (var si = 0; si < imp.segments.length; si++) {
        const reply = this._mockAiReply(imp.segments[si])
        // 追加段序号标记
        if (reply.card) {
          reply.card._impIdx = si + 1
          reply.card._impTotal = imp.segments.length
        }
        updated.push(reply)
      }
      this.setData({
        chatMessages: updated,
        chatThinking: false,
        chatScrollTop: 999999 + (updated.length - 1)
      })
      return
    }

    setTimeout(() => {
      const reply = this._mockAiReply(text)
      const updated = this.data.chatMessages.slice()
      updated.push(reply)
      this.setData({
        chatMessages: updated,
        chatThinking: false,
        chatScrollTop: 999999 + (updated.length - 1)
      })
    }, 800)
  },

  // 关键词驱动弹性解析：7 字段任意语序，缺省智能填充
  _mockAiReply(input) {
    var time = this._formatChatTime(new Date())
    var now = new Date()
    var dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')

    var text = input

    // ---- ASR 同音词纠正（语音识别常见误差 → 正确语义） ----
    var ASR_FIX = {
      '流连': '榴莲', '水角': '水饺', '交通会': '交通费',
      '水果蓝': '水果篮', '购物卷': '购物券',
      '话会': '话费', '高贴': '高铁', '低贴': '地铁',
      '火材': '火锅', '买菜药': '买药', '才够': '采购',
    }
    for (var ak in ASR_FIX) {
      if (text.indexOf(ak) >= 0) text = text.replace(ak, ASR_FIX[ak])
    }
    // ---- 长文本断句：按连接词拆成短句，取第一个含金额/数字的短句 ----
    var segments = [text]
    var connectors = /然后|并且|还有|对了|接着|另外/
    if (connectors.test(text)) {
      segments = text.split(connectors).filter(function (s) { return s.trim().length >= 3 })
    }
    text = segments[0]
    for (var si = 1; si < segments.length; si++) {
      if (/\d/.test(text) || /[一二三四五六七八九十百千零两]/.test(text)) break
      text = segments[si]
    }

    // ---- 时间词自动匹配 ----
    var dayOfWeek = now.getDay() // 0=周日, 1=周一, ..., 6=周六
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // "X号" / "X日" 提取（必须在金额提取之前，否则数字被当金额）
    var dayMatch = text.match(/(\d{1,2})\s*[号日]/)
    if (dayMatch) {
      var dayNum = parseInt(dayMatch[1])
      if (dayNum >= 1 && dayNum <= 31) {
        // 默认当月，如果 day 比今天小很多可能指下月，按当月处理
        dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(dayNum).padStart(2, '0')
        text = text.replace(dayMatch[0], '')
      }
    }

    // 星期映射（相对今天的天数偏移）
    var dayOffsets = { '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 0 }
    // 本周/上周/下周 的周一基准偏移
    var thisMondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // 本周一距今天几天

    var weekTimeMap = {}
    // 具体星期：上周一~上周日, 这周一~这周日, 下周一~下周日, 周一~周日
    for (var dow in dayOffsets) {
      // "这周一" → 本周的该天
      weekTimeMap['这' + dow] = thisMondayOffset + (dayOffsets[dow] - 1)
      // "上周一" → 上周的该天
      weekTimeMap['上' + dow] = thisMondayOffset + (dayOffsets[dow] - 1) - 7
      // "下周一" → 下周的该天
      weekTimeMap['下' + dow] = thisMondayOffset + (dayOffsets[dow] - 1) + 7
      // 裸"周一" → 最近的未来该天（含今天）
      var rawDayOffset = dayOffsets[dow]
      var rawOffset = rawDayOffset - dayOfWeek
      if (rawOffset < 0) rawOffset += 7 // 已过则取下周
      weekTimeMap[dow] = rawOffset
    }
    // 周基准
    weekTimeMap['本周'] = thisMondayOffset
    weekTimeMap['这周'] = thisMondayOffset
    weekTimeMap['上周'] = thisMondayOffset - 7
    weekTimeMap['下周'] = thisMondayOffset + 7

    var timeMap = { '今天': 0, '昨天': -1, '前天': -2, '明天': 1, '后天': 2 }
    // 合并，长 key 优先匹配（"上周一"优先于"上周"优先于"周一"）
    var allTimeKeys = Object.keys(weekTimeMap).concat(Object.keys(timeMap))
    allTimeKeys.sort(function(a, b) { return b.length - a.length })

    for (var tki = 0; tki < allTimeKeys.length; tki++) {
      var tk = allTimeKeys[tki]
      if (text.indexOf(tk) >= 0) {
        var offset = weekTimeMap[tk] !== undefined ? weekTimeMap[tk] : timeMap[tk]
        var d = new Date(todayStart)
        d.setDate(d.getDate() + offset)
        dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
        text = text.replace(tk, '')
        break
      }
    }

    // ---- 中文数字转换工具 ----
    var CN_NUM = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'零':0,'两':2,'廿':20,'卅':30,'百':100,'千':1000,'万':10000,'亿':100000000 }
    function cnToInt(s) {
      if (!s) return 0
      if (CN_NUM[s[0]] >= 20) {
        var base = CN_NUM[s[0]]
        return base + (s.length > 1 ? cnToInt(s.slice(1)) : 0)
      }
      var val = 0, seg = 0, lastUnit = 0, sawZero = false
      for (var i = 0; i < s.length; i++) {
        var v = CN_NUM[s[i]]
        if (v === undefined) continue
        if (v >= 10000) {
          val = (val + (seg || (i === 0 ? 1 : 0))) * v
          seg = 0; lastUnit = v; sawZero = false
        } else if (v >= 100) {
          seg = (seg || (i === 0 ? 1 : 0)) * v
          val += seg
          seg = 0; lastUnit = v; sawZero = false
        } else if (v === 10) {
          seg = (seg || (i === 0 ? 1 : 0)) * 10
          lastUnit = 10; sawZero = false
        } else if (v === 0) {
          sawZero = true
        } else {
          seg += v
        }
      }
      // 缩写补全：一百八→180, 三千二→3200（无零时尾数进位）
      if (!sawZero && seg > 0 && seg < 10) {
        if (lastUnit === 100) seg *= 10
        else if (lastUnit === 1000) seg *= 100
      }
      return val + seg
    }

    // ---- 中文日期解析（"五月二十六日" / "5月26号" / "2026年5月26日"） ----
    var cnDatePatterns = [
      /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/,
      /(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/,
      /([一二三四五六七八九十]+)\s*月\s*([一二三四五六七八九十廿卅]+)\s*[日号]?/,
      /([一二三四五六七八九])\s*[月·、]\s*([一二三四五六七八九十廿卅]+)\s*[日号]?/
    ]
    for (var pi = 0; pi < cnDatePatterns.length; pi++) {
      var dm = text.match(cnDatePatterns[pi])
      if (dm) {
        var parsedMonth, parsedDay
        if (pi === 0) {
          var parsedYear = parseInt(dm[1])
          parsedMonth = parseInt(dm[2])
          parsedDay = parseInt(dm[3])
          dateStr = parsedYear + '-' + String(parsedMonth).padStart(2, '0') + '-' + String(parsedDay).padStart(2, '0')
        } else if (pi === 1) {
          parsedMonth = parseInt(dm[1])
          parsedDay = parseInt(dm[2])
        } else {
          parsedMonth = cnToInt(dm[1])
          parsedDay = cnToInt(dm[2])
        }
        if (parsedMonth >= 1 && parsedMonth <= 12 && parsedDay >= 1 && parsedDay <= 31) {
          dateStr = now.getFullYear() + '-' + String(parsedMonth).padStart(2, '0') + '-' + String(parsedDay).padStart(2, '0')
        }
        text = text.replace(dm[0], '')
        break
      }
    }

    // ---- 1. 提取金额（必须） ----
    var amount
    var amountMatch = text.match(/(\d+(?:\.\d{1,2})?)/)
    if (amountMatch) {
      amount = parseFloat(amountMatch[1]).toFixed(2)
      text = text.replace(amountMatch[0], '')
    } else {
      var cnMatch = text.match(/[一二三四五六七八九十百千万零两廿卅]+(?:点[一二三四五六七八九零两]+)?/)
      if (!cnMatch) {
        return { role: 'assistant', text: '请问金额是多少？', time: time }
      }
      var cnStr = cnMatch[0]
      var dotIdx = cnStr.indexOf('点')
      var intPart = dotIdx >= 0 ? cnStr.slice(0, dotIdx) : cnStr
      var fracPart = dotIdx >= 0 ? cnStr.slice(dotIdx + 1) : ''
      amount = cnToInt(intPart)
      if (fracPart) {
        var frac = 0
        for (var fi = 0; fi < fracPart.length; fi++) {
          var fv = CN_NUM[fracPart[fi]]
          if (fv !== undefined) frac = frac * 10 + fv
        }
        amount += frac / Math.pow(10, fracPart.length)
      }
      // 口语小数："十五块五" = 15.5, "三块二" = 3.2
      var cnMatchEnd = cnMatch.index + cnStr.length
      var afterAmount = text.substring(cnMatchEnd)
      var jiaoMatch = afterAmount.match(/^[块元]([一二三四五六七八九])(?!\d|[一二三四五六七八九十百千])/)
      if (jiaoMatch) {
        amount += CN_NUM[jiaoMatch[1]] / 10
        text = text.substring(0, cnMatchEnd) + afterAmount.substring(jiaoMatch[0].length)
      }
      amount = amount.toFixed(2)
      text = text.replace(cnMatch[0], '')
    }

    // ---- 2. 收支词（缺省=支出） ----
    var incomeKeys = ['收到', '收入', '赚了', '捡了', '发了', '转入', '报销', '退款', '到账', '转账', '酬劳', '补贴', '津贴', '工资', '薪资', '奖金']
    var isIncome = false
    for (var ii = 0; ii < incomeKeys.length; ii++) {
      if (text.indexOf(incomeKeys[ii]) >= 0) { isIncome = true; break }
    }
    if (!isIncome && /发了|收了|报销|到账/.test(text)) isIncome = true
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
    // "去公司/到公司" 是目的地而非付款方 → 个人
    if (isCompany && /[去到]公司/.test(text) && !/公司[买报销聚餐付花发转交缴]/.test(text)) {
      isCompany = false
    }

    // ---- 4. 外部主体识别（借给/垫付/代付/还款，须在分类匹配前） ----
    var externalSubject = ''
    var note = ''
    var extPatterns = [
      /借给(.+)/, /垫付(.+)/, /代付(.+)/, /还给(.+)/, /收到(.+)还款/
    ]
    for (var ei = 0; ei < extPatterns.length; ei++) {
      var em = text.match(extPatterns[ei])
      if (em) {
        externalSubject = em[1].replace(/[元块毛个了]$/, '').trim()
        if (!note) note = em[0].replace(/元|块/g, '')
        break
      }
    }

    var verbText = text  // 保存分类前文本，用于动词提取

    // ---- 5. 分类词 → 预设分类 ----
    var catList = [
      { keys: ['咖啡', '奶茶', '柠檬茶', '可乐', '饮料', '牛奶', '豆浆', '果汁', '奶昔'], cat: '饮品' },
      { keys: ['红包', '借款', '借给', '垫付', '代付', '代购', '代垫', '垫资', '还给', '欠款', '应付'], cat: '人情' },
      { keys: ['午餐', '晚餐', '早餐', '外卖', '吃饭', '聚餐', '火锅', '烧烤', '米粉', '面条','面','饺子','水饺','盒饭','快餐','麻辣烫','麻辣拌','米线','盖饭','盖浇饭','小吃','买菜','菜','榴莲','夜宵','宵夜'], cat: '餐饮' },
      { keys: ['打车', '滴滴', '出租', '地铁', '公交', '加油', '高铁', '火车票', '机票', '停车', '高铁票', '火车','差旅费','交通费','打的','报销'], cat: '交通' },
      { keys: ['水果', '零食', '西瓜', '榴莲', '水果篮', '超市', '购物券','采购','超市采购','礼物','口红','化妆品'], cat: '购物' },
      { keys: ['话费', '充值', '流量', '宽带'], cat: '通讯' },
      { keys: ['感冒药', '药品', '药', '医院', '诊所', '口罩', '体温计','买药'], cat: '医疗' },
      { keys: ['房租', '租房', '房贷', '物业', '水电费','电费','水费','煤气'], cat: '住房' },
      { keys: ['工资', '薪资', '奖金'], cat: '工资' },
      { keys: ['打印纸', '办公用品', '快递费', '快递', '文具','墨盒','硒鼓'], cat: '办公' },
      { keys: ['信用卡还款', '还信用卡', '还款'], cat: '金融' },
      { keys: ['衣服', '裤子', '鞋子', '袜子', '帽子'], cat: '服饰' },
      { keys: ['电影', 'KTV', '唱歌', '旅游', '酒店', '门票'], cat: '娱乐' }
    ]
    var category = ''
    for (var ci3 = 0; ci3 < catList.length; ci3++) {
      for (var ki = 0; ki < catList[ci3].keys.length; ki++) {
        var kw = catList[ci3].keys[ki]
        var idx = text.indexOf(kw)
        if (idx >= 0) {
          category = catList[ci3].cat
          note = kw
          text = text.substring(0, idx) + text.substring(idx + kw.length)
          break
        }
      }
      if (category) break
    }

    // 清理外部主体中残留的分类关键词（如 "同事聚餐" → "同事"）
    if (externalSubject && note) {
      externalSubject = externalSubject.replace(note, '').trim()
    }
    // 进一步剥除 externalSubject 中可能混入的其他分类关键词
    if (externalSubject) {
      var allCatKeys = []
      for (var ai = 0; ai < catList.length; ai++) {
        allCatKeys = allCatKeys.concat(catList[ai].keys)
      }
      for (var aki = 0; aki < allCatKeys.length; aki++) {
        if (allCatKeys[aki].length >= 2) {
          externalSubject = externalSubject.replace(allCatKeys[aki], '')
        }
      }
      externalSubject = externalSubject.trim()
    }

    // ---- 6. 剩余文本清洗 → 最终备注 ----
    var noiseWords = ['我妈', '我爸', '我', '了个', '给我', '一下', '去了', '然后', '并且', '还有', '对了', '另外', '接着', '再', '今天', '昨天', '明天', '的', '了', '去', '和', '个', '块', '毛', '元', '支出', '收入',
      '中午', '上午', '下午', '晚上', '早上',
      '上周一', '上周二', '上周三', '上周四', '上周五', '上周六', '上周日',
      '这周一', '这周二', '这周三', '这周四', '这周五', '这周六', '这周日',
      '下周一', '下周二', '下周三', '下周四', '下周五', '下周六', '下周日',
      '周一', '周二', '周三', '周四', '周五', '周六', '周日',
      '上周', '这周', '下周', '本周', '宴',
      '在', '到', '从', '这', '那', '月']
    var cleanText = text
    // 先清动词（多字优先），再清噪声词，避免 "了" 先拆散 "花了"
    cleanText = cleanText.replace(/(记一笔|记|买了|买了点|买|吃了碗|吃了|吃|喝了杯|喝了|喝|花了|付了|付|充了|充|打了辆|打了|打|发了|发|收了|收|还了|还给|还|报销|给了|给|转了|转|请了|看了|交了|交|看|请|缴了|缴|充值|借给|垫付|代付|还给|打车|买菜)/g, '')
    cleanText = cleanText.replace(/^[一二三四五六七八九十]/, '').replace(/[一二三四五六七八九十]$/, '')
    for (var ni = 0; ni < noiseWords.length; ni++) {
      cleanText = cleanText.split(noiseWords[ni]).join('')
    }
    cleanText = cleanText.trim()

    if (!note && cleanText) note = cleanText
    if (note && cleanText && cleanText !== note && cleanText !== '公司' && cleanText !== '个人') note = cleanText || note
    if (!category) category = '其他'

    // ---- 动词提取 ----
    var verb = '-'
    var verbList = ['买了点', '吃了碗', '喝了杯', '打了辆', '发了封', '收了笔',
                    '买了', '吃了', '喝了', '付了', '花了', '充了', '打了', '发了', '收了', '给了', '转了', '交了', '缴了', '还了', '扣了', '扣除了',
                    '充值', '报销', '到账', '记一笔',
                    '借给', '垫付', '代付', '还给', '打车', '买菜', '扣除',
                    '买', '吃', '喝', '付', '花', '充', '打', '发', '收', '给', '转', '交', '缴', '还', '扣']
    for (var vi = 0; vi < verbList.length; vi++) {
      if (verbText.indexOf(verbList[vi]) >= 0) { verb = verbList[vi]; break }
    }

    // ---- 7. 组装返回 ----
    var catIdx = this.data.catOptions.indexOf(category)
    if (catIdx < 0) catIdx = this.data.catOptions.length - 1
    var typeLabel = isIncome ? '收入' : '支出'
    var typeIdx = this._typeIdxFromLabel(typeLabel)
    var typeKey = this.data._typeLabelToKey[typeLabel] || 'expense'
    var td = this._getBookTargetDefaults(isCompany ? 'company' : 'personal', typeKey)
    var targetIdx = td.target ? this.data.targetOptions.indexOf(td.target) : 2
    if (targetIdx < 0) targetIdx = 2

    // 测试期：收集语音输入原始日志到学习库
    var parsed = {
      amount: amount, category: category, typeLabel: typeLabel,
      scope: isCompany ? 'company' : 'personal', note: note || input.trim(),
      verb: verb, externalSubject: externalSubject
    }
    api.voiceLog(input.trim(), parsed)

    // 保存原始解析字段（用于后续字段级纠错比对）
    var originalCard = {
      category: category,
      amount: amount,
      typeLabel: typeLabel,
      type: isIncome ? 'in' : 'out',
      date: dateStr,
      note: note || input.trim(),
      scope: isCompany ? 'company' : 'personal',
      target: td.target,
      targetType: td.targetType
    }

    return {
      role: 'assistant',
      text: '请确认以下记账信息：',
      fields: {
        verb: verb,
        measure: '元',
        subject: externalSubject || (isCompany ? '公司' : '个人'),
        project: note || input.trim(),
        category: category,
        amount: amount,
        direction: typeLabel
      },
      card: {
        category: category,
        amount: amount,
        typeLabel: typeLabel,
        type: isIncome ? 'in' : 'out',
        date: dateStr,
        note: note || input.trim(),
        scope: isCompany ? 'company' : 'personal',
        target: td.target,
        targetType: td.targetType
      },
      _originalCard: originalCard,
      confirmed: undefined,
      _catIdx: catIdx,
      _typeIdx: typeIdx,
      _targetIdx: targetIdx,
      time: time
    }
  },

  _saveAiRecord(reply) {
    if (!reply.card) return
    var c = reply.card
    var scope = c.scope || this.data.bookScope || 'personal'
    var typeIsIn = c.typeLabel === '收入'
    var newItem = {
      id: api.generateId(),
      category: c.category,
      type: typeIsIn ? 'in' : 'out',
      typeLabel: c.typeLabel,
      scope: scope,
      amount: c.amount,
      date: c.date,
      note: c.note || '',
      target: c.target || '',
      targetType: c.targetType || 'external',
    }
    api.addItem(scope, newItem)
    // 学习模块挂钩（正式版可移除）
    // [已注释] learn.js 不存在，暂时禁用
// try { require('../../utils/learn.js').learnFromItem(newItem) } catch (_) {}
    reply.card.itemId = newItem.id
    var _savedItems = this._buildDetailList(scope, api.getItems(scope))
    this.setData({ detailItems: _savedItems, detailGroups: this._buildDetailGroups(_savedItems) })
    this._calcOverviewData()
  },


	  onAiConfirm(e) {
    playTap()
	    const idx = e.currentTarget.dataset.idx
	    const reply = this.data.chatMessages[idx]
	    if (!reply || !reply.card) return
	    // 用户编辑了卡片字段 → 提取字段级纠错
	    this._uploadFieldCorrections(reply)
	    this._saveAiRecord(reply)
	    reply.confirmed = true
	    const updated = this.data.chatMessages.slice()
	    updated[idx] = reply
	    this.setData({ chatMessages: updated })
	  },

	  // 字段级纠错：比较 AI 原始解析 vs 用户编辑后的卡片字段
	  _uploadFieldCorrections(reply) {
	    var card = reply.card
	    var orig = reply._originalCard
	    if (!card || !orig) return
	    var rawText = ''
	    for (var i = this.data.chatMessages.length - 1; i >= 0; i--) {
	      if (this.data.chatMessages[i].role === 'user') {
	        rawText = this.data.chatMessages[i].text || ''
	        break
	      }
	    }
	    if (!rawText) return
	    var corrections = []
	    var fields = ['amount', 'date', 'category', 'typeLabel', 'note', 'target']
	    for (var fi = 0; fi < fields.length; fi++) {
	      var f = fields[fi]
	      var oldVal = orig[f] != null ? String(orig[f]) : ''
	      var newVal = card[f] != null ? String(card[f]) : ''
	      if (oldVal !== newVal && newVal !== '') {
	        corrections.push({ field: f, wrong: oldVal, correct: newVal, rawText: rawText })
	      }
	    }
	    if (corrections.length > 0) {
	      for (var ci = 0; ci < corrections.length; ci++) {
	        var c = corrections[ci]
	        api.voiceLog(rawText, {
	          rawText: rawText,
	          original: orig,
	          corrected: card,
	          correction: { field: c.field, wrong: c.wrong, correct: c.correct }
	        })
	      }
	      api.publicAddFieldCorrections(corrections)
	      console.log('[CORRECT] 字段级纠错 ' + corrections.length + ' 条:', corrections)
	    }
	  },

	  onChatReject(e) {
    playTap()
	    const idx = e.currentTarget.dataset.idx
	    const reply = this.data.chatMessages[idx]
	    if (!reply) return
	    reply.confirmed = false
	    const updated = this.data.chatMessages.slice()
	    updated[idx] = reply
	    updated.push({
	      role: 'assistant',
	      text: '识别有误？换个说法再试一次吧',
	      time: this._formatChatTime(new Date())
	    })
	    const lastIdx = updated.length - 1
	    this.setData({
	      chatMessages: updated,
	      chatScrollTop: 999999 + lastIdx
	    })
	  },

  // ---- 纠正模式 ----
  onChatCorrect(e) {
    playTap()
    const idx = e.currentTarget.dataset.idx
    const reply = this.data.chatMessages[idx]
    if (!reply || !reply.card) return
    const updated = this.data.chatMessages.slice()
    updated[idx] = Object.assign({}, updated[idx], {
      correcting: true,
      correctText: ''
    })
    this.setData({ chatMessages: updated })
  },

  onCorrectTextInput(e) {
    const idx = e.currentTarget.dataset.idx
    const updated = this.data.chatMessages.slice()
    updated[idx] = Object.assign({}, updated[idx], {
      correctText: e.detail.value
    })
    this.setData({ chatMessages: updated })
  },

  onCorrectCancel(e) {
    playTap()
    const idx = e.currentTarget.dataset.idx
    const updated = this.data.chatMessages.slice()
    updated[idx] = Object.assign({}, updated[idx], {
      correcting: false,
      correctText: ''
    })
    this.setData({ chatMessages: updated })
  },

  // ---- 语音卡片四字段编辑 ----
  onAiCardCatChange(e) {
    playTap()
    const idx = e.currentTarget.dataset.idx
    const selIdx = parseInt(e.detail.value)
    const cat = this.data.catOptions[selIdx]
    const updated = this.data.chatMessages.slice()
    if (updated[idx] && updated[idx].card) {
      updated[idx].card.category = cat
      updated[idx]._catIdx = selIdx
      this.setData({ chatMessages: updated })
    }
  },

  onAiCardTypeChange(e) {
    playTap()
    const idx = e.currentTarget.dataset.idx
    const selIdx = parseInt(e.detail.value)
    const label = this.data.typeOptions[selIdx]
    var cssTypeMap = { '支出': 'out', '收入': 'in', '垫付': 'payForward', '应付': 'payable' }
    const updated = this.data.chatMessages.slice()
    if (updated[idx] && updated[idx].card) {
      updated[idx].card.typeLabel = label
      updated[idx].card.type = cssTypeMap[label] || 'out'
      updated[idx]._typeIdx = selIdx
      // 类型变更后重算默认对象
      var scope = updated[idx].card.scope || 'personal'
      var typeKey = this.data._typeLabelToKey[label] || 'expense'
      var td = this._getBookTargetDefaults(scope, typeKey)
      var targetIdx = td.target ? this.data.targetOptions.indexOf(td.target) : 2
      if (targetIdx < 0) targetIdx = 2
      updated[idx].card.target = td.target
      updated[idx].card.targetType = td.targetType
      updated[idx]._targetIdx = targetIdx
      this.setData({ chatMessages: updated })
    }
  },

  onAiCardTargetChange(e) {
    playTap()
    const idx = e.currentTarget.dataset.idx
    const selIdx = parseInt(e.detail.value)
    const label = this.data.targetOptions[selIdx]
    const updated = this.data.chatMessages.slice()
    if (updated[idx] && updated[idx].card) {
      var isInternal = label === '公司' || label === '个人'
      updated[idx].card.target = isInternal ? label : ''
      updated[idx].card.targetType = isInternal ? 'internal' : 'external'
      updated[idx]._targetIdx = selIdx
      this.setData({ chatMessages: updated })
    }
  },

  onAiCardAmountInput(e) {
    const idx = e.currentTarget.dataset.idx
    const val = e.detail.value
    const updated = this.data.chatMessages.slice()
    if (updated[idx] && updated[idx].card) {
      updated[idx].card.amount = val
      this.setData({ chatMessages: updated })
    }
  },
  onAiCardDateChange(e) {
    playTap()
    const idx = e.currentTarget.dataset.idx
    const val = e.detail.value
    const updated = this.data.chatMessages.slice()
    if (updated[idx] && updated[idx].card) {
      updated[idx].card.date = val
      this.setData({ chatMessages: updated })
    }
  },
  onChatCardNoteInput(e) {
    const idx = e.currentTarget.dataset.idx
    const val = e.detail.value
    const updated = this.data.chatMessages.slice()
    if (updated[idx] && updated[idx].card) {
      updated[idx].card.note = val
      this.setData({ chatMessages: updated })
    }
  },

  _formatChatTime(d) {
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  },

  onChatToggleMode() {
    playTap()
    this.setData({ chatVoiceMode: !this.data.chatVoiceMode })
  },

  onAiVoiceStart() {
    playTap()
    wx.vibrateShort({ type: 'light' })
    this._startRecognize('chat')
  },

  onAiVoiceEnd() {
    if (!this.data.chatRecording) return
    this._stopRecognize() // 结果在 onStop → _onRecognizeDone('chat')：填输入框并发送
  },

  // ---- 分类选择器 ----

  /** 同步用户自定义分类到 AI 选择器的 catOptions */
  _syncChatCatOptions() {
    var defaults = ['餐饮', '交通', '购物', '饮品', '人情', '通讯', '医疗', '住房', '工资', '办公', '金融', '服饰', '娱乐', '数码', '其他']
    try {
      var cats = require('../../utils/api.js').getCategories('personal') || []
      if (cats && cats.length) {
        var names = cats.map(function (c) { return c.name }).filter(Boolean)
        // 合并去重：用户自定义在前，默认兜底在后
        var merged = names.slice()
        for (var i = 0; i < defaults.length; i++) {
          if (merged.indexOf(defaults[i]) < 0) merged.push(defaults[i])
        }
        this.setData({ catOptions: merged })
      }
    } catch (_) {}
  },

  // ---- VIP 升级 ----
  _computeTrialDays: function (status) {
    if (!status || !status.vipLevel || !status.vipExpiresAt) return 0
    var days = Math.ceil((new Date(status.vipExpiresAt) - new Date()) / 86400000)
    return days > 0 ? days : 0
  },

  _formatVipExpiry: function (status) {
    if (!status || !status.vipExpiresAt) return '永久有效'
    var s = status.vipExpiresAt
    if (typeof s === 'string' && s.length >= 10) return s.slice(0, 10) + ' 到期'
    return '永久有效'
  },

  _typeIdxFromLabel: function (label) {
    var idx = this.data.typeOptions.indexOf(label)
    return idx >= 0 ? idx : 0
  },

  }
}

module.exports = createMethods
