type SearchMode = 'direct' | 'describe'

type VocabularyItem = {
  id?: string
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

type TalkRequestMessage = { side: 'ai' | 'user'; text: string }

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

export type AssessmentQuestion = {
  id: string
  type: 'listening' | 'reading' | 'speaking'
  content?: string
  question?: string
  prompt?: string
  options?: string[]
  answer?: string
}

export type AssessmentResult = {
  level: string
  summary: string
  strengths: string
  weaknesses: string
  listeningScore: string
  readingScore: string
  speakingScore: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json()
}

export async function healthcheck() {
  return request<{ ok: boolean; provider: string }>('/api/health')
}

export async function searchVocabulary(input: {
  query: string
  mode: SearchMode
}) {
  return request<{ source: string; item: VocabularyItem; degraded?: boolean }>(
    '/api/vocabulary/search',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export async function sendTalkMessage(input: {
  mode: string
  context: string
  transcript: string
  messages: TalkRequestMessage[]
}) {
  return request<{ source: string; reply: string; correction: string | null; degraded?: boolean }>(
    '/api/talk',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export async function fetchDailyVocabulary(input: {
  scenes: string[]
  level: string
}) {
  return request<{ source: string; items: VocabularyItem[]; degraded?: boolean }>(
    '/api/vocabulary/daily',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export async function fetchReaderFeed(input: {
  scenes: string[]
  level: string
}) {
  return request<{ source: string; items: ReaderItem[]; degraded?: boolean }>('/api/reader/feed', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export type AssessmentPlan = {
  listening: number
  reading: number
  speaking: number
}

export async function fetchAssessmentPlan() {
  return request<{ source: string; plan: AssessmentPlan; degraded?: boolean }>('/api/assessment/plan', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function generateAssessment(input: { level: string; plan: AssessmentPlan }) {
  return request<{ source: string; questions: AssessmentQuestion[]; degraded?: boolean }>(
    '/api/assessment/generate',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export async function evaluateAssessment(input: {
  answers: { questionId: string; type: string; isCorrect?: boolean; transcript?: string }[]
}) {
  return request<{ source: string; result: AssessmentResult; degraded?: boolean }>(
    '/api/assessment/evaluate',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}
