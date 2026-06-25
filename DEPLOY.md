# 阿里云部署指南

## 1. 买服务器

阿里云 → 轻量应用服务器 → 2c2g：
- **镜像**：Ubuntu 22.04
- **地域**：离小程序用户最近的
- 买完后记下**公网 IP**

---

## 2. 登录服务器

```bash
ssh root@你的公网IP
```

---

## 3. 装 Docker

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker --now
```

---

## 4. 拉代码 & 配环境变量

```bash
apt install -y git
git clone 你的仓库地址 /opt/jizhang
cd /opt/jizhang

# 创建 .env
cp backend/.env.example .env
vim .env
```

| 变量 | 说明 |
|------|------|
| `JWT_SECRET` | `openssl rand -hex 32` 生成 |
| `ALIYUN_ACCESS_KEY_ID` | 阿里云 RAM AK |
| `ALIYUN_ACCESS_KEY_SECRET` | 阿里云 RAM Secret |
| `ALIYUN_ASR_APPKEY` | 智能语音交互 AppKey |
| `WECHAT_APPID` | 小程序 AppID |
| `WECHAT_SECRET` | 小程序 AppSecret |
| `VOUCHER_BASE_URL` | `https://你的域名`（先填空，HTTPS 配好再填） |

---

## 5. 启动

```bash
docker compose up -d
```

验证：

```bash
docker compose logs -f api
curl http://你的公网IP/api/auth/test
```

---

## 6. 域名 + HTTPS（小程序必须）

### 6.1 DNS 解析

在域名控制台添加 A 记录：`jizhang.xxx.com → 公网IP`

### 6.2 签发免费 SSL 证书

```bash
apt install -y certbot
docker compose stop nginx
certbot certonly --standalone -d jizhang.xxx.com
```

### 6.3 挂载证书

```bash
mkdir -p /opt/jizhang/certs
cp /etc/letsencrypt/live/jizhang.xxx.com/fullchain.pem /opt/jizhang/certs/
cp /etc/letsencrypt/live/jizhang.xxx.com/privkey.pem   /opt/jizhang/certs/
```

### 6.4 开启 HTTPS

编辑 `nginx/default.conf`，取消注释 HTTPS server 块，改 `server_name` 为你的域名。

编辑 `docker-compose.yml`，取消注释两处：
```yaml
ports:
  - "443:443"
volumes:
  - ./certs:/etc/nginx/certs:ro
```

重启：
```bash
docker compose up -d nginx
```

---

## 7. 小程序后台配置

小程序后台 → 开发管理 → 服务器域名 → `request 合法域名`：

```
https://jizhang.xxx.com
```

---

## 8. 证书自动续期

```bash
crontab -e
```

添加：

```
0 3 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/jizhang.xxx.com/fullchain.pem /opt/jizhang/certs/ && cp /etc/letsencrypt/live/jizhang.xxx.com/privkey.pem /opt/jizhang/certs/ && docker compose -f /opt/jizhang/docker-compose.yml restart nginx
```

---

## 9. 日常维护

```bash
cd /opt/jizhang

docker compose up -d              # 启动
docker compose down               # 停止
docker compose restart api        # 重启 API
docker compose logs -f api        # 实时日志

# 更新代码
git pull && docker compose build api && docker compose up -d

# 备份数据库
cp data/sqlite/app.db data/sqlite/app.db.$(date +%Y%m%d_%H%M).bak
```

---

## 注意事项

- 阿里云安全组放行 **80 和 443** 端口
- SQLite 数据库在 `data/sqlite/app.db`，备份即全量备份
- 凭证/头像在 `data/voucher/`，建议一并备份
- Docker 的 `restart: unless-stopped` 已自动处理崩溃重启，不需要 PM2
