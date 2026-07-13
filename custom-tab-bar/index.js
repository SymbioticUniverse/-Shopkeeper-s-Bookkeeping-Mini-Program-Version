const { playTap } = require('../../utils/tapSound')

Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/mingxi/mingxi', text: '明细', icon: '/assets/icons/mingxi.png' },
      { pagePath: '/pages/baobiao/baobiao', text: '报表', icon: '/assets/icons/baobiao.png' },
      { pagePath: '/pages/jizhang/jizhang', text: '记账', icon: '/assets/icons/jizhang.png' },
      { pagePath: '/pages/jieqing/jieqing', text: '结清', icon: '/assets/icons/jieqing.png' },
      { pagePath: '/pages/wode/wode', text: '我的', icon: '/assets/icons/wode.png' },
    ],
  },
  methods: {
    switchTab(e) {
      playTap()
      const data = e.currentTarget.dataset
      const url = data.path
      const index = parseInt(data.index)
      // 记账 tab：触发页面记账弹窗，不跳转
      if (index === 2 && this._bookTapHandler) {
        this._bookTapHandler()
        return
      }
      // 先切选中态再跳转，减少视觉延迟
      if (this.data.selected !== index) {
        this.setData({ selected: index })
      }
      wx.switchTab({ url })
    },
  },
})
