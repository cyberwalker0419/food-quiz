import type { QuestionBank, QuizQuestion, WeightVector, TasteDimension } from '../../lib/taste/types';

const DIMS: readonly TasteDimension[] = [
  'sour', 'sweet', 'temperature', 'spicy',
  'salty', 'rich', 'crunchy', 'tender',
] as const;

const LETTERS = new Set(['S', 'T', 'H', 'L', 'I', 'X', 'C', 'N']);

/** 校验一个题库是否符合形状约束,失败抛 Error */
export function validateQuestionBank(bank: unknown): asserts bank is QuestionBank {
  if (typeof bank !== 'object' || bank === null) {
    throw new Error('QuestionBank must be an object');
  }
  const b = bank as QuestionBank;
  if (typeof b.version !== 'number') {
    throw new Error('QuestionBank.version must be a number');
  }
  if (!Array.isArray(b.questions)) {
    throw new Error('QuestionBank.questions must be an array');
  }
  const seenIds = new Set<string>();
  for (const q of b.questions) {
    validateQuestion(q, seenIds);
  }
}

function validateQuestion(q: unknown, seenIds: Set<string>): asserts q is QuizQuestion {
  if (typeof q !== 'object' || q === null) {
    throw new Error('Question must be an object');
  }
  const qq = q as QuizQuestion;
  if (typeof qq.id !== 'string' || qq.id.length === 0) {
    throw new Error('Question.id must be a non-empty string');
  }
  if (seenIds.has(qq.id)) {
    throw new Error(`Duplicate question id: ${qq.id}`);
  }
  seenIds.add(qq.id);
  if (typeof qq.stem !== 'string' || qq.stem.length === 0) {
    throw new Error(`Question ${qq.id}.stem must be a non-empty string`);
  }
  if (!Array.isArray(qq.options) || qq.options.length < 2) {
    throw new Error(`Question ${qq.id} must have at least 2 options`);
  }
  const seenOptIds = new Set<string>();
  for (const opt of qq.options) {
    validateOption(qq.id, opt, seenOptIds);
  }
  if (qq.probeLetters) {
    if (!Array.isArray(qq.probeLetters)) {
      throw new Error(`Question ${qq.id}.probeLetters must be an array`);
    }
    for (const l of qq.probeLetters) {
      if (!LETTERS.has(l)) {
        throw new Error(`Question ${qq.id}.probeLetters has invalid letter: ${l}`);
      }
    }
  }
}

function validateOption(
  qid: string,
  opt: unknown,
  seenOptIds: Set<string>
): void {
  if (typeof opt !== 'object' || opt === null) {
    throw new Error(`Option in ${qid} must be an object`);
  }
  const o = opt as { id: string; label: string; weights: WeightVector };
  if (typeof o.id !== 'string' || o.id.length === 0) {
    throw new Error(`Option in ${qid} must have non-empty id`);
  }
  if (seenOptIds.has(o.id)) {
    throw new Error(`Duplicate option id in ${qid}: ${o.id}`);
  }
  seenOptIds.add(o.id);
  if (typeof o.label !== 'string' || o.label.length === 0) {
    throw new Error(`Option ${o.id} in ${qid} must have non-empty label`);
  }
  if (typeof o.weights !== 'object' || o.weights === null) {
    throw new Error(`Option ${o.id} in ${qid}.weights must be an object`);
  }
  for (const d of DIMS) {
    if (typeof o.weights[d] !== 'number') {
      throw new Error(`Option ${o.id} in ${qid}.weights.${d} must be a number`);
    }
  }
  // 不允许有未知键(包括 umami)
  for (const k of Object.keys(o.weights)) {
    if (!DIMS.includes(k as TasteDimension)) {
      throw new Error(`Option ${o.id} in ${qid}.weights has unknown key: ${k}`);
    }
  }
}
