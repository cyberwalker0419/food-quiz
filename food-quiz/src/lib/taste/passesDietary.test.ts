import { describe, it, expect } from 'vitest';
import { passesDietary, assembleResult } from './result';
import { ZERO_VECTOR, type WeightVector } from './types';
import type { DishEntry } from './loaders';

function mk(over: Partial<DishEntry>): DishEntry {
  return {
    name: 'x',
    cuisine: 'c',
    region: 'r',
    vector: { sour: 0, sweet: 0, bitter: 0, spicy: 0, salty: 0, rich: 0, crunchy: 0, tender: 0 },
    ...over,
  };
}

describe('passesDietary — 纯函数', () => {
  it('空限制数组 → 一律放行', () => {
    expect(passesDietary(mk({}), [])).toBe(true);
    expect(passesDietary(mk({ meatTypes: ['pork'] }), [])).toBe(true);
  });

  it('no-pork: 含 pork 排除,其余放行', () => {
    expect(passesDietary(mk({ meatTypes: ['pork'] }), ['no-pork'])).toBe(false);
    expect(passesDietary(mk({ meatTypes: ['beef'] }), ['no-pork'])).toBe(true);
    expect(passesDietary(mk({ isVegetarian: true }), ['no-pork'])).toBe(true);
  });

  it('no-beef: 含 beef 排除,其余放行', () => {
    expect(passesDietary(mk({ meatTypes: ['beef'] }), ['no-beef'])).toBe(false);
    expect(passesDietary(mk({ meatTypes: ['lamb'] }), ['no-beef'])).toBe(true);
    expect(passesDietary(mk({ meatTypes: ['pork'] }), ['no-beef'])).toBe(true);
  });

  it('no-lamb: 含 lamb 排除,其余放行', () => {
    expect(passesDietary(mk({ meatTypes: ['lamb'] }), ['no-lamb'])).toBe(false);
    expect(passesDietary(mk({ meatTypes: ['beef'] }), ['no-lamb'])).toBe(true);
  });

  it('no-chicken: 含 chicken 排除,其余放行', () => {
    expect(passesDietary(mk({ meatTypes: ['chicken'] }), ['no-chicken'])).toBe(false);
    expect(passesDietary(mk({ meatTypes: ['pork'] }), ['no-chicken'])).toBe(true);
    expect(passesDietary(mk({ isVegetarian: true }), ['no-chicken'])).toBe(true);
  });

  it('no-egg: isContainsEgg===true 排除,未标记者放行', () => {
    expect(passesDietary(mk({ isContainsEgg: true }), ['no-egg'])).toBe(false);
    expect(passesDietary(mk({}), ['no-egg'])).toBe(true);
    expect(passesDietary(mk({ meatTypes: ['pork'] }), ['no-egg'])).toBe(true);
  });

  it('no-offal: isOffal===true 排除,未标记者放行', () => {
    expect(passesDietary(mk({ isOffal: true }), ['no-offal'])).toBe(false);
    expect(passesDietary(mk({}), ['no-offal'])).toBe(true);
    expect(passesDietary(mk({ meatTypes: ['pork'] }), ['no-offal'])).toBe(true);
  });

  it('no-seafood: 含 fish 或 seafood 排除', () => {
    expect(passesDietary(mk({ meatTypes: ['fish'] }), ['no-seafood'])).toBe(false);
    expect(passesDietary(mk({ meatTypes: ['seafood'] }), ['no-seafood'])).toBe(false);
    expect(passesDietary(mk({ meatTypes: ['chicken'] }), ['no-seafood'])).toBe(true);
  });

  it('vegetarian: 仅 isVegetarian===true 通过(未标记者不放行)', () => {
    expect(passesDietary(mk({ isVegetarian: true }), ['vegetarian'])).toBe(true);
    expect(passesDietary(mk({ meatTypes: ['pork'] }), ['vegetarian'])).toBe(false);
    expect(passesDietary(mk({}), ['vegetarian'])).toBe(false);
  });

  it('halal: 仅 isHalal===true 通过(未标 isHalal 不放行)', () => {
    expect(passesDietary(mk({ isHalal: true }), ['halal'])).toBe(true);
    expect(passesDietary(mk({ meatTypes: ['lamb'] }), ['halal'])).toBe(false);
  });

  it('交集: 多条同时须全满足', () => {
    // no-pork + no-seafood: 含 pork 或 fish 任一即排除
    expect(passesDietary(mk({ meatTypes: ['pork'] }), ['no-pork', 'no-seafood'])).toBe(false);
    expect(passesDietary(mk({ meatTypes: ['fish'] }), ['no-pork', 'no-seafood'])).toBe(false);
    expect(passesDietary(mk({ meatTypes: ['chicken'] }), ['no-pork', 'no-seafood'])).toBe(true);
    // vegetarian + no-pork: 素菜同时满足
    expect(passesDietary(mk({ isVegetarian: true }), ['vegetarian', 'no-pork'])).toBe(true);
    // 非素(含 beef)即使不含猪,vegetarian 仍排除
    expect(passesDietary(mk({ meatTypes: ['beef'] }), ['vegetarian', 'no-pork'])).toBe(false);
  });
});

describe('assembleResult — 忌口过滤 + 兜底', () => {
  const zero = (): WeightVector => ({ ...ZERO_VECTOR });

  it('vegetarian 过滤生效: 推荐菜全部 isVegetarian', () => {
    const r = assembleResult(zero(), { seed: 1, dietary: ['vegetarian'] });
    expect(r.topDishes.length).toBeGreaterThan(0);
    for (const d of r.topDishes) {
      expect(d.isVegetarian, `非素菜入选: ${d.name}`).toBe(true);
    }
  });

  it('no-pork 过滤生效: 推荐菜不含 pork', () => {
    const r = assembleResult({ ...ZERO_VECTOR, spicy: 80, salty: 70, rich: 60 }, { seed: 3, dietary: ['no-pork'] });
    expect(r.topDishes.length).toBeGreaterThan(0);
    for (const d of r.topDishes) {
      const hasPork = d.meatTypes?.includes('pork') === true;
      expect(hasPork, `猪肉菜入选: ${d.name}`).toBe(false);
    }
  });

  it('no-egg 过滤生效: 推荐菜不含 isContainsEgg', () => {
    const r = assembleResult(zero(), { seed: 5, dietary: ['no-egg'] });
    expect(r.topDishes.length).toBeGreaterThan(0);
    for (const d of r.topDishes) {
      expect(d.isContainsEgg, `含蛋菜入选: ${d.name}`).not.toBe(true);
    }
  });

  it('no-offal 过滤生效: 推荐菜不含 isOffal', () => {
    const r = assembleResult(zero(), { seed: 7, dietary: ['no-offal'] });
    expect(r.topDishes.length).toBeGreaterThan(0);
    for (const d of r.topDishes) {
      expect(d.isOffal, `内脏菜入选: ${d.name}`).not.toBe(true);
    }
  });

  it('过滤后过少 → 兜底回退,仍有推荐', () => {
    // halal + vegetarian 同时: 池极小(仅清真素菜),触发兜底回退 popular
    const r = assembleResult(zero(), { seed: 2, dietary: ['halal', 'vegetarian'] });
    expect(r.topDishes.length).toBeGreaterThan(0);
  });
});
