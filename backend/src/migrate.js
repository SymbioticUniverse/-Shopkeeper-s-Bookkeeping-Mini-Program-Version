/**
 * 数据库迁移脚本 — 独立执行，初始化表结构
 * 用法: node src/migrate.js
 */
const { initSchema } = require('./db')

console.log('正在初始化数据库表结构...')
initSchema()
console.log('数据库迁移完成 ✓')
process.exit(0)
