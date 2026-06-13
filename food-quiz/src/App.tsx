import { useState, useCallback } from 'react'
import { questions, quickQuestions, type Question } from './data/questions'
import { cuisines, type Cuisine, type FlavorProfile } from './data/cuisines'
import { pickNextQuestion, mulberry32 } from './utils/adaptiveQuiz'
import { downloadShareCard, type ShareCardData } from './utils/shareImage'
import './styles/App.css'

type Phase = 'intro' | 'quiz' | 'calculating' | 'result'
type QuizMode = 'quick' | 'full'

interface Answer {
  questionId: number
  optionIndex: number
}

const FLAVOR_KEYS: (keyof FlavorProfile)[] = ['spicy', 'umami', 'sweet', 'sour', 'crunchy', 'tender', 'intense', 'light']

// Aggregate the user's flavor preferences from their answers, averaged by weight.
// Result is in the same units as option flavor scores (~ -3..5 per dimension).
function aggregate(selectedQuestions: Question[], answers: Answer[]): FlavorProfile {
  const sum: FlavorProfile = { spicy: 0, umami: 0, sweet: 0, sour: 0, crunchy: 0, tender: 0, intense: 0, light: 0 }
  let totalWeight = 0
  answers.forEach(({ questionId, optionIndex }) => {
    const q = selectedQuestions.find(qq => qq.id === questionId)
    if (!q) return
    const opt = q.options[optionIndex]
    if (!opt) return
    const w = q.weight || 1
    FLAVOR_KEYS.forEach(k => { sum[k] += (opt.flavors[k] || 0) * w })
    totalWeight += w
  })
  if (totalWeight > 0) {
    FLAVOR_KEYS.forEach(k => { sum[k] /= totalWeight })
  }
  return sum
}

// Centered cosine similarity (Pearson correlation) — matches the SHAPE of
// preferences across all 8 dimensions, not the magnitudes. This avoids the
// "everything is Tibetan" bug, where Euclidean distance pulled neutral-profile
// cuisines closer to small-magnitude user profiles.
function similarity(user: FlavorProfile, cuisine: FlavorProfile): number {
  const userMean = FLAVOR_KEYS.reduce((s, k) => s + user[k], 0) / FLAVOR_KEYS.length
  const cuisineMean = FLAVOR_KEYS.reduce((s, k) => s + cuisine[k], 0) / FLAVOR_KEYS.length
  let dot = 0, magA = 0, magB = 0
  FLAVOR_KEYS.forEach(k => {
    const a = user[k] - userMean
    const b = cuisine[k] - cuisineMean
    dot += a * b
    magA += a * a
    magB += b * b
  })
  const denom = Math.sqrt(magA * magB)
  if (denom < 1e-9) return 0
  return dot / denom
}

// Rank all cuisines by similarity to the aggregated user profile.
// Returns most-similar first.
function rankCuisines(selectedQuestions: Question[], answers: Answer[]): { cuisine: Cuisine; score: number }[] {
  const profile = aggregate(selectedQuestions, answers)
  return cuisines
    .map(c => ({ cuisine: c, score: similarity(profile, c.profile) }))
    .sort((a, b) => b.score - a.score)
}

function calculateResults(selectedQuestions: Question[], answers: Answer[]): Cuisine | null {
  const ranked = rankCuisines(selectedQuestions, answers)
  return ranked[0]?.cuisine ?? null
}

// "你可能也喜欢的" — the runner-up cuisines, distinct from the primary result
// and from each other. We always return up to 3.
function getSecondaryResults(
  selectedQuestions: Question[],
  answers: Answer[],
  primary: Cuisine | null,
): Cuisine[] {
  const ranked = rankCuisines(selectedQuestions, answers)
  const out: Cuisine[] = []
  for (const { cuisine } of ranked) {
    if (primary && cuisine.name === primary.name) continue
    out.push(cuisine)
    if (out.length >= 3) break
  }
  return out
}

function App() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [quizMode, setQuizMode] = useState<QuizMode>('quick')
  // Full pool of candidate questions (~150 in full mode). `selectedQuestions`
  // is the running sequence we actually show — built greedily from the pool
  // and re-rolled as answers come in, so two runs almost never look the same.
  const [questionPool, setQuestionPool] = useState<Question[]>(questions)
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>(quickQuestions)
  const [answers, setAnswers] = useState<{ questionId: number; optionIndex: number }[]>([])
  const [result, setResult] = useState<Cuisine | null>(null)
  const [secondaryResults, setSecondaryResults] = useState<Cuisine[]>([])
  const [hoveredOption, setHoveredOption] = useState<number | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 1000000))
  const [copyToast, setCopyToast] = useState(false)

  // Build the adaptive question sequence on quiz start. We pick the first
  // question at random for variety, then let the selector build the rest
  // based on the answers as they come in.
  const buildSequence = useCallback((pool: Question[], count: number): Question[] => {
    const used = new Set<number>()
    const seq: Question[] = []
    // Seeded RNG so the opener is part of the same reproducible sequence
    // as the rest. Without this, the opener used Math.random() and the
    // "start" of every run felt the same.
    const rand = mulberry32(seed)
    // First question: pure random (broad exploration). Pick from the
    // 'daily' bucket so the opener always feels approachable.
    const openers = pool.filter(q => q.category === 'daily')
    const openerSource = openers.length > 0 ? openers : pool
    const first = openerSource[Math.floor(rand() * openerSource.length)]
    seq.push(first)
    used.add(first.id)
    // Then greedily pick the next best follow-up
    for (let i = 1; i < count; i++) {
      const next = pickNextQuestion(pool, [], used, {
        currentStep: i,
        totalSteps: count,
        seed,
      })
      if (!next) break
      seq.push(next)
      used.add(next.id)
    }
    return seq
  }, [seed])

  const startQuiz = useCallback(() => {
    // Reseed on every start so users feel the variety
    const newSeed = Math.floor(Math.random() * 1000000)
    setSeed(newSeed)
    setPhase('quiz')
    setCurrentQuestionIndex(0)
    setAnswers([])
    // Quick mode draws from a curated 30-question shortlist (questions are
    // hand-picked to span every category). Full mode draws from the entire
    // 150-question pool — only ~60 are shown, so reruns differ a lot.
    const pool = quizMode === 'quick' ? quickQuestions : questions
    setQuestionPool(pool)
    const targetCount = quizMode === 'quick' ? 30 : 60
    const seq = buildSequence(pool, targetCount)
    setSelectedQuestions(seq)
  }, [quizMode, buildSequence])

  const answerQuestion = useCallback((optionIndex: number) => {
    if (isTransitioning) return
    setIsTransitioning(true)

    const currentQ = selectedQuestions[currentQuestionIndex]
    const newAnswer = { questionId: currentQ.id, optionIndex }
    const newAnswers = [...answers, newAnswer]
    setAnswers(newAnswers)

    setTimeout(() => {
      if (currentQuestionIndex < selectedQuestions.length - 1) {
        // Adaptive re-roll: pick the next question based on the new profile,
        // sampling from the FULL pool (not just the originally planned
        // sequence). This is the "追问" (follow-up) effect — every question
        // after the first dynamically responds to what the user just answered,
        // and pulls genuinely new questions instead of recycling the seeds.
        // Skipped when going FORWARD from a "previous-question" re-answer
        // (see goToPreviousQuestion) — the user just changed a prior answer,
        // and the sequence past the current index has already been reshuffled
        // by the original forward pass. Re-rolling again would be confusing
        // and would lose the question the user is currently looking at.
        const alreadyRerolled = (currentQ as Question & { _rerolled?: boolean })._rerolled
        if (!alreadyRerolled) {
          const usedIds = new Set(selectedQuestions.slice(0, currentQuestionIndex + 1).map(q => q.id))
          const nextQ = pickNextQuestion(
            questionPool,
            newAnswers,
            usedIds,
            {
              currentStep: currentQuestionIndex + 1,
              totalSteps: selectedQuestions.length,
              seed,
            },
          )
          if (nextQ && nextQ.id !== selectedQuestions[currentQuestionIndex + 1]?.id) {
            // Swap in the new question and mark it so the next forward step
            // (triggered by a "previous-question" re-answer) doesn't re-roll
            // it again. This keeps the sequence stable after edits.
            const newSeq = [...selectedQuestions]
            newSeq[currentQuestionIndex + 1] = { ...nextQ, _rerolled: true } as Question & { _rerolled?: boolean }
            setSelectedQuestions(newSeq)
          }
        }
        setCurrentQuestionIndex(prev => prev + 1)
        setIsTransitioning(false)
      } else {
        setPhase('calculating')
        // Calculate results
        setTimeout(() => {
          const mainResult = calculateResults(selectedQuestions, newAnswers)
          setResult(mainResult)
          const secondary = getSecondaryResults(selectedQuestions, newAnswers, mainResult)
          setSecondaryResults(secondary)
          setShowConfetti(true)
          setPhase('result')
        }, 1500)
      }
    }, 400)
  }, [isTransitioning, selectedQuestions, currentQuestionIndex, answers, seed, questionPool])

  // Go back one question. Drops the last answer so the user can re-pick.
  // We deliberately do NOT undo the adaptive re-roll that may have already
  // changed the question at currentQuestionIndex+1: undoing the sequence
  // re-shuffle would require storing a history of every swap, and the cost
  // isn't worth it — the question the user sees next is still a valid
  // follow-up, just not the one originally planned for this position.
  const goToPreviousQuestion = useCallback(() => {
    if (isTransitioning) return
    if (currentQuestionIndex === 0) return
    setCurrentQuestionIndex(prev => prev - 1)
    setAnswers(prev => prev.slice(0, -1))
  }, [isTransitioning, currentQuestionIndex])

  const restartQuiz = useCallback(() => {
    setPhase('intro')
    setCurrentQuestionIndex(0)
    setAnswers([])
    setQuizMode('quick')
    setResult(null)
    setSecondaryResults([])
    setShowConfetti(false)
    setIsTransitioning(false)
  }, [])

  const progress = ((currentQuestionIndex) / selectedQuestions.length) * 100

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
              <span>22 道中国菜系</span>
            </div>
            <div className="feature">
              <span className="feature-emoji">🧠</span>
              <span>智能追问</span>
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
          <div className="mode-selector">
            <button
              className={`mode-btn ${quizMode === 'quick' ? 'active' : ''}`}
              onClick={() => setQuizMode('quick')}
            >
              <span className="mode-emoji">⚡</span>
              <span className="mode-label">精简版</span>
              <span className="mode-count">30 题</span>
            </button>
            <button
              className={`mode-btn ${quizMode === 'full' ? 'active' : ''}`}
              onClick={() => setQuizMode('full')}
            >
              <span className="mode-emoji">🔥</span>
              <span className="mode-label">完整版</span>
              <span className="mode-count">60 题</span>
            </button>
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
          <p className="calculating-mode">
            {quizMode === 'quick' ? '精简版 30 题' : '完整版 60 题'}
          </p>
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
            <span className="result-mode">
              {quizMode === 'quick' ? ' · 精简版' : ' · 完整版'}
            </span>
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
              {Object.entries(result.profile).map(([key, value]) => (
                <div key={key} className="profile-bar">
                  <div className="bar-label">
                    <span className="bar-name">{getLabel(key)}</span>
                    <span className="bar-value">{value}</span>
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
                // Direct download — no modal, no preview, no Web Share API
                // dance. The card generation is the same share-card module
                // we used before; we just skip the preview overlay and
                // hand the user a PNG straight to their downloads.
                const data = buildShareCardData(result, secondaryResults, quizMode, selectedQuestions.length)
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
  const currentQuestion = selectedQuestions[currentQuestionIndex]
  // When the user goes back to a previously-answered question, surface the
  // option they picked so they can confirm or change it. answers[] is in
  // step order, so the i-th answer corresponds to selectedQuestions[i].
  const priorAnswer = currentQuestionIndex < answers.length
    ? answers[currentQuestionIndex]
    : null
  const selectedOptionIndex = priorAnswer && priorAnswer.questionId === currentQuestion.id
    ? priorAnswer.optionIndex
    : null
  const optionLabels = ['A', 'B', 'C', 'D']

  return (
    <div className="app quiz-screen">
      <div className="quiz-header">
        <div className="quiz-progress">
          {currentQuestionIndex > 0 && (
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
            {currentQuestionIndex + 1} / {selectedQuestions.length}
          </span>
        </div>
      </div>

      <div className={`question-card ${isTransitioning ? 'fade-out' : 'fade-in'}`}>
        <div className="question-number">第 {currentQuestionIndex + 1} 题</div>
        <h2 className="question-text">{currentQuestion.question}</h2>

        <div className="options">
          {currentQuestion.options.map((option, index) => (
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
              <span className="option-emoji">{option.emoji}</span>
              <span className="option-text">{option.text}</span>
              {selectedOptionIndex === index && <span className="option-check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
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
    '猪肉炖粉条': '🥘', '小鸡炖蘑菇': '🍗', '地三鲜': '🍆', '酸菜白肉': '🥬',
    '肉夹馍': '🥖', 'biangbiang 面': '🍜', '羊肉泡馍': '🥣', '凉皮': '🥒', '岐山臊子面': '🍜',
    '清蒸武昌鱼': '🐟', '排骨藕汤': '🍲', '热干面': '🍜', '沔阳三蒸': '🥘', '潜江小龙虾': '🦞',
    '梅菜扣肉': '🥩', '盐焗鸡': '🍗', '酿豆腐': '🧆', '客家咸汤圆': '🍡', '三杯鸭': '🦆',
    '牛肉火锅': '🥩', '手打牛肉丸': '🧆', '潮汕粿品': '🍘', '卤鹅': '🦢', '肠粉': '🌯',
    '北京烤鸭': '🦆', '涮羊肉': '🥩', '炸酱面': '🍜', '爆肚': '🥘', '驴打滚': '🍡',
    '菠萝包': '🍞', '丝袜奶茶': '🧋', '云吞面': '🍜', '叉烧饭': '🍚', '蛋挞': '🥧',
    '卤肉饭': '🍚', '蚵仔煎': '🦪', '珍珠奶茶': '🧋', '三杯鸡': '🍗', '台湾牛肉面': '🍜',
    '烤全羊': '🐑', '手把肉': '🥩', '奶茶': '🧋', '奶豆腐': '🧀', '蒙古馅饼': '🥧',
    '拉面': '🍜',
    '泡菜': '🥬', '烤肉': '🥩',
    '芒果糯米饭': '🥭',
    '烤饼': '🫓', '玉米粽': '🫔', '烤肉串': '🍢',
  }
  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (dish.includes(key)) return emoji
  }
  return '🍽️'
}

function buildShareCardData(
  result: Cuisine,
  secondaryResults: Cuisine[],
  quizMode: 'quick' | 'full',
  questionCount: number,
): ShareCardData {
  // Top 3 flavors sorted by absolute value
  const topFlavors = Object.entries(result.profile)
    .map(([key, value]) => ({ key, label: getLabel(key), value: value as number }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
  return {
    result,
    quizMode,
    profile: result.profile,
    secondaryResults,
    personalityTraits: result.personalityTraits,
    topFlavors,
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
