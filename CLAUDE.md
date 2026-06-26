# CLAUDE.md — 味觉灵魂测试（food-quiz）

> 本文件是 Claude Code 在此仓库工作的持久指令，每个 session 全量加载。简短、具体、可验证。
> 深度信息（部署、阈值表、菜品算法细节）请查 README.md 与 docs/，本文件不重复，只给指针。

## 项目定位（WHAT / WHY）

纯前端、**零网络请求**的「中国味觉性格测试」：答 25–45 道自适应题 → 8 维味觉向量 →
雷达图 + 味觉特征长评价 + 跨菜系推荐菜 + Canvas 国风分享卡。所有数据编译期内联打包，无 fetch / 无 API / 无后端。

应用本体在 `food-quiz/` 子目录，**所有 npm 命令都在该子目录执行**。

## 技术栈与依赖红线

| 类别 | 选型 |
|:--|:--|
| UI | React 19（函数组件 + Hooks，**禁止 class 组件**） |
| 语言 | TypeScript ~6.0（`target: es2023`，`verbatimModuleSyntax`） |
| 构建 | Vite 8（Oxc） |
| 状态 | `useState` + `useCallback` + `useEffect`（业务态极少；4-phase 状态机见 `src/App.tsx`） |
| 样式 | 纯手写 CSS + CSS 自定义属性（**无 Tailwind / Sass / CSS-in-JS / UI 库**） |
| 图表 / 分享卡 | **原生 Canvas 2D 手绘**（`radarChart.ts` / `shareImage.ts`），禁用 chart.js / recharts / html2canvas |
| 测试 | Vitest 4 |
| 平台 | Windows 11 + bash（用 Unix 语法、正斜杠路径） |

**生产依赖只能有 `react`、`react-dom`**。引入任何新 `dependencies`（状态库 / 路由库 / 工具库 / 图表库 / UI 库）
前，先在回复里说明理由并征得同意。运行时网络请求一律禁止。

## 开发命令（HOW）

```bash
cd food-quiz
npm install
npm run dev          # Vite dev server（端口见 .claude/launch.json）
npm run build        # tsc -b && vite build → dist/
npm run lint         # ESLint（typescript-eslint + react-hooks + react-refresh）
npx vitest run       # 一次性跑全部单测
```

## 验证规范（重要，违反即返工）
算法核心 `src/lib/taste/` 是纯函数 + 完整单测覆盖，
正确性应由测试断言保证。改完代码按顺序跑，**全部通过**才算完成：

```bash
cd food-quiz
npx vitest run        # 1. 单元测试（含 questions schema / coverage / 形状校验）
npx tsc -b --noEmit   # 2. 类型检查（开了 noUnusedLocals / noUnusedParameters，很严）
npm run build         # 3. 构建验证
```

- 纯逻辑（`lib/taste/*`、`utils/shareImage.ts`、`content/questions/*.schema.ts`）改动 → 必须补 / 改对应 `*.test.ts`。
- **预览规则：重大改动（新功能 / 架构 / 视觉重做）可用浏览器预览核对；小改动 / 优化一律靠上面三件套，不要起 dev server 预览。**
- 新增 / 修改 `content/**/*.json` 后，确认 loader 形状校验（`loaders.ts`）和 schema（`questions.schema.ts`）仍过——
  坏形状会被静默降级为 `null`，**不报错**，要主动盯。

## 三层架构（分层铁律）

```
food-quiz/src/
├── lib/taste/     ← 第 1 层：算法核心（纯函数，100% 单测）。算法改动只发生在这里
├── content/       ← 第 2 层：解耦的 JSON 文案资产（5 目录 + dishes.json 互不引用）
├── components/    ← 第 3 层：React 组件（ResultCard / RadarChart / RandomDish）
├── utils/         ← 第 3 层：副作用工具（shareImage.ts = Canvas）
├── App.tsx        ← 第 3 层：intro/quiz/calculating/result 四阶段状态机
└── styles/App.css
```

**铁律：** 第 1 层不能 import 第 2/3 层；第 2 层 JSON 之间互不引用。删除任一文案 JSON 不影响其他模块
（loader 返回 null/[]，对应 section 静默不渲染）。`lib/taste/keys.ts` 是 **8 维单字母体系的唯一真相源**：

| 字段 | sour | sweet | bitter | spicy | salty | rich | crunchy | tender |
|:--|:--|:--|:--|:--|:--|:--|:--|:--|
| 字母 | S | T | K | L | I | X | C | N |

> 第 5 位字段名一律 `rich`（浓），禁 `umami` / `鲜`；8 字母互异保证 256 组合串唯一。

## 文案流程（改结果文案必读）

改任何结果 / 区间 / 联动文案，**必须走 humanizer-zh 去痕迹 + 既定脚本 pipeline**，不能直接手写裸文案。
intervals 文案编号对应 8 位字母串（`000.json` … `255.json`）→ profileLabel / profileCopy。
极档警告、避雷指南已分别于 2026-06 合并入高档 / 下线（数据保留备查），新文案不要再写这两类。

## 工作约定

- 中文交流。
- 破坏性 / 外向动作（删文件、强推、改公共数据结构、改 8 维体系）前先确认。
- 深度参考：`README.md`（部署 / 性能基线 / 阈值表 / 渲染顺序）、`docs/superpowers/plans/`（各阶段工作日志）。

## mmx 工具（仅作 Claude Code 内置搜索/图像理解的替代）

mmx 是 MiniMax 官方 CLI（`npm i -g mmx-cli`），注册于 `~/.mmx/config.json`，region = `cn`。
在 Claude Code 中**不是 MCP** —— 需通过 Bash 调 `mmx <resource> <command>`。**配额独立计费**（mmx TokenPlan，与 Claude Code 配额池不同）。

**用途范围（明确边界）**：

| 用途 | 命令 | 替代的内置工具 |
|:--|:--|:--|
| 网页搜索（菜品事实核查、清真/素食属性、少数民族饮食禁忌等） | `mmx search query "..."` | `WebSearch` / `WebFetch` |
| 图像理解（截图分析、UI 校对、Canvas 渲染抽查） | `mmx vision describe <img>` | 内置 vision |

**不用于**：`text` / `image` / `video` / `music` / `speech` / `file`（避免吃 Claude Code 配额以外的 token）。
**优先级**：能走 Claude Code 内置 `Read` 就走内置；只有内置不可用（WebSearch 400/429、WebFetch 域名被拦截）才退回 mmx。

**节流**：批量核查用 `--output json` 一次拿多条；不要对每道菜单独调一次。
**失败处理**：`mmx search` 失败 → 退回基于已有知识的判断 + 在 commit message / plan 里标注"未联网核实"。
