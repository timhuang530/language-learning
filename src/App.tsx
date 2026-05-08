import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { fetchDailyVocabulary, fetchReaderFeed, healthcheck, searchVocabulary, sendTalkMessage } from './lib/api'
import { usePersistentState } from './lib/storage'

type MainTab = 'vocabulary' | 'reader' | 'talk' | 'grammar' | 'history'
type AssessmentStage = 'intro' | 'listening' | 'reading' | 'speaking' | 'result'
type SearchMode = 'direct' | 'describe'
type TalkMode = 'Free Talk' | 'Work' | 'Meeting' | 'Interview' | 'Travel'

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
  keyWord: string
  keyWordMeaning: string
  sentence: string
  sentenceZh: string
  prompt: string
}

type Lesson = {
  id: string
  scene: TalkMode | 'Daily'
  title: string
  goal: string
  points: string[]
  patterns: string[]
}

type ReaderSelection = {
  type: 'word' | 'sentence'
  label: string
  detail: string
}

type ChatMessage = {
  side: 'ai' | 'user'
  text: string
}

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
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

const vocabularySeed: VocabularyItem[] = [
  {
    id: 'compromise',
    term: 'compromise',
    phonetic: '/ˈkɑːmprəmaɪz/',
    partOfSpeech: 'n. / v.',
    definitionZh: '妥协，折中。双方各退一步，最后找到一个都能接受的中间方案。',
    scene: 'Work',
    imageLabel: 'Team discussion with two people meeting in the middle',
    usage:
      '这个词在工作、会议和关系沟通里都很常见。它带有一种“不是最完美，但大家可以继续往前走”的感觉。',
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

const lessons: Lesson[] = [
  {
    id: 'work-opinion',
    scene: 'Work',
    title: '工作场景里表达建议',
    goal: '在不太生硬的情况下提出建议或替代方案。',
    points: ['使用 could / might soften your tone', '用 because 补充理由', '避免命令式表达'],
    patterns: ['Maybe we could try...', 'I think it might help if...', 'One possible option is...'],
  },
  {
    id: 'meeting-actions',
    scene: 'Meeting',
    title: '会议里确认下一步',
    goal: '把模糊讨论变成明确行动项。',
    points: ['用 will 表达承诺', '用 by + 时间说明截止点', '重复确认避免误解'],
    patterns: ['So the next step is...', 'I will follow up by...', 'Just to confirm, we are going to...'],
  },
  {
    id: 'interview-story',
    scene: 'Interview',
    title: '面试里讲过去经历',
    goal: '更自然地描述经历、动作和结果。',
    points: ['过去时要稳定', '按背景-动作-结果来讲', '适当加入数据或影响'],
    patterns: ['I was responsible for...', 'One challenge I faced was...', 'In the end, we were able to...'],
  },
]

const initialChat: ChatMessage[] = [
  {
    side: 'ai',
    text: 'Hey, nice to meet you. I am your American friend for today. Want to start with something easy and tell me how your day has been?',
  },
  {
    side: 'user',
    text: 'My day is busy, I have too many meetings and I feel a little tired.',
  },
  {
    side: 'ai',
    text: 'That sounds rough. What part of the day drained you the most?',
  },
]

const systemAddedTodayIds = ['compromise', 'procrastinate']
const transcriptSamples: Record<TalkMode, string> = {
  'Free Talk': 'hi today i want to talk about my work and why i felt tired after too many meetings',
  Work: 'today i need to explain a delay and give my manager a clearer update on the next step',
  Meeting: 'i want to say my opinion politely and confirm what the team should do after this meeting',
  Interview: 'i want to answer a question about my strengths and one difficult project from last year',
  Travel: 'i need to ask for directions and explain that my itinerary changed this afternoon',
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
  const [activeTab, setActiveTab] = useState<MainTab>('vocabulary')
  const [searchMode, setSearchMode] = useState<SearchMode>('direct')
  const [searchInput, setSearchInput] = useState('')
  const [selectedScene, setSelectedScene] = useState('All')
  const [selectedWord, setSelectedWord] = useState<VocabularyItem | null>(null)
  const [savedWords, setSavedWords] = usePersistentState<string[]>('ll.savedWords', [
    'compromise',
    'follow-up',
  ])
  const [selectedArticle, setSelectedArticle] = useState<ReaderItem | null>(null)
  const [readerCategory, setReaderCategory] = useState('All')
  const [readerSelection, setReaderSelection] = useState<ReaderSelection | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [talkMode, setTalkMode] = useState<TalkMode>('Free Talk')
  const [historyTab, setHistoryTab] = useState<'Chats' | 'Searches'>('Chats')
  const [isAssessmentComplete, setIsAssessmentComplete] = usePersistentState(
    'll.assessmentComplete',
    false,
  )
  const [talkContext, setTalkContext] = useState('围绕你刚收藏或查过的词继续自然聊天')
  const [speakingText, setSpeakingText] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [chatMessages, setChatMessages] = usePersistentState<ChatMessage[]>('ll.chatMessages', initialChat)
  const [chatHistory, setChatHistory] = usePersistentState<ChatHistoryItem[]>('ll.chatHistory', [])
  const [searchHistory, setSearchHistory] = usePersistentState<SearchHistoryItem[]>('ll.searchHistory', [])
  const [dailyWords, setDailyWords] = usePersistentState<VocabularyItem[]>('ll.dailyWords', [])
  const [readerItems, setReaderItems] = usePersistentState<ReaderItem[]>('ll.readerItems', readerSeed)
  const [apiStatus, setApiStatus] = useState<'checking' | 'deepseek' | 'mock'>('checking')
  const [isSearchingWord, setIsSearchingWord] = useState(false)
  const [isSendingTalk, setIsSendingTalk] = useState(false)
  const [isLoadingDailyWords, setIsLoadingDailyWords] = useState(false)
  const [isLoadingReader, setIsLoadingReader] = useState(false)
  const [isCoachSpeaking, setIsCoachSpeaking] = useState(false)
  const recognitionRef = useRef<BrowserSpeechRecognitionInstance | null>(null)
  const cancelRecordingRef = useRef(false)
  const liveTranscriptRef = useRef('')

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        window.speechSynthesis.cancel()
      }
      recognitionRef.current?.stop()
    }
  }, [])

  useEffect(() => {
    healthcheck()
      .then((result) => setApiStatus(result.provider === 'deepseek' ? 'deepseek' : 'mock'))
      .catch(() => setApiStatus('mock'))
  }, [])

  useEffect(() => {
    const loadDynamicContent = async () => {
      setIsLoadingDailyWords(true)
      setIsLoadingReader(true)

      try {
        const [daily, reader] = await Promise.all([
          fetchDailyVocabulary({
            scenes: ['Daily', 'Work', 'Meeting', 'Interview', 'Travel'],
            level: '适合母语 6-7 年级',
          }),
          fetchReaderFeed({
            scenes: ['Work', 'Travel', 'Meeting'],
            level: '适合母语 6-7 年级',
          }),
        ])

        setDailyWords(
          daily.items.map((item, index) => ({
            ...item,
            id: item.id || `${item.term.toLowerCase().replace(/\s+/g, '-')}-${index}`,
          })),
        )

        setReaderItems(
          reader.items.map((item, index) => ({
            ...item,
            id: item.id || `reader-${index}`,
          })),
        )
      } catch {
        setDailyWords(vocabularySeed.slice(0, 5))
        setReaderItems(readerSeed)
      } finally {
        setIsLoadingDailyWords(false)
        setIsLoadingReader(false)
      }
    }

    void loadDynamicContent()
  }, [setDailyWords, setReaderItems])

  useEffect(() => {
    liveTranscriptRef.current = liveTranscript
  }, [liveTranscript])

  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return
    }

    const synthesis = window.speechSynthesis
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

  const speakCoachReply = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) {
      return
    }

    const synthesis = window.speechSynthesis
    synthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.98
    utterance.pitch = 1

    const voices = synthesis.getVoices()
    const preferredVoice =
      voices.find((voice) => voice.lang === 'en-US' && /male|david|alex|daniel|fred/i.test(voice.name)) ??
      voices.find((voice) => voice.lang === 'en-US')

    if (preferredVoice) {
      utterance.voice = preferredVoice
    }

    utterance.onstart = () => setIsCoachSpeaking(true)
    utterance.onend = () => setIsCoachSpeaking(false)
    utterance.onerror = () => setIsCoachSpeaking(false)

    synthesis.speak(utterance)
  }

  const submitTranscript = async (transcript: string) => {
    if (!transcript.trim()) {
      return
    }

    const nextUserMessage: ChatMessage = {
      side: 'user',
      text: transcript.trim(),
    }

    const nextMessages = [...chatMessages, nextUserMessage]
    setChatMessages(nextMessages)
    setIsSendingTalk(true)

    try {
      const response = await sendTalkMessage({
        mode: talkMode,
        context: talkContext,
        transcript,
        messages: nextMessages,
      })

      const aiMessages: ChatMessage[] = [{ side: 'ai', text: response.reply }]

      if (response.correction) {
        aiMessages.push({
          side: 'ai',
          text: `A more natural way: ${response.correction}`,
        })
      }

      setChatMessages((current) => [...current, ...aiMessages])
      const spokenCorrection = response.correction?.replace(/^A more natural way:\s*/i, '').trim()
      const spokenReply = spokenCorrection
        ? `A more natural way to say it is: ${spokenCorrection}. ${response.reply}`
        : response.reply
      speakCoachReply(spokenReply)
      rememberChat(talkMode, transcript.length > 36 ? `${transcript.slice(0, 36)}...` : transcript)
    } catch {
      setChatMessages((current) => [
        ...current,
        {
          side: 'ai',
          text: 'I could not reach the language server just now. Try again in a moment.',
        },
      ])
      speakCoachReply('I could not reach the language server just now. Try again in a moment.')
    } finally {
      setIsSendingTalk(false)
      setLiveTranscript('')
    }
  }

  const startFallbackRecording = () => {
    const targetText = transcriptSamples[talkMode]
    let index = 0
    cancelRecordingRef.current = false
    setLiveTranscript('')
    setIsRecording(true)

    const timer = window.setInterval(() => {
      if (cancelRecordingRef.current) {
        window.clearInterval(timer)
        return
      }

      index += 1
      const nextText = targetText.slice(0, index)
      setLiveTranscript(nextText)

      if (index >= targetText.length) {
        window.clearInterval(timer)
        setIsRecording(false)
        void submitTranscript(targetText)
      }
    }, 55)
  }

  const startRecording = () => {
    if (typeof window === 'undefined') {
      startFallbackRecording()
      return
    }

    const browserWindow = window as Window & {
      SpeechRecognition?: new () => BrowserSpeechRecognitionInstance
      webkitSpeechRecognition?: new () => BrowserSpeechRecognitionInstance
    }

    const SpeechRecognitionCtor =
      browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      startFallbackRecording()
      return
    }

    cancelRecordingRef.current = false
    setLiveTranscript('')
    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = false

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
      setLiveTranscript(transcript.trim())
    }

    recognition.onerror = () => {
      setIsRecording(false)
    }

    recognition.onend = () => {
      const finalTranscript = liveTranscriptRef.current.trim()
      setIsRecording(false)
      recognitionRef.current = null
      if (!cancelRecordingRef.current && finalTranscript) {
        void submitTranscript(finalTranscript)
      } else {
        setLiveTranscript('')
      }
    }

    recognitionRef.current = recognition
    setIsRecording(true)
    recognition.start()
  }

  const toggleRecording = () => {
    if (isRecording) {
      cancelRecordingRef.current = true
      recognitionRef.current?.stop()
      setIsRecording(false)
      setLiveTranscript('')
      return
    }

    startRecording()
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

  const filteredVocabulary = useMemo(() => {
    const mergedVocabulary = [...dailyWords, ...vocabularySeed].filter(
      (item, index, list) => list.findIndex((candidate) => candidate.term === item.term) === index,
    )

    return mergedVocabulary.filter((item) => {
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
  }, [searchInput, searchMode, selectedScene])

  const filteredReaderItems = useMemo(() => {
    if (readerCategory === 'All') {
      return readerItems
    }

    return readerItems.filter((item) => item.source.toLowerCase().includes(readerCategory.toLowerCase()))
  }, [readerCategory])

  const todayAddedWordCount = useMemo(() => {
    return new Set([
      ...dailyWords.map((item) => item.id),
      ...systemAddedTodayIds,
      ...savedWords,
    ]).size
  }, [dailyWords, savedWords])

  const isRootTabView =
    isAssessmentComplete && !selectedWord && !selectedArticle && !selectedLesson
  const voiceRounds = useMemo(
    () => chatMessages.filter((message) => message.side === 'user').length,
    [chatMessages],
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
                    <span>2 题</span>
                  </div>
                  <div className="mini-feature">
                    <strong>Reading</strong>
                    <span>2 题</span>
                  </div>
                  <div className="mini-feature">
                    <strong>Speaking</strong>
                    <span>2 题</span>
                  </div>
                </div>

                <button
                  className="primary-button"
                  type="button"
                  onClick={() => setAssessmentStage('listening')}
                >
                  Start Assessment
                </button>
              </>
            )}

            {assessmentStage === 'listening' && (
              <>
                <div className="panel-header">
                  <span className="eyebrow">Step 1 / 3</span>
                  <h2>Listening</h2>
                  <p>听一段短音频，判断核心意图。</p>
                </div>

                <div className="audio-card">
                  <button
                    type="button"
                    className={`icon-square ${speakingText === 'The speaker is explaining a deadline compromise with the client.' ? 'is-active' : ''}`}
                    onClick={() =>
                      speakText('The speaker is explaining a deadline compromise with the client.')
                    }
                    aria-label="播放听力音频"
                  >
                    <Icon
                      name={
                        speakingText ===
                        'The speaker is explaining a deadline compromise with the client.'
                          ? 'pause'
                          : 'play'
                      }
                      className="icon-md"
                    />
                  </button>
                  <div>
                    <strong>Office update</strong>
                    <p>A short office voice note about a deadline.</p>
                  </div>
                </div>

                <div className="option-list">
                  {[
                    '他在抱怨客户太难沟通',
                    '他在解释为什么项目需要延长时间',
                    '他在拒绝参加会议',
                    '他在介绍新的预算方案',
                  ].map((option) => (
                    <button
                      key={option}
                      className="option-button"
                      type="button"
                      onClick={() => setAssessmentStage('reading')}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </>
            )}

            {assessmentStage === 'reading' && (
              <>
                <div className="panel-header">
                  <span className="eyebrow">Step 2 / 3</span>
                  <h2>Reading</h2>
                  <p>读一段短文，判断作者重点。</p>
                </div>

                <div className="reading-card">
                  <p>
                    Good meetings do not always end with perfect agreement. Sometimes the best outcome
                    is a clear compromise, where everyone leaves knowing what to do next.
                  </p>
                </div>

                <div className="option-list">
                  {[
                    '好会议一定能让所有人完全同意',
                    '会议最重要的是让大家说得更久',
                    '折中但明确的行动结果往往比空谈更有价值',
                    '会议应该避免任何不同意见',
                  ].map((option) => (
                    <button
                      key={option}
                      className="option-button"
                      type="button"
                      onClick={() => setAssessmentStage('speaking')}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </>
            )}

            {assessmentStage === 'speaking' && (
              <>
                <div className="panel-header">
                  <span className="eyebrow">Step 3 / 3</span>
                  <h2>Speaking</h2>
                  <p>请用英语简短回答。</p>
                </div>

                <div className="prompt-card">
                  <strong>Prompt</strong>
                  <p>Tell me about a recent workday or school day, and mention one thing you wanted to improve.</p>
                </div>

                <button
                  className="record-button"
                  type="button"
                  onClick={() => setAssessmentStage('result')}
                >
                  Tap To Record
                </button>
                <span className="record-hint">Demo 版本中点击后直接进入评估结果</span>
              </>
            )}

            {assessmentStage === 'result' && (
              <>
                <div className="hero-card result-card">
                  <div className="hero-badge">Your current profile</div>
                  <h1>你目前大致接近英语母语者 6-7 年级水平。</h1>
                  <p>可以完成日常、旅游和基础工作交流。下一步重点练会议表达和面试叙事。</p>
                </div>

                <div className="three-up">
                  <div className="score-card">
                    <strong>Listening</strong>
                    <span>主旨稳定</span>
                  </div>
                  <div className="score-card">
                    <strong>Reading</strong>
                    <span>能读短文</span>
                  </div>
                  <div className="score-card">
                    <strong>Speaking</strong>
                    <span>适合弱纠错</span>
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
          </main>
        ) : (
          <>
            <main className="screen">
              {selectedWord ? (
                <section className="detail-screen">
                  <div className="detail-topbar">
                    <button
                      type="button"
                      className="icon-ghost"
                      onClick={() => setSelectedWord(null)}
                      aria-label="返回"
                    >
                      <Icon name="chevron-left" className="icon-md" />
                    </button>
                    <span>Word</span>
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
                  </div>

                  <div className="detail-scroll">
                    <div className="image-panel compact-panel">
                      <div className="image-label">{selectedWord.scene}</div>
                      <div className="image-placeholder compact-image">
                        <div className="image-art">{selectedWord.imageLabel}</div>
                      </div>
                      <h2>{selectedWord.term}</h2>
                      <p>
                        {selectedWord.partOfSpeech} {selectedWord.phonetic}
                      </p>
                    </div>

                    <div className="detail-body">
                      <section className="content-card compact-card">
                        <div className="content-heading">
                          <h3>自然解释</h3>
                          <button
                            type="button"
                            className={`icon-circle ${speakingText === selectedWord.term ? 'is-active' : ''}`}
                            onClick={() => speakText(selectedWord.term)}
                            aria-label="播放单词发音"
                          >
                            <Icon
                              name={speakingText === selectedWord.term ? 'pause' : 'volume'}
                              className="icon-sm"
                            />
                          </button>
                        </div>
                        <p>{selectedWord.definitionZh}</p>
                      </section>

                      <section className="content-card compact-card">
                        <div className="content-heading">
                          <h3>例句</h3>
                          <span className="mini-text">2</span>
                        </div>
                        {selectedWord.examples.map((example) => (
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
                          {selectedWord.related.map((item) => (
                            <span key={item} className="soft-chip">
                              {item}
                            </span>
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
                        setActiveTab('talk')
                        setTalkMode('Free Talk')
                        setTalkContext(`围绕单词 ${selectedWord.term} 发起一段自然对话`)
                        setSelectedWord(null)
                      }}
                    >
                      Talk With This Word
                    </button>
                  </div>
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
                        <p>
                          A small{' '}
                          <button
                            type="button"
                            className="text-token"
                            onClick={() =>
                              setReaderSelection({
                                type: 'word',
                                label: selectedArticle.keyWord,
                                detail: selectedArticle.keyWordMeaning,
                              } as ReaderSelection)
                            }
                          >
                            {selectedArticle.keyWord}
                          </button>{' '}
                          can make the entire workday feel calmer. People who keep a clear routine often
                          make faster decisions and feel less overwhelmed in meetings.
                        </p>
                        <button
                          type="button"
                          className="sentence-token"
                          onClick={() =>
                            setReaderSelection({
                              type: 'sentence',
                              label: selectedArticle.sentence,
                              detail: selectedArticle.sentenceZh,
                            } as ReaderSelection)
                          }
                        >
                          {selectedArticle.sentence}
                        </button>
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
                        setActiveTab('talk')
                        setTalkContext(`围绕文章主题继续聊天：${selectedArticle.prompt}`)
                        setSelectedArticle(null)
                      }}
                    >
                      Discuss This
                    </button>
                  </div>
                </section>
              ) : selectedLesson ? (
                <section className="detail-screen">
                  <div className="detail-topbar">
                    <button
                      type="button"
                      className="icon-ghost"
                      onClick={() => setSelectedLesson(null)}
                      aria-label="返回"
                    >
                      <Icon name="chevron-left" className="icon-md" />
                    </button>
                    <span>Grammar</span>
                    <button type="button" className="icon-ghost" aria-label="课程场景">
                      {selectedLesson.scene}
                    </button>
                  </div>

                  <div className="detail-scroll">
                    <div className="detail-body lesson-body">
                      <div className="hero-card compact">
                        <div className="hero-badge">{selectedLesson.scene}</div>
                        <h2>{selectedLesson.title}</h2>
                        <p>{selectedLesson.goal}</p>
                      </div>

                      <section className="content-card compact-card">
                        <h3>关键点</h3>
                        <ul className="bullet-list">
                          {selectedLesson.points.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </section>

                      <section className="content-card compact-card">
                        <h3>句型</h3>
                        <ul className="bullet-list">
                          {selectedLesson.patterns.map((pattern) => (
                            <li key={pattern}>{pattern}</li>
                          ))}
                        </ul>
                      </section>
                    </div>
                  </div>

                  <div className="action-bar single">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => {
                        setActiveTab('talk')
                        setTalkMode(selectedLesson.scene === 'Daily' ? 'Free Talk' : selectedLesson.scene)
                        setTalkContext(`围绕语法课 ${selectedLesson.title} 进行实战练习`)
                        setSelectedLesson(null)
                      }}
                    >
                      Practice In Talk With Me
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
                            <p>DeepSeek 正在根据你的场景生成新的词语卡片。</p>
                          </article>
                        )}
                        {filteredVocabulary.map((item) => (
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
                        </div>
                        <span className="pill-info">{apiStatus === 'deepseek' ? 'DeepSeek' : 'Mock'}</span>
                      </div>

                      <div className="chip-row page-filter-row reader-filter">
                        {['All', 'Speech', 'Travel', 'News'].map((item) => (
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
                        {isLoadingReader && (
                          <article className="history-card">
                            <strong>正在更新 Reader</strong>
                            <p>DeepSeek 正在准备新的英文文章与演讲内容。</p>
                          </article>
                        )}
                        {filteredReaderItems.map((item) => (
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
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {activeTab === 'talk' && (
                    <section className="talk-screen">
                      <div className="top-panel talk-top">
                        <div>
                          <span className="eyebrow">Talk With Me</span>
                          <h2>American friend</h2>
                        </div>
                        <span className="status-pill">{apiStatus === 'deepseek' ? 'DeepSeek' : 'Mock'}</span>
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

                      <div className="voice-room">
                        <div className={`voice-avatar-card ${isCoachSpeaking ? 'is-speaking' : ''}`}>
                          <div className="voice-avatar">
                            <Icon name="mic" className="icon-md" />
                          </div>
                          <div>
                            <strong>American friend</strong>
                            <p>
                              {isCoachSpeaking
                                ? '正在用语音回复你'
                                : isSendingTalk
                                  ? '正在思考下一句回复'
                                  : '已准备好开始语音交流'}
                            </p>
                          </div>
                        </div>

                        <div className="voice-summary-card">
                          <div>
                            <span className="mini-text">Voice rounds</span>
                            <strong>{voiceRounds}</strong>
                          </div>
                          <div>
                            <span className="mini-text">Mode</span>
                            <strong>{talkMode}</strong>
                          </div>
                        </div>

                        <div className={`voice-stage-card ${isRecording ? 'is-live' : ''}`}>
                          <div className="voice-stage-head">
                            <strong>
                              {isRecording
                                ? 'Listening'
                                : isSendingTalk
                                  ? 'Thinking'
                                  : isCoachSpeaking
                                    ? 'Speaking'
                                    : 'Ready'}
                            </strong>
                            <span>
                              {isRecording
                                ? '正在收听你的声音'
                                : isSendingTalk
                                  ? '正在生成回复'
                                  : isCoachSpeaking
                                    ? 'AI 正在朗读回复'
                                    : '点击下方按钮开始说话'}
                            </span>
                          </div>

                          <div className="voice-wave" aria-hidden="true">
                            {Array.from({ length: 12 }).map((_, index) => (
                              <span
                                key={`wave-${index}`}
                                className={
                                  isRecording || isCoachSpeaking || isSendingTalk ? 'is-animated' : ''
                                }
                                style={{ animationDelay: `${index * 0.08}s` }}
                              />
                            ))}
                          </div>

                          <p className="voice-stage-note">
                            对话内容内部仍会转写给模型，但页面不展示文字聊天气泡。
                          </p>
                        </div>
                      </div>

                      <div className="talk-actions">
                        {isRecording && (
                          <div className="recording-panel">
                            <div className="recording-status">
                              <span className="recording-dot" />
                              <span>Recording...</span>
                            </div>
                            <div className="voice-wave compact" aria-hidden="true">
                              {Array.from({ length: 10 }).map((_, index) => (
                                <span
                                  key={`recording-wave-${index}`}
                                  className="is-animated"
                                  style={{ animationDelay: `${index * 0.06}s` }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          className={`record-button talk-record ${isRecording ? 'is-recording' : ''}`}
                          onClick={toggleRecording}
                          aria-label={isRecording ? '取消录制' : '开始说话录制'}
                        >
                          <Icon name="mic" className="icon-sm" />{' '}
                          {isRecording ? '取消录制' : '开始说话'}
                        </button>
                      </div>
                    </section>
                  )}

                  {activeTab === 'grammar' && (
                    <section className="tab-screen">
                      <div className="top-panel">
                        <div>
                          <span className="eyebrow">Grammar</span>
                          <h2>场景化语法课</h2>
                        </div>
                        <span className="pill-info">Recommended</span>
                      </div>

                      <div className="list-stack">
                        {lessons.map((lesson) => (
                          <button
                            key={lesson.id}
                            type="button"
                            className="lesson-card"
                            onClick={() => setSelectedLesson(lesson)}
                          >
                            <div className="lesson-card__top">
                              <span className={`tag tag--${lesson.scene.toLowerCase()}`}>{lesson.scene}</span>
                              <span>2-3 grammar points</span>
                            </div>
                            <strong>{lesson.title}</strong>
                            <p>{lesson.goal}</p>
                          </button>
                        ))}
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
                            searchMode === 'direct'
                              ? 'Search a word'
                              : '用中文描述想表达什么'
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
                    className="nav-talk"
                    onClick={() => setActiveTab('talk')}
                    aria-label="口语聊天"
                  >
                    <Icon name="mic" className="icon-md" />
                  </button>
                  <button
                    type="button"
                    className={`nav-item ${activeTab === 'grammar' ? 'active' : ''}`}
                    onClick={() => setActiveTab('grammar')}
                    aria-label="语法"
                  >
                    <Icon name="grid" className="icon-md" />
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
