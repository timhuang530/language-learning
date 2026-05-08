# Talk With Me

一个移动端优先的英语学习原型，聚焦：

- 首次能力测评
- 词汇卡片与查词
- Reader 分级阅读
- Talk With Me 口语对话
- 语法场景课
- 自动历史记录与本地持久化

## 当前技术结构

- 前端：`React + TypeScript + Vite`
- 后端：`Express`
- 大模型：`DeepSeek`，通过服务端代理访问
- 本地存储：`localStorage`
- 语音：
  - 播放：浏览器 `SpeechSynthesis`
  - 录音转写：优先浏览器 `SpeechRecognition / webkitSpeechRecognition`
  - 无原生识别时自动回退为 demo 流式模拟

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 创建环境变量

```bash
cp .env.example .env
```

3. 在 `.env` 中填入你的 DeepSeek key

```bash
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
PORT=8787
```

4. 启动前后端联调

```bash
npm run dev
```

默认会启动：

- Web: `http://localhost:5173` 或下一个可用端口
- API: `http://localhost:8787`

## 构建检查

```bash
npm run build
npm run build:server
```

## 当前已接入的能力

- 词汇搜索会通过 `/api/vocabulary/search` 调用后端
- `Talk With Me` 会通过 `/api/talk` 调用后端
- 当未配置 DeepSeek key 时，后端会自动回退到 mock 数据，保证 demo 仍然可运行
- 收藏词、聊天记录、查词记录、测评完成状态会自动保存在浏览器本地

## 安全说明

- 不要把 `.env` 提交到仓库
- 前端不会直接暴露 DeepSeek key
- 模型调用统一走服务端代理

## 腾讯云部署建议

推荐拆成两个服务：

- 前端静态站点：部署到腾讯云静态网站托管或 COS + CDN
- 后端 API：部署到腾讯云轻量应用服务器 / CVM / 云托管

### 方式一：同机部署

适合当前阶段，最省事。

1. 服务器安装 Node.js 20+
2. 拉取仓库
3. 创建 `.env`
4. 执行：

```bash
npm install
npm run build
node server/index.mjs
```

5. 用 Nginx：
- 将前端 `dist/` 指向站点根目录
- 将 `/api` 反向代理到 `http://localhost:8787`

### 方式二：前后端分离

- 前端：打包后上传到腾讯云静态站点
- 后端：单独部署 Node 服务
- 前端通过域名或网关访问后端 `/api`

### 必要环境变量

```bash
DEEPSEEK_API_KEY=你的新 token
DEEPSEEK_BASE_URL=https://api.deepseek.com
PORT=8787
```

### 上线前建议

- 将当前这枚 DeepSeek token 立即轮换
- 在服务器上只保留 `.env`，不要写入仓库
- 给 Node 服务加 `pm2` 或 systemd 守护
- 为 `/api` 配置 HTTPS 和反向代理
