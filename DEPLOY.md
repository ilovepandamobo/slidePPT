# SlideCraft 云端部署指南

推荐 **Railway**（支持 Docker、持久卷、长耗时 API）。不推荐 Vercel：无持久磁盘，且单请求超时过短，无法跑 4K 图片生成。

## 一、部署前准备

1. 注册 [Railway](https://railway.app) 并安装 CLI（可选）  
2. 将代码推送到 GitHub（Railway 可连仓库自动部署）  
3. 准备环境变量（见 `.env.example`）

**必填：**

| 变量 | 说明 |
|------|------|
| `JWT_SECRET` | 随机长字符串（生产必改） |
| `GRSAI_API_KEY` | GrsAI 密钥 |
| `NEXT_PUBLIC_APP_URL` | 部署后的公网地址，如 `https://xxx.up.railway.app` |

**建议：**

| 变量 | 说明 |
|------|------|
| `DATA_DIR` | `/data`（Docker 默认，配合持久卷） |
| `DATABASE_URL` | `file:/data/slidecraft.db`（默认，无需手填） |
| `RUN_SEED` | 首次部署设 `true`，写入演示账号与模板 |

## 二、Railway 部署（推荐）

### 方式 A：网页控制台

1. **New Project** → **Deploy from GitHub repo** → 选择本仓库  
2. **Settings** → **Build**：Builder 选 **Dockerfile**  
3. **Volumes** → **Add Volume**  
   - Mount Path：`/data`  
   - （数据库 + 幻灯片图片都会落在这个卷里）  
4. **Variables** 添加环境变量（见上表）  
5. **Settings** → **Networking** → **Generate Domain**  
6. 把生成的域名填回 `NEXT_PUBLIC_APP_URL`，保存后 **Redeploy**  
7. 首次部署完成后访问域名，用演示账号或自行注册

### 方式 B：Railway CLI

```bash
npm i -g @railway/cli
railway login
cd "/Users/carson/ai ppt"
railway init
railway volume add --mount-path /data
railway variables set JWT_SECRET="你的随机密钥"
railway variables set GRSAI_API_KEY="你的key"
railway variables set RUN_SEED="true"
railway up
railway domain
# 将域名写入 NEXT_PUBLIC_APP_URL 后再次 deploy
railway variables set NEXT_PUBLIC_APP_URL="https://你的域名"
railway up
```

## 三、本地验证 Docker 镜像

```bash
cd "/Users/carson/ai ppt"
docker build -t slidecraft .
docker run --rm -p 3000:3000 \
  -e JWT_SECRET="local-test-secret" \
  -e GRSAI_API_KEY="你的key" \
  -e NEXT_PUBLIC_APP_URL="http://localhost:3000" \
  -e RUN_SEED="true" \
  -v slidecraft-data:/data \
  slidecraft
```

浏览器打开 http://localhost:3000

## 四、注意事项

- **单实例**：当前使用 SQLite + 本地文件，请保持 **1 个** 服务实例，并挂载 `/data` 卷。  
- **生成耗时**：4K 单页可能 2–7 分钟，Railway Pro 计划请求超时更宽裕。  
- **费用**：按 Railway 用量计费；GrsAI 按张数另计。  
- **升级路径**：用户量变大后可迁 PostgreSQL + 对象存储（S3/OSS），需要再改一版架构。

## 五、更新发布

推送代码到 GitHub 后 Railway 会自动重新构建；或执行：

```bash
railway up
```

## 六、故障排查

| 现象 | 处理 |
|------|------|
| 分享链接仍是 localhost | 检查 `NEXT_PUBLIC_APP_URL` 是否为公网域名并已 Redeploy |
| 图片丢失 | 确认 Volume 挂载在 `/data`，且未扩容到多实例 |
| 生成失败 | 检查 `GRSAI_API_KEY`、Railway 日志 |
| 登录后 500 | 查看日志中 Prisma migrate 是否成功 |
