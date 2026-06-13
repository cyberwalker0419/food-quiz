import type { Question, FlavorKey, QuestionCategory } from '../data/questions'

const FLAVOR_KEYS: FlavorKey[] = ['spicy', 'umami', 'sweet', 'sour', 'crunchy', 'tender', 'intense', 'light']

export type Answer = {
  questionId: number
  optionIndex: number
}

export type Profile = Record<FlavorKey, number>

/**
 * Mulberry32 — a tiny, fast, seedable PRNG. Returns a function that yields
 * a new number in [0, 1) on each call. We use this instead of Math.random()
 * so that the adaptive selector is actually driven by `seed`: with
 * Math.random(), a "new seed" had no real effect on the sequence.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Get a seeded RNG for a quiz run. `seed` is mandatory; if undefined (e.g.
 * the caller is `App.tsx` and the user hasn't started a quiz yet), fall
 * back to a time-derived seed so we still get randomness in dev.
 */
function rng(seed?: number): () => number {
  if (seed === undefined || seed === null) {
    return mulberry32((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0)
  }
  return mulberry32(seed)
}

/**
 * Aggregate the user's flavor profile from the answers so far.
 * This is the "what we know about the user right now" vector.
 */
export function aggregateProfile(
  selectedQuestions: Question[],
  answers: Answer[],
): Profile {
  const profile: Profile = { spicy: 0, umami: 0, sweet: 0, sour: 0, crunchy: 0, tender: 0, intense: 0, light: 0 }
  let totalWeight = 0
  answers.forEach(({ questionId, optionIndex }) => {
    const q = selectedQuestions.find(q => q.id === questionId)
    if (!q) return
    const opt = q.options[optionIndex]
    if (!opt) return
    const w = q.weight || 1
    FLAVOR_KEYS.forEach(k => {
      profile[k] += (opt.flavors[k] || 0) * w
    })
    totalWeight += w
  })
  if (totalWeight > 0) {
    FLAVOR_KEYS.forEach(k => {
      profile[k] = profile[k] / totalWeight
    })
  }
  return profile
}

/**
 * Compute the dominant flavors in the user's current profile.
 * Returns the top 1-3 flavors (with absolute value at least 0.5).
 */
export function dominantFlavors(profile: Profile): FlavorKey[] {
  return FLAVOR_KEYS
    .map(k => ({ k, v: profile[k] }))
    .filter(({ v }) => Math.abs(v) >= 0.5)
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .map(({ k }) => k)
}

/**
 * Compute a follow-up score for a candidate question.
 * Higher score = more "relevant" as a follow-up to the user's prior answers.
 */
function followUpScore(
  question: Question,
  profile: Profile,
  categoryCoverage: Record<QuestionCategory, number>,
  rand: () => number,
): number {
  let score = 0

  // 1. Triggered-by-profile questions: if a question's tag says it should fire
  //    when the user leans heavily on a particular flavor, boost it now.
  if (question.tags?.triggers) {
    Object.entries(question.tags.triggers).forEach(([key, threshold]) => {
      const k = key as FlavorKey
      if (threshold === undefined) return
      if (Math.abs(profile[k] || 0) >= threshold) {
        score += 8
      } else if (Math.abs(profile[k] || 0) >= threshold * 0.6) {
        score += 3
      }
    })
  }

  // 2. Category diversity bonus: questions in under-covered categories get a
  //    small boost so we don't tunnel-vision into one topic.
  const covered = categoryCoverage[question.category] || 0
  if (covered === 0) score += 5
  else if (covered === 1) score += 2

  // 3. Random noise — seeded so the same seed produces the same sequence.
  //    0..10 noise vs 8 trigger / 5 coverage means a "wrong" trigger can be
  //    overridden when many random samples stack up. Without this, the same
  //    profile always produces the same question, which felt repetitive.
  score += rand() * 10

  return score
}

/**
 * Pick the next question in an adaptive way:
 *   1. Early phase: pick randomly (broad exploration).
 *   2. Mid/late phase: bias toward questions that "follow up" on the user's
 *      emerging profile while still keeping some randomness.
 *   3. The final question (or near it) is reserved to be `final` category
 *      (the dramatic closer).
 */
export function pickNextQuestion(
  selectedQuestions: Question[],
  answers: Answer[],
  usedQuestionIds: Set<number>,
  options: {
    currentStep: number
    totalSteps: number
    seed?: number
  },
): Question | null {
  const remaining = selectedQuestions.filter(q => !usedQuestionIds.has(q.id))
  if (remaining.length === 0) return null

  const rand = rng(options.seed)

  const profile = aggregateProfile(selectedQuestions, answers)

  // Count how many of each category we've already used.
  const categoryCoverage: Record<QuestionCategory, number> = {
    daily: 0, mood: 0, texture: 0, adventure: 0, ingredient: 0,
    sensory: 0, social: 0, culture: 0, 'culture-deep': 0, final: 0,
  }
  usedQuestionIds.forEach(id => {
    const q = selectedQuestions.find(q => q.id === id)
    if (q) categoryCoverage[q.category] = (categoryCoverage[q.category] || 0) + 1
  })

  const { currentStep, totalSteps } = options
  const isEarlyPhase = currentStep < Math.max(3, Math.floor(totalSteps * 0.25))
  const isFinalPhase = currentStep >= totalSteps - 3

  // If we're in the final 3 questions, force a `final` category question if available.
  if (isFinalPhase) {
    const finalQ = remaining.find(q => q.category === 'final' && q.weight >= 2)
    if (finalQ) return finalQ
  }

  if (isEarlyPhase) {
    // Pure random for the first few questions (broad exploration), but seeded
    // so a given seed produces a reproducible opener sequence.
    return remaining[Math.floor(rand() * remaining.length)]
  }

  // Score each remaining question and pick the highest-scoring one.
  const scored = remaining.map(q => ({
    q,
    score: followUpScore(q, profile, categoryCoverage, rand),
  }))
  scored.sort((a, b) => b.score - a.score)

  // Pick from the top 5 with a flatter weighted distribution so we don't
  // always pick the same "best" question. Weights sum to 1.0.
  const topK = scored.slice(0, Math.min(5, scored.length))
  const weights = [0.34, 0.24, 0.18, 0.14, 0.10]
  const r = rand()
  let acc = 0
  for (let i = 0; i < topK.length; i++) {
    acc += weights[i] || 0
    if (r < acc) return topK[i].q
  }
  return topK[0].q
}

/**
 * Build a full question sequence for a quiz run, using the adaptive selector.
 * This way the entire list is generated at the start, ensuring the run is
 * deterministic for a given (seed, profile-trajectory) but feels dynamic.
 */
export function buildAdaptiveSequence(
  pool: Question[],
  options: { totalSteps: number; seed?: number },
): Question[] {
  const used = new Set<number>()
  const sequence: Question[] = []
  const fakeAnswers: Answer[] = []
  const stepCount = Math.min(options.totalSteps, pool.length)

  for (let step = 0; step < stepCount; step++) {
    const next = pickNextQuestion(pool, fakeAnswers, used, {
      currentStep: step,
      totalSteps: stepCount,
      seed: options.seed,
    })
    if (!next) break
    sequence.push(next)
    used.add(next.id)
  }

  return sequence
}

/**
 * Mutate the next question pick on the fly when the user answers:
 *   - Maintain the planned sequence
 *   - But re-roll a small portion based on the new answers
 * This way the user feels like every question is reacting to them.
 */
export function rerollRemaining(
  plannedSequence: Question[],
  currentStep: number,
  pool: Question[],
  answers: Answer[],
  options: { seed?: number },
): Question[] {
  // Keep everything already shown; reroll the rest by rebuilding from step currentStep
  // using the latest answer profile.
  const used = new Set(plannedSequence.slice(0, currentStep).map(q => q.id))
  const total = plannedSequence.length
  const future: Question[] = []
  const fakeAnswers = [...answers]

  for (let step = currentStep; step < total; step++) {
    const next = pickNextQuestion(pool, fakeAnswers, used, {
      currentStep: step,
      totalSteps: total,
      seed: options.seed,
    })
    if (!next) break
    future.push(next)
    used.add(next.id)
  }

  return [...plannedSequence.slice(0, currentStep), ...future]
}
