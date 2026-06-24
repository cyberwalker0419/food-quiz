# CLAUDE.md — 味觉灵魂测试（food-quiz）

> 本文件是 Claude Code 在此仓库工作时的**持久指令**。它是事实来源（source of truth），优先级高于
> `README.md` / `pro.md`（二者部分内容已过时，见文末「文档勘误」）。改代码前先读完本文件。

## 0. 一句话定位

纯前端、零网络请求的「中国味觉性格测试」：用户答 20–45 道自适应题 → 8 维味觉向量 → 雷达图 +
区间/联动/全能/避雷四类文案 + 菜品推荐 + Canvas 分享卡。生产依赖只有 `react` 和 `react-dom`。

---

## 1. 开发命令

```bash
cd food-quiz          # 应用本体在此子目录，所有 npm 命令都在这里执行
npm install
npm run dev           # Vite dev server（端口见 .claude/launch.json：5180）
npm run build         # tsc -b && vite build → dist/
npm run preview       # 预览 dist/
npm test              # vitest run（一次性跑全部单测）
npm run test:watch    # vitest watch
npm run lint          # ESLint（typescript-eslint + react-hooks + react-refresh）
```

**类型检查单独跑：** `npx tsc -b --noEmit`（`tsconfig.app.json` 开了 `noUnusedLocals` /
`noUnusedParameters` / `verbatimModuleSyntax`，类型很严，先过它再过 lint）。

---

## 2. 验证规范（重要，违反即返工）

> **算法 / 数据 / 类型改动：不要靠「打开浏览器看效果」来验证。** 本项目的算法核心 `src/lib/taste/`
> 是**纯函数 + 完整单测覆盖**的，正确性应当由测试断言保证，而不是肉眼。

改完代码后，按以下顺序验证，**全部通过**才算完成：

```bash
cd food-quiz
npx vitest run           # 1. 单元测试（含 questions schema / coverage / 形状校验）
npx tsc -b --noEmit      # 2. 类型检查
npm run build            # 3. 构建验证
```

- 纯逻辑（`lib/taste/*`、`utils/shareImage.ts`、`content/questions/*.schema.ts`）改动 →
  必须补 / 改对应 `*.test.ts`，不能只靠手点 UI。
- 只有**纯视觉 / CSS / 布局**改动，且单测覆盖不到时，才用 `npm run dev` + 浏览器预览核对。
- 新增 / 修改任何 `content/**/*.json` 文案后，确认 loader 的形状校验（`loaders.ts`）和
  schema（`questions.schema.ts`）仍通过——坏形状会被静默降级为 `null`，**不会报错**，要主动盯。

---

## 3. 技术栈与依赖约束

| 类别 | 选型 |
|:---|:---|
| UI 框架 | React 19.2.6（函数组件 + Hooks，**禁止 class 组件**） |
| 语言 | TypeScript ~6.0.2（`target: es2023`，`verbatimModuleSyntax`） |
| 构建 | Vite 8.0.12（Oxc） |
| 状态 | `useState` + `useCallback` + `useEffect`（业务态 < 10 个；状态机见 `App.tsx`） |
| 样式 | 纯手写 CSS + CSS 自定义属性（**无 Tailwind / Sass / CSS-in-JJS / UI 库**） |
| 字体 | Google Fonts `Noto Sans SC`（Canvas 分享卡强依赖其加载完成） |
| 测试 | Vitest 4.1.8 |
| 后端 | **无**（数据 100% 内联 JSON，零 fetch / 零 API） |
| 平台 | Windows 11 + Node + bash（用 Unix 语法，路径用正斜杠） |

**依赖红线：**
- **生产依赖只能有 `react`、`react-dom`。** 不引入状态库 / 路由库 / 工具库 / 图表库 / UI 库。
  想加任何 `dependencies` 前，先在回复里说明理由并征得同意。
- 图表（雷达图）和分享卡都用**原生 Canvas 2D** 手绘，不要换 `chart.js` / `recharts` / `html2canvas`。
- 数据全部内联（`import.meta.glob` 编译期打包）；**禁止**运行时网络请求。

---

## 4. 核心架构（三层）

```
src/
├── lib/taste/        ← 第 1 层：算法核心（纯函数，100% 单测覆盖）
├── content/          ← 第 2 层：解耦的 JSON 文案资产（互不引用）
├── components/       ← 第 3 层：React 展示组件（ResultCard / RadarChart）
├── utils/            ← 第 3 层：副作用工具（shareImage.ts = Canvas）
├── App.tsx           ← 第 3 层：4-phase 状态机（intro/quiz/calculating/result）
└── styles/App.css    ← 全部样式
```

**分层铁律：** 第 1 层不能 import 第 2/3 层；第 2 层 JSON 之间互不引用。只有第 3 层向下依赖。
算法改动只发生在第 1 层，必须配单测。

### 第 1 层 `lib/taste/` 模块职责

| 模块 | 职责 |
|:---|:---|
| `types.ts` | 类型 + `ZERO_VECTOR`（frozen 工厂）+ `sharpnessOf()` |
| `keys.ts` | **8 维单字母体系的唯一真相源**（见 §5） |
| `normalize.ts` | `normalize()` Min-Max → [0,100]；`std()` |
| `similarity.ts` | `cosineSim` / `euclideanDist` / `blendedScore` |
| `state.ts` | 不可变答题状态机：`initialState` / `applyAnswer` / `undoLast` |
| `adaptiveSelector.ts` | 自适应选题引擎：`pickNextQuestion` / `shouldStop` 等 |
| `result.ts` | **主入口** `assembleResult(raw)` → `AssembledResult` 渲染结构 |
| `loaders.ts` | 5 类文案 + dishes 的 JSON loader（缺文件返回 `null`/`[]`，永不抛错） |
| `radarChart.ts` | `drawRadarChart()` 纯绘制函数 + `GRADE_COLORS`（React 组件与分享卡共用） |

> 注意：`normalize.ts` 末尾 re-export 了 similarity 的三个函数，仅为向后兼容；新代码请直接
> 从 `similarity.ts` 导入。

### App.tsx 状态机

`intro` →（开始）→ `quiz` →（答完或 `shouldContinue=false`）→ `calculating`（1.5s 计算屏动画）
→ `result`。`quiz` 内部：每答一题用 `useEffect` 触发 `pickNextQuestion` 出下一题；支持「上一题」
（`undoLast`，回退后改答会丢弃后续答案）。

---

## 5. 8 维单字母体系（最关键的约定，跨模块共享）

> 这是全项目的**唯一映射**：出题 / 评估 / 文案 / 菜品**全部走这一张表**。
> 真相源 = [`food-quiz/src/lib/taste/keys.ts`](food-quiz/src/lib/taste/keys.ts) 的
> `DIMS` / `DIM_FIELDS` / `DIM_CHINESE`。**顺序固定，不可重排。**

| 位 | 维度 | 英文字段名 | 单字母 | 中文 |
|:--:|:--|:--|:--:|:--|
| 0 | 酸 | `sour` | **S** | 酸 |
| 1 | 甜 | `sweet` | **T** | 甜 |
| 2 | 苦 | `bitter` | **K** | 苦 |
| 3 | 辣 | `spicy` | **L** | 辣 |
| 4 | 咸 | `salty` | **I** | 咸（取第 2 字母，因「浓」占了 X） |
| 5 | 浓 | **`rich`** | **X** | 浓 |
| 6 | 脆 | `crunchy` | **C** | 脆 |
| 7 | 嫩 | `tender` | **N** | 嫩 |

**硬约束：**
- **第 5 位字段名一律 `rich`（浓），禁止 `umami` / `鲜`。** `questions.schema.ts` 会拒收任何
  非 8 维字段名（含 `umami`）；`grep -rn 'umami' food-quiz/src/` 理应只命中 schema 拒收测试。
- **8 字母全部互异**，保证 256 组合串唯一。
- 中文字名（「浓」而非「鲜」）只允许出现在 `keys.ts` 与测试里，不要散落到文案 JSON 或组件。

**大小写编码（256 文件名的来源）：**
- **大写 = 高档（>60），小写 = 低档（≤60）。**
- 索引串顺序固定为 `S T K L I X C N`，如 `StKliXcN`。
- `keyToIndex(key)`：S 是 bit7（MSB）… N 是 bit0，大写→1、小写→0，拼成 8 位二进制 → 0–255。
- 存储文件名用 **3 位十进制** `000.json`–`255.json`（**Windows NTFS 大小写不敏感，必须用数字名，
  不能用字母串作文件名**），经 `keyToIndex` / `indexToKey` 互转。

---

## 6. 两套并行的档位系统（极易混淆，务必分清）

| | **两档文案层** | **五档视觉层** |
|:--|:--|:--|
| 函数 | `letterToTierLabel(letter, score)` | `valueToGrade(value)` |
| 类型 | 返回 `string` | 返回 `Grade`（`'A'.. 'E'`） |
| 用途 | **驱动文案选择**与文案里的档位标签 | **驱动雷达 / bar / 徽章的颜色**（`GRADE_COLORS`） |
| 分档 | 低档 ≤60 / 高档 >60 | A[80,100] B[60,80) C[40,60) D[20,40) E[0,20] |
| 浓维(X)特例 | 清淡 / 浓（其余维：低X / 重X） | 无特例 |

**二者并行存在，互不替代。** 改其中一个的阈值时，想清楚影响的是文案还是颜色。

---

## 7. 关键阈值常量（散落在各模块，改动时连带影响）

| 常量 | 值 | 位置 | 含义 |
|:--|:--|:--|:--|
| `MIN_QUESTIONS` | 20 | adaptiveSelector | 最少题数 |
| `MAX_QUESTIONS` | 45 | adaptiveSelector | 最多题数 |
| `HIGH_THRESHOLD` | 60 | result | 高档 / 区间文案 / 联动触发线 |
| `STD_ALLROUND` | 15 | result | std < 15 → 触发「全能味觉」文案，替换 256 区间分支 |
| `DEFAULT_TOP_N_INTERVALS` | 3 | result | 默认显示前 3 条区间文案 |
| `DEFAULT_TOP_N_DISHES` | 5 | result / 卡片实际画 3 | 推荐菜 Top N |
| `PRUNE_THRESHOLD` | -30 | adaptiveSelector | raw ≤ −30 → 该维剪枝（用户极度排斥） |
| `STOP_EPSILON` | 0.5 | adaptiveSelector | 信息增益阈值 |
| 归一化 | `v = 50 + 50*raw/maxAbs`，clamp [0,100] | normalize | maxAbs 默认 = max(1, max|raw|) |
| 混合相似度 | `0.5·cos + 0.5·1/(1+dist)` | similarity | 菜品打分用 |

**联动触发**：Top1 与 Top2 维度都 > 60 才生成 `synergy`（否则 `synergy = null`）。
**避雷**：永远显示，取**最低分维度**对应的 `avoid/<l>.json`。

---

## 8. 文案资产目录与解耦原则

```
src/content/
├── questions/questions.json     # 200 题总库 + schema + loader（加载期即校验，失败 fail-fast）
├── intervals/                   # 256 条区间文案（000.json … 255.json，对应 8 位高低组合）
├── synergies/                   # 10 个字母对 + 1 个 _fallback（未命中走兜底模板，永不 null）
├── allround/                    # _index.json + 01..04（std<15 时随机抽一条）
├── avoid/                       # _index.json + s..n.json（永远显示）
└── dishes.json                  # 菜品向量库（196 道，~30 个菜系/区域）
```

> 注：`extreme/` 目录曾是极档文案资产（≥90 触发额外警告区），2026-06 已将极档合并入高档、去除
> 极档警告子系统，该目录文件保留为死资产不再被代码引用；`scripts/` 生成逻辑同步未再使用。

**解耦铁律（来自 master plan）：**
- 5 个文案目录 + `dishes.json` **互不引用**，统一通过 `keys.ts` 共享单字母体系。
- **删除任意一个 JSON 文件不得影响其他模块** —— loader 返回 `null`/`[]`，`result.ts` 与
  `ResultCard.tsx` 的对应 section 静默不渲染，绝不抛错。
- `assembleResult()` 是**容错**的：任何模块缺失都不抛错。

**生成方式**：文案由 [`scripts/generate-content.mjs`](scripts/generate-content.mjs) 批量生成落盘；
[`scripts/strip-brackets.mjs`](scripts/strip-brackets.mjs) 去除文案中的【】等括号。原始 LLM
提示词存于 [`food-quiz/prompts/`](food-quiz/prompts/)。改文案请走脚本 + 提示词，不要手抠 JSON。

---

## 9. 渲染顺序（ResultCard.tsx 与 shareImage.ts 必须一致）

```
1. 联动文案 synergy        ← 仅 Top1+Top2 都 >60（未命中则不渲染）
2. 8 维雷达图              ← 永远显示；轴标签 = 中文 + grade 徽章
3. 区间文案 / 全能文案     ← std<15 显示 allround，否则显示 intervals（默认前 3，可展开全 8）
4. 避雷指南 avoid          ← 永远显示（最低分维）
5. 推荐菜 topDishes        ← 永远显示（默认折叠）
6. 操作按钮                ← 重新测试 / 复制文案 / 保存结果图
```

分享卡（Canvas 540×960，JPEG 0.85）按相同信息层级绘制，两处改动要同步。分享卡字体
`preloadShareCardFonts()` 在 `App` 挂载时预载（带 2.5s 超时），否则 Noto Sans SC 未就绪会画成空白方块。

---

## 10. 代码规范与约定

- **纯函数优先**：`lib/taste/` 全是纯函数、无副作用、不读 DOM。状态变更走 `state.ts` 的不可变
  转换（`applyAnswer` / `undoLast` 返回**新** state）。
- **类型导入**：`verbatimModuleSyntax` 已开，引入类型必须 `import type {…}`，混用会报错。
- **权重语义**：`QuizOption.weights` 正值=加分、负值=减分（用于「我讨厌…」的探测与剪枝）、
  `0`=不更新。选项权重里**必须含齐 8 维**（schema 强制），未知键被拒。
- **题目犀利度**：`sharpnessOf(q)` = 选项数 2 → `sharp`（精准探测/推剪枝），3-4 → `smooth`（建基线）。
- **可复现**：选题用 `mulberry32(seed)` 确定性 RNG（同一 seed 同一序列），测试可断言。
- **去重**：adaptiveSelector 有四级去重（完全重复 / 覆盖重合 / stem 软惩罚 / 全局窗口）+
  矛盾追问豁免。改选题逻辑前先读懂这层，否则会退回「重复抽到前期题」的旧问题。
- **fail-fast vs 容错**：题库 schema 在**模块加载期**校验（开发期尽早炸）；文案 loader **容错**
  （运行期静默降级）。两者刻意不同，不要统一。
- **注释密度**：跟周围代码保持一致——本仓中文注释密集、JSDoc 详尽，新代码照此风格。
- **命名**：维度用英文驼峰字段名（`rich`…），展示用中文（经 `letterToChinese`）。

---

## 11. 反模式 / 禁止事项（DO NOT）

- ❌ 用 `umami` / `鲜` 作为第 5 维字段名或中文名（**只能 `rich` / 浓**）。
- ❌ 在 `lib/taste/` 里 import React、DOM、`content` 组件；纯函数层不许有副作用依赖。
- ❌ 让文案目录之间互相 import；或让 `result.ts` 在缺文件时抛错（必须降级）。
- ❌ 把 256 区间文件存成字母串文件名（NTFS 大小写不敏感会撞名）；只能用 `000`–`255` 数字名。
- ❌ 引入任何运行时网络请求、或 `dependencies` 里加第三个包。
- ❌ 用 class 组件、Tailwind、Sass、图表库、UI 库。
- ❌ 改完算法不补 / 不跑单测就拿浏览器预览当验证（见 §2）。
- ❌ 把 `noUnusedLocals` / `noUnusedParameters` 报错用 `// eslint-disable` 绕过——删掉死代码。
- ❌ 手改批量文案 JSON；走 `scripts/` 生成 + `prompts/` 提示词。

---

## 12. 目录结构速查

```
是啊，吃什么呢/
├── CLAUDE.md                # ← 本文件
├── README.md                # 项目说明（部分内容已过时，见 §13）
├── pro.md                   # 项目规划（算法/文案架构/重构路线，历史规划）
├── algorithm.md / 技术栈.md  # 设计笔记
├── docs/superpowers/plans/  # 各 Phase 工作日志与子 plan（phase2-6）
├── scripts/                 # 文案批量生成 + 括号清理脚本（含 .test.ts）
└── food-quiz/               # 应用本体（所有 npm 命令在此执行）
    ├── .claude/launch.json  # dev server 配置
    ├── index.html / vite.config.ts / tsconfig.*.json / eslint.config.js
    ├── prompts/             # 生成文案用的 LLM 提示词（题库 v5/v6、菜品库）
    └── src/                 # 见 §4 三层架构
```

---

## 13. 文档勘误（已知过时项，以代码为准）

- `README.md` 把第 5 维写成 `umami`/鲜 → **实际是 `rich`/浓**。
- `README.md` / 旧记录称菜品 85 道 → **实际 `dishes.json` 有 196 道**。
- README 目录结构里 `utils/adaptiveQuiz.ts`、`data/` 目录是旧版残留 → 现已迁移到 `lib/taste/`
  + `content/`，旧路径不存在。
- 遇到 README/pro.md 与代码冲突，**一律以代码 + 本文件为准**，并可顺手修正文档。

---

## 14. 工作偏好

- 用**中文**交流。
- 改动遵循 §2 的验证流水线；纯逻辑改动配单测。
- 涉及破坏性或外向动作（删文件、强推、改公共数据结构）前先确认。
