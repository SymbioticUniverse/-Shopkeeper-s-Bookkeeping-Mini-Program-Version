// ==================== 企业加密辅助函数 ====================

function _encryptWithMasterKey(crypto, plainHex) {
  var masterKey = crypto.exportMasterKey()
  if (!masterKey) throw new Error('无主密钥')
  var noble = require('../../../vendor/noble-ciphers.js')
  var keyBytes = _hexToBytesLocal(masterKey)
  var iv = noble.randomBytes(12)
  var allZero = true
  for (var z = 0; z < iv.length; z++) {
    if (iv[z] !== 0) { allZero = false; break }
  }
  if (allZero) throw new Error('安全随机数生成失败')
  var cipher = noble.gcm(keyBytes, iv)
  var plainBytes = _hexToBytesLocal(plainHex)
  var encrypted = cipher.encrypt(plainBytes)
  var combined = new Uint8Array(12 + encrypted.length)
  combined.set(iv, 0)
  combined.set(encrypted, 12)
  return _toBase64Local(combined)
}

function _decryptWithMasterKey(crypto, base64Cipher) {
  var masterKey = crypto.exportMasterKey()
  if (!masterKey) throw new Error('无主密钥')
  var noble = require('../../../vendor/noble-ciphers.js')
  var combined = _fromBase64Local(base64Cipher)
  var iv = combined.slice(0, 12)
  var encrypted = combined.slice(12)
  var keyBytes = _hexToBytesLocal(masterKey)
  var decipher = noble.gcm(keyBytes, iv)
  var decrypted = decipher.decrypt(encrypted)
  return _bytesToHexLocal(decrypted)
}

function _hexToBytesLocal(hex) {
  var bytes = new Uint8Array(hex.length / 2)
  for (var i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

function _bytesToHexLocal(bytes) {
  var hex = ''
  for (var i = 0; i < bytes.length; i++) {
    hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16)
  }
  return hex
}

function _toBase64Local(uint8) {
  if (typeof wx !== 'undefined' && wx.arrayBufferToBase64) {
    return wx.arrayBufferToBase64(uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength))
  }
  var binary = ''
  for (var i = 0; i < uint8.length; i++) { binary += String.fromCharCode(uint8[i]) }
  if (typeof btoa !== 'undefined') return btoa(binary)
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  var result = ''
  for (var j = 0; j < uint8.length; j += 3) {
    var a = uint8[j], b = uint8[j + 1] || 0, c = uint8[j + 2] || 0
    result += chars[a >> 2]
    result += chars[((a & 3) << 4) | (b >> 4)]
    result += j + 1 < uint8.length ? chars[((b & 15) << 2) | (c >> 6)] : '='
    result += j + 2 < uint8.length ? chars[c & 63] : '='
  }
  return result
}

function _fromBase64Local(b64) {
  if (typeof wx !== 'undefined' && wx.base64ToArrayBuffer) {
    return new Uint8Array(wx.base64ToArrayBuffer(b64))
  }
  if (typeof atob !== 'undefined') {
    var bin = atob(b64)
    var bytes = new Uint8Array(bin.length)
    for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i) }
    return bytes
  }
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  var out = []
  var pad = 0
  for (var i = 0; i < b64.length; i++) {
    if (b64[i] === '=') { pad++; continue }
    out.push(chars.indexOf(b64[i]))
  }
  var len = (out.length * 3 / 4) | 0
  var result = new Uint8Array(len)
  var p = 0
  for (var j = 0; j < out.length; j += 4) {
    result[p++] = (out[j] << 2) | (out[j + 1] >> 4)
    if (p < len) result[p++] = ((out[j + 1] & 15) << 4) | (out[j + 2] >> 2)
    if (p < len) result[p++] = ((out[j + 2] & 3) << 6) | out[j + 3]
  }
  return result
}

module.exports = {
  _encryptWithMasterKey,
  _decryptWithMasterKey,
}
