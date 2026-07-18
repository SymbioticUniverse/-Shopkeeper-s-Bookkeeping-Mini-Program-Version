/**
 * E2E 加密核心模块
 *
 * 加密算法：AES-256-GCM（via vendor/noble-ciphers.js）
 * 密钥恢复：PBKDF2-HMAC-SHA256 从手机号派生 recovery key
 * 高级安全：28 位自保管密钥参与派生（企业用户可选）
 */

var noble = require('../vendor/noble-ciphers.js')

// 加密字段列表
var SENSITIVE_FIELDS = ['amount', 'category', 'note', 'typeLabel', 'target', 'targetType']

// Storage keys
var KEY_MASTER = 'e2e_master_key'
var KEY_ENABLED = 'e2e_enabled'
var KEY_ADVANCED = 'e2e_advanced'

// PBKDF2 参数
var PBKDF2_ITERATIONS = 100000
var PBKDF2_KEY_LEN = 32

// 高级安全密钥长度
var ADVANCED_KEY_LEN = 28
var ADVANCED_KEY_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

// ==================== 环境兼容 ====================

function _textEncoder() {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder()
  // Mini-program polyfill
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
        str += String.fromCharCode(code)
        i += len
      }
      return str
    }
  }
}

function _randomBytes(length) {
  return noble.randomBytes(length)
}

/**
 * Uint8Array → base64 (使用 wx API)
 */
function _toBase64(uint8) {
  if (typeof wx !== 'undefined' && wx.arrayBufferToBase64) {
    return wx.arrayBufferToBase64(uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength))
  }
  // Fallback: 标准 btoa + 二进制字符串
  var binary = ''
  for (var i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i])
  }
  if (typeof btoa !== 'undefined') return btoa(binary)
  // 最后 fallback：手动 base64
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

/**
 * base64 → Uint8Array (使用 wx API)
 */
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
  // Fallback 手动 base64
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

/**
 * hex 字符串 → Uint8Array
 */
function _hexToBytes(hex) {
  var bytes = new Uint8Array(hex.length / 2)
  for (var i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

/**
 * Uint8Array → hex 字符串
 */
function _bytesToHex(bytes) {
  var hex = ''
  for (var i = 0; i < bytes.length; i++) {
    hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16)
  }
  return hex
}

// ==================== 主密钥管理 ====================

/**
 * 生成 256-bit 随机主密钥 (hex)
 */
function generateMasterKey() {
  return _bytesToHex(_randomBytes(32))
}

/**
 * 获取本地存储的主密钥
 */
function _getMasterKey() {
  return wx.getStorageSync(KEY_MASTER) || null
}

/**
 * 保存主密钥到本地
 */
function _setMasterKey(hexKey) {
  wx.setStorageSync(KEY_MASTER, hexKey)
}

// ==================== 加解密 ====================

/**
 * AES-256-GCM 加密
 * @param {Uint8Array} plaintext - 明文
 * @param {Uint8Array} key - 32-byte 密钥
 * @returns {string} base64(IV[12] + ciphertext + tag[16])
 */
function _aesGcmEncrypt(plaintext, key) {
  var iv = _randomBytes(12)
  var cipher = noble.gcm(key, iv)
  var encrypted = cipher.encrypt(plaintext)
  // 组合 IV + ciphertext
  var combined = new Uint8Array(12 + encrypted.length)
  combined.set(iv, 0)
  combined.set(encrypted, 12)
  return _toBase64(combined)
}

/**
 * AES-256-GCM 解密
 * @param {string} base64Cipher - base64(IV[12] + ciphertext + tag[16])
 * @param {Uint8Array} key - 32-byte 密钥
 * @returns {Uint8Array} 明文
 */
function _aesGcmDecrypt(base64Cipher, key) {
  var combined = _fromBase64(base64Cipher)
  var iv = combined.slice(0, 12)
  var encrypted = combined.slice(12)
  var decipher = noble.gcm(key, iv)
  return decipher.decrypt(encrypted)
}

/**
 * 加密单个 item
 * 提取敏感字段 → JSON → 加密 → base64 → 写入 encrypted_data
 * 敏感字段替换为 '[encrypted]'
 */
function encryptItem(item) {
  var key = _getMasterKey()
  if (!key) throw new Error('加密未启用，无主密钥')

  var keyBytes = _hexToBytes(key)
  var sensitive = {}
  for (var i = 0; i < SENSITIVE_FIELDS.length; i++) {
    var f = SENSITIVE_FIELDS[i]
    if (item[f] !== undefined && item[f] !== null) {
      sensitive[f] = item[f]
    }
  }

  var plainBytes = _textEncoder().encode(JSON.stringify(sensitive))
  var encrypted = _aesGcmEncrypt(plainBytes, keyBytes)

  var result = {}
  // 浅拷贝所有字段
  var keys = Object.keys(item)
  for (var k = 0; k < keys.length; k++) {
    result[keys[k]] = item[keys[k]]
  }
  // 替换敏感字段
  for (var j = 0; j < SENSITIVE_FIELDS.length; j++) {
    var f2 = SENSITIVE_FIELDS[j]
    if (result[f2] !== undefined && result[f2] !== null) {
      result[f2] = '[encrypted]'
    }
  }
  result.encrypted_data = encrypted
  return result
}

/**
 * 解密单个 item
 * 从 encrypted_data 恢复敏感字段
 * 如果 encrypted_data 为空 → 旧数据，原样返回
 */
function decryptItem(item) {
  var encrypted = item.encrypted_data || item.encryptedData
  if (!encrypted) return item

  var key = _getMasterKey()
  if (!key) {
    console.warn('[crypto] 收到加密数据但本地无主密钥，保持密文')
    return item
  }

  try {
    var keyBytes = _hexToBytes(key)
    var decrypted = _aesGcmDecrypt(encrypted, keyBytes)
    var sensitive = JSON.parse(_textDecoder().decode(decrypted))

    var result = {}
    var keys = Object.keys(item)
    for (var k = 0; k < keys.length; k++) {
      result[keys[k]] = item[keys[k]]
    }
    // 恢复敏感字段
    var sKeys = Object.keys(sensitive)
    for (var j = 0; j < sKeys.length; j++) {
      result[sKeys[j]] = sensitive[sKeys[j]]
    }
    return result
  } catch (e) {
    console.error('[crypto] 解密失败:', e.message)
    return item
  }
}

// ==================== 状态查询 ====================

function isEncryptionEnabled() {
  return !!wx.getStorageSync(KEY_ENABLED)
}

function isAdvancedSecurityEnabled() {
  return !!wx.getStorageSync(KEY_ADVANCED)
}

// ==================== 密钥派生 & 恢复 ====================

/**
 * PBKDF2-HMAC-SHA256 从手机号派生 recovery key
 */
function _deriveRecoveryKey(phoneNumber, extraKey, salt) {
  var enc = _textEncoder()
  var phoneBytes = enc.encode(phoneNumber)
  var saltBytes = salt ? _hexToBytes(salt) : _randomBytes(16)

  var passBytes
  if (extraKey) {
    // 高级安全：手机号 + 28位密钥
    var extraBytes = enc.encode(extraKey)
    passBytes = new Uint8Array(phoneBytes.length + extraBytes.length)
    passBytes.set(phoneBytes, 0)
    passBytes.set(extraBytes, phoneBytes.length)
  } else {
    passBytes = phoneBytes
  }

  var derived = noble.pbkdf2(noble.sha256, passBytes, saltBytes, {
    c: PBKDF2_ITERATIONS,
    dkLen: PBKDF2_KEY_LEN
  })

  return { key: _bytesToHex(derived), salt: _bytesToHex(saltBytes) }
}

/**
 * 启用加密（默认模式）
 * 1. 生成主密钥
 * 2. 从手机号派生 recovery key
 * 3. 用 recovery key 加密主密钥
 * 4. 存储主密钥到本地
 * 5. 返回 { encryptedBlob, salt } 供上传服务端
 */
function setupEncryption(phoneNumber) {
  var masterKey = generateMasterKey()
  _setMasterKey(masterKey)
  wx.setStorageSync(KEY_ENABLED, true)

  var recovery = _deriveRecoveryKey(phoneNumber, null, null)
  var recoveryKeyBytes = _hexToBytes(recovery.key)
  var masterBytes = _hexToBytes(masterKey)
  var blob = _aesGcmEncrypt(masterBytes, recoveryKeyBytes)

  return { encryptedBlob: blob, salt: recovery.salt, tier: 'personal' }
}

/**
 * 开启高级安全
 * 重新用手机号 + 28位密钥派生并加密主密钥
 * 注意：纯计算函数，不修改本地状态。调用方应在上传成功后手动设置 e2e_advanced=true。
 */
function enableAdvancedSecurity(phoneNumber, advancedKey) {
  if (!isEncryptionEnabled()) throw new Error('请先启用加密')
  if (!advancedKey || advancedKey.length !== ADVANCED_KEY_LEN) {
    throw new Error('密钥格式不正确，需要28位')
  }
  if (!isValidAdvancedKey(advancedKey)) {
    throw new Error('密钥包含非法字符')
  }

  var masterKey = _getMasterKey()
  if (!masterKey) throw new Error('主密钥丢失')

  var recovery = _deriveRecoveryKey(phoneNumber, advancedKey, null)
  var recoveryKeyBytes = _hexToBytes(recovery.key)
  var masterBytes = _hexToBytes(masterKey)
  var blob = _aesGcmEncrypt(masterBytes, recoveryKeyBytes)

  return { encryptedBlob: blob, salt: recovery.salt, tier: 'advanced' }
}

/**
 * 关闭高级安全，切回默认模式
 * 注意：纯计算函数，不修改本地状态。调用方应在上传成功后手动设置 e2e_advanced=false。
 */
function disableAdvancedSecurity(phoneNumber, advancedKey) {
  if (!isEncryptionEnabled()) throw new Error('加密未启用')
  if (!advancedKey || advancedKey.length !== ADVANCED_KEY_LEN) {
    throw new Error('密钥格式不正确')
  }

  // 先用高级安全模式验证当前 blob 可解密（验证密钥正确性）
  var masterKey = _getMasterKey()
  var recovery = _deriveRecoveryKey(phoneNumber, advancedKey, null)
  var recoveryKeyBytes = _hexToBytes(recovery.key)
  var masterBytes = _hexToBytes(masterKey)
  var testBlob = _aesGcmEncrypt(masterBytes, recoveryKeyBytes)

  try {
    _aesGcmDecrypt(testBlob, recoveryKeyBytes)
  } catch (e) {
    throw new Error('密钥验证失败')
  }

  // 重新用纯手机号派生并加密
  var newRecovery = _deriveRecoveryKey(phoneNumber, null, null)
  var newRecoveryBytes = _hexToBytes(newRecovery.key)
  var newBlob = _aesGcmEncrypt(masterBytes, newRecoveryBytes)

  return { encryptedBlob: newBlob, salt: newRecovery.salt, tier: 'personal' }
}

/**
 * 降级到个人版 blob（VIP 过期自动调用）
 * 不需要高级安全密钥验证，因为 masterKey 已在本地
 * 注意：纯计算函数，不修改本地状态。调用方应在 blob 上传成功后
 * 手动清除 e2e_advanced 标记并更新 UI。
 */
function downgradeToPersonal(phoneNumber) {
  var masterKey = _getMasterKey()
  if (!masterKey) throw new Error('主密钥丢失')

  var recovery = _deriveRecoveryKey(phoneNumber, null, null)
  var recoveryKeyBytes = _hexToBytes(recovery.key)
  var masterBytes = _hexToBytes(masterKey)
  var blob = _aesGcmEncrypt(masterBytes, recoveryKeyBytes)

  return { encryptedBlob: blob, salt: recovery.salt, tier: 'personal' }
}

/**
 * 从手机号 + blob 恢复主密钥（默认模式）
 */
function recoverMasterKey(phoneNumber, encryptedBlob, salt) {
  var recovery = _deriveRecoveryKey(phoneNumber, null, salt)
  var recoveryKeyBytes = _hexToBytes(recovery.key)

  try {
    var masterBytes = _aesGcmDecrypt(encryptedBlob, recoveryKeyBytes)
    var masterKey = _bytesToHex(masterBytes)
    _setMasterKey(masterKey)
    wx.setStorageSync(KEY_ENABLED, true)
    wx.setStorageSync(KEY_ADVANCED, false)
    return true
  } catch (e) {
    console.error('[crypto] 密钥恢复失败:', e.message)
    return false
  }
}

/**
 * 从手机号 + 28位密钥 + blob 恢复主密钥（高级安全模式）
 */
function recoverMasterKeyAdvanced(phoneNumber, advancedKey, encryptedBlob, salt) {
  var recovery = _deriveRecoveryKey(phoneNumber, advancedKey, salt)
  var recoveryKeyBytes = _hexToBytes(recovery.key)

  try {
    var masterBytes = _aesGcmDecrypt(encryptedBlob, recoveryKeyBytes)
    var masterKey = _bytesToHex(masterBytes)
    _setMasterKey(masterKey)
    wx.setStorageSync(KEY_ENABLED, true)
    wx.setStorageSync(KEY_ADVANCED, true)
    return true
  } catch (e) {
    console.error('[crypto] 高级安全密钥恢复失败:', e.message)
    return false
  }
}

// ==================== 高级安全密钥生成 & 校验 ====================

function generateAdvancedKey() {
  var charsLen = ADVANCED_KEY_CHARSET.length
  var bytes = _randomBytes(ADVANCED_KEY_LEN)
  var result = ''
  for (var i = 0; i < ADVANCED_KEY_LEN; i++) {
    result += ADVANCED_KEY_CHARSET[bytes[i] % charsLen]
  }
  return result
}

function isValidAdvancedKey(key) {
  if (typeof key !== 'string' || key.length !== ADVANCED_KEY_LEN) return false
  for (var i = 0; i < key.length; i++) {
    if (ADVANCED_KEY_CHARSET.indexOf(key[i]) === -1) return false
  }
  return true
}

// ==================== 导出 & 导入 ====================

function exportMasterKey() {
  return _getMasterKey()
}

function importMasterKey(hex) {
  if (!hex || hex.length !== 64) {
    throw new Error('密钥格式不正确（需64位 hex）')
  }
  _setMasterKey(hex)
  wx.setStorageSync(KEY_ENABLED, true)
  return true
}

// ==================== 开关控制 ====================

function enableEncryption() {
  wx.setStorageSync(KEY_ENABLED, true)
}

function disableEncryption() {
  try { wx.removeStorageSync(KEY_MASTER) } catch (e) {}
  try { wx.removeStorageSync(KEY_ENABLED) } catch (e) {}
  try { wx.removeStorageSync(KEY_ADVANCED) } catch (e) {}
}

// ==================== 上传 / 获取 blob（调用网络接口） ====================

/**
 * 上传加密后的密钥 blob 到服务端
 * 使用 wx.request 直接调用（避免 api.js 循环依赖）
 */
function uploadKeyBlob(encryptedBlob, salt, tier) {
  return new Promise(function (resolve, reject) {
    var token = wx.getStorageSync('authToken')
    var baseUrl = wx.getStorageSync('api_base_url') || 'https://symbioticuniverse.xyz/api'
    wx.request({
      url: baseUrl + '/user/key-blob',
      method: 'PUT',
      header: {
        'Authorization': 'Bearer ' + (token || ''),
        'Content-Type': 'application/json'
      },
      data: { encrypted_blob: encryptedBlob, salt: salt, tier: tier || 'personal' },
      success: function (res) {
        if (res.statusCode === 200) resolve(res.data)
        else reject(new Error('上传密钥失败: ' + res.statusCode))
      },
      fail: function (err) { reject(err) }
    })
  })
}

/**
 * 从服务端获取密钥 blob
 */
function fetchKeyBlob() {
  return new Promise(function (resolve, reject) {
    var token = wx.getStorageSync('authToken')
    var baseUrl = wx.getStorageSync('api_base_url') || 'https://symbioticuniverse.xyz/api'
    wx.request({
      url: baseUrl + '/user/key-blob',
      method: 'GET',
      header: {
        'Authorization': 'Bearer ' + (token || '')
      },
      success: function (res) {
        if (res.statusCode === 200 && res.data) {
          resolve({ blob: res.data.encrypted_blob, salt: res.data.salt, tier: res.data.tier })
        } else if (res.statusCode === 404) {
          resolve(null)
        } else {
          reject(new Error('获取密钥失败: ' + res.statusCode))
        }
      },
      fail: function (err) { reject(err) }
    })
  })
}

module.exports = {
  // 主密钥
  generateMasterKey: generateMasterKey,

  // 加解密
  encryptItem: encryptItem,
  decryptItem: decryptItem,

  // 状态
  isEncryptionEnabled: isEncryptionEnabled,
  isAdvancedSecurityEnabled: isAdvancedSecurityEnabled,

  // 密钥派生 & 恢复
  setupEncryption: setupEncryption,
  enableAdvancedSecurity: enableAdvancedSecurity,
  disableAdvancedSecurity: disableAdvancedSecurity,
  recoverMasterKey: recoverMasterKey,
  recoverMasterKeyAdvanced: recoverMasterKeyAdvanced,

  // 降级
  downgradeToPersonal: downgradeToPersonal,

  // 高级安全密钥
  generateAdvancedKey: generateAdvancedKey,
  isValidAdvancedKey: isValidAdvancedKey,

  // 导出导入
  exportMasterKey: exportMasterKey,
  importMasterKey: importMasterKey,

  // 开关
  enableEncryption: enableEncryption,
  disableEncryption: disableEncryption,

  // 网络
  uploadKeyBlob: uploadKeyBlob,
  fetchKeyBlob: fetchKeyBlob
}
