import { useState, useEffect, useRef } from 'react';
import type { AssembledResult } from '../lib/taste/result';
import { RadarChart } from './RadarChart';
import { getShareCardDataUrl } from '../utils/shareImage';

interface Props {
  result: AssembledResult;
  questionCount: number;
  onRestart: () => void;
  onCopy: (text: string) => void;
  onDownload: () => void;
}

/**
 * P3 结果页主组件。消费 assembleResult() 返回的完整结构。
 * 渲染顺序:
 *   1. 味觉特征:一段长综合评价(allround 独立分支)
 *   2. 8 维雷达图 + 档位明细
 *   3. 推荐菜(可折叠)
 *   4. 操作按钮
 *
 * 解耦:任意文案模块缺文件 → assembleResult 返回 null/[] → 本组件相应 section 不渲染。
 */
export function ResultCard({ result, questionCount, onRestart, onCopy, onDownload }: Props) {
  const [dishesOpen, setDishesOpen] = useState(true);

  // P7.2 挂载时预渲染分享卡 dataURL 并缓存 — 用户点「保存结果图」时直接走 <a download>,绕过 toBlob 异步
  const cachedDataUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getShareCardDataUrl({ result, questionCount })
      .then((url) => {
        if (!cancelled) cachedDataUrlRef.current = url;
      })
      .catch(() => {
        // 失败 → onDownload prop 兜底
      });
    return () => {
      cancelled = true;
    };
  }, [result, questionCount]);

  const handleDownloadClick = () => {
    const cached = cachedDataUrlRef.current;
    if (cached) {
      const top = result.allIntervals[0];
      const tag = top ? top.tierLabel : '味觉灵魂';
      const a = document.createElement('a');
      a.href = cached;
      a.download = `味觉灵魂_${tag}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // 缓存未就绪 → 降级到原 onDownload 路径
      onDownload();
    }
  };

  return (
    <div className="app result-screen">
      <div className="result-content">
        <div className="result-badge">
          你的味觉灵魂图谱
          <span className="result-mode"> · 自适应 · {questionCount} 题</span>
        </div>

        {/* 1. 味觉特征:一段长综合评价(allround 独立分支) */}
        {result.allround ? (
          <section className="profile-section allround-section">
            <h2 className="section-title">{result.allround.label}</h2>
            <p className="allround-copy">{result.allround.copy}</p>
          </section>
        ) : (
          <section className="profile-section intervals-section">
            <h2 className="section-title">味觉特征</h2>
            <p className="profile-copy">{result.profileCopy}</p>
          </section>
        )}

        {/* 2. 8 维图(P6.3 改为 Canvas 雷达图) */}
        <section className="profile-section">
          <h2 className="section-title">8 维味觉图谱</h2>
          <div className="radar-wrap">
            <RadarChart intervals={result.allIntervals} size={320} fontFamily='"Noto Sans SC", "PingFang SC", system-ui, sans-serif' />
          </div>
          <details className="dimension-list">
            <summary>8 维档位明细</summary>
            <ul className="dim-list">
              {result.allIntervals.map((iv) => (
                <li key={iv.letter}>
                  <span className={`dim-grade grade-${iv.grade}`}>{iv.grade}</span>
                  <span className="dim-label">{iv.tierLabel}</span>
                  <span className="dim-value">{iv.value.toFixed(0)}</span>
                </li>
              ))}
            </ul>
          </details>
        </section>

        {/* 3. 推荐菜(可折叠) */}
        {result.topDishes.length > 0 && (
          <section className="profile-section dishes-section">
            <button
              type="button"
              className="dishes-toggle"
              onClick={() => setDishesOpen(!dishesOpen)}
            >
              <h2 className="section-title">今夜吃什么 {dishesOpen ? '▲' : '▼'}</h2>
            </button>
            {dishesOpen && (
              <div className="dishes-grid">
                {result.topDishes.map((d, i) => (
                  <div key={i} className="dish-card">
                    <span className="dish-cuisine">{d.cuisine}</span>
                    <span className="dish-name">{d.name}</span>
                    <span className="dish-region">{d.region}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 4. 操作按钮 */}
        <div className="result-actions">
          <button className="action-btn primary" onClick={onRestart}>
            <span>🔄</span> 重新测试
          </button>
          <button
            className="action-btn secondary"
            onClick={() => onCopy(generateShareText(result))}
          >
            <span>📋</span> 复制文案
          </button>
          <button className="action-btn primary" onClick={handleDownloadClick}>
            <span>💾</span> 保存结果图
          </button>
        </div>
      </div>
    </div>
  );
}

function generateShareText(r: AssembledResult): string {
  const top = r.allIntervals[0];
  const tag = top ? top.tierLabel : '味觉独特';
  const copy = r.allround?.copy || r.profileCopy || '';
  return `我的味觉灵魂是【${tag}】!${copy.slice(0, 40)} 你也来测一下?`;
}
