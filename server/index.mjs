import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const port = Number(process.env.PORT || 3000)
const deepseekApiKey = process.env.DEEPSEEK_API_KEY?.trim()
const deepseekBaseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const currentFilePath = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFilePath)
const distDir = path.resolve(currentDir, '../dist')
const indexHtmlPath = path.join(distDir, 'index.html')
let lastDeepSeekError = null
let lastDeepSeekSuccessAt = null

function getKeyStatus() {
  if (!deepseekApiKey) {
    return {
      configured: false,
      reason: 'missing_key',
      maskedKey: null,
    }
  }

  if (!deepseekApiKey.startsWith('sk-')) {
    return {
      configured: false,
      reason: 'invalid_key_prefix',
      maskedKey: `${deepseekApiKey.slice(0, 4)}***`,
    }
  }

  return {
    configured: true,
    reason: 'ok',
    maskedKey: `${deepseekApiKey.slice(0, 6)}***${deepseekApiKey.slice(-4)}`,
  }
}

app.use(cors())
app.use(express.json({ limit: '2mb' }))

const fallbackDictionary = {
  compromise: {
    term: 'compromise',
    phonetic: '/ˈkɑːmprəmaɪz/',
    partOfSpeech: '名词/动词 (noun/verb)',
    definitionZh: '妥协，折中。双方各退一步，最后找到一个都能接受的中间方案。',
    scene: 'Work',
    imageLabel: 'Team discussion with two people meeting in the middle',
    usage:
      '常见搭配：reach a compromise (达成妥协)，make a compromise (做出让步)。作为动词时可以接 on something。',
    culture:
      '在英语语境里，愿意 compromise 通常会让你显得成熟、合作，而不是没主见。',
    related: ['agreement', 'middle ground', 'negotiation'],
    confusing:
      '和 concession 不一样。compromise 更像双方都退一步，concession 更像你单方面让步。',
    examples: [
      {
        en: 'We need to reach a compromise on the budget before Friday.',
        zh: '我们需要在周五前就预算问题达成折中方案。',
      },
      {
        en: 'She was willing to compromise so the project could move forward.',
        zh: '她愿意做出妥协，这样项目才能继续推进。',
      },
    ],
  },
  itinerary: {
    term: 'itinerary',
    phonetic: '/aɪˈtɪnəreri/',
    partOfSpeech: '名词 (noun)',
    definitionZh: '行程安排。通常是旅行中每天要去哪里、做什么的计划。',
    scene: 'Travel',
    imageLabel: 'Travel itinerary with landmarks and schedule',
    usage:
      '作为名词使用。旅游英语里很常见，既可以指完整行程，也可以指机票或酒店确认中的行程信息。搭配：plan an itinerary (制定行程)。',
    culture:
      '如果你说 my itinerary changed，对方会默认你整个旅行安排有调整，不只是一个小预约变了。',
    related: ['schedule', 'plan', 'travel plan'],
    confusing: 'schedule 更泛，itinerary 更偏旅行或正式行程安排。',
    examples: [
      {
        en: 'Our itinerary includes Tokyo, Kyoto, and Osaka.',
        zh: '我们的行程安排包括东京、京都和大阪。',
      },
      {
        en: 'Could you email me the updated itinerary?',
        zh: '你可以把更新后的行程发邮件给我吗？',
      },
    ],
  },
}

const fallbackReaderItems = [
  {
    id: 'speech-habits',
    title: 'How Small Habits Shape Better Workdays',
    source: 'Speech digest',
    level: '适合母语 7-8 年级',
    minutes: '4 min',
    tag: 'Work',
    summary: '一篇轻量职场读物，讲日常小习惯如何影响专注力和沟通效率。',
    keyWord: 'routine',
    keyWordMeaning: '固定做事节奏，日常习惯流程',
    sentence: 'A steady routine can lower stress and make hard tasks feel smaller.',
    sentenceZh: '稳定的日常节奏可以降低压力，也会让难任务看起来没那么吓人。',
    prompt: '和我聊聊你自己的工作习惯，以及你最想调整的一件事。',
  },
  {
    id: 'travel-city',
    title: 'A Weekend Walk Through an Old City',
    source: 'Travel story',
    level: '适合母语 6-7 年级',
    minutes: '3 min',
    tag: 'Travel',
    summary: '一篇偏生活化的旅行短文，适合练地点描述、感受表达和见闻复述。',
    keyWord: 'wander',
    keyWordMeaning: '闲逛，漫步，没有太强目的地到处看看',
    sentence: 'We wandered through quiet streets until the city slowly woke up.',
    sentenceZh: '我们在安静的街道上闲逛，直到整座城市慢慢醒来。',
    prompt: '用比较轻松的方式和我聊一聊你最喜欢的旅行城市。',
  },
]

const sceneCycle = ['Daily', 'Work', 'Meeting', 'Interview', 'Travel']

function buildDictionaryFallback(query, mode) {
  const keyword = query.trim().toLowerCase()
  const exact = fallbackDictionary[keyword]

  if (exact) {
    return exact
  }

  return {
    term: mode === 'describe' ? 'procrastinate' : query.trim() || 'procrastinate',
    phonetic: '/prəˈkræstɪneɪt/',
    partOfSpeech: '动词 (verb)',
    definitionZh: '拖延。总是把该做的事情推到最后一刻才做。',
    scene: 'Work',
    imageLabel: 'a person looking stressed at a clock',
    usage: '用作不及物动词。常用于描述工作、学习中未能按时完成任务的情况。常见搭配：procrastinate on something (在某事上拖延)。',
    culture: '在现代职场和学习中常被视为一个负面习惯，但在非正式聊天中经常用来互相调侃。',
    related: ['delay', 'postpone', 'put off'],
    confusing: 'delay (偏客观的延迟) vs procrastinate (偏主观的、有意的拖延)',
    examples: [
      {
        en: "I always procrastinate when I have a difficult project.",
        zh: '遇到困难的项目时，我总是拖延。',
      },
      {
        en: "Stop procrastinating and get back to work!",
        zh: '别拖延了，快回去工作！',
      },
    ],
  }
}

function buildDailyWordsFallback(scenes = sceneCycle) {
  const baseItems = Object.values(fallbackDictionary)

  return Array.from({ length: 5 }).map((_, index) => {
    const source = baseItems[index % baseItems.length]
    const scene = scenes[index % scenes.length] || sceneCycle[index % sceneCycle.length]
    return {
      ...source,
      id: `${source.term}-${scene.toLowerCase()}-${index}`,
      scene,
    }
  })
}

function buildReaderFallback() {
  return fallbackReaderItems
}

async function requestDeepSeek(messages, responseFormat) {
  const keyStatus = getKeyStatus()

  if (!keyStatus.configured) {
    throw new Error(keyStatus.reason)
  }

  const response = await fetch(`${deepseekBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${deepseekApiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.7,
      messages,
      response_format: responseFormat,
    }),
  })

  if (!response.ok) {
    const message = await response.text()
    lastDeepSeekError = {
      at: new Date().toISOString(),
      status: response.status,
      message: message || 'deepseek_request_failed',
    }
    throw new Error(message || 'deepseek_request_failed')
  }

  const data = await response.json()
  lastDeepSeekSuccessAt = new Date().toISOString()
  lastDeepSeekError = null
  return data
}

app.get('/api/health', (_req, res) => {
  const keyStatus = getKeyStatus()
  res.json({
    ok: true,
    provider: keyStatus.configured ? 'deepseek' : 'mock',
    deepseek: {
      configured: keyStatus.configured,
      reason: keyStatus.reason,
      maskedKey: keyStatus.maskedKey,
      baseUrl: deepseekBaseUrl,
      lastSuccessAt: lastDeepSeekSuccessAt,
      lastError: lastDeepSeekError,
    },
  })
})

app.post('/api/vocabulary/search', async (req, res) => {
  const { query = '', mode = 'direct' } = req.body ?? {}

  if (!query.trim()) {
    return res.status(400).json({ error: 'query_required' })
  }

  if (!deepseekApiKey) {
    return res.json({
      source: 'mock',
      item: buildDictionaryFallback(query, mode),
    })
  }

  try {
    const completion = await requestDeepSeek(
      [
        {
          role: 'system',
          content: `你是一个专业的英语母语外教。请解释单词/短语 "${query}"。
要求：
1. 语言自然、生动有趣，避免教条化。
2. definitionZh 是该词汇在具体语境下的中文自然解释。
3. partOfSpeech 必须是"中文 (英文)"格式，如"名词 (noun)", "动词 (verb)"。
4. imageLabel 是用于给AI绘画模型生成插图的英文提示词，必须是简短、具象的视觉描述（例如 "a calendar with events listed"）。
5. usage 是对用法的详细说明，必须介绍该词语作为此词性时的搭配习惯、常见短语、适用场景和注意事项。绝对不要仅仅返回一个例句，必须是一段中文为主的说明性文字。
6. culture 解释文化背景或语气差异。
7. confusing 解释容易混淆的词。
8. 严格返回 JSON 对象，遵循以下字段结构：
{
  "term": "单词",
  "phonetic": "音标",
  "partOfSpeech": "词性(双语)",
  "definitionZh": "中文释义",
  "scene": "所属场景分类(如 Work, Daily)",
  "imageLabel": "英文视觉描述",
  "usage": "详细用法说明与搭配",
  "culture": "文化背景/语气",
  "related": ["相关词1", "相关词2"],
  "confusing": "易混词解释",
  "examples": [
    { "en": "例句1", "zh": "中文翻译1" },
    { "en": "例句2", "zh": "中文翻译2" }
  ]
}`,
        },
        {
          role: 'user',
          content:
            mode === 'describe'
              ? `用户会用中文描述想表达的意思，请帮他找最合适的英文词或短语，并按要求输出词卡 JSON。描述：${query}`
              : `请围绕英文词或短语 ${query} 生成一张中文解释的英语学习词卡 JSON。`,
        },
      ],
      { type: 'json_object' },
    )

    const content = completion.choices?.[0]?.message?.content
    const parsed = JSON.parse(content)
    res.json({ source: 'deepseek', item: parsed })
  } catch (error) {
    res.json({
      source: 'mock',
      degraded: true,
      item: buildDictionaryFallback(query, mode),
      error: error instanceof Error ? error.message : 'unknown_error',
    })
  }
})

app.post('/api/vocabulary/daily', async (req, res) => {
  const { scenes = sceneCycle, level = '适合母语 6-7 年级' } = req.body ?? {}

  if (!deepseekApiKey) {
    return res.json({
      source: 'mock',
      items: buildDailyWordsFallback(scenes),
    })
  }

  try {
    const completion = await requestDeepSeek(
      [
        {
          role: 'system',
          content: `你是英语学习产品的每日词汇推荐引擎。请严格输出 JSON，顶层字段为 items。items 是长度为 5 的数组。
要求：
1. 语言自然、生动有趣。
2. definitionZh 是该词汇在具体语境下的中文自然解释。
3. partOfSpeech 必须是"中文 (英文)"格式，如"名词 (noun)", "动词 (verb)"。
4. imageLabel 是用于给AI绘画模型生成插图的英文提示词，必须是简短、具象的视觉描述（例如 "a calendar with events listed"）。
5. usage 是对用法的详细说明，必须介绍该词语作为此词性时的搭配习惯、常见短语、适用场景和注意事项。绝对不要仅仅返回一个例句，必须是一段中文为主的说明性文字。
6. 每个 item 包含: term, phonetic, partOfSpeech, definitionZh, scene, imageLabel, usage, culture, related, confusing, examples(包含 en 和 zh 的2个例句数组)。`,
        },
        {
          role: 'user',
          content: `请为当前用户生成今日新增 5 个英语词汇卡，用户水平：${level}。优先覆盖这些场景：${scenes.join('、')}。解释语言是简体中文，风格自然，不要教科书腔。`,
        },
      ],
      { type: 'json_object' },
    )

    const content = completion.choices?.[0]?.message?.content
    const parsed = JSON.parse(content)
    res.json({
      source: 'deepseek',
      items: parsed.items,
    })
  } catch (error) {
    res.json({
      source: 'mock',
      degraded: true,
      items: buildDailyWordsFallback(scenes),
      error: error instanceof Error ? error.message : 'unknown_error',
    })
  }
})

app.post('/api/reader/feed', async (req, res) => {
  const { scenes = sceneCycle, level = '适合母语 6-7 年级' } = req.body ?? {}

  if (!deepseekApiKey) {
    return res.json({
      source: 'mock',
      items: buildReaderFallback(),
    })
  }

  try {
    const completion = await requestDeepSeek(
      [
        {
          role: 'system',
          content:
            '你是英语学习产品的 Reader 内容编辑。请严格输出 JSON，顶层字段为 items。items 是 2 到 4 篇文章的数组。\n要求：\n1. 内容必须是非常贴近真实世界的近期新闻、科技前沿、职场趋势或真实生活方式文章（可以基于你所知的真实世界知识生成高度逼真的新闻或文章节选）。\n2. 绝对不要使用像 "Lily plans a trip" 这种小学生课本式的幼稚内容。\n3. 每个 item 包含: id, title, source(如 BBC News, TechCrunch), level, minutes, tag(如 Tech, World, Career), summary(中文摘要), keyWord, keyWordMeaning, sentence, sentenceZh, prompt(用于口语讨论的引导词)。',
        },
        {
          role: 'user',
          content: `请生成适合 ${level} 的高质量、真实的英语阅读素材，优先覆盖这些领域：${scenes.join('、')}。内容解释语言用中文，标题和句子保持英文。`,
        },
      ],
      { type: 'json_object' },
    )

    const content = completion.choices?.[0]?.message?.content
    const parsed = JSON.parse(content)
    res.json({
      source: 'deepseek',
      items: parsed.items,
    })
  } catch (error) {
    res.json({
      source: 'mock',
      degraded: true,
      items: buildReaderFallback(),
      error: error instanceof Error ? error.message : 'unknown_error',
    })
  }
})

app.post('/api/assessment/plan', async (req, res) => {
  if (!deepseekApiKey) {
    return res.json({
      source: 'mock',
      plan: { listening: 2, reading: 2, speaking: 1 },
    })
  }

  try {
    const completion = await requestDeepSeek(
      [
        {
          role: 'system',
          content:
            '你是一位专业的外语老师。请为新用户的初始英语能力测评设计题量。要求总耗时控制在 5 到 8 分钟左右，总题数在 5 到 8 题之间。请严格输出 JSON，包含 listening, reading, speaking 三个字段，值为整数，表示各自的题量。例如：{ "listening": 3, "reading": 2, "speaking": 2 }。',
        },
        {
          role: 'user',
          content: '请给出听力、阅读、口语的题量分配。',
        },
      ],
      { type: 'json_object' },
    )

    const content = completion.choices?.[0]?.message?.content
    const plan = JSON.parse(content)
    res.json({
      source: 'deepseek',
      plan: {
        listening: Number(plan.listening) || 2,
        reading: Number(plan.reading) || 2,
        speaking: Number(plan.speaking) || 1,
      },
    })
  } catch (error) {
    res.json({
      source: 'mock',
      degraded: true,
      error: error instanceof Error ? error.message : 'unknown_error',
      plan: { listening: 2, reading: 2, speaking: 1 },
    })
  }
})

app.post('/api/assessment/generate', async (req, res) => {
  const { level = 'medium', plan = { listening: 1, reading: 1, speaking: 1 } } = req.body ?? {}

  const fallbackQuestions = [
    {
      id: 'l1',
      type: 'listening',
      content: "Hey, I was wondering if you could help me with this project report. The deadline is tomorrow and I'm really behind.",
      question: 'What does the speaker need help with?',
      options: ['A project report', 'A marketing plan', 'A coffee order', 'A flight booking'],
      answer: 'A project report',
    },
    {
      id: 'r1',
      type: 'reading',
      content: 'Subject: Out of Office\n\nI will be out of the office starting Thursday, Oct 12th, returning Monday, Oct 16th. For urgent matters, please contact Sarah at sarah@company.com.',
      question: 'Who should you contact for emergencies while the person is away?',
      options: ['The sender', 'Sarah', 'No one', 'The HR department'],
      answer: 'Sarah',
    },
    {
      id: 's1',
      type: 'speaking',
      prompt: 'You are at a hotel front desk. You want to check in, but you arrived 2 hours early. What do you say to the receptionist?',
    },
  ]

  if (!deepseekApiKey) {
    return res.json({
      source: 'mock',
      questions: fallbackQuestions,
    })
  }

  try {
    const completion = await requestDeepSeek(
      [
        {
          role: 'system',
          content:
            `你是英语学习测评系统的出题专家。请严格输出 JSON。顶层必须有 questions 字段（数组）。你需要生成 ${plan.listening + plan.reading + plan.speaking} 道题：${plan.listening} 道听力(listening)，${plan.reading} 道阅读(reading)，${plan.speaking} 道口语(speaking)。\n听力题(listening)：content 必须是一段生活场景或职场场景中的自然独白（如机场广播、电话留言、新闻播报、个人讲述等）。绝对不要包含 'Man:', 'Woman:', 'A:', 'B:' 等角色提示词，以免 TTS 机器朗读时读出这些标签，直接写出人物说的话即可。question 是基于内容的问题，options 是4个选项数组(全英文)，answer 是正确选项的文本。\n阅读题(reading)：content 是邮件/短文/通知(全英文)，question 是基于内容的问题，options 是4个选项数组(全英文)，answer 是正确选项的文本。\n口语题(speaking)：prompt 是一段情景设定的中文描述，要求用户用英文回答（例如：你在咖啡店点单...）。不需要 options 和 answer。\n题目难度要有梯度（包含简单、中等、困难），选项要具有迷惑性，以真实测试用户的水平。`,
        },
        {
          role: 'user',
          content: `请生成一套初始难度为 ${level} 的测评题，内容尽量贴近真实职场、旅游或日常生活。`,
        },
      ],
      { type: 'json_object' },
    )

    const content = completion.choices?.[0]?.message?.content
    const parsed = JSON.parse(content)
    res.json({
      source: 'deepseek',
      questions: parsed.questions.map((q, i) => ({ ...q, id: `q${i}` })),
    })
  } catch (error) {
    res.json({
      source: 'mock',
      degraded: true,
      error: error instanceof Error ? error.message : 'unknown_error',
      questions: fallbackQuestions,
    })
  }
})

app.post('/api/assessment/evaluate', async (req, res) => {
  const { answers = [] } = req.body ?? {}

  if (!deepseekApiKey) {
    return res.json({
      source: 'mock',
      result: {
        level: '适合母语 6-7 年级',
        summary: '你的基础很扎实，听力和阅读能抓住核心信息，但在口语表达的流利度和词汇丰富度上还有提升空间。',
        strengths: '信息提取能力强，基础语法正确',
        weaknesses: '口语表达存在中式英语思维',
        listeningScore: '80/100',
        readingScore: '90/100',
        speakingScore: '70/100',
      },
    })
  }

  try {
    const completion = await requestDeepSeek(
      [
        {
          role: 'system',
          content:
            '你是英语学习测评系统的评卷专家。请严格输出 JSON。顶层必须包含 level, summary, strengths, weaknesses, listeningScore, readingScore, speakingScore。\n评分规则：\n1. 客观题（listening, reading）：完全根据 `isCorrect` 字段判定，算出售分百分比（如全对为100/100，错一题扣相应分数）。\n2. 口语题（speaking）：必须严格评估 `transcript`。如果 transcript 为空、值为 "User submitted audio without transcript"、内容过短（如只有 hello）或与题目毫无关联，口语分数必须给 0/100！不能给及格分！根据词汇丰富度、语法正确性和切题程度严格打分。\n3. level 请用“适合母语 X 年级”这种格式。',
        },
        {
          role: 'user',
          content: `这是用户的作答记录：${JSON.stringify(answers)}。请生成真实客观的测评报告。`,
        },
      ],
      { type: 'json_object' },
    )

    const content = completion.choices?.[0]?.message?.content
    const parsed = JSON.parse(content)
    res.json({
      source: 'deepseek',
      result: parsed,
    })
  } catch (error) {
    res.json({
      source: 'mock',
      degraded: true,
      error: error instanceof Error ? error.message : 'unknown_error',
      result: {
        level: '评估失败',
        summary: '暂无法生成报告，请稍后再试。',
        strengths: '-',
        weaknesses: '-',
        listeningScore: '-',
        readingScore: '-',
        speakingScore: '-',
      },
    })
  }
})

app.post('/api/talk', async (req, res) => {
  const { mode = 'Free Talk', context = '', transcript = '', messages = [] } = req.body ?? {}

  if (!transcript.trim()) {
    return res.status(400).json({ error: 'transcript_required' })
  }

  if (!deepseekApiKey) {
    return res.json({
      source: 'mock',
      reply: `I heard you say: "${transcript}". Let's keep going in ${mode} mode. ${context ? `We can also stay around this topic: ${context}.` : ''}`,
      correction:
        transcript.toLowerCase().includes('my day is busy')
          ? 'A more natural way: My day has been busy.'
          : null,
    })
  }

  try {
    const completion = await requestDeepSeek(
      [
        {
          role: 'system',
          content:
            'You are Talk With Me, an American local male friend. Speak in natural standard American English, keep the conversation friendly, and only give light correction when a mistake strongly affects clarity. Reply in JSON with keys reply and correction. correction can be null.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            mode,
            context,
            transcript,
            history: messages,
          }),
        },
      ],
      { type: 'json_object' },
    )

    const content = completion.choices?.[0]?.message?.content
    const parsed = JSON.parse(content)
    res.json({
      source: 'deepseek',
      reply: parsed.reply,
      correction: parsed.correction ?? null,
    })
  } catch (error) {
    res.json({
      source: 'mock',
      degraded: true,
      reply: `I heard you say: "${transcript}". Tell me a little more about that.`,
      correction: null,
      error: error instanceof Error ? error.message : 'unknown_error',
    })
  }
})

app.use(express.static(distDir))

app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(indexHtmlPath)
})

app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`)
})
