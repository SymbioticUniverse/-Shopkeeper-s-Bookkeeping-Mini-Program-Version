/**
 * 极简 .xlsx 生成器 — 纯前端，无第三方依赖
 *
 * .xlsx 本质是一个 ZIP 包，里面装 OOXML 的 XML 文件。
 * 为了不引入压缩库，这里用 ZIP「stored」(不压缩) 方式打包，自己算 CRC32。
 * 文本用 inlineStr 内联，免去 sharedStrings 表。
 *
 * 用法：
 *   const xlsx = require('../../utils/xlsx')
 *   const buffer = xlsx.buildXlsx([
 *     { name: '总表', rows: [['日期','金额'], ['2025-06-01', 100]] },
 *     { name: '报表', rows: [...] },
 *   ])
 *   // buffer 是 ArrayBuffer，可直接 writeFileSync
 *
 * 单元格：number → 数值单元格；其余 → 文本（内联字符串）。空串/null 跳过。
 * 想加样式（加粗/底色）时，单元格写成对象 { v, s }，s 是样式索引：
 *   xlsx.STYLE.HEAD(表头灰底加粗) / STYLE.INCOME(红底白字) / STYLE.EXPENSE(黑底白字)
 */

// 样式索引（对应 styles.xml 的 cellXfs 顺序）
const STYLE = { DEFAULT: 0, HEAD: 1, INCOME: 2, EXPENSE: 3, DATE: 4 }

// ==================== UTF-8 编码 ====================

function utf8Encode(str) {
  const bytes = []
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i)
    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F))
    } else if (code >= 0xD800 && code <= 0xDBFF) {
      // 代理对：组合成完整码点
      const hi = code
      const lo = str.charCodeAt(++i)
      code = 0x10000 + ((hi - 0xD800) << 10) + (lo - 0xDC00)
      bytes.push(
        0xF0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3F),
        0x80 | ((code >> 6) & 0x3F),
        0x80 | (code & 0x3F)
      )
    } else {
      bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F))
    }
  }
  return bytes
}

// ==================== CRC32 ====================

const CRC_TABLE = (function () {
  const table = new Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF]
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

// ==================== XML 工具 ====================

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// 列号：0→A 1→B ... 25→Z 26→AA
function colName(n) {
  let s = ''
  n = n + 1
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

// sheet 名：去非法字符，截断 31
function safeSheetName(name, idx) {
  let n = String(name || ('Sheet' + (idx + 1))).replace(/[\[\]:*?/\\]/g, ' ').trim()
  if (!n) n = 'Sheet' + (idx + 1)
  return n.slice(0, 31)
}

// ==================== 工作表 XML ====================

// 单元格可为：原始值(number/string) 或 { v, s }(s=样式索引)
function cellParts(raw) {
  if (raw && typeof raw === 'object' && !(raw instanceof Array)) {
    return { v: raw.v, s: raw.s || 0 }
  }
  return { v: raw, s: 0 }
}

function buildSheetXml(rows) {
  let body = ''
  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r] || []
    let rowCells = ''
    for (let c = 0; c < cells.length; c++) {
      const { v, s } = cellParts(cells[c])
      const ref = colName(c) + (r + 1)
      const sAttr = s ? ' s="' + s + '"' : ''
      if (v === '' || v === null || v === undefined) {
        // 空值：有样式则发一个带底色的空单元格（用于整行色带），否则跳过
        if (s) rowCells += '<c r="' + ref + '"' + sAttr + '/>'
        continue
      }
      if (typeof v === 'number' && isFinite(v)) {
        rowCells += '<c r="' + ref + '"' + sAttr + '><v>' + v + '</v></c>'
      } else {
        rowCells += '<c r="' + ref + '"' + sAttr + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEscape(v) + '</t></is></c>'
      }
    }
    body += '<row r="' + (r + 1) + '">' + rowCells + '</row>'
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetData>' + body + '</sheetData></worksheet>'
}

// ==================== 包级 XML ====================

function buildContentTypes(sheetCount) {
  let overrides = ''
  for (let i = 1; i <= sheetCount; i++) {
    overrides += '<Override PartName="/xl/worksheets/sheet' + i +
      '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    overrides + '</Types>'
}

// 样式表：3 个字体 + 5 个填充 + 4 个 cellXfs（对应 STYLE 索引）
function buildStyles() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="3">' +
    '<font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font>' +
    '</fonts>' +
    '<fills count="6">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEDEDED"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFef4444"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF333333"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF2F6BD6"/></patternFill></fill>' +
    '</fills>' +
    '<borders count="1"><border/></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="5">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="0" fontId="2" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="0" fontId="2" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>'
}

function buildRootRels() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>'
}

function buildWorkbook(sheetNames) {
  let sheets = ''
  for (let i = 0; i < sheetNames.length; i++) {
    sheets += '<sheet name="' + xmlEscape(sheetNames[i]) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets>' + sheets + '</sheets></workbook>'
}

function buildWorkbookRels(sheetCount) {
  let rels = ''
  for (let i = 1; i <= sheetCount; i++) {
    rels += '<Relationship Id="rId' + i +
      '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ' +
      'Target="worksheets/sheet' + i + '.xml"/>'
  }
  // 样式表关系（rId 接在工作表之后）
  rels += '<Relationship Id="rId' + (sheetCount + 1) +
    '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    rels + '</Relationships>'
}

// ==================== ZIP 打包（stored，不压缩） ====================

function pushU16(arr, v) { arr.push(v & 0xFF, (v >>> 8) & 0xFF) }
function pushU32(arr, v) { arr.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF) }

// 固定 DOS 时间：2021-01-01 00:00（合法即可）
const DOS_DATE = ((2021 - 1980) << 9) | (1 << 5) | 1
const DOS_TIME = 0

function zip(files) {
  // files: [{ name, bytes(Array<number>) }]
  const out = []
  const central = []
  let offset = 0

  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    const nameBytes = utf8Encode(f.name)
    const data = f.bytes
    const crc = crc32(data)
    const size = data.length

    // —— 本地文件头 ——
    const localStart = offset
    pushU32(out, 0x04034b50)
    pushU16(out, 20)        // version needed
    pushU16(out, 0)         // flags
    pushU16(out, 0)         // method = stored
    pushU16(out, DOS_TIME)
    pushU16(out, DOS_DATE)
    pushU32(out, crc)
    pushU32(out, size)      // compressed
    pushU32(out, size)      // uncompressed
    pushU16(out, nameBytes.length)
    pushU16(out, 0)         // extra len
    for (let j = 0; j < nameBytes.length; j++) out.push(nameBytes[j])
    for (let j = 0; j < data.length; j++) out.push(data[j])
    offset = out.length

    // —— 中央目录项（暂存，最后统一追加） ——
    pushU32(central, 0x02014b50)
    pushU16(central, 20)    // version made by
    pushU16(central, 20)    // version needed
    pushU16(central, 0)     // flags
    pushU16(central, 0)     // method
    pushU16(central, DOS_TIME)
    pushU16(central, DOS_DATE)
    pushU32(central, crc)
    pushU32(central, size)
    pushU32(central, size)
    pushU16(central, nameBytes.length)
    pushU16(central, 0)     // extra len
    pushU16(central, 0)     // comment len
    pushU16(central, 0)     // disk start
    pushU16(central, 0)     // internal attrs
    pushU32(central, 0)     // external attrs
    pushU32(central, localStart)
    for (let j = 0; j < nameBytes.length; j++) central.push(nameBytes[j])
  }

  const centralStart = out.length
  for (let j = 0; j < central.length; j++) out.push(central[j])
  const centralSize = central.length

  // —— 中央目录结束记录 ——
  pushU32(out, 0x06054b50)
  pushU16(out, 0)                 // this disk
  pushU16(out, 0)                 // disk w/ central dir
  pushU16(out, files.length)      // entries this disk
  pushU16(out, files.length)      // total entries
  pushU32(out, centralSize)
  pushU32(out, centralStart)
  pushU16(out, 0)                 // comment len

  return new Uint8Array(out).buffer
}

// ==================== 对外入口 ====================

/**
 * 生成多 sheet 的 .xlsx
 * @param {Array<{name:string, rows:Array<Array<string|number>>}>} sheets
 * @returns {ArrayBuffer}
 */
function buildXlsx(sheets) {
  const list = (sheets || []).filter(s => s && s.rows)
  if (!list.length) throw new Error('no sheets')
  const names = list.map((s, i) => safeSheetName(s.name, i))

  const files = []
  const add = (name, str) => files.push({ name, bytes: utf8Encode(str) })

  add('[Content_Types].xml', buildContentTypes(list.length))
  add('_rels/.rels', buildRootRels())
  add('xl/workbook.xml', buildWorkbook(names))
  add('xl/_rels/workbook.xml.rels', buildWorkbookRels(list.length))
  add('xl/styles.xml', buildStyles())
  for (let i = 0; i < list.length; i++) {
    add('xl/worksheets/sheet' + (i + 1) + '.xml', buildSheetXml(list[i].rows))
  }

  return zip(files)
}

module.exports = { buildXlsx, STYLE }
