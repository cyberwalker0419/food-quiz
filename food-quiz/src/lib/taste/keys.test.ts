import { describe, it, expect } from 'vitest';
import {
  DIMS,
  DIM_FIELDS,
  DIM_CHINESE,
  letterToDim,
  dimToLetter,
  letterToChinese,
  keyToIndex,
  indexToKey,
  isHigh,
  letterToTierLabel,
} from './keys';

describe('DIMS / DIM_FIELDS / DIM_CHINESE 一一对应', () => {
  it('三者顺序都是 8 项', () => {
    expect(DIMS).toHaveLength(8);
    expect(DIM_FIELDS).toHaveLength(8);
    expect(DIM_CHINESE).toHaveLength(8);
  });

  it('三者按下标一一对应', () => {
    for (let i = 0; i < 8; i++) {
      expect(letterToDim(DIMS[i])).toBe(DIM_FIELDS[i]);
      expect(dimToLetter(DIM_FIELDS[i])).toBe(DIMS[i]);
      expect(letterToChinese(DIMS[i])).toBe(DIM_CHINESE[i]);
    }
  });

  it('8 字母全部互异', () => {
    expect(new Set(DIMS).size).toBe(8);
  });

  it('8 字段全部互异', () => {
    expect(new Set(DIM_FIELDS).size).toBe(8);
  });
});

describe('letterToDim / dimToLetter 双向闭环', () => {
  it('每个字母转字段后能转回来', () => {
    for (const l of DIMS) {
      expect(dimToLetter(letterToDim(l))).toBe(l);
    }
  });

  it('咸(I)和浓(X)的字母与字段正确分离', () => {
    expect(letterToDim('I')).toBe('salty');
    expect(letterToDim('X')).toBe('rich');
    expect(letterToChinese('I')).toBe('咸');
    expect(letterToChinese('X')).toBe('浓');
  });

  it('未知字母抛错', () => {
    expect(() => letterToDim('Z' as never)).toThrow();
    expect(() => dimToLetter('foo' as never)).toThrow();
  });
});

describe('keyToIndex / indexToKey', () => {
  it('全小写 stklixcn → 0', () => {
    expect(keyToIndex('stklixcn')).toBe(0);
  });

  it('全大写 STKLIXCN → 255', () => {
    expect(keyToIndex('STKLIXCN')).toBe(255);
  });

  it('混合大小写 "Stklixcn" → 128(仅 S 位为 1)', () => {
    expect(keyToIndex('Stklixcn')).toBe(0b10000000);
  });

  it('pro.md 给出的 "StKliXcN" → 165(0b10100101)', () => {
    expect(keyToIndex('StKliXcN')).toBe(0b10100101);
    expect(keyToIndex('StKliXcN')).toBe(165); // 128+32+4+1
  });

  it('indexToKey 还原 keyToIndex', () => {
    for (let i = 0; i < 256; i++) {
      expect(keyToIndex(indexToKey(i))).toBe(i);
    }
  });

  it('所有 256 个 index → key 唯一', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 256; i++) keys.add(indexToKey(i));
    expect(keys.size).toBe(256);
  });

  it('indexToKey 对应示例', () => {
    expect(indexToKey(0)).toBe('stklixcn');
    expect(indexToKey(255)).toBe('STKLIXCN');
  });

  it('非法 key 长度抛错', () => {
    expect(() => keyToIndex('abc')).toThrow(/length must be 8/);
    expect(() => keyToIndex('abcdefghi')).toThrow(/length must be 8/);
  });

  it('非法字符抛错', () => {
    expect(() => keyToIndex('stkliXcn')).not.toThrow(); // X 是合法
    expect(() => keyToIndex('stklizcn')).toThrow(/Invalid char/); // z 非法
  });

  it('index 越界抛错', () => {
    expect(() => indexToKey(-1)).toThrow();
    expect(() => indexToKey(256)).toThrow();
    expect(() => indexToKey(1.5)).toThrow();
  });
});

describe('isHigh', () => {
  it('大写为高', () => {
    expect(isHigh('S')).toBe(true);
    expect(isHigh('X')).toBe(true);
  });
  it('小写为低', () => {
    expect(isHigh('s')).toBe(false);
    expect(isHigh('n')).toBe(false);
  });
});

describe('letterToTierLabel', () => {
  // 8 维非浓档的 7 维(S/T/K/L/I/C/N)
  const nonX: Array<'S' | 'T' | 'K' | 'L' | 'I' | 'C' | 'N'> = [
    'S', 'T', 'K', 'L', 'I', 'C', 'N',
  ];

  it('非浓维低档 (score ≤ 60) → "低<中文名>"', () => {
    expect(letterToTierLabel('S', 0)).toBe('低酸');
    expect(letterToTierLabel('L', 60)).toBe('低辣');
    expect(letterToTierLabel('N', 30)).toBe('低嫩');
  });

  it('非浓维高档 (60 < score < 90) → "重<中文名>"', () => {
    expect(letterToTierLabel('S', 61)).toBe('重酸');
    expect(letterToTierLabel('L', 89.9)).toBe('重辣');
    expect(letterToTierLabel('K', 75)).toBe('重苦');
  });

  it('非浓维极档 (score ≥ 90) → "重<中文名> ⚡极"', () => {
    expect(letterToTierLabel('S', 90)).toBe('重酸 ⚡极');
    expect(letterToTierLabel('L', 100)).toBe('重辣 ⚡极');
    expect(letterToTierLabel('N', 95)).toBe('重嫩 ⚡极');
  });

  it('浓维低档 → "清淡"', () => {
    expect(letterToTierLabel('X', 0)).toBe('清淡');
    expect(letterToTierLabel('X', 60)).toBe('清淡');
  });

  it('浓维高档 → "浓"', () => {
    expect(letterToTierLabel('X', 61)).toBe('浓');
    expect(letterToTierLabel('X', 89.9)).toBe('浓');
  });

  it('浓维极档 → "口味重 ⚡极"', () => {
    expect(letterToTierLabel('X', 90)).toBe('口味重 ⚡极');
    expect(letterToTierLabel('X', 100)).toBe('口味重 ⚡极');
  });

  it('边界 60.0 → 低档,60.0001 → 高档', () => {
    expect(letterToTierLabel('S', 60.0)).toBe('低酸');
    expect(letterToTierLabel('S', 60.0001)).toBe('重酸');
  });

  it('边界 90.0 极档触发', () => {
    expect(letterToTierLabel('S', 90.0)).toBe('重酸 ⚡极');
    expect(letterToTierLabel('X', 90.0)).toBe('口味重 ⚡极');
  });

  it('所有 7 个非浓维字母的低/高/极三档 21 种组合均可', () => {
    for (const l of nonX) {
      expect(letterToTierLabel(l, 10)).toMatch(/^低[酸甜苦辣咸脆嫩]$/);
      expect(letterToTierLabel(l, 75)).toMatch(/^重[酸甜苦辣咸脆嫩]$/);
      expect(letterToTierLabel(l, 95)).toMatch(/^重[酸甜苦辣咸脆嫩] ⚡极$/);
    }
  });

  it('非法 score 抛错', () => {
    expect(() => letterToTierLabel('S', NaN)).toThrow();
    expect(() => letterToTierLabel('S', Infinity)).toThrow();
  });
});
