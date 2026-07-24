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
  onVipEntry() {
    playTap()
    var that = this
    api.getVipStatus().then(function (status) {
      var isFree = !status || status.vipLevel === 0
      var trialDays = that._computeTrialDays(status)
      var offerDays = Math.ceil((new Date('2026-09-25T23:59:59+08:00') - new Date()) / 86400000)
      if (offerDays < 0) offerDays = 0
      that.setData({ showVipPage: true, vipDetailId: -1, vipSelected: -1, vipEnterpriseSeats: 4, vipStatus: status, showTrialBanner: isFree, vipTrialDays: trialDays, trialOfferDays: offerDays, vipExpiresText: that._formatVipExpiry(status) })
    }).catch(function () {
      var offerDays = Math.ceil((new Date('2026-09-25T23:59:59+08:00') - new Date()) / 86400000)
      if (offerDays < 0) offerDays = 0
      that.setData({ showVipPage: true, vipDetailId: -1, vipSelected: -1, vipEnterpriseSeats: 4, showTrialBanner: true, vipTrialDays: 0, trialOfferDays: offerDays })
    })
  },

  onActivateTrial() {
    playTap()
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
            that.setData({ vipStatus: status, showTrialBanner: false, vipTrialDays: that._computeTrialDays(status), vipExpiresText: that._formatVipExpiry(status) })
            that._checkEncryptionTierAlignment()
          }).catch(function () {})
        }).catch(function (err) {
          wx.hideLoading()
          wx.showToast({ title: (err && err.error) || '领取失败', icon: 'none' })
        })
      }
    })
  },

  onVipBack() {
    playTap()
    if (this.data.vipDetailId >= 0) {
      this.setData({ vipDetailId: -1, vipSelected: -1, vipEnterpriseSeats: 4 })
    } else {
      this.setData({ showVipPage: false, vipDetailId: -1, vipSelected: -1, vipEnterpriseSeats: 4 })
    }
  },

  onVipThumbTap(e) {
    playTap()
    const id = e.currentTarget.dataset.id
    this.setData({ vipDetailId: id, vipSelected: id, vipEnterpriseSeats: 4 })
  },

  onVipSelect(e) {
    playTap()
    const id = e.currentTarget.dataset.id
    this.setData({ vipSelected: this.data.vipSelected === id ? -1 : id })
  },

  // 企业版席位调节
  onVipSeatsMinus() {
    playTap()
    var s = this.data.vipEnterpriseSeats
    if (s <= 4) return
    this.setData({ vipEnterpriseSeats: s - 1 })
  },
  onVipSeatsPlus() {
    playTap()
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
    playTap()
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
              that.setData({ showVipPage: false, vipDetailId: -1, vipSelected: -1, vipEnterpriseSeats: 4, vipStatus: s, vipTrialDays: that._computeTrialDays(s), vipExpiresText: that._formatVipExpiry(s) })
              that._checkEncryptionTierAlignment()
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
  }
}

module.exports = createMethods
