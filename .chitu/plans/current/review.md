# 自审 — 收尾清理

## 变更文件

### 1. `utils/api.js` — BASE_URL 更新
- 从 `http://192.168.1.111:3000/api` 改为 `http://8.134.250.114:8080/api`
- 对齐 docker-compose 端口变更（80→8080）和公网部署 IP

### 2. `.chitu/context/intent.json` — 会话状态更新

## 自审检查

| 检查项 | 状态 |
|--------|------|
| BASE_URL 与 docker-compose 端口一致（8080） | ✅ |
| BASE_URL 使用公网 IP | ✅ |
| 无其他意外变更 | ✅ |
