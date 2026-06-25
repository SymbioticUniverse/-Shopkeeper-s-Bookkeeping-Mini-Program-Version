# 自审 — Docker + Nginx 部署配置

## 检查项

1. **Dockerfile** — node:18-alpine，非 root 用户，`npm ci --omit=dev`，镜像精简 ✓
2. **.dockerignore** — 排除了 node_modules / data / logs / test 文件 / PM2 配置 ✓
3. **docker-compose.yml** — api + nginx 双容器，volume 持久化 SQLite 和上传文件，env 从宿主机 .env 注入 ✓
4. **nginx/default.conf** — 反代到 api:3000，透传 X-Forwarded-Proto，HTTPS server 块写好注释 ✓
5. **backend/.env.example** — 覆盖全部 8 个 process.env 变量 ✓
6. **DEPLOY.md** — 覆盖买服务器→装 Docker→部署→域名→HTTPS→续期→维护完整流程 ✓

## 边缘情况

- 无 HTTPS 时 VOUCHER_BASE_URL 为空不会崩（upload.js 有 fallback 到 req.protocol）
- SQLite WAL 模式 + mmap 在 Docker volume 中正常工作
- nginx client_max_body_size 10m 与 Express body limit 一致
- 容器重启策略 unless-stopped，无需 PM2
