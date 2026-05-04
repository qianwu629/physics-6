# Milestones: Physis

历史里程碑日志。最新里程碑在最上方。

---

## v1.0 — MVP 物理沙盒（2026-05-04）

**状态:** ✅ 已发布
**阶段:** 1-5（含 Phase 5 债务清理）
**计划:** 17
**Commits:** 136
**代码量:** 8,708 LOC（71 个 .ts/.tsx 文件）
**周期:** 2026-05-01 → 2026-05-04（3 天）

### 核心交付

1. **Phase 1 — 仿真核心与3D渲染**：可运行的物理沙盒（Rapier WASM + R3F + 14 个硬编码物体），支持 3D 视角旋转、播放/暂停/重置，120Hz 固定时间步长保证帧率无关性
2. **Phase 2 — ECS 组件化实体系统**：用户通过 UI 自由添加 4 种形状，PropertyPanel 编辑物理参数，无硬编码模板（关键差异化能力 DIF-01）
3. **Phase 3 — 约束系统 + 环境配置**：弹簧约束（helix tube + 简谐运动）、全局重力/摩擦/弹性/空气阻力倍率，171 单元测试覆盖
4. **Phase 4 — 轨迹与矢量可视化**：30Hz 轨迹拖尾、5 种力 + 速度的彩色箭头叠加，4 个全局 toggle + 按实体开关
5. **Phase 5 — 运行时属性同步债务清理**：通过 Rapier imperative API（setAdditionalMass / collider.setRestitution / setFriction / setLinearDamping）让 PropertyPanel 编辑实时生效，关闭 REN-03 / Pitfall 5

### 需求覆盖

12/12 v1 需求全部实现：SIM-01..06、REN-01..03、DIF-01..03。

### 关键技术决策

- **架构**：ECS 组件组合（替代废案的模板模式）
- **技术栈**：React 19 + R3F + @react-three/rapier + Zustand + Vite + Tailwind v4 + shadcn/ui
- **物理引擎**：Rapier 3D WASM，120Hz 固定时间步长 + 渲染插值
- **状态管理**：per-frame 物理数据不进 Zustand（PITFALLS #6）；entity Map + 不可变更新；visualizationStore 独立 persist
- **运行时同步**：restitution/friction 走 collider-level setter（Rapier3D 物理上属于 collider）；mass 用 setAdditionalMass

### 已知遗留（可接受技术债）

- 弹簧 3D tube 射线点击选中需手动验证（自动化坐标点击难以保证命中）
- 多弹簧链（≥3）数值稳定性需手动测试
- 50 实体 + 20 弹簧性能基准需在目标硬件实测
- SpringRenderer 首帧 TubeGeometry 端点猜测（已记录可接受 trade-off）
- Phase 4 缺失正式 VERIFICATION.md（UAT 已替代功能验证）
- Scene3D.test.tsx baseline 失败（three.js Vector3 mock 缺失，9 个用例）

无重大债务遗留。

### 归档文件

- `.planning/milestones/v1.0-ROADMAP.md` — 完整阶段详情
- `.planning/milestones/v1.0-REQUIREMENTS.md` — 已实现需求与可追溯性
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` — 跨阶段审计报告

Git tag: `v1.0`
