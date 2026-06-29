import { describe, it, expect } from 'vitest';
import { questionBank } from './questions.loader';

describe('questionBank 加载器', () => {
  it('能正常导出', () => {
    expect(questionBank).toBeDefined();
  });

  it('460 道题全部就绪', () => {
    expect(questionBank.questions).toHaveLength(460);
  });

  it('每道题至少有 2 个选项', () => {
    for (const q of questionBank.questions) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
    }
  });
});
