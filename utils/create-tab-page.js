function createTabPage(selected) {
  return {
    onShow() {
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().setData({ selected })
      }
    },
  }
}

module.exports = createTabPage
