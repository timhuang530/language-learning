import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { fetchDailyVocabulary, fetchReaderFeed, searchVocabulary, sendTalkMessage, generateAssessment, evaluateAssessment, fetchAssessmentPlan, type AssessmentQuestion, type AssessmentResult } from './lib/api'
import { usePersistentState } from './lib/storage'

type MainTab = 'vocabulary' | 'reader' | 'talk' | 'history'
type AssessmentStage = 'intro' | 'testing' | 'result'
type SearchMode = 'direct' | 'describe'
type TalkMode = 'Free Talk' | 'Work' | 'Meeting' | 'Interview' | 'Travel'
type ReaderCategory = 'All' | 'Speech' | 'Travel' | 'News'

type VocabularyItem = {
  id: string
  term: string
  phonetic: string
  partOfSpeech: string
  definitionZh: string
  scene: string
  imageLabel: string
  usage: string
  culture: string
  related: string[]
  confusing: string
  examples: { en: string; zh: string }[]
}

type ReaderItem = {
  id: string
  title: string
  source: string
  level: string
  minutes: string
  tag: string
  summary: string
  articleBody?: string
  keyWord: string
  keyWordMeaning: string
  sentence: string
  sentenceZh: string
  prompt: string
  updatedAt?: string
}

type ReaderSelection = {
  type: 'word' | 'sentence'
  label: string
  detail: string
}

type ImageStatus = 'loading' | 'loaded' | 'error'

type ChatMessage = {
  id?: string
  side: 'ai' | 'user'
  text: string
  audioDataUrl?: string | null
}

type ChatMessagesByMode = Record<TalkMode, ChatMessage[]>

type ChatHistoryItem = {
  id: string
  mode: TalkMode
  summary: string
  createdAt: string
}

type SearchHistoryItem = {
  id: string
  query: string
  mode: SearchMode
  saved: boolean
  createdAt: string
}

type BrowserSpeechRecognitionInstance = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: ((event?: { error?: string }) => void) | null
  start: () => void
  stop: () => void
}

const vocabularySeed: VocabularyItem[] = [
  {
    id: 'compromise',
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
  {
    id: 'procrastinate',
    term: 'procrastinate',
    phonetic: '/prəˈkræstɪneɪt/',
    partOfSpeech: 'v.',
    definitionZh: '拖延。不是单纯晚一点，而是明知道要做，却一直往后拖。',
    scene: 'Daily',
    imageLabel: 'Student avoiding homework while looking at phone',
    usage:
      '口语里非常自然，特别适合描述学习、工作或生活中的拖延状态，语气带一点自嘲感。',
    culture:
      '美国人很常用它来自嘲，比如 I am procrastinating again，听起来比说 lazy 更轻一点。',
    related: ['delay', 'put off', 'stall'],
    confusing:
      'put off 更口语、更轻，procrastinate 更明确地指“拖延该做的事”。',
    examples: [
      {
        en: 'I always procrastinate when I need to write reports.',
        zh: '每次要写报告时我都会拖延。',
      },
      {
        en: 'Stop procrastinating and just send the email.',
        zh: '别再拖了，直接把邮件发出去吧。',
      },
    ],
  },
  {
    id: 'follow-up',
    term: 'follow-up',
    phonetic: '/ˈfɑːloʊ ʌp/',
    partOfSpeech: 'n. / v.',
    definitionZh: '跟进，后续追踪。事情没有停在第一次沟通，而是继续推进。',
    scene: 'Meeting',
    imageLabel: 'Manager sending a follow-up note after meeting',
    usage:
      '工作英语里特别高频，邮件、会议、项目推进里都很常见，掌握后非常实用。',
    culture:
      '说 I will follow up 显得很可靠，也很有执行力，比说 I will check later 更专业。',
    related: ['check in', 'circle back', 'update'],
    confusing:
      'check in 偏轻松确认，follow-up 更像带着任务和结果去推进。',
    examples: [
      {
        en: 'I will send a follow-up email after the meeting.',
        zh: '会后我会发一封跟进邮件。',
      },
      {
        en: 'Can you follow up with the client tomorrow?',
        zh: '你明天可以跟进一下客户吗？',
      },
    ],
  },
  {
    id: 'strength',
    term: 'strength',
    phonetic: '/streŋθ/',
    partOfSpeech: 'n.',
    definitionZh: '优势，强项。常用于面试、自我介绍、团队角色说明。',
    scene: 'Interview',
    imageLabel: 'Job candidate confidently speaking in interview',
    usage:
      '面试里经常和 weakness 成对出现，但比起死背模板，更重要的是会自然地展开说明。',
    culture:
      '回答 strengths 时，英语语境里更看重具体例子，不只是说自己 hardworking。',
    related: ['advantage', 'strong point', 'capability'],
    confusing:
      'advantage 可以是外部优势，strength 更像你自身的能力或特质。',
    examples: [
      {
        en: 'One of my biggest strengths is staying calm under pressure.',
        zh: '我最大的优势之一是在压力下依然能保持冷静。',
      },
      {
        en: 'She turned her communication strength into a leadership role.',
        zh: '她把自己的沟通优势发展成了领导力角色。',
      },
    ],
  },
  {
    id: 'itinerary',
    term: 'itinerary',
    phonetic: '/aɪˈtɪnəreri/',
    partOfSpeech: 'n.',
    definitionZh: '行程安排。通常是旅行中每天要去哪里、做什么的计划。',
    scene: 'Travel',
    imageLabel: 'Travel itinerary with landmarks and schedule',
    usage:
      '旅游英语里很常见，既可以指完整行程，也可以指机票或酒店确认中的行程信息。',
    culture:
      '如果你说 my itinerary changed，对方会默认你整个旅行安排有调整，不只是一个小预约变了。',
    related: ['schedule', 'plan', 'travel plan'],
    confusing:
      'schedule 更泛，itinerary 更偏旅行或正式行程安排。',
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
]

const readerSeed: ReaderItem[] = [
  {
    id: 'speech-routine',
    title: 'A Short Speech on Better Work Routines',
    source: 'Speech digest',
    level: '适合母语 7-8 年级',
    minutes: '4 min',
    tag: 'Speech',
    summary: '一篇演讲风格短文，讲小习惯如何影响专注力和工作节奏。',
    articleBody: "In today's fast-paced corporate world, many professionals feel overwhelmed by endless meetings and constant notifications. However, recent studies suggest that a steady routine can lower stress and make hard tasks feel smaller. It's not about working longer hours, but rather creating small, predictable habits. For example, taking a five-minute walk before diving into a complex report, or setting strict 'no-email' boundaries during lunch. These micro-habits help the brain transition between different modes of thinking. People who keep a clear routine often make faster decisions and feel less exhausted by the end of the day. Ultimately, success isn't always about massive leaps; it's often the result of tiny, consistent steps.",
    keyWord: 'routine',
    keyWordMeaning: '固定做事节奏，日常习惯流程',
    sentence: 'A steady routine can lower stress and make hard tasks feel smaller.',
    sentenceZh: '稳定的日常节奏可以降低压力，也会让难任务看起来没那么吓人。',
    prompt: '和我聊聊你自己的工作习惯，以及你最想调整的一件事。',
  },
  {
    id: 'speech-confidence',
    title: 'Why Speaking Slowly Can Sound More Confident',
    source: 'Public speaking note',
    level: '适合母语 7-8 年级',
    minutes: '3 min',
    tag: 'Speech',
    summary: '一篇关于表达节奏的短文，适合练语音、语调和说话逻辑。',
    articleBody: 'Many learners think speaking fast sounds fluent, but experienced presenters often do the opposite. They slow down on key points, pause before important ideas, and give listeners time to process the message. A slower pace can make your speech sound more confident and organized. It also helps you choose words more carefully and reduce unnecessary mistakes. In meetings or interviews, this simple change often improves how people respond to you. Confidence is not only about vocabulary. It is also about rhythm, clarity, and control.',
    keyWord: 'pace',
    keyWordMeaning: '节奏，速度，尤其指说话或做事时的快慢',
    sentence: 'A slower pace can make your speech sound more confident and organized.',
    sentenceZh: '更慢一点的节奏会让你的表达听起来更自信、更有条理。',
    prompt: '和我聊聊你说英语时最想改善的表达问题。',
  },
  {
    id: 'speech-written-updates',
    title: 'Small Written Updates Often Prevent Bigger Problems',
    source: 'Team communication note',
    level: '适合母语 7-8 年级',
    minutes: '4 min',
    tag: 'Speech',
    summary: '一篇偏沟通训练的短文，围绕书面同步、heads-up 和 follow-up 展开。',
    articleBody:
      'In many teams, people think communication mainly happens in meetings. In reality, a large part of collaboration happens through short written updates. A simple heads-up can save others from working with outdated information, and a clear follow-up can prevent the same question from being asked three times.\n\nGood written communication is not about sounding formal. It is about helping the next person understand what changed, what matters now, and what action is expected. When someone writes a short update with clear ownership, the team moves faster and wastes less energy on confusion.\n\nThat is why experienced managers often pay attention to the quality of written updates, not just the speed of replies. A strong update creates alignment, keeps stakeholders in the loop, and gives people enough context to respond well.',
    keyWord: 'heads-up',
    keyWordMeaning: '预先提醒，先告知一下',
    sentence: 'A simple heads-up can save others from working with outdated information.',
    sentenceZh: '一个简单的提前提醒，就能避免别人继续基于过时信息工作。',
    prompt: '和我聊聊你更喜欢口头同步还是书面同步，以及原因。',
  },
  {
    id: 'travel-city',
    title: 'A Weekend Walk Through an Old City',
    source: 'Travel story',
    level: '适合母语 6-7 年级',
    minutes: '3 min',
    tag: 'Travel',
    summary: '一篇偏生活化的旅行短文，适合练地点描述、感受表达和见闻复述。',
    articleBody: "There is something magical about exploring a new city on foot. Last weekend, we arrived in a historic European town just before dawn. The cobblestone streets were completely empty, and the only sound was the distant chime of a church bell. We wandered through quiet streets until the city slowly woke up. Local bakeries began to open their doors, releasing the irresistible aroma of fresh pastries. As the sun rose higher, the main square filled with vendors selling colorful flowers and handmade crafts. Traveling without a strict itinerary allowed us to discover hidden cafes and beautiful alleys that aren't mentioned in any guidebook. Sometimes, the best way to experience a place is to simply get lost in it.",
    keyWord: 'wander',
    keyWordMeaning: '闲逛，漫步，没有太强目的地到处看看',
    sentence: 'We wandered through quiet streets until the city slowly woke up.',
    sentenceZh: '我们在安静的街道上闲逛，直到整座城市慢慢醒来。',
    prompt: '用比较轻松的方式和我聊一聊你最喜欢的旅行城市。',
  },
  {
    id: 'travel-delay',
    title: 'When a Flight Delay Changes the Whole Plan',
    source: 'Travel update',
    level: '适合母语 6-7 年级',
    minutes: '4 min',
    tag: 'Travel',
    summary: '一篇旅行场景短文，适合练延误、改签和行程变动相关表达。',
    articleBody: 'A short delay can affect much more than one flight. Travelers may miss hotel check-in times, train connections, or planned activities in the next city. That is why experienced travelers leave extra room in their schedule when a trip involves multiple steps. A flexible itinerary does not remove every problem, but it can reduce stress when plans suddenly change. Even a simple habit, like checking gate updates early, can make a difficult travel day easier to manage.',
    keyWord: 'flexible',
    keyWordMeaning: '灵活的，可调整的',
    sentence: 'A flexible itinerary does not remove every problem, but it can reduce stress.',
    sentenceZh: '灵活的行程安排不能解决所有问题，但可以减少压力。',
    prompt: '聊聊你旅行时最怕遇到什么突发状况，以及你会怎么处理。',
  },
  {
    id: 'travel-settling',
    title: 'The First Weeks in a New City Feel Like a Language Test',
    source: 'Relocation note',
    level: '适合母语 6-7 年级',
    minutes: '4 min',
    tag: 'Travel',
    summary: '一篇围绕搬家安家与城市适应的文章，覆盖通勤、租房和日常求助表达。',
    articleBody:
      'Moving to a new city looks exciting from the outside, but the first weeks can feel surprisingly intense. Simple tasks suddenly become language tasks: asking how long the commute takes, whether utilities are included in the rent, or where to buy a local SIM card.\n\nEven casual questions like “How are you settling in?” can open meaningful conversations. They invite you to talk about your neighborhood, the office, transportation, and the little surprises that come with a new place.\n\nFor many people, adapting to a city is not only about geography. It is also about building confidence in everyday communication. The more small conversations you manage successfully, the faster the city begins to feel familiar.',
    keyWord: 'settle in',
    keyWordMeaning: '安顿下来，逐渐适应新环境',
    sentence: 'The more small conversations you manage successfully, the faster the city begins to feel familiar.',
    sentenceZh: '你越能顺利应对这些小对话，这座城市就越快会让你觉得熟悉。',
    prompt: '和我聊聊如果你搬到一个新城市，最先想解决的三件事是什么。',
  },
  {
    id: 'news-city',
    title: 'City Libraries Add Quiet Pods for Remote Workers',
    source: 'Local News',
    level: '适合母语 7-8 年级',
    minutes: '4 min',
    tag: 'News',
    summary: '一篇偏新闻风格的城市生活报道，讨论公共空间如何支持远程办公。',
    articleBody: 'Several city libraries have started introducing quiet work pods for remote workers and students. The new spaces include stronger internet connections, better lighting, and sound-reducing walls. Library managers say the change responds to a growing demand for affordable places to focus outside the home. For many people, coffee shops are too noisy and shared offices are too expensive. The project has been welcomed by freelancers, students, and job seekers who need a calm environment for serious work. Officials say more locations may receive the same upgrade later this year.',
    keyWord: 'affordable',
    keyWordMeaning: '负担得起的，价格合理的',
    sentence: 'The change responds to a growing demand for affordable places to focus outside the home.',
    sentenceZh: '这一变化回应了人们对“家外可专注且价格合理空间”的不断增长的需求。',
    prompt: '和我聊聊你理想中的学习或工作环境是什么样的。',
  },
  {
    id: 'news-tech',
    title: 'Small AI Tools Are Changing Daily Office Tasks',
    source: 'Tech News',
    level: '适合母语 7-8 年级',
    minutes: '5 min',
    tag: 'News',
    summary: '一篇科技新闻风格短文，讨论 AI 工具如何改变普通办公流程。',
    articleBody: 'Instead of replacing entire jobs at once, many small AI tools are quietly changing everyday office work. Employees now use them to summarize meetings, rewrite emails, organize notes, and prepare first drafts. Managers say the biggest impact is not dramatic automation, but faster completion of repetitive tasks. At the same time, companies are learning that human review still matters. A tool may save time, but people must still check tone, accuracy, and business context before sending anything important. For many teams, the new question is no longer whether to use these tools, but how to use them wisely.',
    keyWord: 'draft',
    keyWordMeaning: '草稿，初稿',
    sentence: 'Managers say the biggest impact is not dramatic automation, but faster completion of repetitive tasks.',
    sentenceZh: '管理者表示，最大的影响不是戏剧性的自动化，而是重复任务完成得更快了。',
    prompt: '和我聊聊你是否愿意在学习或工作中使用 AI 工具，以及原因。',
  },
  {
    id: 'news-roadmap',
    title: 'Why Teams Revisit the Roadmap When the Market Changes',
    source: 'Strategy review',
    level: '适合母语 8-9 年级',
    minutes: '5 min',
    tag: 'News',
    summary: '一篇战略分析风格的文章，讨论市场变化、产品路线图和优先级调整。',
    articleBody:
      'A roadmap can create confidence, but strong teams know that a roadmap should not become a rigid promise to ignore new information. Markets change quickly. Competitors release new features, user behavior evolves, and once-promising assumptions may no longer hold.\n\nWhen that happens, leaders need to zoom out and ask whether the current roadmap still reflects the real strategic priority. Sometimes the answer is yes. At other times, the best move is to adjust the plan, re-sequence the work, or narrow the scope so the team can protect its core value proposition.\n\nRevisiting a roadmap is not always a sign of uncertainty. In many cases, it is a sign of discipline. Teams that revisit their priorities thoughtfully are often the ones that avoid wasting months on work that no longer matters.',
    keyWord: 'roadmap',
    keyWordMeaning: '路线图；团队在未来一段时间内的重点计划与节奏安排',
    sentence: 'Revisiting a roadmap is not always a sign of uncertainty.',
    sentenceZh: '重新审视路线图并不总意味着团队缺乏确定性。',
    prompt: '和我聊聊如果市场变化很快，团队应该坚持原计划还是及时调整。',
  },
]

const readerTabs: ReaderCategory[] = ['All', 'Speech', 'Travel', 'News']
const readerContentTabs: Exclude<ReaderCategory, 'All'>[] = ['Speech', 'Travel', 'News']
const readerMinimumPerTag = 3

const emptyChatMessagesByMode: ChatMessagesByMode = {
  'Free Talk': [],
  Work: [],
  Meeting: [],
  Interview: [],
  Travel: [],
}

const systemAddedTodayIds = ['compromise', 'procrastinate']
const transcriptSamples: Record<TalkMode, string> = {
  'Free Talk': 'hi today i want to talk about my work and why i felt tired after too many meetings',
  Work: 'today i need to explain a delay and give my manager a clearer update on the next step',
  Meeting: 'i want to say my opinion politely and confirm what the team should do after this meeting',
  Interview: 'i want to answer a question about my strengths and one difficult project from last year',
  Travel: 'i need to ask for directions and explain that my itinerary changed this afternoon',
}
const talkModeContextMap: Record<TalkMode, string> = {
  'Free Talk': '围绕真实生活、工作见闻和个人观点自然聊天',
  Work: '围绕项目推进、进度同步、卡点和协作方式继续交流',
  Meeting: '围绕会议议程、表达观点、推进讨论和总结待办继续交流',
  Interview: '围绕项目经历、职责归属、成果指标和问题解决继续交流',
  Travel: '围绕行程变化、交通安排、预订和现场沟通继续交流',
}
const vocabularySceneGuideMap: Record<string, string> = {
  All: '覆盖日常生活、通用商务、会议沟通、项目执行、面试表达和出行场景。',
  Daily: '优先看寒暄社交、交通问路、住房安家、健康就医和餐厅点餐表达。',
  Work: '优先看项目推进、书面沟通、请求协作、风险同步和交付复盘表达。',
  Meeting: '优先看议程设置、表达观点、推进讨论、跟进待办和同步提醒表达。',
  Interview: '优先看项目经历、成果指标、取舍判断、价值主张和问题解决表达。',
  Travel: '优先看行程变化、交通换乘、预订点餐、搬家适应和现场求助表达。',
}
const vocabularySearchPlaceholderMap: Record<string, string> = {
  All: 'Search a word',
  Daily: '例如：settle in / commute / lease',
  Work: '例如：bandwidth / blocker / rollout',
  Meeting: '例如：agenda / heads-up / follow-up',
  Interview: '例如：trade-off / impact / value proposition',
  Travel: '例如：itinerary / reservation / transit card',
}
const readerCategoryGuideMap: Record<ReaderCategory, string> = {
  All: '每日更新真实英语素材，覆盖讨论表达、城市生活、科技趋势和战略分析。',
  Speech: '偏会议沟通、项目同步、书面更新和适合读后开口讨论的内容。',
  Travel: '偏新城市适应、交通住宿、行程变化和真实生活体验。',
  News: '偏科技产品、数据增长、战略规划、市场变化和路线图调整。',
}
const vocabularySceneOrder = ['Daily', 'Work', 'Meeting', 'Interview', 'Travel']
const readerCategoryOrder: ReaderCategory[] = ['Speech', 'News', 'Travel']
const talkModeEmptyStateMap: Record<TalkMode, { title: string; description: string }> = {
  'Free Talk': {
    title: '开始一段自然对话',
    description: '可以聊今天发生的事、你的看法，或最近工作和生活里正在想的一件事。',
  },
  Work: {
    title: '开始一次工作场景练习',
    description: '适合练项目推进、进度同步、请求协作、说明 blocker 和后续计划。',
  },
  Meeting: {
    title: '开始一次会议表达练习',
    description: '适合练议程开场、表达观点、推进讨论、总结结论和 follow-up。',
  },
  Interview: {
    title: '开始一次面试表达练习',
    description: '适合练项目经历、成果指标、取舍判断、价值主张和问题解决。',
  },
  Travel: {
    title: '开始一次出行沟通练习',
    description: '适合练问路、通勤、预订、安家、就医和餐厅点餐等真实场景。',
  },
}

const TALK_DEBUG_URL = 'http://127.0.0.1:7777/event'
const TALK_DEBUG_SESSION_ID = 'talk-recording-auto-stop'

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function buildWordImageUrl(word: Pick<VocabularyItem, 'imageLabel'>) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(
    `${word.imageLabel}, vector flat illustration, simple minimal background, vibrant colors`,
  )}?nologo=1&width=600&height=360`
}

function extractRelatedWords(item: Pick<VocabularyItem, 'term' | 'related' | 'confusing'>) {
  if (Array.isArray(item.related) && item.related.length > 0) {
    return Array.from(
      new Set(item.related.filter((entry) => typeof entry === 'string' && entry.trim())),
    ).slice(0, 3)
  }

  const currentTerm = item.term.trim().toLowerCase()
  const matches = item.confusing.match(/[A-Za-z][A-Za-z-]*/g) ?? []

  return Array.from(
    new Set(
      matches
        .map((entry: string) => entry.trim())
        .filter((entry: string) => entry.length > 2 && entry.toLowerCase() !== currentTerm),
    ),
  ).slice(0, 3)
}

function buildReaderUpdatedAtLabel(date = new Date()) {
  return `更新于 ${date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

function buildArticleParagraphs(articleBody = '') {
  const trimmed = articleBody.trim()

  if (!trimmed) {
    return []
  }

  const explicitParagraphs = trimmed
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  if (explicitParagraphs.length > 1) {
    return explicitParagraphs
  }

  const sentences = trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((item) => item.trim()).filter(Boolean) ?? [trimmed]
  const chunkSize = sentences.length >= 12 ? 4 : 3
  const paragraphs: string[] = []

  for (let index = 0; index < sentences.length; index += chunkSize) {
    paragraphs.push(sentences.slice(index, index + chunkSize).join(' '))
  }

  return paragraphs
}

function ensureReaderCoverage(items: ReaderItem[], fallbackDateLabel: string) {
  const normalized = items.map((item, index) => ({
    ...item,
    tag: readerContentTabs.includes(item.tag as Exclude<ReaderCategory, 'All'>)
      ? item.tag
      : readerContentTabs[index % readerContentTabs.length],
    updatedAt: item.updatedAt || fallbackDateLabel,
  }))
  const supplements = readerContentTabs.flatMap((tag) => {
    const currentItems = normalized.filter((item) => item.tag === tag)
    const neededCount = Math.max(0, readerMinimumPerTag - currentItems.length)
    const fallbackPool = readerSeed.filter((item) => item.tag === tag)

    return fallbackPool.slice(0, neededCount).map((fallback, index) => ({
      ...fallback,
      id: `${fallback.id}-${tag.toLowerCase()}-fallback-${index}`,
      tag,
      updatedAt: fallbackDateLabel,
    }))
  })

  return [...normalized, ...supplements]
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Failed to read audio data.'))
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read audio data.'))
    }
    reader.readAsDataURL(blob)
  })
}

function reportTalkDebug(hypothesisId: 'A' | 'B' | 'C' | 'D' | 'E', msg: string, data: Record<string, unknown> = {}) {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return
  }

  window
    .fetch(TALK_DEBUG_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: TALK_DEBUG_SESSION_ID,
        runId: 'pre',
        hypothesisId,
        location: 'src/App.tsx',
        msg,
        data,
        ts: Date.now(),
      }),
    })
    .catch(() => {})
}

function Icon({
  name,
  className = '',
}: {
  name:
    | 'play'
    | 'pause'
    | 'search'
    | 'sparkles'
    | 'chevron-left'
    | 'bookmark'
    | 'bookmark-filled'
    | 'share'
    | 'book'
    | 'message'
    | 'grid'
    | 'clock'
    | 'mic'
    | 'keyboard'
    | 'lightbulb'
    | 'volume'
    | 'translate'
  className?: string
}) {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  }

  switch (name) {
    case 'play':
      return (
        <svg {...commonProps}>
          <path d="M8 6.5v11l8-5.5-8-5.5Z" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'pause':
      return (
        <svg {...commonProps}>
          <path d="M8.5 7v10M15.5 7v10" />
        </svg>
      )
    case 'search':
      return (
        <svg {...commonProps}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
      )
    case 'sparkles':
      return (
        <svg {...commonProps}>
          <path d="m12 3 1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3Z" />
          <path d="m18.5 14 0.8 1.8 1.7 0.8-1.7 0.8-0.8 1.7-0.8-1.7-1.8-0.8 1.8-0.8 0.8-1.8Z" />
          <path d="m5 14 1.1 2.4L8.5 17l-2.4 1.1L5 20.5l-1.1-2.4L1.5 17l2.4-0.6L5 14Z" />
        </svg>
      )
    case 'chevron-left':
      return (
        <svg {...commonProps}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      )
    case 'bookmark':
      return (
        <svg {...commonProps}>
          <path d="M7 5.5A1.5 1.5 0 0 1 8.5 4h7A1.5 1.5 0 0 1 17 5.5V20l-5-3-5 3V5.5Z" />
        </svg>
      )
    case 'bookmark-filled':
      return (
        <svg {...commonProps}>
          <path d="M7 5.5A1.5 1.5 0 0 1 8.5 4h7A1.5 1.5 0 0 1 17 5.5V20l-5-3-5 3V5.5Z" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'share':
      return (
        <svg {...commonProps}>
          <path d="M14 5h5v5" />
          <path d="M10 14 19 5" />
          <path d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
        </svg>
      )
    case 'book':
      return (
        <svg {...commonProps}>
          <path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h11v15H7a2.5 2.5 0 0 0-2.5 2.5" />
          <path d="M7 4v17.5" />
        </svg>
      )
    case 'message':
      return (
        <svg {...commonProps}>
          <path d="M7 18 3.5 20V6.5A2.5 2.5 0 0 1 6 4h12a2.5 2.5 0 0 1 2.5 2.5v8A2.5 2.5 0 0 1 18 17H9.5L7 18Z" />
        </svg>
      )
    case 'grid':
      return (
        <svg {...commonProps}>
          <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" />
          <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" />
          <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" />
          <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" />
        </svg>
      )
    case 'clock':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4.2l2.8 1.8" />
        </svg>
      )
    case 'mic':
      return (
        <svg {...commonProps}>
          <rect x="9" y="4" width="6" height="10" rx="3" />
          <path d="M6 11a6 6 0 0 0 12 0M12 17v3" />
        </svg>
      )
    case 'keyboard':
      return (
        <svg {...commonProps}>
          <rect x="3.5" y="6.5" width="17" height="11" rx="2" />
          <path d="M6.5 10h.01M9.5 10h.01M12.5 10h.01M15.5 10h.01M18.5 10h.01M6.5 13h8M17 13h1.5" />
        </svg>
      )
    case 'lightbulb':
      return (
        <svg {...commonProps}>
          <path d="M9 17h6M10 20h4M8.5 14.5c-1.4-1-2.5-2.6-2.5-4.8A6 6 0 0 1 18 9.7c0 2.2-1.1 3.8-2.5 4.8-.6.4-1 .9-1.1 1.6h-2.8c-.1-.7-.5-1.2-1.1-1.6Z" />
        </svg>
      )
    case 'volume':
      return (
        <svg {...commonProps}>
          <path d="M5 14h3l4 4V6L8 10H5v4Z" />
          <path d="M16 9.5a4.5 4.5 0 0 1 0 5" />
          <path d="M18.5 7a8 8 0 0 1 0 10" />
        </svg>
      )
    case 'translate':
      return (
        <svg {...commonProps}>
          <path d="M4 6h10M9 4v2m-3 0c.4 2.8 1.7 5.1 3.7 6.9M8.5 15c1.2-1.1 2.2-2.5 3-4.1" />
          <path d="M14 20h6M17 12l3 8M20 12l-3 8" />
        </svg>
      )
    default:
      return null
  }
}

function App() {
  const [assessmentStage, setAssessmentStage] = useState<AssessmentStage>('intro')
  const [assessmentPlan, setAssessmentPlan] = useState<{ listening: number; reading: number; speaking: number } | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [assessmentQuestions, setAssessmentQuestions] = useState<AssessmentQuestion[]>([])
  const [assessmentAnswers, setAssessmentAnswers] = useState<{ questionId: string; type: string; isCorrect?: boolean; transcript?: string }[]>([])
  const [assessmentResult, setAssessmentResult] = usePersistentState<AssessmentResult | null>(
    'll.assessmentResult.v2',
    null,
  )
  const [isGeneratingAssessment, setIsGeneratingAssessment] = useState(false)
  const [isEvaluatingAssessment, setIsEvaluatingAssessment] = useState(false)
  const [activeTab, setActiveTab] = useState<MainTab>('vocabulary')
  const [searchMode, setSearchMode] = useState<SearchMode>('direct')
  const [searchInput, setSearchInput] = useState('')
  const [selectedScene, setSelectedScene] = useState('All')
  const [selectedWord, setSelectedWord] = useState<VocabularyItem | null>(null)
  const [savedWords, setSavedWords] = usePersistentState<string[]>('ll.savedWords.v2', [
    'compromise',
    'itinerary',
  ])
  const [selectedArticle, setSelectedArticle] = useState<ReaderItem | null>(null)
  const [readerCategory, setReaderCategory] = useState<ReaderCategory>('All')
  const [readerSelection, setReaderSelection] = useState<ReaderSelection | null>(null)
  const [talkMode, setTalkMode] = useState<TalkMode>('Free Talk')
  const [historyTab, setHistoryTab] = useState<'Chats' | 'Searches'>('Chats')
  const [isAssessmentComplete, setIsAssessmentComplete] = usePersistentState(
    'll.assessmentComplete.v2',
    false,
  )
  const [talkContext, setTalkContext] = useState(talkModeContextMap['Free Talk'])
  const [speakingText, setSpeakingText] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [chatMessagesByMode, setChatMessagesByMode] = usePersistentState<ChatMessagesByMode>(
    'll.chatMessagesByMode',
    emptyChatMessagesByMode,
  )
  const [chatHistory, setChatHistory] = usePersistentState<ChatHistoryItem[]>('ll.chatHistory', [])
  const [searchHistory, setSearchHistory] = usePersistentState<SearchHistoryItem[]>('ll.searchHistory', [])
  const [dailyWords, setDailyWords] = usePersistentState<VocabularyItem[]>('ll.dailyWords', [])
  const [readerItems, setReaderItems] = usePersistentState<ReaderItem[]>('ll.readerItems', readerSeed)
  const [readerLastUpdatedAt, setReaderLastUpdatedAt] = usePersistentState(
    'll.readerLastUpdatedAt',
    buildReaderUpdatedAtLabel(),
  )
  const [isSearchingWord, setIsSearchingWord] = useState(false)
  const [pendingRelatedWord, setPendingRelatedWord] = useState<string | null>(null)
  const [isSendingTalk, setIsSendingTalk] = useState(false)
  const [isLoadingDailyWords, setIsLoadingDailyWords] = useState(false)
  const [isLoadingReader, setIsLoadingReader] = useState(false)
  const [wordImageStatus, setWordImageStatus] = useState<Record<string, ImageStatus>>({})
  const [playingUserAudioId, setPlayingUserAudioId] = useState<string | null>(null)
  const [recordingNotice, setRecordingNotice] = useState<string | null>(null)
  const recognitionRef = useRef<BrowserSpeechRecognitionInstance | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const userAudioRef = useRef<HTMLAudioElement | null>(null)
  const talkConversationRef = useRef<HTMLDivElement | null>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const liveTranscriptRef = useRef('')
  const recordingModeRef = useRef<'browser' | 'fallback' | null>(null)
  const fallbackTimerRef = useRef<number | null>(null)
  const recordingTickRef = useRef<number | null>(null)
  const recordingTimeoutRef = useRef<number | null>(null)
  const recognitionRestartTimerRef = useRef<number | null>(null)
  const stopRequestedRef = useRef(false)
  const relatedWordRequestIdRef = useRef(0)

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        window.speechSynthesis.cancel()
      }
      if (fallbackTimerRef.current) {
        window.clearInterval(fallbackTimerRef.current)
      }
      if (recordingTickRef.current) {
        window.clearInterval(recordingTickRef.current)
      }
      if (recordingTimeoutRef.current) {
        window.clearTimeout(recordingTimeoutRef.current)
      }
      if (recognitionRestartTimerRef.current) {
        window.clearTimeout(recognitionRestartTimerRef.current)
      }
      userAudioRef.current?.pause()
      mediaRecorderRef.current?.stop()
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
      recognitionRef.current?.stop()
    }
  }, [])

  useEffect(() => {
    if (!isAssessmentComplete || historyTab === 'Chats') {
      fetchAssessmentPlan()
        .then((res) => setAssessmentPlan(res.plan))
        .catch(() => setAssessmentPlan({ listening: 1, reading: 1, speaking: 1 }))
    }
  }, [isAssessmentComplete, historyTab])

  useEffect(() => {
    const loadDynamicContent = async () => {
      setIsLoadingDailyWords(true)
      setIsLoadingReader(true)

      const targetLevel = assessmentResult?.level || '适合母语 6-7 年级'

      try {
        const [daily, reader] = await Promise.all([
          fetchDailyVocabulary({
            scenes: ['Daily', 'Work', 'Meeting', 'Interview', 'Travel'],
            level: targetLevel,
          }),
          fetchReaderFeed({
            scenes: ['Speech', 'Travel', 'News'],
            level: targetLevel,
          }),
        ])

        const fetchedDaily = Array.isArray(daily.items) && daily.items.length > 0 
          ? daily.items 
          : vocabularySeed.slice(0, 5)

        const mappedDaily = fetchedDaily.map((item, index) => ({
          ...item,
          id: item.id || `${item.term.toLowerCase().replace(/\s+/g, '-')}-${index}`,
        }))
        
        setDailyWords(mappedDaily)
        
        setSavedWords((current) => {
          const newIds = mappedDaily.map((w: VocabularyItem) => w.id)
          const combined = new Set([...current, ...newIds])
          return Array.from(combined)
        })

        const fetchedReader = Array.isArray(reader.items) && reader.items.length > 0
          ? reader.items
          : readerSeed

        const updatedAtLabel = buildReaderUpdatedAtLabel()

        setReaderItems(
          ensureReaderCoverage(
            fetchedReader.map((item, index) => ({
              ...item,
              id: item.id || `reader-${index}`,
              updatedAt: updatedAtLabel,
            })),
            updatedAtLabel,
          ),
        )
        setReaderLastUpdatedAt(updatedAtLabel)
      } catch {
        const fallbackDaily = vocabularySeed.slice(0, 5)
        setDailyWords(fallbackDaily)
        setSavedWords((current) => {
          const newIds = fallbackDaily.map((w) => w.id)
          return Array.from(new Set([...current, ...newIds]))
        })
        const fallbackUpdatedAtLabel = buildReaderUpdatedAtLabel()
        setReaderItems(ensureReaderCoverage(readerSeed, fallbackUpdatedAtLabel))
        setReaderLastUpdatedAt(fallbackUpdatedAtLabel)
      } finally {
        setIsLoadingDailyWords(false)
        setIsLoadingReader(false)
      }
    }

    const todayKey = new Date().toLocaleDateString('zh-CN')

    if (readerLastUpdatedAt.includes(todayKey) && dailyWords.length > 0 && readerItems.length > 0) {
      setReaderItems((current) => ensureReaderCoverage(current, readerLastUpdatedAt))
      return
    }

    void loadDynamicContent()
  }, [setDailyWords, setReaderItems, assessmentResult?.level, readerLastUpdatedAt, dailyWords.length, readerItems.length])

  useEffect(() => {
    liveTranscriptRef.current = liveTranscript
  }, [liveTranscript])

  const chatMessages = chatMessagesByMode[talkMode] ?? []
  const activeVocabularyGuide = vocabularySceneGuideMap[selectedScene] ?? vocabularySceneGuideMap.All
  const activeReaderGuide = readerCategoryGuideMap[readerCategory] ?? readerCategoryGuideMap.All
  const activeTalkEmptyState = talkModeEmptyStateMap[talkMode]
  const activeSearchPlaceholder =
    searchMode === 'direct'
      ? vocabularySearchPlaceholderMap[selectedScene] ?? vocabularySearchPlaceholderMap.All
      : '用中文描述你想表达的场景或意思'

  useEffect(() => {
    setTalkContext((current) => {
      if (!current || Object.values(talkModeContextMap).includes(current)) {
        return talkModeContextMap[talkMode]
      }
      return current
    })
  }, [talkMode])

  useEffect(() => {
    if (activeTab !== 'talk') {
      return
    }

    let nextFrameId = 0
    const scrollToLatest = window.requestAnimationFrame(() => {
      nextFrameId = window.requestAnimationFrame(() => {
        if (talkConversationRef.current) {
          talkConversationRef.current.scrollTo({
            top: talkConversationRef.current.scrollHeight,
            behavior: isRecording ? 'auto' : 'smooth',
          })
          return
        }

        chatEndRef.current?.scrollIntoView({
          block: 'end',
          behavior: isRecording ? 'auto' : 'smooth',
        })
      })
    })

    return () => {
      window.cancelAnimationFrame(scrollToLatest)
      if (nextFrameId) {
        window.cancelAnimationFrame(nextFrameId)
      }
    }
  }, [activeTab, chatMessages.length, isSendingTalk, isRecording, talkMode])

  const setCurrentChatMessages = (
    updater: ChatMessage[] | ((current: ChatMessage[]) => ChatMessage[]),
  ) => {
    setChatMessagesByMode((current) => {
      const currentMessages = current[talkMode] ?? []
      const nextMessages =
        typeof updater === 'function'
          ? (updater as (messages: ChatMessage[]) => ChatMessage[])(currentMessages)
          : updater

      return {
        ...current,
        [talkMode]: nextMessages,
      }
    })
  }

  const stopUserAudioPlayback = () => {
    if (userAudioRef.current) {
      userAudioRef.current.pause()
      userAudioRef.current.currentTime = 0
      userAudioRef.current = null
    }

    setPlayingUserAudioId(null)
  }

  const playUserAudio = (messageId: string, audioDataUrl: string) => {
    if (typeof window === 'undefined') {
      return
    }

    if (playingUserAudioId === messageId) {
      stopUserAudioPlayback()
      return
    }

    stopUserAudioPlayback()
    window.speechSynthesis.cancel()
    setSpeakingText(null)

    const audio = new Audio(audioDataUrl)
    userAudioRef.current = audio
    setPlayingUserAudioId(messageId)

    audio.onended = () => {
      if (userAudioRef.current === audio) {
        userAudioRef.current = null
      }
      setPlayingUserAudioId(null)
    }

    audio.onpause = () => {
      if (audio.currentTime === 0 || audio.ended) {
        setPlayingUserAudioId(null)
      }
    }

    audio.onerror = () => {
      if (userAudioRef.current === audio) {
        userAudioRef.current = null
      }
      setPlayingUserAudioId(null)
    }

    void audio.play().catch(() => {
      if (userAudioRef.current === audio) {
        userAudioRef.current = null
      }
      setPlayingUserAudioId(null)
    })
  }

  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return
    }

    const synthesis = window.speechSynthesis
    stopUserAudioPlayback()
    if (speakingText === text) {
      synthesis.cancel()
      setSpeakingText(null)
      return
    }

    synthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.96
    utterance.pitch = 1

    const voices = synthesis.getVoices()
    const preferredVoice =
      voices.find((voice) => voice.lang === 'en-US' && /male|david|alex|daniel|fred/i.test(voice.name)) ??
      voices.find((voice) => voice.lang === 'en-US')

    if (preferredVoice) {
      utterance.voice = preferredVoice
    }

    utterance.onend = () => setSpeakingText(null)
    utterance.onerror = () => setSpeakingText(null)
    setSpeakingText(text)
    synthesis.speak(utterance)
  }

  const toggleSaveWord = (wordId: string) => {
    setSavedWords((current) =>
      current.includes(wordId) ? current.filter((item) => item !== wordId) : [...current, wordId]
    )
  }

  const rememberChat = (mode: TalkMode, summary: string) => {
    const nextItem: ChatHistoryItem = {
      id: `${Date.now()}`,
      mode,
      summary,
      createdAt: new Date().toLocaleString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        month: 'numeric',
        day: 'numeric',
      }),
    }

    setChatHistory((current) => [nextItem, ...current].slice(0, 12))
  }

  const rememberSearch = (query: string, mode: SearchMode, saved: boolean) => {
    const nextItem: SearchHistoryItem = {
      id: `${Date.now()}-${query}`,
      query,
      mode,
      saved,
      createdAt: new Date().toLocaleString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        month: 'numeric',
        day: 'numeric',
      }),
    }

    setSearchHistory((current) => [nextItem, ...current].slice(0, 20))
  }

  const initiateTalkWithAI = async (mode: TalkMode, contextMsg: string) => {
    setActiveTab('talk')
    setTalkMode(mode)
    setTalkContext(contextMsg)
    setIsSendingTalk(true)

    try {
      const response = await sendTalkMessage({
        mode,
        context: contextMsg,
        transcript: `[System: The user just entered this conversation. Please initiate the discussion based on the context: "${contextMsg}"]`,
        messages: [],
      })

      const aiMessages: ChatMessage[] = [{ id: createMessageId(), side: 'ai', text: response.reply }]
      setCurrentChatMessages(aiMessages)
      speakText(response.reply)
    } catch {
      setCurrentChatMessages([
        {
          id: createMessageId(),
          side: 'ai',
          text: 'I could not reach the language server just now. Try again in a moment.',
        },
      ])
    } finally {
      setIsSendingTalk(false)
    }
  }

  const submitTranscript = async (transcript: string, audioDataUrl?: string | null) => {
    if (!transcript.trim()) {
      return
    }

    const nextUserMessage: ChatMessage = {
      id: createMessageId(),
      side: 'user',
      text: transcript.trim(),
      audioDataUrl: audioDataUrl ?? null,
    }

    const nextMessages = [...chatMessages, nextUserMessage]
    setCurrentChatMessages(nextMessages)
    setIsSendingTalk(true)

    try {
      const response = await sendTalkMessage({
        mode: talkMode,
        context: talkContext,
        transcript,
        messages: nextMessages,
      })

      const aiMessages: ChatMessage[] = [{ id: createMessageId(), side: 'ai', text: response.reply }]

      if (response.correction) {
        aiMessages.push({
          id: createMessageId(),
          side: 'ai',
          text: `A more natural way: ${response.correction}`,
        })
      }

      setCurrentChatMessages((current) => [...current, ...aiMessages])
      speakText(response.reply)
      rememberChat(talkMode, transcript.length > 36 ? `${transcript.slice(0, 36)}...` : transcript)
    } catch {
      setCurrentChatMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          side: 'ai',
          text: 'I could not reach the language server just now. Try again in a moment.',
        },
      ])
      speakText('I could not reach the language server just now. Try again in a moment.')
    } finally {
      setIsSendingTalk(false)
      setLiveTranscript('')
      setRecordingSeconds(0)
    }
  }

  const clearRecordingTimers = () => {
    if (fallbackTimerRef.current) {
      window.clearInterval(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
    if (recordingTickRef.current) {
      window.clearInterval(recordingTickRef.current)
      recordingTickRef.current = null
    }
    if (recordingTimeoutRef.current) {
      window.clearTimeout(recordingTimeoutRef.current)
      recordingTimeoutRef.current = null
    }
    if (recognitionRestartTimerRef.current) {
      window.clearTimeout(recognitionRestartTimerRef.current)
      recognitionRestartTimerRef.current = null
    }
  }

  const stopMediaStream = () => {
    if (!mediaStreamRef.current) {
      return
    }

    mediaStreamRef.current.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
  }

  const stopBrowserRecognition = () => {
    clearRecordingTimers()
    recordingModeRef.current = null

    if (!recognitionRef.current) {
      return
    }

    const recognition = recognitionRef.current
    recognitionRef.current = null
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null

    try {
      recognition.stop()
    } catch {
      reportTalkDebug('C', '[DEBUG] recognition.stop threw while cleaning up')
    }
  }

  const finalizeMediaRecording = async (mimeType: string) => {
    clearRecordingTimers()
    const finalTranscript = liveTranscriptRef.current.trim()
    const audioBlob =
      audioChunksRef.current.length > 0
        ? new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' })
        : null

    audioChunksRef.current = []
    stopBrowserRecognition()
    stopMediaStream()
    mediaRecorderRef.current = null
    recordingModeRef.current = null
    setIsRecording(false)
    setRecordingSeconds(0)
    stopRequestedRef.current = false

    reportTalkDebug('A', '[DEBUG] finalize media recording', {
      hasTranscript: Boolean(finalTranscript),
      audioBlobSize: audioBlob?.size ?? 0,
      mimeType: mimeType || 'audio/webm',
    })

    let audioDataUrl: string | null = null
    if (audioBlob) {
      try {
        audioDataUrl = await blobToDataUrl(audioBlob)
      } catch {
        reportTalkDebug('C', '[DEBUG] failed to serialize recorded audio')
      }
    }

    if (finalTranscript) {
      void submitTranscript(finalTranscript, audioDataUrl)
      return
    }

    if (audioDataUrl) {
      setCurrentChatMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          side: 'user',
          text: 'Voice recorded, but transcript was unavailable this time.',
          audioDataUrl,
        },
      ])
      setRecordingNotice('这次录音已保存，但浏览器这次没有返回字幕。')
    }

    setLiveTranscript('')
  }

  const finishFallbackRecording = (shouldSubmit: boolean) => {
    clearRecordingTimers()
    recordingModeRef.current = null
    setIsRecording(false)
    const finalTranscript = liveTranscriptRef.current.trim()
    if (shouldSubmit && finalTranscript) {
      void submitTranscript(finalTranscript)
    } else {
      setLiveTranscript('')
      setRecordingSeconds(0)
    }
  }

  const startRecordingWatchers = (onTimeout: () => void) => {
    setRecordingSeconds(0)
    recordingTickRef.current = window.setInterval(() => {
      setRecordingSeconds((current) => {
        if (current >= 60) {
          return 60
        }
        return current + 1
      })
    }, 1000)

    recordingTimeoutRef.current = window.setTimeout(() => {
      reportTalkDebug('E', '[DEBUG] recording timeout reached', {
        mode: recordingModeRef.current,
        seconds: 60,
      })
      onTimeout()
    }, 60000)
  }

  const stopRecordingAndSubmit = () => {
    reportTalkDebug('B', '[DEBUG] stopRecordingAndSubmit called', {
      mode: recordingModeRef.current,
      hasMediaRecorder: Boolean(mediaRecorderRef.current),
    })

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      stopRequestedRef.current = true
      clearRecordingTimers()
      stopBrowserRecognition()
      mediaRecorderRef.current.stop()
      return
    }

    if (recordingModeRef.current === 'browser') {
      stopRequestedRef.current = true
      clearRecordingTimers()
      stopBrowserRecognition()
      setIsRecording(false)
      setRecordingSeconds(0)
      return
    }

    finishFallbackRecording(true)
  }

  const startFallbackRecording = () => {
    const targetText = transcriptSamples[talkMode]
    let index = 0
    stopRequestedRef.current = false
    recordingModeRef.current = 'fallback'
    setLiveTranscript('')
    setRecordingNotice(null)
    setIsRecording(true)
    if (typeof window !== 'undefined') {
      stopUserAudioPlayback()
      window.speechSynthesis.cancel()
      setSpeakingText(null)
    }

    fallbackTimerRef.current = window.setInterval(() => {
      index += 1
      const nextText = targetText.slice(0, index)
      setLiveTranscript(nextText)

      if (index >= targetText.length) {
        finishFallbackRecording(true)
      }
    }, 55)

    startRecordingWatchers(() => finishFallbackRecording(true))
  }

  const startBrowserRecognition = () => {
    if (typeof window === 'undefined') {
      return
    }

    const browserWindow = window as Window & {
      SpeechRecognition?: new () => BrowserSpeechRecognitionInstance
      webkitSpeechRecognition?: new () => BrowserSpeechRecognitionInstance
    }

    const SpeechRecognitionCtor =
      browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      reportTalkDebug('D', '[DEBUG] SpeechRecognition unavailable')
      setRecordingNotice('当前浏览器不支持实时字幕，这次会先保留语音录音。')
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = true

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim()

      reportTalkDebug('A', '[DEBUG] recognition.onresult', {
        length: transcript.length,
      })
      setRecordingNotice(null)
      setLiveTranscript(transcript)
    }

    recognition.onerror = (event) => {
      reportTalkDebug('D', '[DEBUG] recognition.onerror', {
        error: event?.error ?? 'unknown',
        stopRequested: stopRequestedRef.current,
      })

      if (stopRequestedRef.current) {
        return
      }

      setRecordingNotice('实时字幕暂时不稳定，但录音仍在继续。')
    }

    recognition.onend = () => {
      reportTalkDebug('A', '[DEBUG] recognition.onend', {
        stopRequested: stopRequestedRef.current,
        isRecording: mediaRecorderRef.current?.state ?? 'inactive',
      })

      if (
        stopRequestedRef.current ||
        !mediaRecorderRef.current ||
        mediaRecorderRef.current.state === 'inactive'
      ) {
        recognitionRef.current = null
        recordingModeRef.current = null
        return
      }

      recognitionRestartTimerRef.current = window.setTimeout(() => {
        if (
          stopRequestedRef.current ||
          !recognitionRef.current ||
          !mediaRecorderRef.current ||
          mediaRecorderRef.current.state === 'inactive'
        ) {
          return
        }

        try {
          recognitionRef.current.start()
          reportTalkDebug('A', '[DEBUG] recognition restart success')
        } catch (error) {
          reportTalkDebug('A', '[DEBUG] recognition restart failed', {
            error: error instanceof Error ? error.message : String(error),
          })
          recognitionRef.current = null
          recordingModeRef.current = null
          setRecordingNotice('实时字幕暂时不可用，但录音仍在继续。')
        }
      }, 200)
    }

    recognitionRef.current = recognition
    recordingModeRef.current = 'browser'

    try {
      recognition.start()
      reportTalkDebug('A', '[DEBUG] recognition.start success')
    } catch (error) {
      reportTalkDebug('A', '[DEBUG] recognition.start failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      recognitionRef.current = null
      recordingModeRef.current = null
      setRecordingNotice('实时字幕暂时不可用，但录音仍在继续。')
    }
  }

  const startRecording = async () => {
    if (typeof window === 'undefined') {
      startFallbackRecording()
      return
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      reportTalkDebug('D', '[DEBUG] MediaRecorder unavailable, fallback enabled')
      startFallbackRecording()
      return
    }

    stopRequestedRef.current = false
    setLiveTranscript('')
    setRecordingSeconds(0)
    setRecordingNotice(null)
    stopUserAudioPlayback()
    window.speechSynthesis.cancel()
    setSpeakingText(null)
    audioChunksRef.current = []

    reportTalkDebug('B', '[DEBUG] startRecording called', {
      talkMode,
    })

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      const preferredMimeType =
        [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/ogg;codecs=opus',
        ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? ''
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream)

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onerror = () => {
        reportTalkDebug('C', '[DEBUG] MediaRecorder error')
        setRecordingNotice('录音过程中发生异常，请再试一次。')
      }

      recorder.onstop = () => {
        void finalizeMediaRecording(recorder.mimeType)
      }

      mediaRecorderRef.current = recorder
      recorder.start(250)
      setIsRecording(true)
      reportTalkDebug('A', '[DEBUG] MediaRecorder started', {
        mimeType: recorder.mimeType || 'default',
      })

      startBrowserRecognition()
      startRecordingWatchers(() => {
        stopRequestedRef.current = true
        stopBrowserRecognition()
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop()
        }
      })
    } catch (error) {
      reportTalkDebug('D', '[DEBUG] getUserMedia failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      stopMediaStream()
      setIsRecording(false)
      setRecordingSeconds(0)
      setRecordingNotice('浏览器没有成功获取麦克风权限，请检查授权后再试。')
    }
  }

  const toggleRecording = () => {
    reportTalkDebug('B', '[DEBUG] toggleRecording called', {
      isRecording,
      mode: recordingModeRef.current,
    })

    if (isRecording) {
      stopRecordingAndSubmit()
      return
    }

    void startRecording()
  }

  const startAssessment = async () => {
    if (!assessmentPlan) return
    setIsGeneratingAssessment(true)
    try {
      const response = await generateAssessment({ level: 'medium', plan: assessmentPlan })
      if (response.questions.length > 0) {
        setAssessmentQuestions(response.questions)
        setAssessmentAnswers([])
        setCurrentQuestionIndex(0)
        setAssessmentStage('testing')
      }
    } catch {
      // Fallback handled by API
    } finally {
      setIsGeneratingAssessment(false)
    }
  }

  const handleAssessmentAnswer = (question: AssessmentQuestion, answerText?: string, isCorrect?: boolean) => {
    if (typeof window !== 'undefined') {
      window.speechSynthesis.cancel()
      setSpeakingText(null)
    }

    const nextAnswers = [
      ...assessmentAnswers,
      {
        questionId: question.id,
        type: question.type,
        isCorrect,
        transcript: answerText,
      },
    ]
    setAssessmentAnswers(nextAnswers)

    if (currentQuestionIndex + 1 < assessmentQuestions.length) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      void submitAssessment(nextAnswers)
    }
  }

  const submitAssessment = async (finalAnswers: typeof assessmentAnswers) => {
    setAssessmentStage('result')
    setIsEvaluatingAssessment(true)
    try {
      const response = await evaluateAssessment({ answers: finalAnswers })
      setAssessmentResult(response.result)
    } catch {
      // Fallback handled by API
    } finally {
      setIsEvaluatingAssessment(false)
    }
  }

  const handleWordSearch = async () => {
    if (!searchInput.trim()) {
      return
    }

    setIsSearchingWord(true)

    try {
      const response = await searchVocabulary({
        query: searchInput,
        mode: searchMode,
      })

      const item: VocabularyItem = {
        ...response.item,
        id: response.item.id ?? response.item.term.toLowerCase().replace(/\s+/g, '-'),
      }

      setSelectedWord(item)
      rememberSearch(searchInput, searchMode, savedWords.includes(item.id))
    } finally {
      setIsSearchingWord(false)
    }
  }

  const openRelatedWord = (term: string) => {
    setSearchInput(term)
    setSearchMode('direct')
    setPendingRelatedWord(term)

    const requestId = relatedWordRequestIdRef.current + 1
    relatedWordRequestIdRef.current = requestId

    void searchVocabulary({ query: term, mode: 'direct' })
      .then((response) => {
        if (relatedWordRequestIdRef.current !== requestId) {
          return
        }

        const nextItem: VocabularyItem = {
          ...response.item,
          id: response.item.id ?? response.item.term.toLowerCase().replace(/\s+/g, '-'),
        }

        rememberSearch(term, 'direct', savedWords.includes(nextItem.id))
        setSelectedWord(nextItem)
        setPendingRelatedWord(null)
      })
      .catch(() => {
        if (relatedWordRequestIdRef.current !== requestId) {
          return
        }

        setPendingRelatedWord(null)
      })
  }

  const allVocabulary = useMemo(() => {
    return [...dailyWords, ...vocabularySeed].filter(
      (item, index, list) => list.findIndex((candidate) => candidate.term === item.term) === index,
    )
  }, [dailyWords])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    allVocabulary.forEach((item) => {
      const imageUrl = buildWordImageUrl(item)
      if (wordImageStatus[imageUrl]) {
        return
      }

      setWordImageStatus((current) => {
        if (current[imageUrl]) {
          return current
        }

        return {
          ...current,
          [imageUrl]: 'loading',
        }
      })

      const image = new window.Image()
      image.onload = () => {
        setWordImageStatus((current) => ({
          ...current,
          [imageUrl]: 'loaded',
        }))
      }
      image.onerror = () => {
        setWordImageStatus((current) => ({
          ...current,
          [imageUrl]: 'error',
        }))
      }
      image.src = imageUrl
    })
  }, [allVocabulary, wordImageStatus])

  const filteredVocabulary = useMemo(() => {
    return allVocabulary.filter((item) => {
      const sceneMatch = selectedScene === 'All' || item.scene === selectedScene
      const keyword = searchInput.trim().toLowerCase()

      if (!keyword) {
        return sceneMatch
      }

      if (searchMode === 'direct') {
        return (
          sceneMatch &&
          (item.term.toLowerCase().includes(keyword) ||
            item.definitionZh.includes(searchInput) ||
            item.scene.toLowerCase().includes(keyword))
        )
      }

      return (
        sceneMatch &&
        (item.definitionZh.includes(searchInput) ||
          item.usage.includes(searchInput) ||
          item.examples.some((example) => example.zh.includes(searchInput)))
      )
    })
  }, [allVocabulary, searchInput, searchMode, selectedScene])

  const displayedVocabulary = useMemo(() => {
    const scenePriority = new Map(vocabularySceneOrder.map((scene, index) => [scene, index]))

    return [...filteredVocabulary].sort((left, right) => {
      const leftIsToday = dailyWords.some((item) => item.term === left.term)
      const rightIsToday = dailyWords.some((item) => item.term === right.term)

      if (leftIsToday !== rightIsToday) {
        return leftIsToday ? -1 : 1
      }

      const leftScenePriority = scenePriority.get(left.scene) ?? 999
      const rightScenePriority = scenePriority.get(right.scene) ?? 999

      if (leftScenePriority !== rightScenePriority) {
        return leftScenePriority - rightScenePriority
      }

      const leftSaved = savedWords.includes(left.id)
      const rightSaved = savedWords.includes(right.id)

      if (leftSaved !== rightSaved) {
        return leftSaved ? -1 : 1
      }

      return left.term.localeCompare(right.term)
    })
  }, [dailyWords, filteredVocabulary, savedWords])

  const filteredReaderItems = useMemo(() => {
    if (readerCategory === 'All') {
      return readerItems
    }

    return readerItems.filter((item) => item.tag === readerCategory)
  }, [readerCategory, readerItems])

  const displayedReaderItems = useMemo(() => {
    const categoryPriority = new Map(readerCategoryOrder.map((item, index) => [item, index]))

    return [...filteredReaderItems].sort((left, right) => {
      const leftPriority = categoryPriority.get(left.tag as ReaderCategory) ?? 999
      const rightPriority = categoryPriority.get(right.tag as ReaderCategory) ?? 999

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority
      }

      const leftUpdatedAt = left.updatedAt ?? ''
      const rightUpdatedAt = right.updatedAt ?? ''

      if (leftUpdatedAt !== rightUpdatedAt) {
        return rightUpdatedAt.localeCompare(leftUpdatedAt)
      }

      return left.title.localeCompare(right.title)
    })
  }, [filteredReaderItems])

  const todayAddedWordCount = useMemo(() => {
    return new Set([
      ...dailyWords.map((item) => item.id),
      ...systemAddedTodayIds,
      ...savedWords,
    ]).size
  }, [dailyWords, savedWords])

  const isRootTabView =
    isAssessmentComplete && !selectedWord && !selectedArticle
  const recordingTimerLabel = `00:${String(Math.min(recordingSeconds, 60)).padStart(2, '0')} / 01:00`
  const isWordLoadingScreen = Boolean(pendingRelatedWord)
  const selectedWordImageUrl = selectedWord ? buildWordImageUrl(selectedWord) : null
  const selectedWordImageReady = selectedWordImageUrl ? wordImageStatus[selectedWordImageUrl] === 'loaded' : false
  const isAiSpeakingInTalk = Boolean(
    activeTab === 'talk' &&
      speakingText &&
      chatMessages.some((message) => message.side === 'ai' && message.text === speakingText),
  )

  return (
    <div className="app-shell">
      <div className="device-frame">
        {!isAssessmentComplete ? (
          <main className="screen assessment-screen">
            {assessmentStage === 'intro' && (
              <>
                <div className="hero-card">
                  <div className="hero-badge">First-time assessment</div>
                  <h1>先做 5 分钟测试，再开始学习。</h1>
                  <p>完成后会自动生成你的词汇表、Reader 难度和 Talk With Me 对话级别。</p>
                </div>

                <div className="section-card">
                  <div className="mini-feature">
                    <strong>Listening</strong>
                    <span>{assessmentPlan ? assessmentPlan.listening : '-'} 题</span>
                  </div>
                  <div className="mini-feature">
                    <strong>Reading</strong>
                    <span>{assessmentPlan ? assessmentPlan.reading : '-'} 题</span>
                  </div>
                  <div className="mini-feature">
                    <strong>Speaking</strong>
                    <span>{assessmentPlan ? assessmentPlan.speaking : '-'} 题</span>
                  </div>
                </div>

                <button
                  className="primary-button"
                  type="button"
                  onClick={startAssessment}
                  disabled={isGeneratingAssessment || !assessmentPlan}
                >
                  {isGeneratingAssessment ? 'Generating questions...' : 'Start Assessment'}
                </button>
              </>
            )}

            {assessmentStage === 'testing' && assessmentQuestions[currentQuestionIndex]?.type === 'listening' && (
              <>
                <div className="panel-header">
                  <span className="eyebrow">Step {currentQuestionIndex + 1} / {assessmentQuestions.length}</span>
                  <h2>Listening</h2>
                  <p>听一段短音频，判断核心意图。</p>
                </div>

                <div className="audio-card">
                  <button
                    type="button"
                    className={`icon-square ${speakingText === assessmentQuestions[currentQuestionIndex].content ? 'is-active' : ''}`}
                    onClick={() =>
                      speakText(assessmentQuestions[currentQuestionIndex].content ?? '')
                    }
                    aria-label="播放听力音频"
                  >
                    <Icon
                      name={
                        speakingText === assessmentQuestions[currentQuestionIndex].content
                          ? 'pause'
                          : 'play'
                      }
                      className="icon-md"
                    />
                  </button>
                  <div>
                    <strong>{assessmentQuestions[currentQuestionIndex].question}</strong>
                    <p>Listen carefully to answer the question.</p>
                  </div>
                </div>

                <div className="option-list">
                  {assessmentQuestions[currentQuestionIndex].options?.map((option) => (
                    <button
                      key={option}
                      className="option-button"
                      type="button"
                      onClick={() => handleAssessmentAnswer(
                        assessmentQuestions[currentQuestionIndex],
                        option,
                        option === assessmentQuestions[currentQuestionIndex].answer
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </>
            )}

            {assessmentStage === 'testing' && assessmentQuestions[currentQuestionIndex]?.type === 'reading' && (
              <>
                <div className="panel-header">
                  <span className="eyebrow">Step {currentQuestionIndex + 1} / {assessmentQuestions.length}</span>
                  <h2>Reading</h2>
                  <p>读一段短文，判断作者重点。</p>
                </div>

                <div className="reading-card">
                  <p>{assessmentQuestions[currentQuestionIndex].content}</p>
                </div>

                <div className="reading-question" style={{ marginBottom: '12px' }}>
                  <strong>{assessmentQuestions[currentQuestionIndex].question}</strong>
                </div>

                <div className="option-list">
                  {assessmentQuestions[currentQuestionIndex].options?.map((option) => (
                    <button
                      key={option}
                      className="option-button"
                      type="button"
                      onClick={() => handleAssessmentAnswer(
                        assessmentQuestions[currentQuestionIndex],
                        option,
                        option === assessmentQuestions[currentQuestionIndex].answer
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </>
            )}

            {assessmentStage === 'testing' && assessmentQuestions[currentQuestionIndex]?.type === 'speaking' && (
              <>
                <div className="panel-header">
                  <span className="eyebrow">Step {currentQuestionIndex + 1} / {assessmentQuestions.length}</span>
                  <h2>Speaking</h2>
                  <p>请用英语简短回答。</p>
                </div>

                <div className="prompt-card">
                  <strong>Prompt</strong>
                  <p>{assessmentQuestions[currentQuestionIndex].prompt}</p>
                </div>

                <div className="talk-actions" style={{ marginTop: 'auto', paddingBottom: '40px' }}>
                  {isRecording && (
                    <div className="recording-panel">
                      <div className="recording-status">
                        <span className="recording-status__left">
                          <span className="recording-dot" />
                          <span>Recording...</span>
                        </span>
                        <span>{recordingTimerLabel}</span>
                      </div>
                      <div className="recording-wave" aria-hidden="true">
                        {Array.from({ length: 12 }).map((_, index) => (
                          <span key={`record-wave-${index}`} style={{ animationDelay: `${index * 0.08}s` }} />
                        ))}
                      </div>
                      <p>{liveTranscript || 'Listening...'}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    className={`record-button talk-record ${isRecording ? 'is-recording' : ''}`}
                    onClick={() => {
                      if (isRecording) {
                        const finalTranscript = liveTranscriptRef.current.trim()
                        clearRecordingTimers()
                        stopBrowserRecognition()
                        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                          mediaRecorderRef.current.stop()
                        }
                        setIsRecording(false)
                        setRecordingSeconds(0)
                        handleAssessmentAnswer(assessmentQuestions[currentQuestionIndex], finalTranscript || 'User submitted audio without transcript')
                        return
                      }
                      void startRecording()
                    }}
                  >
                    <Icon name="mic" className="icon-sm" />{' '}
                    {isRecording ? '完成录音并提交' : '开始回答'}
                  </button>
                </div>
              </>
            )}

            {assessmentStage === 'result' && (
              <>
                {isEvaluatingAssessment || !assessmentResult ? (
                  <div className="hero-card result-card">
                    <div className="hero-badge">Evaluating</div>
                    <h1>正在生成你的英语能力报告...</h1>
                    <p>AI 考官正在分析你的听力、阅读和口语表现。</p>
                  </div>
                ) : (
                  <>
                    <div className="hero-card result-card">
                      <div className="hero-badge">Your profile</div>
                      <h1>{assessmentResult.level}</h1>
                      <p>{assessmentResult.summary}</p>
                    </div>

                    <div className="three-up">
                      <div className="score-card">
                        <strong>Listening</strong>
                        <span>{assessmentResult.listeningScore}</span>
                      </div>
                      <div className="score-card">
                        <strong>Reading</strong>
                        <span>{assessmentResult.readingScore}</span>
                      </div>
                      <div className="score-card">
                        <strong>Speaking</strong>
                        <span>{assessmentResult.speakingScore}</span>
                      </div>
                    </div>

                    <div className="section-card" style={{ textAlign: 'left', display: 'grid', gap: '12px' }}>
                      <div>
                        <strong style={{ color: '#047857' }}>👍 Strengths</strong>
                        <p>{assessmentResult.strengths}</p>
                      </div>
                      <div style={{ height: '1px', background: '#e2e8f0' }} />
                      <div>
                        <strong style={{ color: '#b45309' }}>🎯 To Improve</strong>
                        <p>{assessmentResult.weaknesses}</p>
                      </div>
                    </div>

                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => {
                        setIsAssessmentComplete(true)
                        setActiveTab('vocabulary')
                      }}
                    >
                      Go To My Vocabulary
                    </button>
                  </>
                )}
              </>
            )}
          </main>
        ) : (
          <>
            <main className="screen">
              {selectedWord || pendingRelatedWord ? (
                <section className="detail-screen">
                  <div className="detail-topbar">
                    <button
                      type="button"
                      className="icon-ghost"
                      onClick={() => {
                        if (pendingRelatedWord) {
                          relatedWordRequestIdRef.current += 1
                          setPendingRelatedWord(null)
                          return
                        }

                        setSelectedWord(null)
                      }}
                      aria-label="返回"
                    >
                      <Icon name="chevron-left" className="icon-md" />
                    </button>
                    <span>Word</span>
                    {selectedWord && !pendingRelatedWord ? (
                      <button
                        type="button"
                        className="icon-ghost"
                        onClick={() => toggleSaveWord(selectedWord.id)}
                        aria-label={savedWords.includes(selectedWord.id) ? '取消收藏' : '收藏'}
                      >
                        <Icon
                          name={savedWords.includes(selectedWord.id) ? 'bookmark-filled' : 'bookmark'}
                          className="icon-md"
                        />
                      </button>
                    ) : (
                      <span className="detail-topbar__slot" aria-hidden="true" />
                    )}
                  </div>

                  {isWordLoadingScreen ? (
                    <>
                      <div className="detail-scroll detail-scroll--loading">
                        <div className="image-panel compact-panel word-card-loading-panel" style={{ padding: '0', overflow: 'hidden', position: 'relative', display: 'block' }}>
                          <div className="image-label word-card-loading-panel__scene" aria-hidden="true">
                            <span className="word-loading-skeleton__line word-loading-skeleton__line--chip" />
                          </div>
                          <div className="image-placeholder compact-image" style={{ width: '100%', height: '180px', borderRadius: '18px 18px 0 0', margin: 0, overflow: 'hidden', background: '#f8fafc' }}>
                            <div className="word-image-loading" aria-hidden="true">
                              <div className="word-image-loading__art" />
                            </div>
                          </div>
                          <div className="word-card-loading-panel__body">
                            <div className="word-card-loading-panel__heading">
                              <h2>{pendingRelatedWord}</h2>
                              <span className="word-card-loading-panel__audio" aria-hidden="true" />
                            </div>
                            <div className="word-card-loading-panel__meta">
                              <span className="word-loading-skeleton__line word-loading-skeleton__line--meta" />
                            </div>
                            <div className="word-loading-panel__dots" aria-hidden="true">
                              <span />
                              <span />
                              <span />
                            </div>
                          </div>
                        </div>

                        <section className="content-card compact-card word-loading-skeleton">
                          <h3>释义</h3>
                          <span className="word-loading-skeleton__line word-loading-skeleton__line--title" />
                          <span className="word-loading-skeleton__line" />
                          <span className="word-loading-skeleton__line" />
                          <span className="word-loading-skeleton__line word-loading-skeleton__line--short" />
                        </section>

                        <section className="content-card compact-card word-loading-skeleton">
                          <div className="content-heading">
                            <h3>例句</h3>
                            <span className="mini-text">2</span>
                          </div>
                          <span className="word-loading-skeleton__line word-loading-skeleton__line--title" />
                          <span className="word-loading-skeleton__line" />
                          <span className="word-loading-skeleton__line" />
                        </section>

                        <section className="content-card compact-card word-loading-skeleton">
                          <h3>用法</h3>
                          <span className="word-loading-skeleton__line word-loading-skeleton__line--short" />
                          <span className="word-loading-skeleton__line" />
                        </section>

                        <section className="content-card compact-card word-loading-skeleton">
                          <h3>相关词</h3>
                          <div className="word-loading-chip-row" aria-hidden="true">
                            <span className="word-loading-chip" />
                            <span className="word-loading-chip word-loading-chip--wide" />
                            <span className="word-loading-chip" />
                          </div>
                        </section>
                      </div>

                      <div className="action-bar">
                        <div className="word-loading-action word-loading-action--icon" aria-hidden="true" />
                        <div className="word-loading-action word-loading-action--primary" aria-hidden="true" />
                      </div>
                    </>
                  ) : selectedWord ? (
                    <>
                      <div className="detail-scroll">
                        <div className="image-panel compact-panel" style={{ padding: '0', overflow: 'hidden', position: 'relative', display: 'block' }}>
                          <div className="image-label" style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', color: 'var(--color-primary-600)', padding: '4px 10px', borderRadius: '999px', fontSize: '13px', fontWeight: '600' }}>
                            {selectedWord.scene}
                          </div>
                          <div className="image-placeholder compact-image" style={{ width: '100%', height: '180px', borderRadius: '18px 18px 0 0', margin: 0, overflow: 'hidden', background: '#f8fafc' }}>
                            {!selectedWordImageReady && (
                              <div className="word-image-loading">
                                <div className="word-image-loading__badge">Illustration</div>
                                <div className="word-image-loading__art" aria-hidden="true" />
                              </div>
                            )}
                            {selectedWordImageUrl && (
                              <img
                                src={selectedWordImageUrl}
                                alt={selectedWord.term}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: selectedWordImageReady ? 1 : 0, transition: 'opacity 0.24s ease' }}
                                onLoad={() =>
                                  setWordImageStatus((current) => ({
                                    ...current,
                                    [selectedWordImageUrl]: 'loaded',
                                  }))
                                }
                                onError={() =>
                                  setWordImageStatus((current) => ({
                                    ...current,
                                    [selectedWordImageUrl]: 'error',
                                  }))
                                }
                              />
                            )}
                          </div>
                          <div style={{ padding: '16px 20px', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                              <h2 style={{ margin: 0 }}>{selectedWord.term}</h2>
                              <button
                                type="button"
                                className={`icon-circle ${speakingText === selectedWord.term ? 'is-active' : ''}`}
                                onClick={() => speakText(selectedWord.term)}
                                aria-label="播放单词发音"
                                style={{ width: '32px', height: '32px', background: 'var(--color-primary-100)', color: 'var(--color-primary-600)' }}
                              >
                                <Icon
                                  name={speakingText === selectedWord.term ? 'pause' : 'volume'}
                                  className="icon-sm"
                                />
                              </button>
                            </div>
                            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '15px' }}>
                              {selectedWord.partOfSpeech} {selectedWord.phonetic}
                            </p>
                          </div>
                        </div>

                        <div className="detail-body">
                          <section className="content-card compact-card">
                            <div className="content-heading">
                              <h3>释义</h3>
                            </div>
                            <p>{selectedWord.definitionZh}</p>
                          </section>

                          <section className="content-card compact-card">
                            <div className="content-heading">
                              <h3>例句</h3>
                              <span className="mini-text">2</span>
                            </div>
                            {Array.isArray(selectedWord.examples) && selectedWord.examples.map((example) => (
                              <div key={example.en} className="example-card">
                                <div className="example-row">
                                  <strong>{example.en}</strong>
                                  <button
                                    type="button"
                                    className={`icon-circle ${speakingText === example.en ? 'is-active' : ''}`}
                                    onClick={() => speakText(example.en)}
                                    aria-label="播放例句发音"
                                  >
                                    <Icon
                                      name={speakingText === example.en ? 'pause' : 'play'}
                                      className="icon-sm"
                                    />
                                  </button>
                                </div>
                                <p>{example.zh}</p>
                              </div>
                            ))}
                          </section>

                          <section className="content-card compact-card">
                            <h3>用法</h3>
                            <p>{selectedWord.usage}</p>
                            <p className="secondary-text">{selectedWord.culture}</p>
                          </section>

                          <section className="content-card compact-card">
                            <h3>相关词</h3>
                            <div className="chip-row">
                              {extractRelatedWords(selectedWord).map((item) => (
                                <button
                                  key={item}
                                  type="button"
                                  className="soft-chip"
                                  onClick={() => openRelatedWord(item)}
                                  style={{ border: 'none', cursor: 'pointer', font: 'inherit' }}
                                >
                                  {item}
                                </button>
                              ))}
                            </div>
                            <p className="secondary-text">{selectedWord.confusing}</p>
                          </section>
                        </div>
                      </div>

                      <div className="action-bar">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => toggleSaveWord(selectedWord.id)}
                        >
                          <Icon
                            name={savedWords.includes(selectedWord.id) ? 'bookmark-filled' : 'bookmark'}
                            className="icon-sm"
                          />
                        </button>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => {
                            setSelectedWord(null)
                            void initiateTalkWithAI('Free Talk', `围绕单词 ${selectedWord.term} 发起一段自然对话`)
                          }}
                        >
                          Talk With This Word
                        </button>
                      </div>
                    </>
                  ) : null}
                </section>
              ) : selectedArticle ? (
                <section className="detail-screen">
                  <div className="detail-topbar">
                    <button
                      type="button"
                      className="icon-ghost"
                      onClick={() => {
                        setSelectedArticle(null)
                        setReaderSelection(null)
                      }}
                      aria-label="返回"
                    >
                      <Icon name="chevron-left" className="icon-md" />
                    </button>
                    <span>Reader</span>
                    <button type="button" className="icon-ghost" aria-label="分享">
                      <Icon name="share" className="icon-md" />
                    </button>
                  </div>

                  <div className="detail-scroll">
                    <div className="reader-hero compact-panel">
                      <div>
                        <h2>{selectedArticle.title}</h2>
                      </div>
                      <p>
                        {selectedArticle.source} · {selectedArticle.level} · {selectedArticle.minutes}
                      </p>
                    </div>

                    <div className="detail-body">
                      <section className="content-card compact-card">
                        <h3>文章</h3>
                        <div className="reader-article-body">
                          {(selectedArticle.articleBody
                            ? buildArticleParagraphs(selectedArticle.articleBody)
                            : [
                                'A small change in wording can make the entire workday feel calmer. People who keep a clear routine often make faster decisions and feel less overwhelmed in meetings.',
                                selectedArticle.sentence,
                              ]).map((paragraph, index) => (
                            <p key={`${selectedArticle.id}-paragraph-${index}`}>{paragraph}</p>
                          ))}
                        </div>
                      </section>

                      <section className="content-card compact-card">
                        <h3>摘要</h3>
                        <p>{selectedArticle.summary}</p>
                      </section>

                      {readerSelection && (
                        <section className="selection-card">
                          <div>
                            <span className="mini-text">
                              {readerSelection.type === 'word' ? 'Word' : 'Sentence'}
                            </span>
                            <strong>{readerSelection.label}</strong>
                            <p>{readerSelection.detail}</p>
                          </div>
                          <div className="selection-actions">
                            <button
                              type="button"
                              className="icon-circle"
                              onClick={() => speakText(readerSelection.label)}
                              aria-label="播放"
                            >
                              <Icon name="play" className="icon-sm" />
                            </button>
                            <button
                              type="button"
                              className="icon-circle"
                              onClick={() =>
                                setSelectedWord(
                                  vocabularySeed.find((item) => item.term === selectedArticle.keyWord) ??
                                    vocabularySeed[0]
                                )
                              }
                              aria-label="保存到词汇表"
                            >
                              <Icon name="bookmark" className="icon-sm" />
                            </button>
                            {readerSelection.type === 'sentence' && (
                              <button type="button" className="icon-circle" aria-label="翻译">
                                <Icon name="translate" className="icon-sm" />
                              </button>
                            )}
                          </div>
                        </section>
                      )}
                    </div>
                  </div>

                  <div className="action-bar single">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => {
                        const contextMsg = `围绕文章主题继续聊天：${selectedArticle.prompt}`
                        setSelectedArticle(null)
                        void initiateTalkWithAI('Free Talk', contextMsg)
                      }}
                    >
                      Discuss This
                    </button>
                  </div>
                </section>
              ) : (
                <>
                  {activeTab === 'vocabulary' && (
                    <section className="tab-screen vocabulary-screen">
                      <div className="top-panel">
                        <div>
                          <span className="eyebrow">Vocabulary</span>
                          <h2>词汇</h2>
                          <p className="mini-text" style={{ margin: 0 }}>{activeVocabularyGuide}</p>
                        </div>
                        <span className="pill-info">今日新增 {todayAddedWordCount} 词语</span>
                      </div>

                      <div className="chip-row page-filter-row">
                        {['All', 'Daily', 'Work', 'Meeting', 'Interview', 'Travel'].map((scene) => (
                          <button
                            key={scene}
                            type="button"
                            className={`scene-chip ${selectedScene === scene ? 'active' : ''}`}
                            onClick={() => setSelectedScene(scene)}
                          >
                            {scene}
                          </button>
                        ))}
                      </div>

                      <div className="list-stack">
                        {isLoadingDailyWords && (
                          <article className="history-card">
                            <strong>正在获取今日词汇</strong>
                            <p>正在按当前场景整理新的词汇卡片。</p>
                          </article>
                        )}
                        {displayedVocabulary.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="vocab-card"
                            onClick={() => setSelectedWord(item)}
                          >
                            <div className="vocab-card__top">
                              <div>
                                <strong>{item.term}</strong>
                                <span>{item.phonetic}</span>
                              </div>
                              <span className={`tag tag--${item.scene.toLowerCase()}`}>{item.scene}</span>
                            </div>
                            <p>{item.definitionZh}</p>
                            <div className="vocab-card__bottom">
                              <span>{savedWords.includes(item.id) ? '已收藏' : '查看词卡'}</span>
                              {dailyWords.some((daily) => daily.term === item.term) && (
                                <span className="new-badge">New Today</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {activeTab === 'reader' && (
                    <section className="tab-screen">
                      <div className="top-panel">
                        <div>
                          <span className="eyebrow">Reader</span>
                          <h2>读物</h2>
                          <p className="mini-text" style={{ margin: 0 }}>{activeReaderGuide}</p>
                        </div>
                      </div>

                      <div className="chip-row page-filter-row reader-filter">
                        {readerTabs.map((item) => (
                          <button
                            key={item}
                            type="button"
                            className={`scene-chip ${readerCategory === item ? 'active' : ''}`}
                            onClick={() => setReaderCategory(item)}
                          >
                            {item}
                          </button>
                        ))}
                      </div>

                      <div className="list-stack">
                        <article className="history-card reader-update-card">
                          <strong>每日更新</strong>
                          <p>{readerLastUpdatedAt}</p>
                        </article>
                        {isLoadingReader && (
                          <article className="history-card">
                            <strong>正在更新 Reader</strong>
                            <p>正在整理新的英文文章与阅读内容。</p>
                          </article>
                        )}
                        {displayedReaderItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="reader-card"
                            onClick={() => setSelectedArticle(item)}
                          >
                            <div className="reader-card__meta">
                              <span>{item.source}</span>
                              <span>{item.minutes}</span>
                            </div>
                            <strong>{item.title}</strong>
                            <p>{item.summary}</p>
                            <p className="mini-text">{item.updatedAt || readerLastUpdatedAt}</p>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {activeTab === 'talk' && (
                    <section className="talk-screen">
                      <div className="talk-header">
                        <div className="top-panel talk-top">
                          <div>
                            <h2>Talk With Me</h2>
                          </div>
                        </div>

                        <div className="chip-row mode-filter-row">
                          {(['Free Talk', 'Work', 'Meeting', 'Interview', 'Travel'] as TalkMode[]).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              className={`scene-chip ${talkMode === mode ? 'active' : ''}`}
                              onClick={() => setTalkMode(mode)}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>

                        <div className="context-banner">{talkContext}</div>

                        <div className={`voice-status-strip ${isRecording ? 'is-recording' : isAiSpeakingInTalk ? 'is-speaking' : isSendingTalk ? 'is-thinking' : ''}`}>
                          <div className="voice-status-strip__main">
                            <span className="voice-status-dot" />
                            <strong>
                              {isRecording
                                ? '正在听你说'
                                : isAiSpeakingInTalk
                                  ? 'AI 正在说话'
                                  : isSendingTalk
                                    ? 'AI 正在思考'
                                    : '点击下方按钮开始语音聊天'}
                            </strong>
                          </div>
                          <span className="voice-status-strip__meta">
                            {isRecording ? recordingTimerLabel : `${talkMode} mode`}
                          </span>
                        </div>
                      </div>

                      <div ref={talkConversationRef} className="talk-conversation">
                        {recordingNotice && <div className="recording-notice">{recordingNotice}</div>}

                        <div className={`chat-list ${chatMessages.length === 0 && !isSendingTalk ? 'is-empty' : ''}`}>
                          {chatMessages.length === 0 && !isSendingTalk && (
                            <div className="talk-empty-state">
                              <div className="talk-empty-state__icon">
                                <Icon name="mic" className="icon-md" />
                              </div>
                              <strong>{activeTalkEmptyState.title}</strong>
                              <p>{activeTalkEmptyState.description}</p>
                            </div>
                          )}
                          {chatMessages.map((message, index) => {
                            if (message.side === 'ai' && message.text.startsWith('A more natural way:')) {
                              return (
                                <div key={`${message.side}-${index}`} className="correction-card">
                                  <strong>A more natural way</strong>
                                  <span>{message.text.replace('A more natural way: ', '')}</span>
                                </div>
                              )
                            }

                            if (message.side === 'ai') {
                              return (
                                <div key={`${message.side}-${index}`} className="chat-bubble is-ai voice-message">
                                  <div className="voice-message__toolbar">
                                    <span>Voice reply</span>
                                    <button
                                      type="button"
                                      className={`icon-circle ${speakingText === message.text ? 'is-active' : ''}`}
                                      onClick={() => speakText(message.text)}
                                      aria-label={speakingText === message.text ? '暂停播放' : '播放语音'}
                                    >
                                      <Icon
                                        name={speakingText === message.text ? 'pause' : 'play'}
                                        className="icon-sm"
                                      />
                                    </button>
                                  </div>
                                  <p>{message.text}</p>
                                </div>
                              )
                            }

                            return (
                              <div
                                key={message.id ?? `${message.side}-${index}`}
                                className={`chat-bubble ${message.side === 'user' ? 'is-user voice-message voice-message--user' : 'is-ai'}`}
                              >
                                <div className="voice-message__toolbar user-voice-toolbar">
                                  <span>Your voice</span>
                                  {message.audioDataUrl ? (
                                    <button
                                      type="button"
                                      className={`icon-circle ${playingUserAudioId === message.id ? 'is-active' : ''}`}
                                      onClick={() =>
                                        message.id && message.audioDataUrl
                                          ? playUserAudio(message.id, message.audioDataUrl)
                                          : undefined
                                      }
                                      aria-label={playingUserAudioId === message.id ? '暂停回放' : '播放录音'}
                                    >
                                      <Icon
                                        name={playingUserAudioId === message.id ? 'pause' : 'play'}
                                        className="icon-sm"
                                      />
                                    </button>
                                  ) : (
                                    <span className="voice-message__meta">Text only</span>
                                  )}
                                </div>
                                <p>{message.text}</p>
                              </div>
                            )
                          })}
                          {isSendingTalk && (
                            <div className="chat-bubble is-ai voice-message thinking-card">
                              <div className="voice-message__toolbar">
                                <span>Voice reply</span>
                                <span className="thinking-dot" />
                              </div>
                              <p>Thinking...</p>
                            </div>
                          )}
                          <div ref={chatEndRef} className="chat-list-end" aria-hidden="true" />
                        </div>
                      </div>

                      <div className="talk-actions">
                        {isRecording && (
                          <div className="recording-panel">
                            <div className="recording-status">
                              <span className="recording-status__left">
                                <span className="recording-dot" />
                                <span>Recording...</span>
                              </span>
                              <span>{recordingTimerLabel}</span>
                            </div>
                            <div className="recording-wave" aria-hidden="true">
                              {Array.from({ length: 12 }).map((_, index) => (
                                <span key={`record-wave-${index}`} style={{ animationDelay: `${index * 0.08}s` }} />
                              ))}
                            </div>
                            <p>{liveTranscript || 'Listening...'}</p>
                          </div>
                        )}
                        <button
                          type="button"
                          className={`record-button talk-record ${isRecording ? 'is-recording' : ''}`}
                          onClick={toggleRecording}
                          aria-label={isRecording ? '停止录制' : '开始说话录制'}
                        >
                          <Icon name="mic" className="icon-sm" />{' '}
                          {isRecording ? '停止录制' : '开始说话'}
                        </button>
                      </div>
                    </section>
                  )}

                  {activeTab === 'history' && (
                    <section className="tab-screen">
                      <div className="top-panel">
                        <div>
                          <span className="eyebrow">History</span>
                          <h2>自动保存记录</h2>
                        </div>
                      </div>

                      <div className="history-tabs">
                        {(['Chats', 'Searches'] as const).map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            className={`history-tab ${historyTab === tab ? 'active' : ''}`}
                            onClick={() => setHistoryTab(tab)}
                          >
                            <Icon
                              name={tab === 'Chats' ? 'message' : 'search'}
                              className="icon-sm"
                            />
                          </button>
                        ))}
                      </div>

                      {historyTab === 'Chats' ? (
                        <div className="list-stack">
                          <button
                            className="history-card"
                            style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 100%)', borderColor: '#c7d2fe', cursor: 'pointer', textAlign: 'left' }}
                            onClick={() => {
                              setAssessmentStage('intro')
                              setAssessmentQuestions([])
                              setAssessmentAnswers([])
                              setAssessmentResult(null)
                              setIsAssessmentComplete(false)
                            }}
                          >
                            <strong>重新进行英语能力测评</strong>
                            <p>更新你的等级，并重新生成对应的生词与阅读内容。</p>
                          </button>

                          {chatHistory.length === 0 ? (
                            <article className="history-card">
                              <strong>还没有新的聊天记录</strong>
                              <p>开始一次对话后，这里会自动保存摘要。</p>
                            </article>
                          ) : (
                            chatHistory.map((item) => (
                              <article key={item.id} className="history-card">
                                <strong>
                                  {item.mode} · {item.createdAt}
                                </strong>
                                <p>{item.summary}</p>
                              </article>
                            ))
                          )}
                        </div>
                      ) : (
                        <div className="list-stack">
                          {searchHistory.length === 0 ? (
                            <article className="history-card">
                              <strong>还没有新的查词记录</strong>
                              <p>用底部搜索框查一个词，这里就会自动保存。</p>
                            </article>
                          ) : (
                            searchHistory.map((item) => (
                              <article key={item.id} className="history-card">
                                <strong>{item.query}</strong>
                                <p>
                                  {item.mode === 'direct' ? '直接查词' : '中文描述生成表达'} · {item.createdAt}
                                  {item.saved ? ' · 已保存到词汇表' : ''}
                                </p>
                              </article>
                            ))
                          )}
                        </div>
                      )}
                    </section>
                  )}
                </>
              )}
            </main>

            {isRootTabView && (
              <>
                {activeTab === 'vocabulary' && (
                  <div className="floating-search-dock">
                    <div className="search-box docked">
                      <div className="search-input-wrap">
                        <Icon name="search" className="icon-sm search-leading" />
                        <input
                          value={searchInput}
                          onChange={(event) => setSearchInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              void handleWordSearch()
                            }
                          }}
                          placeholder={
                            activeSearchPlaceholder
                          }
                        />
                      </div>
                      <button
                        type="button"
                        className="icon-square"
                        disabled={isSearchingWord}
                        onClick={() => {
                          if (searchInput.trim()) {
                            void handleWordSearch()
                            return
                          }
                          setSearchMode((mode) => (mode === 'direct' ? 'describe' : 'direct'))
                        }}
                        aria-label={
                          searchInput.trim()
                            ? '搜索'
                            : searchMode === 'direct'
                              ? '切换到描述查询'
                              : '切换到直接查询'
                        }
                      >
                        <Icon
                          name={
                            isSearchingWord
                              ? 'sparkles'
                              : searchInput.trim()
                                ? 'search'
                                : searchMode === 'direct'
                                  ? 'sparkles'
                                  : 'search'
                          }
                          className="icon-md"
                        />
                      </button>
                    </div>
                  </div>
                )}

                <nav className="bottom-nav">
                  <button
                    type="button"
                    className={`nav-item ${activeTab === 'vocabulary' ? 'active' : ''}`}
                    onClick={() => setActiveTab('vocabulary')}
                    aria-label="词汇"
                  >
                    <Icon name="search" className="icon-md" />
                  </button>
                  <button
                    type="button"
                    className={`nav-item ${activeTab === 'reader' ? 'active' : ''}`}
                    onClick={() => setActiveTab('reader')}
                    aria-label="读物"
                  >
                    <Icon name="book" className="icon-md" />
                  </button>
                  <button
                    type="button"
                    className={`nav-item ${activeTab === 'talk' ? 'active' : ''}`}
                    onClick={() => setActiveTab('talk')}
                    aria-label="口语聊天"
                  >
                    <Icon name="mic" className="icon-md" />
                  </button>
                  <button
                    type="button"
                    className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                    aria-label="历史记录"
                  >
                    <Icon name="clock" className="icon-md" />
                  </button>
                </nav>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default App
