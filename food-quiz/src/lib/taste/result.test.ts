import { describe, it, expect } from 'vitest';
import { assembleResult } from './result';
import { ZERO_VECTOR, type WeightVector } from './types';

describe('assembleResult — profileCopy 长综合评价', () => {
  const BANNED = ['凑在一起', '同时在线', '够劲的一顿', '比一般人复杂', '随便挑两样', '共振', '让你觉得'];

  it('非空且落到合理字数区间(60–140 字)', () => {
    const r = assembleResult({ ...ZERO_VECTOR, spicy: 90, salty: 85, rich: 80 });
    expect(r.profileCopy.length).toBeGreaterThanOrEqual(60);
    expect(r.profileCopy.length).toBeLessThanOrEqual(140);
  });

  it('多维高档:联动信息并入 profileCopy,以句号收尾的一段连续文字', () => {
    const r = assembleResult({ ...ZERO_VECTOR, spicy: 90, salty: 85, rich: 80 });
    expect(r.synergy).not.toBeNull();
    expect(r.profileCopy).toMatch(/。$/);
  });

  it('全低档(highCount=0):走清淡收尾,仍是非空长评价,无 synergy', () => {
    const r = assembleResult({ ...ZERO_VECTOR, sour: -10, sweet: -5 });
    expect(r.profileCopy.length).toBeGreaterThan(0);
    expect(r.synergy).toBeNull();
  });

  it('不含 humanizer 禁词', () => {
    const cases = [
      { ...ZERO_VECTOR, spicy: 90, salty: 85, rich: 80 },
      { ...ZERO_VECTOR, spicy: 95 },
      { ...ZERO_VECTOR, sour: 90, temperature: 90 },
      { ...ZERO_VECTOR },
    ];
    for (const v of cases) {
      const r = assembleResult(v);
      for (const w of BANNED) {
        expect(r.profileCopy, `命中禁词 "${w}": ${r.profileCopy}`).not.toContain(w);
      }
    }
  });
});

describe('assembleResult — 4 典型输入', () => {
  it('全低:无 synergy,渲染管线不崩', () => {
    const v: WeightVector = { ...ZERO_VECTOR, sour: -10, sweet: -5 };
    const r = assembleResult(v);
    expect(r.synergy).toBeNull();
    expect(r.allIntervals.length).toBe(8);
    expect(r.profileCopy.length).toBeGreaterThan(0);
  });

  it('全高(>= 60):归一化后 8 维接近 75,std=0(allround 触发);有 synergy', () => {
    // 归一化是相对 max(|raw|) 缩放,所以全 80 输入 → 全 75 输出 → std=0 → allround 触发
    const v: WeightVector = {
      sour: 80, sweet: 80, temperature: 80, spicy: 80,
      salty: 80, rich: 80, crunchy: 80, tender: 80,
    };
    const r = assembleResult(v);
    expect(r.synergy).not.toBeNull();
    expect(r.std).toBe(0); // 完全均匀
    // 全 80 归一化后 = 100,8 维全为高档,isHigh=true
    const highCount = r.allIntervals.filter((iv) => iv.isHigh).length;
    expect(highCount).toBe(8);
  });

  it('8 维混合高(差别大):std>0,无 allround,有 synergy', () => {
    const v: WeightVector = {
      sour: 100, sweet: 30, temperature: 80, spicy: 0,
      salty: 50, rich: 70, crunchy: 20, tender: 90,
    };
    const r = assembleResult(v);
    expect(r.synergy).not.toBeNull();
    expect(r.std).toBeGreaterThan(0);
    expect(r.allround).toBeNull();
  });

  it('单维极大(spicy=95):归一化后 = 100,isHigh=true,grade=A,tierLabel=重辣', () => {
    // 归一化后 spicy = 100,其他 = 50,8 维 std > 0
    const v: WeightVector = { ...ZERO_VECTOR, spicy: 95 };
    const r = assembleResult(v);
    const spicyIv = r.allIntervals.find((iv) => iv.letter === 'L');
    expect(spicyIv?.isHigh).toBe(true);
    expect(spicyIv?.grade).toBe('A');
    expect(spicyIv?.tierLabel).toBe('重辣');
    expect(r.tierLabels.L).toBe('重辣');
  });

  it('方差 < 15:allround 路径触发(文案已落盘)', () => {
    const r = assembleResult(ZERO_VECTOR);
    expect(r.std).toBeLessThan(15);
    expect(r.allround).not.toBeNull();
    expect(typeof r.allround?.label).toBe('string');
  });
});

describe('assembleResult — 旧极档临界(90)现已并入高档', () => {
  // 用 maxAbs=200 固定刻度,raw=160 → v = 50+50·160/200 = 90 临界
  it('sour=159, maxAbs=200(归一化 ≈ 89.75)→ tierLabel=重酸(高档)', () => {
    const r = assembleResult({ ...ZERO_VECTOR, sour: 159 }, { maxAbs: 200 });
    const iv = r.allIntervals.find((i) => i.letter === 'S');
    expect(iv?.tierLabel).toBe('重酸');
    expect(iv?.isHigh).toBe(true);
  });
  it('sour=160, maxAbs=200(归一化 = 90)→ tierLabel=重酸(旧极档线现已归高档)', () => {
    const r = assembleResult({ ...ZERO_VECTOR, sour: 160 }, { maxAbs: 200 });
    const iv = r.allIntervals.find((i) => i.letter === 'S');
    expect(iv?.tierLabel).toBe('重酸');
    expect(iv?.isHigh).toBe(true);
  });
  it('sour=161, maxAbs=200(归一化 ≈ 90.25)→ tierLabel=重酸', () => {
    const r = assembleResult({ ...ZERO_VECTOR, sour: 161 }, { maxAbs: 200 });
    const iv = r.allIntervals.find((i) => i.letter === 'S');
    expect(iv?.tierLabel).toBe('重酸');
  });
});

describe('assembleResult — 联动未命中走 _fallback', () => {
  it('S+H 未命中具体 synergy 文件 → 走 _fallback,copy 非空', () => {
    const v: WeightVector = { ...ZERO_VECTOR, sour: 90, temperature: 90 };
    const r = assembleResult(v);
    expect(r.synergy).not.toBeNull();
    const syn = r.synergy!.copy;
    const synText = Array.isArray(syn) ? syn.join('') : syn;
    expect(synText.length).toBeGreaterThan(0);
  });
});

describe('assembleResult — 维度档位标签', () => {
  it('spicy 单维 95 → normalize 后 100 → tierLabels.L = "重辣"(高档,无 ⚡极)', () => {
    const r = assembleResult({ ...ZERO_VECTOR, spicy: 95 });
    expect(r.tierLabels.L).toBe('重辣');
  });

  it('浓维 rich 单维 95 → "浓"(高档,无 ⚡极)', () => {
    const r = assembleResult({ ...ZERO_VECTOR, rich: 95 });
    expect(r.tierLabels.X).toBe('浓');
  });

  it('spicy=70,maxAbs=200 → v=67.5 → "重辣"(高档)', () => {
    const r = assembleResult({ ...ZERO_VECTOR, spicy: 70 }, { maxAbs: 200 });
    expect(r.tierLabels.L).toBe('重辣');
  });

  it('spicy=10,maxAbs=200 → v=52.5 → "低辣"(低档)', () => {
    const r = assembleResult({ ...ZERO_VECTOR, spicy: 10 }, { maxAbs: 200 });
    expect(r.tierLabels.L).toBe('低辣');
  });

  it('浓维 rich=70,maxAbs=200 → v=67.5 → "浓"(浓维高档)', () => {
    const r = assembleResult({ ...ZERO_VECTOR, rich: 70 }, { maxAbs: 200 });
    expect(r.tierLabels.X).toBe('浓');
  });

  it('浓维 rich=10,maxAbs=200 → v=52.5 → "清淡"(浓维低档)', () => {
    const r = assembleResult({ ...ZERO_VECTOR, rich: 10 }, { maxAbs: 200 });
    expect(r.tierLabels.X).toBe('清淡');
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
    const r = assembleResult({ ...ZERO_VECTOR, sour: 90, temperature: 90 });
    expect(r.topDishes.length).toBeGreaterThan(0);
    for (const d of r.topDishes) {
      expect(d.popular).not.toBe(false);
    }
  });

  it('topDishes 不重菜名(同菜系/同地区允许)', () => {
    const r = assembleResult({ ...ZERO_VECTOR, spicy: 90, salty: 80, rich: 70 });
    expect(r.topDishes.length).toBeGreaterThan(1);
    const names = r.topDishes.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length); // 菜名两两不同
  });

  it('seed 不同 → 同画像推到不同的菜组合(匹配池随机抽样)', () => {
    const profile = { ...ZERO_VECTOR, spicy: 90, salty: 80, rich: 70 };
    const seenFirst = new Set<string>();
    const seenAll = new Set<string>();
    for (let s = 0; s < 20; s++) {
      const r = assembleResult(profile, { seed: s * 137 + 1 });
      if (r.topDishes[0]) seenFirst.add(r.topDishes[0].name);
      for (const d of r.topDishes) seenAll.add(d.name);
    }
    // 20 次抽样:第一道至少 4 种不同的菜(锚点不固定)
    expect(seenFirst.size, `20 次仅 ${seenFirst.size} 种第一道: ${[...seenFirst].join(',')}`).toBeGreaterThanOrEqual(4);
    // 总体应见 ≥ 8 种不同的菜(池足够宽)
    expect(seenAll.size, `20 次合计仅 ${seenAll.size} 种菜`).toBeGreaterThanOrEqual(8);
  });

  it('同 seed → 确定性(便于测试与"重新生成"按钮)', () => {
    const profile = { ...ZERO_VECTOR, spicy: 80, rich: 70 };
    const r1 = assembleResult(profile, { seed: 42 });
    const r2 = assembleResult(profile, { seed: 42 });
    expect(r1.topDishes.map((d) => d.name)).toEqual(r2.topDishes.map((d) => d.name));
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
    expect(spicyIv.tierLabel).toBe('重辣');
  });
});

describe('assembleResult — 菜系百分比(top3 均值)', () => {
  it('topCuisines 含 percent 字段且为合理整数', () => {
    const r = assembleResult({ ...ZERO_VECTOR, spicy: 90, salty: 80, rich: 70 });
    expect(r.topCuisines.length).toBeGreaterThan(0);
    for (const c of r.topCuisines) {
      expect(Number.isInteger(c.percent), `${c.cuisine} percent 非整数`).toBe(true);
      expect(c.percent).toBeGreaterThan(0);
      expect(c.percent).toBeLessThanOrEqual(100);
      expect(c.dishCount).toBeGreaterThan(0);
    }
  });

  it('菜系按 score 降序(top1 匹配度最高)', () => {
    const r = assembleResult({ ...ZERO_VECTOR, spicy: 90, salty: 80, rich: 70 });
    for (let i = 1; i < r.topCuisines.length; i++) {
      expect(r.topCuisines[i - 1]!.score).toBeGreaterThanOrEqual(r.topCuisines[i]!.score);
    }
  });

  it('percent = Math.round(score * 100)', () => {
    const r = assembleResult({ ...ZERO_VECTOR, spicy: 95 });
    for (const c of r.topCuisines) {
      expect(c.percent).toBe(Math.round(c.score * 100));
    }
  });

  it('top3 均值语义: 大菜系不被冷门菜拉低(百分比较旧均值更乐观)', () => {
    // 重口画像: 川菜应有较高百分比(top3 强匹配),而非被全库均值稀释
    const r = assembleResult({ ...ZERO_VECTOR, spicy: 90, salty: 80, rich: 70 });
    const top = r.topCuisines[0]!;
    expect(top.percent).toBeGreaterThanOrEqual(40);
  });
});
