import { describe, it, expect } from 'vitest';
import { assembleResult } from './result';
import { ZERO_VECTOR, type WeightVector } from './types';

describe('assembleResult — 4 典型输入', () => {
  it('全低:无 synergy,无 extremes,渲染管线不崩', () => {
    const v: WeightVector = { ...ZERO_VECTOR, sour: -10, sweet: -5 };
    const r = assembleResult(v);
    expect(r.synergy).toBeNull();
    expect(r.extremes).toEqual([]);
    expect(r.intervals.length).toBeGreaterThan(0);
    expect(r.intervals.length).toBeLessThanOrEqual(3);
  });

  it('全高(>= 60):归一化后 8 维接近 75,std=0(allround 触发);有 synergy', () => {
    // 归一化是相对 max(|raw|) 缩放,所以全 80 输入 → 全 75 输出 → std=0 → allround 触发
    const v: WeightVector = {
      sour: 80, sweet: 80, bitter: 80, spicy: 80,
      salty: 80, rich: 80, crunchy: 80, tender: 80,
    };
    const r = assembleResult(v);
    expect(r.synergy).not.toBeNull();
    expect(r.std).toBe(0); // 完全均匀
    // 全 80 归一化后 = 100,8 维全 ≥ 90,触发 8 条 extreme
    expect(r.extremes.length).toBe(8);
  });

  it('8 维混合高(差别大):std>0,无 allround,有 synergy', () => {
    const v: WeightVector = {
      sour: 100, sweet: 30, bitter: 80, spicy: 0,
      salty: 50, rich: 70, crunchy: 20, tender: 90,
    };
    const r = assembleResult(v);
    expect(r.synergy).not.toBeNull();
    expect(r.std).toBeGreaterThan(0);
    expect(r.allround).toBeNull();
  });

  it('极档 1 维(spicy=95):归一化后 = 100,≥ 90 触发;文件缺 → extremes 为空(容错)', () => {
    // 归一化后 spicy = 100,其他 = 50,8 维 std > 0
    const v: WeightVector = { ...ZERO_VECTOR, spicy: 95 };
    const r = assembleResult(v);
    // 文件齐全 → spicy 归一化 100 ≥ 90,触发 1 条 extreme
    expect(r.extremes.length).toBe(1);
    // 且 allIntervals 标记了 isExtreme
    const spicyIv = r.allIntervals.find((iv) => iv.letter === 'L');
    expect(spicyIv?.isExtreme).toBe(true);
  });

  it('方差 < 15:allround 路径触发(文案已落盘)', () => {
    const r = assembleResult(ZERO_VECTOR);
    expect(r.std).toBeLessThan(15);
    expect(r.allround).not.toBeNull();
    expect(typeof r.allround?.label).toBe('string');
  });
});

describe('assembleResult — 极档边界 89.9/90.0/90.1(归一化后 [0,100] 边界)', () => {
  // 用 maxAbs=200 固定刻度,raw=160 → v = 50+50·160/200 = 90 临界
  it('sour=159, maxAbs=200(归一化 ≈ 89.75)→ isExtreme=false', () => {
    const r = assembleResult({ ...ZERO_VECTOR, sour: 159 }, { maxAbs: 200 });
    const iv = r.allIntervals.find((i) => i.letter === 'S');
    expect(iv?.isExtreme).toBe(false);
  });
  it('sour=160, maxAbs=200(归一化 = 90)→ isExtreme=true', () => {
    const r = assembleResult({ ...ZERO_VECTOR, sour: 160 }, { maxAbs: 200 });
    const iv = r.allIntervals.find((i) => i.letter === 'S');
    expect(iv?.isExtreme).toBe(true);
  });
  it('sour=161, maxAbs=200(归一化 ≈ 90.25)→ isExtreme=true', () => {
    const r = assembleResult({ ...ZERO_VECTOR, sour: 161 }, { maxAbs: 200 });
    const iv = r.allIntervals.find((i) => i.letter === 'S');
    expect(iv?.isExtreme).toBe(true);
  });
});

describe('assembleResult — 联动未命中走 _fallback', () => {
  it('S+K 未命中具体 synergy 文件 → 走 _fallback,copy 非空', () => {
    const v: WeightVector = { ...ZERO_VECTOR, sour: 90, bitter: 90 };
    const r = assembleResult(v);
    expect(r.synergy).not.toBeNull();
    const syn = r.synergy!.copy;
    const synText = Array.isArray(syn) ? syn.join('') : syn;
    expect(synText.length).toBeGreaterThan(0);
  });
});

describe('assembleResult — 维度档位标签', () => {
  it('spicy 单维 95 → normalize 后 100 → tierLabels.L = "重辣 ⚡极"', () => {
    const r = assembleResult({ ...ZERO_VECTOR, spicy: 95 });
    expect(r.tierLabels.L).toBe('重辣 ⚡极');
  });

  it('浓维 rich 单维 95 → "口味重 ⚡极"', () => {
    const r = assembleResult({ ...ZERO_VECTOR, rich: 95 });
    expect(r.tierLabels.X).toBe('口味重 ⚡极');
  });

  // 使用显式 maxAbs 来测试中档场景
  it('spicy=70,maxAbs=200 → v=67.5 → "重辣"(高档但非极档)', () => {
    const r = assembleResult({ ...ZERO_VECTOR, spicy: 70 }, { maxAbs: 200 });
    expect(r.tierLabels.L).toBe('重辣');
  });

  it('spicy=10,maxAbs=200 → v=52.5 → "低辣"(低档)', () => {
    const r = assembleResult({ ...ZERO_VECTOR, spicy: 10 }, { maxAbs: 200 });
    expect(r.tierLabels.L).toBe('低辣');
  });

  it('浓维 rich=70,maxAbs=200 → v=67.5 → "浓"(浓维高档但非极档)', () => {
    const r = assembleResult({ ...ZERO_VECTOR, rich: 70 }, { maxAbs: 200 });
    expect(r.tierLabels.X).toBe('浓');
  });

  it('浓维 rich=10,maxAbs=200 → v=52.5 → "清淡"(浓维低档)', () => {
    const r = assembleResult({ ...ZERO_VECTOR, rich: 10 }, { maxAbs: 200 });
    expect(r.tierLabels.X).toBe('清淡');
  });
});

describe('assembleResult — 避雷指南', () => {
  it('永远返回 avoid(文件已落盘,取最低分维)', () => {
    const r = assembleResult(ZERO_VECTOR);
    expect(r.avoid).not.toBeNull();
    expect(r.avoid?.letter).toBeTruthy();
  });
});

describe('assembleResult — 推荐菜只取日常/知名菜', () => {
  it('topDishes 全部为 popular，无冷门地方菜', () => {
    const r = assembleResult({ ...ZERO_VECTOR, spicy: 95, salty: 80, rich: 70 });
    expect(r.topDishes.length).toBeGreaterThan(0);
    for (const d of r.topDishes) {
      expect(d.popular, `冷门菜入选推荐: ${d.name}`).not.toBe(false);
    }
  });

  it('极端偏好也能推荐到日常菜（不会因小众口味被逼推荐冷门菜）', () => {
    const r = assembleResult({ ...ZERO_VECTOR, sour: 90, bitter: 90 });
    expect(r.topDishes.length).toBeGreaterThan(0);
    for (const d of r.topDishes) {
      expect(d.popular).not.toBe(false);
    }
  });
});

describe('assembleResult — 5 等级 grade 字段(视觉层)', () => {
  it('全 0 输入 → 归一化全 50 → 全 C', () => {
    const r = assembleResult(ZERO_VECTOR);
    for (const iv of r.allIntervals) {
      expect(iv.grade).toBe('C');
    }
  });

  it('单维 spicy=95 → 归一化后 spicy=100 → grade A,其余 C', () => {
    const r = assembleResult({ ...ZERO_VECTOR, spicy: 95 });
    const spicyIv = r.allIntervals.find((i) => i.letter === 'L')!;
    expect(spicyIv.grade).toBe('A');
    expect(spicyIv.value).toBe(100);
    for (const iv of r.allIntervals.filter((i) => i.letter !== 'L')) {
      expect(iv.grade).toBe('C');
    }
  });

  it('5 等级覆盖:value=10→E, 30→D, 50→C, 70→B, 90→A', () => {
    // 用 maxAbs=200,raw 不同值产生归一化后不同档位
    // v = 50 + 50·k/200,要得到 v=10/30/50/70/90 → k = -160/-80/0/80/160
    const cases: { raw: number; expected: 'A' | 'B' | 'C' | 'D' | 'E' }[] = [
      { raw: -160, expected: 'E' },  // v=10
      { raw: -80, expected: 'D' },   // v=30
      { raw: 0, expected: 'C' },     // v=50
      { raw: 80, expected: 'B' },    // v=70
      { raw: 160, expected: 'A' },   // v=90
    ];
    for (const { raw, expected } of cases) {
      const r = assembleResult({ ...ZERO_VECTOR, sour: raw }, { maxAbs: 200 });
      const iv = r.allIntervals.find((i) => i.letter === 'S')!;
      expect(iv.grade, `raw=${raw} v=${iv.value} expected=${expected}`).toBe(expected);
    }
  });

  it('grade 与 tierLabel 并行:同一 iv 都有(视觉用 grade,文案用 tierLabel)', () => {
    const r = assembleResult({ ...ZERO_VECTOR, spicy: 95 });
    const spicyIv = r.allIntervals.find((i) => i.letter === 'L')!;
    expect(spicyIv.grade).toBe('A');
    expect(spicyIv.tierLabel).toBe('重辣 ⚡极');
  });
});
