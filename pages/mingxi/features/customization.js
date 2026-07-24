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
  onCatTabChange(e) {
    playTap()
    const { scope, tab } = e.currentTarget.dataset
    if (scope === 'personal') {
      this.setData({ catTabPersonal: tab })
    } else {
      this.setData({ catTabCompany: tab })
    }
  },

  onAddCategory(e) {
    playTap()
    const { scope } = e.currentTarget.dataset
    this.setData({
      showCatModal: true,
      catModalScope: scope,
      catModalName: '',
      catModalEmoji: '📌',
    })
  },

  onCatModalClose() {
    playTap()
    this.setData({ showCatModal: false })
  },

  onCatModalNameInput(e) {
    this.setData({ catModalName: e.detail.value })
  },

  onCatModalPickEmoji(e) {
    playTap()
    this.setData({ catModalEmoji: e.currentTarget.dataset.emoji })
  },

  onCatModalConfirm() {
    playTap()
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
    playTap()
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
    playTap()
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
    playTap()
    api.saveOverviewCards(this.data.customCards)
    this.setData({ showCustomOverview: false, showOverview: false, currentTab: 4 })
  },

  onAddCustomCard(e) {
    playTap()
    const templateId = e.currentTarget.dataset.id
    const template = this.data.customTemplates.find(t => t.id === templateId)
    if (!template) return
    const rowH = (this._grid && this._grid.rowHeight) || 120
    const colW = (this._grid && this._grid.colWidth) || 100
    const cards = this.data.customCards
    // 计算新卡片位置：放在已有卡片下方
    const maxY = cards.reduce((m, c) => Math.max(m, (c.y || 0) + rowH), 0)
    const newCard = {
      id: `c_${api.generateId()}`,
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
    playTap()
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
        id: `c_${api.generateId()}`,
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
    playTap()
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
    playTap()
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
    playTap()
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
        const newId = `c_${api.generateId()}`
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
    playTap()
    this.setData({
      showPopup: false,
      ghostDrag: { visible: false, x: 0, y: 0, templateId: '', name: '', slotHover: -1, template: null },
    })
  },

  // ---- 登录/注册 ----
  }
}

module.exports = createMethods
