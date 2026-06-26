import { useState, useCallback, useEffect, useRef } from 'react'
import { initialState, applyAnswer, undoLast, type QuizState } from './lib/taste/state'
import { pickNextQuestion, shouldStop, MIN_QUESTIONS, MAX_QUESTIONS } from './lib/taste/adaptiveSelector'
import { assembleResult, type AssembledResult } from './lib/taste/result'
import { downloadShareCard, preloadShareCardFonts } from './utils/shareImage'
import { loadRecentAskedIds, recordSession } from './utils/sessionMemory'
import { ResultCard } from './components/ResultCard'
import { RandomDish } from './components/RandomDish'
import type { QuizQuestion, DietaryRestriction } from './lib/taste/types'
import './styles/App.css'

type Phase = 'intro' | 'dietary' | 'quiz' | 'calculating' | 'result' | 'random-dish'

interface RuntimeQuestion {
  q: QuizQuestion
  rerolled: boolean
}

const DIETARY_OPTIONS: { key: DietaryRestriction; emoji: string; label: string }[] = [
  { key: 'halal', emoji: '☪️', label: '清真' },
  { key: 'no-pork', emoji: '🚫', label: '不吃猪肉' },
  { key: 'no-beef', emoji: '🚫', label: '不吃牛肉' },
  { key: 'no-lamb', emoji: '🚫', label: '不吃羊肉' },
  { key: 'no-chicken', emoji: '🚫', label: '不吃禽肉' },
  { key: 'no-seafood', emoji: '🚫', label: '不吃鱼鲜' },
  { key: 'no-egg', emoji: '🚫', label: '不吃蛋' },
  { key: 'no-offal', emoji: '🚫', label: '不吃内脏' },
  { key: 'vegetarian', emoji: '🥬', label: '素食' },
]

function App() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [state, setState] = useState<QuizState>(initialState)
  const [currentQuestion, setCurrentQuestion] = useState<RuntimeQuestion | null>(null)
  const [askedQuestions, setAskedQuestions] = useState<RuntimeQuestion[]>([])
  const [result, setResult] = useState<AssembledResult | null>(null)
  const [hoveredOption, setHoveredOption] = useState<number | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 1000000))
  const [copyToast, setCopyToast] = useState(false)
  const [dietary, setDietary] = useState<DietaryRestriction[]>([])
  const [noRestriction, setNoRestriction] = useState(false)
  // P9 跨 session 记忆:本轮启动时读一次最近几轮出过的题 id,传给 pickNextQuestion 施轻惩罚。
  // 用 ref 而非 state——它不参与渲染,且两处回调都要稳定读到同一份。
  const recentSessionIds = useRef<Set<string>>(new Set(loadRecentAskedIds()))

  // P7.2 顶层预加载分享卡字体,确保 result 阶段字体已就绪
  useEffect(() => {
    preloadShareCardFonts()
  }, [])

  const startQuiz = useCallback((diet: DietaryRestriction[]) => {
    setDietary(diet)
    const newSeed = Math.floor(Math.random() * 1000000)
    setSeed(newSeed)
    // P9:每轮重新读取跨 session 记忆(上一轮刚 recordSession 写入的会进来)
    recentSessionIds.current = new Set(loadRecentAskedIds())
    setPhase('quiz')
    setState(initialState())
    setCurrentQuestion(null)
    setAskedQuestions([])
    setResult(null)
    setShowConfetti(false)
    setIsTransitioning(false)
  }, [])

  // 启动 quiz 后立即出第一题;答完后再用 useEffect 触发下一题
  useEffect(() => {
    if (phase !== 'quiz') return
    if (currentQuestion !== null) return
    const q = pickNextQuestion(
      { askedIds: state.askedIds, answers: state.answers, profile: state.profile },
      seed,
      recentSessionIds.current,
    )
    if (q) setCurrentQuestion({ q, rerolled: false })
  }, [phase, currentQuestion, state, seed])

  const answerQuestion = useCallback((optionIndex: number) => {
    if (isTransitioning || !currentQuestion) return
    setIsTransitioning(true)

    const opt = currentQuestion.q.options[optionIndex]
    if (!opt) return
    const newState = applyAnswer(state, currentQuestion.q.id, opt.id)
    setState(newState)
    const newAsked = [...askedQuestions, currentQuestion]
    setAskedQuestions(newAsked)

    setTimeout(() => {
      const stop = shouldStop({
        askedIds: newState.askedIds,
        answers: newState.answers,
        profile: newState.profile,
      })
      if (!stop) {
        const nextQ = pickNextQuestion(
          { askedIds: newState.askedIds, answers: newState.answers, profile: newState.profile },
          seed,
          recentSessionIds.current,
        )
        if (nextQ) {
          setCurrentQuestion({ q: nextQ, rerolled: true })
          setIsTransitioning(false)
          return
        }
      }
      setPhase('calculating')
      // P9:quiz 完成,把本轮 askedIds 写入跨 session 记忆(下一轮启动时读出施轻惩罚)
      recordSession(newState.askedIds)
      setTimeout(() => {
        // 每次进入 result 都用独立 seed,让推荐菜锚点随机化(同画像每次推不同)
        const assembled = assembleResult(newState.profile, { seed: Math.floor(Math.random() * 1_000_000), dietary })
        setResult(assembled)
        setShowConfetti(true)
        setPhase('result')
        setIsTransitioning(false)
      }, 1500)
    }, 400)
  }, [isTransitioning, currentQuestion, state, askedQuestions, seed, dietary])

  const goToPreviousQuestion = useCallback(() => {
    if (isTransitioning) return
    if (askedQuestions.length === 0) return // 没有已答的题 → 没有上一题
    // askedQuestions 存「已答题」，currentQuestion 是「当前待答题」，
    // 所以「上一题」= askedQuestions 的最后一题（不是 slice 去尾后的最后一题，那样会跳过上一题）
    const prev = askedQuestions[askedQuestions.length - 1]!
    setState(undoLast(state))
    setAskedQuestions(askedQuestions.slice(0, -1))
    setCurrentQuestion({ q: prev.q, rerolled: false })
  }, [isTransitioning, state, askedQuestions])

  const restartQuiz = useCallback(() => {
    setPhase('intro')
    setState(initialState())
    setCurrentQuestion(null)
    setAskedQuestions([])
    setResult(null)
    setShowConfetti(false)
    setIsTransitioning(false)
  }, [])

  const goRandomDish = useCallback(() => setPhase('random-dish'), [])

  const handleCopy = useCallback(async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
      }
    } catch {
      // ignore
    }
    setCopyToast(true)
    setTimeout(() => setCopyToast(false), 2000)
  }, [])

  const handleDownload = useCallback(() => {
    if (!result) return
    const top = result.allIntervals[0]
    const tag = top ? top.tierLabel : '味觉灵魂'
    downloadShareCard({ result, questionCount: askedQuestions.length }, `味觉灵魂_${tag}.png`)
    setCopyToast(true)
    setTimeout(() => setCopyToast(false), 2000)
  }, [result, askedQuestions.length])

  // ============ INTRO SCREEN ============
  if (phase === 'intro') {
    return (
      <div className="app intro-screen">
        <div className="floating-emojis">
          {['🌶️', '🍜', '🥟', '🍣', '🍝', '🌮', '🥘', '🍰', '🍛', '🍲', '🥩', '🧆'].map((emoji, i) => (
            <span key={i} className="floating-emoji" style={{
              '--delay': `${i * 0.3}s`,
              '--x': `${Math.cos(i * 0.6) * 80}px`,
              '--y': `${Math.sin(i * 0.6) * 60}px`,
            } as React.CSSProperties}>
              {emoji}
            </span>
          ))}
        </div>
        <div className="intro-content">
          <div className="intro-emoji">
            <span className="emoji-main">🍽️</span>
          </div>
          <h1 className="intro-title">
            你的<span className="highlight">味觉灵魂</span>是什么？
          </h1>
          <p className="intro-subtitle">
            趣味测试题，揭开你对美食的深层偏好
          </p>
          <div className="intro-features">
            <div className="feature">
              <span className="feature-emoji">🌍</span>
              <span>8 维味觉图谱</span>
            </div>
            <div className="feature">
              <span className="feature-emoji">🧠</span>
              <span>自适应追问</span>
            </div>
            <div className="feature">
              <span className="feature-emoji">🎭</span>
              <span>味觉性格分析</span>
            </div>
            <div className="feature">
              <span className="feature-emoji">🖼️</span>
              <span>一键生成分享卡</span>
            </div>
          </div>
          <button className="start-btn" onClick={() => setPhase('dietary')}>
            <span>开始勘察</span>
            <span className="btn-arrow">→</span>
          </button>
          <button className="random-entry-btn" onClick={goRandomDish}>
            吃什么啊？
          </button>
          <p className="intro-note">题目随你的选择动态变化 · 一题接一题，越答越懂你</p>
        </div>
      </div>
    )
  }

  // ============ DIETARY SCREEN ============
  if (phase === 'dietary') {
    const toggleDietary = (key: DietaryRestriction) => {
      setDietary((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
      setNoRestriction(false)
    }
    const canStart = dietary.length > 0 || noRestriction
    return (
      <div className="app dietary-screen">
        <div className="dietary-content">
          <div className="dietary-emoji">🍽️</div>
          <h2 className="dietary-title">先说说你的忌口</h2>
          <p className="dietary-subtitle">选了之后，推荐菜会自动避开（可多选）</p>
          <div className="dietary-chips">
            {DIETARY_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`dietary-chip ${dietary.includes(opt.key) ? 'selected' : ''}`}
                onClick={() => toggleDietary(opt.key)}
              >
                <span className="chip-emoji">{opt.emoji}</span>
                <span className="chip-label">{opt.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`dietary-none ${noRestriction ? 'selected' : ''}`}
            onClick={() => { setNoRestriction(true); setDietary([]) }}
          >
            😋 无忌口，都能吃
          </button>
          <div className="dietary-actions">
            <button type="button" className="action-btn secondary" onClick={() => setPhase('intro')}>
              ← 返回
            </button>
            <button
              type="button"
              className="start-btn"
              disabled={!canStart}
              onClick={() => startQuiz(noRestriction ? [] : dietary)}
            >
              <span>开始答题</span>
              <span className="btn-arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============ CALCULATING SCREEN ============
  if (phase === 'calculating') {
    return (
      <div className="app calculating-screen">
        <div className="calculating-content">
          <div className="spinner">
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
          </div>
          <p className="calculating-text">正在分析你的味觉密码...</p>
          <p className="calculating-subtext">
            {['品味你的偏好...', '探索味觉地图...', '寻找你的菜系灵魂...', '即将揭晓...', '🍽️'][Math.floor(Math.random() * 5)]}
          </p>
          <p className="calculating-mode">自适应 {MIN_QUESTIONS} 题 · 矛盾追问至 {MAX_QUESTIONS}</p>
        </div>
      </div>
    )
  }

  // ============ RESULT SCREEN ============
  if (phase === 'result' && result) {
    return (
      <>
        {showConfetti && <Confetti />}
        <ResultCard
          result={result}
          questionCount={askedQuestions.length}
          onRestart={restartQuiz}
          onCopy={handleCopy}
          onDownload={handleDownload}
        />
        {copyToast && (
          <div className="copy-toast">✨ 文案已复制到剪贴板</div>
        )}
      </>
    )
  }

  // ============ RANDOM DISH SCREEN ============
  if (phase === 'random-dish') {
    return <RandomDish onBack={() => setPhase('intro')} />
  }

  // ============ QUIZ SCREEN ============
  if (!currentQuestion) {
    return null
  }
  const q = currentQuestion.q
  const priorAnswer = state.currentIndex < state.answers.length
    ? state.answers[state.currentIndex]
    : null
  const selectedOptionIndex = priorAnswer && priorAnswer.questionId === q.id
    ? q.options.findIndex((o) => o.id === priorAnswer.optionId)
    : -1
  const optionLabels = ['A', 'B', 'C', 'D']

  return (
    <div className="app quiz-screen">
      <div className="quiz-header">
        <div className="quiz-progress">
          {state.currentIndex > 0 && (
            <button
              type="button"
              className="prev-btn"
              onClick={goToPreviousQuestion}
              aria-label="上一题"
            >
              ← 上一题
            </button>
          )}
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.min(askedQuestions.length, MIN_QUESTIONS) / MAX_QUESTIONS * 100}%` }} />
            {askedQuestions.length > MIN_QUESTIONS && (
              <div className="progress-fill-extra" style={{ left: `${MIN_QUESTIONS / MAX_QUESTIONS * 100}%`, width: `${(askedQuestions.length - MIN_QUESTIONS) / MAX_QUESTIONS * 100}%` }} />
            )}
          </div>
          <span className="progress-text">
            {askedQuestions.length >= MIN_QUESTIONS
              ? <>第 {askedQuestions.length + 1} 题 <span className="progress-pursue">· 追问</span></>
              : <>第 {askedQuestions.length + 1} 题 / {MIN_QUESTIONS}</>}
          </span>
        </div>
      </div>

      <div className={`question-card ${isTransitioning ? 'fade-out' : 'fade-in'}`}>
        <div className="question-number">第 {askedQuestions.length + 1} 题</div>
        <h2 className="question-text">{q.stem}</h2>

        <div className="options">
          {q.options.map((option, index) => (
            <button
              key={index}
              className={`option-btn ${hoveredOption === index ? 'hovered' : ''} ${selectedOptionIndex === index ? 'selected' : ''}`}
              onClick={() => answerQuestion(index)}
              onMouseEnter={() => setHoveredOption(index)}
              onMouseLeave={() => setHoveredOption(null)}
              style={{
                '--option-index': index,
                '--hover-scale': hoveredOption === index ? '1.03' : '1',
              } as React.CSSProperties}
            >
              <span className="option-label">{optionLabels[index]}</span>
              <span className="option-text">{option.label}</span>
              {selectedOptionIndex === index && <span className="option-check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Confetti() {
  const pieces = Array.from({ length: 30 }, (_, i) => ({
    left: `${(i * 37 + 13) % 100}%`,
    delay: `${(i * 0.08) % 1.5}s`,
    duration: `${1.5 + (i % 3) * 0.5}s`,
    color: ['#ff6b6b', '#ffa07a', '#f39c12', '#2ecc71', '#3498db', '#9b59b6', '#e91e63', '#1abc9c'][i % 8],
    size: 6 + (i % 4) * 2,
  }))

  return (
    <div className="confetti-container">
      {pieces.map((p, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
          }}
        />
      ))}
    </div>
  )
}

export default App
