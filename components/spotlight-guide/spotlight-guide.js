// 聚光引导组件：四段拼接遮罩 + 气泡提示
Component({
  properties: {
    visible: { type: Boolean, value: false },
    stepConfig: { type: Object, value: {} },
    targetRect: { type: Object, value: null },
    totalSteps: { type: Number, value: 1 },
    currentStep: { type: Number, value: 0 },
  },

  data: {
    maskReady: false,
    showWelcome: false,
    holeShape: 'rect',
    bubbleTitle: '',
    bubbleDesc: '',
    stepText: '',
    showNext: true,
    showSkip: true,
    nextText: '下一步',
    bubblePos: 'bottom',
    mask: { top: 0, left: 0, holeW: 0, holeH: 0 },
    bubbleStyle: { top: 0, left: 0 },
    cornerSize: 0,
  },

  observers: {
    'visible, stepConfig, targetRect'(visible, stepConfig, targetRect) {
      if (!visible) {
        this.setData({ maskReady: false })
        return
      }
      const cfg = stepConfig || {}
      if (cfg.type === 'welcome') {
        this.setData({ maskReady: true, showWelcome: true })
        return
      }
      this.setData({ showWelcome: false })
      if (!targetRect || !targetRect.width) {
        // 等待页面侧计算出 targetRect，不 fallback 到欢迎页
        return
      }
      this.setData({ maskReady: true })
      this._render(cfg, targetRect)
    },
  },

  methods: {
    _render(cfg, rect) {
      const sysInfo = wx.getWindowInfo()
      const sw = sysInfo.windowWidth
      const sh = sysInfo.windowHeight
      const pad = cfg.holePadding != null ? cfg.holePadding : 12

      const holeLeft = Math.max(0, rect.left - pad)
      const holeTop = Math.max(0, rect.top - pad)
      const holeW = Math.min(sw - holeLeft, rect.width + pad * 2)
      const holeH = Math.min(sh - holeTop, rect.height + pad * 2)

      const holeShape = cfg.holeShape || 'rect'

      // 气泡宽度：480rpx → px，左右各留 20rpx 安全边距
      const bubbleW = Math.round(sw * 480 / 750)
      const margin = Math.round(sw * 20 / 750)
      const gap = Math.round(sw * 16 / 750)

      // 气泡水平居中于屏幕
      const bx = (sw - bubbleW) / 2

      // 垂直定位：默认放目标下方，空间不够放上方，都不够贴底
      const estBubbleH = Math.min(Math.round(sh * 0.4), 200)
      let bubblePos = 'bottom'
      let by = holeTop + holeH + gap

      if (by + estBubbleH > sh - margin) {
        if (holeTop - estBubbleH - gap > margin) {
          bubblePos = 'top'
          by = holeTop - estBubbleH - gap
        } else {
          by = Math.max(margin, sh - estBubbleH - margin)
        }
      }

      const stepText = cfg.showStep ? `${(this.data.currentStep || 0) + 1} / ${this.data.totalSteps || 1}` : ''

      // 圆形 hole 的四角填充块尺寸（~22% 的 hole 尺寸，填掉矩形方角）
      const cornerSize = holeShape === 'circle' ? Math.round(Math.min(holeW, holeH) * 0.24) : 0

      this.setData({
        maskReady: true,
        holeShape,
        bubbleTitle: cfg.bubbleTitle || '',
        bubbleDesc: cfg.bubbleDesc || '',
        stepText,
        showNext: cfg.showNext !== false,
        showSkip: cfg.showSkip !== false,
        nextText: cfg.nextText || '下一步',
        bubblePos,
        mask: { top: holeTop, left: holeLeft, holeW, holeH },
        bubbleStyle: { top: by, left: bx },
        cornerSize,
      })
    },

    onNextTap() {
      this.triggerEvent('next')
    },

    onSkipTap() {
      this.triggerEvent('skip')
    },

    onWelcomeNext() {
      this.triggerEvent('welcomenext')
    },
  },
})
