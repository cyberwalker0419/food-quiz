# 味觉灵魂测试 · 你的味觉灵魂是什么？

> 一道一道题答下去，揭开你对美食的深层偏好 —— 22 道中国菜系里的"你"是哪一个？

## 在线体验

应用本体在 [`food-quiz/`](food-quiz/) 目录。打开 [`food-quiz/README.md`](food-quiz/README.md) 查阅完整的开发 / 构建说明。

## 项目结构

```
是啊，吃什么呢/
├── README.md                 # 本文件 —— 项目说明、技术栈、菜系数据
├── 技术栈.md                  # 详细技术决策（架构、选型、依赖）
└── food-quiz/                # 应用本体（React + TypeScript + Vite）
    ├── src/
    │   ├── App.tsx           # 业务主组件（4 个 phase 状态机）
    │   ├── data/
    │   │   ├── cuisines.ts   # 22 道菜系定义 + 八维口味向量
    │   │   └── questions.ts  # 150 道题（精简版 30 / 完整版 60）
    │   ├── utils/
    │   │   ├── adaptiveQuiz.ts   # 自适应选题器
    │   │   └── shareImage.ts     # Canvas 分享卡生成
    │   └── styles/App.css
    ├── package.json
    └── ...
```

---

## 一、技术栈

### 1. 核心栈

| 类别 | 选型 | 版本 |
| --- | --- | --- |
| UI 框架 | **React** | 19.2.6 |
| 语言 | **TypeScript** | ~6.0.2 |
| 构建工具 | **Vite** | 8.0.12（Oxc 引擎） |
| 状态管理 | React `useState` + `useCallback` | — |
| 路由 | 无（4 phase 状态机代替） | — |
| 部署 | 静态文件（`food-quiz/dist/`） | — |

### 2. 样式

- 纯手写 CSS，CSS 自定义属性集中定义
- 动画：CSS `@keyframes` + `transform` / `opacity`（compositor 友好）
- 字体：Google Fonts `Noto Sans SC`
- 零 UI 框架（无 Tailwind / styled-components / Sass）

### 3. 工具链

| 工具 | 用途 |
| --- | --- |
| ESLint 10.x | 语法 / 未使用变量 |
| typescript-eslint | TS 规则 |
| eslint-plugin-react-hooks | Hook 规则 |
| Vite | Dev server / bundler（Oxc 转译） |

### 4. 关键能力

| 能力 | 文件 | 说明 |
| --- | --- | --- |
| 自适应题目序列 | `food-quiz/src/utils/adaptiveQuiz.ts` | 已答 → 8 维口味向量 → 候选题打分（触发器 + 类目覆盖 + 随机噪声）|
| 菜系匹配 | `food-quiz/src/App.tsx:42-70` | **Pearson 中心化余弦相似度**（不是欧氏距离）|
| 分享卡 | `food-quiz/src/utils/shareImage.ts` | Canvas 2D 绘制 → PNG 导出 / Web Share API |
| 上一题 | `food-quiz/src/App.tsx` `goToPreviousQuestion` | 返回时高亮之前选项 |
| 八维向量可视化 | 结果页 `profile-bars` | 8 个维度按强度展示 |

### 5. 依赖

**生产依赖（仅 2 个）**

```json
{ "react": "^19.2.6", "react-dom": "^19.2.6" }
```

**网络依赖（运行时）**

- `fonts.googleapis.com` — `Noto Sans SC` 字体
- `fonts.gstatic.com` — 字体实际文件

**零后端 API / 零 CDN 业务资源**（除字体外）。

### 6. 构建 & 运行

```bash
cd food-quiz
npm install
npm run dev      # Vite dev server
npm run build    # = tsc -b && vite build
npm run preview  # 预览 dist/
```

详细决策记录见 [`技术栈.md`](技术栈.md)。

---

## 二、八维口味向量

每道菜系用一个 **8 维口味向量** 描述其"形状"（不是绝对数值，而是用户口味的形状）：

| 维度 | 含义 |
| --- | --- |
| `spicy` | 辣度 |
| `umami` | 鲜度 |
| `sweet` | 甜度 |
| `sour` | 酸度 |
| `crunchy` | 脆度 |
| `tender` | 嫩度 |
| `intense` | 浓烈度 |
| `light` | 清淡度 |

**取值范围**：约 `-3 .. 10`，分数越正越突出。`light` 与 `intense` 互为对照：`light` 高意味着口感偏清淡本味。

### 1. 传统八大菜系

| 菜系 | emoji | spicy | umami | sweet | sour | crunchy | tender | intense | light |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 川菜 | 🌶️ | 9 | 6 | 2 | 2 | 5 | 8 | 9 | 1 |
| 粤菜 | 🥟 | 1 | 9 | 5 | 2 | 2 | 9 | 2 | 9 |
| 鲁菜 | 🥘 | 1 | 8 | 4 | 4 | 4 | 5 | 7 | 3 |
| 苏菜 | 🍮 | 1 | 5 | 8 | 4 | 2 | 8 | 4 | 5 |
| 浙菜 | 🍵 | 1 | 8 | 5 | 6 | 7 | 8 | 4 | 8 |
| 闽菜 | 🦐 | 1 | 9 | 5 | 6 | 4 | 8 | 4 | 7 |
| 湘菜 | 🔥 | 8 | 6 | 2 | 7 | 3 | 5 | 8 | 1 |
| 徽菜 | 🍄 | 1 | 5 | 2 | 2 | 2 | 7 | 7 | 2 |

### 2. 地方 / 民族 / 港澳台菜

| 菜系 | emoji | spicy | umami | sweet | sour | crunchy | tender | intense | light |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 东北菜 | 🥟 | 2 | 8 | 3 | 5 | 4 | 7 | 8 | 2 |
| 陕西菜 | 🍜 | 7 | 5 | 1 | 8 | 6 | 4 | 7 | 1 |
| 湖北菜 | 🐟 | 5 | 8 | 2 | 3 | 5 | 8 | 5 | 6 |
| 云南菜 | 🌿 | 5 | 8 | 2 | 7 | 7 | 8 | 5 | 5 |
| 贵州菜 | 🐟 | 8 | 6 | 2 | 8 | 4 | 5 | 7 | 2 |
| 客家菜 | 🍲 | 3 | 9 | 4 | 5 | 3 | 8 | 7 | 3 |
| 潮汕菜 | 🥩 | 1 | 10 | 3 | 2 | 5 | 9 | 4 | 7 |
| 京菜 | 🦆 | 1 | 8 | 3 | 2 | 5 | 7 | 6 | 4 |
| 新疆菜 | 🥩 | 2 | 5 | 2 | 2 | 5 | 7 | 5 | 2 |
| 藏菜 | 🏔️ | 2 | 5 | 2 | 2 | 5 | 5 | 4 | 4 |
| 壮菜 | 🌺 | 5 | 5 | 2 | 7 | 5 | 5 | 4 | 4 |
| 蒙古菜 | 🐑 | 2 | 7 | 2 | 3 | 4 | 8 | 6 | 2 |
| 港式 | 🍵 | 1 | 8 | 7 | 2 | 4 | 8 | 5 | 5 |
| 台湾菜 | 🧋 | 2 | 6 | 6 | 4 | 5 | 6 | 4 | 6 |

**设计要点**：

1. **形状比绝对值重要**：粤菜 / 潮汕菜的 `umami` 都极高（9~10），但 `light` 不同 —— 用户偏好和形状对比时相似度才合理。
2. **强烈-清淡互斥**：`intense` 与 `light` 互为反向指标，烤鸭 / 红烧肉偏前者，清蒸鱼偏后者。
3. **可扩展**：加新菜系只需在 `food-quiz/src/data/cuisines.ts` 的 `cuisines` 数组里追加一条。

---

## 三、匹配算法

**Pearson 中心化余弦相似度**（不是欧氏距离）：

```
similarity(user, cuisine) = Σ (a_i - ā)(b_i - b̄) / √(Σ (a_i - ā)² · Σ (b_i - b̄)²)
```

**为什么不是欧氏距离**：

- 用户选"清淡蒸菜"profile ≈ `{spicy:0, umami:2, sweet:1, sour:1, crunchy:0, tender:2, intense:-3, light:3}`
- 用户选"重辣火锅"profile ≈ `{spicy:3, umami:1, sweet:0, sour:0, crunchy:1, tender:2, intense:3, light:-2}`

欧氏距离对**小幅度偏好**区分力差 —— 中性菜系（藏菜、新疆菜）profile 较平，会被小幅偏好用户拉近。Pearson 把"口味形状"做对比，识别"方向性"相似（爱辣但不爱酸 vs 都爱清淡）。

---

## 四、待解决的问题

按"影响大小"排序：

### 4.1 算法层面

- [ ] **`seed` 未真正生效**：`Math.random()` 仍主导，加 seed 只是参数透传。需用 `mulberry32` 替代所有 `Math.random()`，让"同一 seed 同一序列"成为可重现承诺。
- [ ] **平坦 profile 被推为第一**：藏菜 / 徽菜 / 新疆菜 / 蒙古菜 profile 较平，Pearson 在中心化后接近 0 相似度，偶尔会因随机噪声被推到首位。考虑加偏置项或最小阈值。
- [ ] **缺乏"反向题"**：题库没识别"用户对 X 强烈排斥"的信号，只能识别"用户喜欢 X"。可加 5 道反向题（如"绝对不能接受的食材"）。
- [ ] **题库偏置**：当前 150 道题在不同 category 上分布不均（`daily` 多，`culture-deep` 少），导致"早期阶段"类别覆盖有偏。

### 4.2 体验 / 交互

- [ ] **"上一题"功能完善**（部分完成）：已实现返回高亮，但若用户改了答案，后续题目不会重新触发自适应重排 —— 后续题目和"新答案"不完全匹配。可考虑持久化 swap 历史支持完整撤销。
- [ ] **缺 15 题"体验版"模式**（用户已确认需求）：精简版 30 题仍偏长。
- [ ] **题库扩充到 200+**（用户已确认需求）：提升重玩价值。
- [ ] **进度条可点击跳转**：当前进度条只展示，不支持点 N% 跳到第 N 题。
- [ ] **结果页"再来一组"**：现在只能"重新测试"重头跑，无法"保持偏好维度，换个口味"。

### 4.3 分享 / 社交

- [ ] **微信 / 微博 / 小红书原生分享按钮未实现**：当前只有 Web Share API + 下载兜底，桌面端浏览器没有 Web Share 入口。
- [ ] **分享文案模板化**：当前复制文案是单一模板，可加 2~3 种风格（文艺 / 搞笑 / 简洁）让用户挑选。
- [ ] **分享卡可视化不够"中国味"**：当前用通用渐变 + emoji，可加中国纹样 / 印章 / 书法字体。

### 4.4 无障碍 / 性能

- [ ] **缺 `prefers-reduced-motion`**：动画对前庭敏感用户不友好。
- [ ] **缺 `aria-live` / `aria-hidden` 标注**：copy-toast 不会朗读，浮动 emoji 会被读屏念。
- [ ] **`index.html` 仍有 `user-scalable=no`**：违反无障碍最佳实践。
- [ ] **`transition: all` 仍出现在 CSS 多处**：违反 Web Interface Guidelines（应改为显式属性）。
- [ ] **字体未 subset**：`Noto Sans SC` 完整加载 ≈ 200KB，可按词频 subset 到 ~80KB。

### 4.5 工程化

- [ ] **单元测试缺位**：业务纯计算为主，但 `aggregateProfile` / `pickNextQuestion` / `similarity` 三个核心函数仍未覆盖。
- [ ] **CI 流程缺位**：未配 GitHub Actions / lint check。
- [ ] **Storybook 缺位**：UI 组件随 App 一起渲染，无法独立调试。

### 4.6 国际化

- [ ] **无 i18n**：当前只有中文，未来支持英文 / 繁体需把所有字符串集中到 `i18n/zh-CN.ts` / `en-US.ts`。
- [ ] **菜系数据文化强绑定**：所有菜系描述 / 代表菜 / 性格标签都是中文表达，海外用户没有 context。

---

## 五、版本历史

| 日期 | 变更 |
| --- | --- |
| 2026-06-12 | 初始化 Vite + React + TS 模板 |
| 2026-06-12 | 完成 30 题精简版 + 150 题完整版 |
| 2026-06-12 | 加入自适应选题器 + Pearson 相似度 |
| 2026-06-13 | 重构 shareCard（等 CJK 字体 + 渐变背景） |
| 2026-06-13 | 扩充到 22 道中国菜系（含 9 道新地方/民族/港澳台菜） |
| 2026-06-13 | 题库所有"外国菜 / 环游世界"语义选项文本改写为中式场景 |
| 2026-06-13 | 新增"上一题"功能 + 返回时高亮已选选项 |

---

## 六、许可

MIT
