# Matt Skills 使用指南

> 本指南说明如何在项目中使用 Matt Skills 工作流：从想法到交付、从 bug 修复到代码库维护。
>
> 适用对象：已经在本仓库中配置过 `/setup-matt-pocock-skills` 的团队成员。

---

## 目录

1. [Matt Skills 是什么](#1-matt-skills-是什么)
2. [核心原则](#2-核心原则)
3. [主线流程：idea → ship](#3-主线流程idea--ship)
4. [入口：从问题并入主线](#4-入口从问题并入主线)
5. [代码库健康维护](#5-代码库健康维护)
6. [底层词汇层](#6-底层词汇层)
7. [跨会话工具](#7-跨会话工具)
8. [独立工具](#8-独立工具)
9. [首次配置](#9-首次配置)
10. [快速决策表](#10-快速决策表)
11. [典型场景示例](#11-典型场景示例)
12. [常见误区](#12-常见误区)

---

## 1. Matt Skills 是什么

Matt Skills 是一组**相互连接的工作流（flow）**，帮助你在 AI 辅助下完成软件工程任务。它不是孤立的命令集合，而是一条**默认路径**加上若干**入口/绕行路线**。

默认路径回答的是：

> 我有一个想法，想把它构建出来，应该怎么做？

入口回答的是：

> 我面对的不是一个想法，而是一堆 bug / 一个难缠的 bug / 一个巨大的模糊项目，应该怎么办？

底层词汇回答的是：

> 这些词在项目中到底指什么？模块应该长什么样？

---

## 2. 核心原则

### 2.1 从问题出发，不是从命令出发

不要先想“我要用哪个 skill”。先描述你的处境：

- 我有一个想法，想实现
- 有东西坏了
- 需求堆积太多
- 代码库越来越难改
- 我想验证一个设计

然后让工作流带你到合适的命令。

### 2.2 Context 比 Prompt 重要

Matt Skills 大量依赖**保存的上下文**：

- `CONTEXT.md`：项目背景、术语、决策
- ADR（Architecture Decision Records）：难以逆转的决策
- `/handoff` 文件：跨会话接力
- `/.scratch/<feature>/issues/`：本地 ticket 追踪

不要随便清空这些文件，它们是后续 session 的起点。

### 2.3 一个 session 只做一件事

`/to-tickets` 拆出来的每个 ticket，都应该在一个**新的 session** 里执行 `/implement`。这样每个 context window 只聚焦一个具体任务，避免 token 耗尽和推理质量下降。

### 2.4 先验证，后实现

如果一个问题无法靠对话确定答案，用 `/prototype` 快速写临时程序验证。验证完把结论带回来，代码扔掉。

---

## 3. 主线流程：idea → ship

这是大多数工作的标准路线。

### 3.1 第一步：打磨想法（`/grill-with-docs`）

**何时使用**：你有一个想法，且仓库里有 codebase。

**作用**：

- 通过连续提问澄清需求
- 把项目术语、边界、决策写进 `CONTEXT.md`
- 产出一份足够清晰的实现方向

**产出物**：

- 更新后的 `CONTEXT.md`
- 可能产生若干 ADR
- 明确的下一步判断：单 session 实现 / 多 session spec

**注意事项**：

- 这一步到 `/to-tickets` 之前，**保持在同一个未中断的 context window 中**。
- 如果接近 120k token 的 smart zone 上限，不要硬撑，用 `/handoff` 开新 session 继续。

---

### 3.2 分岔 A：这个问题能在对话里解决吗？

`/grill-with-docs` 过程中，可能会遇到需要**可运行答案**的问题：

- 这个状态模型对吗？
- 这个 UI 交互应该怎么设计？
- 这个 API 调用链能跑通吗？

如果这些问题无法靠纸面讨论确定，走 `/prototype` 绕行：

1. 用 `/handoff` 导出当前上下文到文件
2. 基于 handoff 文件开新 session
3. 在新 session 中运行 `/prototype`，用临时代码验证问题
4. 用 `/handoff` 把结论带回来
5. 回到原 session 引用结论，继续主线

**关键原则**：`/prototype` 的代码是**一次性的**。保留答案，删除代码。

---

### 3.3 分岔 B：这是多 session 的大项目吗？

#### 情况 1：是 → 进入 spec/ticket 流程

```
/grill-with-docs
    ↓
/to-spec
    ↓
/to-tickets
    ↓
逐个 ticket 运行 /implement（每个新 session）
    ↓
/code-review
```

**`/to-spec`**：

- 把 grilling 的成果写成可构建的规格说明
- 明确范围、验收标准、非目标
- 产出一份 SPEC 文档

**`/to-tickets`**：

- 把 spec 拆成多个 tracer-bullet ticket
- 每个 ticket 声明 **blocking edges**（阻塞依赖）
- 本地追踪使用 `/.scratch/<feature>/issues/` 目录，每个 ticket 一个文件
- 真实追踪使用 issue tracker 的 blocking links

**`/implement`（每个 ticket）**：

- 每个 ticket 开一个**新的 session**
- 在 session 中只处理该 ticket 的内容
- 内部自动驱动 `/tdd` + `/code-review`

**处理顺序**：

- 优先处理被阻塞的 ticket（blockers-first）
- 没有真实 tracker 时，手动按依赖顺序处理
- 有真实 tracker 时，依赖已完成的 ticket 都可以被领取

#### 情况 2：否 → 直接实现

如果 `/grill-with-docs` 后判断能在当前 context window 内完成：

```
/grill-with-docs
    ↓
/implement
    ↓
/code-review
```

`/implement` 会自动运行：

- `/tdd`：一次一个 red-green slice，先写测试，再实现，再重构
- `/code-review`：双轴审查
  - **Standards**：是否符合仓库编码标准
  - **Spec**：是否满足来源 issue / PRD 的要求

---

### 3.4 `/tdd`：只构建一个具体行为时

如果你不需要完整 spec，只想** test-first 地实现一个具体行为**，可以直接用 `/tdd`。

典型用法：

- 明确知道要改什么
- 范围很小，一两小时能完成
- 需要测试覆盖

---

### 3.5 `/code-review`：审查 diff

如果你想按**固定点**审查一个 branch 或 PR，可以直接用 `/code-review`。

它会从两个维度审查：

1. **Standards**：代码是否符合本仓库的编码标准
2. **Spec**：代码是否符合来源 issue / PRD 的要求

---

## 4. 入口：从问题并入主线

不是所有工作都从“我有一个想法”开始。Matt Skills 提供三个入口：

### 4.1 `/triage`：处理堆积的 issues / 请求

**何时使用**：

- 有多个 bug report 或 feature request 堆积
- 需要判断优先级、拆分、是否重复
- 这些 issue **不是你创建的**

**作用**：

- 通过 triage roles 推进问题
- 产出 **agent-ready issues**
- 然后由 `/implement` 领取

**注意**：`/to-tickets` 产出的 ticket 已经是 agent-ready，不要再 triage。

---

### 4.2 `/diagnosing-bugs`：难处理的 bug

**何时使用**：

- 第一眼看不出原因的 bug
- 间歇性出现的 flake
- 夹在两个已知正常状态之间的 regression

**原则**：

- 在拥有**紧凑反馈循环**（tight feedback loop）之前拒绝空想
- 必须有一个命令，能在**这个 bug** 上运行并变红
- 然后用 regression test 修复
- 如果问题是代码库缺乏好的 seam 来锁定 bug，后续交给 `/improve-codebase-architecture`

---

### 4.3 `/wayfinder`：巨大而模糊的项目

**何时使用**：

- Greenfield 项目（从零开始）
- 巨大的 feature build，一个 session 装不下
- 从当前位置到目标的路径还不清晰

**作用**：

- 在 issue tracker 上绘制 **decision tickets** 的 **shared map**
- 逐个解决决策问题
- 产出 **decisions, not deliverables**（决策，不是交付物）
- 直到路径清晰

**重要**：

- Map 清晰后，**必须交给 `/to-spec`**，而不是直接进入 `/implement`
- `/to-spec` 把相互链接的决策收束成可构建计划
- 只有后来发现 effort 确实很小，才可以跳过 spec 直接 `/implement`

---

## 5. 代码库健康维护

### 5.1 `/improve-codebase-architecture`

**何时使用**：

- 有空时定期运行
- 代码库越来越难改
- 发现 agent 反复在同一个地方卡住

**作用**：

- 暴露 **deepening opportunities**（深化机会）
- 选择一个机会后，会生成一个 idea，可以带入 `/grill-with-docs`

**注意**：它负责**找候选项**，不负责设计具体实现。设计实现交给 `/codebase-design`。

---

### 5.2 `/codebase-design`

**何时使用**：

- 设计或改进模块接口
- 寻找 deepening 机会
- 决定 seam 放在哪里
- 让代码更容易测试或更适合 AI 导航

**语言**：deep-module 词汇

- module
- interface
- depth
- seam
- adapter
- leverage
- locality

---

## 6. 底层词汇层

### 6.1 `/domain-modeling`

**何时使用**：

- 项目术语模糊
- 一个词被多个含义复用（例如一个 `account` 承担三件事）
- 需要做难以逆转的决策

**作用**：

- 打磨项目的 **domain language**（领域语言）
- 挑战模糊术语
- 解决 overloaded word
- 把难以逆转的决策记录为 ADR

`/grill-with-docs` 会主动调用这个纪律，保持 `CONTEXT.md` glossary 干净。

---

### 6.2 `/codebase-design`

与 5.2 同名，既是一个工作台，也是一个词汇层。问题集中在**模块形状**时直接用它。

---

## 7. 跨会话工具

### 7.1 `/handoff`

**何时使用**：

- 当前 session 快满
- 需要分叉到另一个 session（例如 `/prototype`）
- 想要 fresh session，但又要保留当前对话

**作用**：

- 把对话压缩成 markdown 文件
- 你不会在原地继续，而是**打开新 session 并引用该文件**来带过上下文
- 它是 context windows 之间的桥，两个方向都能用

**流程示例**：

```
原 session
  ↓ /handoff 导出
新 session 引用 handoff 文件
  ↓ /prototype 验证
  ↓ /handoff 导出结论
原 session 引用 handoff 文件继续
```

---

### 7.2 `/compact`（内置）

**何时使用**：

- 留在同一个对话中
- 让早期 turns 被总结
- 阶段之间有明确断点，不介意丢失逐字历史

**注意**：

- 不要在阶段中途 compact，否则 agent 可能迷路
- `/handoff` 是分叉，`/compact` 是继续

---

## 8. 独立工具

这些工具在主线流程之外运行，可以单独使用。

### 8.1 `/grill-me`

- 与 `/grill-with-docs` 一样的持续访谈
- 用于**没有 codebase** 的情境
- 是 stateless 的：不在本地保存内容，不构建 `CONTEXT.md`
- 用于打磨任何不属于 repo 的计划或设计

---

### 8.2 `/prototype`

- 一个小型 throwaway program
- 用来回答一个设计问题：这个 state model 感觉对吗？这个 UI 应该是什么样？
- 从第一天起就是 throwaway：保留答案，删除代码
- 是主线流程第 2 步的绕行，但任何难以纸面解决的 design question 都可以直接用它

---

### 8.3 `/research`

- 把阅读工作委托给**后台 agent**
- 对照**高可信一手来源**调研问题
- 在 repo 中留下带引用的 Markdown 文件
- 你可以在它阅读时继续工作
- 产物应带入 `/grill-with-docs` 的 main flow；research 提供思考材料，但不取代思考

---

### 8.4 `/teach`

- 使用当前目录作为 stateful workspace
- 跨多个 sessions 学习一个概念

---

### 8.5 `/writing-great-skills`

- 编写和编辑 skills 的 reference
- 如果你想修改 Matt Skills 本身，可以用这个

---

## 9. 首次配置

在第一次运行 engineering flow 之前，先执行：

```
/setup-matt-pocock-skills
```

它会配置：

- issue tracker 结构
- triage labels
- docs layout（`CONTEXT.md`、ADR 目录等）

如果团队使用自定义 issue tracker，也可以按这个配置对应结构。

---

## 10. 快速决策表

| 你的处境 | 第一步 | 后续 |
|---------|--------|------|
| 有一个想法，有 codebase | `/grill-with-docs` | 小 → `/implement`；大 → `/to-spec` → `/to-tickets` |
| 有一个想法，没有 codebase | `/grill-me` | 确定后创建 repo 或直接进入主线 |
| 需要验证设计问题 | `/prototype` | 用 `/handoff` 带回结论 |
| 一堆 bug / 请求 | `/triage` | `/implement` 逐个领取 |
| 有 bug 难定位 | `/diagnosing-bugs` | 修复或交给架构改进 |
| 巨大模糊项目 | `/wayfinder` | → `/to-spec` → `/to-tickets` |
| 代码库难改 | `/improve-codebase-architecture` | 选 deepening → `/grill-with-docs` |
| 术语/模块混乱 | `/domain-modeling` 或 `/codebase-design` | 记录到 `CONTEXT.md` / ADR |

---

## 11. 典型场景示例

### 场景 1：添加一个登录功能

```
用户：我想加登录功能
    ↓
/grill-with-docs
  → 确定用 OAuth？密码？SSO？写入 CONTEXT.md
    ↓
判断：中等范围，需要拆 ticket
    ↓
/to-spec
  → 明确：JWT 会话、刷新令牌、登出、测试策略
    ↓
/to-tickets
  → ticket 1: 数据库 schema
  → ticket 2: /login /logout API（依赖 ticket 1）
  → ticket 3: 前端登录页面（依赖 ticket 2）
  → ticket 4: 集成测试（依赖 ticket 2, 3）
    ↓
新 session 运行 /implement（ticket 1）
新 session 运行 /implement（ticket 2）
新 session 运行 /implement（ticket 3）
新 session 运行 /implement（ticket 4）
    ↓
/code-review
```

---

### 场景 2：一个只在生产环境出现的 bug

```
用户：生产环境偶发 500 错误
    ↓
/diagnosing-bugs
  → 要求：先找一个能复现的测试或命令
  → 如果能本地复现：写 regression test，修复，跑绿
  → 如果是因为模块之间没有 seam：交给 /improve-codebase-architecture
```

---

### 场景 3：想做一个全新项目

```
用户：我想做一个新工具，从零开始
    ↓
/wayfinder
  → 绘制 decision map：技术栈、核心模型、部署方式、数据存储
  → 逐个决策，直到路径清晰
    ↓
/to-spec
  → 把决策收束成构建计划
    ↓
/to-tickets
    ↓
逐个 /implement
```

---

### 场景 4：快速验证 UI 布局

```
在 /grill-with-docs 中讨论登录页
    ↓
发现：不确定三栏布局还是单栏更好
    ↓
/handoff 导出
新 session /prototype
  → 快速做一个临时页面对比两种布局
    ↓
/handoff 导出结论
原 session 继续
  → 选择单栏布局，写入 spec
```

---

## 12. 常见误区

### 误区 1：所有项目都走 `/wayfinder`

`/wayfinder` 用于**巨大模糊、路径不清**的项目。普通 feature 用 `/grill-with-docs` 就够了。滥用 wayfinder 会过度设计。

### 误区 2：在 `/to-tickets` 前换 session 或 compact

从 `/grill-with-docs` 到 `/to-tickets` 应该保持在同一个 context window。换 session 或 compact 会丢失 grilling 的连贯性。

### 误区 3：把 `/prototype` 代码合并进项目

`/prototype` 是 throwaway。验证完就扔。如果想把结论变成正式代码，回到主线 `/implement` 重新 TDD。

### 误区 4：一个 session 处理多个 ticket

每个 ticket 开一个 fresh session。多 ticket 塞进一个窗口会导致 token 耗尽和上下文污染。

### 误区 5：不做 `/code-review` 就直接提交

`/implement` 内部会触发 `/code-review`。如果手动走 `/tdd`，也要记得最后用 `/code-review` 做双轴审查。

### 误区 6：跳过 `/setup-matt-pocock-skills`

首次使用必须先配置。issue tracker、labels、docs layout 不匹配会导致后续工作流卡住。

---

## 附录：命令速查

| 命令 | 类型 | 一句话 |
|------|------|--------|
| `/setup-matt-pocock-skills` | 前置配置 | 初始化配置 |
| `/grill-with-docs` | 主线 | 有 codebase 时打磨想法 |
| `/grill-me` | 独立 | 无 codebase 时打磨想法 |
| `/prototype` | 独立/绕行 | 临时验证设计问题 |
| `/handoff` | 跨会话 | 导出/导入上下文 |
| `/to-spec` | 主线 | 把想法写成规格 |
| `/to-tickets` | 主线 | 把规格拆成 ticket |
| `/implement` | 主线 | 实现一个 ticket 或完整功能 |
| `/tdd` | 主线/独立 | 测试驱动开发一个具体行为 |
| `/code-review` | 主线/独立 | 双轴审查 diff |
| `/triage` | 入口 | 梳理堆积的 issues |
| `/diagnosing-bugs` | 入口 | 难处理 bug 的诊断修复 |
| `/wayfinder` | 入口 | 巨大模糊项目的决策地图 |
| `/improve-codebase-architecture` | 维护 | 找代码库深化机会 |
| `/codebase-design` | 维护/词汇 | 设计模块接口 |
| `/domain-modeling` | 词汇 | 打磨领域语言 |
| `/research` | 独立 | 后台调研并写 Markdown |
| `/teach` | 独立 | 跨 session 学习 |
| `/writing-great-skills` | 独立 | 编写 skills |
