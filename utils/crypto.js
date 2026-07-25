/**
 * 数据加密核心模块
 *
 * 个人用户：明文传输存储（HTTPS）
 * 企业用户（VIP）：ECIES 端到端加密（secp256k1 + AES-256-GCM）
 * CSPRNG：纯 JS HMAC-DRBG，零微信 API 依赖
 */

// WeChat 某些版本实现了 setBigUint64，但只接受 BigInt；noble 传入 Number。
if (typeof DataView !== 'undefined') {
  var _nativeSetBigUint64 = typeof DataView.prototype.setBigUint64 === 'function'
    ? DataView.prototype.setBigUint64
    : null
  DataView.prototype.setBigUint64 = function (byteOffset, value, littleEndian) {
    if (_nativeSetBigUint64 && typeof BigInt === 'function') {
      return _nativeSetBigUint64.call(
        this, byteOffset,
        typeof value === 'bigint' ? value : BigInt(value),
        littleEndian
      )
    }
    var numeric = Number(value)
    var high = Math.floor(numeric / 0x100000000)
    var low = numeric >>> 0
    if (littleEndian) {
      this.setUint32(byteOffset, low, true)
      this.setUint32(byteOffset + 4, high, true)
    } else {
      this.setUint32(byteOffset, high, false)
      this.setUint32(byteOffset + 4, low, false)
    }
  }
}

var noble = require('../vendor/noble-ciphers.js')

// ECC 加密库（懒加载，仅企业加密时使用）
var _ecc = null
function _getEcc() {
  if (_ecc === null) {
    try { _ecc = require('../vendor/noble-ecc.js') } catch (e) { _ecc = false }
  }
  return _ecc || null
}

// 加密字段列表
var SENSITIVE_FIELDS = [
  'amount', 'category', 'note', 'type', 'typeLabel',
  'date', 'target', 'targetType', 'voucher'
]

// Storage keys（仅企业密钥）
var KEY_COMPANY_PRIV = 'e2e_company_private_key'
var KEY_COMPANY_PUB = 'e2e_company_public_key'
var KEY_COMPANY_KEY_ID = 'e2e_company_key_id'

var ENC_TYPE_ECIES = 0x02

// ==================== 环境兼容 ====================

function _textEncoder() {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder()
  return {
    encode: function (str) {
      var bytes = []
      for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i)
        if (c < 0x80) { bytes.push(c) }
        else if (c < 0x800) { bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)) }
        else if (c < 0xd800 || c >= 0xe000) {
          bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
        } else {
          i++; c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff))
          bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
        }
      }
      return new Uint8Array(bytes)
    }
  }
}

function _textDecoder() {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder()
  return {
    decode: function (bytes) {
      var str = ''
      var i = 0
      while (i < bytes.length) {
        var c = bytes[i]
        var code, len
        if (c < 0x80) { code = c; len = 1 }
        else if (c < 0xe0) { code = ((c & 0x1f) << 6) | (bytes[i + 1] & 0x3f); len = 2 }
        else if (c < 0xf0) { code = ((c & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f); len = 3 }
        else { code = ((c & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f); len = 4 }
        if (code > 0xffff) {
          code -= 0x10000
          str += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff))
        } else {
          str += String.fromCharCode(code)
        }
        i += len
      }
      return str
    }
  }
}

function _randomBytes(length) {
  var bytes = noble.randomBytes(length)
  var allZero = true
  for (var i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0) { allZero = false; break }
  }
  if (allZero) throw new Error('安全随机数生成失败，请重启小程序后重试')
  return bytes
}

function _toBase64(uint8) {
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

function _fromBase64(b64) {
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

function _hexToBytes(hex) {
  if (typeof hex !== 'string' || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error('无效的十六进制数据')
  }
  var bytes = new Uint8Array(hex.length / 2)
  for (var i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

function _bytesToHex(bytes) {
  var hex = ''
  for (var i = 0; i < bytes.length; i++) {
    hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16)
  }
  return hex
}

// ==================== AES-256-GCM（公司私钥备份用）====================

function _aesGcmEncrypt(plaintext, key) {
  var iv = _randomBytes(12)
  var cipher = noble.gcm(key, iv)
  var encrypted = cipher.encrypt(plaintext)
  var combined = new Uint8Array(12 + encrypted.length)
  combined.set(iv, 0)
  combined.set(encrypted, 12)
  return _toBase64(combined)
}

function _aesGcmDecrypt(base64Cipher, key) {
  var combined = _fromBase64(base64Cipher)
  var iv = combined.slice(0, 12)
  var encrypted = combined.slice(12)
  var decipher = noble.gcm(key, iv)
  return decipher.decrypt(encrypted)
}

// ==================== 公司密钥管理 ====================

function hasCompanyKeys() {
  return !!wx.getStorageSync(KEY_COMPANY_PRIV) || !!wx.getStorageSync(KEY_COMPANY_PUB)
}

function isCompanyBoss() {
  return !!wx.getStorageSync(KEY_COMPANY_PRIV)
}

function setCompanyPrivateKey(hex) {
  if (!/^[0-9a-fA-F]{64}$/.test(hex || '')) throw new Error('公司私钥格式无效')
  wx.setStorageSync(KEY_COMPANY_PRIV, hex)
}

function getCompanyPrivateKey() {
  return wx.getStorageSync(KEY_COMPANY_PRIV) || null
}

function setCompanyPublicKey(hex, keyId) {
  if (!/^(02|03)[0-9a-fA-F]{64}$/.test(hex || '')) throw new Error('公司公钥格式无效')
  wx.setStorageSync(KEY_COMPANY_PUB, hex)
  if (keyId) wx.setStorageSync(KEY_COMPANY_KEY_ID, keyId)
}

function getCompanyPublicKey() {
  var hex = wx.getStorageSync(KEY_COMPANY_PUB) || null
  var keyId = wx.getStorageSync(KEY_COMPANY_KEY_ID) || null
  if (!hex) return null
  return { key: hex, keyId: keyId }
}

function clearCompanyKeys() {
  try { wx.removeStorageSync(KEY_COMPANY_PRIV) } catch (e) {}
  try { wx.removeStorageSync(KEY_COMPANY_PUB) } catch (e) {}
  try { wx.removeStorageSync(KEY_COMPANY_KEY_ID) } catch (e) {}
}

// ==================== 公司私钥备份（恢复密钥派生）====================

var COMPANY_KEY_PEPPER = 'miniprogram-company-key-backup-v1'
var COMPANY_RECOVERY_KEY_LEN = 28
var COMPANY_RECOVERY_KEY_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
var PBKDF2_ITERATIONS = 100000
var PBKDF2_KEY_LEN = 32

function generateCompanyRecoveryKey() {
  var charsLen = COMPANY_RECOVERY_KEY_CHARSET.length
  var bytes = _randomBytes(COMPANY_RECOVERY_KEY_LEN)
  var result = ''
  for (var i = 0; i < COMPANY_RECOVERY_KEY_LEN; i++) {
    result += COMPANY_RECOVERY_KEY_CHARSET[bytes[i] % charsLen]
  }
  return result
}

function _deriveCompanyBackupKey(recoveryKey, salt) {
  var enc = _textEncoder()
  var keyBytes = enc.encode(recoveryKey)
  var pepperBytes = enc.encode(COMPANY_KEY_PEPPER)
  var passBytes = new Uint8Array(keyBytes.length + pepperBytes.length)
  passBytes.set(keyBytes, 0)
  passBytes.set(pepperBytes, keyBytes.length)

  var saltBytes = salt ? _hexToBytes(salt) : _randomBytes(16)
  var derived = noble.pbkdf2(noble.sha256, passBytes, saltBytes, {
    c: PBKDF2_ITERATIONS,
    dkLen: PBKDF2_KEY_LEN
  })
  return { key: derived, salt: _bytesToHex(saltBytes) }
}

function encryptCompanyPrivateKey(privHex, recoveryKey) {
  var derived = _deriveCompanyBackupKey(recoveryKey, null)
  var privBytes = _hexToBytes(privHex)
  var blob = _aesGcmEncrypt(privBytes, derived.key)
  return { encryptedBlob: blob, salt: derived.salt }
}

function decryptCompanyPrivateKey(encryptedBlob, recoveryKey, salt) {
  var recovery = _deriveCompanyBackupKey(recoveryKey, salt)
  try {
    var privBytes = _aesGcmDecrypt(encryptedBlob, recovery.key)
    return _bytesToHex(privBytes)
  } catch (e) {
    throw new Error('恢复密钥不正确')
  }
}

// ==================== 加解密路由 ====================

function _operationKindFor(item) {
  if (item && item.typeLabel === '垫付') return 'advance'
  if (item && item.typeLabel === '应付') return 'payable'
  return 'normal'
}

/**
 * 加密单个 item
 * 企业 scope → ECIES；个人 scope → 明文透传
 */
function encryptItem(item) {
  if (item.scope === 'company') {
    var cPub = getCompanyPublicKey()
    // boss 未开启加密或员工未拿到公钥 → 明文
    if (!cPub) return item
    return companyEncryptItem(item, cPub.key)
  }
  return item
}

/**
 * 解密单个 item
 * 企业 scope → ECIES；个人 scope → 原样返回
 */
function decryptItem(item) {
  var encrypted = item.encrypted_data || item.encryptedData
  if (!encrypted) return item

  if (item.scope === 'company') {
    var cPriv = getCompanyPrivateKey()
    if (cPriv) {
      try {
        return companyDecryptItem(item, cPriv)
      } catch (e) {
        console.warn('[crypto] ECIES 解密失败:', e.message)
      }
    }
  }

  // 无法解密 → 保持密文
  return item
}

/**
 * ECIES 公钥加密单个 item
 */
function companyEncryptItem(item, publicKeyHex) {
  var pubBytes = _hexToBytes(publicKeyHex)
  var sensitive = {}
  for (var i = 0; i < SENSITIVE_FIELDS.length; i++) {
    var f = SENSITIVE_FIELDS[i]
    if (item[f] !== undefined && item[f] !== null) {
      sensitive[f] = item[f]
    }
  }
  sensitive['_enc_type'] = ENC_TYPE_ECIES
  sensitive['_bound_id'] = String(item.id)
  sensitive['_bound_scope'] = item.scope || 'company'
  sensitive['_operation_kind'] = _operationKindFor(item)

  var ecc = _getEcc()
  if (!ecc) throw new Error('ECC 加密模块未加载')
  var plainBytes = _textEncoder().encode(JSON.stringify(sensitive))
  var encrypted = _toBase64(ecc.eciesEncrypt(plainBytes, pubBytes))

  var result = {}
  var keys = Object.keys(item)
  for (var k = 0; k < keys.length; k++) { result[keys[k]] = item[keys[k]] }
  for (var j = 0; j < SENSITIVE_FIELDS.length; j++) {
    var f2 = SENSITIVE_FIELDS[j]
    if (result[f2] !== undefined && result[f2] !== null) {
      result[f2] = '[encrypted]'
    }
  }
  result.encrypted_data = encrypted
  delete result.encryptedData
  result._operationKind = _operationKindFor(item)
  result._encryptionVersion = 1
  return result
}

/**
 * ECIES 私钥解密单个 item
 */
function companyDecryptItem(item, privateKeyHex) {
  var encrypted = item.encrypted_data || item.encryptedData
  if (!encrypted) return item

  var ecc = _getEcc()
  if (!ecc) throw new Error('ECC 加密模块未加载')

  var privBytes = _hexToBytes(privateKeyHex)
  var blobBytes = _fromBase64(encrypted)
  var decrypted = ecc.eciesDecrypt(blobBytes, privBytes)
  var decoded = _textDecoder().decode(decrypted)
  var sensitive
  try {
    sensitive = JSON.parse(decoded)
  } catch (parseErr) {
    console.warn('[crypto] ECIES 解密成功但 JSON 解析失败:', parseErr.message)
    return item
  }
  _validateDecryptedBinding(item, sensitive)
  _removeInternalFields(sensitive)
  return _applyDecryptedFields(item, sensitive)
}

// ==================== 解密辅助 ====================

function _applyDecryptedFields(item, sensitive) {
  var result = {}
  var keys = Object.keys(item)
  for (var k = 0; k < keys.length; k++) { result[keys[k]] = item[keys[k]] }
  var sKeys = Object.keys(sensitive)
  for (var j = 0; j < sKeys.length; j++) { result[sKeys[j]] = sensitive[sKeys[j]] }
  return result
}

function _validateDecryptedBinding(item, sensitive) {
  if (sensitive._bound_id !== undefined && String(item.id) !== String(sensitive._bound_id)) {
    throw new Error('密文与账单 ID 不匹配')
  }
  if (sensitive._bound_scope !== undefined && String(item.scope) !== String(sensitive._bound_scope)) {
    throw new Error('密文与账本范围不匹配')
  }
  var publicKind = item._operationKind || item.operation_kind
  if (
    sensitive._operation_kind !== undefined
    && publicKind
    && publicKind !== sensitive._operation_kind
  ) {
    throw new Error('密文结算类型校验失败')
  }
}

function _removeInternalFields(sensitive) {
  delete sensitive._enc_type
  delete sensitive._bound_id
  delete sensitive._bound_scope
  delete sensitive._operation_kind
}

// ==================== 导出 ====================

module.exports = {
  // 加解密路由
  encryptItem: encryptItem,
  decryptItem: decryptItem,
  companyEncryptItem: companyEncryptItem,
  companyDecryptItem: companyDecryptItem,

  // 公司密钥管理
  hasCompanyKeys: hasCompanyKeys,
  isCompanyBoss: isCompanyBoss,
  setCompanyPrivateKey: setCompanyPrivateKey,
  getCompanyPrivateKey: getCompanyPrivateKey,
  setCompanyPublicKey: setCompanyPublicKey,
  getCompanyPublicKey: getCompanyPublicKey,
  clearCompanyKeys: clearCompanyKeys,

  // 公司私钥备份
  generateCompanyRecoveryKey: generateCompanyRecoveryKey,
  encryptCompanyPrivateKey: encryptCompanyPrivateKey,
  decryptCompanyPrivateKey: decryptCompanyPrivateKey,

  // 编解码工具
  hexToBytes: _hexToBytes,
  bytesToHex: _bytesToHex,
  toBase64: _toBase64,
  fromBase64: _fromBase64,
  randomBytes: _randomBytes
}
