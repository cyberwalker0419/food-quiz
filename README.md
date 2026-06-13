# 味觉灵魂测试

> 一道一道题答下去,揭开你对美食的深层偏好 —— 你是哪一道中国菜系?

应用本体在 [`food-quiz/`](food-quiz/),技术规划见 [`pro.md`](pro.md)。

---

## 状态

项目**正在进行中**:核心代码已能跑通基础 60 题测试 + Pearson 相似度匹配 + 分享卡生成;同时,根据 [`pro.md`](pro.md) 的规划,正在向"8 中文味觉维度 + 256 区间文案 + 极档/联动/全能/避雷文案 + 菜品推荐"的新架构迁移。

| 模块 | 状态 |
|:---|:---:|
| 30/60 题自适应出题 | ✅ 已实现(旧版,Phase 2 将替换) |
| Pearson 中心化余弦匹配 | ✅ 已实现(旧版,Phase 3 将替换) |
| Canvas 分享卡 | ✅ 已实现(旧版,Phase 3 将替换) |
| 22 道中国菜系数据 | ✅ 已实现(旧版,Phase 5 将替换) |
| **Vitest 单元测试** | ✅ 已引入 |
| **8 中文味觉维度迁移** | ✅ 数据结构已就绪([pro.md § 一](pro.md)) |
| **单字母索引(keys.ts)** | ✅ 已实现([pro.md § 三·P3.4](pro.md)) |
| **200 题总库(8 维均衡)** | ✅ 已实现 + 4 硬约束全过 |
| **256 区间文案** | 🚧 文案资产待补([pro.md § 三·P3.4](pro.md)) |
| **极档/联动/全能/避雷文案** | 🚧 规划中([pro.md § 三·P3.5–P3.9](pro.md)) |
| **菜品推荐 + 折叠展开** | 🚧 规划中([pro.md § 三·P3.10](pro.md)) |

---

## 快速开始

```bash
cd food-quiz
npm install
npm run dev          # Vite dev server
npm run build        # tsc -b && vite build → dist/
npm run preview      # 预览 dist/
```

---

## 技术栈

| 类别 | 选型 |
|:---|:---|
| UI 框架 | React 19.2.6(函数组件 + Hooks) |
| 语言 | TypeScript ~6.0.2 |
| 构建 | Vite 8.0.12(Oxc 引擎) |
| 状态 | `useState` + `useCallback`(业务 < 10 个状态) |
| 样式 | 纯手写 CSS + CSS 自定义属性(无 Tailwind / Sass / CSS-in-JS) |
| 字体 | Google Fonts `Noto Sans SC` |
| 路由 | 无(4 phase 状态机) |
| Lint | ESLint 10.x + typescript-eslint + react-hooks 规则 |
| 测试 | 未引入 |
| 后端 | 无(数据 100% 内联,零网络请求) |

**生产依赖仅 2 个**:`react`、`react-dom`。

---

## 目录结构

```
是啊,吃什么呢/
├── README.md                       # 本文件
├── pro.md                          # 项目规划(算法/文案架构/重构路线)
└── food-quiz/                      # 应用本体
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.*.json
    ├── eslint.config.js
    ├── public/
    └── src/
        ├── main.tsx                # React 挂载点
        ├── index.css
        ├── App.tsx                 # 业务主组件(4 phase 状态机)
        ├── assets/                 # 图片/图标
        ├── data/
        │   ├── cuisines.ts         # 22 道中国菜系 + 八维口味向量
        │   └── questions.ts        # 151 道题(精简 30 / 完整 121)
        ├── utils/
        │   ├── adaptiveQuiz.ts     # 自适应选题器(早期/中期/末期三段)
        │   └── shareImage.ts       # Canvas 分享卡生成
        └── styles/
            └── App.css             # 全部样式(~1k 行)
```

---

## 算法与文案架构

完整设计见 [`pro.md`](pro.md)。这里只列**关键决策**和**单字母索引体系**。

### 1. 三层算法架构(当前实现)

| 层 | 入口 | 作用 |
|:---|:---|:---|
| **结果评估层** | `App.tsx:42-87` | 8 维口味向量 → Pearson 中心化余弦 → 22 菜系排序 |
| **动态出题层** | `utils/adaptiveQuiz.ts` | 早期纯随机 / 中期评分 / 末期强制 final |
| **题库调度层** | `App.tsx:110-153` | `buildSequence` 前向一次性建好题序 |

### 2. 规划中的新架构(8 中文味觉维度)

**核心转变**:

- 维度:`spicy/umami/sweet/sour/crunchy/tender/intense/light` → **`sour/sweet/bitter/spicy/salty/umami/crunchy/tender`**(酸甜苦辣咸鲜脆嫩)
- 标签:`基因码 ABCD-pq + 16 原型彩蛋` → **区间文案 + 极档文案 + 联动文案 + 全能文案 + 避雷指南** 五元结构
- 相似度:Pearson → **标准余弦 + 欧氏距离惩罚**
- 推荐:无独立模块 → **菜品推荐独立模块**,默认折叠在文案下方

### 3. 单字母索引体系(规划中,跨模块共享)

> 这是 pro.md 全篇约定的**唯一映射**,出题/评估/文案/菜品**全部走这一张表**。

| 位置 | 维度 | 字段名 | 单字母 | 含义 |
|:---:|:---:|:---:|:---:|:---:|
| 1 | 酸 | `sour` | **S** | 首字母 |
| 2 | 甜 | `sweet` | **T** | 首字母 |
| 3 | 苦 | `bitter` | **K** | 首字母 |
| 4 | 辣 | `spicy` | **L** | 首字母 |
| 5 | 咸 | `salty` | **I** | 第 2 字母,因「鲜」占 X 让位 |
| 6 | 鲜 | `umami` | **X** | 优先保留首字母 |
| 7 | 脆 | `crunchy` | **C** | 首字母 |
| 8 | 嫩 | `tender` | **N** | 首字母 |

- **大小写规则**:**大写 = 高档(> 60),小写 = 低档(≤ 60)**。极档(≥ 90)不改变字母大小写,只额外追加文案。
- **索引串**:`S T K L I X C N` 顺序固定 8 字符,如 `StKliXcN`(S=高酸,K=高苦,X=高鲜,其他低)。
- **存储文件名**(Windows NTFS 兼容):**3 位十进制序号** `000.json`–`255.json`,通过 `keyToIndex` / `indexToKey` 互转。
- 8 字母全部互异,保证 256 个组合串唯一。
- 实现见 [`food-quiz/src/lib/taste/keys.ts`](food-quiz/src/lib/taste/keys.ts)(规划中,当前尚未创建)。

### 4. 文案资产目录(规划中)

```
food-quiz/src/content/
├── questions/
│   └── questions.json              # 题库(15 题 / 一题多测)
├── intervals/                      # 256 条基础区间文案
│   ├── 000.json … 255.json
├── extreme/                        # 8 条极档特殊文案
│   ├── s.json / t.json / k.json / l.json / i.json / x.json / c.json / n.json
├── synergies/                      # 28 对联动文案 + 1 通用兜底
│   ├── _fallback.json
│   ├── l-x.json / s-t.json / k-i.json … (按字母对排序)
├── allround/                       # 全能文案(味觉端水大师分支)
│   ├── _index.json
│   └── 01.json … 04.json
├── avoid/                          # 避雷指南
│   ├── _index.json
│   └── s.json … n.json
└── dishes.json                     # 菜品推荐数据(独立模块)
```

**解耦原则**:5 个文案目录 + 菜品文件**互不引用**,均通过 `keys.ts` 共享单字母体系。删除任意一个 JSON 文件不影响其他模块。

### 5. 渲染顺序(规划中,完整版)

```
[联动文案]               ← synergies/, Top1+Top2 都高档时(未命中走 _fallback)
[八维图(雷达图)]          ← 永远显示;轴标签用 P3.4 索引位大小写渲染
[区间文案 ×8,按强度排序]   ← intervals/, 默认仅前 3(高档位按强度降序)
[极档特殊文案 ×k, k≤8]    ← extreme/<l>.json, ≥90 时叠加
[全能文案 ×1]              ← allround/, 仅 std<15 触发(替换 256 区间分支)
[避雷指南]                ← avoid/<l>.json, 永远显示
[▼ 推荐菜(可折叠)]        ← dishes.json, 永远显示(算法 Top N)
```

---

## 部署

`npm run build` 产物在 `food-quiz/dist/`,可托管到任意静态服务器:

| 平台 | 操作 |
|:---|:---|
| Vercel | 导入 Git → Framework: Vite |
| Netlify | `dist` 目录拖拽 |
| GitHub Pages | `vite build` → push `dist` |
| 阿里云 OSS | 上传 `dist/` → 开启静态托管 |
| 自建 Nginx | `root /var/www/food-quiz/dist;` |

---

## 性能基线

| 指标 | 数值 |
|:---|:---|
| 首屏 JS(gzipped) | < 200KB |
| 首屏 CSS | < 30KB |
| 首屏字体(Noto Sans SC) | ≈ 200KB |
| 首屏 TTI(4G) | < 1.5s |
| 60 题完整计算 | < 100ms(含 1.5s 计算屏动画) |

---

## 已知问题 / 改进方向

详见 [`pro.md` § 三·改进方向](pro.md) 与 § 四·已知算法缺陷(待迁移至 README)。

---

## 许可

MIT
