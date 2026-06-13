# CLAUDE.md — 味觉灵魂测试项目

## 项目概述

味觉灵魂测试 Web 应用——8 维自适应出题 → 8 维味觉图谱 + 区间/极档/联动/全能/避雷文案 + 菜品推荐。用户答题 20–45 题，通过自适应选题引擎精准探测 8 个维度偏好。

## 技术栈

| 类别 | 选型 |
|:---|:---|
| UI 框架 | React 19.2.6（函数组件 + Hooks） |
| 语言 | TypeScript ~6.0.2 |
| 构建 | Vite 8.0.12 |
| 状态 | `useState` + `useReducer` |
| 样式 | 纯手写 CSS（无框架） |
| 测试 | Vitest 4.x |
| 后端 | 无（数据 100% 内联，零网络请求） |
| 平台 | Windows 11 + Node + bash |

**生产依赖仅 2 个：** `react`、`react-dom`。

## 开发命令

```bash
cd food-quiz
npm install
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build → dist/
npm test           # vitest run (全部测试)
npm run lint       # ESLint
```

## 验证方式（重要）

> **不要使用 preview（浏览器预览）来验证代码改动。**
> **只通过以下命令验证：**
> ```bash
> npx vitest run       # 跑全部测试
> npx tsc -b --noEmit  # 类型检查
> npm run build        # 构建验证
> ```
> 仅在以上全部通过后才算验证完成。

## 核心架构

### 8 维味觉维度

| 位置 | 维度 | 英文字段名 | 单字母 | 中文名 |
|:---:|:---|:---|:---:|:---|
| 0 | 酸 | `sour` | **S** | 酸 |
| 1 | 甜 | `sweet` | **T** | 甜 |
| 2 | 苦 | `bitter` | **K** | 苦 |
| 3 | 辣 | `spicy` | **L** | 辣 |
| 4 | 咸 | `salty` | **I** | 咸 |
| 5 | 浓 | `rich` | **X** | 浓 |
| 6 | 脆 | `crunchy` | **C** | 脆 |
| 7 | 嫩 | `tender` | **N** | 嫩 |

**单字母索引串** `S T K L I X C N` 顺序固定，大小写编码高低档（大写=高，小写=低）。

### 三档文案层级（阈值，归一化后 [0, 100]）

| 档位 | 范围 | 非浓维档名 | 浓维档名 |
|:---:|:---:|:---|:---|
| 低档 | [0, 60] | 低X | 清淡 |
| 高档 | (60, 90) | 重X | 浓 |
| 极档 | [90, 100] | 重X ⚡极 | 口味重 ⚡极 |

### 五等级视觉层（A/B/C/D/E，每档 20 分）

| 档位 | 范围 | 视觉颜色 |
|:---:|:---:|:---|
| A | [80, 100] | 红 |
| B | [60, 80) | 橙 |
| C | [40, 60) | 蓝 |
| D | [20, 40) | 青 |
| E | [0, 20) | 灰 |

### 模块职责

| 模块 | 职责 |
|:---|:---|
| `lib/taste/types.ts` | TS 类型 + `ZERO_VECTOR` |
| `lib/taste/keys.ts` | `DIMS` / `letterToDim` / `letterToChinese` / `letterToTierLabel` / `valueToGrade` / `keyToIndex` / `indexToKey` |
| `lib/taste/normalize.ts` | Min-Max 归一化 `normalize()` + `std()`（re-export cosine/euclid from similarity） |
| `lib/taste/similarity.ts` | `cosineSim` + `euclideanDist` + `blendedScore` |
| `lib/taste/state.ts` | 答题状态机：`initialState` / `applyAnswer` / `undoLast` |
| `lib/taste/adaptiveSelector.ts` | 信息增益选题 + 硬性剪枝 + 停止判定 |
| `lib/taste/loaders.ts` | 5 文案目录 JSON 加载 + `dishes.json`，缺文件静默返回 null/[] |
| `lib/taste/result.ts` | `assembleResult(raw)` 主入口，完整渲染结构 |
| `components/ResultCard.tsx` | 结果页组件（默认前 3 条，展开全 8 维） |
| `utils/shareImage.ts` | Canvas 分享卡生成 |
| `content/questions/questions.json` | 200 题题库 |
| `content/questions/questions.schema.ts` | 题库校验器 |

## 硬编码规范

- **字段名一律 `rich`**（不用 `umami`）。`grep -r 'umami' food-quiz/src/` 应仅命中 schema 拒收测试。
- **中文字维名**仅出现在 `keys.ts` 和测试文件中。
- **5 个文案目录互不引用**，任意删一条 JSON 不影响其他模块。
- **归一化公式**：`v = 50 + 50 * raw / maxAbs`（值域真到 [0, 100]）。
- **5 等级 `grade`（视觉层）与三档 `tierLabel`（文案层）并行存在，互不替代。**

## 关键文档

| 文件 | 内容 |
|:---|:---|
| `pro.md` | 项目规划（算法/文案架构/重构路线） |
| `C:\Users\ROG\.claude\plans\d-rog-documents-github-pro-md-plan-pure-chipmunk.md` | **Master plan**（Phase 1–5 全部子 plan，是实现真相源） |
| `docs/superpowers/plans/phase2-adaptive-selector.md` | P2 子 plan |
| `docs/superpowers/plans/phase3-result-rendering.md` | P3 子 plan |
| `docs/superpowers/plans/phase3-work-log.md` | P3 工作日志（含决策记录） |

## Phase 进度

| Phase | 产物 | 状态 |
|:---|:---|:---:|
| P1 数据结构 + 8 字母索引 + 200 题总库 | `types/keys/loaders` + `questions.json` + schema + 4 硬约束 | ✅ |
| P2 动态出题引擎 | `state/adaptiveSelector` + App.tsx 单入口改造 | ✅ |
| P3 评估 + 渲染管线 | `similarity/result/loaders` + `ResultCard` + `shareImage` 重写 + A/B/C/D/E grade | ✅ |
| P4 文案物料批量生成 | `scripts/generate-copy.ts` + 5 目录 ~280 条 JSON 落盘 | ⏳ 待开工 |
| P5 菜品向量数据 | `dishes.json`（按省份覆盖） | ⏳ 待开工 |

## 用户偏好

- 验证时只用 `vitest run` + `tsc -b --noEmit` + `npm run build`，**不要使用 preview**
- 中文交流
