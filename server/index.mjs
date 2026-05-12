import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
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
const contentReferencePath = path.join(currentDir, 'content-reference.md')
let lastDeepSeekError = null
let lastDeepSeekSuccessAt = null

function loadContentReference() {
  try {
    return fs.readFileSync(contentReferencePath, 'utf8').trim()
  } catch {
    return ''
  }
}

const contentReference = loadContentReference()

function withContentReference(basePrompt) {
  if (!contentReference) {
    return basePrompt
  }

  return `${basePrompt}

以下是产品可参考的内容素材库。它只用于内容生成，不改变产品风格；你可以直接采用其中的素材，也可以借鉴其词汇、短语、阅读体裁和出题方式，但不要在结果里提及来源文档名称。

${contentReference}`
}

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
  agenda: {
    term: 'agenda',
    phonetic: '/əˈdʒendə/',
    partOfSpeech: '名词 (noun)',
    definitionZh: '议程。指会议要讨论的主题、顺序和安排。',
    scene: 'Meeting',
    imageLabel: 'meeting agenda document on a conference table',
    usage:
      '常见搭配：set the agenda, stick to the agenda, agenda doc。多用于会议开场、主持讨论和同步会议目标。',
    culture:
      '在英语会议里，agenda 常带有“先约定讨论边界”的意味，说 stick to the agenda 会显得高效且专业。',
    related: ['meeting minutes', 'topic', 'schedule'],
    confusing: 'agenda 偏会议议程；schedule 更泛，既可以指时间表，也可以指整体安排。',
    examples: [
      { en: 'Could you add the budget review to the agenda?', zh: '你可以把预算回顾加到议程里吗？' },
      { en: "Let's stick to the agenda so we can finish on time.", zh: '我们还是按议程来，这样才能准时结束。' },
    ],
  },
  milestone: {
    term: 'milestone',
    phonetic: '/ˈmaɪlstoʊn/',
    partOfSpeech: '名词 (noun)',
    definitionZh: '里程碑。项目推进过程中的关键阶段性节点。',
    scene: 'Work',
    imageLabel: 'project timeline with milestone flags',
    usage:
      '常见搭配：set milestones, hit a milestone, project milestone。常用于项目启动、进度同步和复盘。',
    culture:
      '在职场里，milestone 往往不只是时间点，还暗含“阶段成果已经可验证”的意思。',
    related: ['deadline', 'timeline', 'deliverable'],
    confusing: 'deadline 是最终或阶段截止时间；milestone 更偏关键节点，不一定等于最后期限。',
    examples: [
      { en: 'We need to set clearer milestones for the next phase.', zh: '我们需要为下一阶段设定更清晰的里程碑。' },
      { en: 'The team hit an important milestone ahead of schedule.', zh: '团队提前完成了一个重要里程碑。' },
    ],
  },
  stakeholder: {
    term: 'stakeholder',
    phonetic: '/ˈsteɪkˌhoʊldər/',
    partOfSpeech: '名词 (noun)',
    definitionZh: '相关方。指会受到项目影响、或对项目结果有利益关系的人或团队。',
    scene: 'Work',
    imageLabel: 'project stakeholders discussing around a table',
    usage:
      '常见搭配：key stakeholders, align with stakeholders, stakeholder meeting。常用于项目管理和跨团队协作。',
    culture:
      '英语职场里 stakeholder 范围很广，可能包括老板、合作团队、法务、运营，甚至外部客户。',
    related: ['owner', 'partner team', 'leadership'],
    confusing: 'owner 更偏直接负责人；stakeholder 是更广义的利益相关者。',
    examples: [
      { en: 'We should identify the key stakeholders before the kick-off.', zh: '我们应该在启动会前先确认关键相关方。' },
      { en: 'The update needs to be shared with all stakeholders.', zh: '这次更新需要同步给所有相关方。' },
    ],
  },
  blocker: {
    term: 'blocker',
    phonetic: '/ˈblɑːkər/',
    partOfSpeech: '名词 (noun)',
    definitionZh: '阻碍项，卡点。让任务无法继续推进的问题或依赖。',
    scene: 'Work',
    imageLabel: 'task board showing a blocker warning',
    usage:
      '常见搭配：potential blocker, remove a blocker, blocked by。常出现在周会、项目同步、风险沟通中。',
    culture:
      '在英语团队沟通里，直接说 blocker 并不显得消极，反而通常被视为及时暴露风险。',
    related: ['risk', 'issue', 'dependency'],
    confusing: 'issue 是更广义的问题；blocker 强调它已经影响推进，任务卡住了。',
    examples: [
      { en: 'Do we have any blockers before we move to the next step?', zh: '进入下一步之前，我们现在有卡点吗？' },
      { en: 'This task is blocked by a missing API response.', zh: '这个任务被缺失的 API 返回卡住了。' },
    ],
  },
  retention: {
    term: 'retention',
    phonetic: '/rɪˈtenʃən/',
    partOfSpeech: '名词 (noun)',
    definitionZh: '留存。指用户在一段时间后仍继续使用产品的比例。',
    scene: 'Daily',
    imageLabel: 'analytics dashboard showing retention curve',
    usage:
      '常见搭配：retention rate, improve retention, day-7 retention。多用于数据分析、产品复盘和增长讨论。',
    culture:
      '在互联网语境里，retention 往往比单纯拉新更受重视，因为它更能反映产品是否真的有价值。',
    related: ['engagement', 'conversion', 'churn'],
    confusing: 'engagement 偏参与度；retention 偏用户是否留下来持续使用。',
    examples: [
      { en: 'The retention rate dropped after the redesign.', zh: '改版之后留存率下降了。' },
      { en: 'We need to understand what is driving long-term retention.', zh: '我们需要理解到底是什么在驱动长期留存。' },
    ],
  },
  outlier: {
    term: 'outlier',
    phonetic: '/ˈaʊtˌlaɪər/',
    partOfSpeech: '名词 (noun)',
    definitionZh: '异常值。与其他数据点差异特别大的个别数据。',
    scene: 'Daily',
    imageLabel: 'chart with one outlier point highlighted',
    usage:
      '常见搭配：this data point is an outlier, remove outliers, investigate the outlier。适合数据分析场景。',
    culture:
      '在英文数据讨论中，指出 outlier 往往意味着“先别急着下结论”，需要进一步验证原因。',
    related: ['trend', 'sample size', 'anomaly'],
    confusing: 'anomaly 更偏异常现象；outlier 通常更明确地指统计意义上的离群数据点。',
    examples: [
      { en: 'That spike looks like an outlier rather than a stable trend.', zh: '那次激增看起来更像异常值，而不是稳定趋势。' },
      { en: 'Let’s check whether this outlier came from bad data.', zh: '我们看一下这个异常值是不是脏数据导致的。' },
    ],
  },
  refactor: {
    term: 'refactor',
    phonetic: '/riːˈfæktər/',
    partOfSpeech: '动词 (verb)',
    definitionZh: '重构。是在不改变核心功能的前提下，重新整理代码结构。',
    scene: 'Work',
    imageLabel: 'developer refactoring code on a laptop',
    usage:
      '常见搭配：refactor the code, refactor this module, code refactor。常用于技术讨论、代码质量和维护性相关场景。',
    culture:
      '在技术团队里，refactor 往往意味着“为了长期可维护性付出短期成本”，不是简单改几行代码。',
    related: ['technical debt', 'optimize', 'rewrite'],
    confusing: 'rewrite 往往是重写；refactor 更强调在现有基础上改善结构。',
    examples: [
      { en: 'We should refactor this component before adding more features.', zh: '在继续加功能前，我们应该先重构这个组件。' },
      { en: 'The team set aside a sprint to refactor legacy code.', zh: '团队专门留了一个冲刺周期来重构旧代码。' },
    ],
  },
  usability: {
    term: 'usability',
    phonetic: '/ˌjuːzəˈbɪləti/',
    partOfSpeech: '名词 (noun)',
    definitionZh: '易用性。指产品是否容易理解、操作顺畅、让用户轻松完成任务。',
    scene: 'Daily',
    imageLabel: 'product usability testing with wireframes',
    usage:
      '常见搭配：improve usability, usability issue, usability testing。适合产品设计、用户体验和评审场景。',
    culture:
      '在产品讨论里，说 usability 不只是“好不好看”，而是在强调用户完成任务的成本和阻力。',
    related: ['user journey', 'accessibility', 'UX'],
    confusing: 'UX 范围更大；usability 更聚焦“是否好用、是否容易完成任务”。',
    examples: [
      { en: 'The new layout looks cleaner, but its usability still needs work.', zh: '新布局看起来更清爽，但易用性还需要优化。' },
      { en: 'We should run a quick test to check the usability of this flow.', zh: '我们应该做个快速测试，检查这个流程的易用性。' },
    ],
  },
  rollout: {
    term: 'rollout',
    phonetic: '/ˈroʊlaʊt/',
    partOfSpeech: '名词 (noun)',
    definitionZh: '上线发布、逐步放量。尤其指一个功能分阶段推向用户的过程。',
    scene: 'Work',
    imageLabel: 'feature rollout plan with gradual user percentages',
    usage:
      '常见搭配：full rollout, phased rollout, rollout plan。经常出现在上线、灰度、复盘和数据监控语境里。',
    culture:
      '在产品和工程团队中，rollout 常带有“先小范围验证再放量”的默认含义，不一定一次性全量上线。',
    related: ['launch', 'grayscale release', 'canary'],
    confusing: 'launch 更泛，强调发布动作；rollout 更强调分阶段推出的过程。',
    examples: [
      { en: 'We should do a small rollout before opening it to everyone.', zh: '我们应该先小范围放量，再对所有人开放。' },
      { en: 'The rollout plan depends on how the metrics look this week.', zh: '这次放量计划取决于本周的数据表现。' },
    ],
  },
  'heads-up': {
    term: 'heads-up',
    phonetic: '/ˈhedz ʌp/',
    partOfSpeech: '名词 (noun)',
    definitionZh: '提醒，预先告知。通常是在事情发生前先给对方一个简短通知。',
    scene: 'Meeting',
    imageLabel: 'coworker sending a quick heads-up message in chat',
    usage:
      '常见搭配：just a heads-up, thanks for the heads-up。语气比正式通知更轻，但在职场沟通里非常高频。',
    culture:
      'heads-up 带有“先让你知道一下”的感觉，适合 Lark、Slack、邮件和口头提醒，不会显得太生硬。',
    related: ['reminder', 'notice', 'update'],
    confusing: 'reminder 更像提醒你别忘了；heads-up 更像提前告诉你有变化或要发生的事。',
    examples: [
      { en: 'Just a heads-up, the client meeting has been moved to Friday.', zh: '提醒一下，客户会议改到周五了。' },
      { en: 'Thanks for the heads-up. I will update the timeline.', zh: '谢谢提醒，我会更新一下时间表。' },
    ],
  },
  bandwidth: {
    term: 'bandwidth',
    phonetic: '/ˈbændwɪdθ/',
    partOfSpeech: '名词 (noun)',
    definitionZh: '精力带宽，可投入的时间和处理能力。在职场里常用来问一个人现在有没有余力接任务。',
    scene: 'Work',
    imageLabel: 'busy employee managing tasks on a laptop calendar',
    usage:
      '常见搭配：have bandwidth for something, not have the bandwidth, bandwidth issue。这里不是字面上的网络带宽，而是工作负载。',
    culture:
      '在英语职场里问 someone has bandwidth，会比直接要求别人接活更委婉，也更尊重对方当前优先级。',
    related: ['capacity', 'availability', 'workload'],
    confusing: 'capacity 更偏整体能力；bandwidth 更偏此刻能不能再接事情。',
    examples: [
      { en: 'Do you have bandwidth for a quick review this afternoon?', zh: '你今天下午还有精力带宽做个快速 review 吗？' },
      { en: "I don't have the bandwidth to take this on this week.", zh: '我这周没有余力接这个。' },
    ],
  },
  'trade-off': {
    term: 'trade-off',
    phonetic: '/ˈtreɪd ɔːf/',
    partOfSpeech: '名词 (noun)',
    definitionZh: '取舍，权衡。为了得到某一方面的好处，需要在另一方面做出让步。',
    scene: 'Interview',
    imageLabel: 'product team discussing a trade-off between speed and quality',
    usage:
      '常见搭配：make a trade-off, trade-off between A and B。常用于面试、产品决策、路线图讨论和资源规划。',
    culture:
      '在英语工作场景里承认有 trade-off 往往显得成熟，代表你理解现实约束，而不是只说理想方案。',
    related: ['compromise', 'priority', 'constraint'],
    confusing: 'compromise 更偏人与人之间的妥协；trade-off 更偏决策中两个目标之间的权衡。',
    examples: [
      { en: 'We had to make a trade-off between speed and long-term quality.', zh: '我们必须在速度和长期质量之间做取舍。' },
      { en: 'Every roadmap decision comes with a trade-off.', zh: '每个路线图决策都会伴随取舍。' },
    ],
  },
  commute: {
    term: 'commute',
    phonetic: '/kəˈmjuːt/',
    partOfSpeech: '动词/名词 (verb/noun)',
    definitionZh: '通勤；上下班往返。既可以作动词，也可以作名词。',
    scene: 'Daily',
    imageLabel: 'morning city commute with subway and office workers',
    usage:
      '常见搭配：commute to work, daily commute, a long commute。适用于搬家安家、交通方式和城市生活相关场景。',
    culture:
      '英语里谈 commute 常会自然带出住得远不远、交通方式、生活平衡等话题，是日常社交和职场闲聊常见内容。',
    related: ['transportation', 'subway', 'shuttle'],
    confusing: 'travel 更泛，commute 专指日常往返通勤。',
    examples: [
      { en: 'My commute is much shorter now that I live near the office.', zh: '我现在住得离公司近，通勤短多了。' },
      { en: 'What is the best way to commute from this neighborhood?', zh: '从这个街区通勤的最佳方式是什么？' },
    ],
  },
  lease: {
    term: 'lease',
    phonetic: '/liːs/',
    partOfSpeech: '名词/动词 (noun/verb)',
    definitionZh: '租约；租赁合同。也可作动词表示出租或承租。',
    scene: 'Daily',
    imageLabel: 'apartment lease agreement on a table with keys',
    usage:
      '常见搭配：sign the lease, lease agreement, one-year lease。适合住房与安家场景。',
    culture:
      '在海外安家语境里，lease 往往和押金、入住日期、是否含杂费等问题一起出现，是找房过程里的核心词。',
    related: ['deposit', 'rent', 'landlord'],
    confusing: 'rent 偏租金或租住行为；lease 更偏正式合同文本。',
    examples: [
      { en: 'I need to review the lease before I sign it.', zh: '我需要在签字前先看一下租约。' },
      { en: 'The lease starts on the first of next month.', zh: '租约从下个月一号开始。' },
    ],
  },
  'value proposition': {
    term: 'value proposition',
    phonetic: '/ˈvæljuː ˌprɑːpəˈzɪʃən/',
    partOfSpeech: '名词短语 (noun phrase)',
    definitionZh: '价值主张。一个产品为什么值得用户选择、它到底解决了什么问题的核心表达。',
    scene: 'Interview',
    imageLabel: 'product strategy board showing value proposition notes',
    usage:
      '常见搭配：clear value proposition, define the value proposition。常用于战略、市场、产品定位和面试表达。',
    culture:
      '在英文商业语境里，value proposition 不是一句营销口号，而是产品对用户真正提供的独特价值。',
    related: ['USP', 'user pain point', 'market fit'],
    confusing: 'USP 更强调独特卖点；value proposition 更强调用户为什么会因此受益。',
    examples: [
      { en: 'We need a clearer value proposition before we scale this product.', zh: '在扩大这个产品之前，我们需要更清晰的价值主张。' },
      { en: 'The interview focused on how I defined the value proposition.', zh: '面试重点问了我是如何定义产品价值主张的。' },
    ],
  },
  'settle in': {
    term: 'settle in',
    phonetic: '/ˈsetl ɪn/',
    partOfSpeech: '动词短语 (verb phrase)',
    definitionZh: '安顿下来，逐渐适应新环境。',
    scene: 'Daily',
    imageLabel: 'new employee settling into a new city apartment',
    usage:
      '常见搭配：settle in quickly, still settling in。适合新城市、新办公室、搬家和社交寒暄场景。',
    culture:
      '在英语社交里，How are you settling in? 是对刚搬家、刚入职、刚到新国家的人非常自然的关心问法。',
    related: ['relocate', 'adjust', 'move-in'],
    confusing: 'adjust 更泛，强调适应；settle in 更带有“生活逐步稳定下来”的感觉。',
    examples: [
      { en: 'I am still settling in, but the neighborhood feels nice.', zh: '我还在慢慢适应，不过这个街区感觉不错。' },
      { en: 'How are you settling in after the move?', zh: '搬家之后你适应得怎么样？' },
    ],
  },
}

const fallbackReaderItems = [
  {
    id: 'speech-kickoff',
    title: 'Why Strong Kick-off Meetings Save Weeks of Rework',
    source: 'Workplace Brief',
    level: '适合母语 7-8 年级',
    minutes: '4 min',
    tag: 'Speech',
    summary: '一篇围绕项目启动会的职场读物，强调目标、范围、负责人和里程碑对后续执行的重要性。',
    articleBody: 'Many teams think the real work starts after the kick-off meeting, but experienced project managers often say the opposite. A strong kick-off can prevent weeks of confusion later. At the beginning of a project, teams need to align on the objective, define the scope, identify stakeholders, and agree on milestones. Without that shared understanding, people may work fast but in different directions. Problems usually appear later as duplicated effort, unclear ownership, or delays caused by missing dependencies. A good kick-off meeting does not have to be long, but it should be specific. Teams should leave the room knowing what success looks like, what is out of scope, and who owns the next steps. In many cases, that one hour of alignment can save an entire month of rework.',
    keyWord: 'scope',
    keyWordMeaning: '项目范围；哪些内容要做，哪些不做',
    sentence: 'Teams should leave the room knowing what success looks like, what is out of scope, and who owns the next steps.',
    sentenceZh: '团队走出会议室时，应该已经清楚成功标准、哪些内容不在范围内，以及下一步由谁负责。',
    prompt: '和我聊聊你见过的一次高效或低效的启动会，问题出在哪里？',
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
    id: 'speech-written-update',
    title: 'Why Clear Written Updates Save Time for Everyone',
    source: 'Team Communication Note',
    level: '适合母语 7-8 年级',
    minutes: '4 min',
    tag: 'Speech',
    summary: '一篇围绕书面沟通的职场短文，讨论 heads-up、in the loop 和 POC 这类表达为什么能降低协作成本。',
    articleBody: 'In fast-moving teams, people often focus on meetings and forget how much work is actually coordinated through written updates. A short message like "just a heads-up" can prevent confusion before it spreads. Phrases such as "keep everyone in the loop" or "X is the point of contact" seem small, but they clarify expectations and reduce repeated questions. Clear written communication is especially important when teams work across time zones or functions. It allows people to respond when they have time, while still preserving context. In many cases, a good update does more than share information. It shows ownership, keeps stakeholders aligned, and helps the next person act faster.',
    keyWord: 'in the loop',
    keyWordMeaning: '保持信息同步；持续知道事情最新进展',
    sentence: 'A short message like "just a heads-up" can prevent confusion before it spreads.',
    sentenceZh: '像“先提醒一下”这样的一条简短消息，往往能在混乱扩大前先把问题压住。',
    prompt: '和我聊聊你平时更喜欢口头同步还是书面同步，为什么？',
  },
  {
    id: 'travel-relocation',
    title: 'The First Month in a New City Is a Language Lesson',
    source: 'Relocation Journal',
    level: '适合母语 6-7 年级',
    minutes: '4 min',
    tag: 'Travel',
    summary: '一篇围绕搬家安家和城市适应的生活化文章，覆盖找房、通勤和社交寒暄表达。',
    articleBody: 'Moving to a new city teaches language in a very practical way. During the first month, simple daily tasks suddenly become important conversations. You may need to ask where to get a local SIM card, how long the commute takes, or whether utilities are included in the rent. Even casual questions like "How are you settling in?" can lead to meaningful conversations with new coworkers or neighbors. Many people realize that settling into a new place is not just about finding an apartment. It is also about learning the rhythm of the city, figuring out transportation, and building enough confidence to ask for help when needed.',
    keyWord: 'settle in',
    keyWordMeaning: '逐渐适应并安顿下来',
    sentence: 'Many people realize that settling into a new place is not just about finding an apartment.',
    sentenceZh: '很多人会发现，适应一个新地方并不只是找到住处那么简单。',
    prompt: '和我聊聊如果你搬到一个新城市，最先会担心什么？',
  },
  {
    id: 'news-rollout-metrics',
    title: 'Why Product Teams Watch Retention Before a Full Rollout',
    source: 'Product Data Weekly',
    level: '适合母语 8-9 年级',
    minutes: '5 min',
    tag: 'News',
    summary: '一篇科技与数据风格读物，讨论为什么产品团队在全量上线前会重点看留存和行为数据。',
    articleBody: 'When a new feature performs well in an internal demo, it can be tempting to launch it to everyone immediately. However, many product teams prefer a gradual rollout. They may first expose the feature to a small percentage of users, then monitor key metrics such as click-through rate, retention, and user behavior. A short-term spike in traffic can look exciting, but it does not always mean the feature creates long-term value. Sometimes an apparent gain turns out to be an outlier, or the numbers look strong only because the sample size is too small. Teams that move carefully usually combine metrics with user feedback before making a final decision. In other words, a full rollout is not only a technical step. It is also a decision about whether the data tells a convincing story.',
    keyWord: 'retention',
    keyWordMeaning: '留存；用户过一段时间后是否继续使用产品',
    sentence: 'A short-term spike in traffic can look exciting, but it does not always mean the feature creates long-term value.',
    sentenceZh: '短期流量激增看起来很振奋，但并不总能说明这个功能创造了长期价值。',
    prompt: '和我聊聊你更看重“快速上线”还是“先看数据再放量”，为什么？',
  },
  {
    id: 'news-strategy-market',
    title: 'Why Strategy Teams Revisit the Roadmap When the Market Changes',
    source: 'Strategy Review',
    level: '适合母语 8-9 年级',
    minutes: '5 min',
    tag: 'News',
    summary: '一篇战略与规划风格的文章，讨论市场变化、路线图调整和价值主张之间的关系。',
    articleBody: 'A product roadmap may look stable on paper, but strategy teams know it cannot stay fixed forever. When the market shifts, priorities often need to change as well. A new competitor may enter the space, user behavior may evolve, or a once-promising segment may stop growing. In those moments, strong teams step back and ask bigger questions. What is still our strategic priority? Does the product still have a clear value proposition? Are we focusing on the right audience, or just following an old plan out of habit? Revisiting the roadmap is not always a sign of failure. Sometimes it is the most disciplined way to stay aligned with long-term goals while responding to new information.',
    keyWord: 'strategic priority',
    keyWordMeaning: '战略重点；当前阶段最应集中资源推进的方向',
    sentence: 'Revisiting the roadmap is not always a sign of failure.',
    sentenceZh: '重新审视路线图并不总意味着失败。',
    prompt: '和我聊聊如果市场变化很快，团队应该更坚持原计划还是及时调整？',
  },
  {
    id: 'speech-stakeholder-update',
    title: 'Why Stakeholder Updates Work Better in Paragraphs, Not Fragments',
    source: 'Communication Review',
    level: '适合母语 7-8 年级',
    minutes: '4 min',
    tag: 'Speech',
    summary: '一篇围绕书面同步的职场文章，讨论为什么清晰分段和完整上下文能减少反复沟通。',
    articleBody: 'Many professionals believe a fast update is always a good update. However, a short message without structure often creates more questions than answers. Stakeholders usually need more than a result. They want to know what changed, why it changed, how serious the impact is, and what will happen next.\n\nThis is why strong written updates often use short paragraphs instead of a long block of text or a list of fragments. One paragraph can describe the current status, another can explain the blocker, and a third can show the next action and owner. That structure makes it easier for readers to scan, understand, and respond quickly.\n\nThe same idea applies to meeting summaries. If the recap clearly separates decisions, risks, and action items, the team is much less likely to leave with different interpretations. In other words, good formatting is not just a visual choice. It is part of effective collaboration.\n\nTeams that communicate this way often spend less time repeating background information in the next meeting. They also reduce the hidden cost of confusion, because everyone can see the same context at the same time. That is why many experienced managers care about writing quality even in informal updates.',
    keyWord: 'stakeholder',
    keyWordMeaning: '相关方；会受到项目影响、需要了解进展或参与决策的人',
    sentence: 'A short message without structure often creates more questions than answers.',
    sentenceZh: '一条没有结构的短消息，往往会制造出比解决更多的问题。',
    prompt: '和我聊聊你收到过的一次特别清晰或特别混乱的工作同步。',
  },
  {
    id: 'travel-commute-adaptation',
    title: 'How Daily Commute Choices Shape Life in a New City',
    source: 'Relocation Journal',
    level: '适合母语 6-7 年级',
    minutes: '4 min',
    tag: 'Travel',
    summary: '一篇围绕新城市通勤和生活适应的文章，适合练交通、租房与日常决策表达。',
    articleBody: 'When people move to a new city, they often focus on rent first. Yet after a few weeks, many realize that commute matters just as much as the apartment itself. A cheaper place may look attractive online, but a long and unpredictable commute can quietly reshape the entire day.\n\nA difficult commute affects energy, planning, and even social life. If the subway is crowded, the transfer is inconvenient, or traffic is unreliable, people may arrive at work already tired. They may also hesitate to stay late, join coworkers for dinner, or explore new neighborhoods after work.\n\nThat is why many newcomers gradually change the way they evaluate a city. They stop asking only how much the apartment costs and start asking how the whole routine will feel. Can they walk to a grocery store? Is there a direct subway line? Is it easy to get home after meeting friends? Those small questions often shape long-term satisfaction more than people expect.\n\nIn this sense, commuting is not only a transportation issue. It is part of settling in. The better people understand the daily rhythm of the city, the more confident and comfortable they become in their new environment.',
    keyWord: 'commute',
    keyWordMeaning: '通勤；上下班往返的日常交通安排',
    sentence: 'A long and unpredictable commute can quietly reshape the entire day.',
    sentenceZh: '一次漫长且不可预测的通勤，会在不知不觉中改变整天的状态。',
    prompt: '和我聊聊你选择住处时，会不会把通勤放在很重要的位置。',
  },
  {
    id: 'news-experiment-review',
    title: 'Why Good Teams Question Early Wins in Product Experiments',
    source: 'Data Product Brief',
    level: '适合母语 8-9 年级',
    minutes: '5 min',
    tag: 'News',
    summary: '一篇数据分析风格的文章，讨论为什么实验初期的漂亮数据不一定代表真正成功。',
    articleBody: 'A successful experiment can create excitement very quickly. When a new feature shows a higher click-through rate or a sudden spike in engagement, teams naturally want to move faster. But experienced product and data leaders often respond with a different question: what is the story behind these numbers?\n\nEarly gains do not always hold. A result may come from a small sample, an unusual traffic source, or a short-term novelty effect. Some users click because something is new, not because it creates lasting value. That is why good teams rarely treat one positive chart as the final answer.\n\nInstead, they compare the result with retention, repeat behavior, and qualitative feedback. They ask whether the effect appears across different segments, whether the metric is statistically meaningful, and whether the gain creates trade-offs elsewhere in the product. A feature that increases clicks but reduces trust or clarity may not be a real win.\n\nThis more disciplined approach can feel slower in the short term, but it usually leads to better decisions. In many product organizations, the real advantage is not speed alone. It is the ability to tell the difference between a promising signal and a misleading one before a full rollout.',
    keyWord: 'outlier',
    keyWordMeaning: '异常值；与整体趋势明显不同的数据点',
    sentence: 'Good teams rarely treat one positive chart as the final answer.',
    sentenceZh: '优秀的团队很少会把一张漂亮的正向图表当作最终答案。',
    prompt: '和我聊聊如果一个新功能的数据很好看，你会先立刻放量还是先继续验证。',
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
    const scene = scenes[index % scenes.length] || sceneCycle[index % sceneCycle.length]
    const pool = baseItems.filter((item) => item.scene === scene)
    const source = (pool.length > 0 ? pool : baseItems)[index % (pool.length > 0 ? pool.length : baseItems.length)]
    return {
      ...source,
      id: `${source.term}-${scene.toLowerCase()}-${index}`,
      scene,
    }
  })
}

function buildReaderFallback() {
  return ensureReaderCoverage(fallbackReaderItems)
}

function buildSceneContentHint(scenes = []) {
  const normalized = Array.isArray(scenes) ? scenes : []
  const hints = []

  if (normalized.includes('Meeting')) {
    hints.push('优先使用会议与沟通素材，如 agenda, sync, follow-up, action items, give opinions, wrap-up。')
  }
  if (normalized.includes('Work')) {
    hints.push('优先使用项目与执行素材，如 scope, milestone, stakeholder, blocker, progress update, cross-team collaboration。')
  }
  if (normalized.includes('Daily')) {
    hints.push('Daily 场景优先使用日常生活与安家素材，如社交寒暄、交通问路、住房安家、健康就医、餐厅点餐；也可以适度加入科技与数据、产品与用户体验中的高频通用表达。')
  }
  if (normalized.includes('Travel')) {
    hints.push('Travel 场景优先使用交通问路、行程调整、通勤、餐厅点餐、临时求助等真实出行表达。')
  }
  if (normalized.includes('Interview')) {
    hints.push('Interview 场景可借用项目经历、跨团队协作、问题解决、数据分析成果、战略思考与优先级判断等表达。')
  }
  if (normalized.includes('Work')) {
    hints.push('Work 场景也可以吸收通用商务表达，如 heads-up, in the loop, POC, bandwidth, gentle reminder。')
  }

  return hints.join('\n')
}

function buildVocabularySceneProfiles(scenes = []) {
  const normalized = Array.isArray(scenes) ? scenes : []

  return normalized.map((scene) => {
    if (scene === 'Daily') {
      return 'Daily: 优先生成社交寒暄、安家、交通、就医、点餐、轻量日常求助中高频出现的词，如 settle in, commute, lease, reservation, allergic to, checkup。'
    }
    if (scene === 'Work') {
      return 'Work: 优先生成项目启动、排期、风险、依赖、交付、跨团队协作，以及书面沟通和请求表达相关词，如 milestone, stakeholder, blocker, rollout, bandwidth, POC。'
    }
    if (scene === 'Meeting') {
      return 'Meeting: 优先生成会议议程、表达观点、主持讨论、对齐结论、待办总结，以及提醒同步类表达，如 agenda, sync, heads-up, wrap-up, action items, follow-up。'
    }
    if (scene === 'Interview') {
      return 'Interview: 优先生成面试中常用于讲项目经历、成果指标、问题解决、职责归属、战略判断与取舍的表达，如 ownership, impact, metrics, root cause, trade-off, value proposition。'
    }
    if (scene === 'Travel') {
      return 'Travel: 优先生成行程变更、交通、预订、时间安排、点餐和现场沟通相关词，如 itinerary, reservation, commute, delayed, transit card, check-in。'
    }
    return `${scene}: use realistic expressions that fit this scene.`
  }).join('\n')
}

function buildReaderCategoryHint(scenes = []) {
  const normalized = Array.isArray(scenes) ? scenes : []

  return normalized.map((scene) => {
    if (scene === 'Speech') {
      return 'Speech: 生成更适合读后开口讨论的内容，优先围绕会议沟通、项目同步、表达观点、总结结论、行动项推进，以及书面沟通和商务请求表达，文章口吻可以更像 workplace brief / discussion digest。'
    }
    if (scene === 'News') {
      return 'News: 生成科技、产品、数据、增长、灰度发布、用户反馈、团队效率工具，以及战略规划、市场竞争、路线图调整等真实新闻或分析风格内容。'
    }
    if (scene === 'Travel') {
      return 'Travel: 生成真实旅行经历、延误变化、行程调整、城市适应、住房安家、交通住宿等内容，不要写成幼稚故事。'
    }
    return `${scene}: generate realistic reading material for this category.`
  }).join('\n')
}

function buildTalkModeHint(mode = 'Free Talk') {
  if (mode === 'Work') {
    return 'Prefer project kick-off, progress updates, blockers, delivery, ownership, dependencies, cross-team collaboration, written updates, requests, and polite follow-ups from the content reference.'
  }
  if (mode === 'Meeting') {
    return 'Prefer agenda setting, alignment, discussion facilitation, giving opinions, wrap-up, action items, follow-ups, staying on topic, and concise business reminders from the content reference.'
  }
  if (mode === 'Interview') {
    return 'Prefer answers about ownership, project goals, stakeholder alignment, blockers, metrics, impact, root cause, lessons learned, trade-offs, strategic priorities, and value proposition.'
  }
  if (mode === 'Travel') {
    return 'Prefer practical travel planning, relocation, commuting, housing, restaurant, and doctor-visit talk, but keep the style natural and grounded.'
  }
  return 'Prefer realistic daily life, workplace, project, meeting, tech, product, data, and relocation topics from the content reference when helpful, and gently steer the learner into expressing opinions or explaining decisions.'
}

function estimateReaderMinutes(articleBody = '') {
  const wordCount = articleBody.trim().split(/\s+/).filter(Boolean).length

  if (wordCount >= 720) {
    return '5 min'
  }
  if (wordCount >= 540) {
    return '4 min'
  }
  return '3 min'
}

function normalizeReaderArticleBody(articleBody = '', fallbackBody = '') {
  const safeBody = typeof articleBody === 'string' && articleBody.trim() ? articleBody.trim() : fallbackBody

  if (!safeBody) {
    return fallbackBody
  }

  const explicitParagraphs = safeBody
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  if (explicitParagraphs.length > 1) {
    return explicitParagraphs.join('\n\n')
  }

  const sentences = safeBody.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((item) => item.trim()).filter(Boolean) ?? [safeBody]
  const chunkSize = sentences.length >= 16 ? 4 : 3
  const paragraphs = []

  for (let index = 0; index < sentences.length; index += chunkSize) {
    paragraphs.push(sentences.slice(index, index + chunkSize).join(' '))
  }

  return paragraphs.join('\n\n')
}

function normalizeReaderItem(rawItem = {}, index = 0) {
  const safeTag = ['Speech', 'Travel', 'News'].includes(rawItem.tag) ? rawItem.tag : fallbackReaderItems[index % fallbackReaderItems.length]?.tag || 'News'
  const fallback = fallbackReaderItems.find((item) => item.tag === safeTag) ?? fallbackReaderItems[index % fallbackReaderItems.length]
  const articleBody = normalizeReaderArticleBody(rawItem.articleBody, fallback.articleBody)

  return {
    ...fallback,
    ...rawItem,
    id: typeof rawItem.id === 'string' && rawItem.id.trim() ? rawItem.id : `${safeTag.toLowerCase()}-${index}`,
    tag: safeTag,
    title: typeof rawItem.title === 'string' && rawItem.title.trim() ? rawItem.title : fallback.title,
    source: typeof rawItem.source === 'string' && rawItem.source.trim() ? rawItem.source : fallback.source,
    level: typeof rawItem.level === 'string' && rawItem.level.trim() ? rawItem.level : fallback.level,
    minutes: typeof rawItem.minutes === 'string' && rawItem.minutes.trim()
      ? rawItem.minutes
      : estimateReaderMinutes(articleBody),
    summary: typeof rawItem.summary === 'string' && rawItem.summary.trim() ? rawItem.summary : fallback.summary,
    articleBody,
    keyWord: typeof rawItem.keyWord === 'string' && rawItem.keyWord.trim() ? rawItem.keyWord : fallback.keyWord,
    keyWordMeaning: typeof rawItem.keyWordMeaning === 'string' && rawItem.keyWordMeaning.trim() ? rawItem.keyWordMeaning : fallback.keyWordMeaning,
    sentence: typeof rawItem.sentence === 'string' && rawItem.sentence.trim() ? rawItem.sentence : fallback.sentence,
    sentenceZh: typeof rawItem.sentenceZh === 'string' && rawItem.sentenceZh.trim() ? rawItem.sentenceZh : fallback.sentenceZh,
    prompt: typeof rawItem.prompt === 'string' && rawItem.prompt.trim() ? rawItem.prompt : fallback.prompt,
  }
}

function ensureReaderCoverage(items = []) {
  const normalized = Array.isArray(items)
    ? items.map((item, index) => normalizeReaderItem(item, index))
    : []
  const contentTags = ['Speech', 'Travel', 'News']
  const supplements = contentTags.flatMap((tag) => {
    const currentItems = normalized.filter((item) => item.tag === tag)
    const neededCount = Math.max(0, 3 - currentItems.length)
    const fallbackPool = fallbackReaderItems.filter((item) => item.tag === tag)

    return fallbackPool.slice(0, neededCount).map((fallback, index) => ({
      ...normalizeReaderItem(fallback, index),
      id: `${fallback.id}-${tag.toLowerCase()}-fallback-${index}`,
    }))
  })

  return [...normalized, ...supplements]
}

function normalizeExamples(examples = []) {
  if (!Array.isArray(examples) || examples.length === 0) {
    return [
      { en: 'This word appears in a natural English sentence.', zh: '这个词已经放进了一个自然的英语句子里。' },
      { en: 'Try using it again in your own context.', zh: '你也可以把它换到自己的场景里再练一次。' },
    ]
  }

  return examples
    .filter((item) => item && typeof item.en === 'string' && typeof item.zh === 'string')
    .slice(0, 2)
}

function extractRelatedTerms(text = '', term = '') {
  if (typeof text !== 'string') {
    return []
  }

  const current = term.trim().toLowerCase()
  const matches = text.match(/[A-Za-z][A-Za-z-]*/g) ?? []

  return Array.from(
    new Set(
      matches
        .map((item) => item.trim())
        .filter((item) => item.length > 2 && item.toLowerCase() !== current),
    ),
  ).slice(0, 3)
}

function normalizeVocabularyItem(rawItem = {}, fallbackTerm = 'word') {
  const safeTerm =
    typeof rawItem.term === 'string' && rawItem.term.trim() ? rawItem.term.trim() : fallbackTerm
  const relatedFromPayload = Array.isArray(rawItem.related)
    ? rawItem.related.filter((item) => typeof item === 'string' && item.trim())
    : []
  const related = relatedFromPayload.length > 0
    ? Array.from(new Set(relatedFromPayload)).slice(0, 3)
    : extractRelatedTerms(rawItem.confusing, safeTerm)

  return {
    ...rawItem,
    term: safeTerm,
    phonetic: typeof rawItem.phonetic === 'string' ? rawItem.phonetic : '',
    partOfSpeech: typeof rawItem.partOfSpeech === 'string' && rawItem.partOfSpeech.trim()
      ? rawItem.partOfSpeech
      : '词性 (part of speech)',
    definitionZh: typeof rawItem.definitionZh === 'string' && rawItem.definitionZh.trim()
      ? rawItem.definitionZh
      : '暂未生成释义。',
    scene: typeof rawItem.scene === 'string' && rawItem.scene.trim() ? rawItem.scene : 'Daily',
    imageLabel: typeof rawItem.imageLabel === 'string' && rawItem.imageLabel.trim()
      ? rawItem.imageLabel
      : `${safeTerm}, simple flat illustration`,
    usage: typeof rawItem.usage === 'string' && rawItem.usage.trim()
      ? rawItem.usage
      : '正在补充这个词的常见搭配和使用场景。',
    culture: typeof rawItem.culture === 'string' ? rawItem.culture : '',
    related,
    confusing: typeof rawItem.confusing === 'string' ? rawItem.confusing : '',
    examples: normalizeExamples(rawItem.examples),
  }
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
          content: withContentReference(`你是一个专业的英语母语外教。请解释单词/短语 "${query}"。
要求：
1. 语言自然、生动有趣，避免教条化。
1.1 优先使用已经出现在素材库中的日常生活、通用商务、战略规划、职场、会议、项目、科技、数据、产品体验相关高频表达；如果用户输入本身就在素材库语境中，尽量沿用该语境来解释。
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
}`),
        },
        {
          role: 'user',
          content:
            mode === 'describe'
              ? `用户会用中文描述想表达的意思，请帮他找最合适的英文词或短语，并按要求输出词卡 JSON。优先匹配素材库中已有的真实表达，尤其是日常生活、搬家安家、通用商务、会议沟通、项目执行、科技数据、产品体验、战略规划场景。描述：${query}`
              : `请围绕英文词或短语 ${query} 生成一张中文解释的英语学习词卡 JSON。如果这个表达能落到日常生活、搬家安家、通用商务、会议沟通、项目执行、科技数据、产品体验或战略规划等真实场景，请优先沿用这些场景。`,
        },
      ],
      { type: 'json_object' },
    )

    const content = completion.choices?.[0]?.message?.content
    const parsed = JSON.parse(content)
    res.json({ source: 'deepseek', item: normalizeVocabularyItem(parsed, query.trim()) })
  } catch (error) {
    res.json({
      source: 'mock',
      degraded: true,
      item: normalizeVocabularyItem(buildDictionaryFallback(query, mode), query.trim()),
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
          content: withContentReference(`你是英语学习产品的每日词汇推荐引擎。请严格输出 JSON，顶层字段为 items。items 是长度为 5 的数组。
要求：
1. 语言自然、生动有趣。
1.1 今日词汇优先从素材库里已经出现过或明显贴近素材库风格的表达中挑选，覆盖日常生活、搬家安家、通用商务、会议、项目、科技、数据、产品体验、战略规划语境。
1.2 不同 scene 的词必须有明显差异，不要只是把同一批词换一个标签。
2. definitionZh 是该词汇在具体语境下的中文自然解释。
3. partOfSpeech 必须是"中文 (英文)"格式，如"名词 (noun)", "动词 (verb)"。
4. imageLabel 是用于给AI绘画模型生成插图的英文提示词，必须是简短、具象的视觉描述（例如 "a calendar with events listed"）。
5. usage 是对用法的详细说明，必须介绍该词语作为此词性时的搭配习惯、常见短语、适用场景和注意事项。绝对不要仅仅返回一个例句，必须是一段中文为主的说明性文字。
6. related 里的词尽量也来自同一语义场，便于继续点开扩展。
7. 每个 item 包含: term, phonetic, partOfSpeech, definitionZh, scene, imageLabel, usage, culture, related, confusing, examples(包含 en 和 zh 的2个例句数组)。`),
        },
        {
          role: 'user',
          content: `请为当前用户生成今日新增 5 个英语词汇卡，用户水平：${level}。优先覆盖这些场景：${scenes.join('、')}。解释语言是简体中文，风格自然，不要教科书腔。\n${buildSceneContentHint(scenes)}\n${buildVocabularySceneProfiles(scenes)}`,
        },
      ],
      { type: 'json_object' },
    )

    const content = completion.choices?.[0]?.message?.content
    const parsed = JSON.parse(content)
    res.json({
      source: 'deepseek',
      items: Array.isArray(parsed.items)
        ? parsed.items.map((item, index) =>
            normalizeVocabularyItem(item, `word-${index + 1}`),
          )
        : buildDailyWordsFallback(scenes),
    })
  } catch (error) {
    res.json({
      source: 'mock',
      degraded: true,
      items: buildDailyWordsFallback(scenes).map((item) => normalizeVocabularyItem(item, item.term)),
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
          content: withContentReference(
            '你是英语学习产品的 Reader 内容编辑。请严格输出 JSON，顶层字段为 items。items 必须是 9 到 12 篇文章的数组，并且 Speech、Travel、News 每个 tag 至少 3 篇。\n要求：\n1. 内容必须是非常贴近真实世界的近期新闻、科技前沿、职场趋势或真实生活方式文章（可以基于你所知的真实世界知识生成高度逼真的新闻或文章节选）。\n2. 绝对不要使用像 "Lily plans a trip" 这种小学生课本式的幼稚内容。\n3. 优先借鉴素材库中已经导入的日常生活、通用商务、会议沟通、项目执行、科技数据、产品体验、战略规划表达，让文章更像真实办公室、产品团队、项目协作环境或真实城市生活环境中的内容。\n4. 不同 tag 的内容画像必须明显不同：Speech 偏可讨论的职场表达与会议/项目沟通，News 偏科技产品数据与趋势或战略分析，Travel 偏真实旅行体验、搬家安家和变化处理。\n5. 如果用户场景包含 Work 或 Meeting，请优先生成项目启动、进度同步、风险升级、跨团队协作、产品评审、数据分析、灰度发布、复盘总结相关内容。\n6. 每篇 articleBody 必须是英文正文，长度控制在大约 450 到 750 个英文单词，对应 3 到 5 分钟阅读时间；正文必须分成 4 到 6 个自然段，并用空行分隔段落。\n7. summary 是中文摘要；minutes 只能写 3 min、4 min 或 5 min。\n8. 每个 item 包含: id, title, source(如 BBC News, TechCrunch), level, minutes, tag(如 Speech, Travel, News), summary(中文摘要), articleBody(英文正文), keyWord, keyWordMeaning, sentence, sentenceZh, prompt(用于口语讨论的引导词)。',
          ),
        },
        {
          role: 'user',
          content: `请生成适合 ${level} 的高质量、真实的英语阅读素材，优先覆盖这些领域：${scenes.join('、')}。内容解释语言用中文，标题和句子保持英文。\n${buildSceneContentHint(scenes)}\n${buildReaderCategoryHint(scenes)}`,
        },
      ],
      { type: 'json_object' },
    )

    const content = completion.choices?.[0]?.message?.content
    const parsed = JSON.parse(content)
    res.json({
      source: 'deepseek',
      items: ensureReaderCoverage(parsed.items),
    })
  } catch (error) {
    res.json({
      source: 'mock',
      degraded: true,
      items: ensureReaderCoverage(buildReaderFallback()),
      error: error instanceof Error ? error.message : 'unknown_error',
    })
  }
})

app.post('/api/assessment/plan', async (_req, res) => {
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
      question: 'What is the main problem the speaker is describing?',
      options: ['A delayed project report', 'A restaurant reservation', 'A train cancellation', 'A medical appointment'],
      answer: 'A delayed project report',
    },
    {
      id: 'r1',
      type: 'reading',
      content: 'FYI, the roadmap review has been moved to next Tuesday. Please see the doc linked below and let me know what you think. Alex is the point of contact for collecting feedback, and we need to lock the Q1 plan by Friday.',
      question: 'What should the reader do first?',
      options: ['Share feedback on the linked document', 'Book a restaurant for Friday', 'Contact HR about leave', 'Cancel the Q1 plan'],
      answer: 'Share feedback on the linked document',
    },
    {
      id: 's1',
      type: 'speaking',
      prompt: '请用英文回答：你正在做一个项目周会同步，需要向经理说明当前进度、一个 blocker，以及你的下一步计划。你会怎么说？',
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
          content: withContentReference(
            `你是英语学习测评系统的出题专家。请严格输出 JSON。顶层必须有 questions 字段（数组）。你需要生成 ${plan.listening + plan.reading + plan.speaking} 道题：${plan.listening} 道听力(listening)，${plan.reading} 道阅读(reading)，${plan.speaking} 道口语(speaking)。\n听力题(listening)：content 必须是一段生活场景、职场场景或多人对话中的自然英文材料。绝对不要包含 'Man:', 'Woman:', 'A:', 'B:' 等角色提示词，以免 TTS 机器朗读时读出这些标签，直接写出人物说的话即可。question 是基于内容的问题，options 是4个选项数组(全英文)，answer 是正确选项的文本。请参考素材库里的 CAE 风格特点，适当考察态度、观点、意图、隐含含义，而不只是事实回忆。题材优先从会议沟通、项目启动、进度同步、问题升级、产品评审、数据分析、技术决策、灰度发布、日常搬家安家、交通问路、餐厅点餐等真实场景中选。\n阅读题(reading)：content 是邮件/短文/通知(全英文)，question 是基于内容的问题，options 是4个选项数组(全英文)，answer 是正确选项的文本。题材优先选择真实办公、通用商务、战略规划和科技产品语境。\n口语题(speaking)：prompt 是一段情景设定的中文描述，要求用户用英文回答。优先让用户解释项目目标、同步进度、表达观点、分析问题、说明数据结论、提出解决方案，或处理搬家安家/问路/点餐等真实日常任务。不需要 options 和 answer。\n题目难度要有梯度（包含简单、中等、困难），选项要具有迷惑性，以真实测试用户的水平。`,
          ),
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
      reply: transcript.startsWith('[System:')
        ? `Let's discuss this topic. What are your thoughts?`
        : `I heard you say: "${transcript}". Let's keep going in ${mode} mode. ${context ? `We can also stay around this topic: ${context}.` : ''}`,
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
          content: withContentReference(
            'You are Talk With Me. Speak in natural standard American English, keep the conversation friendly, and only give light correction when a mistake strongly affects clarity. Prefer realistic workplace, project, meeting, product, tech, and data topics from the content reference whenever they fit the current mode. The mode should materially change the conversation focus: Work should sound like project execution, Meeting should sound like live meeting interaction, Interview should sound like structured experience sharing, Travel should sound like practical travel communication, and Free Talk can mix realistic modern life and work topics. Reuse authentic phrases naturally, but never sound like a textbook list and never mention the source documents. Reply in JSON with keys reply and correction. correction can be null.',
          ),
        },
        {
          role: 'user',
          content: JSON.stringify({
            mode,
            context,
            transcript,
            history: messages,
            modeHint: buildTalkModeHint(mode),
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
      reply: transcript.startsWith('[System:')
        ? `Let's discuss this topic. Tell me more.`
        : `I heard you say: "${transcript}". Tell me a little more about that.`,
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
