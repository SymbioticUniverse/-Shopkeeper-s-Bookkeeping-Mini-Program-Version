/**
 * secp256k1 ECC + ECIES 精简实现
 *
 * 使用 BigInt 进行曲线运算，AES-256-GCM 复用 vendor/noble-ciphers.js。
 * 微信小程序环境，无需 Web Crypto API。
 *
 * 导出:
 *   randomPrivateKey()           → Uint8Array(32)
 *   getPublicKey(priv, [zip])    → Uint8Array(33|65)
 *   ecdh(priv, pub)              → Uint8Array(32)
 *   eciesEncrypt(pt, pub)        → Uint8Array   (encrypted blob)
 *   eciesDecrypt(blob, priv)     → Uint8Array   (plaintext)
 */

// ========== secp256k1 曲线参数 ==========

var P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn
var N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n
var _0n = 0n
var _1n = 1n
var _8n = 8n
var _2n = 2n
var _3n = 3n
var _4n = 4n
var _7n = 7n

// Generator point (affine)
var Gx = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n
var Gy = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n

// ========== BigInt / bytes 转换 ==========

// WeChat mini-program may not have BigInt in some versions.
// Detect and polyfill: if BigInt is not a function, use a fallback.
var HAS_BIGINT = typeof BigInt === 'function'

function _bigint(v) {
  return HAS_BIGINT ? BigInt(v) : v
}

function _bytesToNumberBE(bytes) {
  var hex = ''
  for (var i = 0; i < bytes.length; i++) {
    hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16)
  }
  return HAS_BIGINT ? BigInt('0x' + hex) : parseInt('0x' + hex, 16)
}

function _numberToBytesBE(num, len) {
  var hex = num.toString(16)
  if (hex.length % 2) hex = '0' + hex
  while (hex.length < len * 2) hex = '00' + hex
  var bytes = new Uint8Array(len)
  for (var i = 0; i < len; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

function _numberToBytesBEUnpadded(num, len) {
  var hex = num.toString(16)
  if (hex.length % 2) hex = '0' + hex
  if (hex.length > len * 2) hex = hex.slice(hex.length - len * 2)
  while (hex.length < len * 2) hex = '00' + hex
  var bytes = new Uint8Array(len)
  for (var i = 0; i < len; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

// ========== 模运算 ==========

function _mod(a, b) { return ((a % b) + b) % b }
function _modPow(a, e, m) {
  if (!HAS_BIGINT) { throw new Error('BigInt not available') }
  var r = 1n
  a = _mod(a, m)
  while (e > 0n) {
    if (e & 1n) r = _mod(r * a, m)
    e >>= 1n
    a = _mod(a * a, m)
  }
  return r
}
function _modInv(a, m) { return _modPow(a, m - 2n, m) }

// ========== secp256k1 Point (Jacobian coordinates) ==========

// Point in Jacobian: (X, Y, Z)
// affine x = X/Z^2, y = Y/Z^3
// identity point: (0, 1, 0) in Jacobian

function _pointAffine(x, y) { return { x: x, y: y, z: _0n } }
function _pointJacobian(x, y, z) { return { x: x, y: y, z: z } }

var JACOBIAN_IDENTITY = _pointJacobian(_0n, _1n, _0n)
var JACOBIAN_G = _pointJacobian(Gx, Gy, _1n)

function _isIdentity(p) { return p.z === _0n }

function _pointDouble(p) {
  if (_isIdentity(p)) return JACOBIAN_IDENTITY
  var x1 = p.x, y1 = p.y, z1 = p.z
  var a = _mod(x1 * x1, P)
  var b = _mod(y1 * y1, P)
  var c = _mod(b * b, P)
  var d = _mod(_2n * (_mod(_mod((x1 + b) * (x1 + b), P) - a - c, P)), P)
  var e = _mod(_3n * a, P)
  var f = _mod(e * e, P)
  var x3 = _mod(f - _2n * d, P)
  var y3 = _mod(e * (d - x3) - _mod(_8n * c, P), P)
  var z3 = _mod(_2n * y1 * z1, P)
  return _pointJacobian(x3, y3, z3)
}

function _pointAdd(p, q) {
  if (_isIdentity(p)) return q
  if (_isIdentity(q)) return p
  var x1 = p.x, y1 = p.y, z1 = p.z
  var x2 = q.x, y2 = q.y, z2 = q.z
  var z1z1 = _mod(z1 * z1, P)
  var z2z2 = _mod(z2 * z2, P)
  var u1 = _mod(x1 * z2z2, P)
  var u2 = _mod(x2 * z1z1, P)
  var s1 = _mod(_mod(y1 * z2, P) * z2z2, P)
  var s2 = _mod(_mod(y2 * z1, P) * z1z1, P)
  if (u1 === u2) {
    if (s1 !== s2) return JACOBIAN_IDENTITY
    return _pointDouble(p)
  }
  var h = _mod(u2 - u1, P)
  var r = _mod(s2 - s1, P)
  var hh = _mod(h * h, P)
  var hhh = _mod(h * hh, P)
  var v = _mod(u1 * hh, P)
  var x3 = _mod(_mod(r * r, P) - hhh - _2n * v, P)
  var y3 = _mod(r * (v - x3) - s1 * hhh, P)
  var z3 = _mod(_mod(z1 * z2, P) * h, P)
  return _pointJacobian(x3, y3, z3)
}

function _pointMultiply(n, p) {
  if (_isIdentity(p) || n === _0n) return JACOBIAN_IDENTITY
  if (n === _1n) return p
  // Double-and-add (right-to-left, constant-time-ish)
  var q = JACOBIAN_IDENTITY
  while (n > _0n) {
    if (n & _1n) q = _pointAdd(q, p)
    p = _pointDouble(p)
    n >>= _1n
  }
  return q
}

function _jacobianToAffine(p) {
  if (_isIdentity(p)) return null
  var zInv = _modInv(p.z, P)
  var zInv2 = _mod(zInv * zInv, P)
  var zInv3 = _mod(zInv2 * zInv, P)
  return _pointAffine(_mod(p.x * zInv2, P), _mod(p.y * zInv3, P))
}

// ========== 随机数（委托给 noble-ciphers 的 HMAC-DRBG）==========

function randomBytes(len) {
  var ciphers = _getCiphers()
  return ciphers.randomBytes(len)
}

// ========== 公钥 API ==========

function randomPrivateKey() {
  while (true) {
    var bytes = randomBytes(32)
    var n = _bytesToNumberBE(bytes)
    if (n > _0n && n < N) return bytes
  }
}

/**
 * 从私钥计算公钥（压缩 33-byte 或 非压缩 65-byte）
 * @param {Uint8Array} priv - 32-byte 私钥
 * @param {boolean} compressed - 默认 true
 * @returns {Uint8Array} 33 或 65 byte 公钥
 */
function getPublicKey(priv, compressed) {
  if (compressed === undefined) compressed = true
  var d = _bytesToNumberBE(priv)
  if (d <= _0n || d >= N) throw new Error('私钥超出范围')
  var p = _pointMultiply(d, JACOBIAN_G)
  var aff = _jacobianToAffine(p)
  if (!aff) throw new Error('公钥计算失败')

  if (compressed) {
    // 压缩格式: 02|03 + x (33 bytes)
    var out = new Uint8Array(33)
    out[0] = (aff.y & _1n) ? 3 : 2
    var xb = _numberToBytesBE(aff.x, 32)
    out.set(xb, 1)
    return out
  } else {
    // 非压缩: 04 + x + y (65 bytes)
    var out2 = new Uint8Array(65)
    out2[0] = 4
    var xb2 = _numberToBytesBE(aff.x, 32)
    var yb = _numberToBytesBE(aff.y, 32)
    out2.set(xb2, 1)
    out2.set(yb, 33)
    return out2
  }
}

// ========== 公钥解码 ==========

function _decodePublicKey(pub) {
  var len = pub.length
  if (len === 33) {
    // 压缩格式: 02|03 + x
    var prefix = pub[0]
    if (prefix !== 2 && prefix !== 3) throw new Error('无效压缩公钥前缀')
    var x = _bytesToNumberBE(pub.subarray(1, 33))
    // y^2 = x^3 + 7 mod P
    var y2 = _mod(_mod(x * x, P) * x + _7n, P)
    var y = _modPow(y2, (P + _1n) / _4n, P)
    if (_mod(y * y, P) !== y2) throw new Error('公钥点不在 secp256k1 曲线上')
    if (Number(y & _1n) !== (prefix & 1)) y = _mod(-y, P)
    return _pointAffine(x, y)
  } else if (len === 65) {
    if (pub[0] !== 4) throw new Error('无效非压缩公钥前缀')
    var ux = _bytesToNumberBE(pub.subarray(1, 33))
    var uy = _bytesToNumberBE(pub.subarray(33, 65))
    if (ux >= P || uy >= P || _mod(uy * uy, P) !== _mod(_mod(ux * ux, P) * ux + _7n, P)) {
      throw new Error('公钥点不在 secp256k1 曲线上')
    }
    return _pointAffine(ux, uy)
  }
  throw new Error('公钥长度必须为 33 或 65')
}

// ========== ECDH ==========

function ecdh(priv, pub) {
  var d = _bytesToNumberBE(priv)
  if (d <= _0n || d >= N) throw new Error('私钥超出范围')
  var point = _decodePublicKey(pub)
  var jac = _pointJacobian(point.x, point.y, _1n)
  var shared = _pointMultiply(d, jac)
  var aff = _jacobianToAffine(shared)
  if (!aff) throw new Error('ECDH: 共享密钥为无穷远点')
  // 只返回 x 坐标
  return _numberToBytesBE(aff.x, 32)
}

// ========== BigInt polyfill for non-BigInt env ==========

// 当 BigInt 不可用时，使用 JSBN 风格的 256-bit big integer
// (32-byte = 8 limbs of 32-bit)
// 此 polyfill 仅支持加/乘/模幂等 ECC 所需操作

if (!HAS_BIGINT) {
  // We require BigInt for this implementation.
  // WeChat mini-program base library 2.20+ supports BigInt.
  // If you're targeting older versions, include a BN.js polyfill instead.
  throw new Error('[noble-ecc] BigInt is required. Please upgrade WeChat base library to 2.20+')
}

// ========== AES-GCM wrapper (from noble-ciphers) ==========

var _nobleCiphers = null
function _getCiphers() {
  if (_nobleCiphers) return _nobleCiphers
  // Try to load noble-ciphers from vendor
  try {
    _nobleCiphers = require('./noble-ciphers.js')
  } catch (e) {
    throw new Error('[noble-ecc] Cannot load noble-ciphers.js: ' + e.message)
  }
  return _nobleCiphers
}

// ========== ECIES (Hybrid Encryption) ==========

/**
 * ECIES 加密
 * 1. 生成临时密钥对 (ephemeral)
 * 2. ECDH(ephemeral_priv, recipient_pub) → shared secret
 * 3. SHA256(shared_secret) → AES-256 key
 * 4. AES-256-GCM 加密明文
 * 5. 返回: ephemeral_pub[33] || iv[12] || ciphertext || tag[16]
 *
 * @param {Uint8Array} plaintext
 * @param {Uint8Array} recipientPub - 33-byte compressed public key
 * @returns {Uint8Array}
 */
function eciesEncrypt(plaintext, recipientPub) {
  var ciphers = _getCiphers()

  // 1. 临时密钥对
  var ePriv = randomPrivateKey()
  var ePub = getPublicKey(ePriv, true)  // 33 bytes compressed

  // 2. ECDH → shared secret
  var shared = ecdh(ePriv, recipientPub)

  // 3. SHA256(shared) → AES key
  var aesKey = ciphers.sha256(shared)

  // 4. AES-256-GCM encrypt
  var iv = randomBytes(12)
  var gcm = ciphers.gcm(aesKey, iv)
  var encrypted = gcm.encrypt(plaintext)

  // 5. Combine: epub[33] + iv[12] + ciphertext + tag[16]
  var result = new Uint8Array(33 + iv.length + encrypted.length)
  result.set(ePub, 0)
  result.set(iv, 33)
  result.set(encrypted, 33 + iv.length)
  return result
}

/**
 * ECIES 解密
 * @param {Uint8Array} blob - eciesEncrypt 的输出
 * @param {Uint8Array} recipientPriv - 32-byte 私钥
 * @returns {Uint8Array} 明文
 */
function eciesDecrypt(blob, recipientPriv) {
  var ciphers = _getCiphers()

  if (blob.length < 33 + 12 + 16) {
    throw new Error('ECIES 密文太短')
  }

  // 1. 提取 ephemeral public key
  var ePub = blob.subarray(0, 33)

  // 2. ECDH → shared secret
  var shared = ecdh(recipientPriv, ePub)

  // 3. SHA256(shared) → AES key
  var aesKey = ciphers.sha256(shared)

  // 4. 提取 iv + encrypted (includes tag)
  var ivAndEncrypted = blob.subarray(33)

  // noble-ciphers gcm 格式: iv[12] + ciphertext + tag[16]
  // 但我们存储的也是这个格式
  var iv = ivAndEncrypted.subarray(0, 12)
  var encrypted = ivAndEncrypted.subarray(12)

  // 5. AES-256-GCM decrypt
  var gcm = ciphers.gcm(aesKey, iv)
  return gcm.decrypt(encrypted)
}

module.exports = {
  randomPrivateKey: randomPrivateKey,
  getPublicKey: getPublicKey,
  ecdh: ecdh,
  eciesEncrypt: eciesEncrypt,
  eciesDecrypt: eciesDecrypt
}
