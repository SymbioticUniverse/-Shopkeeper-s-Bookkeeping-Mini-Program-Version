const { playTap } = require('../../utils/tapSound')
const { createTabItems } = require('../../utils/tab-navigation')

Component({
  data: {
    selected: 0,
    list: createTabItems(),
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
