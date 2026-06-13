# P6 工作日志

**时间**: 2026-06-14
**状态**: ✅ 完成

## 目标

解决 4 个用户反馈问题:
1. 题目重复(全程,需"追问"策略)
2. 题目选项含"(xx派)"等括号
3. 8 维图用雷达图(替换 bar)
4. 分享卡保存慢(720×1280 PNG → 540×960 JPEG + 字体超时)

## 变更文件清单

### P6.1 — 题目选项去所有括号
| 文件 | 说明 |
|:---|:---|
| `scripts/strip-brackets.mjs` | 新建:用 regex `[(（][^()（）]*[)）]` 删除所有中英文半全角括号内容 |
| `scripts/strip-brackets.test.mjs` | 新建:14 个参数化测试 |
| `food-quiz/src/content/questions/questions.coverage.test.ts` | 追加:`所有 label 不含括号` + `犀利/平滑题分布` |

(注:questions.json 实际上在 P5 后已被清理过,本 PR 主要是固化"无括号"基线)

### P6.2 — 选题:追问 + 犀利度分层
| 文件 | 说明 |
|:---|:---|
| `food-quiz/src/lib/taste/types.ts` | 新增 `Sharpness` type + `sharpnessOf()` 派生函数 |
| `food-quiz/src/lib/taste/adaptiveSelector.ts` | 重写 `pickNextQuestion`:`topicVector` + `signatureSim` + `lowResponseDims` + `sharpnessWeight` + `isExactDuplicate` |
| `food-quiz/src/lib/taste/adaptiveSelector.test.ts` | 追加 15 个 P6.2 专项测试 |

**犀利度分层**:
- `sharpnessOf(q) = options.length === 2 ? 'sharp' : 'smooth'`
- 早期 (count<10):60% 选 smooth(建基线)
- 后期 (count≥20):60% 选 sharp(精准探测 + 推动剪枝)
- 中期 (10~20):线性过渡

**追问策略**:
- 算最近 5 题的"低响应维度"(每维 |profile 增量| 末 4 位)
- 候选评分:`gain * (0.6 + 0.4 * sharpness) + gain * 0.3 * lowCover + lowCover * 5`
- **不**跳过相似题,而是优先选"覆盖低响应维"的题

**完全重复过滤**:
- 与最近 2 题主题向量余弦 ≥ 0.98 → 跳过
- 兜底:全被过滤 → 退化随机

### P6.3 — 8 维雷达图
| 文件 | 说明 |
|:---|:---|
| `food-quiz/src/lib/taste/radarChart.ts` | 新建:Canvas 2D 纯函数,React + 分享卡共享 |
| `food-quiz/src/components/RadarChart.tsx` | 新建:HiDPI 自适应 React 组件 |
| `food-quiz/src/components/ResultCard.tsx` | 替换 8 维 bar → `<RadarChart size={320}>` + `<details>` 明细列表 |
| `food-quiz/src/lib/taste/radarChart.test.ts` | 新建:9 个 mock Canvas 2D 测试 |
| `food-quiz/src/utils/shareImage.ts` | 同步:8 维 bar 段 → 雷达图 |
| `food-quiz/src/styles/App.css` | 新增 `.radar-wrap` `.radar-chart` `.dimension-list` `.dim-list` `.dim-grade` 样式 |

**绘制逻辑**:
1. 5 圈同心八边形网格(20/40/60/80/100)
2. 8 条轴线(12 点钟起,逆时针)
3. 8 个轴标签(`酸 甜 苦 辣 咸 浓 脆 嫩`)
4. 数据多边形(径向渐变填充,顶点按 letter → DIMS 索引重排)
5. 8 个数据点(按 grade A/B/C/D/E 染色)
6. 等级环刻度标签

### P6.4 — 分享卡性能
| 文件 | 说明 |
|:---|:---|
| `food-quiz/src/utils/shareImage.ts` | 三处优化 |
| `food-quiz/src/utils/shareImage.test.ts` | 新建:5 个 mock Canvas 测试 |

**改动**:
- 尺寸 720×1280 → **540×960**(像素降 43%)
- 字体加载加 **2.5s 超时**(`Promise.race([loadAll, timeout])`)
- `toBlob` PNG → **`image/jpeg` 0.85**(文件降 4-8×,编码快 3-5×)
- 文件名后缀 `.jpg`
- 字体/坐标按新尺寸等比缩放

## 验证

- ✅ `npx vitest run` — 13 文件 / 158 用例全过
- ✅ `npx tsc -b --noEmit` — 0 error
- ✅ `npm run build` — 0 error,gzipped 79.32 KB(略增 0.4 KB 可接受)
- ✅ 题目选项无任何中英文括号
- ✅ 雷达图渲染 5 圈 + 8 轴 + 8 中文标签 + 8 数据点
- ✅ 分享卡 540×960 JPEG 0.85

## 关键决策

**D-P6.1**:**所有括号都删**(不只派系后缀) — 用户明确指示,简单粗暴
**D-P6.2**:**追问 ≠ 跳相似题** — 相似题反而优先,只要主题向量覆盖"低响应维"
**D-P6.2**:**犀利度 = options.length 派生**,不改 schema
**D-P6.3**:**雷达图用 Canvas(与 shareImage 一致)**,不用 SVG
**D-P6.3**:`allIntervals` 已按"与 50 距离"降序 → 必须按 letter → DIMS 索引重排
**D-P6.4**:**保留字体加载逻辑**(仅加超时),而非完全移除 — 中文字体没准备 fallback

## 提交

单次 commit(待 push):
```
fix(ux): radar chart, dedup-via-followup, sharp/smooth tier, jpeg share card, strip all brackets
```
