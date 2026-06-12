Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/mingxi/mingxi', text: '明细' },
      { pagePath: '/pages/baobiao/baobiao', text: '报表' },
      { pagePath: '/pages/jizhang/jizhang', text: '记账' },
      { pagePath: '/pages/jieqing/jieqing', text: '结清' },
      { pagePath: '/pages/wode/wode', text: '我的' },
    ],
  },
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset
      const url = data.path
      wx.switchTab({ url })
    },
  },
})
