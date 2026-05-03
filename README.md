# Physis — 组件化物理模拟平台

基于 Web 的实时 3D 物理模拟平台，通过组合基础物理原语自由搭建场景，3D 画面实时呈现。面向高中经典力学教学场景。

## 功能

- **3D 物理沙盒** — 刚体碰撞、堆叠、重力模拟，固定 120Hz 时间步长
- **组件化实体系统** — ECS 架构，自由组合形状/材质/物理属性创建任意实体
- **实时属性编辑** — 选中实体即编辑质量、摩擦、弹性、初速度等参数，即时生效
- **约束系统** — 弹簧连接物体，可配置刚度/原长/阻尼
- **环境配置** — 全局重力矢量、摩擦系数、弹性系数、空气阻力可调
- **轨迹可视化** — 30Hz 采样的运动轨迹残影，BufferGeometry + 顶点颜色渐变
- **矢量可视化** — 实时速度箭头 + 受力分析（重力/弹力/接触力/阻力/合力），对数比例缩放
- **3D 视角** — 轨道旋转/平移/缩放，RGB 坐标轴辅助

## 技术栈

| 层 | 技术 |
|---|---|
| 3D 渲染 | React Three Fiber + drei |
| 物理引擎 | Rapier WASM (@react-three/rapier) |
| 状态管理 | Zustand + persist |
| UI | React 19 + shadcn/ui + Radix UI |
| 样式 | Tailwind CSS v4 |
| 构建 | Vite + TypeScript |

## 快速开始

```bash
# 安装依赖
cd frontend
npm install

# 启动开发服务器
npm run dev

# 构建
npm run build
```

打开 http://localhost:5173

## 项目结构

```
frontend/src/
├── components/       # React/R3F 组件
│   ├── Scene3D.tsx           # 主场景（Canvas + Physics + 渲染器）
│   ├── EntityRenderer.tsx    # ECS 实体 → Rapier RigidBody
│   ├── SpringRenderer.tsx    # 弹簧约束渲染
│   ├── TrajectoryRenderer.tsx # 轨迹渲染
│   ├── VectorRenderer.tsx    # 矢量箭头渲染
│   ├── Arrow3D.tsx           # 箭头几何体
│   ├── Toolbar.tsx           # 顶部工具栏
│   ├── Toolbox.tsx           # 左侧工具箱
│   └── PropertyPanel.tsx     # 右侧属性面板
├── ecs/              # ECS 类型与工具
├── store/            # Zustand 状态管理
├── utils/            # 工具函数（矢量缩放等）
└── __tests__/        # 测试
```

## 架构

```
UI Layer (React + shadcn/ui)
  ↕ Zustand Store
Rendering Layer (React Three Fiber)
  ↕ RigidBodyRefContext
Physics Layer (Rapier WASM)
```

- 物理帧数据不经过 Zustand（避免 re-render 风暴），通过 `RigidBodyRefContext` 直读 Rapier 引用
- ECS 元数据（实体列表、选中状态、组件属性）经 Zustand 驱动 UI 更新
- 可视化层（轨迹、矢量）用 imperative Three.js 操作绕过 React 渲染管线

## 开发阶段

| Phase | 内容 | 状态 |
|-------|------|------|
| 1 | 仿真核心与基础 3D 渲染 | ✅ |
| 2 | 组件化实体系统与属性编辑 | ✅ |
| 3 | 约束系统与环境配置 | ✅ |
| 4 | 轨迹与矢量可视化 | ✅ |

## License

MIT
