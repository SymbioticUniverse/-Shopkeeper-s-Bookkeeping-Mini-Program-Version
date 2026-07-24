/**
 * E2E 加密核心模块
 *
 * 加密算法：AES-256-GCM（via vendor/noble-ciphers.js）
 * 默认恢复：用户自保管 64 位主密钥，服务端无恢复能力
 * 高级恢复：PBKDF2-HMAC-SHA256（手机号 + 28 位自保管密钥）
 */

// WeChat 某些版本实现了 setBigUint64，但只接受 BigInt；noble 传入 Number。
// 兼容层必须正确写入高低 32 位，不能把高位直接清零。
if (typeof DataView !== 'undefined') {
  var _nativeSetBigUint64 = typeof DataView.prototype.setBigUint64 === 'function'
    ? DataView.prototype.setBigUint64
    : null
  DataView.prototype.setBigUint64 = function (byteOffset, value, littleEndian) {
    if (_nativeSetBigUint64 && typeof BigInt === 'function') {
      return _nativeSetBigUint64.call(
        this,
        byteOffset,
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

// Storage keys
var KEY_MASTER = 'e2e_master_key'
var KEY_OWNER = 'e2e_key_owner'
var KEY_AUTH_USER = 'authUserId'
var KEY_ENABLED = 'e2e_enabled'
var KEY_ADVANCED = 'e2e_advanced'
var KEY_COMPANY_PRIV = 'e2e_company_private_key'
var KEY_COMPANY_PUB = 'e2e_company_public_key'
var KEY_COMPANY_KEY_ID = 'e2e_company_key_id'
var KEY_BACKUP_PENDING = 'e2e_backup_pending'
var KEY_REQUIRED = 'e2e_required'

// encrypted_data 类型标记（写在加密前的明文中，加密后不可见）
var ENC_TYPE_AES_GCM = 0x01   // 个人 AES-256-GCM
var ENC_TYPE_ECIES = 0x02     // 企业 ECIES

// PBKDF2 参数
var PBKDF2_ITERATIONS = 100000
var PBKDF2_KEY_LEN = 32

// 高级安全密钥长度
var ADVANCED_KEY_LEN = 28
var ADVANCED_KEY_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
var MANUAL_KEY_CHECK = 'miniprogram-e2e-key-check-v1'

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
  // 安全检查：密码学随机源异常时必须失败封闭，Math.random 不能用于生成密钥或 IV。
  var allZero = true
  for (var i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0) { allZero = false; break }
  }
  if (allZero) {
    throw new Error('安全随机数生成失败，请重启小程序后重试')
  }
  return bytes
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
  if (typeof hex !== 'string' || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error('无效的十六进制数据')
  }
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

// ==================== 主密钥管理 ====================

function _normalizeUserId(userId) {
  if (userId === undefined || userId === null || userId === '') return ''
  return String(userId)
}

function getKeyOwner() {
  return _normalizeUserId(wx.getStorageSync(KEY_OWNER))
}

function getAuthenticatedUserId() {
  return _normalizeUserId(wx.getStorageSync(KEY_AUTH_USER))
}

/**
 * 清除个人密钥及所有账号级加密标记。
 * 仅用于明确换号、账号注销或无法确认旧密钥归属的场景。
 */
function clearPersonalEncryptionState() {
  var keys = [
    KEY_MASTER,
    KEY_OWNER,
    KEY_ENABLED,
    KEY_ADVANCED,
    KEY_BACKUP_PENDING,
    KEY_REQUIRED,
    'e2e_advanced_downgraded'
  ]
  for (var i = 0; i < keys.length; i++) {
    try { wx.removeStorageSync(keys[i]) } catch (e) {}
  }
}

/**
 * 登录成功后切换本地加密上下文。
 *
 * 已有 owner 与新账号不一致时必须清钥；旧版无 owner 的密钥只有在本地已
 * 记录同一 authUserId 时才能迁移绑定，否则无法证明归属，按失败封闭处理。
 */
function activateAccount(userId, options) {
  var nextUserId = _normalizeUserId(userId)
  if (!nextUserId) throw new Error('登录响应缺少用户标识，已阻止加密初始化')

  var verifiedBootstrap = !!(options && options.verifiedBootstrap)
  var previousUserId = getAuthenticatedUserId()
  var owner = getKeyOwner()
  var hasMasterKey = !!wx.getStorageSync(KEY_MASTER)
  var accountChanged = !!previousUserId && previousUserId !== nextUserId
  var ownerMismatch = !!owner && owner !== nextUserId
  var unownedKeyIsAmbiguous = hasMasterKey && !owner &&
    previousUserId !== nextUserId && !verifiedBootstrap

  if (ownerMismatch || unownedKeyIsAmbiguous) {
    clearPersonalEncryptionState()
    hasMasterKey = false
    owner = ''
  }
  if (accountChanged || ownerMismatch || unownedKeyIsAmbiguous) {
    clearCompanyKeys()
  }

  wx.setStorageSync(KEY_AUTH_USER, nextUserId)

  // 兼容已经记录 authUserId、但尚未补 owner 标记的过渡版本。
  if (hasMasterKey && !owner && (previousUserId === nextUserId || verifiedBootstrap)) {
    wx.setStorageSync(KEY_OWNER, nextUserId)
  }

  return {
    userId: nextUserId,
    accountChanged: accountChanged || ownerMismatch || unownedKeyIsAmbiguous,
    hasOwnedKey: !!wx.getStorageSync(KEY_MASTER) && getKeyOwner() === nextUserId
  }
}

function isKeyOwnedByCurrentUser() {
  var owner = getKeyOwner()
  var currentUserId = getAuthenticatedUserId()
  return !!owner && !!currentUserId && owner === currentUserId
}

/**
 * 页面初始化入口使用的失败封闭检查。
 * 无主密钥时允许进入恢复/首次生成流程；一旦存在主密钥，必须有匹配 owner。
 */
function assertAccountKeyOwnership() {
  var currentUserId = getAuthenticatedUserId()
  if (!currentUserId) throw new Error('未确认当前账号，已阻止加密初始化')
  if (wx.getStorageSync(KEY_MASTER) && !isKeyOwnedByCurrentUser()) {
    throw new Error('本地加密密钥不属于当前账号，已阻止使用')
  }
  return true
}

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
  var key = wx.getStorageSync(KEY_MASTER) || null
  if (!key) return null
  // 所有加解密和导出路径统一从这里取钥，账号不匹配时一律不可见。
  return isKeyOwnedByCurrentUser() ? key : null
}

/**
 * 保存主密钥到本地
 */
function _setMasterKey(hexKey) {
  var currentUserId = getAuthenticatedUserId()
  if (!currentUserId) throw new Error('未确认当前账号，禁止保存加密密钥')
  wx.setStorageSync(KEY_MASTER, hexKey)
  wx.setStorageSync(KEY_OWNER, currentUserId)
  // 验证写入
  var verify = wx.getStorageSync(KEY_MASTER)
  if (verify !== hexKey) {
    console.error('[crypto] 主密钥写入失败！写入值与回读值不一致')
  }
  if (/^0+$/.test(hexKey)) {
    console.error('[crypto] 严重错误：尝试写入全零主密钥！调用栈:', new Error().stack)
  }
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
  assertAccountKeyOwnership()
  if (wx.getStorageSync(KEY_BACKUP_PENDING)) {
    throw new Error('加密账户标记尚未安全写入云端')
  }

  // 企业 scope 统一用公司公钥加密；老板和员工必须使用同一种公司密钥体系。
  if (item.scope === 'company') {
    var cPub = getCompanyPublicKey()
    if (!cPub) throw new Error('公司加密公钥未就绪')
    return companyEncryptItem(item, cPub.key)
  }

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

  // 添加类型标记（0x01 = AES-GCM）
  sensitive['_enc_type'] = ENC_TYPE_AES_GCM
  sensitive['_bound_id'] = String(item.id)
  sensitive['_bound_scope'] = item.scope || 'personal'
  sensitive['_operation_kind'] = _operationKindFor(item)

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
  delete result.encryptedData
  result._operationKind = _operationKindFor(item)
  result._encryptionVersion = 1
  return result
}

function _operationKindFor(item) {
  if (item && item.typeLabel === '垫付') return 'advance'
  if (item && item.typeLabel === '应付') return 'payable'
  return 'normal'
}

/**
 * ECIES 公钥加密单个 item（员工记公司账时调用）
 * @param {object} item
 * @param {string} publicKeyHex — 公司公钥 hex
 */
function companyEncryptItem(item, publicKeyHex) {
  assertAccountKeyOwnership()
  var pubBytes = _hexToBytes(publicKeyHex)
  var sensitive = {}
  for (var i = 0; i < SENSITIVE_FIELDS.length; i++) {
    var f = SENSITIVE_FIELDS[i]
    if (item[f] !== undefined && item[f] !== null) {
      sensitive[f] = item[f]
    }
  }
  // 添加类型标记（0x02 = ECIES）
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
  for (var k = 0; k < keys.length; k++) {
    result[keys[k]] = item[keys[k]]
  }
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
 * 解密单个 item
 * 自动检测加密格式：AES-GCM(个人/老板) 或 ECIES(员工)
 * 如果 encrypted_data 为空 → 旧数据，原样返回
 */
function decryptItem(item) {
  var encrypted = item.encrypted_data || item.encryptedData
  if (!encrypted) return item
  try {
    assertAccountKeyOwnership()
  } catch (e) {
    console.warn('[crypto] 账号密钥上下文无效，保持密文')
    return item
  }

  // 方案：先尝试 AES-GCM（覆盖个人+老板自己），失败再试 ECIES
  var masterKey = _getMasterKey()
  if (masterKey) {
    try {
      var keyBytes = _hexToBytes(masterKey)
      var decrypted = _aesGcmDecrypt(encrypted, keyBytes)
      var decoded = _textDecoder().decode(decrypted)
      var sensitive
      try {
        sensitive = JSON.parse(decoded)
      } catch (parseErr) {
        console.warn('[crypto] 解密成功但 JSON 解析失败:', parseErr.message)
        return item
      }
      _validateDecryptedBinding(item, sensitive)
      _removeInternalFields(sensitive)
      return _applyDecryptedFields(item, sensitive)
    } catch (e) {
      // AES-GCM 解密失败 → 可能是 ECIES 格式，继续往下
    }
  }

  // 尝试 ECIES 解密（公司私钥）
  if (item.scope === 'company') {
    var cPriv = getCompanyPrivateKey()
    if (cPriv) {
      try {
        return companyDecryptItem(item, cPriv)
      } catch (e2) {
        console.warn('[crypto] ECIES 解密失败:', e2.message)
      }
    }
  }

  console.warn('[crypto] 收到加密数据但无法解密（无对应密钥），保持密文')
  return item
}

/**
 * 应用解密后的敏感字段到 item
 */
function _applyDecryptedFields(item, sensitive) {
  var result = {}
  var keys = Object.keys(item)
  for (var k = 0; k < keys.length; k++) {
    result[keys[k]] = item[keys[k]]
  }
  var sKeys = Object.keys(sensitive)
  for (var j = 0; j < sKeys.length; j++) {
    result[sKeys[j]] = sensitive[sKeys[j]]
  }
  return result
}

function _validateDecryptedBinding(item, sensitive) {
  // 旧版密文没有绑定信息，继续兼容读取；新版必须防止服务端交换账单密文、
  // 修改 scope 或篡改结算操作类型。
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

/**
 * ECIES 私钥解密单个 item（老板读员工账时调用）
 * @param {object} item
 * @param {string} privateKeyHex — 公司私钥 hex
 */
function companyDecryptItem(item, privateKeyHex) {
  var encrypted = item.encrypted_data || item.encryptedData
  if (!encrypted) return item
  assertAccountKeyOwnership()

  var ecc = _getEcc()
  if (!ecc) throw new Error('ECC 加密模块未加载')

  var privBytes = _hexToBytes(privateKeyHex)
  var blobBytes = _fromBase64(encrypted)
  var decrypted = ecc.eciesDecrypt(blobBytes, privBytes)
  var sensitive = JSON.parse(_textDecoder().decode(decrypted))
  _validateDecryptedBinding(item, sensitive)
  _removeInternalFields(sensitive)
  return _applyDecryptedFields(item, sensitive)
}

// ==================== 状态查询 ====================

function isEncryptionEnabled() {
  return !!wx.getStorageSync(KEY_ENABLED) && isKeyOwnedByCurrentUser()
}

function isAdvancedSecurityEnabled() {
  return isEncryptionEnabled() && !!wx.getStorageSync(KEY_ADVANCED)
}

// ==================== 密钥派生 & 恢复 ====================

/**
 * PBKDF2-HMAC-SHA256 从手机号派生 recovery key
 */
function _deriveRecoveryKey(phoneNumber, extraKey, salt) {
  var enc = _textEncoder()
  var phoneBytes = enc.encode(phoneNumber)
  var saltBytes = salt ? _hexToBytes(salt) : _randomBytes(16)
  // 确保 saltBytes 是 Uint8Array（真机 wx.getRandomValues 可能返回 wrapper object）
  if (!(saltBytes instanceof Uint8Array)) {
    var tmp = new Uint8Array(16)
    for (var i = 0; i < 16; i++) tmp[i] = saltBytes[i] || 0
    saltBytes = tmp
  }

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
 * 创建不可恢复的云端标记。
 *
 * 默认模式不能再用服务端已知的手机号包装主密钥，否则服务端同时持有
 * 手机号、salt 和 blob，并不是真正的端到端加密。这里用一次性随机密钥
 * 包装主密钥后立即丢弃该密钥；换设备必须导入用户保存的 64 位主密钥。
 */
function createManualBackup() {
  var masterKey = _getMasterKey()
  if (!masterKey) throw new Error('主密钥丢失')
  var blob = _aesGcmEncrypt(_textEncoder().encode(MANUAL_KEY_CHECK), _hexToBytes(masterKey))
  wx.setStorageSync(KEY_BACKUP_PENDING, true)
  return {
    encryptedBlob: blob,
    salt: _bytesToHex(_randomBytes(16)),
    tier: 'manual'
  }
}

/** 用云端校验密文验证用户导入的主密钥，验证通过后才写入本地。 */
function verifyAndImportMasterKey(hex, encryptedBlob) {
  if (!/^[0-9a-fA-F]{64}$/.test(hex || '') || !encryptedBlob) {
    throw new Error('恢复密钥格式不正确')
  }
  var plain
  try {
    plain = _textDecoder().decode(_aesGcmDecrypt(encryptedBlob, _hexToBytes(hex)))
  } catch (e) {
    throw new Error('恢复密钥不正确')
  }
  if (plain !== MANUAL_KEY_CHECK) throw new Error('恢复密钥不正确')
  importMasterKey(hex)
  return true
}

/** 启用默认加密：主密钥只保存在客户端，服务端仅存不可恢复标记。 */
function setupEncryption() {
  var masterKey = generateMasterKey()
  _setMasterKey(masterKey)
  wx.setStorageSync(KEY_ENABLED, true)
  wx.setStorageSync(KEY_REQUIRED, true)
  wx.setStorageSync(KEY_ADVANCED, false)
  return createManualBackup()
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
function disableAdvancedSecurity(phoneNumber, advancedKey, encryptedBlob, salt) {
  if (!isEncryptionEnabled()) throw new Error('加密未启用')
  if (!advancedKey || advancedKey.length !== ADVANCED_KEY_LEN) {
    throw new Error('密钥格式不正确')
  }

  if (!encryptedBlob || !salt) throw new Error('缺少高级安全备份，无法验证密钥')

  // 必须解密服务端现有高级 blob，并与本地主密钥常量时间比对。
  var masterKey = _getMasterKey()
  if (!masterKey) throw new Error('主密钥丢失')
  var recovery = _deriveRecoveryKey(phoneNumber, advancedKey, salt)
  var recoveryKeyBytes = _hexToBytes(recovery.key)
  var masterBytes = _hexToBytes(masterKey)
  var recovered
  try {
    recovered = _aesGcmDecrypt(encryptedBlob, recoveryKeyBytes)
  } catch (e) {
    throw new Error('密钥验证失败')
  }
  if (recovered.length !== masterBytes.length) throw new Error('密钥验证失败')
  var mismatch = 0
  for (var i = 0; i < masterBytes.length; i++) mismatch |= recovered[i] ^ masterBytes[i]
  if (mismatch !== 0) throw new Error('密钥验证失败')

  return createManualBackup()
}

/**
 * 降级到个人版 blob（VIP 过期自动调用）
 * 不需要高级安全密钥验证，因为 masterKey 已在本地
 * 注意：纯计算函数，不修改本地状态。调用方应在 blob 上传成功后
 * 手动清除 e2e_advanced 标记并更新 UI。
 */
function downgradeToPersonal(phoneNumber) {
  return createManualBackup()
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
    wx.setStorageSync(KEY_REQUIRED, true)
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
    wx.setStorageSync(KEY_REQUIRED, true)
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
  if (!/^[0-9a-fA-F]{64}$/.test(hex || '')) {
    throw new Error('密钥格式不正确（需64位 hex）')
  }
  _setMasterKey(hex)
  wx.setStorageSync(KEY_ENABLED, true)
  wx.setStorageSync(KEY_REQUIRED, true)
  return true
}

// ==================== 开关控制 ====================

// [已注释] 未使用，加密走 setupEncryption 全流程
// function enableEncryption() {
//   wx.setStorageSync(KEY_ENABLED, true)
// }
//
// function disableEncryption() {
//   try { wx.removeStorageSync(KEY_MASTER) } catch (e) {}
//   try { wx.removeStorageSync(KEY_ENABLED) } catch (e) {}
//   try { wx.removeStorageSync(KEY_ADVANCED) } catch (e) {}
// }

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
        if (res.statusCode === 200) {
          wx.removeStorageSync(KEY_BACKUP_PENDING)
          resolve(res.data)
        }
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

  // 加解密（支持 AES-GCM + ECIES 自动路由）
  encryptItem: encryptItem,
  decryptItem: decryptItem,
  companyEncryptItem: companyEncryptItem,
  companyDecryptItem: companyDecryptItem,

  // 状态
  isEncryptionEnabled: isEncryptionEnabled,
  isAdvancedSecurityEnabled: isAdvancedSecurityEnabled,
  getKeyOwner: getKeyOwner,
  getAuthenticatedUserId: getAuthenticatedUserId,
  isKeyOwnedByCurrentUser: isKeyOwnedByCurrentUser,
  assertAccountKeyOwnership: assertAccountKeyOwnership,
  activateAccount: activateAccount,
  clearPersonalEncryptionState: clearPersonalEncryptionState,

  // 公司密钥
  hasCompanyKeys: hasCompanyKeys,
  isCompanyBoss: isCompanyBoss,
  setCompanyPrivateKey: setCompanyPrivateKey,
  getCompanyPrivateKey: getCompanyPrivateKey,
  setCompanyPublicKey: setCompanyPublicKey,
  getCompanyPublicKey: getCompanyPublicKey,
  clearCompanyKeys: clearCompanyKeys,

  // 密钥派生 & 恢复
  setupEncryption: setupEncryption,
  createManualBackup: createManualBackup,
  verifyAndImportMasterKey: verifyAndImportMasterKey,
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

  // 开关（已注释，走 setupEncryption 全流程）
  // enableEncryption: enableEncryption,
  // disableEncryption: disableEncryption,

  // 网络
  uploadKeyBlob: uploadKeyBlob,
  fetchKeyBlob: fetchKeyBlob
}
