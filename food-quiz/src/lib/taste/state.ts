import type { QuizQuestion, QuizOption, WeightVector } from './types';
import { ZERO_VECTOR } from './types';
import { questionBank } from '../../content/questions/questions.loader';

export type AnswerRecord = {
  questionId: string;
  optionId: string;
  /** 选完时该 option 注入到 profile 的权重。用于 undo 时反减。 */
  weights: WeightVector;
};

/** 完整答题状态(纯数据,可序列化)。 */
export interface QuizState {
  askedIds: string[];
  answers: AnswerRecord[];
  /** 当前 profile(原始权重,未归一化)。 */
  profile: WeightVector;
  /** 当前题目索引:0..answers.length。等于 answers.length 表示"还没选"。 */
  currentIndex: number;
}

export function initialState(): QuizState {
  return {
    askedIds: [],
    answers: [],
    profile: { ...ZERO_VECTOR },
    currentIndex: 0,
  };
}

export function findQuestion(id: string): QuizQuestion | undefined {
  return questionBank.questions.find((q) => q.id === id);
}

export function findOption(q: QuizQuestion, optionId: string): QuizOption | undefined {
  return q.options.find((o) => o.id === optionId);
}

/**
 * 应用一个答案:
 * - 推入 answers 数组
 * - 更新 profile(option.weights 累加)
 * - 推入 askedIds
 * - currentIndex 后移
 * 返回**新** state(不可变)。
 */
export function applyAnswer(
  state: QuizState,
  questionId: string,
  optionId: string,
): QuizState {
  const q = findQuestion(questionId);
  const opt = q && findOption(q, optionId);
  if (!q || !opt) {
    throw new Error(`Invalid answer: q=${questionId} opt=${optionId}`);
  }
  // 1) 同一道题在 currentIndex 处已答过 → 替换(支持"回退到某题改答"流程)
  // 2) 用户在 currentIndex == answers.length 时改答当前题 → 也走替换(避免重复)
  const lastAskedId = state.askedIds[state.currentIndex - 1];
  if (state.currentIndex < state.answers.length) {
    return replaceAnswer(state, questionId, optionId);
  }
  if (lastAskedId === questionId) {
    return replaceLastAnswer(state, questionId, optionId);
  }
  const profile = { ...state.profile };
  for (const k of Object.keys(profile) as (keyof WeightVector)[]) {
    profile[k] += opt.weights[k] || 0;
  }
  return {
    askedIds: [...state.askedIds, questionId],
    answers: [...state.answers, { questionId, optionId, weights: opt.weights }],
    profile,
    currentIndex: state.currentIndex + 1,
  };
}

/**
 * 替换 currentIndex 处的答案(支持 currentIndex < answers.length 的情况)。
 * - 从 profile 中减掉旧 option 的 weights,加上新的
 * - 后续答案(index+1..end)**全部丢弃**(回退效应)
 * - askedIds 同步:保留到 currentIndex(不含)
 */
function replaceAnswer(
  state: QuizState,
  questionId: string,
  optionId: string,
): QuizState {
  const old = state.answers[state.currentIndex];
  const q = findQuestion(questionId);
  const opt = q && findOption(q, optionId);
  if (!q || !opt) {
    throw new Error(`Invalid replace: q=${questionId} opt=${optionId}`);
  }
  const profile = { ...state.profile };
  if (old) {
    for (const k of Object.keys(profile) as (keyof WeightVector)[]) {
      profile[k] -= old.weights[k] || 0;
    }
  }
  for (const k of Object.keys(profile) as (keyof WeightVector)[]) {
    profile[k] += opt.weights[k] || 0;
  }
  const newAnswers = state.answers.slice(0, state.currentIndex);
  const newAskedIds = state.askedIds.slice(0, state.currentIndex);
  newAnswers.push({ questionId, optionId, weights: opt.weights });
  newAskedIds.push(questionId);
  return {
    askedIds: newAskedIds,
    answers: newAnswers,
    profile,
    currentIndex: state.currentIndex + 1,
  };
}

/**
 * 替换最后一题答案(currentIndex == answers.length,新答 = 当前题)。
 * 与 replaceAnswer 不同:不丢弃后续(currentIndex+1..end 是空)。
 * 实际是把 answers[currentIndex-1] 替换,profile 同步。
 */
function replaceLastAnswer(
  state: QuizState,
  questionId: string,
  optionId: string,
): QuizState {
  const idx = state.currentIndex - 1;
  const old = state.answers[idx];
  const q = findQuestion(questionId);
  const opt = q && findOption(q, optionId);
  if (!q || !opt) {
    throw new Error(`Invalid replace-last: q=${questionId} opt=${optionId}`);
  }
  const profile = { ...state.profile };
  if (old) {
    for (const k of Object.keys(profile) as (keyof WeightVector)[]) {
      profile[k] -= old.weights[k] || 0;
    }
  }
  for (const k of Object.keys(profile) as (keyof WeightVector)[]) {
    profile[k] += opt.weights[k] || 0;
  }
  const newAnswers = state.answers.slice();
  newAnswers[idx] = { questionId, optionId, weights: opt.weights };
  return {
    askedIds: state.askedIds.slice(),
    answers: newAnswers,
    profile,
    currentIndex: state.currentIndex, // 不变
  };
}

/**
 * 回退一题:
 * - currentIndex - 1
 * - profile 减掉最后一题的 weights
 * - askedIds / answers 同步
 */
export function undoLast(state: QuizState): QuizState {
  if (state.currentIndex === 0) return state;
  const newIndex = state.currentIndex - 1;
  const last = state.answers[newIndex];
  const profile = { ...state.profile };
  if (last) {
    for (const k of Object.keys(profile) as (keyof WeightVector)[]) {
      profile[k] -= last.weights[k] || 0;
    }
  }
  return {
    askedIds: state.askedIds.slice(0, newIndex),
    answers: state.answers.slice(0, newIndex),
    profile,
    currentIndex: newIndex,
  };
}
