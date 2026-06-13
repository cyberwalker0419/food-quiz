# food-quiz

味觉灵魂测试的应用本体。React + TypeScript + Vite 单页应用，纯前端、零后端。

📖 仓库总览与说明见根目录 [`../README.md`](../README.md)。  
📐 详细技术决策记录见根目录 [`../技术栈.md`](../技术栈.md)。

---

## 快速开始

```bash
npm install
npm run dev      # Vite dev server（HMR）
npm run build    # = tsc -b && vite build
npm run preview  # 预览 dist/
```

## 目录

```
food-quiz/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.app.json / tsconfig.node.json / tsconfig.json
├── eslint.config.js
├── public/                     # favicon
└── src/
    ├── main.tsx
    ├── index.css
    ├── App.tsx                 # 业务主组件
    ├── data/
    │   ├── cuisines.ts         # 22 道菜系 + 八维向量
    │   └── questions.ts        # 150 道题（精简版 30 / 完整版 60）
    ├── utils/
    │   ├── adaptiveQuiz.ts     # 自适应选题器
    │   └── shareImage.ts       # 分享卡生成
    └── styles/App.css
```

## 关键能力

- **自适应题目序列**：基于已答聚合 8 维口味向量，每答一题动态选下一题
- **Pearson 中心化余弦相似度**：识别"口味形状"而非绝对值
- **Canvas 分享卡**：等 CJK 字体加载后渐变背景 + 圆角卡片 + 口味条
- **上一题**：返回时高亮之前选项

完整业务逻辑见 [`../README.md`](../README.md) § 三、匹配算法、§ 四、待解决的问题。
