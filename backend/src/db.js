/**
 * 数据库连接与工具函数
 */
const path = require('path')
const Database = require('better-sqlite3')

const DB_PATH = path.join(__dirname, '..', 'data', 'app.db')

// 确保 data 目录存在
const fs = require('fs')
const dataDir = path.join(__dirname, '..', 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const db = new Database(DB_PATH)

// 启用 WAL 模式提升并发性能
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ==================== 初始化表结构 ====================

function initSchema() {
  db.exec(`
    -- 用户表
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      openid TEXT UNIQUE,
      nick_name TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 会话表
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 短信验证码表
    CREATE TABLE IF NOT EXISTS verify_codes (
      phone TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT
    );

    -- 账单表
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      scope TEXT NOT NULL CHECK(scope IN ('personal','company')),
      category TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('in','out')),
      type_label TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      note TEXT DEFAULT '',
      target TEXT DEFAULT '',
      target_type TEXT DEFAULT '',
      linked_id INTEGER DEFAULT NULL,
      voided INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 分类表
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      scope TEXT NOT NULL CHECK(scope IN ('personal','company')),
      cat_id TEXT NOT NULL,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL,
      in_out TEXT NOT NULL CHECK(in_out IN ('in','out')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, scope, cat_id)
    );

    -- 公司表
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      boss_title TEXT NOT NULL DEFAULT 'BOSS',
      boss_user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (boss_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 公司成员表
    CREATE TABLE IF NOT EXISTS company_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('boss','employee')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      joined_at TEXT,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(company_id, user_id)
    );

    -- 通知表
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      time TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'user' CHECK(source IN ('user','system')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 反馈表
    CREATE TABLE IF NOT EXISTS feedbacks (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      time TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 用户设置表
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, key)
    );

    -- 简览卡片表
    CREATE TABLE IF NOT EXISTS overview_cards (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      template_id TEXT DEFAULT '',
      name TEXT NOT NULL,
      subtitle TEXT DEFAULT '',
      type TEXT NOT NULL,
      span INTEGER NOT NULL DEFAULT 1,
      x INTEGER DEFAULT 0,
      y INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  // 索引（加速按用户+scope查询账单、用户查询通知）
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_items_user_scope ON items(user_id, scope);
    CREATE INDEX IF NOT EXISTS idx_items_linked ON items(linked_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  `)

  // Migration helper: 仅在列不存在时执行 ALTER TABLE
  function addColumnSafely(table, column, definition) {
    const colInfo = db.pragma(`table_info('${table}')`)
    if (!colInfo.some(c => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
      console.log(`[MIGRATE] ${table}.${column} 已添加`)
    }
  }

  // Migration: 为已有 verify_codes 表添加防暴力破解列
  addColumnSafely('verify_codes', 'failed_attempts', 'INTEGER NOT NULL DEFAULT 0')
  addColumnSafely('verify_codes', 'locked_until', 'TEXT')

  // Migration: 通知表加 source 列（user/system 区分，防止全量覆盖竞态）
  addColumnSafely('notifications', 'source', "TEXT NOT NULL DEFAULT 'user' CHECK(source IN ('user','system'))")

  // Migration: 添加 voucher 列（凭证图片 URL）
  addColumnSafely('items', 'voucher', "TEXT DEFAULT ''")

  // Migration: 添加结清相关列
  addColumnSafely('items', 'settleStatus', "TEXT DEFAULT NULL")
  addColumnSafely('items', 'settleInfo', 'TEXT DEFAULT NULL')
  addColumnSafely('items', '_autoSettle', 'INTEGER NOT NULL DEFAULT 0')

  // Migration: 通知表加 type 列（区分结清通知等类型）
  addColumnSafely('notifications', 'type', "TEXT DEFAULT ''")
  addColumnSafely('notifications', 'target_user_id', 'INTEGER DEFAULT NULL')
  addColumnSafely('notifications', 'item_id', 'INTEGER DEFAULT NULL')

  // Migration: 用户资料时间戳（毫秒），用于跨端 last-write-wins
  addColumnSafely('users', 'profile_updated_at', 'INTEGER NOT NULL DEFAULT 0')

  // Migration: amount TEXT → REAL（旧库存在时重建表）
  try {
    const colInfo = db.pragma('table_info(items)')
    const amountCol = colInfo.find(c => c.name === 'amount')
    if (amountCol && amountCol.type.toUpperCase() !== 'REAL') {
      db.transaction(() => {
        db.exec(`
          CREATE TABLE items_mig (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            scope TEXT NOT NULL CHECK(scope IN ('personal','company')),
            category TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('in','out')),
            type_label TEXT NOT NULL,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            note TEXT DEFAULT '',
            target TEXT DEFAULT '',
            target_type TEXT DEFAULT '',
            linked_id INTEGER DEFAULT NULL,
            voucher TEXT DEFAULT '',
            voided INTEGER NOT NULL DEFAULT 0,
            settleStatus TEXT DEFAULT NULL,
            settleInfo TEXT DEFAULT NULL,
            _autoSettle INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          );
          INSERT INTO items_mig
            SELECT id, user_id, scope, category, type, type_label,
                   CAST(amount AS REAL), date, note, target, target_type,
                   linked_id, voucher, voided,
                   settleStatus, settleInfo, _autoSettle, created_at
            FROM items;
          DROP TABLE items;
          ALTER TABLE items_mig RENAME TO items;
          CREATE INDEX IF NOT EXISTS idx_items_user_scope ON items(user_id, scope);
          CREATE INDEX IF NOT EXISTS idx_items_linked ON items(linked_id);
        `)
      })()
      console.log('[MIGRATE] amount 列已从 TEXT 迁移为 REAL')
    }
  } catch (e) {
    console.error('[MIGRATE] amount 列迁移失败:', e.message)
  }
}

module.exports = { db, initSchema }
