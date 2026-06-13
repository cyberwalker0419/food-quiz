import { describe, it, expect } from 'vitest';
import { validateQuestionBank } from './questions.schema';
import type { QuestionBank, WeightVector, TasteDimension } from '../../lib/taste/types';

// 直接 import JSON;Vite/Vitest 默认支持 JSON import
import bankJson from './questions.json';

const bank = bankJson as QuestionBank;

const DIMS: TasteDimension[] = ['sour', 'sweet', 'bitter', 'spicy', 'salty', 'rich', 'crunchy', 'tender'];

describe('questions.json 形状与硬约束', () => {
  it('validateQuestionBank 通过', () => {
    expect(() => validateQuestionBank(bank)).not.toThrow();
  });

  it('总题数 = 200', () => {
    expect(bank.questions).toHaveLength(200);
  });

  it('约束 4: 每题至少 1 个选项对 8 维中 ≥ 2 维有非零权重', () => {
    for (const q of bank.questions) {
      const found = q.options.some((o) => {
        const w = o.weights as WeightVector;
        return Object.values(w).filter((v) => v !== 0).length >= 2;
      });
      expect(found, `Question ${q.id} has no multi-dim option`).toBe(true);
    }
  });

  it('约束 2: 每维 ≥ 1 个极档探针 (weights[dim] ≥ 80)', () => {
    for (const dim of DIMS) {
      const hasProbe = bank.questions.some((q) =>
        q.options.some((o) => o.weights[dim] >= 80)
      );
      expect(hasProbe, `dim ${dim} lacks extreme probe (>= 80)`).toBe(true);
    }
  });

  it('约束 3: 每维 ≥ 1 个负权探针 (weights[dim] ≤ -40)', () => {
    for (const dim of DIMS) {
      const hasNeg = bank.questions.some((q) =>
        q.options.some((o) => o.weights[dim] <= -40)
      );
      expect(hasNeg, `dim ${dim} lacks reject probe (<= -40)`).toBe(true);
    }
  });

  it('约束 1: 8 维出场次数差 ≤ 30(均衡)', () => {
    const counts: Record<string, number> = Object.fromEntries(DIMS.map((d) => [d, 0]));
    for (const q of bank.questions) {
      // 一道题"出场"= 该题任一选项中该维 weights !== 0
      for (const dim of DIMS) {
        if (q.options.some((o) => o.weights[dim] !== 0)) {
          counts[dim]++;
        }
      }
    }
    const values = Object.values(counts);
    const max = Math.max(...values);
    const min = Math.min(...values);
    expect(max - min, `counts=${JSON.stringify(counts)}`).toBeLessThanOrEqual(30);
  });

  it('约束 5: 所有 option label 不含任何中英文括号(P6.1 清理基线)', () => {
    for (const q of bank.questions) {
      for (const o of q.options) {
        expect(o.label, `q=${q.id} opt=${o.id}`).not.toMatch(/[(（]/);
      }
    }
  });

  it('约束 6: 2 选项题(犀利)与 3+ 选项题(平滑)分布合理(各 ≥ 10 道)', () => {
    const sharp = bank.questions.filter((q) => q.options.length === 2).length;
    const smooth = bank.questions.filter((q) => q.options.length >= 3).length;
    expect(sharp).toBeGreaterThanOrEqual(10);
    expect(smooth).toBeGreaterThanOrEqual(10);
  });
});
