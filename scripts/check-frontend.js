const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pageRoot = path.join(root, 'pages/mingxi')

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
  getStorageSync() { return '' },
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

console.log(
  `前端完整性检查通过：${registeredMethods.length} 个页面方法，` +
  `${eventHandlers.size} 个事件绑定，${wxmlFiles.length} 个 WXML 文件`
)
