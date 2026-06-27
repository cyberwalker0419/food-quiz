import { describe, it, expect } from 'vitest';
import { ZERO_VECTOR, type WeightVector } from './types';

describe('ZERO_VECTOR', () => {
  it('是 8 维全 0', () => {
    expect(ZERO_VECTOR).toEqual({
      sour: 0,
      sweet: 0,
      temperature: 0,
      spicy: 0,
      salty: 0,
      rich: 0,
      crunchy: 0,
      tender: 0,
    });
  });

  it('包含且仅包含 8 个键', () => {
    expect(Object.keys(ZERO_VECTOR).sort()).toEqual(
      ['crunchy', 'rich', 'salty', 'sour', 'spicy', 'sweet', 'temperature', 'tender']
    );
  });

  it('被 Object.freeze 保护,不能被修改', () => {
    expect(() => {
      (ZERO_VECTOR as WeightVector).sour = 99;
    }).toThrow(TypeError);
  });
});
