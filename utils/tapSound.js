var _pool = []
var _poolIdx = 0
var _poolSize = 4
var _volume = wx.getStorageSync('tapVolume')
if (_volume == null || _volume === '') _volume = 1

function _getVibrationLevel() {
  var raw = wx.getStorageSync('tapVibration')
  if (raw === '' || raw === undefined || raw === null) return 1
  var n = parseInt(raw)
  return isNaN(n) ? 1 : n
}

function _getPlayer() {
  for (var i = 0; i < _pool.length; i++) {
    var p = _pool[i]
    if (!p._busy) { p._busy = true; return p }
  }
  if (_pool.length < _poolSize) {
    var ctx = wx.createInnerAudioContext()
    ctx.src = '/assets/click.wav'
    ctx.volume = _volume
    ctx.obeyMuteSwitch = false
    ctx.onEnded(function () { ctx._busy = false })
    ctx.onStop(function () { ctx._busy = false })
    ctx.onError(function () { ctx._busy = false })
    ctx._busy = true
    _pool.push(ctx)
    return ctx
  }
  _poolIdx = (_poolIdx + 1) % _poolSize
  var old = _pool[_poolIdx]
  old.stop()
  old._busy = true
  return old
}

var _preload = _getPlayer()
_preload._busy = false

// 超短间隔连点序列：gap 压到 18-20ms，触觉上融合成单次长震动（人触觉分辨阈值 ~30ms）
function _vibeSeq(count, gapMs) {
  var i = 0
  function next() {
    try { wx.vibrateShort({ type: 'heavy' }) } catch (_) {}
    i++
    if (i < count) setTimeout(next, gapMs)
  }
  next()
}

function playTap() {
  var level = _getVibrationLevel()

  if (level === 1) {
    // ~50ms: 2 taps × 20ms gap
    _vibeSeq(2, 20)
  } else if (level === 2) {
    // ~150ms: 5 taps × 18ms gap
    _vibeSeq(5, 18)
  } else if (level === 3) {
    // ~200ms: 6 taps × 20ms gap
    _vibeSeq(6, 20)
  } else if (level >= 4) {
    // ~300ms: 10 taps × 18ms gap
    _vibeSeq(10, 18)
  }

  var ctx = _getPlayer()
  ctx.seek(0)
  ctx.play()
}

function setVolume(v) {
  _volume = Math.max(0, Math.min(1, v))
  wx.setStorageSync('tapVolume', _volume)
  for (var i = 0; i < _pool.length; i++) {
    _pool[i].volume = _volume
  }
}

function getVolume() {
  return _volume
}

module.exports = { playTap, setVolume, getVolume }
