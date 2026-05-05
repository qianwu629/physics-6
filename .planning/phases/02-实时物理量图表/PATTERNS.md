# Phase 2: 实时物理量图表 - Pattern Map

**Mapped:** 2026-05-05
**Files analyzed:** 7 new files
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/src/store/chartDataStore.ts` | store (config) | pub-sub | `frontend/src/store/visualizationStore.ts` | exact |
| `frontend/src/ecs/ChartSampler.ts` | service | streaming | `frontend/src/components/TrajectoryRenderer.tsx` | exact |
| `frontend/src/store/chartBuffer.ts` | utility | streaming | `frontend/src/ecs/TrajectoryBuffer.ts` | exact |
| `frontend/src/components/ChartCanvas.tsx` | component | streaming | `frontend/src/components/TrajectoryRenderer.tsx` + RESEARCH.md Pattern 1 | role-match |
| `frontend/src/components/ChartPanel.tsx` | component | request-response | `frontend/src/components/SnapshotManager.tsx` (Sheet) | partial |
| `frontend/src/utils/physicsCalc.ts` | utility | transform | `frontend/src/utils/vectorScale.ts` | role-match |
| `frontend/src/components/ChartMetricTabs.tsx` | component | request-response | `frontend/src/components/EnvironmentPanel.tsx` (preset buttons) | partial |
| `frontend/src/components/PropertyPanel.tsx` | component (modified) | request-response | 自身现有代码 | exact |
| `frontend/src/components/EnvironmentPanel.tsx` | component (modified) | request-response | 自身现有代码 | exact |
| `frontend/src/components/Toolbar.tsx` | component (modified) | request-response | 自身现有代码 | exact |
| `frontend/src/components/Scene3D.tsx` | component (modified) | streaming | 自身现有代码 | exact |
| `frontend/src/store/simulationSlice.ts` | store (modified) | pub-sub | 自身现有代码 | exact |

## Pattern Assignments

### `frontend/src/store/chartDataStore.ts` (store, pub-sub)

**Analog:** `frontend/src/store/visualizationStore.ts`

**Imports pattern** (lines 1-3):
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
```

**Core pattern** (lines 5-35):
```typescript
export const useVisualizationStore = create<VisualizationState>()(
  persist(
    (set) => ({
      showTrails: true,
      showVelocityVectors: false,
      showForceVectors: false,
      vectorDisplayMode: 'all',

      toggleTrails: () => set((s) => ({ showTrails: !s.showTrails })),
      toggleVelocityVectors: () =>
        set((s) => ({ showVelocityVectors: !s.showVelocityVectors })),
      toggleForceVectors: () =>
        set((s) => ({ showForceVectors: !s.showForceVectors })),
      setVectorDisplayMode: (mode) => set({ vectorDisplayMode: mode }),
    }),
    { name: 'physis-visualization' }
  )
);
```

**Pattern Match:**
- Zustand `create` + `persist` 中间件模式完全一致
- 纯配置状态（布尔/枚举），不存高频数据
- 独立 store（不合并到 `useSimulationStore`）

**Key Differences:**
- chartDataStore 需要 `Set<string>` 类型的 `trackedEntityIds`（需 custom JSON serializer 处理 persist）
- 需要 `timeWindow: '5s' | '30s' | 'all'` 和 `layoutMode: 'overlay' | 'separate'` 枚举
- 需要 `peReferenceY: number`（默认 0）
- 不需要 `persist`（实时配置不需要跨会话保留，或可选 persist）

**Borrowable Code:**
```typescript
// 从 visualizationStore.ts 复制基本骨架
import { create } from 'zustand';

interface ChartConfigState {
  trackedEntityIds: Set<string>;
  timeWindow: '5s' | '30s' | 'all';
  layoutMode: 'overlay' | 'separate';
  visibleMetrics: Set<'position' | 'velocity' | 'acceleration' | 'energy'>;
  peReferenceY: number;
  toggleTracking: (id: string) => void;
  setTimeWindow: (w: '5s' | '30s' | 'all') => void;
  setLayoutMode: (m: 'overlay' | 'separate') => void;
  setPeReferenceY: (y: number) => void;
}

export const useChartDataStore = create<ChartConfigState>()((set) => ({
  trackedEntityIds: new Set(),
  timeWindow: '30s',
  layoutMode: 'overlay',
  visibleMetrics: new Set(['position', 'velocity', 'acceleration', 'energy']),
  peReferenceY: 0,

  toggleTracking: (id) => set((s) => {
    const next = new Set(s.trackedEntityIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return { trackedEntityIds: next };
  }),
  setTimeWindow: (w) => set({ timeWindow: w }),
  setLayoutMode: (m) => set({ layoutMode: m }),
  setPeReferenceY: (y) => set({ peReferenceY: y }),
}));
```

**Integration Point:**
- `PropertyPanel.tsx` 读取 `trackedEntityIds` 渲染 Switch
- `ChartSampler.ts` 读取 `trackedEntityIds` 决定采样哪些实体
- `EnvironmentPanel.tsx` 添加 `peReferenceY` 滑块输入

---

### `frontend/src/ecs/ChartSampler.ts` (service, streaming)

**Analog:** `frontend/src/components/TrajectoryRenderer.tsx`

**Imports pattern** (lines 1-9):
```typescript
import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '../store';
import { useVisualizationStore } from '../store/visualizationStore';
import { TrajectoryBuffer } from '../ecs/TrajectoryBuffer';
import { useRigidBodyRefRegistry } from './RigidBodyRefContext';
```

**Core streaming pattern** (lines 28-89):
```typescript
useFrame(() => {
  if (!showTrails) return;
  const now = performance.now() / 1000;

  for (const [entityId, entity] of entities) {
    const rb = getRef(entityId);
    if (!rb || !rb.current) continue;

    const vel = rb.current.linvel();
    const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
    if (speed < VELOCITY_THRESHOLD) continue;

    const prevTime = lastSampleTime.current.get(entityId);
    if (prevTime !== undefined && now - prevTime < SAMPLE_INTERVAL) continue;
    lastSampleTime.current.set(entityId, now);

    // push to buffer...
    const pos = rb.current.translation();
    buf.push(new THREE.Vector3(pos.x, pos.y, pos.z), now);
  }
});
```

**Pattern Match:**
- `useFrame` 每帧采样，与渲染帧同步
- 通过 `useRigidBodyRefRegistry().getRef(entityId)` 获取 Rapier rigidBody
- 读取 `rigidBody.linvel()` 和 `rigidBody.translation()`
- 使用 ref 管理 lastSampleTime 避免 React re-render
- 遍历 `entities` Map 处理每个实体

**Key Differences:**
- 采样频率 60Hz（`SAMPLE_INTERVAL = 1/60`）而非 30Hz
- 需要采样所有被追踪实体，不限于运动中的实体（不检查速度阈值）
- 需要自算加速度（差分 + SMA 平滑）
- 需要计算能量（KE + PE_gravity + PE_springs）
- 数据写入 `chartBuffer.ts` 而非 `TrajectoryBuffer`
- 需要监听 `isRunning` 和 `resetCounter`

**Borrowable Code:**
```typescript
// 从 TrajectoryRenderer.tsx 复制 useFrame 采样骨架
useFrame(() => {
  const store = useSimulationStore.getState();
  if (!store.isRunning) return; // 暂停时冻结

  const now = performance.now() / 1000;
  const trackedIds = useChartDataStore.getState().trackedEntityIds;

  for (const entityId of trackedIds) {
    const rbRef = getRef(entityId);
    if (!rbRef?.current) continue;

    const vel = rbRef.current.linvel();
    const pos = rbRef.current.translation();
    const mass = rbRef.current.mass();

    // 加速度：差分 + SMA 平滑（见 physicsCalc.ts）
    // 能量：KE + PE（见 physicsCalc.ts）
    // 写入 chartBuffer...
  }
});
```

**Integration Point:**
- 作为 React 组件挂载在 `Scene3D.tsx` 的 `<Canvas>` 内部（与 `TrajectoryRenderer` 同级）
- 或者作为纯 class 被 `Scene3D` 的 `useFrame` 回调调用（更轻量）

---

### `frontend/src/store/chartBuffer.ts` (utility, streaming)

**Analog:** `frontend/src/ecs/TrajectoryBuffer.ts`

**Core pattern** (lines 7-57):
```typescript
export class TrajectoryBuffer {
  private positions: Float32Array;
  private timestamps: Float32Array;
  private head = 0;
  private count = 0;

  constructor() {
    this.positions = new Float32Array(MAX_POINTS * STRIDE);
    this.timestamps = new Float32Array(MAX_POINTS);
  }

  push(position: Vector3, time: number): void {
    const idx = this.head * STRIDE;
    this.positions[idx] = position.x;
    this.positions[idx + 1] = position.y;
    this.positions[idx + 2] = position.z;
    this.timestamps[this.head] = time;
    this.head = (this.head + 1) % MAX_POINTS;
    this.count = Math.min(this.count + 1, MAX_POINTS);
  }

  getPoints(currentTime: number): { positions: Vector3[]; count: number } {
    const result: Vector3[] = [];
    const cutoff = currentTime - MAX_AGE_SECONDS;
    const start = this.count < MAX_POINTS ? 0 : this.head;
    let validCount = 0;
    for (let i = 0; i < this.count; i++) {
      const bufIdx = (start + i) % MAX_POINTS;
      if (this.timestamps[bufIdx] >= cutoff) {
        const pIdx = bufIdx * STRIDE;
        result.push(new Vector3(...));
        validCount++;
      }
    }
    return { positions: result, count: validCount };
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }
}
```

**Pattern Match:**
- `Float32Array` 环形缓冲（新文件用 `Float64Array` 保证精度）
- `head` 指针 + `count` 计数器实现循环覆盖
- `push` 写入 + `getPoints` 按时间裁剪读取
- `clear` 重置

**Key Differences:**
- 使用 `Float64Array` 而非 `Float32Array`（物理量计算精度要求）
- 每实体一个缓冲区，但每缓冲区存储 12 个指标（x,y,z, vx,vy,vz, ax,ay,az, KE,PE,E）
- `MAX_POINTS = 500_000`（约 10 分钟 @ 60Hz）
- `getSeriesData(metricIndex, startTime, endTime)` 返回 `{time, value}[]` 供 lightweight-charts 消费

**Borrowable Code:**
```typescript
// 从 TrajectoryBuffer.ts 扩展
const MAX_POINTS = 500_000;
const METRICS_PER_ENTITY = 12; // x,y,z, vx,vy,vz, ax,ay,az, KE,PE,E

export class ChartDataBuffer {
  private data: Float64Array;
  private timestamps: Float64Array;
  private head = 0;
  private count = 0;

  constructor() {
    this.data = new Float64Array(MAX_POINTS * METRICS_PER_ENTITY);
    this.timestamps = new Float64Array(MAX_POINTS);
  }

  push(time: number, metrics: Float64Array /* length 12 */): void {
    const idx = this.head * METRICS_PER_ENTITY;
    this.data.set(metrics, idx);
    this.timestamps[this.head] = time;
    this.head = (this.head + 1) % MAX_POINTS;
    this.count = Math.min(this.count + 1, MAX_POINTS);
  }

  getSeriesData(metricIndex: number, startTime: number, endTime: number): { time: number; value: number }[] {
    const result: { time: number; value: number }[] = [];
    const start = this.count < MAX_POINTS ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      const bufIdx = (start + i) % MAX_POINTS;
      const t = this.timestamps[bufIdx];
      if (t >= startTime && t <= endTime) {
        result.push({
          time: t,
          value: this.data[bufIdx * METRICS_PER_ENTITY + metricIndex],
        });
      }
    }
    return result;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }
}
```

**Integration Point:**
- 模块级全局 `Map<string, ChartDataBuffer>`（key = entityId）
- `ChartSampler.ts` 每帧调用 `buffer.push(time, metrics)`
- `ChartCanvas.tsx` 从缓冲区读取数据调用 `series.update()`

---

### `frontend/src/components/ChartCanvas.tsx` (component, streaming)

**Analog:** `frontend/src/components/TrajectoryRenderer.tsx` (imperative ref 模式) + RESEARCH.md Pattern 1

**Imports pattern** (from RESEARCH.md):
```typescript
import { useEffect, useRef } from 'react';
import { createChart, LineSeries, type IChartApi, type ISeriesApi } from 'lightweight-charts';
```

**Core imperative pattern** (RESEARCH.md Pattern 1):
```typescript
export function ChartCanvas({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const chartRef = useRef<IChartApi | null>(null);
  const seriesMapRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: { background: { type: 'solid', color: '#1a1a2e' }, textColor: '#d1d4dc' },
      timeScale: { timeVisible: true, secondsVisible: true },
    });
    chartRef.current = chart;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    });
    ro.observe(container);

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, [containerRef]);

  // 暴露给父组件的 imperative API
  return { chartRef, seriesMapRef };
}
```

**Pattern Match:**
- `useRef` 持有 chart 实例，所有更新绕过 React 渲染
- `useEffect` 初始化 + cleanup 释放资源
- `ResizeObserver` 驱动尺寸更新

**Key Differences:**
- 不是 R3F 组件，是普通 React 组件（渲染 `<div>` 容器）
- 需要支持多 Series 动态增删（追踪实体变化时 add/remove series）
- 需要支持 `update()` 增量更新（60Hz）
- 需要支持 `setVisibleRange()` 时间窗口切换
- 需要支持 overlay/separate 布局切换

**Borrowable Code:**
```typescript
// 初始化（来自 RESEARCH.md Pattern 1）
const chart = createChart(container, {
  width: container.clientWidth,
  height: container.clientHeight,
  layout: {
    background: { type: 'solid', color: '#1a1a2e' },
    textColor: '#d1d4dc',
  },
  timeScale: {
    timeVisible: true,
    secondsVisible: true,
    borderColor: '#2B2B43',
  },
  rightPriceScale: { borderColor: '#2B2B43' },
  crosshair: {
    mode: 1,
    vertLine: { width: 1, color: '#758696', style: 3 },
    horzLine: { width: 1, color: '#758696', style: 3 },
  },
});

// ResizeObserver（来自 RESEARCH.md Pattern 1）
const ro = new ResizeObserver((entries) => {
  const { width, height } = entries[0].contentRect;
  chart.applyOptions({ width, height });
});
ro.observe(container);

// cleanup（来自 TrajectoryRenderer.tsx 的 dispose 模式）
return () => {
  ro.disconnect();
  chart.remove();
  chartRef.current = null;
};
```

**Integration Point:**
- 作为 `ChartPanel.tsx` 的子组件，接收 `containerRef`
- 通过 `useImperativeHandle` 暴露 `updateSeries(entityId, metric, time, value)` 给父组件
- 父组件在 rAF 中调用这些 imperative API

---

### `frontend/src/components/ChartPanel.tsx` (component, request-response)

**Analog:** `frontend/src/components/SnapshotManager.tsx` (Sheet/Dialog 面板模式)

**Imports pattern** (lines 1-22):
```typescript
import React, { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
```

**Panel UI pattern** (lines 256-341):
```typescript
<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent side="right" className="w-[400px] sm:max-w-[400px] bg-[#1a1a1a]/85 backdrop-blur-sm border border-[rgba(255,255,255,0.08)]">
    <SheetHeader>
      <SheetTitle className="text-[#e0e0e0]">快照管理</SheetTitle>
      <SheetDescription className="text-[#a0a0a0]">保存/加载/重命名/删除场景快照</SheetDescription>
    </SheetHeader>
    <ScrollArea className="flex-1 px-4">
      {/* content */}
    </ScrollArea>
  </SheetContent>
</Sheet>
```

**Pattern Match:**
- 固定定位面板（right: 16px, top: 80px）
- 半透明背景 + backdrop-blur
- 标题 + 关闭按钮 + 内容区
- 使用 shadcn/ui 组件（Sheet, ScrollArea）

**Key Differences:**
- 不是 Sheet（从右侧滑出），而是 `position: fixed` 浮动面板（类似 PropertyPanel 的固定定位）
- 需要 `react-draggable` 实现拖拽（handle = panel-header）
- 需要 `re-resizable` 实现大小调整
- 内部包含 `ChartCanvas` + `ChartMetricTabs`
- 需要时间窗口切换按钮（5s/30s/全程）

**Borrowable Code:**
```typescript
// 面板容器样式（来自 PropertyPanel.tsx + SnapshotManager.tsx）
<div
  className="fixed z-40 rounded-xl flex flex-col"
  style={{
    right: '16px',
    top: '80px',
    bottom: '16px',
    width: '600px',
    height: '400px',
    backgroundColor: 'rgba(26, 26, 26, 0.85)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  }}
>
  {/* Header */}
  <div
    className="flex items-center justify-between px-3 shrink-0"
    style={{ height: '40px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
  >
    <span className="text-sm font-semibold" style={{ color: '#e0e0e0' }}>实时物理量图表</span>
    <button type="button" className="rounded hover:bg-white/5 transition-colors p-1" onClick={onClose}>
      <X size={14} style={{ color: '#a0a0a0' }} />
    </button>
  </div>
  {/* ChartCanvas */}
</div>
```

**Integration Point:**
- `Toolbar.tsx` 添加 toggle 按钮控制 `ChartPanel` 显示/隐藏
- `App.tsx` 中挂载 `<ChartPanel />`（与 `PropertyPanel` 同级）
- 通过 `useChartDataStore` 读取配置状态

---

### `frontend/src/utils/physicsCalc.ts` (utility, transform)

**Analog:** `frontend/src/utils/vectorScale.ts`

**Imports pattern** (lines 1-18):
```typescript
const MIN_LENGTH = 0.3;
const MAX_LENGTH = 4.0;
const SCALE_FACTOR = 10;

export function scaleForceToLength(magnitude: number): number {
  if (magnitude <= 0) return MIN_LENGTH;
  const logValue = Math.log10(1 + magnitude / SCALE_FACTOR);
  const maxLog = Math.log10(1 + 1000 / SCALE_FACTOR);
  const normalized = Math.min(logValue / maxLog, 1);
  return MIN_LENGTH + normalized * (MAX_LENGTH - MIN_LENGTH);
}
```

**Pattern Match:**
- 纯函数，无 React 依赖
- 数学计算 + 边界处理
- 模块级常量定义

**Key Differences:**
- 需要 `RigidBody` 类型参数（从 Rapier 读取）
- 需要遍历约束实体计算弹簧弹性势能
- 需要 SMA 平滑算法

**Borrowable Code:**
```typescript
// 能量计算（来自 RESEARCH.md）
function computeEnergy(
  rigidBody: RigidBody,
  mass: number,
  gravityY: number,
  peReferenceY: number,
  springs: Array<{ stiffness: number; restLength: number; entityAId: string; entityBId: string }>,
  getEntityPosition: (id: string) => Vector3 | null,
): { ke: number; peGravity: number; peSprings: number; total: number } {
  const vel = rigidBody.linvel();
  const pos = rigidBody.translation();
  const v2 = vel.x * vel.x + vel.y * vel.y + vel.z * vel.z;
  const ke = 0.5 * mass * v2;
  const peGravity = mass * Math.abs(gravityY) * (pos.y - peReferenceY);

  let peSprings = 0;
  for (const spring of springs) {
    const pA = getEntityPosition(spring.entityAId);
    const pB = getEntityPosition(spring.entityBId);
    if (!pA || !pB) continue;
    const dx = pB.x - pA.x, dy = pB.y - pA.y, dz = pB.z - pA.z;
    const currentLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const delta = currentLength - spring.restLength;
    peSprings += 0.5 * spring.stiffness * delta * delta;
  }
  return { ke, peGravity, peSprings, total: ke + peGravity + peSprings };
}
```

**Integration Point:**
- `ChartSampler.ts` 每帧调用 `computeEnergy()` 和 `computeSmoothedAcceleration()`
- `EnvironmentPanel.tsx` 提供 `peReferenceY` 参数

---

### `frontend/src/components/ChartMetricTabs.tsx` (component, request-response)

**Analog:** `frontend/src/components/EnvironmentPanel.tsx` (preset 按钮组)

**Core UI pattern** (lines 143-159):
```typescript
<div className="flex gap-1.5 mb-2">
  {GRAVITY_PRESETS.map((p) => (
    <button
      key={p.label}
      type="button"
      disabled={isRunning}
      onClick={() => setGravity([...p.value])}
      className={`flex-1 px-1 py-1.5 rounded-lg text-xs transition-all
        ${environment.gravity[1] === p.value[1] ? 'bg-[rgba(59,130,246,0.2)] border border-[#3b82f6] text-[#e0e0e0]' : 'bg-[rgba(255,255,255,0.04)] border border-transparent text-[#888] hover:bg-[rgba(59,130,246,0.1)]'}
        disabled:opacity-40 disabled:cursor-not-allowed
      `}
    >
      {p.label}
    </button>
  ))}
</div>
```

**Pattern Match:**
- 横向按钮组，当前选中项高亮（蓝色边框 + 背景）
- 小尺寸（text-xs, px-1 py-1.5）
- 过渡动画（transition-all）

**Key Differences:**
- 4 个 Tab（位置/速度/加速度/能量）而非预设按钮
- 切换时改变 `visibleMetrics` 状态，影响 ChartCanvas 显示哪些 Series
- 不是 disabled 状态，而是 active/inactive 切换

**Borrowable Code:**
```typescript
const METRICS = [
  { key: 'position', label: '位置', color: '#3b82f6' },
  { key: 'velocity', label: '速度', color: '#22c55e' },
  { key: 'acceleration', label: '加速度', color: '#f97316' },
  { key: 'energy', label: '能量', color: '#a855f7' },
] as const;

<div className="flex gap-1.5">
  {METRICS.map((m) => (
    <button
      key={m.key}
      type="button"
      onClick={() => setActiveMetric(m.key)}
      className={`flex-1 px-2 py-1 rounded-lg text-xs transition-all
        ${activeMetric === m.key
          ? 'bg-[rgba(59,130,246,0.2)] border border-[#3b82f6] text-[#e0e0e0]'
          : 'bg-[rgba(255,255,255,0.04)] border border-transparent text-[#888] hover:bg-[rgba(59,130,246,0.1)]'}
      `}
    >
      {m.label}
    </button>
  ))}
</div>
```

**Integration Point:**
- 作为 `ChartPanel.tsx` 的子组件
- 通过 `useChartDataStore` 的 `visibleMetrics` 控制显示

---

### `frontend/src/components/PropertyPanel.tsx` (modified, request-response)

**Analog:** 自身现有代码（`toggleTrailVisibility` / `toggleVectorVisibility` 开关模式）

**现有开关模式** (lines 489-504):
```typescript
<div className="pt-2 mt-2 border-t border-white/10 space-y-1.5">
  <div className="flex items-center justify-between">
    <label className="text-xs text-white/60">显示轨迹</label>
    <Switch
      checked={trailComp?.visible ?? true}
      onCheckedChange={(v) => toggleTrailVisibility(selectedEntity.id, v)}
    />
  </div>
  <div className="flex items-center justify-between">
    <label className="text-xs text-white/60">显示矢量</label>
    <Switch
      checked={vectorComp?.showVelocity ?? true}
      onCheckedChange={(v) => toggleVectorVisibility(selectedEntity.id, v)}
    />
  </div>
</div>
```

**Integration Point:**
- 在"可视化开关"区域（line 489 附近）添加第三个 Switch：
```typescript
<div className="flex items-center justify-between">
  <label className="text-xs text-white/60">图表追踪</label>
  <Switch
    checked={trackedIds.has(selectedEntity.id)}
    onCheckedChange={(v) => useChartDataStore.getState().toggleTracking(selectedEntity.id)}
  />
</div>
```

---

### `frontend/src/components/EnvironmentPanel.tsx` (modified, request-response)

**Analog:** 自身现有代码（`HighlightSlider` 组件模式）

**现有滑块模式** (lines 19-67):
```typescript
function HighlightSlider({ value, onChange, min, max, step, disabled, unit }: {...}) {
  const [highlight, setHighlight] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const handleChange = (v: number) => {
    onChange(v);
    if (!disabled) { setHighlight(true); clearTimeout(timerRef.current); timerRef.current = setTimeout(() => setHighlight(false), 300); }
  };
  return (
    <div className="flex items-center gap-2">
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => handleChange(parseFloat(e.target.value))} ... />
      <input type="number" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => handleChange(parseFloat(e.target.value) || 0)} ... />
      <span className="text-xs text-[#666] w-8">{unit}</span>
    </div>
  );
}
```

**Integration Point:**
- 在"Drag"区域之后添加 `peReferenceY` 输入：
```typescript
<div className="h-px bg-[rgba(255,255,255,0.06)] my-3" />
<div className="mb-2">
  <div className="text-xs font-medium text-[#a0a0a0] mb-2">势能参考高度 (y=0)</div>
  <HighlightSlider
    value={peReferenceY}
    onChange={setPeReferenceY}
    min={-50}
    max={50}
    step={0.1}
    disabled={false}
    unit="m"
  />
</div>
```

---

### `frontend/src/components/Toolbar.tsx` (modified, request-response)

**Analog:** 自身现有代码（按钮组模式）

**现有按钮模式** (lines 162-209):
```typescript
<div className="flex items-center gap-1 pl-1 border-l border-white/10">
  <button type="button" onClick={toggleTrails} className={cn('px-2 py-1 text-xs rounded', showTrails ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80')} title={showTrails ? '隐藏轨迹' : '显示轨迹'}>
    轨迹
  </button>
  {/* ... */}
</div>
```

**Integration Point:**
- 在"可视化控制按钮"区域之后添加图表面板 toggle：
```typescript
<div className="flex items-center gap-1 pl-1 border-l border-white/10">
  <button
    type="button"
    onClick={toggleChartPanel}
    className={cn(
      'px-2 py-1 text-xs rounded',
      chartPanelOpen ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'
    )}
    title={chartPanelOpen ? '隐藏图表' : '显示图表'}
  >
    图表
  </button>
</div>
```

---

### `frontend/src/components/Scene3D.tsx` (modified, streaming)

**Analog:** 自身现有代码（`TrajectoryRenderer` / `VectorRenderer` 挂载模式）

**现有挂载模式** (lines 288-292):
```typescript
{/* Phase 4: 轨迹渲染 — TrajectoryRenderer */}
<TrajectoryRenderer />

{/* Phase 4: 矢量渲染 — VectorRenderer */}
<VectorRenderer />
```

**Integration Point:**
- 在 `VectorRenderer` 之后添加 `ChartSampler`：
```typescript
{/* Phase 2: 图表采样 — ChartSampler */}
<ChartSampler />
```
- 或者将 `ChartSampler` 的逻辑直接内联到 `Scene3D` 的 `useFrame` 中（如果 `ChartSampler` 不是 React 组件而是纯 class）

---

### `frontend/src/store/simulationSlice.ts` (modified, pub-sub)

**Analog:** 自身现有代码（`EnvironmentState` 扩展模式）

**现有环境状态** (lines 12-24):
```typescript
export interface EnvironmentState {
  gravity: [number, number, number];
  frictionScale: number;
  restitutionScale: number;
  drag: number;
}

export const DEFAULT_ENVIRONMENT: EnvironmentState = {
  gravity: [0, -9.81, 0],
  frictionScale: 1.0,
  restitutionScale: 1.0,
  drag: 0.1,
};
```

**Integration Point:**
- 在 `EnvironmentState` 中添加 `peReferenceY`：
```typescript
export interface EnvironmentState {
  gravity: [number, number, number];
  frictionScale: number;
  restitutionScale: number;
  drag: number;
  peReferenceY: number; // D-02-08
}

export const DEFAULT_ENVIRONMENT: EnvironmentState = {
  gravity: [0, -9.81, 0],
  frictionScale: 1.0,
  restitutionScale: 1.0,
  drag: 0.1,
  peReferenceY: 0,
};
```
- 在 `SimulationSlice` 中添加 `setPeReferenceY: (y: number) => void`
- 在 `createSimulationSlice` 中实现：
```typescript
setPeReferenceY: (y) => set((s) => ({ environment: { ...s.environment, peReferenceY: y } })),
```

## Shared Patterns

### Zustand 配置 + Ref 数据分离
**Source:** `frontend/src/components/contactForceStore.ts` + `frontend/src/store/visualizationStore.ts`
**Apply to:** `chartDataStore.ts`, `chartBuffer.ts`, `ChartSampler.ts`
```typescript
// Zustand 只存配置
export const useChartDataStore = create<ChartConfigState>()((set) => ({
  trackedEntityIds: new Set(),
  // ...
}));

// 高频数据存在模块级，不经过 Zustand
const chartBuffers = new Map<string, ChartDataBuffer>();
```

### useFrame 采样循环
**Source:** `frontend/src/components/TrajectoryRenderer.tsx`
**Apply to:** `ChartSampler.ts`
```typescript
useFrame(() => {
  if (!isRunning) return; // 暂停冻结
  const now = performance.now() / 1000;
  for (const [entityId, entity] of entities) {
    const rb = getRef(entityId);
    if (!rb?.current) continue;
    const vel = rb.current.linvel();
    const pos = rb.current.translation();
    // push to buffer...
  }
});
```

### Float64Array 环形缓冲
**Source:** `frontend/src/ecs/TrajectoryBuffer.ts`
**Apply to:** `chartBuffer.ts`
```typescript
export class ChartDataBuffer {
  private data: Float64Array;
  private timestamps: Float64Array;
  private head = 0;
  private count = 0;

  push(time: number, metrics: Float64Array): void {
    const idx = this.head * METRICS_PER_ENTITY;
    this.data.set(metrics, idx);
    this.timestamps[this.head] = time;
    this.head = (this.head + 1) % MAX_POINTS;
    this.count = Math.min(this.count + 1, MAX_POINTS);
  }

  clear(): void { this.head = 0; this.count = 0; }
}
```

### 固定定位面板 UI
**Source:** `frontend/src/components/PropertyPanel.tsx` + `frontend/src/components/SnapshotManager.tsx`
**Apply to:** `ChartPanel.tsx`
```typescript
<div className="fixed z-40 rounded-xl flex flex-col"
  style={{
    right: '16px', top: '80px',
    backgroundColor: 'rgba(26, 26, 26, 0.85)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  }}>
  {/* header + content */}
</div>
```

### Switch 开关模式
**Source:** `frontend/src/components/PropertyPanel.tsx` (lines 489-504)
**Apply to:** PropertyPanel 图表追踪开关
```typescript
<div className="flex items-center justify-between">
  <label className="text-xs text-white/60">图表追踪</label>
  <Switch checked={...} onCheckedChange={...} />
</div>
```

### HighlightSlider 数值输入
**Source:** `frontend/src/components/EnvironmentPanel.tsx` (lines 19-67)
**Apply to:** EnvironmentPanel peReferenceY 输入
```typescript
function HighlightSlider({ value, onChange, min, max, step, disabled, unit }) {
  // range + number input + highlight effect
}
```

## No Analog Found

无 — 所有新增/修改文件均找到对应类比。

## Metadata

**Analog search scope:** `frontend/src/ecs/`, `frontend/src/store/`, `frontend/src/components/`, `frontend/src/utils/`
**Files scanned:** 20+
**Pattern extraction date:** 2026-05-05
