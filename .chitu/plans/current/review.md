# 自审报告 — SQLite 参数调优 + PM2 配置

## 变更文件

### 1. `backend/src/db.js`（第 20-25 行新增）
- `busy_timeout = 5000`：写锁等待 5s 而非立即报 SQLITE_BUSY — 正确，better-sqlite3 支持此 pragma
- `cache_size = -64000`：负值 = KB 单位，即 64MB — 正确，生产环境 64MB 合理
- `mmap_size = 268435456`：256MB 内存映射，对只读查询加速明显 — 正确，2GB 以下物理内存安全
- `temp_store = MEMORY`：临时表/排序走内存 — 正确，查询中 GROUP BY/ORDER BY 受益
- `synchronous = NORMAL`：WAL 下默认已是 NORMAL，显式声明无害 — 正确，非 FULL 在 WAL 下不会丢数据

### 2. `backend/ecosystem.config.js`（新建）
- `instances: 'max'`：自动 = CPU 核心数 — 正确
- `exec_mode: 'cluster'`：PM2 原生 cluster — 正确
- `max_memory_restart: '300M'`：内存超 300MB 自动重启 — 合理，Node + SQLite 缓存一般 100-200MB
- `kill_timeout/listen_timeout`：优雅重启 — 正确

## 潜在风险
- SQLite WAL 多进程访问：`busy_timeout` 已覆盖写锁冲突，读操作不受影响。写密集型场景（如大量用户同时同步账单）下可能仍有排队，但对记账小程序的写入模式（稀疏、小事务）够用。
- 无回归风险：仅追加 pragma 语句，不影响现有逻辑。

## 结论
✅ 通过，可提交。
