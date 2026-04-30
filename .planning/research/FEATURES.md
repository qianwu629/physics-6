# Feature Research

**Domain:** Web 物理模拟平台（高中经典力学 / 组件化场景搭建）
**Researched:** 2026-04-30
**Confidence:** HIGH

## Feature Landscape

### 核心定位回顾

Physis 的核心价值主张是**组件化自由组合**——用户通过组合基础物理原语（形状、力场、约束）自由搭建任意场景。这不是一个"预制题目求解器"，而是一个物理沙盒。目标用户是高中物理学生，他们希望通过可视化模拟理解复杂物理问题中的运动过程。

---

### Table Stakes（用户期望的基础功能）

缺失这些功能 = 产品感觉不完整，用户会立即离开。

| 特征 | 为什么是必须的 | 复杂度 | 实现说明 |
|------|---------------|--------|---------|
| **基础刚体形状**（球体、方块、圆柱、平面/斜面） | 所有物理模拟平台的基础构建块；PhET、Algodoo、Physion、SimPHY 均以此为核心 | LOW | 物理引擎直接提供；需要3D网格对应 |
| **重力配置**（强度、方向） | 经典力学的第一前提；每个物理模拟平台都有此功能 | LOW | 物理引擎世界参数的单一向量配置 |
| **播放/暂停/重置控制** | PhET 所有模拟的标配；学生需要暂停来分析状态、重置来重新实验 | LOW | 控制物理引擎的 step 循环 |
| **物体属性编辑**（质量、速度、位置、摩擦系数、弹性系数） | Algodoo、Physion、MyPhysicsLab 全部提供属性面板；学生必须能调参才能做对照实验 | MEDIUM | 需要 UI 属性面板 + 物理体参数映射 |
| **实时3D渲染** | 项目约束要求 WebGL/WebGPU 3D 渲染；SimPHY、VirtuLab 等竞品均提供3D视图 | MEDIUM | Three.js / Babylon.js 场景 + 物理体同步 |
| **碰撞检测与响应** | 物理模拟的核心；无碰撞=无真实感；MyPhysicsLab 为此专门构建了碰撞时间二分搜索算法 | LOW | 物理引擎内置；但需确认引擎选型支持 |
| **3D摄像机控制**（轨道旋转、平移、缩放） | 任何3D应用的标配；无此功能用户无法观察场景 | LOW | Three.js OrbitControls 或等效实现 |
| **可视化拖拽场景搭建** | 项目的核心交互模式；Algodoo、Physion、Hypper Sandbox 均以拖拽为核心 | HIGH | 需要：射线检测、拖拽状态机、吸附/对齐、放置预览 |
| **弹簧约束** | 弹簧振子是高中物理核心内容；Algodoo、Physion、MyPhysicsLab 均有弹簧 | MEDIUM | 物理引擎的 distance joint + 弹性参数 |
| **环境参数配置**（重力加速度、空气阻力系数） | 项目需求明确要求"环境参数可配置"；对比不同环境下同一场景是核心学习模式 | LOW | 全局物理世界参数面板 |

---

### Differentiators（竞争差异化特征）

这些特征让 Physis 区别于 PhET 等"演示型"平台和 Algodoo 等2D沙盒。

| 特征 | 价值主张 | 复杂度 | 实现说明 |
|------|---------|--------|---------|
| **组件化自由组合架构**（非模板模式） | 核心差异化——用户不受预设场景限制；这是废案失败的根本教训；nature-laws 项目已验证此模式可行 | HIGH | 需要设计组件注册/发现系统、场景序列化格式、组件间约束表达 |
| **2D物理 × 3D视图**（在3D空间中模拟2D物理） | 独特的视觉呈现——物理计算在XY平面进行，但场景以3D渲染，支持旋转观察；VirtuLab、Spacetime Explorer 均走此路线 | MEDIUM | 物理引擎限制 Z 轴运动，渲染层保持 3D；注意需要区分"3D渲染"和"3D物理" |
| **实时运动图表**（位置-时间、速度-时间、加速度-时间图） | 高中物理的核心分析工具；PhET Moving Man 的核心特征；oPhysics 整个平台围绕此构建；Algodoo 虽然简陋但已具备 | HIGH | 需要从物理引擎每帧采集数据、存储时间序列、Canvas/SVG 渲染图表、支持多对象叠加对比 |
| **矢量可视化叠加层**（速度箭头、力箭头、加速度箭头） | 让学生"看到"抽象的物理量；Algodoo 的 toggleable vector overlay 是其核心卖点；SimPHY 同样提供 | MEDIUM | 每帧从物理体读取速度/受力，渲染为带颜色编码的3D箭头；需要可切换显示 |
| **时间操控**（慢动作、逐帧步进、回放/拖拽时间轴） | 深度分析工具——学生可以慢放碰撞瞬间、逐帧观察运动；PhET Moving Man 的 Record/Playback 功能是其被广泛使用的原因之一 | HIGH | 需要：仿真状态快照记录、时间轴 UI、回放时的状态恢复；注意内存管理 |
| **轨迹/残影**（物体运动路径拖尾） | 直观展示运动轨迹；SimPHY 的 tracer/ghosting、Spacetime Explorer 的 orbital trails；对学生理解抛体轨迹、圆周运动极其有用 | LOW | 存储历史位置队列，渲染为渐变透明线条 |
| **数据导出**（CSV格式，含时间/位置/速度/加速度） | 学生可以在 Excel 中自行分析；FizziQ 的 PDF/Excel/Python 导出是其教育场景的核心卖点 | LOW | 将已采集的时序数据序列化为 CSV 下载 |
| **多场景并行对比** | 改变单一变量、同时观察两个场景——这是科学方法的直接体现；PhET 的 Projectile Motion 对比四个角度的抛体是其经典设计 | HIGH | 需要支持多个独立物理世界/场景实例同时运行和渲染 |
| **场景保存/加载/分享**（URL 分享） | Algodoo 的 Algobox（20万+场景）和 Physion 的场景 URL 分享是社区活力的核心 | MEDIUM | 场景序列化为 JSON → 本地存储 + 服务端存储 + 分享链接生成 |
| **测量工具**（虚拟直尺、量角器、秒表） | 量化分析的基础；PhET 的虚拟测量工具是其标配；SimPHY 提供 timer | MEDIUM | 需要3D空间中的交互式测量 UI 组件 |

---

### Anti-Features（看似好但不应构建的特征）

| 特征 | 为什么被要求 | 为什么有问题 | 替代方案 |
|------|------------|-------------|---------|
| **预制题目模板**（"抛体模拟器"、"斜面模拟器"等独立模块） | 表面上"开箱即用"，降低使用门槛 | 违背核心设计理念——废案失败的根本原因；模板之间不可组合，用户被限制在预设场景中 | 通过**精选起始场景**（示例场景库）实现类似目标：用户打开一个示例，但可以自由修改任何参数和组件 |
| **移动端 App** | 学生在手机上使用更方便 | 项目约束明确排除；拖拽场景搭建在小屏幕上体验差；增加多平台维护成本 | Web 响应式设计作为折中——桌面端完整体验，移动端可查看（不可编辑） |
| **多人实时协作** | "和同学一起搭建场景"听起来很酷 | v1 巨大的技术复杂度（CRDT/OT、网络同步、冲突解决）；与物理模拟的确定性要求冲突 | 场景分享（URL 导出/导入）实现异步协作；未来版本可考虑 |
| **照片级真实渲染**（PBR材质、实时光追） | 看起来很酷很"专业" | 渲染性能开销巨大；分散物理精度这一核心关注点；高中物理不需要照片级视觉 | **卡通式清晰（cartoonish clarity）**——简洁、高对比度的视觉风格，强调物理量的可视化而非材质真实感 |
| **"自动解题"功能**（输入题目→自动生成模拟） | 帮助学生验证答案 | 鼓励惰性学习，与探索式学习理念冲突；技术实现需要 NLP/LLM 集成，复杂度极高 | 图表和测量工具让学生自己分析数据得出结论 |
| **物理常量数据库**（预置各种材料的密度/摩擦系数等） | 看起来"专业" | 高中物理通常使用简化系数；庞大的数据库增加维护负担且大部分不会被使用 | 提供合理的默认值（钢、木、冰三个级别），其余让用户自由输入 |

---

## Feature Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                     依赖关系图                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  物理引擎选型 (最底层)                                       │
│      ├──requires──> 基础刚体形状                             │
│      ├──requires──> 碰撞检测与响应                           │
│      ├──requires──> 弹簧约束                                │
│      └──requires──> 重力/环境参数                           │
│                                                             │
│  3D渲染引擎选型                                              │
│      ├──requires──> 实时3D渲染                              │
│      ├──requires──> 3D摄像机控制                            │
│      └──enhances──> 矢量可视化叠加层                        │
│                                                             │
│  场景管理系统                                                │
│      ├──requires──> 物理引擎 (实体管理)                      │
│      ├──requires──> 3D渲染引擎 (视觉表现)                    │
│      ├──requires──> 可视化拖拽场景搭建                       │
│      ├──requires──> 物体属性编辑                            │
│      └──enables──> 场景保存/加载/分享                       │
│                                                             │
│  数据采集管线                                                │
│      ├──requires──> 物理引擎 (每帧状态)                      │
│      ├──enables──> 实时运动图表                              │
│      ├──enables──> 轨迹/残影                                │
│      ├──enables──> 数据导出 (CSV)                           │
│      └──enables──> 时间操控 (回放依赖记录的状态快照)          │
│                                                             │
│  时间操控系统                                                │
│      ├──requires──> 数据采集管线 (状态快照)                   │
│      └──enhances──> 实时运动图表 (回放时图表同步)            │
│                                                             │
│  多场景并行对比                                              │
│      ├──requires──> 场景管理系统 (多个独立场景)              │
│      └──conflicts──> 时间操控 (每个场景需要独立时间轴)       │
│                                                             │
│  组件化自由组合架构                                          │
│      ├──requires──> 场景管理系统                            │
│      ├──requires──> 物体属性编辑                            │
│      └──enables──> 所有 differentiated 特征的基础           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 依赖说明

- **物理引擎选型在整个系统中处于最底层**——所有模拟功能都依赖它。如果选了不合适的引擎（如碰撞检测不够精确），所有上层特征都会受影响。这是最早阶段最关键的技术决策。
- **数据采集管线是多个 differentiator 的使能者**——图表、轨迹、CSV导出、时间回放都依赖同一套"每帧采集物理状态"的基础设施。应作为统一子系统设计，而非每个功能独立实现。
- **场景管理系统是所有交互功能的枢纽**——拖拽搭建、属性编辑、保存加载都通过场景管理器操作实体。设计时需要明确的 API 边界。
- **组件化自由组合架构对所有 differentiator 有增强关系**——图表系统需要访问任意组件的运行时数据，时间系统需要序列化任意组件的状态。组件注册和反射机制是基础设施。
- **多场景并行对比与时间操控存在冲突**——如果多个场景需要独立的时间轴（如场景A暂停、场景B慢放），时间系统的复杂度倍增。建议先实现单场景时间操控，多场景对比通过"并排展示独立场景"实现（各自独立时间轴是未来优化项）。

---

## MVP Definition

### Launch With (v1)

最小可验证产品——验证"组件化自由组合"核心理念所需的最小集。

- [x] **基础刚体形状**（球体、方块、平面/斜面）——搭建任何经典力学场景的原子单元
- [x] **重力与环境参数配置**——经典力学的第一前提；无此功能无法模拟任何场景
- [x] **碰撞检测与响应**——物理模拟的"心跳"；无碰撞=无真实感
- [x] **实时3D渲染 + 摄像机控制**——用户"看到"物理的基础
- [x] **播放/暂停/重置控制**——最基本的交互控制
- [x] **物体属性编辑面板**（质量、初速度、位置、摩擦系数、弹性系数）——"调参做实验"的核心交互
- [x] **弹簧约束**——弹簧振子是高中物理必学内容
- [x] **可视化拖拽场景搭建**——核心理念的实现载体；这是与 PhET 等"演示型"平台的根本区别
- [ ] **轨迹/残影**——低复杂度、高感知价值；直观展示运动路径

### Add After Validation (v1.x)

核心循环验证通过后添加——这些特征提升学习深度和分析能力。

- [ ] **矢量可视化叠加层**（速度/力箭头）——让学生在3D中"看到"抽象物理量
- [ ] **实时运动图表**（位置-时间、速度-时间图）——高中物理的核心分析工具；但复杂度高，先确保基础模拟正确
- [ ] **时间操控**（慢动作、逐帧步进）——先做慢动作和步进，完整回放由于状态快照存储的复杂度推迟
- [ ] **场景保存/加载**（本地）——有了值得保存的场景之后才有意义
- [ ] **数据导出**（CSV）——依赖图表系统的数据采集管线

### Future Consideration (v2+)

产品-市场匹配确认后的远期规划。

- [ ] **多场景并行对比**——技术复杂度高，需要多世界架构；但教育价值巨大
- [ ] **场景 URL 分享**——需要服务端基础设施；依赖社区生态形成
- [ ] **完整时间回放**（带时间轴拖拽）——依赖完整的状态快照系统；内存/性能挑战需要专门优化
- [ ] **测量工具**（虚拟直尺、量角器）——实用但交互设计复杂（3D空间中的测量 UI）
- [ ] **物理领域扩展**（光学、电磁、热力学）——架构设计时预留扩展点，但 v1 只做力学
- [ ] **脚本/编程接口**——Physion 的 JavaScript scripting、Algodoo 的 Thyme；高级用户自定义行为

---

## Feature Prioritization Matrix

| 特征 | 用户价值 | 实现成本 | 优先级 | 理由 |
|------|---------|---------|--------|------|
| 基础刚体形状 | HIGH | LOW | P1 | 无此功能什么都搭不了 |
| 重力/环境参数 | HIGH | LOW | P1 | 物理的第一前提 |
| 碰撞检测与响应 | HIGH | LOW | P1 | 物理引擎内置 |
| 3D渲染+摄像机 | HIGH | MEDIUM | P1 | 看到一切的基础 |
| 播放/暂停/重置 | HIGH | LOW | P1 | 基本控制 |
| 物体属性编辑 | HIGH | MEDIUM | P1 | 调参实验的核心 |
| 弹簧约束 | HIGH | MEDIUM | P1 | 弹簧振子是必学 |
| 拖拽场景搭建 | HIGH | HIGH | P1 | 核心理念的载体 |
| 轨迹/残影 | MEDIUM | LOW | P1 | 低成本高感知 |
| 矢量叠加层 | HIGH | MEDIUM | P2 | 看见抽象量 |
| 实时运动图表 | HIGH | HIGH | P2 | 核心分析工具但复杂 |
| 时间操控（慢动作/步进） | MEDIUM | MEDIUM | P2 | 深度分析 |
| 场景保存/加载 | MEDIUM | MEDIUM | P2 | 有场景后才需要 |
| 数据导出CSV | MEDIUM | LOW | P2 | 依赖图表管线 |
| 多场景对比 | HIGH | HIGH | P3 | 架构挑战大 |
| 场景URL分享 | MEDIUM | MEDIUM | P3 | 需要服务端 |
| 时间回放（完整） | MEDIUM | HIGH | P3 | 内存/性能挑战 |
| 测量工具 | MEDIUM | MEDIUM | P3 | 交互设计复杂 |
| 多物理领域 | HIGH | HIGH | P3 | v2+ 规划 |

---

## Competitor Feature Analysis

| 特征 | PhET (演示型) | Algodoo (2D沙盒) | Physion (2D沙盒) | SimPHY (3D桌面) | Physis (我们的) |
|------|-------------|-----------------|-----------------|----------------|----------------|
| 平台 | Web | 桌面/iPad | Web | 桌面 | Web |
| 物理维度 | 2D | 2D | 2D | 3D | 2D物理×3D视图 |
| 场景搭建 | ❌ 预设模板 | ✅ 拖拽绘制 | ✅ 拖拽绘制 | ✅ 拖拽+脚本 | ✅ 拖拽+组件组合 |
| 组件化自由组合 | ❌ | 有限（对象组合） | 有限（对象组合） | 部分（脚本扩展） | ✅ 核心设计理念 |
| 3D渲染 | ❌ | ❌ | ❌ | ✅ | ✅ |
| 矢量可视化 | ✅ 部分 | ✅ toggleable | ❌ (planned) | ✅ | ✅ (planned) |
| 实时图表 | ✅ 核心特征 | ✅ 基础 | ❌ (planned) | ✅ | ✅ (planned) |
| 时间操控 | ✅ Record/Playback | ✅ 基础 | ❌ | ✅ Timer | ✅ (planned) |
| 脚本/编程 | ❌ | ✅ Thyme | ✅ JavaScript | ✅ JS IntelliSense | ❌ (v2+) |
| 场景分享 | ❌ | ✅ Algobox (20万+) | ✅ URL分享 | ❌ | ✅ (planned) |
| 测量工具 | ✅ 虚拟仪器 | 有限 | ❌ | ✅ | ❌ (v2+) |

### 竞争定位总结

Physis 的差异化来自三个维度的组合：
1. **Web 平台**（免安装，像 Physion）+ 
2. **3D 可视化**（像 SimPHY）+ 
3. **组件化自由组合**（超越所有竞品的核心优势）

PhET 的强项是教育研究和内置引导，但它是"演示型"而非"搭建型"。Algodoo 是最成熟的物理沙盒，但它是2D桌面软件。Physion 是Web原生的2D沙盒，但缺少3D和图表。SimPHY 有3D和图表，但是桌面软件且学习曲线陡峭。

Physis 的机会在于：**第一个 Web 原生的、3D可视化的、自由组合式物理沙盒**。

---

## 关于"真实感"vs"玩具感"的研究洞察

这是调研中最有启发性的发现。结合 Steve Swink 的 Game Feel 框架和教育模拟的最新研究，关键设计原则如下：

### "真实感"不来自照片级渲染，而来自物理一致性

研究发现（Swink, 2009; Pichlmair & Johansen, 2020）：用户感知的"真实"不取决于视觉逼真度，而取决于**可预测性、即时响应和有机运动**。

| 真实感维度 | 具体表现 | 对 Physis 的启示 |
|-----------|---------|-----------------|
| **可预测性** | 相同输入始终产生相同输出；碰撞行为符合直觉 | 物理引擎的确定性至关重要；数值精度优先于性能 |
| **即时响应** | 拖拽操作无延迟；参数修改立即反映在模拟中 | 引擎 step 频率至少 60Hz；属性编辑需要实时热更新 |
| **有机运动** | 物体运动平滑无抖动；碰撞无穿透；能量守恒可视化 | 子步进积分（sub-stepping）；碰撞迭代次数充足 |
| **视觉反馈** | 影响效果（碰撞火花/声音）；轨迹拖尾；阴影增强空间感知 | 保持简洁但有反馈——不需要粒子爆炸，但碰撞应该有视觉提示 |
| **约束清晰** | 物体不会穿越墙壁；斜面摩擦力正确；弹簧不会无限拉伸 | 碰撞穿透是"玩具感"的头号来源 |

### "经验浓缩"原则（Experience Condensing）

来自游戏设计社区的洞察：**纯真实物理的大部分内容是无聊的**。好的教育模拟需要"浓缩和放大有趣的方面"。

对 Physis 的具体应用：
- **时间缩放是必需的**——让学生慢放碰撞瞬间、加速等待过程
- **图表自动标注关键事件**——碰撞时刻、速度零点等在图表上高亮
- **默认参数预设有趣场景**——不要让用户从零开始调参才能看到有趣的现象
- **视觉强调因果关系**——施加力时箭头闪烁、碰撞时短暂高亮

### "卡通式清晰"胜过"照片级真实"

Augmented Physics (UIST 2024 Best Paper) 和 PhET 的设计哲学一致表明：**简洁、高对比度的视觉风格比真实感渲染更有利于学习**。原因是：
- 减少视觉噪音，聚焦物理量
- 抽象表示使不可见的概念（力、速度）可视化
- 学生更容易将模拟与课本中的示意图对应

建议 Physis 采用：
- **简洁的几何体**（无纹理、纯色/渐变）
- **高对比度颜色编码**（红色=速度，蓝色=力，绿色=加速度）
- **清晰的网格地面**（帮助空间感知）
- **非真实感渲染（NPR）**风格，类似技术图示

---

## Sources

### 竞品分析
- [PhET Interactive Simulations](https://phet.colorado.edu/) — University of Colorado Boulder，50+ 免费物理模拟
- [Algodoo](https://www.algodoo.com/) — Algoryx Simulation AB，2D 物理沙盒（SPOOK 约束求解器 + SPH 流体）
- [Physion](https://physion.net/) — Dimitris Xanthopoulos，Web 原生 2D 物理沙盒（Box2D + JavaScript 脚本）
- [SimPHY](https://github.com/simphysoftwares/SimPHY-docs/wiki/Introduction-to-SimPHY) — 3D 桌面物理模拟器，覆盖经典力学全范围
- [oPhysics](https://ophysics.com/k.html) — 运动学/向量/抛体交互模拟
- [MyPhysicsLab](https://www.myphysicslab.com/) — 弹簧/摆/碰撞模拟，含数值方法文档
- [VirtuLab](https://dev.to/joyston_ccd43d53e268ec635/virtulab-a-browser-based-lab-built-to-close-the-practical-learning-gap-1a3h) — 浏览器端3D虚拟实验室
- [Spacetime Explorer](https://lablab.ai/ai-hackathons/code-craft-ai-x-dev-hackathon/team-kamui/spacetime-explorer) — 浏览器端3D引力沙盒
- [nature-laws](https://github.com/crazygo/nature-laws/issues/13) — Matter.js 预设组件库物理沙盒（GitHub）

### 教育设计研究
- Perkins, K. et al. (2006). "PhET: Interactive Simulations for Teaching and Learning Physics." *The Physics Teacher*, 44(1), 18-23.
- Finkelstein, N. et al. (2006). "High-Tech Tools for Teaching Physics: the Physics Education Technology Project." *JOLT*, 2(3).
- 2024 Meta-analysis: "PhET interactive simulations in physics teaching practices." *Revista Brasileira de Ensino de Física*, 46. — 1589篇文献中选出22篇进行元分析，PhET 显著优于或等同于传统教学
- [Augmented Physics (UIST 2024 Best Paper)](http://www.arxiv.org/abs/2405.18614) — 静态图表转交互模拟；SUS 评分 92.73
- [NoRILLA (CMU, 2024)](https://www.cmu.edu/xrtc/news/2024/july/norilla.html) — 混合现实物理学习系统，学生 STEM 理解力提升 5×

### 游戏感受与交互设计
- Swink, S. (2009). *Game Feel: A Game Designer's Guide to Virtual Sensation.* Morgan Kaufmann. — 6项游戏感受指标：输入、响应、情境、润色、隐喻、规则
- Pichlmair, M. & Johansen, M. (2020). *Designing Game Feel: A Survey.* IT University Copenhagen. — 物理性/放大/支持三领域框架
- Wasilewski, M. (2019). *Starship Physics and Controls that Feel Real: Bringing the Toys of Starlink to Digital Life.* GDC 2019. — "玩具感"设计哲学在AAA游戏中的应用

### 物理引擎与渲染
- [Rapier.js 文档](https://deepwiki.com/dimforge/rapier.js/6.2-graphics-and-rendering) — WASM 物理引擎，支持复杂碰撞形状
- [Three.js 论坛 — Cannon.js vs Rapier 讨论](https://discourse.threejs.org/t/can-i-use-2d-physics-engine-and-3d-physics-engine-together/66330) — Cannon 的 Trimesh 限制是已知痛点
- [FizziQ](https://www.fizziq.org/en/post/fizziq-web-experimental-physics-on-the-big-screen) — 浏览器端物理实验平台，含图表/数据导出/视频分析

---
*Feature research for: Physis — 组件化物理模拟平台（高中经典力学 v1）*
*Researched: 2026-04-30*
*Confidence: HIGH — 多源验证（竞品分析 + 学术文献 + 行业实践 + 游戏设计理论）*
