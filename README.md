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
