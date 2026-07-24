const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pageRoot = path.join(root, 'pages/mingxi')
const storage = { tapVibration: 0 }

function fail(message) {
  console.error(`前端完整性检查失败：${message}`)
  process.exit(1)
}

function createAudioContext() {
  return {
    _busy: false,
    onEnded() {},
    onStop() {},
    onError() {},
    stop() {},
    seek() {},
    play() {},
  }
}

global.wx = new Proxy({
  getStorageSync(key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : '' },
  setStorageSync(key, value) { storage[key] = value },
  removeStorageSync(key) { delete storage[key] },
  createInnerAudioContext: createAudioContext,
  arrayBufferToBase64() { return '' },
}, {
  get(target, key) {
    return key in target ? target[key] : function noop() { return {} }
  },
})

let pageDefinition
global.Page = function registerPage(definition) {
  pageDefinition = definition
}

require(path.join(pageRoot, 'mingxi.js'))

if (!pageDefinition || !pageDefinition.data) {
  fail('明细页没有成功注册')
}

const featureDir = path.join(pageRoot, 'features')
const featureFiles = fs.readdirSync(featureDir)
  .filter((name) => name.endsWith('.js'))
  .sort()

const seenMethods = new Map()
for (const fileName of featureFiles) {
  const createMethods = require(path.join(featureDir, fileName))
  const methods = createMethods({})
  for (const methodName of Object.keys(methods)) {
    if (seenMethods.has(methodName)) {
      fail(`${methodName} 同时出现在 ${seenMethods.get(methodName)} 和 ${fileName}`)
    }
    seenMethods.set(methodName, fileName)
  }
}

const registeredMethods = Object.keys(pageDefinition)
  .filter((key) => typeof pageDefinition[key] === 'function')

if (registeredMethods.length !== seenMethods.size) {
  fail(`功能模块方法数 ${seenMethods.size} 与页面注册方法数 ${registeredMethods.length} 不一致`)
}

function collectFiles(directory, extension, result = []) {
  for (const name of fs.readdirSync(directory)) {
    const target = path.join(directory, name)
    const stat = fs.statSync(target)
    if (stat.isDirectory()) collectFiles(target, extension, result)
    if (stat.isFile() && target.endsWith(extension)) result.push(target)
  }
  return result
}

const wxmlFiles = collectFiles(pageRoot, '.wxml')
const eventHandlers = new Set()
const eventPattern = /(?:bind|catch)[a-zA-Z:-]*\s*=\s*"([A-Za-z_$][\w$]*)"/g

for (const file of wxmlFiles) {
  const source = fs.readFileSync(file, 'utf8')
  let match
  while ((match = eventPattern.exec(source))) eventHandlers.add(match[1])

  for (const include of source.matchAll(/<include\s+src="([^"]+)"\s*\/>/g)) {
    const includePath = path.resolve(path.dirname(file), include[1])
    if (!fs.existsSync(includePath)) fail(`${file} 引用了不存在的 ${include[1]}`)
  }
}

const missingHandlers = [...eventHandlers]
  .filter((name) => typeof pageDefinition[name] !== 'function')
  .sort()

if (missingHandlers.length) {
  fail(`WXML 事件缺少页面方法：${missingHandlers.join(', ')}`)
}

const wxssEntry = fs.readFileSync(path.join(pageRoot, 'mingxi.wxss'), 'utf8')
for (const imported of wxssEntry.matchAll(/@import\s+"([^"]+)";/g)) {
  const importPath = path.resolve(pageRoot, imported[1])
  if (!fs.existsSync(importPath)) fail(`样式入口引用了不存在的 ${imported[1]}`)
}

const appConfig = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
for (const pagePath of appConfig.pages) {
  for (const extension of ['.js', '.json', '.wxml', '.wxss']) {
    const target = path.join(root, `${pagePath}${extension}`)
    if (!fs.existsSync(target)) fail(`主包页面文件缺失：${pagePath}${extension}`)
  }
}

const { createTabItems } = require(path.join(root, 'utils/tab-navigation'))
const configuredPages = new Set(appConfig.pages.map((pagePath) => `/${pagePath}`))
for (const item of createTabItems()) {
  if (!configuredPages.has(item.pagePath)) {
    fail(`Tab「${item.text}」指向未注册页面：${item.pagePath}`)
  }
}

if (pageDefinition.data.tapVibrationLevel !== 0 || pageDefinition.data.tapVibrationLabel !== '关闭') {
  fail('震动设置为关闭后被错误恢复成轻度')
}

const api = require(path.join(root, 'utils/api'))
const originalNow = Date.now
const fixedTimestamp = Number.parseInt('0190abcdef12', 16)
Date.now = () => fixedTimestamp
const generatedId = api.generateId()
Date.now = originalNow
if (!generatedId.startsWith('0190abcdef12')) {
  fail(`UUID v7 时间戳前缀错误：${generatedId.slice(0, 12)}`)
}

const reportItems = [
  { id: 'a', date: '2024-01-15', type: 'in', typeLabel: '收入', amount: '10', category: '工资' },
  { id: 'b', date: '2024-08-15', type: 'in', typeLabel: '收入', amount: '99', category: '奖金' },
]
const reportApi = { getItems() { return reportItems } }
const reportMethods = require(path.join(featureDir, 'report.js'))({ api: reportApi })
const lifecycleMethods = require(path.join(featureDir, 'lifecycle.js'))({ api: reportApi })
const reportContext = {
  data: {
    reportType: 0,
    reportPeriod: 1,
    reportPickerDate: '2024-08',
    reportSelectedYear: 2024,
    reportQuarterMultiIndex: [0, 0],
  },
  _inReportRange: reportMethods._inReportRange,
}
const quarterChart = lifecycleMethods._aggregateChartData.call(reportContext, 'personal')
if (quarterChart.length !== 1 || quarterChart[0].label !== '1月' || quarterChart[0].income !== 10) {
  fail('季度图表没有严格使用已选择的季度范围')
}
const quarterPie = reportMethods.generatePieData.call(reportContext, 'personal')
if (quarterPie.income.length !== 1 || quarterPie.income[0].name !== '工资' || quarterPie.income[0].value !== 10) {
  fail('季度饼图与报表汇总的日期范围不一致')
}

const detailSource = [
  { id: 'a', date: '2026-07-01', typeLabel: '支出', category: '餐饮', amount: '20' },
  { id: 'b', date: '2026-06-01', typeLabel: '支出', category: '餐饮', amount: '10', _voided: true },
]
const detailApi = {
  getItemsIncludingVoided() { return detailSource },
  getCategories() { return [{ name: '餐饮', emoji: '🍚' }] },
}
const transactionMethods = require(path.join(featureDir, 'transactions.js'))({ api: detailApi })
const detailContext = {
  data: {
    detailType: 0,
    detailPeriod: 0,
    detailPickerDate: '2026-06',
    detailQuarterMultiIndex: [0, 0],
    detailSelectedYear: 2026,
    searchText: '',
    personalCategories: [],
    companyCategories: [],
  },
  _inDetailRange: transactionMethods._inDetailRange,
  _matchSearch: transactionMethods._matchSearch,
  _buildDetailList: transactionMethods._buildDetailList,
  _buildDetailGroups: transactionMethods._buildDetailGroups,
  setData(patch) { Object.assign(this.data, patch) },
}
transactionMethods.initDetailItems.call(detailContext)
if (detailContext.data.detailItems.length !== 1 ||
    detailContext.data.detailItems[0].date !== '2026-06-01' ||
    detailContext.data.detailItems[0]._voided !== true) {
  fail('明细周期筛选或作废记录恢复入口失效')
}

console.log(
  `前端完整性检查通过：${registeredMethods.length} 个页面方法，` +
  `${eventHandlers.size} 个事件绑定，${wxmlFiles.length} 个 WXML 文件，5 组行为回归`
)
