import { describe, it, expect } from 'vitest';
import { validateQuestionBank } from './questions.schema';
import type { QuestionBank } from '../../lib/taste/types';

const good: QuestionBank = {
  version: 1,
  questions: [
    {
      id: 'q1',
      stem: 'test?',
      options: [
        { id: 'q1-a', label: 'A', weights: { sour: 0, sweet: 0, temperature: 0, spicy: 0, salty: 0, rich: 0, crunchy: 0, tender: 0 } },
        { id: 'q1-b', label: 'B', weights: { sour: 10, sweet: -5, temperature: 0, spicy: 0, salty: 0, rich: 0, crunchy: 0, tender: 0 } },
      ],
    },
  ],
};

describe('validateQuestionBank', () => {
  it('合法题库不抛错', () => {
    expect(() => validateQuestionBank(good)).not.toThrow();
  });

  it('缺 version 抛错', () => {
    expect(() => validateQuestionBank({ questions: good.questions })).toThrow(/version/);
  });

  it('重复题 id 抛错', () => {
    const dup = {
      version: 1,
      questions: [good.questions[0], good.questions[0]],
    };
    expect(() => validateQuestionBank(dup)).toThrow(/Duplicate question id/);
  });

  it('缺 stem 抛错', () => {
    const bad = {
      version: 1,
      questions: [{ id: 'q1', options: good.questions[0].options }],
    };
    expect(() => validateQuestionBank(bad)).toThrow(/stem/);
  });

  it('少于 2 个选项抛错', () => {
    const bad = {
      version: 1,
      questions: [{ id: 'q1', stem: 'x', options: [good.questions[0].options[0]] }],
    };
    expect(() => validateQuestionBank(bad)).toThrow(/at least 2 options/);
  });

  it('option 缺 weights 字段抛错', () => {
    const bad = {
      version: 1,
      questions: [
        {
          id: 'q1',
          stem: 'x',
          options: [
            { id: 'q1-a', label: 'A' },
            { id: 'q1-b', label: 'B', weights: { sour: 0, sweet: 0, temperature: 0, spicy: 0, salty: 0, rich: 0, crunchy: 0, tender: 0 } },
          ],
        },
      ],
    };
    expect(() => validateQuestionBank(bad)).toThrow(/weights must be an object/);
  });

  it('option 缺某个维度键抛错', () => {
    const bad = {
      version: 1,
      questions: [
        {
          id: 'q1',
          stem: 'x',
          options: [
            { id: 'q1-a', label: 'A', weights: { sour: 0 } as any },
            { id: 'q1-b', label: 'B', weights: { sour: 0 } as any },
          ],
        },
      ],
    };
    expect(() => validateQuestionBank(bad)).toThrow(/weights\.sweet/);
  });

  it('option weights 出现 umami(弃用键)抛错', () => {
    // 包含 8 个合法键 + 1 个 umami 键 → 走完 key 完整性检查,触发 unknown key
    const bad = {
      version: 1,
      questions: [
        {
          id: 'q1',
          stem: 'x',
          options: [
            {
              id: 'q1-a', label: 'A',
              weights: { sour: 0, sweet: 0, temperature: 0, spicy: 0, salty: 0, rich: 0, crunchy: 0, tender: 0, umami: 0 } as any,
            },
            {
              id: 'q1-b', label: 'B',
              weights: { sour: 0, sweet: 0, temperature: 0, spicy: 0, salty: 0, rich: 0, crunchy: 0, tender: 0 },
            },
          ],
        },
      ],
    };
    expect(() => validateQuestionBank(bad)).toThrow(/unknown key: umami/);
  });

  it('option weights 出现任意未知键抛错', () => {
    const bad = {
      version: 1,
      questions: [
        {
          id: 'q1',
          stem: 'x',
          options: [
            {
              id: 'q1-a', label: 'A',
              weights: { sour: 0, sweet: 0, temperature: 0, spicy: 0, salty: 0, rich: 0, crunchy: 0, tender: 0, foo: 5 } as any,
            },
            {
              id: 'q1-b', label: 'B',
              weights: { sour: 0, sweet: 0, temperature: 0, spicy: 0, salty: 0, rich: 0, crunchy: 0, tender: 0 },
            },
          ],
        },
      ],
    };
    expect(() => validateQuestionBank(bad)).toThrow(/unknown key: foo/);
  });

  it('probeLetters 含非法字母抛错', () => {
    const bad = {
      version: 1,
      questions: [{ ...good.questions[0], probeLetters: ['Z'] }],
    };
    expect(() => validateQuestionBank(bad)).toThrow(/invalid letter/);
  });

  it('probeLetters 含合法字母不抛错', () => {
    const ok = { ...good, questions: [{ ...good.questions[0], probeLetters: ['S', 'L', 'X'] }] };
    expect(() => validateQuestionBank(ok)).not.toThrow();
  });
});
