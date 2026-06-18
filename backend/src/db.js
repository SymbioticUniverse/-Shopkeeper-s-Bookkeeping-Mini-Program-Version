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
      expires_at TEXT NOT NULL
    );

    -- 账单表
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      scope TEXT NOT NULL CHECK(scope IN ('personal','company')),
      category TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('in','out')),
      type_label TEXT NOT NULL,
      amount TEXT NOT NULL,
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
}

module.exports = { db, initSchema }
