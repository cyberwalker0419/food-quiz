import { describe, it, expect } from 'vitest';
import { initialState, applyAnswer, undoLast } from './state';
import { questionBank } from '../../content/questions/questions.loader';

// 找两道确有多维权重的题 + 1 道备用
const Q1 = questionBank.questions[0]!; // q1
const Q2 = questionBank.questions[1]!; // q2
const Q3 = questionBank.questions[2]!; // q3

describe('applyAnswer', () => {
  it('推入答案 + 更新 profile + 移 currentIndex', () => {
    let s = initialState();
    const before = { ...s.profile };
    s = applyAnswer(s, Q1.id, Q1.options[0]!.id);
    expect(s.answers).toHaveLength(1);
    expect(s.askedIds).toEqual([Q1.id]);
    expect(s.currentIndex).toBe(1);
    // profile 至少有 1 维变化(主探针)
    let changed = 0;
    for (const k of Object.keys(before) as (keyof typeof before)[]) {
      if (before[k] !== s.profile[k]) changed++;
    }
    expect(changed).toBeGreaterThan(0);
  });

  it('连续 3 题,answers 累加正确', () => {
    let s = initialState();
    s = applyAnswer(s, Q1.id, Q1.options[0]!.id);
    s = applyAnswer(s, Q2.id, Q2.options[0]!.id);
    s = applyAnswer(s, Q3.id, Q3.options[0]!.id);
    expect(s.answers).toHaveLength(3);
    expect(s.currentIndex).toBe(3);
    expect(s.askedIds).toHaveLength(3);
  });

  it('非法 question 抛错', () => {
    const s = initialState();
    expect(() => applyAnswer(s, 'q999', 'q999-a')).toThrow(/Invalid answer/);
  });

  it('非法 option 抛错', () => {
    const s = initialState();
    expect(() => applyAnswer(s, Q1.id, 'q1-zzz')).toThrow(/Invalid answer/);
  });
});

describe('replaceAnswer(回退到某题再改答,后续答案丢弃)', () => {
  it('回退 1 步后改答 → 走 replaceAnswer 路径,旧答案替换、后续被清', () => {
    let s = initialState();
    s = applyAnswer(s, Q1.id, Q1.options[0]!.id);
    s = applyAnswer(s, Q2.id, Q2.options[0]!.id);
    s = applyAnswer(s, Q3.id, Q3.options[0]!.id);
    expect(s.currentIndex).toBe(3);
    s = undoLast(s);
    // currentIndex=2,answers.length=3 → replaceAnswer
    expect(s.currentIndex).toBe(2);
    s = applyAnswer(s, Q2.id, Q2.options[1]!.id);
    // answers 截断到 2,旧 Q3 丢弃,新 Q2-b 入栈
    expect(s.answers).toHaveLength(2);
    expect(s.answers[0]!.optionId).toBe(Q1.options[0]!.id);
    expect(s.answers[1]!.optionId).toBe(Q2.options[1]!.id);
    expect(s.askedIds).toEqual([Q1.id, Q2.id]);
    expect(s.currentIndex).toBe(2);
  });

  it('回退 2 步后改答当前题 → 走 replaceLastAnswer 路径,currentIndex 不变', () => {
    let s = initialState();
    s = applyAnswer(s, Q1.id, Q1.options[0]!.id);
    s = applyAnswer(s, Q2.id, Q2.options[0]!.id);
    s = applyAnswer(s, Q3.id, Q3.options[0]!.id);
    s = undoLast(s);
    s = undoLast(s);
    expect(s.currentIndex).toBe(1);
    // undo 把 answers 也截了:只剩 [Q1]
    expect(s.answers).toHaveLength(1);
    // 改答 Q1:currentIndex == answers.length(1),lastAskedId == Q1 → replaceLastAnswer
    s = applyAnswer(s, Q1.id, Q1.options[1]!.id);
    expect(s.answers).toHaveLength(1);
    expect(s.answers[0]!.optionId).toBe(Q1.options[1]!.id);
    expect(s.askedIds).toEqual([Q1.id]);
    expect(s.currentIndex).toBe(1);
  });
});

describe('undoLast', () => {
  it('undo 后 profile 减回', () => {
    let s = initialState();
    s = applyAnswer(s, Q1.id, Q1.options[0]!.id);
    const p1 = { ...s.profile };
    s = applyAnswer(s, Q2.id, Q2.options[0]!.id);
    s = undoLast(s);
    expect(s.currentIndex).toBe(1);
    expect(s.answers).toHaveLength(1);
    // profile 应回到 p1
    for (const k of Object.keys(p1) as (keyof typeof p1)[]) {
      expect(s.profile[k]).toBeCloseTo(p1[k]!, 6);
    }
  });

  it('undo 在 currentIndex=0 时不报错且不变', () => {
    const s = initialState();
    const s2 = undoLast(s);
    expect(s2).toBe(s);
  });
});
