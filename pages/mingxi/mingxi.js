// 明细主页面仅负责组装；具体职责按功能域拆分在 features/ 中。
const api = require('../../utils/api')
const xlsx = require('../../utils/xlsx')
const { playTap, setVolume } = require('../../utils/tapSound')
const { getTLang, getLangLabel } = require('../../utils/i18n')
const { createInitialData } = require('./model/create-initial-data')
const companyCrypto = require('./services/company-crypto')

const featureFactories = [
  require('./features/lifecycle'),
  require('./features/report'),
  require('./features/transactions'),
  require('./features/ledger'),
  require('./features/settings'),
  require('./features/customization'),
  require('./features/security'),
  require('./features/guide'),
  require('./features/assistant'),
  require('./features/vip'),
]

const dependencies = Object.assign({
  api,
  xlsx,
  playTap,
  setVolume,
  getTLang,
  getLangLabel,
}, companyCrypto)

const pageDefinition = featureFactories.reduce((definition, createMethods) => {
  return Object.assign(definition, createMethods(dependencies))
}, { data: createInitialData() })

Page(pageDefinition)
