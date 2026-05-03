# Requirements: Physis

**Defined:** 2026-04-30
**Core Value:** 用户可以通过组合基础物理原语自由搭建任意场景，不受预设模板限制。

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Simulation Core

- [x] **SIM-01**: 系统支持基础刚体形状——球体、方块、圆柱、平面/斜面
- [x] **SIM-02**: 用户可配置重力强度和方向
- [x] **SIM-03**: 物体之间发生物理碰撞并正确响应
- [x] **SIM-04**: 用户可添加弹簧约束（弹簧振子），配置弹性系数和原长
- [x] **SIM-05**: 用户可配置全局环境参数——重力加速度、空气阻力系数、摩擦系数
- [x] **SIM-06**: 用户可以播放、暂停和重置模拟

### Rendering & Interaction

- [x] **REN-01**: 系统以 WebGL/WebGPU 实时 3D 渲染物理场景
- [x] **REN-02**: 用户可通过轨道旋转、平移、缩放控制 3D 摄像机
- [ ] **REN-03**: 用户可通过属性面板编辑物体的物理参数（质量、速度、位置、摩擦系数、弹性系数）

### Differentiators

- [ ] **DIF-01**: 系统采用组件化自由组合架构——用户组合基础物理原语搭建场景，而非使用预制模板
- [ ] **DIF-02**: 系统渲染物体运动轨迹残影（拖尾效果）
- [ ] **DIF-03**: 系统以矢量箭头叠加显示物体速度和受力方向

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Scene Building

- **SCN-01**: 可视化拖拽场景搭建——拖拽放置物体，吸附对齐，放置预览
- **SCN-02**: 2D 物理计算 × 3D 视图渲染——物理在 XY 平面进行，支持 3D 旋转观察
- **SCN-03**: 场景保存为 JSON 文件并支持加载

### Analysis Tools

- **ANL-01**: 实时运动图表——位置-时间、速度-时间、加速度-时间图
- **ANL-02**: 数据导出为 CSV 格式（时间、位置、速度、加速度）
- **ANL-03**: 时间操控——慢动作、逐帧步进、时间轴回放
- **ANL-04**: 多场景并行对比运行
- **ANL-05**: 虚拟测量工具（直尺、量角器、秒表）

## Out of Scope

| Feature | Reason |
|---------|--------|
| 预制题目模板 | 违背核心设计理念——废案失败的根本原因。替代方案：精选起始场景（示例库） |
| 移动端 App | 项目约束明确排除；拖拽搭建在小屏幕上体验差 |
| 多人实时协作 | v1 技术复杂度过高（CRDT/OT），与物理确定性要求冲突。替代方案：场景 URL 分享 |
| 照片级真实渲染（PBR/光追） | 渲染开销巨大，分散物理精度焦点。替代方案：卡通式清晰视觉风格 |
| 自动解题功能 | 鼓励惰性学习，与探索式学习理念冲突 |
| 物理常量数据库 | 高中物理使用简化系数，庞大数据库增加维护负担。替代方案：钢/木/冰三级默认值 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SIM-01 | Phase 1: 仿真核心与基础3D渲染 | Complete (01-02) |
| SIM-02 | Phase 3: 约束系统与环境配置 | Complete |
| SIM-03 | Phase 1: 仿真核心与基础3D渲染 | Complete (01-02) |
| SIM-04 | Phase 3: 约束系统与环境配置 | Complete |
| SIM-05 | Phase 3: 约束系统与环境配置 | Complete |
| SIM-06 | Phase 1: 仿真核心与基础3D渲染 | Complete (01-03) |
| REN-01 | Phase 1: 仿真核心与基础3D渲染 | Complete (01-02) |
| REN-02 | Phase 1: 仿真核心与基础3D渲染 | Complete (01-02) |
| REN-03 | Phase 2: 组件化实体系统与属性编辑 | Pending |
| DIF-01 | Phase 2: 组件化实体系统与属性编辑 | Pending |
| DIF-02 | Phase 4: 轨迹与矢量可视化 | Pending |
| DIF-03 | Phase 4: 轨迹与矢量可视化 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-30*
*Last updated: 2026-04-30 after roadmap creation*
