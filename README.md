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

当前项目已经适配成单服务部署：

- 同一个 Node 服务同时提供前端页面和 `/api`
- 默认监听 `PORT`
- Docker 部署时默认暴露 `3000`

### 控制台推荐填写

- 服务名称：`languagelearning`
- 目标目录：留空
- Dockerfile 文件：选择 `有`
- Dockerfile 名称：`Dockerfile`
- 访问端口：`80`
- 服务端口：`3000`

### 环境变量怎么填

最少填这 3 个：

```bash
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com
PORT=3000
```

说明：

- `DEEPSEEK_API_KEY`：必须填完整 token，包含前缀 `sk-`
- `DEEPSEEK_BASE_URL`：保持 `https://api.deepseek.com` 即可
- `PORT`：填 `3000`，要和腾讯云里的服务端口一致

### 你截图里的表单应该这样填

- Git 仓库：`timhuang530/language-learning`
- Branch：`main`
- 服务名称：`languagelearning`
- 端口映射：
  - 访问端口：`80`
  - 服务端口：`3000`
- 目标目录：留空
- Dockerfile 文件：`有`
- Dockerfile 名称：`Dockerfile`

### 部署原理

腾讯云构建时会：

1. 用 `Dockerfile` 构建镜像
2. 在镜像里执行前端打包
3. 启动 `node server/index.mjs`
4. 由 Express 同时提供：
   - 前端页面
   - `/api` 接口

### 上线前建议

- 将当前这枚 DeepSeek token 立即轮换
- 环境变量直接配在腾讯云控制台，不要提交 `.env`
- 如果后面有自定义域名，再补 HTTPS 和域名解析
