import { useState, useCallback, useEffect } from 'react'
import { type Cuisine } from './data/cuisines'
import { initialState, applyAnswer, undoLast, type QuizState } from './lib/taste/state'
import { pickNextQuestion, MIN_QUESTIONS, MAX_QUESTIONS } from './lib/taste/adaptiveSelector'
import { pickPrimary, pickSecondary, topFlavors } from './lib/taste/result'
import { downloadShareCard, type ShareCardData } from './utils/shareImage'
import type { QuizQuestion } from './lib/taste/types'
import './styles/App.css'

type Phase = 'intro' | 'quiz' | 'calculating' | 'result'

interface RuntimeQuestion {
  q: QuizQuestion
  rerolled: boolean
}

function App() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [state, setState] = useState<QuizState>(initialState)
  const [currentQuestion, setCurrentQuestion] = useState<RuntimeQuestion | null>(null)
  const [askedQuestions, setAskedQuestions] = useState<RuntimeQuestion[]>([])
  const [result, setResult] = useState<Cuisine | null>(null)
  const [secondaryResults, setSecondaryResults] = useState<Cuisine[]>([])
  const [hoveredOption, setHoveredOption] = useState<number | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 1000000))
  const [copyToast, setCopyToast] = useState(false)

  const startQuiz = useCallback(() => {
    const newSeed = Math.floor(Math.random() * 1000000)
    setSeed(newSeed)
    setPhase('quiz')
    setState(initialState())
    setCurrentQuestion(null)
    setAskedQuestions([])
    setResult(null)
    setSecondaryResults([])
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
      // 停止判定
      const stop = newAsked.length >= MAX_QUESTIONS || !shouldContinue(newState)
      if (!stop) {
        const nextQ = pickNextQuestion(
          { askedIds: newState.askedIds, answers: newState.answers, profile: newState.profile },
          seed,
        )
        if (nextQ) {
          setCurrentQuestion({ q: nextQ, rerolled: true })
          setIsTransitioning(false)
          return
        }
      }
      // 进入结果页
      setPhase('calculating')
      setTimeout(() => {
        const primary = pickPrimary(newState.profile)
        setResult(primary)
        setSecondaryResults(pickSecondary(newState.profile, primary))
        setShowConfetti(true)
        setPhase('result')
        setIsTransitioning(false)
      }, 1500)
    }, 400)
  }, [isTransitioning, currentQuestion, state, askedQuestions, seed])

  const goToPreviousQuestion = useCallback(() => {
    if (isTransitioning) return
    if (state.currentIndex === 0) return
    const newState = undoLast(state)
    setState(newState)
    const newAsked = askedQuestions.slice(0, -1)
    setAskedQuestions(newAsked)
    if (newAsked.length > 0) {
      setCurrentQuestion(newAsked[newAsked.length - 1]!)
    }
  }, [isTransitioning, state, askedQuestions])

  const restartQuiz = useCallback(() => {
    setPhase('intro')
    setState(initialState())
    setCurrentQuestion(null)
    setAskedQuestions([])
    setResult(null)
    setSecondaryResults([])
    setShowConfetti(false)
    setIsTransitioning(false)
  }, [])

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
          <button className="start-btn" onClick={startQuiz}>
            <span>开始探索</span>
            <span className="btn-arrow">→</span>
          </button>
          <p className="intro-note">题目随你的选择动态变化 · 一题接一题，越答越懂你</p>
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
          <p className="calculating-mode">自适应 {MIN_QUESTIONS}–{MAX_QUESTIONS} 题</p>
        </div>
      </div>
    )
  }

  // ============ RESULT SCREEN ============
  if (phase === 'result' && result) {
    return (
      <div className="app result-screen">
        {showConfetti && <Confetti />}
        <div className="result-content">
          <div className="result-badge">
            你的味觉灵魂是
            <span className="result-mode"> · 自适应 · {askedQuestions.length} 题</span>
          </div>

          <div className="result-main">
            <div className="result-emoji" style={{
              background: `linear-gradient(135deg, ${getResultGradient(result.category)})`,
            }}>
              <span>{result.emoji}</span>
            </div>
            <h1 className="result-name">{result.name}</h1>
            <p className="result-description">{result.description}</p>
          </div>

          {/* Flavor Profile */}
          <div className="profile-section">
            <h2 className="section-title">味觉画像</h2>
            <div className="profile-bars">
              {(Object.entries(result.profile) as [keyof typeof result.profile, number][]).map(([key, value]) => (
                <div key={key} className="profile-bar">
                  <div className="bar-label">
                    <span className="bar-name">{getLabel(key)}</span>
                    <span className="bar-value">{value.toFixed(0)}</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${(value / 10) * 100}%`,
                        background: `linear-gradient(90deg, ${getBarColor(key, value)})`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Personality */}
          <div className="profile-section">
            <h2 className="section-title">性格标签</h2>
            <div className="tags">
              {result.personalityTraits.map((trait, i) => (
                <span key={i} className="tag">{trait}</span>
              ))}
            </div>
          </div>

          {/* Representative Dishes */}
          <div className="profile-section">
            <h2 className="section-title">代表菜品</h2>
            <div className="dishes-grid">
              {result.representativeDishes.map((dish, i) => (
                <div key={i} className="dish-card">
                  <span className="dish-emoji">{getDishEmoji(dish)}</span>
                  <span className="dish-name">{dish}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Secondary Results */}
          {secondaryResults.length > 0 && (
            <div className="profile-section">
              <h2 className="section-title">你可能也喜欢的</h2>
              <div className="secondary-results">
                {secondaryResults.slice(0, 3).map((cuisine, i) => (
                  <div key={i} className="secondary-card">
                    <span className="secondary-emoji">{cuisine.emoji}</span>
                    <div>
                      <div className="secondary-name">{cuisine.name}</div>
                      <div className="secondary-desc">{cuisine.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="result-actions">
            <button className="action-btn primary" onClick={restartQuiz}>
              <span>🔄</span> 重新测试
            </button>
            <button
              className="action-btn secondary"
              onClick={async () => {
                const text = `我在「味觉灵魂测试」中测出我的灵魂菜系是「${result.emoji} ${result.name}」！${result.description} 你也来试试吧！`
                try {
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text)
                    setCopyToast(true)
                    setTimeout(() => setCopyToast(false), 2000)
                  } else {
                    setCopyToast(true)
                    setTimeout(() => setCopyToast(false), 2000)
                  }
                } catch {
                  setCopyToast(true)
                  setTimeout(() => setCopyToast(false), 2000)
                }
              }}
            >
              <span>📋</span> 复制文案
            </button>
            <button
              className="action-btn primary"
              onClick={() => {
                const data = buildShareCardData(result, secondaryResults, askedQuestions.length)
                downloadShareCard(data, `味觉灵魂_${result.name}.png`)
                setCopyToast(true)
                setTimeout(() => setCopyToast(false), 2000)
              }}
            >
              <span>💾</span> 保存结果图
            </button>
          </div>
        </div>

        {copyToast && (
          <div className="copy-toast">✨ 文案已复制到剪贴板</div>
        )}
      </div>
    )
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
  const progress = Math.min(100, (askedQuestions.length / MAX_QUESTIONS) * 100)

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
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-text">
            {askedQuestions.length + 1} / {MIN_QUESTIONS}–{MAX_QUESTIONS}
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

/**
 * 是否继续出题:达到 MIN 且"最近一题没新信息"。
 * - 简化:用 raw profile 的 std < 5 作为"用户已饱和"
 */
function shouldContinue(s: QuizState): boolean {
  if (s.askedIds.length < MIN_QUESTIONS) return true
  if (s.askedIds.length >= MAX_QUESTIONS) return false
  const vs = Object.values(s.profile)
  const mean = vs.reduce((a, b) => a + b, 0) / vs.length
  const v = Math.sqrt(vs.reduce((acc, x) => acc + (x - mean) ** 2, 0) / vs.length)
  return v >= 5
}

// ============ HELPERS ============
function getLabel(key: string): string {
  const labels: { [key: string]: string } = {
    spicy: '辣度',
    umami: '鲜度',
    sweet: '甜度',
    sour: '酸度',
    crunchy: '脆度',
    tender: '嫩度',
    intense: '浓烈度',
    light: '清淡度',
  }
  return labels[key] || key
}

function getBarColor(key: string, _value: number): string {
  const colors: Record<string, string> = {
    spicy: '#e74c3c, #ff6b6b',
    umami: '#e67e22, #f39c12',
    sweet: '#e91e93, #ff69b4',
    sour: '#27ae60, #2ecc71',
    crunchy: '#8e44ad, #9b59b6',
    tender: '#3498db, #5dade2',
    intense: '#c0392b, #e74c3c',
    light: '#1abc9c, #48c9b0',
  }
  return colors[key] || '#999, #bbb'
}

function getResultGradient(_category: string): string {
  return '#ff6b6b, #ffa07a'
}

function getDishEmoji(dish: string): string {
  const emojiMap: { [key: string]: string } = {
    '麻婆豆腐': '🫕', '水煮鱼': '🐟', '宫保鸡丁': '🍗', '夫妻肺片': '🥩', '火锅': '🫕',
    '虾饺': '🥟', '烧腊': '🍖', '白切鸡': '🍗', '早茶点心': '🫖', '清蒸鱼': '🐟',
    '糖醋鲤鱼': '🐟', '九转大肠': '🥘', '爆炒腰花': '🔥', '葱烧海参': '🦑', '锅包肉': '🥩',
    '松鼠桂鱼': '🐟', '狮子头': '🧆', '盐水鸭': '🦆', '太湖银鱼': '🐟', '蟹粉豆腐': '🦀',
    '东坡肉': '🍖', '龙井虾仁': '🍤', '西湖醋鱼': '🐟', '叫花鸡': '🐔', '宋嫂鱼羹': '🥣',
    '佛跳墙': '🏺', '荔枝肉': '🍖', '鱼丸汤': '🐟', '拌海蜇': '🪼', '沙县小吃': '🍜',
    '剁椒鱼头': '🌶️', '辣椒炒肉': '🥩', '臭豆腐': '🟫', '腊味合蒸': '🥩', '毛氏红烧肉': '🍖',
    '臭鳜鱼': '🐟', '毛豆腐': '🧀', '火腿炖甲鱼': '🐢', '胡适一品锅': '🥘', '徽州饼': '🫓',
    '过桥米线': '🍜', '菌子火锅': '🍄', '孔雀宴': '🦚', '鲜花饼': '🌸', '傣味烤鸡': '🐔',
    '酸汤鱼': '🐟', '丝娃娃': '🥗', '肠旺面': '🍜', '折耳根炒肉': '🌿', '豆腐丸子': '🧆',
    '烤羊肉串': '🍢', '大盘鸡': '🍗', '手抓饭': '🍚', '馕': '🫓', '烤包子': '🥟',
    '酥油茶': '🍵', '糌粑': '🍘', '风干肉': '🥩', '青稞酒': '🍶', '藏香猪': '🐗',
    '五色糯米饭': '🍚', '螺蛳粉': '🍜', '酸嘢': '🥭', '柠檬鸭': '🦆', '桂林米粉': '🍜',
    '猪肉炖粉条': '🥘', '小鸡炖蘑菇': '🍗', '地三鲜': '🥬', '酸菜白肉': '🥬',
    '肉夹馍': '🥖', 'biangbiang 面': '🍜', '羊肉泡馍': '🥣', '凉皮': '🥒', '岐山臊子面': '🍜',
    '清蒸武昌鱼': '🐟', '排骨藕汤': '🥲', '热干面': '🍜', '沔阳三蒸': '🥘', '潜江小龙虾': '🦞',
    '梅菜扣肉': '🥩', '盐焗鸡': '🍗', '酿豆腐': '🧆', '客家咸汤圆': '🍡', '三杯鸭': '🦆',
    '牛肉火锅': '🥩', '手打牛肉丸': '🧆', '潮汕粿品': '🍘', '卤鹅': '🦢', '肠粉': '🌯',
    '北京烤鸭': '🦆', '涮羊肉': '🥩', '炸酱面': '🍜', '爆肚': '🥘', '驴打滚': '🍡',
    '菠萝包': '🍞', '丝袜奶茶': '🧋', '云吞面': '🍜', '叉烧饭': '🍚', '蛋挞': '🥧',
    '卤肉饭': '🍚', '蚵仔煎': '🦪', '珍珠奶茶': '🧋', '三杯鸡': '🍗', '台湾牛肉面': '🍜',
    '烤全羊': '🐑', '手把肉': '🥩', '奶茶': '🧋', '奶豆腐': '🧀', '蒙古馅饼': '🥧',
    '拉面': '🍜',
    '泡菜': '🥬', '烤肉': '🥩',
    '芒果糯米饭': '🥭',
    '烤饼': '🥓', '玉米粽': '🥔', '烤肉串': '🍢',
  }
  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (dish.includes(key)) return emoji
  }
  return '🍽️'
}

function buildShareCardData(
  result: Cuisine,
  secondaryResults: Cuisine[],
  questionCount: number,
): ShareCardData {
  const top3 = topFlavors({
    sour: result.profile.sour,
    sweet: result.profile.sweet,
    bitter: 0,
    spicy: result.profile.spicy,
    salty: 0,
    rich: result.profile.umami,
    crunchy: result.profile.crunchy,
    tender: result.profile.tender,
  }, 3)
  return {
    result,
    quizMode: 'single' as 'quick' | 'full', // P2 单入口,旧 shareImage 兼容字段(P3 重写)
    profile: result.profile,
    secondaryResults,
    personalityTraits: result.personalityTraits,
    topFlavors: top3,
    questionCount,
  }
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
