import { useState, useCallback, useEffect } from 'react';
import { loadDishes, type DishEntry } from '../lib/taste/loaders';

interface Props {
  onBack: () => void;
}

/**
 * 「吃什么啊？」随机菜页。
 * 从 dishes.json 全库随机抽一道，展示菜名 + 菜系 · 地区，「换一个」重新抽（不重复上一道）。
 */
export function RandomDish({ onBack }: Props) {
  const allDishes = loadDishes() ?? [];
  const dishes = allDishes.filter((d) => d.popular !== false); // 仅日常/知名菜
  const [index, setIndex] = useState<number>(() => (dishes.length ? Math.floor(Math.random() * dishes.length) : -1));
  const [spinning, setSpinning] = useState(false);

  const reroll = useCallback(() => {
    if (dishes.length < 2) return;
    setSpinning(true);
    // 抽一个不同于当前的
    let next = index;
    while (next === index) {
      next = Math.floor(Math.random() * dishes.length);
    }
    setTimeout(() => {
      setIndex(next);
      setSpinning(false);
    }, 260);
  }, [dishes.length, index]);

  // 同步分享卡字体预载（与 App 一致，避免首次渲染空白）
  useEffect(() => {
    document.scrollingElement?.scrollTo?.(0, 0);
  }, []);

  const dish: DishEntry | undefined = index >= 0 ? dishes[index] : undefined;

  return (
    <div className="app random-screen">
      <div className="random-paper">
        <button type="button" className="back-link" onClick={onBack}>
          ← 返回
        </button>

        <header className="random-header">
          <h1 className="random-title">是啊，吃什么啊？</h1>
          <p className="random-sub">茫茫菜海，替你掷一签</p>
        </header>

        <div className={`random-dish ${spinning ? 'spinning' : ''}`}>
          {dish && (
            <>
              <div className="dish-seal">签</div>
              <div className="dish-bigname">{dish.name}</div>
              <div className="dish-origin">
                {dish.cuisine} · {dish.region}
              </div>
            </>
          )}
        </div>

        <div className="random-actions">
          <button type="button" className="ink-btn primary" onClick={reroll} disabled={spinning}>
            换 一 个
          </button>
          <button type="button" className="ink-btn ghost" onClick={onBack}>
            去测味觉灵魂
          </button>
        </div>

        <p className="random-foot">共 {dishes.length} 道 · 八大菜系与地方风味</p>
      </div>
    </div>
  );
}
