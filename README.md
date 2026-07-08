# SlideCraft — AI 一键专业 PPT

输入大纲 + 参考风格，自动生成风格统一的全套演示文稿。支持单页重生成、编辑、导出 PPTX/PDF、分享链接。

## 功能

- 模版中心（12+ 风格）
- 三步创作向导：风格 → 大纲 → 生成
- AI 大纲助手 & 智能分页
- 上传参考风格图
- 幻灯片编辑器：改字、重生成、删页、加页、上传配图
- 全 deck 对话改风格
- 导出 PPTX / PDF
- 在线放映 & 分享链接
- 版本历史、项目列表
- **GrsAI GPT Image 2** 生成幻灯片（推荐）；未配置时回退 SVG 渲染

## 快速开始

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run db:seed
npm run dev
```

打开 http://localhost:3000

**演示账号**：`demo@slidecraft.app` / `demo123456`

## 环境变量

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | SQLite 路径，默认 `file:./dev.db` |
| `JWT_SECRET` | 会话密钥 |
| `GRSAI_API_KEY` | GrsAI API Key，启用 gpt-image-2 |
| `GRSAI_BASE_URL` | 国内 `https://grsai.dakka.com.cn` 或海外 `https://grsaiapi.com` |
| `GRSAI_MODEL` | `gpt-image-2` 或 `gpt-image-2-vip` |
| `OPENAI_API_KEY` | 可选，大纲助手 + DALL·E 备用 |
| `NEXT_PUBLIC_APP_URL` | 站点 URL，用于分享链接 |

## 云端部署

详见 **[DEPLOY.md](./DEPLOY.md)**（Railway + Docker + 持久卷）。

快速要点：

1. 用 **Dockerfile** 部署，不要用纯 Serverless  
2. 挂载持久卷到 **`/data`**（数据库 + 图片）  
3. 设置 **`JWT_SECRET`**、**`GRSAI_API_KEY`**、**`NEXT_PUBLIC_APP_URL`**

## 技术栈

Next.js 16 · TypeScript · Tailwind CSS 4 · Prisma · SQLite · pptxgenjs · jspdf
