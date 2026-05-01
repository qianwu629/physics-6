# Roadmap: Physis

## Overview

Physis 从一个可运行的物理沙盒起步（球体和方块在重力下碰撞堆叠，3D 视角可旋转观察），逐步构建组件化自由组合架构（用户组合基础原语搭建任意场景）、属性编辑与约束系统（弹簧振子、环境参数配置），最终通过轨迹残影和矢量可视化叠加层让抽象的物理量在 3D 空间中"可见"。每个阶段交付一个完整的、可验证的用户能力。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: 仿真核心与基础3D渲染** - 可运行的物理沙盒：物体在重力下碰撞堆叠，3D 视角可旋转观察，支持播放/暂停/重置
- [ ] **Phase 2: 组件化实体系统与属性编辑** - 用户可自由添加实体、组合组件、通过属性面板编辑物理参数
- [ ] **Phase 3: 约束系统与环境配置** - 弹簧约束连接物体，全局重力/摩擦/空气阻力可配置
- [ ] **Phase 4: 轨迹与矢量可视化** - 运动轨迹残影、速度和受力矢量箭头叠加显示

## Phase Details

### Phase 1: 仿真核心与基础3D渲染
**Goal**: 用户可以在 3D 视图中运行一个包含基础刚体形状的物理模拟，物体在重力下自然碰撞和堆叠，用户可旋转观察并控制模拟的播放/暂停/重置
**Depends on**: Nothing (first phase)
**Requirements**: SIM-01, SIM-03, SIM-06, REN-01, REN-02
**Success Criteria** (what must be TRUE):
  1. 用户启动应用后看到包含基础刚体形状（球体、方块、平面/斜面）的 3D 场景，所有形状正确渲染
  2. 物体在重力影响下下落，彼此之间以及与地面发生碰撞，并表现出自然的堆叠行为
  3. 用户可以通过鼠标/触控操作对 3D 摄像机进行轨道旋转、平移和缩放，从任意角度观察场景
  4. 用户可以通过可见的屏幕控件启动、暂停和重置模拟
  5. 同一场景在不同显示刷新率（60Hz、144Hz）下产生一致的物理行为——模拟速度不随帧率变化
**Plans**: 4 plans
Plans:
- [x] 01-01-PLAN.md — 项目初始化与基础设施（Vite + React + Tailwind + 依赖）
- [x] 01-02-PLAN.md — 仿真核心与 3D 场景（Zustand store + Rapier Physics + R3F 渲染）
- [x] 01-03-PLAN.md — UI 控制与集成（工具栏 + 加载/错误状态 + 键盘快捷键）
- [x] 01-04-PLAN.md — Gap Closure: 修复Reset无效 + WASM依赖不匹配 + objectCount语义 + 类型断言 (complete + verified)
**UI hint**: yes

### Phase 2: 组件化实体系统与属性编辑
**Goal**: 用户可以通过 UI 控件自由添加实体到场景中，通过属性面板编辑其物理参数，系统底层采用组件化架构使得实体行为由其附加的组件集合决定
**Depends on**: Phase 1
**Requirements**: DIF-01, REN-03
**Success Criteria** (what must be TRUE):
  1. 用户可以通过 UI 控件向场景中添加新实体（球体、方块、平面/斜面），实体即时出现在 3D 视图中
  2. 用户可以在场景中选择任意实体，通过属性面板编辑其物理属性（质量、初速度、位置、摩擦系数、弹性系数）
  3. 实体属性修改即时生效——实体在模拟中的行为反映更新后的参数值
  4. 系统架构采用基于组件的实体模型，实体行为由其附加的组件集合决定，而非由硬编码类型模板决定——新实体类型可通过组合现有组件创建
**Plans**: 6 plans
Plans:
- [ ] 02-01-PLAN.md — 基础建设: shadcn/ui初始化 + ECS组件类型 + Entity工厂
- [ ] 02-02-PLAN.md — 状态管理: entitySlice (Map CRUD + 选中) + uiSlice (面板状态) + 单元测试
- [ ] 02-03-PLAN.md — 3D渲染重构: EntityRenderer (ECS→R3F) + Scene3D (空场景 + 点击选中 + Outlines高亮)
- [ ] 02-04-PLAN.md — 实体创建: 左侧浮动Toolbox + 创建对话框 (zod验证 + react-hook-form)
- [ ] 02-05-PLAN.md — 属性编辑: 右侧PropertyPanel (可编辑/只读切换) + EntityList + 删除确认
- [ ] 02-06-PLAN.md — 应用集成: App布局 + 键盘快捷键(8键) + 清理hardcodedScene
**UI hint**: yes

### Phase 3: 约束系统与环境配置
**Goal**: 用户可以在物体之间添加弹簧约束（实现弹簧振子场景），并通过控制面板配置全局重力、摩擦力和空气阻力等环境参数
**Depends on**: Phase 2
**Requirements**: SIM-02, SIM-04, SIM-05
**Success Criteria** (what must be TRUE):
  1. 用户可以在任意两个实体之间附加弹簧约束，可配置弹性系数和原长
  2. 弹簧振子系统（质量-弹簧）表现出正确的简谐运动行为，在 3D 视图中可视化可观察
  3. 用户可以通过控制面板配置全局重力强度和方向，修改后对所有动态物体立即生效
  4. 用户可以通过控制面板配置全局摩擦系数和空气阻力（拖拽）系数，其效果在物体运动中可观察——更高摩擦力减慢滑动，更高空气阻力缩短抛体射程
  5. 带约束的多体场景（如弹簧连接的质量块）在不同环境参数组合下行为正确
**Plans**: TBD
**UI hint**: yes

### Phase 4: 轨迹与矢量可视化
**Goal**: 用户可以看到运动物体的轨迹残影（拖尾效果）以及速度和受力方向的矢量箭头叠加显示，从而更直观地理解物体运动过程
**Depends on**: Phase 3
**Requirements**: DIF-02, DIF-03
**Success Criteria** (what must be TRUE):
  1. 运动物体留下可见的轨迹残影（拖尾/残像线条），描绘其随时间变化的运动路径
  2. 用户可以全局或按单个物体切换轨迹残影显示的开关
  3. 速度矢量以彩色箭头形式从每个物体中心发出显示，箭头长度与速率成正比，方向与瞬时速度方向一致
  4. 受力矢量（重力、弹力、接触力、阻力）以彩色箭头形式显示，表示作用在每个物体上的力的方向和相对大小
  5. 用户可以独立切换速度矢量叠加层和受力矢量叠加层的显示开关
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 仿真核心与基础3D渲染 | 4/4 | Complete ✓ | 2026-05-01 |
| 2. 组件化实体系统与属性编辑 | 0/6 | Planned | - |
| 3. 约束系统与环境配置 | 0/TBD | Not started | - |
| 4. 轨迹与矢量可视化 | 0/TBD | Not started | - |
