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
      const data = e.currentTarget.dataset
      const url = data.path
      wx.switchTab({ url })
    },
  },
})
